import { describe, it, expect } from 'vitest';
import { categoryRollup } from './rollup.js';
import { flowTotals, TRANSFER } from './flow.js';
import { only } from './money.js';
import { monthPeriod } from './period.js';
import type { FinanceInput } from './index.js';
import type { Account, Transaction } from '../model.js';

let n = 0;
const tx = (date: string, payee: string, amount: number, categoryId = 'misc', extra: Partial<Transaction> = {}): Transaction =>
  ({ id: `t${++n}`, accountId: 'chk', categoryId, date, amount, payee, ...extra });
const acct = (id: string, currency = 'USD', kind: Account['kind'] = 'checking'): Account =>
  ({ id, name: id, kind, opening: 0, institution: 'T', currency });

const AUG = monthPeriod('2026-08');
const transactions = [
  tx('2026-08-01', 'ACME PAYROLL', 685000, 'salary'),
  tx('2026-08-03', 'Grocer', -12000, 'groceries'),
  tx('2026-08-10', 'Grocer', -8000, 'groceries'),
  tx('2026-08-12', 'Grocer refund', 2500, 'groceries'),
  tx('2026-08-14', 'Cinema', -1599, 'fun'),
  tx('2026-08-20', 'Cafe', -3000, 'fun', { pending: true }),
  tx('2026-08-09', 'To savings', -50000, TRANSFER),
  tx('2026-08-09', 'From checking', 50000, TRANSFER, { accountId: 'sav' }),
  tx('2026-08-15', 'Bazar', -1200, 'misc', { accountId: 'gel' }),
  tx('2026-07-20', 'Grocer', -99999, 'groceries'),
];
const input: FinanceInput = {
  transactions,
  accounts: [acct('chk'), acct('sav', 'USD', 'savings'), acct('gel', 'GEL')],
  budgets: [], defaultCurrency: 'USD',
};

describe('categoryRollup (finance §5)', () => {
  const rollup = categoryRollup(input, AUG);

  it('gives income categories a presence and files a refund under Money in for its category', () => {
    expect(rollup.inflows).toEqual([
      { categoryId: 'salary', amounts: { USD: 685000 } },
      { categoryId: 'groceries', amounts: { USD: 2500 } },
    ]);
  });

  it('totals outflows as positive magnitudes, pending included, the period respected, transfers excluded', () => {
    expect(rollup.outflows).toEqual([
      { categoryId: 'groceries', amounts: { USD: 20000 } },
      { categoryId: 'fun', amounts: { USD: 4599 } },
      { categoryId: 'misc', amounts: { GEL: 1200 } },
    ]);
  });

  it('keeps currencies apart — the GEL row carries no USD figure and sorts by the default currency', () => {
    const misc = rollup.outflows.find((r) => r.categoryId === 'misc')!;
    expect(only(misc.amounts, 'USD')).toBe(0);
    expect(only(misc.amounts, 'GEL')).toBe(1200);
    expect(rollup.outflows[rollup.outflows.length - 1]).toBe(misc);
  });

  it('reconciles exactly with flowTotals: the stat equals the visible sum of its rows (tenet 5)', () => {
    const totals = flowTotals(input, AUG);
    const sum = (rows: { amounts: Readonly<Record<string, number>> }[]) =>
      rows.reduce((s, r) => s + only(r.amounts, 'USD'), 0);
    expect(sum(rollup.inflows)).toBe(only(totals.inflows, 'USD'));
    expect(sum(rollup.outflows)).toBe(only(totals.outflows, 'USD'));
  });

  it('is deterministic under input order (tenet 13)', () => {
    expect(categoryRollup({ ...input, transactions: [...transactions].reverse() }, AUG)).toEqual(rollup);
  });
});
