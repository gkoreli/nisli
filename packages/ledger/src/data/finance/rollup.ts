/**
 * CategoryRollup (finance §5): the period's money totalled per category,
 * split by flow. Income categories finally have a chart-of-account presence
 * — the split is by each transaction's *flow*, never by the category's
 * `income` flag, so a refund (a positive amount in a spending category)
 * appears under Money in for that category rather than shrinking spending.
 * Pending rows are included, so a stat built from `flowTotals` equals the
 * visible sum of its rollup rows (tenet 5). Every currency is kept apart.
 */
import { add, currencyOf, only, zero, type Amounts } from './money.js';
import { inPeriod, type Period } from './period.js';
import { flowOf } from './flow.js';
import type { FinanceInput } from './index.js';

export interface RollupRow {
  categoryId: string;
  /** Positive magnitudes, per currency. */
  amounts: Amounts;
}

export interface CategoryRollup {
  inflows: RollupRow[];
  outflows: RollupRow[];
}

/** Rows sorted by default-currency amount descending, tie by categoryId — a deterministic total order (tenet 13). All rows kept: no materiality floor. */
export function categoryRollup(input: FinanceInput, p: Period): CategoryRollup {
  const byId = new Map(input.accounts.map((a) => [a.id, a] as const));
  const sums: Record<'inflow' | 'outflow', Map<string, Amounts>> = { inflow: new Map(), outflow: new Map() };
  for (const t of inPeriod(input.transactions, p)) {
    const f = flowOf(t);
    if (f !== 'inflow' && f !== 'outflow') continue;
    const map = sums[f];
    map.set(t.categoryId, add(map.get(t.categoryId) ?? zero, currencyOf(t, byId, input.defaultCurrency), Math.abs(t.amount)));
  }
  const rows = (map: Map<string, Amounts>): RollupRow[] =>
    [...map.entries()]
      .map(([categoryId, amounts]) => ({ categoryId, amounts }))
      .sort((a, b) =>
        only(b.amounts, input.defaultCurrency) - only(a.amounts, input.defaultCurrency)
        || (a.categoryId < b.categoryId ? -1 : a.categoryId > b.categoryId ? 1 : 0));
  return { inflows: rows(sums.inflow), outflows: rows(sums.outflow) };
}
