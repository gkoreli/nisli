/**
 * Delta (finance §6): the current period against the immediately preceding
 * same-length window, with honest truncation — a partial month compares
 * against the previous period cut to the same elapsed days, and the window
 * says so (`complete: false`) so the screen can word it ("vs Jul 1–10", not
 * "vs Jul"). The subtraction is returned as data; the screen shows it.
 */
import { addDays, lengthInDays, previousPeriod, type ISODate, type Period } from './period.js';
import type { Cents } from './money.js';

export interface ComparisonWindow {
  current: Period;
  previous: Period;
  /** True when `p` has fully elapsed and the comparison is whole-to-whole. */
  complete: boolean;
}

/** The pair of windows an honest delta compares (finance §6). */
export function comparisonWindow(p: Period, today: ISODate): ComparisonWindow {
  const prev = previousPeriod(p);
  if (today >= p.end) return { current: p, previous: prev, complete: true };
  const end = today < p.start ? p.start : today;
  const current: Period = { start: p.start, end };
  const previous: Period = { start: prev.start, end: addDays(prev.start, lengthInDays(current) - 1) };
  return { current, previous, complete: false };
}

export interface Delta {
  /** current − previous, cents. */
  diff: Cents;
  /** Whole percent vs |previous|; absent when the previous window held nothing to compare against. */
  pct?: number;
}

export function delta(current: Cents, previous: Cents): Delta {
  const diff = current - previous;
  return previous === 0 ? { diff } : { diff, pct: Math.round((diff / Math.abs(previous)) * 100) };
}
