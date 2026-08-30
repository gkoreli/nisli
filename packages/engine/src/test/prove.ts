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
import type { Scheme } from '../skin.js';
import type { Content } from '../blocks/types.js';
import { estimator } from './estimate.js';
import { mount, type Mounted } from './mount.js';
import { checkers, reportClaim, type Claim } from './claims.js';

export interface ProveOptions {
  /** The frame widths to prove at. */
  widths: readonly number[];
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
  /** Every claim that failed at this width, fit reports included. */
  readonly claims: readonly Claim[];
  /** The layout reports still standing at this width once the screen settled. */
  readonly reports: readonly LayoutReport[];
  /** Turns it took to reach a fixed point (before and after `settle()`), all mounts counted. */
  readonly turns: number;
}

export interface Proof {
  /** Every failed claim across all widths, each tagged with its `width`. Empty is the proof. */
  readonly claims: readonly Claim[];
  /** Every layout report still standing once the screen settled, across all widths. */
  readonly reports: readonly LayoutReport[];
  readonly byWidth: readonly ProofAtWidth[];
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
  for (const width of options.widths) {
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
    let filed = 0;
    const stop = onReport((r, host) => {
      filed++;
      if (host) { standing.set(host, r); return; }
      const key = `${r.code}|${r.block}|${r.detail}`;
      if (!seen.has(key)) { seen.add(key); hostless.push(r); }
    });
    const dev = devOverride();
    setDevMode(true);
    const measure = estimator(viewport);
    let claims: Claim[] = [];
    let reports: LayoutReport[] = [];
    let checked: Claim[] = [];
    let turns = 0;
    const unsettled: Claim[] = [];
    const instability: Claim[] = [];
    // Each turn is what a ResizeObserver pass is in a browser: every measured block
    // re-reads its width (a child that solved before its parent decided re-solves).
    // Turns run until one changes nothing — the tree is the same and no report was
    // filed — so a proof asserts a fixed point, not a guess at the cascade's depth.
    const cap = options.turns ?? 12;
    const turn = async (m: Mounted): Promise<boolean> => {
      const before = m.frame.innerHTML, filedBefore = filed;
      await Promise.resolve(); flushEffects(); remeasure(); flushEffects();
      turns++;
      return m.frame.innerHTML !== before || filed !== filedBefore;
    };
    const fixedPoint = async (m: Mounted, phase: string) => {
      let moving = true;
      for (let i = 0; i < cap && moving; i++) moving = await turn(m);
      if (moving) unsettled.push({ code: 'UNSETTLED', block: m.el.tagName.toLowerCase(), severity: 'error', detail: `the screen was still changing after ${cap} turns ${phase}` });
    };
    try {
      let stable: StampedPlan[] = [];
      const t = mount(make, {}, { width, viewport, scheme: options.scheme, measure });
      try {
        flushEffects();
        await fixedPoint(t, 'after mount');
        await settle();
        await fixedPoint(t, 'after settle()');
        reports = [
          ...[...standing].filter(([host, r]) => host.getAttribute(REPORT_ATTR) === r.code).map(([, r]) => r),
          ...hostless,
        ];
        checked = checkers.flatMap((c) => c.check(t.frame, measure));
        stable = plansOf(t.frame);
        // The one data perturbation the proof can make with no knowledge of the
        // screen: advance every table's page once. The rows changed; no plan may.
        const more = [...t.frame.querySelectorAll<HTMLElement>('button')].filter((b) => /^Show \d+ more of /.test(b.textContent ?? ''));
        if (more.length > 0) {
          for (const b of more) b.click();
          await fixedPoint(t, 'after the page advanced');
          instability.push(...diffPlans(stable, plansOf(t.frame), 'with the page advanced'));
        }
      } finally {
        t.unmount();
      }
      for (const [i, variant] of (options.variants ?? []).entries()) {
        const v = mount(variant, {}, { width, viewport, scheme: options.scheme, measure });
        try {
          flushEffects();
          await fixedPoint(v, `after mount (variant ${i + 1})`);
          await settle();
          await fixedPoint(v, `after settle() (variant ${i + 1})`);
          instability.push(...diffPlans(stable, plansOf(v.frame), `with the data perturbed (variant ${i + 1})`));
        } finally {
          v.unmount();
        }
      }
      claims = [
        ...unsettled,
        ...reports.map(reportClaim),
        ...checked,
        ...instability,
      ].map((c) => ({ ...c, width }));
    } finally {
      stop();
      setDevMode(dev);
    }
    byWidth.push({ width, claims, reports, turns });
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
export { GLYPHS, CHROMIUM, CALIBRATED, type GlyphStyle, type GlyphTable } from './glyphs.js';
export type { LayoutReport, ReportCode } from '../engine/report.js';
