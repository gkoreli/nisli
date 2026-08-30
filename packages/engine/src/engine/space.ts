/**
 * Space — the decisions the engine makes from a width. Every function here is
 * pure: numbers in, data out, no DOM, no signals. A block feeds it a measured
 * width (through the `setMeasurer` seam in tests) and renders the answer; that
 * is what makes each decision provable at any width without a browser.
 *
 * Every decision takes its thresholds as a trailing `layout` parameter that
 * defaults to `metrics.layout`, so a block reads them through `ctx.metrics`
 * (the reactive door for the density axis) and a test can pass its own.
 *
 * Vocabulary shared by every decision:
 *   width     — the block's own inline size, px; 0 means "not yet measured"
 *               and every decision then takes its roomiest form
 *   viewport  — the document's inline size, for blocks that float above the page
 *   longest   — the natural width of the longest label, px (see `labelWidth`)
 *   slot      — the width one item of an evenly divided axis gets, px
 */
import { metrics, type Metrics } from '../metrics.js';

export { fit, type FitInput, type FitItem, type FitPlan, type FitDecision, type FitAction } from './fit.js';
export { columnsFor } from './columns.js';
export { pageSize } from './paging.js';

/** The layout thresholds, widened from the literal metrics so a test or an axis can pass its own numbers. */
export type Layout = { readonly [K in keyof Metrics['layout']]: number };

/**
 * The natural width of a run of text, estimated: characters × glyph width,
 * plus `padding` (a breath of space by default; a control's horizontal
 * padding when measuring a button). The one formula every estimate uses.
 */
export function labelWidth(text: string, padding: number = metrics.space[2], charWidth: number = metrics.charWidth): number {
  return text.length * charWidth + padding;
}

/**
 * The shell's shape: a sidebar iff a useful content column fits beside it
 * (`sidebarWidth + contentMin`), else a top bar with a menu sheet. Unmeasured
 * (0) reads as roomy.
 */
export function shellMode(width: number, layout: Layout = metrics.layout): 'sidebar' | 'bar' {
  return width === 0 || width >= layout.sidebarWidth + layout.contentMin ? 'sidebar' : 'bar';
}

/**
 * A dialog's shape: a centred card of `dialogWidth`, or a full-height sheet
 * when the viewport is narrower than `dialogMin`. Unmeasured (0) is a card.
 */
export function dialogMode(viewport: number, layout: Layout = metrics.layout): 'card' | 'sheet' {
  return viewport > 0 && viewport < layout.dialogMin ? 'sheet' : 'card';
}

/**
 * Bars: the label column takes what it wants up to a third of the block, and
 * never less than a readable minimum. Unmeasured (0) gives the labels their
 * natural width.
 */
export function labelColumn(width: number, longest: number, layout: Layout = metrics.layout): number {
  return width === 0 ? longest : Math.min(longest, Math.max(layout.minLabel, width / 3));
}

/**
 * Columns: show every nth axis label so none overlap — a label needs its own
 * natural width, and `slot` is what each position is given.
 */
export function labelEvery(slot: number, longest: number): number {
  return Math.max(1, Math.ceil(longest / Math.max(1, slot)));
}
