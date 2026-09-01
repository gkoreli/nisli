/**
 * Overview — the five questions, one deterministic screen (tenets 0, 5, 6,
 * 11, 12, 13; ADR 0043/0044). Five decision-bearing numbers on top (Safe to
 * spend first), then what's coming, then where money came from and went as
 * two drillable tables, then the 12-month trend. Every number carries its
 * arithmetic in its hint or a visible line; every row opens the transactions
 * behind it in one tap. Every Section, Table, Stat and Text renders at every
 * data shape — `Empty` is declared intent, and only rows vary with data.
 */
import { component, computed, inject } from '@nisli/core';
import { Router } from '@nisli/router';
import { Page, Grid, Stat, Section, Table, Text, Link, Columns, type Column, type Series, type Delta } from '@nisli/engine';
import { accounts, budgets, transactions, settings, categoryName, period, shiftPeriod } from '../data/store.js';
import { money, shortDate, thisMonth, monthLabel, monthShort, lastMonths, today } from '../data/format.js';
import * as fin from '../data/finance/index.js';
import { spendingReviewQueue } from '../data/review.js';
import { AppRouter } from '../router.js';

export const OverviewScreen = component('ledger-overview', () => {
  const router = inject(Router);
  // The whole screen derives from the title's period and today; no section may ignore them.
  const p = computed(() => fin.monthPeriod(period.value));
  const input = computed<fin.FinanceInput>(() => ({
    transactions: transactions.value,
    accounts: accounts.value,
    budgets: budgets.value,
    defaultCurrency: settings.value.currency,
  }));
  const one = (a: fin.Amounts) => fin.money.only(a, settings.value.currency);
  const currencyText = (cents: number, currency: string, sign = false): string =>
    new Intl.NumberFormat(settings.value.locale, { style: 'currency', currency, signDisplay: sign ? 'exceptZero' : 'auto' }).format(cents / 100);
  const amountsText = (amounts: fin.Amounts, sign = false): string => {
    const parts = Object.entries(amounts)
      .filter(([, cents]) => cents !== 0)
      .map(([currency, cents]) => currencyText(cents, currency, sign));
    return parts.join(' + ') || money(0);
  };
  /** Tenet 6: no cross-currency sum, ever — anything not in the default currency is named, not added. */
  const excluded = (a: fin.Amounts): string => {
    const parts = Object.entries(fin.money.others(a, settings.value.currency))
      .filter(([, cents]) => cents !== 0)
      .map(([code, cents]) => currencyText(Math.abs(cents), code));
    return parts.length ? ` · excludes ${parts.join(', ')}` : '';
  };
  const open = (href: string) => { void router.navigate(href); };

  // ── The five stats ───────────────────────────────────────────────────
  const safe = computed(() => fin.safeToSpend(input.value, p.value, today(), (c) => money(c)));
  const run = computed(() => fin.runway(input.value, today(), (c) => money(c)));
  const totals = computed(() => fin.flowTotals(input.value, p.value));
  const win = computed(() => fin.comparisonWindow(p.value, today()));
  /** "Jul" for a whole month, "Jul 1–30" when the comparison window is truncated (honest deltas, finance §6). */
  const prevLabel = computed(() => {
    const w = win.value;
    const name = monthShort(w.previous.start.slice(0, 7));
    if (w.complete) return name;
    const endName = monthShort(w.previous.end.slice(0, 7));
    const from = Number(w.previous.start.slice(8));
    const to = Number(w.previous.end.slice(8));
    return name === endName ? `${name} ${from}–${to}` : `${name} ${from}–${endName} ${to}`;
  });
  /** The delta always renders — an empty comparison window says so instead of disappearing (tenet 13). */
  const flowDelta = (dir: 'in' | 'out') => computed<Delta>(() => {
    const w = win.value;
    const c = fin.flowTotals(input.value, w.current);
    const prev = fin.flowTotals(input.value, w.previous);
    const d = fin.delta(one(dir === 'in' ? c.inflows : c.outflows), one(dir === 'in' ? prev.inflows : prev.outflows));
    if (d.pct === undefined) return { text: `no ${prevLabel.value} data to compare`, tone: 'neutral' };
    const good = dir === 'in' ? d.diff > 0 : d.diff < 0;
    return { text: `${d.pct > 0 ? '+' : ''}${d.pct}% vs ${prevLabel.value}`, tone: d.diff === 0 ? 'neutral' : good ? 'positive' : 'negative' };
  });
  const netDelta = computed<Delta>(() => {
    const w = win.value;
    const c = fin.flowTotals(input.value, w.current);
    const prev = fin.flowTotals(input.value, w.previous);
    if (one(prev.inflows) === 0 && one(prev.outflows) === 0) return { text: `no ${prevLabel.value} data to compare`, tone: 'neutral' };
    const diff = (one(c.inflows) - one(c.outflows)) - (one(prev.inflows) - one(prev.outflows));
    return { text: `${money(diff, { sign: true })} vs ${prevLabel.value}`, tone: diff === 0 ? 'neutral' : diff > 0 ? 'positive' : 'negative' };
  });
  const pendingHint = (which: 'pendingInflows' | 'pendingOutflows', all: 'inflows' | 'outflows') => computed(() => {
    const pending = one(totals.value[which]);
    return `${pending > 0 ? `includes ${money(pending)} pending` : 'nothing pending'}${excluded(totals.value[all])}`;
  });

  // ── Coming up (Q2) ───────────────────────────────────────────────────
  // Recurrence is detected independently per currency, so equal-looking
  // amounts in different currencies can neither form one series nor be
  // formatted as the default currency.
  const seriesByCurrency = computed(() => {
    const byId = new Map(accounts.value.map((account) => [account.id, account] as const));
    const groups = new Map<string, typeof transactions.value>();
    for (const transaction of transactions.value) {
      const currency = fin.money.currencyOf(transaction, byId, settings.value.currency);
      groups.set(currency, [...(groups.get(currency) ?? []), transaction]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, rows]) => ({ currency, series: fin.detectRecurringSeries(rows, today()) }));
  });
  const coming = computed(() =>
    seriesByCurrency.value
      .flatMap(({ currency, series }) => fin.upcomingOccurrences(fin.fixedCommitments(series), fin.addDays(today(), -14), fin.addDays(today(), 30))
        .map((occurrence) => ({ ...occurrence, currency })))
      .sort((a, b) => a.expectedOn.localeCompare(b.expectedOn) || a.payee.localeCompare(b.payee) || a.currency.localeCompare(b.currency)));
  type CurrencyOccurrence = (typeof coming.value)[number];
  const comingColumns: Column<CurrencyOccurrence>[] = [
    // Overdue is visible: a due date already past renders with a warning tone.
    { id: 'due', label: 'Due', kind: 'date', priority: 'primary', cell: (o) => (o.expectedOn < today() ? Text({ text: shortDate(o.expectedOn), tone: 'warning' }) : shortDate(o.expectedOn)) },
    { id: 'payee', label: 'Payee', cell: (o) => o.payee, priority: 'primary' },
    { id: 'typical', label: 'Typical', kind: 'money', cell: (o) => currencyText(o.typicalAmount, o.currency, true) },
    { id: 'cadence', label: 'Cadence', cell: (o) => o.cadence, priority: 'tertiary' },
  ];
  /** All expected bills over the section's 30-day horizon, always rendered. */
  const committedLine = computed(() => {
    const bills = coming.value.filter((o) => o.expectedOn > today());
    const totals = bills.reduce((sum, bill) => fin.money.add(sum, bill.currency, -bill.typicalAmount), fin.money.zero);
    return `Committed in the next 30 days: ${amountsText(totals)} across ${bills.length} bill${bills.length === 1 ? '' : 's'}.`;
  });
  const incomeLine = computed(() => {
    const income = seriesByCurrency.value
      .map(({ currency, series }) => ({ currency, income: fin.nextExpectedIncome(series) }))
      .filter((candidate): candidate is { currency: string; income: fin.RecurringSeries } => candidate.income !== undefined)
      .sort((a, b) => a.income.nextExpected.localeCompare(b.income.nextExpected) || a.currency.localeCompare(b.currency))[0];
    return income
      ? `Next expected income: ${income.income.payee} ~${currencyText(income.income.typicalAmount, income.currency)} around ${shortDate(income.income.nextExpected)}.`
      : 'No recurring income detected yet.';
  });

  // ── Money in / Money out (Q3) ────────────────────────────────────────
  const rollup = computed(() => fin.categoryRollup(input.value, p.value));
  // Pending rows are included on both sides (finance §5), so each stat equals the visible sum of its rollup rows.
  const rollupColumns: Column<fin.RollupRow>[] = [
    { id: 'category', label: 'Category', cell: (r) => categoryName(r.categoryId), priority: 'primary' },
    { id: 'amount', label: 'Amount', kind: 'money', cell: (r) => money(one(r.amounts)), priority: 'primary' },
  ];
  const openCategory = (r: fin.RollupRow) =>
    open(AppRouter.routes.transactions.href({ search: { category: r.categoryId, period: period.value } }));
  /** The ambient tripwire for one-sided transfers (finance §3) — worded as fact, not defect. */
  const transferLine = computed(() => {
    const balance = fin.transferBalance(input.value, p.value);
    if (balance.legs === 0) return 'No transfers between accounts in this period.';
    if (balance.balanced) {
      const byId = new Map(accounts.value.map((account) => [account.id, account] as const));
      const moved = fin.flows(transactions.value, p.value).transfers
        .filter((t) => t.amount > 0)
        .reduce(
          (sum, t) => fin.money.add(sum, fin.money.currencyOf(t, byId, settings.value.currency), t.amount),
          fin.money.zero,
        );
      return `Transfers moved ${amountsText(moved)} between accounts and net to zero in each currency.`;
    }
    return `Transfers do not net to zero: ${amountsText(balance.byCurrency, true)} remains unmatched.`;
  });
  const reviewLine = computed(() => {
    const n = spendingReviewQueue(transactions.value, period.value).length;
    return n > 0
      ? `${n} transaction${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} a category — these totals may shift.`
      : 'Every transaction is filed.';
  });

  // ── Last 12 months (Q4) ──────────────────────────────────────────────
  const months = computed(() => lastMonths(period.value, 12));
  const trendLabels = computed(() => months.value.map(monthShort));
  const trendSeries = computed<Series[]>(() => {
    const perMonth = months.value.map((key) => fin.flowTotals(input.value, fin.monthPeriod(key)));
    return [
      { label: 'In', tone: 'positive', values: perMonth.map((t) => one(t.inflows)) },
      { label: 'Out', tone: 'negative', values: perMonth.map((t) => one(t.outflows)) },
    ];
  });

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
          Stat({
            label: 'Safe to spend',
            value: computed(() => money(safe.value.amount)),
            delta: computed<Delta>(() => (safe.value.amount < 0
              ? { text: 'Bills and budgets exceed cash on hand', tone: 'negative' }
              : { text: 'After bills and budgets', tone: safe.value.amount > 0 ? 'positive' : 'neutral' })),
            hint: computed(() => safe.value.explanation[0]!),
          }),
          Stat({
            label: 'Money in',
            value: computed(() => money(one(totals.value.inflows))),
            delta: flowDelta('in'),
            hint: pendingHint('pendingInflows', 'inflows'),
          }),
          Stat({
            label: 'Money out',
            value: computed(() => money(one(totals.value.outflows))),
            delta: flowDelta('out'),
            hint: pendingHint('pendingOutflows', 'outflows'),
          }),
          Stat({
            label: 'Net',
            value: computed(() => money(one(totals.value.inflows) - one(totals.value.outflows), { sign: true })),
            delta: netDelta,
            hint: computed(() => `${money(one(totals.value.inflows))} in − ${money(one(totals.value.outflows))} out`),
          }),
          Stat({
            label: 'Runway',
            value: computed(() => (run.value.months !== undefined ? `${run.value.months} months` : '—')),
            hint: computed(() => run.value.explanation[0]!),
          }),
        ],
      }),
      // The arithmetic is ambient on this screen, not behind a tap: the cash
      // basis (which accounts, what is pending) and the credit-card exclusion
      // are the safe-to-spend explanation's own lines, rendered in place.
      Text({ text: computed(() => safe.value.explanation[1]!), role: 'note' }),
      Text({ text: computed(() => safe.value.explanation[3]!), role: 'note' }),
      Section({
        title: 'Coming up',
        children: [
          Table<CurrencyOccurrence>({
            columns: comingColumns,
            rows: coming,
            rowKey: (o) => `${o.currency}|${o.seriesKey}|${o.expectedOn}`,
            onOpen: (o) => open(AppRouter.routes.transactions.href({ search: { q: o.seriesKey } })),
            empty: { title: 'No bills expected in the next 30 days', hint: 'A bill is a payee seen three or more times on a steady beat.' },
          }),
          Text({ text: committedLine, role: 'note' }),
          Text({ text: incomeLine, role: 'note' }),
        ],
      }),
      Grid({
        children: [
          Section({
            title: 'Money in',
            children: [
              Table<fin.RollupRow>({
                columns: rollupColumns,
                rows: computed(() => rollup.value.inflows),
                rowKey: (r) => r.categoryId,
                onOpen: openCategory,
                empty: { title: 'No money in yet this month' },
              }),
              Text({ text: transferLine, role: 'note' }),
            ],
          }),
          Section({
            title: 'Money out',
            children: [
              Table<fin.RollupRow>({
                columns: rollupColumns,
                rows: computed(() => rollup.value.outflows),
                rowKey: (r) => r.categoryId,
                onOpen: openCategory,
                empty: { title: 'No spending yet this month' },
              }),
              Text({ text: reviewLine, role: 'note' }),
              Link({ href: AppRouter.routes.transactions.href({ search: { review: '1' } }), label: 'Review categories →' }),
            ],
          }),
        ],
      }),
      Section({ title: 'Last 12 months', children: [Columns({ labels: trendLabels, series: trendSeries, format: (v) => money(v) })] }),
    ],
  });
});
