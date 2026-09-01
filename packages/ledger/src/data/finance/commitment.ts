/**
 * RecurringSeries and FixedCommitments (finance §4): payees that come back on
 * a regular beat, in both directions. A recurring *outflow* series is a
 * fixed commitment (subscription, bill, loan payment); a recurring *inflow*
 * series (salary) is a `RecurringSeries` too but not a commitment. Transfer
 * legs never join a series, so a credit-card autopay filed as a transfer
 * cannot inflate the bills — nor appear as income.
 *
 * Detection rule (preserved from the original insight, tenet 5): group
 * by normalised payee; keep occurrences within ±20% of the group's median
 * amount (same sign); need ≥3 of them; the median interval decides the
 * cadence — 6–8 days weekly, 27–33 monthly, 350–380 yearly. A median outside
 * every band is *undetected*, not forced into a neighbour. A series more than
 * two intervals overdue on `today` has lapsed and is dropped.
 */
import type { Transaction } from '../model.js';
import { flowOf } from './flow.js';
import { addDays, daysBetween, type ISODate } from './period.js';
import type { Cents } from './money.js';

export type Cadence = 'weekly' | 'monthly' | 'yearly';

export interface RecurringSeries {
  /** Stable identity of the series: the normalised payee. */
  key: string;
  /** The payee as it appears on the most recent occurrence. */
  payee: string;
  categoryId: string;
  flow: 'inflow' | 'outflow';
  cadence: Cadence;
  /** Median days between occurrences. */
  intervalDays: number;
  /** Median amount across occurrences, cents; negative is money out. */
  typicalAmount: Cents;
  lastDate: ISODate;
  /** lastDate + the median interval. */
  nextExpected: ISODate;
  /** Share of intervals inside the cadence band × share of amounts inside ±20%. */
  confidence: number;
  occurrences: number;
}

const BANDS: readonly { cadence: Cadence; min: number; max: number }[] = [
  { cadence: 'weekly', min: 6, max: 8 },
  { cadence: 'monthly', min: 27, max: 33 },
  { cadence: 'yearly', min: 350, max: 380 },
];
const MIN_OCCURRENCES = 3;
const AMOUNT_TOLERANCE = 0.2;
const LAPSE_INTERVALS = 2;

/** "NETFLIX.COM 4821 *", "Netflix #2" and "netflix" are one payee. */
export const normalisePayee = (payee: string): string =>
  payee
    .toLowerCase()
    .replace(/[\s#*\-_:]*[\d#*][\d#*\s\-_:]*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
};

const byDateThenId = (a: Transaction, b: Transaction): number =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** Every payee on a steady beat, income and bills alike, sorted by next expected date then key (a deterministic total order, tenet 13). */
export function detectRecurringSeries(transactions: readonly Transaction[], today: ISODate): RecurringSeries[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const f = flowOf(t);
    if (f === 'transfer' || f === 'zero') continue;
    const key = normalisePayee(t.payee);
    if (!key) continue;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(t);
  }
  const out: RecurringSeries[] = [];
  for (const [key, all] of groups) {
    if (all.length < MIN_OCCURRENCES) continue;
    const typical = median(all.map((t) => t.amount));
    const inTolerance = (t: Transaction) =>
      Math.sign(t.amount) === Math.sign(typical) && Math.abs(t.amount - typical) <= Math.abs(typical) * AMOUNT_TOLERANCE;
    const series = all.filter(inTolerance).sort(byDateThenId);
    if (series.length < MIN_OCCURRENCES) continue;
    const intervals = series.slice(1).map((t, i) => daysBetween(series[i]!.date, t.date));
    const gap = median(intervals);
    const band = BANDS.find((b) => gap >= b.min && gap <= b.max);
    if (!band) continue;
    const last = series[series.length - 1]!;
    const nextExpected = addDays(last.date, gap);
    if (daysBetween(nextExpected, today) > gap * LAPSE_INTERVALS) continue;
    const typicalAmount = median(series.map((t) => t.amount));
    const regular = intervals.filter((d) => d >= band.min && d <= band.max).length / intervals.length;
    const steady = series.length / all.length;
    out.push({
      key,
      payee: last.payee,
      categoryId: last.categoryId,
      flow: typicalAmount > 0 ? 'inflow' : 'outflow',
      cadence: band.cadence,
      intervalDays: gap,
      typicalAmount,
      lastDate: last.date,
      nextExpected,
      confidence: Math.round(regular * steady * 100) / 100,
      occurrences: series.length,
    });
  }
  return out.sort((a, b) =>
    a.nextExpected < b.nextExpected ? -1 : a.nextExpected > b.nextExpected ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}

/** The recurring outflows — subscriptions, bills, loan payments. */
export const fixedCommitments = (series: readonly RecurringSeries[]): RecurringSeries[] =>
  series.filter((s) => s.flow === 'outflow');

/** The recurring inflows — salary and its kin. */
export const incomeSeries = (series: readonly RecurringSeries[]): RecurringSeries[] =>
  series.filter((s) => s.flow === 'inflow');

/** The inflow series expected soonest, or undefined when none recurs. */
export const nextExpectedIncome = (series: readonly RecurringSeries[]): RecurringSeries | undefined =>
  incomeSeries(series).reduce<RecurringSeries | undefined>(
    (best, s) => (!best || s.nextExpected < best.nextExpected ? s : best),
    undefined,
  );

export interface Occurrence {
  seriesKey: string;
  payee: string;
  categoryId: string;
  cadence: Cadence;
  expectedOn: ISODate;
  /** Cents, signed as the series is. */
  typicalAmount: Cents;
}

/**
 * Every expected occurrence with `from <= expectedOn <= to`, each series
 * projected forward on its median interval — a weekly bill lands several
 * times in a 30-day window, and a window opening before `today` surfaces the
 * overdue. Sorted by date, then payee, then key (deterministic total order).
 */
export function upcomingOccurrences(series: readonly RecurringSeries[], from: ISODate, to: ISODate): Occurrence[] {
  const out: Occurrence[] = [];
  for (const s of series) {
    let expectedOn = s.nextExpected;
    while (expectedOn < from) expectedOn = addDays(expectedOn, s.intervalDays);
    while (expectedOn <= to) {
      out.push({
        seriesKey: s.key,
        payee: s.payee,
        categoryId: s.categoryId,
        cadence: s.cadence,
        expectedOn,
        typicalAmount: s.typicalAmount,
      });
      expectedOn = addDays(expectedOn, s.intervalDays);
    }
  }
  return out.sort((a, b) =>
    a.expectedOn < b.expectedOn ? -1 : a.expectedOn > b.expectedOn ? 1
      : a.payee < b.payee ? -1 : a.payee > b.payee ? 1
        : a.seriesKey < b.seriesKey ? -1 : a.seriesKey > b.seriesKey ? 1 : 0);
}
