import { describe, it, expect } from 'vitest';
import { flowOf, flows, flowTotals, transferBalance, transferPairs, TRANSFER } from './flow.js';
import { monthPeriod } from './period.js';
import type { FinanceInput } from './index.js';
import type { Account, Transaction } from '../model.js';

let n = 0;
const tx = (date: string, payee: string, amount: number, categoryId = 'misc', extra: Partial<Transaction> = {}): Transaction =>
  ({ id: `t${++n}`, accountId: 'chk', categoryId, date, amount, payee, ...extra });
const acct = (id: string, currency = 'USD'): Account =>
  ({ id, name: id, kind: 'checking', opening: 0, institution: 'T', currency });
const input = (over: Partial<FinanceInput>): FinanceInput =>
  ({ transactions: [], accounts: [acct('chk'), acct('sav'), acct('gel', 'GEL')], budgets: [], defaultCurrency: 'USD', ...over });

const AUG = monthPeriod('2026-08');

describe('flowOf (finance §3)', () => {
  it('transfer wins over sign; zero amounts are zero; otherwise the sign decides', () => {
    expect(flowOf(tx('2026-08-01', 'Card payment', -20000, TRANSFER))).toBe('transfer');
    expect(flowOf(tx('2026-08-01', 'Card payment', 20000, TRANSFER))).toBe('transfer');
    expect(flowOf(tx('2026-08-01', 'Void', 0))).toBe('zero');
    expect(flowOf(tx('2026-08-01', 'Salary', 100))).toBe('inflow');
    expect(flowOf(tx('2026-08-01', 'Shop', -100))).toBe('outflow');
  });
});

describe('flows', () => {
  it('partitions the period and keeps input order; zero rows join no partition', () => {
    const rows = [
      tx('2026-08-20', 'B', -100),
      tx('2026-08-01', 'A', -50),
      tx('2026-08-05', 'Pay', 900),
      tx('2026-08-09', 'Move', -300, TRANSFER),
      tx('2026-08-09', 'Void', 0),
      tx('2026-07-31', 'Old', -1),
    ];
    const f = flows(rows, AUG);
    expect(f.outflows.map((t) => t.payee)).toEqual(['B', 'A']);
    expect(f.inflows.map((t) => t.payee)).toEqual(['Pay']);
    expect(f.transfers.map((t) => t.payee)).toEqual(['Move']);
  });
});

describe('flowTotals', () => {
  it('sums per currency, counts pending, and reports the pending share apart', () => {
    const i = input({
      transactions: [
        tx('2026-08-01', 'Pay', 250000),
        tx('2026-08-02', 'Wire', 10000, 'misc', { pending: true }),
        tx('2026-08-03', 'Shop', -4000),
        tx('2026-08-04', 'Cafe', -1000, 'misc', { pending: true }),
        tx('2026-08-05', 'Bazar', -700, 'misc', { accountId: 'gel' }),
        tx('2026-08-06', 'Move', -5000, TRANSFER),
      ],
    });
    const t = flowTotals(i, AUG);
    expect(t.inflows).toEqual({ USD: 260000 });
    expect(t.outflows).toEqual({ GEL: 700, USD: 5000 });
    expect(t.pendingInflows).toEqual({ USD: 10000 });
    expect(t.pendingOutflows).toEqual({ USD: 1000 });
  });
});

describe('transferBalance', () => {
  it('a two-leg transfer nets to zero and is balanced', () => {
    const i = input({
      transactions: [
        tx('2026-08-09', 'To savings', -50000, TRANSFER),
        tx('2026-08-09', 'From checking', 50000, TRANSFER, { accountId: 'sav' }),
      ],
    });
    expect(transferBalance(i, AUG)).toEqual({ byCurrency: { USD: 0 }, balanced: true, legs: 2 });
  });

  it('a one-sided transfer leaves the unmatched amount visible', () => {
    const i = input({ transactions: [tx('2026-08-09', 'From checking', 50000, TRANSFER, { accountId: 'sav' })] });
    expect(transferBalance(i, AUG)).toEqual({ byCurrency: { USD: 50000 }, balanced: false, legs: 1 });
  });

  it('currencies never cancel each other', () => {
    const i = input({
      transactions: [
        tx('2026-08-09', 'Out', -50000, TRANSFER),
        tx('2026-08-09', 'In', 50000, TRANSFER, { accountId: 'gel' }),
      ],
    });
    const b = transferBalance(i, AUG);
    expect(b.balanced).toBe(false);
    expect(b.byCurrency).toEqual({ GEL: 50000, USD: -50000 });
  });
});

describe('transferPairs', () => {
  const legs = [
    tx('2026-08-09', 'To savings', -50000, TRANSFER),
    tx('2026-08-10', 'From checking', 50000, TRANSFER, { accountId: 'sav' }),
    tx('2026-08-15', 'Lonely leg', -7000, TRANSFER),
  ];

  it('matches opposite legs across accounts within the window; unmatched legs stay unmatched', () => {
    const pairs = transferPairs(input({ transactions: legs }), AUG);
    expect(pairs).toEqual([{ outId: legs[0]!.id, inId: legs[1]!.id, cents: 50000, currency: 'USD' }]);
  });

  it('never pairs legs of one account, different amounts, or different currencies', () => {
    const sameAccount = [tx('2026-08-09', 'Out', -50000, TRANSFER), tx('2026-08-09', 'In', 50000, TRANSFER)];
    expect(transferPairs(input({ transactions: sameAccount }), AUG)).toEqual([]);
    const offAmount = [tx('2026-08-09', 'Out', -50000, TRANSFER), tx('2026-08-09', 'In', 49999, TRANSFER, { accountId: 'sav' })];
    expect(transferPairs(input({ transactions: offAmount }), AUG)).toEqual([]);
    const crossCurrency = [tx('2026-08-09', 'Out', -50000, TRANSFER), tx('2026-08-09', 'In', 50000, TRANSFER, { accountId: 'gel' })];
    expect(transferPairs(input({ transactions: crossCurrency }), AUG)).toEqual([]);
  });

  it('is deterministic under input order (tenet 13)', () => {
    const forward = transferPairs(input({ transactions: legs }), AUG);
    const reversed = transferPairs(input({ transactions: [...legs].reverse() }), AUG);
    expect(reversed).toEqual(forward);
  });
});
