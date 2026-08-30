/**
 * prove(make, { widths }) — mount a screen at each width with no browser and
 * return every claim that does not hold: a layout the engine could not
 * satisfy, a text that overflows, a control without a name, an id used twice,
 * an unlabelled field, a dialog without its ARIA, a menu holding a non-item,
 * a failed block, an unreachable control. An empty `claims` is the proof: at
 * those widths, every decision was made and every essential thing fits and
 * can be reached. No screenshot, no eyes.
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
 */
import { flushEffects, settle } from '@nisli/core';
import { remeasure } from '../engine/measure.js';
import { onReport, REPORT_ATTR, type LayoutReport } from '../engine/report.js';
import { devOverride, setDevMode } from '../engine/dev.js';
import type { Scheme } from '../skin.js';
import type { Content } from '../blocks/types.js';
import { estimator } from './estimate.js';
import { mount } from './mount.js';
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
}

export interface ProofAtWidth {
  readonly width: number;
  /** Every claim that failed at this width, fit reports included. */
  readonly claims: readonly Claim[];
  /** The layout reports still standing at this width once the screen settled. */
  readonly reports: readonly LayoutReport[];
  /** Turns it took to reach a fixed point (before and after `settle()`). */
  readonly turns: number;
}

export interface Proof {
  /** Every failed claim across all widths, each tagged with its `width`. Empty is the proof. */
  readonly claims: readonly Claim[];
  /** Every layout report still standing once the screen settled, across all widths. */
  readonly reports: readonly LayoutReport[];
  readonly byWidth: readonly ProofAtWidth[];
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
    const t = mount(make, {}, { width, viewport, scheme: options.scheme, measure });
    let claims: Claim[] = [];
    let reports: LayoutReport[] = [];
    let turns = 0;
    const unsettled: Claim[] = [];
    try {
      // Each turn is what a ResizeObserver pass is in a browser: every measured block
      // re-reads its width (a child that solved before its parent decided re-solves).
      // Turns run until one changes nothing — the tree is the same and no report was
      // filed — so a proof asserts a fixed point, not a guess at the cascade's depth.
      const cap = options.turns ?? 12;
      const turn = async (): Promise<boolean> => {
        const before = t.frame.innerHTML, filedBefore = filed;
        await Promise.resolve(); flushEffects(); remeasure(); flushEffects();
        turns++;
        return t.frame.innerHTML !== before || filed !== filedBefore;
      };
      const fixedPoint = async (phase: string) => {
        let moving = true;
        for (let i = 0; i < cap && moving; i++) moving = await turn();
        if (moving) unsettled.push({ code: 'UNSETTLED', block: t.el.tagName.toLowerCase(), severity: 'error', detail: `the screen was still changing after ${cap} turns ${phase}` });
      };
      flushEffects();
      await fixedPoint('after mount');
      await settle();
      await fixedPoint('after settle()');
      reports = [
        ...[...standing].filter(([host, r]) => host.getAttribute(REPORT_ATTR) === r.code).map(([, r]) => r),
        ...hostless,
      ];
      claims = [
        ...unsettled,
        ...reports.map(reportClaim),
        ...checkers.flatMap((c) => c.check(t.frame, measure)),
      ].map((c) => ({ ...c, width }));
    } finally {
      t.unmount();
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
