import { describe, it, expect } from 'vitest';
import { runway, safeToSpend } from './safe-to-spend.js';
import { TRANSFER } from '../model.js';
import type { FinanceInput } from './index.js';
import type { Account, Transaction } from '../model.js';

let n = 0;
const tx = (date: string, payee: string, amount: number, categoryId = 'misc', extra: Partial<Transaction> = {}): Transaction =>
  ({ id: `t${++n}`, accountId: 'chk', categoryId, date, amount, payee, ...extra });
const acct = (id: string, kind: Account['kind'], opening: number, currency = 'USD'): Account =>
  ({ id, name: id, kind, opening, institution: 'T', currency });
/** Pure test formatter — no Intl, no grouping. */
const f = (c: number) => `${c < 0 ? '-' : ''}$${(Math.abs(c) / 100).toFixed(2)}`;

const TODAY = '2026-08-30';

describe('safeToSpend (finance §7)', () => {
  const rent = ['2026-06-01', '2026-07-01', '2026-08-01'].map((d) => tx(d, 'Landlord', -90000, 'rent'));
  const netflix = ['2026-03-12', '2026-04-12', '2026-05-12', '2026-06-12', '2026-07-12', '2026-08-12']
    .map((d) => tx(d, 'NETFLIX.COM', -1599, 'fun'));
  const payroll = ['2026-06-15', '2026-07-15', '2026-08-15'].map((d) => tx(d, 'ACME PAYROLL', 250000, 'salary'));
  const autopay = ['2026-06-20', '2026-07-20', '2026-08-20'].map((d) => tx(d, 'CHASE CARD AUTOPAY', -20000, TRANSFER));
  const rest = [
    tx('2026-08-05', 'Grocer', -12000, 'groceries'),
    tx('2026-08-29', 'Incoming wire', 1000000, 'salary', { pending: true }),
    tx('2026-08-10', 'Bazar', -700, 'misc', { accountId: 'gel' }),
  ];
  const transactions = [...rent, ...netflix, ...payroll, ...autopay, ...rest];
  const input: FinanceInput = {
    transactions,
    accounts: [
      acct('chk', 'checking', 500000),
      acct('chk2', 'checking', 100000),
      acct('sav', 'savings', 3000000),
      acct('card', 'credit', -50000),
      acct('gel', 'checking', 700000, 'GEL'),
    ],
    budgets: [
      { id: 'b1', categoryId: 'groceries', limit: 40000 },
      { id: 'b2', categoryId: 'rent', limit: 90000 },
    ],
    defaultCurrency: 'USD',
  };
  const result = safeToSpend(input, TODAY, f);

  // Cash: chk 500000 − rent 270000 − netflix 9594 + payroll 750000 − groceries 12000 − autopay 60000 = 898406; chk2 100000.
  it('grounds cash on posted checking balances only — savings, credit, other currencies and pending stay out', () => {
    expect(result.parts.cashOnHand).toBe(998406);
    expect(result.pendingInflows).toBe(1000000);
    expect(result.parts.pendingOutflows).toBe(0);
  });

  it('commits bills up to the next expected income, across the month boundary', () => {
    expect(result.dueBy).toBe('2026-09-15');
    expect(result.bills.map((b) => ({ payee: b.payee, expectedOn: b.expectedOn }))).toEqual([
      { payee: 'Landlord', expectedOn: '2026-09-01' },
      { payee: 'NETFLIX.COM', expectedOn: '2026-09-12' },
    ]);
    expect(result.parts.committedBills).toBe(91599);
  });

  it('counts open budget rooms once — a category with a bill due is priced as the bill', () => {
    expect(result.parts.openBudgets).toBe(28000); // groceries 40000 − 12000; rent covered by the Sep 1 bill
    expect(result.explanation[4]).toContain('rent $900.00 − $900.00 spent − $0.00 covered by due bills = $0.00');
  });

  it('reserves only the part of a budget not already represented by its due bill', () => {
    const funOnly = { ...input, budgets: [{ id: 'b3', categoryId: 'fun', limit: 10000 }] };
    const r = safeToSpend(funOnly, TODAY, f);
    // $100 budget − $15.99 already spent − $15.99 upcoming bill = $68.02 still reserved.
    expect(r.parts.openBudgets).toBe(6802);
    expect(r.explanation[4]).toContain('fun $100.00 − $15.99 spent − $15.99 covered by due bills = $68.02');
  });

  it('shows the whole arithmetic: cash − bills − budgets = amount, verbatim, with − and =', () => {
    expect(result.amount).toBe(998406 - 91599 - 28000);
    expect(result.explanation[0]).toBe('$9984.06 cash on hand − $0.00 pending outflows − $915.99 bills due by 2026-09-15 − $280.00 open in budgets = $8788.07');
  });

  it('names the cash basis and the excluded pending inflows', () => {
    expect(result.explanation[1]).toContain('2 checking accounts');
    expect(result.explanation[1]).toContain('chk $8984.06 + chk2 $1000.00 = $9984.06');
    expect(result.explanation[1]).toContain('$10000.00 pending inflows excluded');
  });

  it('states outright that credit-card payments (transfers) are not in the bills term', () => {
    expect(result.explanation.some((line) => line.includes('Credit-card payments are filed as transfers'))).toBe(true);
    expect(result.bills.some((b) => b.payee.includes('AUTOPAY'))).toBe(false);
  });

  it('never subtracts another currency recurring bill from default-currency cash', () => {
    const gelBill = ['2026-06-07', '2026-07-07', '2026-08-07']
      .map((date) => tx(date, 'Tbilisi Utility', -5000, 'utilities', { accountId: 'gel' }));
    const r = safeToSpend({ ...input, transactions: [...transactions, ...gelBill] }, TODAY, f);
    expect(r.parts.committedBills).toBe(result.parts.committedBills);
    expect(r.bills.some((bill) => bill.payee === 'Tbilisi Utility')).toBe(false);
  });

  it('caps the horizon at 30 days when no recurring income is detected', () => {
    const noIncome = { ...input, transactions: transactions.filter((t) => t.payee !== 'ACME PAYROLL') };
    const r = safeToSpend(noIncome, TODAY, f);
    expect(r.dueBy).toBe('2026-09-29');
    expect(r.parts.committedBills).toBe(91599);
  });

  it('an overspent budget contributes zero room, never negative', () => {
    const tight = { ...input, budgets: [{ id: 'b1', categoryId: 'groceries', limit: 10000 }] };
    expect(safeToSpend(tight, TODAY, f).parts.openBudgets).toBe(0);
  });

  it('names both pending directions when neither is present', () => {
    const posted = { ...input, transactions: transactions.filter((t) => !t.pending) };
    const r = safeToSpend(posted, TODAY, f);
    expect(r.pendingInflows).toBe(0);
    expect(r.explanation[1]).toContain('no pending inflows');
    expect(r.explanation[1]).toContain('no pending outflows');
  });

  it('reserves pending checking outflows without treating them as posted cash', () => {
    const pendingCharge = tx('2026-08-30', 'Pending card authorization', -5000, 'misc', { pending: true });
    const r = safeToSpend({ ...input, transactions: [...transactions, pendingCharge] }, TODAY, f);
    expect(r.parts.cashOnHand).toBe(result.parts.cashOnHand);
    expect(r.parts.pendingOutflows).toBe(5000);
    expect(r.amount).toBe(result.amount - 5000);
    expect(r.explanation[1]).toContain('$50.00 pending outflows reserved');
  });

  it('is deterministic under input order (tenet 13)', () => {
    expect(safeToSpend({ ...input, transactions: [...transactions].reverse() }, TODAY, f)).toEqual(result);
  });

  it('derives budget room from today\'s calendar month, never from a selected report month', () => {
    const historicalSpend = tx('2026-07-05', 'Historical grocer', -39900, 'groceries');
    const r = safeToSpend({ ...input, transactions: [...transactions, historicalSpend] }, TODAY, f);
    expect(r.parts.openBudgets).toBe(result.parts.openBudgets);
  });
});

describe('runway (finance §7)', () => {
  const transactions = [
    tx('2026-05-10', 'Spend', -400000),
    tx('2026-06-10', 'Spend', -500000),
    tx('2026-07-10', 'Spend', -600000),
    tx('2026-08-10', 'Spend', -999999),
    tx('2026-06-12', 'To savings', -70000, TRANSFER),
  ];
  const input: FinanceInput = {
    transactions,
    accounts: [acct('chk', 'checking', 200000), acct('sav', 'savings', 3000000), acct('card', 'credit', -50000)],
    budgets: [], defaultCurrency: 'USD',
  };

  it('divides checking+savings cash by the 3-month median outflow, current month and transfers excluded', () => {
    const r = runway(input, TODAY, f);
    expect(r.typicalMonthlyOutflow).toBe(500000); // median of May 4000, Jun 5000, Jul 6000 — Aug's 9999.99 not counted
    expect(r.cash).toBe(630001); // 200000 + 3000000 − 2499999 − 70000; the credit card is not cash
    expect(r.months).toBe(1.3);
    expect(r.explanation[0]).toBe('Cash $6300.01 across checking and savings ÷ $5000.00 typical monthly outflow (3-month median) = 1.3 months');
  });

  it('is honest when there was no outflow: no months figure, the reason in words', () => {
    const idle = runway({ ...input, transactions: [] }, TODAY, f);
    expect(idle.months).toBeUndefined();
    expect(idle.typicalMonthlyOutflow).toBe(0);
    expect(idle.explanation[0]).toContain('no outflow in the last 3 months');
  });

  it('is deterministic under input order (tenet 13)', () => {
    expect(runway({ ...input, transactions: [...transactions].reverse() }, TODAY, f)).toEqual(runway(input, TODAY, f));
  });
});
