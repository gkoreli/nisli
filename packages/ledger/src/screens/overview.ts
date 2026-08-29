import { component, computed } from '@nisli/core';
import { Page, Grid, Stat, Section, Bars, Meter, Table, Text, Columns, type Column } from '@nisli/engine';
import type { Transaction } from '../data/model.js';
import { accounts, budgets, categories, transactions, balance, categoryName, accountName, period, shiftPeriod } from '../data/store.js';
import { money, shortDate, monthKey, thisMonth, monthLabel, monthShort, previousMonth, lastMonths, today } from '../data/format.js';
import { detectRecurring, safeToSpend, type RecurringItem } from '../data/insights.js';

const isFlow = (t: Transaction) => t.categoryId !== 'transfer';

export const OverviewScreen = component('ledger-overview', () => {

  const inMonth = (key: string) => transactions.value.filter((t) => monthKey(t.date) === key && isFlow(t));
  const income = (key: string) => inMonth(key).filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const spend = (key: string) => -inMonth(key).filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  const netWorth = computed(() => accounts.value.reduce((s, a) => s + balance(a.id), 0));
  const incomeNow = computed(() => income(period.value));
  const spendNow = computed(() => spend(period.value));
  const spendPrev = computed(() => spend(previousMonth(period.value)));
  const savingsRate = computed(() => (incomeNow.value > 0 ? Math.round(((incomeNow.value - spendNow.value) / incomeNow.value) * 100) : 0));
  const spendDelta = computed(() => {
    if (spendPrev.value === 0) return undefined;
    const pct = Math.round(((spendNow.value - spendPrev.value) / spendPrev.value) * 100);
    return { text: `${pct > 0 ? '+' : ''}${pct}% vs ${monthLabel(previousMonth(period.value)).split(' ')[0]}`, tone: pct > 0 ? ('negative' as const) : ('positive' as const) };
  });

  const byCategory = computed(() =>
    categories.value
      .filter((c) => !c.income && c.id !== 'transfer')
      .map((c) => ({ label: c.name, value: -inMonth(period.value).filter((t) => t.categoryId === c.id && t.amount < 0).reduce((s, t) => s + t.amount, 0) }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((x) => ({ ...x, text: money(x.value) })),
  );

  const budgetRows = computed(() =>
    budgets.value.map((b) => {
      const spent = -inMonth(period.value).filter((t) => t.categoryId === b.categoryId && t.amount < 0).reduce((s, t) => s + t.amount, 0);
      return { id: b.id, label: categoryName(b.categoryId), spent, limit: b.limit };
    }).sort((a, b) => b.spent / b.limit - a.spent / a.limit),
  );

  const recent = computed(() => transactions.value.filter(isFlow).slice(0, 8));
  const months = computed(() => lastMonths(period.value, 12));
  const trendLabels = computed(() => months.value.map(monthShort));
  const trendSeries = computed(() => [
    { name: 'Income', tone: 'positive' as const, values: months.value.map(income) },
    { name: 'Spending', tone: 'negative' as const, values: months.value.map(spend) },
  ]);
  const safe = computed(() => safeToSpend({ transactions: transactions.value, budgets: budgets.value, period: period.value, today: today() }));
  const recurring = computed(() => detectRecurring(transactions.value, today()));
  const recurringColumns: Column<RecurringItem>[] = [
    { id: 'payee', header: 'Payee', cell: (r) => r.payee, priority: 'primary' },
    { id: 'cadence', header: 'Cadence', cell: (r) => r.cadence, priority: 'tertiary' },
    { id: 'typical', header: 'Typical', kind: 'money', cell: (r) => money(r.typicalAmount, { sign: true }) },
    { id: 'next', header: 'Next expected', kind: 'date', cell: (r) => shortDate(r.nextExpected) },
  ];
  const columns: Column<Transaction>[] = [
    { id: 'date', header: 'Date', kind: 'date', cell: (t) => shortDate(t.date), priority: 'primary' },
    { id: 'payee', header: 'Payee', cell: (t) => t.payee, priority: 'primary' },
    { id: 'category', header: 'Category', cell: (t) => categoryName(t.categoryId) },
    { id: 'account', header: 'Account', cell: (t) => accountName(t.accountId), priority: 'tertiary' },
    { id: 'amount', header: 'Amount', kind: 'money', cell: (t) => Text({ text: money(t.amount, { sign: true }), tone: t.amount > 0 ? 'positive' : 'neutral' }), priority: 'primary' },
  ];

  return Page({
    title: computed(() => monthLabel(period.value)),
    actions: [
      { id: 'prev', label: '‹ Previous', priority: 'secondary', onSelect: () => shiftPeriod(-1) },
      { id: 'next', label: 'Next ›', priority: 'secondary', onSelect: () => shiftPeriod(1) },
      { id: 'today', label: 'This month', priority: 'tertiary', onSelect: () => { period.value = thisMonth(); } },
    ],
    children: [
      Grid({
        children: [
          Stat({ label: 'Net worth', value: computed(() => money(netWorth.value)), hint: computed(() => `${accounts.value.length} accounts`) }),
          Stat({ label: 'Income', value: computed(() => money(incomeNow.value)), hint: computed(() => monthLabel(period.value)) }),
          Stat({ label: 'Spending', value: computed(() => money(spendNow.value)), delta: spendDelta }),
          Stat({
            label: 'Safe to spend',
            value: computed(() => money(safe.value.amount)),
            delta: computed(() => (safe.value.amount === 0 ? undefined : { text: safe.value.amount > 0 ? 'After bills and budgets' : 'Bills and budgets exceed what is left', tone: safe.value.amount > 0 ? 'positive' as const : 'negative' as const })),
            hint: computed(() => safe.value.explanation[0]),
          }),
          Stat({ label: 'Savings rate', value: computed(() => `${savingsRate.value}%`), delta: computed(() => ({ text: savingsRate.value >= 20 ? 'On track' : 'Below 20% target', tone: savingsRate.value >= 20 ? 'positive' as const : 'warning' as const })) }),
        ],
      }),
      Section({ title: 'Last 12 months', children: [Columns({ labels: trendLabels, series: trendSeries, text: (v) => money(v) })] }),
      Grid({
        children: [
          Section({ title: 'Spending by category', children: [Bars({ items: byCategory })] }),
          Section({
            title: 'Budgets',
            children: computed(() => budgetRows.value.slice(0, 6).map((b) =>
              Meter({ label: b.label, value: b.spent, max: b.limit, detail: `${money(b.spent)} of ${money(b.limit)}` }),
            )),
          }),
        ],
      }),
      Section({
        title: 'Recurring',
        children: [
          Table<RecurringItem>({ columns: recurringColumns, rows: recurring, key: (r) => r.payee.toLowerCase(), empty: 'Nothing recurring noticed yet — it takes three occurrences on a steady beat.' }),
          Text({ text: 'A payee seen three or more times at a steady interval (about 7, 30 or 365 days apart) with amounts within 20% of each other is listed here; the next date is the last one plus the usual gap.', role: 'muted' }),
        ],
      }),
      Section({ title: 'Recent transactions', children: [Table<Transaction>({ columns, rows: recent, key: (t) => t.id })] }),
    ],
  });
});
