/**
 * SafeToSpend and Runway (finance §7) — two different questions, no longer
 * conflated.
 *
 * SafeToSpend is grounded in *posted cash on hand* in the spending
 * (checking-kind) accounts — never month-to-date net flow — minus the bills
 * expected before the next paycheck (capped at 30 days out; the window
 * crosses the month boundary, so Sep 1 rent counts on Aug 30), minus the
 * room still open in budgets. Pending inflows are excluded from cash and
 * *named*. Credit-card payments are filed as transfers, which never join a
 * commitment series, so they cannot enter the bills term — the explanation
 * says so outright rather than leaving the one large number silently
 * optimistic (tenet 5).
 *
 * Runway is cash across checking and savings divided by the typical monthly
 * outflow (median of the last three complete months).
 *
 * Both take an injected money formatter so the arithmetic can be spelled in
 * words without the domain touching `Intl` or settings.
 */
import type { Account } from '../model.js';
import { flowOf } from './flow.js';
import { currencyOf } from './money.js';
import type { Cents } from './money.js';
import { addDays, inPeriod, monthPeriod, previousPeriod, type ISODate, type Period } from './period.js';
import {
  detectRecurringSeries,
  fixedCommitments,
  nextExpectedIncome,
  upcomingOccurrences,
  type Occurrence,
} from './commitment.js';
import type { FinanceInput } from './index.js';

/** Formats cents for the explanation lines; injected by the caller (the domain never touches Intl). Must be pure. */
export type MoneyText = (cents: Cents) => string;

const isDefaultCurrency = (input: FinanceInput, account: Account): boolean =>
  account.currency.toUpperCase() === input.defaultCurrency.toUpperCase();

/** opening + every posted transaction dated on or before `today`. */
const postedBalance = (input: FinanceInput, account: Account, today: ISODate): Cents =>
  account.opening
  + input.transactions
    .filter((t) => t.accountId === account.id && !t.pending && t.date <= today)
    .reduce((s, t) => s + t.amount, 0);

/** How far ahead bills are committed when no recurring income is detected. */
export const COMMITMENT_HORIZON_DAYS = 30;

export interface SafeToSpend {
  /** cashOnHand − committedBills − openBudgets, cents. */
  amount: Cents;
  parts: {
    /** Posted balance across checking accounts in the default currency. */
    cashOnHand: Cents;
    /** Bills expected after `today` and up to `dueBy`, as positive cents. */
    committedBills: Cents;
    /** Room still open in budgets whose category no committed bill covers. */
    openBudgets: Cents;
  };
  /** Bills up to this date count: the next expected income, capped 30 days out. */
  dueBy: ISODate;
  bills: Occurrence[];
  /** Pending inflows in the spending accounts — excluded from cash, named in the explanation. */
  pendingInflows: Cents;
  /** The arithmetic in words; the first line is the summary. */
  explanation: string[];
}

/** What can go out today without touching a bill still due or a budget still open. */
export function safeToSpend(input: FinanceInput, p: Period, today: ISODate, format: MoneyText): SafeToSpend {
  const spending = input.accounts.filter((a) => a.kind === 'checking' && isDefaultCurrency(input, a));
  const cashParts = spending.map((a) => ({ name: a.name, cents: postedBalance(input, a, today) }));
  const cashOnHand = cashParts.reduce((s, part) => s + part.cents, 0);
  const spendingIds = new Set(spending.map((a) => a.id));
  const pendingInflows = input.transactions
    .filter((t) => spendingIds.has(t.accountId) && t.pending && flowOf(t) === 'inflow')
    .reduce((s, t) => s + t.amount, 0);

  const accountById = new Map(input.accounts.map((a) => [a.id, a] as const));
  // A recurring amount in another currency cannot be subtracted from the
  // default-currency cash balance as though it were the same money.
  const defaultCurrencyTransactions = input.transactions.filter(
    (t) => currencyOf(t, accountById, input.defaultCurrency) === input.defaultCurrency.toUpperCase(),
  );
  const series = detectRecurringSeries(defaultCurrencyTransactions, today);
  const income = nextExpectedIncome(series);
  const cap = addDays(today, COMMITMENT_HORIZON_DAYS);
  const dueBy = income && income.nextExpected > today && income.nextExpected < cap ? income.nextExpected : cap;
  const bills = upcomingOccurrences(fixedCommitments(series), addDays(today, 1), dueBy);
  const committedBills = bills.reduce((s, bill) => s - bill.typicalAmount, 0);

  const covered = new Set(bills.map((bill) => bill.categoryId));
  const defaultCode = input.defaultCurrency.toUpperCase();
  const rooms = input.budgets
    .filter((b) => !covered.has(b.categoryId))
    .map((b) => {
      const spent = inPeriod(input.transactions, p)
        .filter((t) => t.categoryId === b.categoryId && flowOf(t) === 'outflow'
          && currencyOf(t, accountById, input.defaultCurrency) === defaultCode)
        .reduce((s, t) => s - t.amount, 0);
      return { categoryId: b.categoryId, limit: b.limit, spent, left: Math.max(0, b.limit - spent) };
    });
  const openBudgets = rooms.reduce((s, room) => s + room.left, 0);
  const amount = cashOnHand - committedBills - openBudgets;

  const f = format;
  const explanation = [
    `${f(cashOnHand)} cash on hand − ${f(committedBills)} bills due by ${dueBy} − ${f(openBudgets)} open in budgets = ${f(amount)}`,
    `Cash on hand is the posted balance of ${spending.length} checking account${spending.length === 1 ? '' : 's'}`
      + (cashParts.length ? `: ${cashParts.map((part) => `${part.name} ${f(part.cents)}`).join(' + ')} = ${f(cashOnHand)}` : '')
      + `; ${pendingInflows > 0 ? `${f(pendingInflows)} pending inflows excluded` : 'nothing pending'}`,
    bills.length
      ? `Bills due by ${dueBy}: ${bills.map((bill) => `${bill.payee} ${f(-bill.typicalAmount)} on ${bill.expectedOn}`).join(', ')} = ${f(committedBills)}`
      : `No recurring bills due between ${today} and ${dueBy}`,
    'Credit-card payments are filed as transfers and are not counted in bills.',
    rooms.length
      ? `Budget room: ${rooms.map((room) => `${room.categoryId} ${f(room.limit)} − ${f(room.spent)} = ${f(room.left)}`).join(', ')} = ${f(openBudgets)}${covered.size ? ' (categories with a bill due are counted once, as the bill)' : ''}`
      : 'No budgets without a bill already due',
  ];
  return { amount, parts: { cashOnHand, committedBills, openBudgets }, dueBy, bills, pendingInflows, explanation };
}

export interface Runway {
  /** Posted balance across checking and savings accounts in the default currency. */
  cash: Cents;
  /** Median of the last three complete months' outflow; 0 when there was none. */
  typicalMonthlyOutflow: Cents;
  /** cash ÷ typical monthly outflow, one decimal (7.4 = 7.4 months); absent when the last three months saw no outflow. */
  months?: number;
  /** The arithmetic in words. */
  explanation: string[];
}

/** How long the cash lasts at the typical burn — a different question from SafeToSpend. */
export function runway(input: FinanceInput, today: ISODate, format: MoneyText): Runway {
  const cashAccounts = input.accounts.filter(
    (a) => (a.kind === 'checking' || a.kind === 'savings') && isDefaultCurrency(input, a),
  );
  const cash = cashAccounts.reduce((s, account) => s + postedBalance(input, account, today), 0);
  const accountById = new Map(input.accounts.map((a) => [a.id, a] as const));
  const defaultCode = input.defaultCurrency.toUpperCase();
  let month: Period = monthPeriod(today.slice(0, 7));
  const totals: Cents[] = [];
  for (let i = 0; i < 3; i++) {
    month = previousPeriod(month);
    totals.push(inPeriod(input.transactions, month)
      .filter((t) => flowOf(t) === 'outflow' && currencyOf(t, accountById, input.defaultCurrency) === defaultCode)
      .reduce((s, t) => s - t.amount, 0));
  }
  const typicalMonthlyOutflow = [...totals].sort((a, b) => a - b)[1]!;
  if (typicalMonthlyOutflow <= 0) {
    return {
      cash,
      typicalMonthlyOutflow: 0,
      explanation: [`Cash ${format(cash)} across checking and savings; no outflow in the last 3 months, so runway is not measurable`],
    };
  }
  const months = Math.round((cash / typicalMonthlyOutflow) * 10) / 10;
  return {
    cash,
    typicalMonthlyOutflow,
    months,
    explanation: [`Cash ${format(cash)} across checking and savings ÷ ${format(typicalMonthlyOutflow)} typical monthly outflow (3-month median) = ${months} months`],
  };
}
