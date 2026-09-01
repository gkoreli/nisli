/**
 * Period — closed date intervals over ISO strings (finance §2).
 *
 * All arithmetic is UTC over ISO strings; there is no local-time `Date`
 * constructor here, so a report near midnight cannot drift a day. Months are
 * one constructor among several: every domain function takes a `Period`, so
 * custom and rolling windows cost nothing later.
 */
import type { Transaction } from '../model.js';

/** YYYY-MM-DD, validated on entry to every constructor and day-arithmetic function. */
export type ISODate = string;
/** A closed interval: `start <= end`, both inclusive. */
export interface Period {
  readonly start: ISODate;
  readonly end: ISODate;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;
const iso = (ms: number): ISODate => new Date(ms).toISOString().slice(0, 10);

const assertISO = (d: string): void => {
  if (!ISO_RE.test(d)) throw new RangeError(`not an ISO date: ${d}`);
  const ms = Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  if (iso(ms) !== d) throw new RangeError(`not a calendar date: ${d}`);
};

const utc = (d: ISODate): number => {
  assertISO(d);
  return Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
};

/** Whole days from `a` to `b` (negative when `b` is earlier). */
export const daysBetween = (a: ISODate, b: ISODate): number => Math.round((utc(b) - utc(a)) / DAY);

export const addDays = (date: ISODate, days: number): ISODate => {
  if (!Number.isInteger(days)) throw new RangeError(`not a whole-day offset: ${days}`);
  return iso(utc(date) + days * DAY);
};

/** The calendar month of a YYYY-MM key. */
export function monthPeriod(key: string): Period {
  if (!/^\d{4}-\d{2}$/.test(key)) throw new RangeError(`not a month key: ${key}`);
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  if (m < 1 || m > 12) throw new RangeError(`not a month key: ${key}`);
  return { start: `${key}-01`, end: iso(Date.UTC(y, m, 0)) };
}

/** The window of `days` days ending `today`, inclusive. */
export function rollingDays(days: number, today: ISODate): Period {
  if (!Number.isInteger(days) || days < 1) throw new RangeError(`not a day count: ${days}`);
  return customPeriod(addDays(today, 1 - days), today);
}

export function yearToDate(today: ISODate): Period {
  assertISO(today);
  return { start: `${today.slice(0, 4)}-01-01`, end: today };
}

export function customPeriod(start: ISODate, end: ISODate): Period {
  assertISO(start);
  assertISO(end);
  if (start > end) throw new RangeError(`period start ${start} is after its end ${end}`);
  return { start, end };
}

export const contains = (p: Period, date: ISODate): boolean => p.start <= date && date <= p.end;

export const lengthInDays = (p: Period): number => daysBetween(p.start, p.end) + 1;

const isWholeMonth = (p: Period): boolean =>
  p.start.slice(8) === '01' && p.start.slice(0, 7) === p.end.slice(0, 7) && p.end === monthPeriod(p.start.slice(0, 7)).end;

/**
 * The exact previous calendar month when `p` is a whole month (Jan → Dec of
 * the previous year); otherwise the same-length window ending the day before
 * `p.start`.
 */
export function previousPeriod(p: Period): Period {
  if (isWholeMonth(p)) {
    const y = Number(p.start.slice(0, 4));
    const m = Number(p.start.slice(5, 7));
    return monthPeriod(m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`);
  }
  const end = addDays(p.start, -1);
  return { start: addDays(end, 1 - lengthInDays(p)), end };
}

/** The transactions dated inside `p`, input order kept. */
export const inPeriod = (ts: readonly Transaction[], p: Period): Transaction[] => ts.filter((t) => contains(p, t.date));
