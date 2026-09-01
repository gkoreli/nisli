/**
 * Flow and Transfer (finance §3). A transaction's economic direction:
 * transfers are money moved between the owner's own accounts — neither
 * income nor spending. Transfer status is category-declared today
 * (`TRANSFER`); pairs are structurally *suggested* only, never auto-applied
 * (tenet 12). Nothing here reads a signal or the clock.
 */
import { TRANSFER, type Account, type Transaction } from '../model.js';
import { add, currencyOf, zero, type Amounts, type Cents } from './money.js';
import { daysBetween, inPeriod, type Period } from './period.js';
import type { FinanceInput } from './index.js';

export { TRANSFER };

export type Flow = 'inflow' | 'outflow' | 'transfer' | 'zero';

/** Transfer wins over sign; amount 0 → 'zero'. */
export const flowOf = (t: Transaction): Flow =>
  t.categoryId === TRANSFER ? 'transfer' : t.amount === 0 ? 'zero' : t.amount > 0 ? 'inflow' : 'outflow';

/** The period's transactions partitioned by flow, input order kept. Zero-amount rows appear in no partition. */
export function flows(ts: readonly Transaction[], p: Period): { inflows: Transaction[]; outflows: Transaction[]; transfers: Transaction[] } {
  const inflows: Transaction[] = [];
  const outflows: Transaction[] = [];
  const transfers: Transaction[] = [];
  for (const t of inPeriod(ts, p)) {
    const f = flowOf(t);
    if (f === 'inflow') inflows.push(t);
    else if (f === 'outflow') outflows.push(t);
    else if (f === 'transfer') transfers.push(t);
  }
  return { inflows, outflows, transfers };
}

const accountMap = (input: FinanceInput): ReadonlyMap<string, Account> => new Map(input.accounts.map((a) => [a.id, a]));

export interface FlowTotals {
  /** Per-currency money in, positive cents. Pending rows included. */
  inflows: Amounts;
  /** Per-currency money out, positive magnitudes. Pending rows included. */
  outflows: Amounts;
  /** The pending share of `inflows`, so a screen can name it. */
  pendingInflows: Amounts;
  /** The pending share of `outflows`. */
  pendingOutflows: Amounts;
}

/**
 * Per-currency totals of the period's flows. Pending rows are counted *and*
 * reported apart, so a stat that includes them can disclose exactly how much
 * is pending — and so a stat always equals the sum of the rollup rows behind
 * it (tenet 5).
 */
export function flowTotals(input: FinanceInput, p: Period): FlowTotals {
  const byId = accountMap(input);
  let inflows = zero;
  let outflows = zero;
  let pendingInflows = zero;
  let pendingOutflows = zero;
  for (const t of inPeriod(input.transactions, p)) {
    const f = flowOf(t);
    if (f !== 'inflow' && f !== 'outflow') continue;
    const currency = currencyOf(t, byId, input.defaultCurrency);
    const magnitude = Math.abs(t.amount);
    if (f === 'inflow') {
      inflows = add(inflows, currency, magnitude);
      if (t.pending) pendingInflows = add(pendingInflows, currency, magnitude);
    } else {
      outflows = add(outflows, currency, magnitude);
      if (t.pending) pendingOutflows = add(pendingOutflows, currency, magnitude);
    }
  }
  return { inflows, outflows, pendingInflows, pendingOutflows };
}

export interface TransferBalance {
  /** Signed sum of all transfer legs in the period, per currency. */
  byCurrency: Amounts;
  /** Every currency nets to 0. */
  balanced: boolean;
  legs: number;
}

/** The ambient tripwire for one-sided transfers: does the period's transfer activity net to zero? */
export function transferBalance(input: FinanceInput, p: Period): TransferBalance {
  const byId = accountMap(input);
  let byCurrency = zero;
  let legs = 0;
  for (const t of flows(input.transactions, p).transfers) {
    legs++;
    byCurrency = add(byCurrency, currencyOf(t, byId, input.defaultCurrency), t.amount);
  }
  return { byCurrency, balanced: Object.values(byCurrency).every((cents) => cents === 0), legs };
}

export interface TransferPair {
  outId: string;
  inId: string;
  /** The moved amount, positive. */
  cents: Cents;
  currency: string;
}

/** Legs this far apart in days may still be one transfer (settlement lag). */
export const PAIR_WINDOW_DAYS = 3;

const byDateThenId = (a: Transaction, b: Transaction): number =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * Structurally matched transfer legs: equal magnitude, opposite sign, one
 * currency, different accounts, within `PAIR_WINDOW_DAYS`. Deterministic —
 * legs are taken in date-then-id order, each out-leg greedily paired with the
 * earliest unmatched in-leg. A *suggestion* only: nothing here writes the
 * ledger, and an unmatched leg is reported by `transferBalance`, never
 * guessed away.
 */
export function transferPairs(input: FinanceInput, p: Period): TransferPair[] {
  const byId = accountMap(input);
  const legs = flows(input.transactions, p).transfers.slice().sort(byDateThenId);
  const used = new Set<string>();
  const pairs: TransferPair[] = [];
  for (const out of legs) {
    if (out.amount >= 0 || used.has(out.id)) continue;
    const currency = currencyOf(out, byId, input.defaultCurrency);
    const match = legs.find((candidate) =>
      !used.has(candidate.id)
      && candidate.amount === -out.amount
      && candidate.accountId !== out.accountId
      && currencyOf(candidate, byId, input.defaultCurrency) === currency
      && Math.abs(daysBetween(out.date, candidate.date)) <= PAIR_WINDOW_DAYS);
    if (!match) continue;
    used.add(out.id);
    used.add(match.id);
    pairs.push({ outId: out.id, inId: match.id, cents: -out.amount, currency });
  }
  return pairs;
}
