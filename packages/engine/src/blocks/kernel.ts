/**
 * The block kernel — a block is a composition of behaviours it opts into.
 *
 *   block<P>('nisli-thing', {
 *     measure: 'width',                       // ctx.width is this block's inline size
 *     surface: true,                          // provides SurfaceContext; ctx.nested reads it
 *     status: true,                           // engine-drawn waiting (or { skeleton } for its own)
 *     host: (ctx) => ({ display: 'flex' }),   // structural host style, reactive
 *     render: (props, ctx) => [ ... ],        // the block's structure, styled only via ctx.part()
 *   });
 *
 * Every behaviour is a function over the same small `Ctx`; there is no class
 * hierarchy and no base block. The one thing two blocks genuinely share —
 * row-fitting (Toolbar, Table) — is a behaviour too: `ctx.fitRow()`.
 *
 * The rule the kernel makes impossible to break: a block styles an element in
 * exactly one way, `ctx.part(parts, structure)` — a computed style string of
 * structure (`ctx.metrics`) plus the skin's look for those parts. The host is
 * styled by one reactive effect from `spec.host` that *replaces* the previous
 * run — a property absent this run is blanked, so a part that toggles off
 * leaves nothing behind. Nothing here writes an element's style imperatively,
 * so a reactive style can never be shadowed by a stale write. The single
 * sanctioned imperative write is `lockScroll()`, on `<body>`, which no block
 * styles reactively.
 */
import { component, el, computed, effect, signal, onCleanup, type ReadonlySignal, type ReactiveProps, type ComponentFactory, type TemplateResult } from '@nisli/core';
import { metrics, type Metrics } from '../metrics.js';
import { css, apply, buttonBox, type StyleRecord } from '../style.js';
import { look, type Part } from '../skin.js';
import { useWidth, useViewportWidth } from '../engine/measure.js';
import { useFit, type Fit, type FitSpec } from '../engine/use-fit.js';
import { reportIf, type ReportCode } from '../engine/report.js';
import type { FitPlan } from '../engine/fit.js';
import { SurfaceContext, surfaceDepth } from './surface.js';
import { viewOf, createBusy, type Status } from './status.js';

// ── Spec ───────────────────────────────────────────────────────────────

/** One part or several; several compose in order (`['surface', 'bar']`). An empty list is no look. */
export type Parts = Part | readonly Part[];

/** A child of the block's root: anything `el()` accepts as a child. */
export type Rendered = Parameters<typeof el>[2];

export interface BlockSpec<P> {
  /** Structural host style; re-applied (replacing the previous run) whenever what it reads changes (ctx.width, ctx.nested, ctx.props). */
  host?: (ctx: Ctx<P>) => StyleRecord;
  /** The parts the host is dressed as (layered over `host`, live with the skin). */
  hostParts?: Parts | ((ctx: Ctx<P>) => Parts);
  /** Gives `ctx.width`: this block's own inline size, or the viewport's for blocks that float. */
  measure?: 'width' | 'viewport';
  /** This block draws a surface: provides `SurfaceContext` depth to its subtree. */
  surface?: boolean;
  /**
   * The block holds a `status` prop: the engine draws its pending, failed and
   * refreshing states. `true` waits with the standard block skeleton; an
   * object supplies the block's own, drawn with `ctx.skeleton()`/`ctx.bone()`.
   * `ctx.failure`, `ctx.updating` and `ctx.waiting()` are the slots the block
   * places; `ctx.pending` is the flag for a block that draws waiting in place.
   */
  status?: true | { skeleton: (ctx: Ctx<P>) => TemplateResult };
  /** The block's structure. Returned children are wrapped in a `display: contents` root. */
  render: (props: ReactiveProps<P>, ctx: Ctx<P>) => Rendered;
}

/** A row-fitting spec: `useFit` plus the report filed when the plan cannot be satisfied. */
export interface FitRowSpec extends FitSpec {
  /** Filed through `reportIf` on every plan with negative slack. */
  report: { code: ReportCode; detail: (plan: FitPlan) => string };
}

// ── Ctx ────────────────────────────────────────────────────────────────

export interface Ctx<P> {
  /** The custom element. Read for measurement and queries; never styled by hand — `spec.host` owns its style. */
  readonly host: HTMLElement;
  /** The block's intent, reactive. `host`, `hostParts` and `skeleton` decide over it as `render` does. */
  readonly props: ReactiveProps<P>;
  /** The structural numbers this block decides with. Blocks read these, never the module constant. */
  readonly metrics: Metrics;
  /** The measured width (`spec.measure`); 0 when not measured or not yet mounted. */
  readonly width: ReadonlySignal<number>;
  /** True when this block sits inside another surface (a surface inside a surface is not a card). */
  readonly nested: boolean;
  /**
   * The only way a block styles an element: structure (metrics, decisions)
   * plus the look of `parts`, as a computed style string. Either may be a
   * function so it can read signals; a parts thunk may return `[]` to
   * switch a look off. The look is layered after the structure.
   */
  part(parts: Parts | (() => Parts), structure?: StyleRecord | (() => StyleRecord)): ReadonlySignal<string>;
  /** Busy tracking for the block's actions (`createBusy`); created on first read. */
  readonly busy: ReturnType<typeof createBusy>;
  /** Row-fitting behaviour: measure → `fit()` → plan, reporting when it cannot be satisfied. */
  fitRow(spec: FitRowSpec): Fit;
  /** The failure line (message + Retry) while the status has failed, else nothing. Requires `spec.status`. */
  readonly failure: ReadonlySignal<TemplateResult | null>;
  /** The "Updating…" marker while the status is refreshing, else nothing. Requires `spec.status`. */
  readonly updating: ReadonlySignal<TemplateResult | null>;
  /** The skeleton while the status is pending, else `body()`; `body` re-runs only when pending flips. Requires `spec.status`. */
  waiting(body: () => Rendered): ReadonlySignal<unknown>;
  /** True while the status is pending, for a block that draws its own waiting state in place (Table). Requires `spec.status`. */
  readonly pending: ReadonlySignal<boolean>;
  /** A placeholder bar, `height` px and `width` (default full), dressed as `skeleton`. */
  bone(height: number, width?: string | number): TemplateResult;
  /** A group of bones announced as loading. */
  skeleton(bones: readonly TemplateResult[]): TemplateResult;
}

const NO_WIDTH: ReadonlySignal<number> = signal(0);

const toParts = (parts: Parts): readonly Part[] => (typeof parts === 'string' ? [parts] : parts);
const thunk = <T,>(v: T | (() => T)): (() => T) => (typeof v === 'function' ? (v as () => T) : () => v);

/**
 * Define a block. `P` is its intent — the closed set of props an app may say.
 */
export function block<P extends object>(tag: string, spec: BlockSpec<P>): ComponentFactory<P> {
  return component<P>(tag, (props, host) => {
    const nested = surfaceDepth(host) > 0;
    if (spec.surface) SurfaceContext.provide(host, surfaceDepth(host) + 1);

    const width = spec.measure === 'width' ? useWidth(host) : spec.measure === 'viewport' ? useViewportWidth() : NO_WIDTH;

    // Status, cut into booleans: a slot re-runs only when its own flag flips,
    // never on an unrelated change of the view (loading toggling with data present).
    const statusSpec = spec.status;
    const statusProps = props as unknown as { status?: ReadonlySignal<Status | undefined> };
    const view = statusSpec ? computed(() => viewOf(statusProps.status?.value)) : undefined;
    const requireView = (what: string): ReadonlySignal<ReturnType<typeof viewOf>> => {
      if (!view) throw new Error(`<${tag}> uses ctx.${what} but declares no status`);
      return view;
    };
    let busy: ReturnType<typeof createBusy> | undefined;
    const pendingOf = (): ReadonlySignal<boolean> => { const v = requireView('pending'); return computed(() => v.value.pending); };

    const ctx: Ctx<P> = {
      host,
      props,
      metrics,
      width,
      nested,
      part: (parts, structure) => {
        const partsOf = thunk(parts);
        const structureOf = thunk(structure ?? {});
        return computed(() => css({ ...structureOf(), ...look(...toParts(partsOf())) }));
      },
      get busy() { return (busy ??= createBusy()); },
      fitRow: ({ report, onPlan, ...fitSpec }) =>
        useFit(host, {
          ...fitSpec,
          onPlan: (plan, available) => {
            reportIf(plan, { code: report.code, block: tag, width: available, detail: report.detail(plan) });
            onPlan?.(plan, available);
          },
        }),
      get failure() {
        const v = requireView('failure');
        const failed = computed(() => v.value.failed);
        return computed(() => (failed.value ? failure(ctx, failed.value, v.peek().retry) : null));
      },
      get updating() {
        const v = requireView('updating');
        const refreshing = computed(() => v.value.refreshing);
        return computed(() => (refreshing.value ? updating(ctx) : null));
      },
      waiting: (body) => {
        const pending = pendingOf();
        return computed(() => (pending.value ? (typeof statusSpec === 'object' ? statusSpec.skeleton(ctx) : blockSkeleton(ctx)) : body()));
      },
      get pending() { return pendingOf(); },
      bone: (height, width = '100%') => el('div', { style: ctx.part('skeleton', { height, width, display: 'block' }) }),
      skeleton: (bones) => el('div', { role: 'status', 'aria-label': 'Loading', style: ctx.part([], { display: 'flex', flexDirection: 'column', gap: metrics.space[2], minWidth: 0 }) }, [...bones]),
    };

    if (spec.host || spec.hostParts) {
      const hostParts = spec.hostParts ?? [];
      const partsOf = typeof hostParts === 'function' ? hostParts : () => hostParts;
      let previous: string[] = [];
      const stop = effect(() => {
        const record: StyleRecord = { ...spec.host?.(ctx), ...look(...toParts(partsOf(ctx))) };
        const blank = Object.fromEntries(previous.filter((k) => !(k in record)).map((k) => [k, '']));
        apply(host, { ...blank, ...record });
        previous = Object.keys(record);
      });
      onCleanup(stop);
    }

    // Core's setup returns one template; the root is transparent to layout.
    return el('div', { style: 'display:contents' }, spec.render(props, ctx));
  });
}

// ── Engine-drawn status ────────────────────────────────────────────────

/** The standard block skeleton: three bars, full / 80% / 60%. */
const blockSkeleton = <P,>(ctx: Ctx<P>): TemplateResult =>
  ctx.skeleton([ctx.bone(ctx.metrics.control.height), ctx.bone(ctx.metrics.control.height / 2, '80%'), ctx.bone(ctx.metrics.control.height / 2, '60%')]);

/** An inline error line with a Retry when the source can be retried. */
const failure = <P,>(ctx: Ctx<P>, error: Error, retry?: () => void): TemplateResult =>
  el('div', { role: 'alert', style: ctx.part([], { display: 'flex', alignItems: 'center', gap: ctx.metrics.space[3], flexWrap: 'wrap' }) }, [
    el('span', { style: ctx.part('tone.negative', { minWidth: 0 }) }, error.message || String(error)),
    retry
      ? el('button', { type: 'button', style: ctx.part(['button', 'button.plain'], buttonBox()), on: { click: () => retry() } }, 'Retry')
      : null,
  ]);

/** "Updating…" beside a title while fresh data is on its way. */
const updating = <P,>(ctx: Ctx<P>): TemplateResult =>
  el('span', { style: ctx.part('text.faint', { marginLeft: ctx.metrics.space[2], font: 'inherit' }) }, 'Updating…');

// ── Overlay behaviour ──────────────────────────────────────────────────

/**
 * Lock the document's scroll while `open` is true, from inside a block's
 * setup. The one sanctioned imperative style write in the engine: it is on
 * `<body>`, which no block styles reactively, so nothing can shadow it. Clears
 * on close and on dispose.
 */
export function lockScroll(open: ReadonlySignal<boolean>): void {
  const stop = effect(() => { document.body.style.overflow = open.value ? 'hidden' : ''; });
  onCleanup(() => { stop(); document.body.style.overflow = ''; });
}
