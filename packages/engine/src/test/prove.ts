/**
 * prove(make, { widths }) — mount a screen at each width with no browser and
 * return every claim that does not hold: a layout the engine could not
 * satisfy, a text that overflows, a control without a name, an id used twice,
 * an unlabelled field, a dialog without its ARIA, a menu holding a non-item,
 * a failed block, an unreachable control, a decision that moved when only the
 * data did. An empty `claims` is the proof: at those widths, every decision
 * was made and every essential thing fits and can be reached. No screenshot,
 * no eyes.
 *
 *   const proof = await prove(() => TransactionsScreen({}), { widths: [1280, 1024, 768, 480, 360], scheme: 'light' });
 *   expect(proof.claims).toEqual([]);
 *
 * The context is a proof dimension too (ADR 0046): `axes` is a list of
 * `{ density?, input? }` contexts, and the proof runs widths × axes, each
 * claim tagged with both. Under `touch` every target is checked against the
 * hit floor (`TARGET_SMALL`); and at every context the live tree is flipped
 * to another and diffed against a fresh mount there (`AXIS_STALE`), so a
 * number a block read once and froze is a failure, screen-wide.
 *
 * Built on `mount()`: the same seam every block test uses, with the estimating
 * measurer (`estimate.ts`, calibrated to Chromium) answering every element the
 * host and the document do not. After mount it flushes, then turns until
 * the tree stops changing and no report is filed — each turn ending in a
 * `remeasure()`, the ResizeObserver pass a browser would make, so a block
 * that solved before its parent decided re-solves — then `settle()`s core's
 * async work (a store booting through `query()`/`resource()`) and turns to
 * a fixed point again, so a screen that loads its data is proven with the
 * data in. A screen still moving at `turns` is claimed `UNSETTLED`.
 *
 * The tenet (ADR 0044) is checked as `DECISION_UNSTABLE`: every decided block
 * stamps its structural plan on its host (`data-nisli-plan`, decisions as
 * data), and the proof diffs those stamps between the mount of `make` and
 * data-perturbed mounts of the same screen — every table's page advanced once
 * (the perturbation the proof can make itself), plus each `variants` factory.
 * A plan that changes when only the data changed fails the claim.
 */
import { flushEffects, settle } from '@nisli/core';
import { remeasure } from '../engine/measure.js';
import { onReport, REPORT_ATTR, PLAN_ATTR, type LayoutReport } from '../engine/report.js';
import { devOverride, setDevMode } from '../engine/dev.js';
import { sizing, setDensity, setInput, type Axes, type Density, type Input } from '../engine/axes.js';
import type { Scheme } from '../skin.js';
import type { Content } from '../blocks/types.js';
import { estimator } from './estimate.js';
import { mount, type Mounted, type MountOptions } from './mount.js';
import { checkers, reportClaim, blockOf, type Claim } from './claims.js';

/** One sizing context to prove under; what is left unsaid is `'system'`. */
export type AxesContext = Readonly<Partial<Pick<Axes, 'density' | 'input'>>>;
/** The resolved sizing pair a claim was found under. */
export type SizingAxes = Readonly<Pick<Axes, 'density' | 'input'>>;

export interface ProveOptions {
  /** The frame widths to prove at. */
  widths: readonly number[];
  /**
   * The sizing contexts to prove under (ADR 0046): each a partial
   * `{ density?, input? }`, the rest `'system'`. Default `[{}]` — the default
   * context only. The proof runs every width under every context.
   */
  axes?: readonly AxesContext[];
  /** The document's width, for blocks that float; a number for all widths or a function of the frame. Default: the frame. */
  viewport?: number | ((width: number) => number);
  /** Install the default skin at this scheme so text is sized as the skin dresses it; bare when omitted. */
  scheme?: Scheme;
  /**
   * The most turns to allow the screen to reach a fixed point after mount (and again
   * after `settle()`). Turns run while the previous one changed the tree or filed a
   * report; a screen still moving at the cap is not proven (`UNSETTLED`). Default 12.
   */
  turns?: number;
  /**
   * Data-perturbed mounts of the same screen (ADR 0044): each factory must
   * present the same intent — the same blocks, columns, labels — over the
   * data reordered, re-paged or refiltered (a sorted copy of the rows, a
   * reversed series). At every width each perturbed mount must produce the
   * same structural plans as the mount of `make`; any difference is a
   * `DECISION_UNSTABLE` claim naming the block and both plans.
   */
  variants?: readonly (() => Content)[];
}

export interface ProofAtWidth {
  readonly width: number;
  /** The resolved sizing axes this pass ran under. */
  readonly axes: SizingAxes;
  /** Every claim that failed at this width, fit reports included. */
  readonly claims: readonly Claim[];
  /** The layout reports still standing at this width once the screen settled. */
  readonly reports: readonly LayoutReport[];
  /** Turns it took to reach a fixed point (before and after `settle()`), all mounts counted. */
  readonly turns: number;
}

export interface Proof {
  /** Every failed claim across all widths and contexts, each tagged with its `width` and `axes`. Empty is the proof. */
  readonly claims: readonly Claim[];
  /** Every layout report still standing once the screen settled, across all widths and contexts. */
  readonly reports: readonly LayoutReport[];
  /** One entry per width per context, widths outer, contexts inner. */
  readonly byWidth: readonly ProofAtWidth[];
}

/** A claim as one line: code, block, detail, the width and — when not the default — the axes. */
export function formatClaim(c: Claim): string {
  const where = [c.width !== undefined ? `${c.width}px` : '', c.axes && !isDefault(c.axes) ? `${c.axes.density}+${c.axes.input}` : ''].filter(Boolean).join(' ');
  return `${c.code} <${c.block}> ${c.detail}${where ? ` @ ${where}` : ''}`;
}

const DEFAULT: SizingAxes = { density: 'comfortable', input: 'pointer' };
const isDefault = (a: SizingAxes) => a.density === DEFAULT.density && a.input === DEFAULT.input;
/** The other context: compact + touch from the default, the default from anything else. */
const flipOf = (a: SizingAxes): SizingAxes => (isDefault(a) ? { density: 'compact', input: 'touch' } : DEFAULT);

// ── The fixed-point runner ─────────────────────────────────────────────

/** The fixed-point runner a proof settles every mount with; `axisStale()` takes a proof's so turns are counted and `UNSETTLED` filed. */
export interface Runner {
  /** Turns taken so far, all mounts counted. */
  turns: number;
  readonly unsettled: Claim[];
  fixedPoint(m: Mounted, phase: string): Promise<void>;
}

/**
 * Each turn is what a ResizeObserver pass is in a browser: every measured block
 * re-reads its width (a child that solved before its parent decided re-solves).
 * Turns run until one changes nothing — the tree is the same and no report was
 * filed — so a proof asserts a fixed point, not a guess at the cascade's depth.
 */
function runner(cap: number, filedCount: () => number): Runner {
  const r: Runner = {
    turns: 0,
    unsettled: [],
    fixedPoint: async (m, phase) => {
      let moving = true;
      for (let i = 0; i < cap && moving; i++) {
        const before = m.frame.innerHTML, filedBefore = filedCount();
        await Promise.resolve(); flushEffects(); remeasure(); flushEffects();
        r.turns++;
        moving = m.frame.innerHTML !== before || filedCount() !== filedBefore;
      }
      if (moving) r.unsettled.push({ code: 'UNSETTLED', block: m.el.tagName.toLowerCase(), severity: 'error', detail: `the screen was still changing after ${cap} turns ${phase}` });
    },
  };
  return r;
}

// ── AXIS_STALE ─────────────────────────────────────────────────────────

/** One element of a tree, for the axes diff: its tag, its inline style, and a selector-ish path to name it by. */
interface Styled { readonly tag: string; readonly style: string; readonly path: string; readonly block: string }

/** A selector-ish path from the nearest block host (inclusive) down to `el`, `nth-of-type` where siblings share a tag. */
const pathOf = (el: Element, root: Element): string => {
  const parts: string[] = [];
  for (let n: Element | null = el; n && n !== root; n = n.parentElement) {
    const parent = n.parentElement;
    const i = parent ? [...parent.children].filter((c) => c.tagName === n!.tagName).indexOf(n) : 0;
    parts.unshift(`${n.tagName.toLowerCase()}${i > 0 ? `:nth-of-type(${i + 1})` : ''}`);
    if (n.tagName.toLowerCase().startsWith('nisli-')) break;
  }
  return parts.join(' > ');
};

/**
 * The style to compare, with `z-index` left out: the fresh tree mounts beside
 * the live one, so its overlays stack above the live one's (`layer` + stack
 * position) — and the axes never move `layer` (ADR 0046 §3), so a z-index
 * can never be stale.
 */
const comparable = (style: string): string => style.split(';').filter((d) => !/^\s*z-index\s*:/.test(d)).join(';');

const stylesOf = (root: HTMLElement): Styled[] =>
  [...root.querySelectorAll<HTMLElement>('*')].map((el) => ({ tag: el.tagName.toLowerCase(), style: comparable(el.getAttribute('style') ?? ''), path: pathOf(el, root), block: blockOf(el) }));

/** Pairing is by document order, valid only over the same length and tag sequence; then every inline style must match byte for byte. */
function diffStyles(live: readonly Styled[], fresh: readonly Styled[], a: SizingAxes, b: SizingAxes): Claim[] {
  const how = `flipped live from ${a.density}+${a.input} to ${b.density}+${b.input}`;
  const at = live.findIndex((l, i) => l.tag !== fresh[i]?.tag);
  if (live.length !== fresh.length || at >= 0) {
    const i = at >= 0 ? at : Math.min(live.length, fresh.length);
    return [{ code: 'AXIS_STALE', block: live[i]?.block ?? fresh[i]?.block ?? 'prove', severity: 'error', detail: `${live.length} elements ${how}, ${fresh.length} mounted fresh at ${b.density}+${b.input}; the trees differ first at position ${i} (<${live[i]?.tag ?? 'nothing'}> live, <${fresh[i]?.tag ?? 'nothing'}> fresh)` }];
  }
  return live.flatMap((l, i) => (l.style === fresh[i]!.style ? [] : [{
    code: 'AXIS_STALE' as const, block: l.block, severity: 'error' as const,
    detail: `did not follow the axes: <${l.tag}> at ${l.path} has "${l.style}" ${how} and "${fresh[i]!.style}" fresh`,
  }]));
}

export interface AxisStaleOptions {
  /** How the live tree was mounted — the fresh tree at the other context is mounted the same way. */
  readonly width: number;
  readonly viewport?: number;
  readonly scheme?: Scheme;
  readonly measure?: MountOptions['measure'];
  readonly text?: MountOptions['text'];
  /** The runner to settle both trees with; a proof passes its own so turns are counted and `UNSETTLED` filed. */
  readonly run?: Runner;
  /** The context to flip to. Default: compact + touch from the default, else the default. */
  readonly to?: SizingAxes;
}

/**
 * AXIS_STALE (ADR 0046 §5): `live`, a settled mount at the current axes A, is
 * flipped live to B, settled, and every element's inline style is diffed
 * against a fresh mount of `make` at B taken through the same fixed point.
 * Any difference is a number some block read once and froze. Afterwards the
 * live axes are restored to A and the live tree settled again, so the caller
 * finds it as it left it.
 */
export async function axisStale(live: Mounted, make: () => Content, options: AxisStaleOptions): Promise<Claim[]> {
  const a: SizingAxes = sizing.value;
  const b = options.to ?? flipOf(a);
  const run = options.run ?? runner(12, () => 0);
  const mountOptions = { width: options.width, viewport: options.viewport, scheme: options.scheme, measure: options.measure, text: options.text };
  setDensity(b.density); setInput(b.input);
  flushEffects();
  await run.fixedPoint(live, `after the axes flipped to ${b.density}+${b.input}`);
  await settle();
  await run.fixedPoint(live, `after settle() with the axes flipped to ${b.density}+${b.input}`);
  const flipped = stylesOf(live.frame);
  let fresh: Styled[];
  const f = mount(make, {}, { ...mountOptions, density: b.density, input: b.input });
  try {
    flushEffects();
    await run.fixedPoint(f, `after mount at ${b.density}+${b.input}`);
    await settle();
    await run.fixedPoint(f, `after settle() at ${b.density}+${b.input}`);
    fresh = stylesOf(f.frame);
  } finally {
    f.unmount();   // resets the axes to 'system' — restored to A below
  }
  setDensity(a.density); setInput(a.input);
  flushEffects();
  await run.fixedPoint(live, `after the axes restored to ${a.density}+${a.input}`);
  return diffStyles(flipped, fresh, a, b);
}

/** A decided block's stamp: the tag and the canonical plan, in document order. */
interface StampedPlan { readonly block: string; readonly plan: string }

const plansOf = (root: HTMLElement): StampedPlan[] =>
  [...root.querySelectorAll(`[${PLAN_ATTR}]`)].map((n) => ({ block: n.tagName.toLowerCase(), plan: n.getAttribute(PLAN_ATTR)! }));

/** The tenet, diffed: same intent, same width — the structural plans must match, whatever the data. */
function diffPlans(base: readonly StampedPlan[], other: readonly StampedPlan[], how: string): Claim[] {
  if (base.length !== other.length || base.some((b, i) => b.block !== other[i]!.block)) {
    return [{ code: 'DECISION_UNSTABLE', block: 'prove', severity: 'error', detail: `${base.length} decided blocks (${base.map((b) => b.block).join(', ')}) with the data as given, ${other.length} (${other.map((o) => o.block).join(', ')}) ${how} — a variant must present the same intent` }];
  }
  return base.flatMap((b, i) => (b.plan === other[i]!.plan ? [] : [{
    code: 'DECISION_UNSTABLE' as const, block: b.block, severity: 'error' as const,
    detail: `decided "${b.plan}" with the data as given and "${other[i]!.plan}" ${how}`,
  }]));
}

export async function prove(make: () => Content, options: ProveOptions): Promise<Proof> {
  const byWidth: ProofAtWidth[] = [];
  const cap = options.turns ?? 12;
  for (const width of options.widths) for (const context of options.axes ?? [{}]) {
    const viewport = typeof options.viewport === 'function' ? options.viewport(width) : options.viewport ?? width;
    // A report stands only if the plan is still unsatisfied once everything has
    // settled: a block may solve before its parent has decided (a toolbar under
    // a shell that has not yet picked sidebar or bar) and be satisfied a turn
    // later. The block's host says which — dev mode stamps it `data-nisli-report`
    // while the plan fails and clears it when it passes — so proof reads the
    // same evidence a browser runner does. Reports from blocks that gave no host
    // are kept as filed, deduped.
    const standing = new Map<Element, LayoutReport>();
    const hostless: LayoutReport[] = [];
    const seen = new Set<string>();
    // Movement is a NEW report, not a standing one re-filed: every turn
    // `remeasure()`s, and a block whose plan cannot be satisfied files the same
    // report on every solve — that is a finding, not a screen still changing.
    const filedKeys = new Set<string>();
    const hostIds = new WeakMap<Element, number>();
    let nextHost = 1;
    const stop = onReport((r, host) => {
      const id = host ? (hostIds.get(host) ?? (hostIds.set(host, nextHost), nextHost++)) : 0;
      filedKeys.add(`${id}|${r.code}|${r.block}|${r.detail}|${Math.round(r.deficit)}`);
      if (host) { standing.set(host, r); return; }
      const key = `${r.code}|${r.block}|${r.detail}`;
      if (!seen.has(key)) { seen.add(key); hostless.push(r); }
    });
    const dev = devOverride();
    setDevMode(true);
    const measure = estimator(viewport);
    const run = runner(cap, () => filedKeys.size);
    let claims: Claim[] = [];
    let reports: LayoutReport[] = [];
    let checked: Claim[] = [];
    let resolved: SizingAxes = DEFAULT;
    const instability: Claim[] = [];
    const stale: Claim[] = [];
    const mountOptions = { width, viewport, scheme: options.scheme, density: context.density, input: context.input, measure };
    try {
      let stable: StampedPlan[] = [];
      const t = mount(make, {}, mountOptions);
      try {
        resolved = sizing.value;
        flushEffects();
        await run.fixedPoint(t, 'after mount');
        await settle();
        await run.fixedPoint(t, 'after settle()');
        reports = [
          ...[...standing].filter(([host, r]) => host.getAttribute(REPORT_ATTR) === r.code).map(([, r]) => r),
          ...hostless,
        ];
        checked = checkers.flatMap((c) => c.check(t.frame, measure));
        stable = plansOf(t.frame);
        // The axes flip, before the page advance (which changes the row count): the
        // live tree at the other context must match a fresh mount there, byte for byte.
        stale.push(...await axisStale(t, make, { ...mountOptions, run }));
        // The one data perturbation the proof can make with no knowledge of the
        // screen: advance every table's page once. The rows changed; no plan may.
        const more = [...t.frame.querySelectorAll<HTMLElement>('button')].filter((b) => /^Show \d+ more of /.test(b.textContent ?? ''));
        if (more.length > 0) {
          for (const b of more) b.click();
          await run.fixedPoint(t, 'after the page advanced');
          instability.push(...diffPlans(stable, plansOf(t.frame), 'with the page advanced'));
        }
      } finally {
        t.unmount();
      }
      for (const [i, variant] of (options.variants ?? []).entries()) {
        const v = mount(variant, {}, mountOptions);
        try {
          flushEffects();
          await run.fixedPoint(v, `after mount (variant ${i + 1})`);
          await settle();
          await run.fixedPoint(v, `after settle() (variant ${i + 1})`);
          instability.push(...diffPlans(stable, plansOf(v.frame), `with the data perturbed (variant ${i + 1})`));
        } finally {
          v.unmount();
        }
      }
      claims = [
        ...run.unsettled,
        ...reports.map(reportClaim),
        ...checked,
        ...stale,
        ...instability,
      ].map((c) => ({ ...c, width, axes: resolved }));
    } finally {
      stop();
      setDevMode(dev);
    }
    byWidth.push({ width, axes: resolved, claims, reports, turns: run.turns });
  }
  return {
    claims: byWidth.flatMap((w) => w.claims),
    reports: byWidth.flatMap((w) => w.reports),
    byWidth,
  };
}

export { estimator, textWidth, type TextStyle, type Estimator } from './estimate.js';
export { mount, textMeasurer, type MountOptions, type Mounted } from './mount.js';
export { checkers, claimsOf, accessibleName, reportClaim, type Claim, type ClaimCode, type Checker, type Severity } from './claims.js';
export type { Density, Input, Axes } from '../engine/axes.js';
export { GLYPHS, CHROMIUM, CALIBRATED, type GlyphStyle, type GlyphTable } from './glyphs.js';
export type { LayoutReport, ReportCode } from '../engine/report.js';
