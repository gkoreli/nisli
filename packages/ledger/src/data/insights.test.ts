import { describe, it, expect, vi } from 'vitest';

// format.ts reads settings from the store; the real store boots by fetching the server on import.
vi.mock('./store.js', () => ({ settings: { value: { currency: 'USD', locale: 'en-US' } } }));
import { detectRecurring, safeToSpend, normalisePayee, addDays } from './insights.js';
import type { Transaction } from './model.js';

let n = 0;
const tx = (date: string, payee: string, amount: number, categoryId = 'misc'): Transaction =>
  ({ id: `t${++n}`, accountId: 'chk', categoryId, date, amount, payee });

/** Six months, Mar–Aug 2026. */
const netflix = ['2026-03-12', '2026-04-12', '2026-05-12', '2026-06-12', '2026-07-12', '2026-08-12'].map((d, i) => tx(d, `NETFLIX.COM ${4821 + i}`, -1599, 'fun'));
const payroll = [
  '2026-03-01', '2026-03-15', '2026-04-01', '2026-04-15', '2026-05-01', '2026-05-15',
  '2026-06-01', '2026-06-15', '2026-07-01', '2026-07-15', '2026-08-01', '2026-08-15',
].map((d) => tx(d, 'ACME PAYROLL', 250000, 'salary'));
const gym = ['2026-08-01', '2026-08-08', '2026-08-15', '2026-08-22'].map((d) => tx(d, 'Gym #2', -1500, 'health'));
const oneOffs = [tx('2026-05-03', 'Hardware store', -8200), tx('2026-06-20', 'Hardware store', -300)];
const TODAY = '2026-08-25';

describe('normalisePayee', () => {
  it('folds case, digit tails and #/* markers', () => {
    expect(normalisePayee('NETFLIX.COM 4821 *')).toBe('netflix.com');
    expect(normalisePayee('Gym #2')).toBe('gym');
    expect(normalisePayee('  Corner  Shop ')).toBe('corner shop');
  });
});

describe('detectRecurring', () => {
  const found = detectRecurring([...netflix, ...payroll, ...gym, ...oneOffs], TODAY);
  const by = (payee: string) => found.find((r) => r.payee.toLowerCase().startsWith(payee));

  it('finds a monthly subscription and projects the next date', () => {
    const r = by('netflix')!;
    expect(r).toMatchObject({ cadence: 'monthly', typicalAmount: -1599, lastDate: '2026-08-12', nextExpected: '2026-09-12', occurrences: 6, categoryId: 'fun', confidence: 1 });
  });
  it('finds a weekly item', () => {
    expect(by('gym')).toMatchObject({ cadence: 'weekly', nextExpected: '2026-08-29', occurrences: 4 });
  });
  it('does not label semi-monthly payroll monthly or weekly — median gap ~15d is outside every band', () => {
    expect(by('acme')).toBeUndefined();
  });
  it('needs three occurrences', () => {
    expect(by('hardware')).toBeUndefined();
  });
  it('tolerates ±20% amount variation and drops outliers from the series', () => {
    const power = [
      tx('2026-05-02', 'City Power', -6000), tx('2026-06-02', 'City Power', -7100), tx('2026-07-02', 'City Power', -5200),
      tx('2026-08-02', 'City Power', -6400), tx('2026-08-20', 'City Power', -30000),
    ];
    const [r] = detectRecurring(power, TODAY);
    expect(r).toMatchObject({ cadence: 'monthly', occurrences: 4, lastDate: '2026-08-02', nextExpected: '2026-09-02' });
    expect(r!.typicalAmount).toBe(-6200);
    expect(r!.confidence).toBe(0.8);
  });
  it('rejects a payee whose amounts scatter past the tolerance', () => {
    const shop = ['2026-06-01', '2026-07-01', '2026-08-01'].map((d, i) => tx(d, 'Shop', -[1000, 5000, 9000][i]!));
    expect(detectRecurring(shop, TODAY)).toEqual([]);
  });
  it('drops a series that has lapsed', () => {
    expect(detectRecurring(netflix, '2027-01-01')).toEqual([]);
    expect(detectRecurring(netflix, addDays('2026-09-12', 60))).toHaveLength(1);
  });
  it('is deterministic and sorted by next expected date', () => {
    expect(found.map((r) => r.nextExpected)).toEqual(['2026-08-29', '2026-09-12']);
    expect(detectRecurring([...netflix, ...payroll, ...gym, ...oneOffs].reverse(), TODAY)).toEqual(found);
  });
});

describe('safeToSpend', () => {
  const august = [
    tx('2026-08-01', 'ACME PAYROLL', 250000, 'salary'),
    tx('2026-08-03', 'Grocer', -12000, 'groceries'),
    tx('2026-08-10', 'Grocer', -8000, 'groceries'),
    tx('2026-08-05', 'Landlord', -90000, 'rent'),
    tx('2026-08-09', 'Bank transfer', -50000, 'transfer'),
  ];
  const budgets = [
    { id: 'b1', categoryId: 'groceries', limit: 40000 },
    { id: 'b2', categoryId: 'fun', limit: 10000 },
  ];
  /** Netflix through July: its August charge (the 12th) is still ahead of today, the 11th. */
  const result = safeToSpend({ transactions: [...august, ...netflix.slice(0, 5)], budgets, period: '2026-08', today: '2026-08-11' });

  it('adds the parts in cents and ignores transfers', () => {
    // income 2500.00 − spent 1100.00 (groceries 200 + rent 900) = 1400.00
    expect(result.parts.balanceIn).toBe(140000);
    // Netflix 15.99 due 2026-08-12, after today and inside the month
    expect(result.parts.committedBills).toBe(1599);
    // groceries 400 − 200 = 200; fun has a committed bill, so its budget is not counted twice
    expect(result.parts.budgetRemaining).toBe(20000);
    expect(result.amount).toBe(140000 - 1599 - 20000);
  });
  it('explains each line with formatted money', () => {
    expect(result.explanation[0]).toBe('$1,400.00 left of this month\'s income − $15.99 bills still due − $200.00 open in budgets = $1,184.01');
    expect(result.explanation[1]).toBe('Income received $2,500.00 − spent so far $1,100.00 = $1,400.00 left');
    expect(result.explanation[2]).toContain('NETFLIX.COM 4825 $15.99 on 2026-08-12');
    expect(result.explanation[3]).toContain('groceries $400.00 − $200.00 = $200.00');
  });
  it('does not count a bill already paid this period', () => {
    const paid = safeToSpend({ transactions: [...august, ...netflix], budgets, period: '2026-08', today: '2026-08-20' });
    expect(paid.parts.committedBills).toBe(0);
    // the paid 15.99 now sits in spending and in the fun budget, not in bills: groceries 200 + fun (100 − 15.99)
    expect(paid.parts.balanceIn).toBe(140000 - 1599);
    expect(paid.parts.budgetRemaining).toBe(20000 + 10000 - 1599);
  });
  it('never yields a budget room below zero', () => {
    const over = safeToSpend({ transactions: [...august, tx('2026-08-11', 'Grocer', -30000, 'groceries')], budgets, period: '2026-08', today: '2026-08-11' });
    expect(over.parts.budgetRemaining).toBe(10000);
  });
});
