/**
 * allocate — the engine decides one row.
 *
 * Pure. No DOM, no browser, no re-measurement. It takes what every item WANTS
 * (measured once by the adapter), what each item DECLARED (priority, how it
 * may give way, whether it takes slack), and what the row HAS (available
 * inline size, the gap between items, the width of a menu trigger should one
 * be needed) — and returns a plan: an exact inline size and an action for
 * every item, and whether the row is satisfiable at all.
 *
 * This replaces the trial-and-error loop of `fit/solver.ts`, which applied a
 * strategy, asked the browser to lay out, checked, and repeated. Here the
 * browser is asked once for intrinsic sizes and the decision is made in
 * TypeScript, sibling-aware and deterministic: the same inputs always produce
 * the same plan, and the plan IS the explanation.
 *
 * It is not a constraint solver. There are no equations and no iteration to a
 * fixed point: candidates are spent in declared order until the deficit is
 * gone or the candidates are, which bounds the work by the number of items.
 * That is the AppKit-toolbar / Figma-auto-layout shape, not the Cassowary one.
 */

import type { Priority, Strategy } from '../contracts.js';

export interface RowItem {
  readonly id: string;
  /** 1 survives longest, 5 gives way first. */
  readonly priority: Priority;
  /** How the item may give way. Absent: it is rigid and always present. */
  readonly strategy?: Strategy;
  /**
   * Flexible: takes a share of the slack when the row has room, and REFLOWS
   * down to `min` when it does not — after every declared degradation has
   * been spent. This is the paragraph in the toolbar, the title in the card:
   * prose that may wrap onto more lines rather than overflow.
   */
  readonly grow: boolean;
  /** Inline size the content wants at full fidelity (max-content). */
  readonly max: number;
  /**
   * The narrowest the item may be made. For `truncate`, the width at which an
   * ellipsised remainder is still worth reading; for a flexible item, its
   * min-content (the longest word). Equal to `max` for a rigid item.
   */
  readonly min: number;
}

export interface RowInput {
  /** Inline size the row's content box actually has. */
  readonly available: number;
  /** Gap between adjacent present items. */
  readonly gap: number;
  /** Inline size a revealed menu trigger occupies. Charged once, on first `menu`. */
  readonly trigger: number;
  /** Document order. Ties in priority are broken by position: later gives way first. */
  readonly items: readonly RowItem[];
}

export type RowAction = 'keep' | 'grow' | 'reflow' | 'truncate' | 'hide' | 'menu';

export interface RowDecision {
  readonly id: string;
  readonly action: RowAction;
  /** Inline size to give the item. Zero when it is removed from the flow. */
  readonly size: number;
}

export interface RowPlan {
  readonly state: 'settled' | 'unsatisfiable';
  readonly decisions: readonly RowDecision[];
  /** Whether a menu trigger must be revealed. */
  readonly menu: boolean;
  /** Inline size left over after every present item got what the plan gives it. Negative when unsatisfiable. */
  readonly slack: number;
}

interface Working {
  readonly item: RowItem;
  readonly index: number;
  size: number;
  action: RowAction;
}

function demand(items: readonly Working[], gap: number, menu: boolean, trigger: number): number {
  const present = items.filter((w) => w.action !== 'hide' && w.action !== 'menu');
  const count = present.length + (menu ? 1 : 0);
  const gaps = count > 1 ? (count - 1) * gap : 0;
  const sizes = present.reduce((total, w) => total + w.size, 0);
  return sizes + gaps + (menu ? trigger : 0);
}

/** Sub-pixel layout: a deficit below this is a rounding artefact, not a defect. */
const TOLERANCE = 1;

export function allocate(input: RowInput): RowPlan {
  const working: Working[] = input.items.map((item, index) => ({ item, index, size: item.max, action: 'keep' }));
  let menu = false;

  // Candidates give way in declared order: highest priority number first, and
  // among equals the later one in the document first — the same order the
  // eye reads importance in a row, left to right.
  const candidates = working
    .filter((w) => w.item.strategy !== undefined)
    .sort((a, b) => b.item.priority - a.item.priority || b.index - a.index);

  let deficit = demand(working, input.gap, menu, input.trigger) - input.available;

  for (const w of candidates) {
    if (deficit <= TOLERANCE) break;
    switch (w.item.strategy) {
      case 'truncate': {
        const floor = Math.min(w.item.min, w.item.max);
        const reducible = w.size - floor;
        if (reducible <= 0) continue;
        const take = Math.min(reducible, deficit);
        w.size -= take;
        w.action = 'truncate';
        break;
      }
      case 'hide':
        w.action = 'hide';
        w.size = 0;
        break;
      case 'menu':
        w.action = 'menu';
        w.size = 0;
        menu = true;
        break;
    }
    deficit = demand(working, input.gap, menu, input.trigger) - input.available;
  }

  // Declared degradations spent and still short: flexible items reflow. They
  // shed inline space down to their floor, largest deficit-absorber first so
  // one paragraph wraps before three labels do.
  if (deficit > TOLERANCE) {
    const flexible = working
      .filter((w) => w.item.grow && (w.action === 'keep' || w.action === 'grow') && w.size > w.item.min)
      .sort((a, b) => (b.size - b.item.min) - (a.size - a.item.min));
    for (const w of flexible) {
      if (deficit <= TOLERANCE) break;
      const take = Math.min(w.size - w.item.min, deficit);
      w.size -= take;
      w.action = 'reflow';
      deficit = demand(working, input.gap, menu, input.trigger) - input.available;
    }
  }

  // Whatever is left over goes to the items that asked for it, in equal
  // shares. Nothing else grows: a rigid item's size is its content's.
  const slack = -deficit;
  if (slack > 0) {
    const growers = working.filter((w) => w.item.grow && (w.action === 'keep' || w.action === 'truncate'));
    if (growers.length > 0) {
      const share = slack / growers.length;
      for (const g of growers) {
        g.size += share;
        if (g.action === 'keep') g.action = 'grow';
      }
    }
  }

  return {
    state: deficit > TOLERANCE ? 'unsatisfiable' : 'settled',
    decisions: working.map((w) => ({ id: w.item.id, action: w.action, size: w.size })),
    menu,
    slack,
  };
}
