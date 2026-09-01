import { describe, it, expect } from 'vitest';
import {
  addDays, contains, customPeriod, daysBetween, inPeriod, lengthInDays,
  monthPeriod, previousPeriod, rollingDays, yearToDate,
} from './period.js';
import type { Transaction } from '../model.js';

describe('Period (finance §2)', () => {
  it('monthPeriod covers the calendar month, leap years included', () => {
    expect(monthPeriod('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthPeriod('2024-02')).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(monthPeriod('2026-12')).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });

  it('previousPeriod of a whole month is the exact previous month, Jan → Dec handled', () => {
    expect(previousPeriod(monthPeriod('2026-03'))).toEqual(monthPeriod('2026-02'));
    expect(previousPeriod(monthPeriod('2026-01'))).toEqual(monthPeriod('2025-12'));
  });

  it('previousPeriod of a custom window is the same-length window ending the day before', () => {
    const thirty = customPeriod('2026-08-10', '2026-09-08');
    expect(lengthInDays(thirty)).toBe(30);
    expect(previousPeriod(thirty)).toEqual({ start: '2026-07-11', end: '2026-08-09' });
  });

  it('rollingDays ends today with the exact length', () => {
    const p = rollingDays(90, '2026-08-30');
    expect(p.end).toBe('2026-08-30');
    expect(lengthInDays(p)).toBe(90);
    expect(rollingDays(1, '2026-08-30')).toEqual({ start: '2026-08-30', end: '2026-08-30' });
  });

  it('yearToDate starts Jan 1', () => {
    expect(yearToDate('2026-08-30')).toEqual({ start: '2026-01-01', end: '2026-08-30' });
  });

  it('validates its inputs: reversed and malformed dates throw', () => {
    expect(() => customPeriod('2026-05-02', '2026-05-01')).toThrow(RangeError);
    expect(() => customPeriod('2026-02-30', '2026-03-01')).toThrow(RangeError);
    expect(() => monthPeriod('2026-13')).toThrow(RangeError);
    expect(() => monthPeriod('2026-08-01')).toThrow(RangeError);
    expect(() => addDays('not-a-date', 1)).toThrow(RangeError);
    expect(() => addDays('2026-08-30', 0.5)).toThrow(RangeError);
    expect(() => rollingDays(0, '2026-08-30')).toThrow(RangeError);
  });

  it('contains is inclusive at both bounds', () => {
    const p = monthPeriod('2026-08');
    expect(contains(p, '2026-08-01')).toBe(true);
    expect(contains(p, '2026-08-31')).toBe(true);
    expect(contains(p, '2026-07-31')).toBe(false);
    expect(contains(p, '2026-09-01')).toBe(false);
  });

  it('day arithmetic is UTC over ISO strings', () => {
    expect(daysBetween('2026-03-01', '2026-03-31')).toBe(30);
    expect(daysBetween('2026-03-31', '2026-03-01')).toBe(-30);
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('inPeriod filters by date and keeps input order', () => {
    const t = (id: string, date: string): Transaction =>
      ({ id, accountId: 'chk', categoryId: 'misc', date, amount: -1, payee: 'X' });
    const rows = [t('b', '2026-08-20'), t('a', '2026-08-01'), t('out', '2026-07-31')];
    expect(inPeriod(rows, monthPeriod('2026-08')).map((x) => x.id)).toEqual(['b', 'a']);
  });
});
