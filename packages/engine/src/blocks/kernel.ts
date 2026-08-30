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
 * hierarchy and no base block. The two things blocks genuinely share are
 * behaviours too: row-fitting (Toolbar, Table) is `ctx.fitRow()`, and floating
 * (Dialog, a menu) is `ctx.overlay()`.
 *
 * Overlay: `ctx.overlay({ kind, open, onDismiss, within?, anchor?, initialFocus? })`
 * registers a layer in ONE document-level manager while `open` is true. The
 * manager owns the only document `keydown`, `pointerdown` and `scroll`
 * listeners in the engine (installed when the first layer opens, removed when
 * the last closes) and routes Escape and an outside pointer to the topmost
 * non-passive layer only — one Escape closes one thing, and a notice is never
 * in the way — as the pure `engine/overlay.ts` stack decides. A modal layer
 * traps focus (every subtree beside the topmost modal's ancestor chain is
 * `inert`, recomputed as modals open and close so a sibling modal above
 * another is never inert itself; a Tab guard wraps inside its surface over
 * the visible controls), locks scroll while any modal is open (through the
 * one ref-counted body write `lockScroll` shares), and every layer restores
 * focus on close — a popover to its anchor. A passive layer (a notice) never
 * takes focus and is never made inert. The block renders what comes back:
 * `z` (base from `ctx.metrics.layer` plus stack position) and, for an
 * anchored layer, `placement` from `placeMenu`, re-measured on resize and on
 * any scroll.
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
import { component, el, computed, effect, signal, untrack, onCleanup, type ReadonlySignal, type ReactiveProps, type ComponentFactory, type TemplateResult } from '@nisli/core';
import { metrics, type Metrics } from '../metrics.js';
import { css, apply, buttonBox, type StyleRecord } from '../style.js';
import { look, type Part } from '../skin.js';
import { useWidth, useViewportWidth } from '../engine/measure.js';
import { useFit, type Fit, type FitSpec } from '../engine/use-fit.js';
import { reportIf, stampPlan, type ReportCode } from '../engine/report.js';
import type { FitPlan } from '../engine/fit.js';
import { layer as makeLayer, push, pop, reach, locks, escapeTarget, pointerTarget, zIndexOf, placeMenu, EMPTY_STACK, type Layer, type LayerKind, type LayerStack, type Placement, type Size } from '../engine/overlay.js';
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
  /** Floating behaviour: a layer in the document's overlay stack while `spec.open`; see `useOverlay`. */
  overlay(spec: OverlaySpec): Overlay;
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
      overlay: (overlaySpec) => useOverlay(host, overlaySpec),
      fitRow: ({ report, onPlan, ...fitSpec }) =>
        useFit(host, {
          ...fitSpec,
          onPlan: (plan, available) => {
            reportIf(plan, { code: report.code, block: tag, width: available, detail: report.detail(plan) }, host);
            // Decisions as data (dev): the plan, canonical, for DECISION_UNSTABLE to diff.
            stampPlan(host, plan.decisions.map((d) => `${d.id}:${d.action}${d.width > 0 ? `:${Math.round(d.width)}` : ''}${d.into ? `>${d.into}` : ''}`).join(' '));
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
 * The one writer of `body.style.overflow`, ref-counted: the lock holds while
 * any holder holds it, so a block releasing its hold never drops a modal's.
 */
let held = 0;
const hold = (on: boolean): void => {
  held = Math.max(0, held + (on ? 1 : -1));
  document.body.style.overflow = held > 0 ? 'hidden' : '';
};
/** A holder: follows `want` and releases on cleanup, counting itself once. */
function holder(want: ReadonlySignal<boolean>): void {
  let holding = false;
  const set = (on: boolean) => { if (on !== holding) { holding = on; hold(on); } };
  const stop = effect(() => set(want.value));
  onCleanup(() => { stop(); set(false); });
}

/**
 * Lock the document's scroll while `open` is true, from inside a block's
 * setup. The one sanctioned imperative style write in the engine: it is on
 * `<body>`, which no block styles reactively, so nothing can shadow it. Every
 * caller is one hold on a shared count; the overlay manager (a modal layer)
 * is its production caller. Releases on close and on dispose.
 */
export function lockScroll(open: ReadonlySignal<boolean>): void {
  holder(open);
}

export interface OverlaySpec {
  kind: LayerKind;
  /** The layer is on the stack while this is true. */
  open: ReadonlySignal<boolean>;
  /** The engine decided this layer should close (Escape, outside pointer). The block flips `open`. */
  onDismiss(): void;
  /**
   * The layer's surface: what counts as inside for a pointer, what focus is
   * trapped in, what is placed against `anchor`. Read when needed, so it may
   * be a ref that is filled after setup. Default: the host.
   */
  within?: () => HTMLElement | null;
  /** For a popover: the element it is placed against and returns focus to. */
  anchor?: () => HTMLElement | null;
  /** For an anchored layer: which of the anchor's edges to align to first (`placeMenu`). Default leading. */
  align?: 'leading' | 'trailing';
  /** For an anchored layer: the surface's size to place with before it has been laid out (its rect reads 0). */
  size?: () => Size;
  /** Where focus goes on open. Default: a modal focuses its first visible control, else its surface; other kinds move no focus. */
  initialFocus?: () => HTMLElement | null;
  /** Whether this close restores focus (read at close). Default true for kinds that restore; a menu left by Tab says false. */
  restoreFocus?: () => boolean;
}

export interface Overlay {
  /** The z-index to render at: the kind's base from metrics plus the stack position. */
  readonly z: ReadonlySignal<number>;
  /** For an anchored layer: where its surface goes, in viewport coordinates; null while closed. */
  readonly placement: ReadonlySignal<Placement | null>;
}

interface Entry {
  readonly layer: Layer;
  readonly host: HTMLElement;
  readonly spec: OverlaySpec;
  previous: HTMLElement | null;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const surfaceOf = (e: Entry): HTMLElement => e.spec.within?.() ?? e.host;
/** Hidden by structure: an inline display/visibility (the engine's only styling) or `hidden` on it or an ancestor, or no box at all. */
const hidden = (el: HTMLElement): boolean => {
  if (el !== document.activeElement && el.getClientRects().length === 0) return true;
  for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
    if (n.style.display === 'none' || n.style.visibility === 'hidden' || n.hasAttribute('hidden')) return true;
  }
  return false;
};
/** The controls a keyboard can reach inside `root`, in document order: enabled, visible, not inert. */
export const focusables = (root: HTMLElement): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest('[inert]') && !hidden(el));

/** The one document-level manager: the stack as a signal, the listeners, the inert set and the scroll lock. */
const stack = signal<LayerStack>(EMPTY_STACK);
const entries = new Map<number, Entry>();
let nextLayerId = 1;
let installed = false;
let stopLock: (() => void) | null = null;
let inerted: Element[] = [];

const entryOf = (l: Layer | null): Entry | undefined => (l ? entries.get(l.id) : undefined);
const trapEntry = (): Entry | undefined => { const s = stack.peek(); for (let i = s.length - 1; i >= 0; i--) if (s[i]!.trap) return entries.get(s[i]!.id); return undefined; };

function onKeydown(e: KeyboardEvent): void {
  if (e.defaultPrevented) return;
  if (e.key === 'Escape') {
    const target = entryOf(escapeTarget(stack.value));
    if (!target) return;
    e.preventDefault();
    target.spec.onDismiss();
    return;
  }
  if (e.key === 'Tab') {
    // The trap: focus cycles over the visible controls inside the topmost
    // modal's surface. Native `inert` keeps the rest of the page out; this
    // keeps the browser chrome out too, and stands in where `inert` is not honoured.
    const entry = trapEntry();
    if (!entry) return;
    const items = focusables(surfaceOf(entry));
    if (!items.length) return;
    const active = document.activeElement as HTMLElement | null;
    const i = active ? items.indexOf(active) : -1;
    const first = items[0]!, last = items[items.length - 1]!;
    if (i < 0 || (!e.shiftKey && active === last)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
  }
}

function onPointerdown(e: Event): void {
  const s = stack.value;
  const target = reach(s);
  const entry = entryOf(target);
  if (!target || !entry) return;
  // Inside the target or any layer above it (a menu over a dialog, a notice over anything) is inside —
  // and so is a layer's anchor: a tap on the trigger that opened a menu is the trigger's own toggle
  // (pointerdown, then click), never an outside pointer that dismisses first and lets the click reopen.
  const node = e.target as Node;
  const inside = s.slice(s.indexOf(target)).some((l) => {
    const x = entries.get(l.id);
    return !!x && (surfaceOf(x).contains(node) || !!x.spec.anchor?.()?.contains(node));
  });
  if (pointerTarget(s, inside)) entry.spec.onDismiss();
}

function install(): void {
  if (installed) return;
  installed = true;
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('pointerdown', onPointerdown);
  // Created from inside a layer's own effect: untracked, so that effect never depends on the stack it writes.
  let holding = false;
  const stop = untrack(() => effect(() => { const on = locks(stack.value); if (on !== holding) { holding = on; hold(on); } }));
  stopLock = () => { stop(); if (holding) { holding = false; hold(false); } };
}

function uninstall(): void {
  if (!installed || stack.peek().length) return;
  installed = false;
  document.removeEventListener('keydown', onKeydown);
  document.removeEventListener('pointerdown', onPointerdown);
  stopLock?.(); stopLock = null;
}

/**
 * The inert set, recomputed from the stack: every subtree beside the topmost
 * trap layer's ancestor chain, except a subtree holding a passive layer (a
 * notice stays clickable). Nothing is inert while no trap layer is open, and a
 * modal opened beside an open modal is never inert itself.
 */
function applyInert(): void {
  for (const el of inerted) el.removeAttribute('inert');
  inerted = [];
  const entry = trapEntry();
  if (!entry) return;
  const keep = [...entries.values()].filter((e) => e.layer.kind === 'passive').map((e) => e.host);
  for (let node: Element = entry.host; node !== document.body && node.parentElement; node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || sibling.hasAttribute('inert') || sibling.tagName === 'SCRIPT' || sibling.tagName === 'STYLE') continue;
      if (keep.some((h) => sibling.contains(h))) continue;
      sibling.setAttribute('inert', '');
      inerted.push(sibling);
    }
  }
}

function open(entry: Entry): void {
  install();
  entry.previous = document.activeElement as HTMLElement | null;
  stack.value = push(stack.peek(), entry.layer);
  applyInert();
  queueMicrotask(() => {
    if (!entries.has(entry.layer.id)) return;
    const wanted = entry.spec.initialFocus?.() ?? (entry.layer.trap ? focusables(surfaceOf(entry))[0] ?? surfaceOf(entry) : null);
    wanted?.focus?.();
  });
}

/** Where focus goes back to: the anchor or the opener; when that is gone, the nearest main landmark, so a reader is not sent to the top of the document. */
function restoreTarget(entry: Entry): HTMLElement | null {
  const back = entry.spec.anchor?.() ?? entry.previous;
  if (back?.isConnected) return back;
  const main = entry.host.closest<HTMLElement>('main, [role=main]');
  if (main && !main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
  return main;
}

function close(entry: Entry): void {
  if (!entries.has(entry.layer.id)) return;
  entries.delete(entry.layer.id);
  stack.value = pop(stack.peek(), entry.layer.id);
  applyInert();
  if (entry.layer.restoreFocus && (entry.spec.restoreFocus?.() ?? true)) restoreTarget(entry)?.focus?.();
  entry.previous = null;
  uninstall();
}

/**
 * A layer in the document's overlay stack while `spec.open` is true. Must be
 * called during a block's setup (it registers cleanup). The block renders
 * `z` and `placement`; the manager does the rest — see the header.
 */
export function useOverlay(host: HTMLElement, spec: OverlaySpec): Overlay {
  const id = nextLayerId++;
  const l = makeLayer(id, spec.kind);
  let entry: Entry | null = null;
  const measured = signal(0);
  const remeasure = () => { measured.value = measured.peek() + 1; };
  const listen = (on: boolean) => {
    if (!spec.anchor) return;
    if (on) { window.addEventListener('resize', remeasure); document.addEventListener('scroll', remeasure, true); }
    else { window.removeEventListener('resize', remeasure); document.removeEventListener('scroll', remeasure, true); }
  };

  const stop = effect(() => {
    if (spec.open.value) {
      if (entry) return;
      entry = { layer: l, host, spec, previous: null };
      entries.set(id, entry);
      open(entry);
      // Placed at once from the fallback size (never at 0,0), then measured once laid out, then on resize and scroll.
      remeasure();
      queueMicrotask(remeasure);
      listen(true);
    } else if (entry) {
      close(entry);
      entry = null;
      listen(false);
    }
  });
  onCleanup(() => {
    stop();
    if (entry) { close(entry); entry = null; }
    listen(false);
  });

  const isOpen = computed(() => stack.value.some((x) => x.id === id));
  return {
    z: computed(() => zIndexOf(stack.value, id, spec.kind, metrics.layer)),
    placement: computed(() => {
      if (!isOpen.value || !spec.anchor) return null;
      measured.value;
      const a = spec.anchor();
      const s = entry ? surfaceOf(entry) : null;
      if (!a || !s) return null;
      const r = a.getBoundingClientRect();
      const m = s.getBoundingClientRect();
      const fallback = spec.size?.() ?? { width: 0, height: 0 };
      return placeMenu(
        { top: r.top, left: r.left, width: r.width, height: r.height },
        { width: m.width || fallback.width, height: m.height || fallback.height },
        { width: window.innerWidth, height: window.innerHeight },
        { gap: metrics.space[1], align: spec.align, dir: getComputedStyle(a).direction === 'rtl' ? 'rtl' : 'ltr' },
      );
    }),
  };
}

/** Test seam: the open layers, bottom to top. */
export const __layers: ReadonlySignal<LayerStack> = stack;
