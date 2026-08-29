/**
 * Ambient insights over the ledger (tenets 5, 11, 12): pure functions, no
 * clock, every number traceable and its arithmetic spelled out in words.
 */
import type { Budget, Transaction } from './model.js';
import { money } from './format.js';

export type Cadence = 'weekly' | 'monthly' | 'yearly';

export interface RecurringItem {
  /** The payee as it appears on the most recent occurrence. */
  payee: string;
  categoryId: string;
  cadence: Cadence;
  /** Median amount across occurrences, cents; negative is money out. */
  typicalAmount: number;
  /** ISO date of the most recent occurrence. */
  lastDate: string;
  /** ISO date: lastDate + the median interval. */
  nextExpected: string;
  /** Share of intervals inside the cadence band × share of amounts inside ±20%. */
  confidence: number;
  occurrences: number;
}

/** Cadence bands, in days between occurrences (median interval must fall inside). */
const BANDS: readonly { cadence: Cadence; min: number; max: number }[] = [
  { cadence: 'weekly', min: 6, max: 8 },
  { cadence: 'monthly', min: 27, max: 33 },
  { cadence: 'yearly', min: 350, max: 380 },
];
const MIN_OCCURRENCES = 3;
/** An occurrence's amount may stray this far from the group's median. */
const AMOUNT_TOLERANCE = 0.2;
/** A series whose next occurrence is more than this many intervals overdue has lapsed. */
const LAPSE_INTERVALS = 2;

const DAY = 86_400_000;
const utc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((utc(b) - utc(a)) / DAY);
export const addDays = (date: string, days: number) => iso(utc(date) + days * DAY);

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
};

/** "NETFLIX.COM 4821 *", "Netflix #2" and "netflix" are one payee. */
export const normalisePayee = (payee: string) =>
  payee
    .toLowerCase()
    .replace(/[\s#*\-_:]*[\d#*][\d#*\s\-_:]*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Finds payees that come back on a regular beat.
 *
 * Rule: group by normalised payee; keep occurrences within ±20% of the group's
 * median amount (same sign); need ≥3 of them; the median interval between them
 * decides the cadence — 6–8 days weekly, 27–33 monthly, 350–380 yearly.
 * A median outside every band is *undetected*, not forced into a neighbour:
 * a semi-monthly payroll (1st and 15th, median ≈15 days) is therefore not
 * reported at all rather than mislabelled 'weekly' or 'monthly'. A series
 * more than two intervals overdue on `today` has lapsed and is dropped.
 */
export function detectRecurring(transactions: readonly Transaction[], today: string): RecurringItem[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.categoryId === 'transfer' || t.amount === 0) continue;
    const key = normalisePayee(t.payee);
    if (!key) continue;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(t);
  }
  const out: RecurringItem[] = [];
  for (const all of groups.values()) {
    if (all.length < MIN_OCCURRENCES) continue;
    const typical = median(all.map((t) => t.amount));
    const inTolerance = (t: Transaction) => Math.sign(t.amount) === Math.sign(typical) && Math.abs(t.amount - typical) <= Math.abs(typical) * AMOUNT_TOLERANCE;
    const series = all.filter(inTolerance).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (series.length < MIN_OCCURRENCES) continue;
    const intervals = series.slice(1).map((t, i) => daysBetween(series[i]!.date, t.date));
    const gap = median(intervals);
    const band = BANDS.find((b) => gap >= b.min && gap <= b.max);
    if (!band) continue;
    const last = series[series.length - 1]!;
    const nextExpected = addDays(last.date, gap);
    if (daysBetween(nextExpected, today) > gap * LAPSE_INTERVALS) continue;
    const regular = intervals.filter((d) => d >= band.min && d <= band.max).length / intervals.length;
    const steady = series.length / all.length;
    out.push({
      payee: last.payee,
      categoryId: last.categoryId,
      cadence: band.cadence,
      typicalAmount: median(series.map((t) => t.amount)),
      lastDate: last.date,
      nextExpected,
      confidence: Math.round(regular * steady * 100) / 100,
      occurrences: series.length,
    });
  }
  return out.sort((a, b) => (a.nextExpected < b.nextExpected ? -1 : a.nextExpected > b.nextExpected ? 1 : a.payee.localeCompare(b.payee)));
}

export interface SafeToSpendInput {
  transactions: readonly Transaction[];
  budgets: readonly Budget[];
  /** Month key, YYYY-MM. */
  period: string;
  /** ISO date; bills due after it and up to the end of `period` count as committed. */
  today: string;
}

export interface SafeToSpend {
  /** balanceIn − committedBills − budgetRemaining, cents. */
  amount: number;
  parts: {
    /** Income received this period minus what has already gone out. */
    balanceIn: number;
    /** Recurring money-out items expected between today and the end of the period, unpaid. */
    committedBills: number;
    /** Room left in budgets, excluding categories a committed bill already covers. */
    budgetRemaining: number;
  };
  /** The arithmetic in words; the first line is the summary. */
  explanation: string[];
}

const lastDayOf = (period: string) => iso(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0));

/** What can go out today without touching a bill still due or a budget still open. */
export function safeToSpend({ transactions, budgets, period, today }: SafeToSpendInput): SafeToSpend {
  const flow = transactions.filter((t) => t.categoryId !== 'transfer' && t.date.slice(0, 7) === period);
  const income = flow.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const spent = flow.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  const balanceIn = income - spent;

  const end = lastDayOf(period);
  const bills = detectRecurring(transactions, today).filter((r) => r.typicalAmount < 0 && r.nextExpected > today && r.nextExpected <= end);
  const committedBills = bills.reduce((s, b) => s - b.typicalAmount, 0);
  const covered = new Set(bills.map((b) => b.categoryId));

  const rooms = budgets
    .filter((b) => !covered.has(b.categoryId))
    .map((b) => ({ categoryId: b.categoryId, limit: b.limit, spent: flow.filter((t) => t.categoryId === b.categoryId && t.amount < 0).reduce((s, t) => s - t.amount, 0) }))
    .map((r) => ({ ...r, left: Math.max(0, r.limit - r.spent) }));
  const budgetRemaining = rooms.reduce((s, r) => s + r.left, 0);

  const amount = balanceIn - committedBills - budgetRemaining;
  const explanation = [
    `${money(balanceIn)} left of this month's income − ${money(committedBills)} bills still due − ${money(budgetRemaining)} open in budgets = ${money(amount)}`,
    `Income received ${money(income)} − spent so far ${money(spent)} = ${money(balanceIn)} left`,
    bills.length
      ? `Bills due by ${end}: ${bills.map((b) => `${b.payee} ${money(-b.typicalAmount)} on ${b.nextExpected}`).join(', ')} = ${money(committedBills)}`
      : `No recurring bills due between ${today} and ${end}`,
    rooms.length
      ? `Budget room: ${rooms.map((r) => `${r.categoryId} ${money(r.limit)} − ${money(r.spent)} = ${money(r.left)}`).join(', ')} = ${money(budgetRemaining)}${covered.size ? ` (categories with a bill due are counted once, as the bill)` : ''}`
      : 'No budgets without a bill already due',
  ];
  return { amount, parts: { balanceIn, committedBills, budgetRemaining }, explanation };
}
