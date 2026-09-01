import { describe, it, expect } from 'vitest';
import {
  detectRecurringSeries, fixedCommitments, incomeSeries, nextExpectedIncome,
  normalisePayee, upcomingOccurrences,
} from './commitment.js';
import { addDays } from './period.js';
import { TRANSFER } from '../model.js';
import type { Transaction } from '../model.js';

let n = 0;
const tx = (date: string, payee: string, amount: number, categoryId = 'misc'): Transaction =>
  ({ id: `t${++n}`, accountId: 'chk', categoryId, date, amount, payee });

const netflix = ['2026-03-12', '2026-04-12', '2026-05-12', '2026-06-12', '2026-07-12', '2026-08-12']
  .map((d, i) => tx(d, `NETFLIX.COM ${4821 + i}`, -1599, 'fun'));
const payrollMonthly = ['2026-06-15', '2026-07-15', '2026-08-15'].map((d) => tx(d, 'ACME PAYROLL', 250000, 'salary'));
const payrollSemiMonthly = [
  '2026-06-01', '2026-06-15', '2026-07-01', '2026-07-15', '2026-08-01', '2026-08-15',
].map((d) => tx(d, 'SEMI CORP', 120000, 'salary'));
const gym = ['2026-08-01', '2026-08-08', '2026-08-15', '2026-08-22'].map((d) => tx(d, 'Gym #2', -1500, 'health'));
const autopay = ['2026-06-20', '2026-07-20', '2026-08-20'].map((d) => tx(d, 'CHASE CARD AUTOPAY', -20000, TRANSFER));
const rent = ['2026-06-01', '2026-07-01', '2026-08-01'].map((d) => tx(d, 'Landlord', -90000, 'rent'));
const TODAY = '2026-08-25';

describe('detectRecurringSeries (finance §4)', () => {
  const all = [...netflix, ...payrollMonthly, ...payrollSemiMonthly, ...gym, ...autopay, ...rent];
  const found = detectRecurringSeries(all, TODAY);
  const by = (key: string) => found.find((s) => s.key === key);

  it('detects outflow bills with key, cadence, interval and projection', () => {
    expect(by('netflix.com')).toMatchObject({
      flow: 'outflow', cadence: 'monthly', intervalDays: 31, typicalAmount: -1599,
      lastDate: '2026-08-12', nextExpected: '2026-09-12', occurrences: 6, categoryId: 'fun',
    });
    expect(by('gym')).toMatchObject({ flow: 'outflow', cadence: 'weekly', intervalDays: 7, nextExpected: '2026-08-29' });
    expect(by('landlord')).toMatchObject({ flow: 'outflow', cadence: 'monthly', nextExpected: '2026-09-01' });
  });

  it('detects recurring income as an inflow series — income is a series, not a commitment', () => {
    expect(by('acme payroll')).toMatchObject({ flow: 'inflow', cadence: 'monthly', typicalAmount: 250000, nextExpected: '2026-09-15' });
  });

  it('leaves a semi-monthly beat undetected rather than mislabelled', () => {
    expect(by('semi corp')).toBeUndefined();
  });

  it('never lets a transfer leg form a series — a credit-card autopay filed transfer is not a bill', () => {
    expect(by('chase card autopay')).toBeUndefined();
  });

  it('never trains a forecast with pending or future-dated observations', () => {
    const observations = [
      tx('2026-06-12', 'Cloud Service', -2000, 'services'),
      tx('2026-07-12', 'Cloud Service', -2000, 'services'),
      { ...tx('2026-08-12', 'Cloud Service', -2000, 'services'), pending: true },
      tx('2026-09-12', 'Cloud Service', -2000, 'services'),
    ];
    expect(detectRecurringSeries(observations, TODAY)).toEqual([]);
  });

  it('is deterministic under input order and totally ordered by next date then key (tenet 13)', () => {
    expect(detectRecurringSeries([...all].reverse(), TODAY)).toEqual(found);
    const order = found.map((s) => s.nextExpected);
    expect(order).toEqual([...order].sort());
  });

  it('splits into commitments and income', () => {
    expect(fixedCommitments(found).every((s) => s.flow === 'outflow')).toBe(true);
    expect(incomeSeries(found).map((s) => s.key)).toEqual(['acme payroll']);
    expect(nextExpectedIncome(found)?.nextExpected).toBe('2026-09-15');
    expect(nextExpectedIncome(fixedCommitments(found))).toBeUndefined();
  });
});

describe('upcomingOccurrences', () => {
  const commitments = fixedCommitments(detectRecurringSeries([...gym, ...rent, ...netflix], TODAY));

  it('projects every occurrence in the window — a weekly bill lands several times', () => {
    const gymDates = upcomingOccurrences(commitments, '2026-08-25', '2026-09-24')
      .filter((o) => o.seriesKey === 'gym')
      .map((o) => o.expectedOn);
    expect(gymDates).toEqual(['2026-08-29', '2026-09-05', '2026-09-12', '2026-09-19']);
  });

  it('crosses the month boundary: Sep 1 rent is committed on Aug 30', () => {
    const dates = upcomingOccurrences(commitments, '2026-08-31', '2026-09-24');
    expect(dates.find((o) => o.seriesKey === 'landlord')).toMatchObject({ expectedOn: '2026-09-01', typicalAmount: -90000 });
    expect(dates.find((o) => o.seriesKey === 'netflix.com')).toMatchObject({ expectedOn: '2026-09-12' });
  });

  it('a window opening before today surfaces the overdue occurrence', () => {
    const today = '2026-09-05';
    const series = fixedCommitments(detectRecurringSeries(gym, today));
    const dates = upcomingOccurrences(series, addDays(today, -14), '2026-10-03').map((o) => o.expectedOn);
    expect(dates[0]).toBe('2026-08-29');
    expect(dates[0]! < today).toBe(true);
    expect(dates).toEqual(['2026-08-29', '2026-09-05', '2026-09-12', '2026-09-19', '2026-09-26', '2026-10-03']);
  });

  it('skips forward when the window opens after the next expected date, and an inverted window is empty', () => {
    const series = fixedCommitments(detectRecurringSeries(gym, TODAY));
    expect(upcomingOccurrences(series, '2026-09-03', '2026-09-06').map((o) => o.expectedOn)).toEqual(['2026-09-05']);
    expect(upcomingOccurrences(series, '2026-09-06', '2026-09-03')).toEqual([]);
  });

  it('sorts by date, then payee, then key — a deterministic total order', () => {
    const occ = upcomingOccurrences(commitments, '2026-08-25', '2026-09-24');
    const keys = occ.map((o) => `${o.expectedOn}|${o.payee}|${o.seriesKey}`);
    expect(keys).toEqual([...keys].sort());
  });
});

describe('normalisePayee', () => {
  it('folds case, digit tails and #/* markers', () => {
    expect(normalisePayee('NETFLIX.COM 4821 *')).toBe('netflix.com');
    expect(normalisePayee('Gym #2')).toBe('gym');
    expect(normalisePayee('  Corner  Shop ')).toBe('corner shop');
  });
});
