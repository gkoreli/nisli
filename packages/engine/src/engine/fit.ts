/**
 * fit() — the pure decision: given a width and a set of items, what keeps its
 * size, what shrinks, what moves into something else, and what leaves the row.
 *
 * No DOM, no measurement, no side effects. Everything a block does with the
 * screen is derived from this plan, which is why a block can be proven at any
 * width with a unit test and no screenshot.
 *
 * The degrade vocabulary, in the order an item pays:
 *   shrink   — give up width down to `minWidth` (a title truncates)
 *   stack    — leave the row but stay visible inside `stackInto` (a column
 *              becomes a second line under the primary cell)
 *   overflow — leave the row into the trigger's menu
 * Nothing of higher priority pays before something lower has paid all it can.
 */

export interface FitItem {
  readonly id: string;
  /** Natural width, px — what the item wants. */
  readonly width: number;
  /**
   * Higher survives longer. Items with equal priority give ground from the end
   * (document order) first.
   */
  readonly priority: number;
  /** Smallest width the item can shrink to (truncation). Omitted → rigid. */
  readonly minWidth?: number;
  /**
   * When it must leave the row, this item is folded into the named item
   * instead of disappearing. Preferred over overflow when both are allowed.
   */
  readonly stackInto?: string;
  /** May be moved into overflow. Omitted → must stay (unless it can stack). */
  readonly overflowable?: boolean;
}

export interface FitInput {
  readonly available: number;
  readonly gap: number;
  readonly items: readonly FitItem[];
  /** Width of the overflow trigger, counted only once something overflows. */
  readonly triggerWidth: number;
}

export type FitAction = 'keep' | 'shrink' | 'stack' | 'overflow';

export interface FitDecision {
  readonly id: string;
  readonly action: FitAction;
  /** Width the item is given in the row; 0 when it left the row. */
  readonly width: number;
  /** Where a stacked item went. */
  readonly into?: string;
}

export interface FitPlan {
  readonly decisions: readonly FitDecision[];
  /** Ids that left the row into the menu, in document order. */
  readonly overflowed: readonly string[];
  /** Target id → ids folded into it, in document order. */
  readonly stacked: ReadonlyMap<string, readonly string[]>;
  /** Width still unused after the plan; negative means the row cannot fit. */
  readonly slack: number;
}

const sum = (n: readonly number[]) => n.reduce((a, b) => a + b, 0);

export function fit(input: FitInput): FitPlan {
  const { available, gap, items, triggerWidth } = input;
  const widths = new Map(items.map((i) => [i.id, i.width]));
  const action = new Map<string, FitAction>(items.map((i) => [i.id, 'keep']));
  const into = new Map<string, string>();
  let overflowing = false;

  const usedNow = () => {
    const visible = [...widths.values()].filter((w) => w > 0);
    const count = visible.length + (overflowing ? 1 : 0);
    return sum(visible) + (overflowing ? triggerWidth : 0) + Math.max(0, count - 1) * gap;
  };

  const order = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.priority - b.item.priority || b.index - a.index)
    .map(({ item }) => item);

  for (const item of order) {
    let deficit = usedNow() - available;
    if (deficit <= 0) break;

    if (item.minWidth !== undefined && item.minWidth < item.width) {
      const give = Math.min(deficit, item.width - item.minWidth);
      widths.set(item.id, item.width - give);
      action.set(item.id, 'shrink');
      deficit -= give;
    }
    if (deficit <= 0) continue;

    // A stack target must itself still be in the row; otherwise fall through.
    const target = item.stackInto;
    const canStack = target !== undefined && target !== item.id && widths.has(target) && (widths.get(target) ?? 0) > 0;
    if (canStack) {
      widths.set(item.id, 0);
      action.set(item.id, 'stack');
      into.set(item.id, target);
    } else if (item.overflowable) {
      widths.set(item.id, 0);
      action.set(item.id, 'overflow');
      overflowing = true;
    }
  }

  // A stack target that later left the row takes its stacked items to overflow with it.
  for (const item of items) {
    const target = into.get(item.id);
    if (target && (widths.get(target) ?? 0) === 0) {
      into.delete(item.id);
      action.set(item.id, 'overflow');
      overflowing = true;
    }
  }

  const decisions = items.map((i) => {
    const a = action.get(i.id)!;
    return a === 'stack' ? { id: i.id, action: a, width: 0, into: into.get(i.id)! } : { id: i.id, action: a, width: widths.get(i.id)! };
  });
  const overflowed = items.filter((i) => action.get(i.id) === 'overflow').map((i) => i.id);
  const stacked = new Map<string, string[]>();
  for (const i of items) {
    const t = into.get(i.id);
    if (t) stacked.set(t, [...(stacked.get(t) ?? []), i.id]);
  }
  return { decisions, overflowed, stacked, slack: available - usedNow() };
}
