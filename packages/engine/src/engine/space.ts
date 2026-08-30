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
import type { FitPlan } from './fit.js';

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
 * natural width, and `slot` is what each position is given. `longest` is a
 * *budget* (the axis label budget, `axisChars × charWidth`), never the
 * measured longest string: which labels show may depend on the count of
 * labels (one label is one slot — chart structure) but not on their text.
 */
export function labelEvery(slot: number, longest: number): number {
  return Math.max(1, Math.ceil(longest / Math.max(1, slot)));
}

// ── Table column budgets (ADR 0044) ────────────────────────────────────

/** What a column *is* — the intent `columnBudgets` decides from. A `Column<T>` satisfies it; the cells never reach here. */
export interface ColumnIntent {
  readonly id: string;
  readonly label: string;
  readonly kind?: 'text' | 'number' | 'money' | 'date';
  readonly priority?: 'primary' | 'secondary' | 'tertiary';
  readonly sortable?: boolean;
}

/** A column's decided natural: a budget from kind, label and share — never from data. */
export interface ColumnBudget {
  readonly id: string;
  readonly width: number;
  /** Text columns may truncate down to this; figures and dates are rigid. */
  readonly minWidth?: number;
}

/** The sort mark's budget (" ↑" / " ↓"), reserved on every sortable column whether or not it is the sorted one — so the sorted column's width never depends on the sort state. */
export const SORT_MARK_CHARS = 2;

const isFigureKind = (c: ColumnIntent) => c.kind === 'number' || c.kind === 'money';
const isTextKind = (c: ColumnIntent) => !isFigureKind(c) && c.kind !== 'date';
/** A primary text column takes a double share of the remainder. */
const weightOf = (c: ColumnIntent) => (c.priority === 'primary' ? 2 : 1);

/**
 * The tenet made arithmetic: each column's natural width as a pure function of
 * `(available, columns, layout)` — never of the rows. Dates and figures get a
 * character budget; every column is floored by its own header label (a label
 * is intent) plus the sort mark when sortable; text columns share what
 * remains by priority weight, floored at `minTextColumn` and capped at
 * `textColumnCap`, with `minWidth = minTextColumn` so the floor cannot move
 * either. `available` 0 (unmeasured) is roomy: every text column at its cap.
 */
export function columnBudgets(
  columns: readonly ColumnIntent[],
  available: number,
  layout: Layout = metrics.layout,
  charWidth: number = metrics.charWidth,
  padding: number = 2 * metrics.space[3],
): ColumnBudget[] {
  const floor = (c: ColumnIntent) => labelWidth(c.label, padding, charWidth) + (c.sortable ? SORT_MARK_CHARS * charWidth : 0);
  const rigid = (c: ColumnIntent) => Math.max((c.kind === 'date' ? layout.dateChars : layout.figureChars) * charWidth + padding, floor(c));
  const totalWeight = columns.filter(isTextKind).reduce((s, c) => s + weightOf(c), 0);
  const remainder = available - columns.filter((c) => !isTextKind(c)).reduce((s, c) => s + rigid(c), 0);
  return columns.map((c) => {
    if (!isTextKind(c)) return { id: c.id, width: rigid(c) };
    const share = available === 0
      ? layout.textColumnCap
      : Math.min(Math.max((remainder * weightOf(c)) / totalWeight, layout.minTextColumn), layout.textColumnCap);
    const width = Math.max(share, floor(c));
    return { id: c.id, width, minWidth: Math.min(width, layout.minTextColumn) };
  });
}

/** The share weights of the text columns, by id — the weights `columnBudgets` used, handed to `spreadSlack`. */
export function textWeights(columns: readonly ColumnIntent[]): Map<string, number> {
  return new Map(columns.filter(isTextKind).map((c) => [c.id, weightOf(c)]));
}

/**
 * After the fold, the leftover width goes to the surviving weighted columns
 * (a table's text columns) by the same weights the share used — one more pure
 * pass, so the decided widths sum to `available` and the browser's
 * `table-layout: fixed` has nothing left to distribute. Items without a
 * weight, and plans without positive slack, keep their decided widths.
 */
export function spreadSlack(plan: FitPlan, weights: ReadonlyMap<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of plan.decisions) if (d.width > 0) out.set(d.id, d.width);
  if (!(plan.slack > 0) || !Number.isFinite(plan.slack)) return out;
  let total = 0;
  for (const [id, w] of weights) if (out.has(id)) total += w;
  if (total === 0) return out;
  for (const [id, w] of weights) if (out.has(id)) out.set(id, out.get(id)! + (plan.slack * w) / total);
  return out;
}
