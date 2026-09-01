import { component, signal, computed } from '@nisli/core';
import { Page, Section, Table, Form, Text, type Column, type Sort, type Field, type Action } from '@nisli/engine';
import type { Transaction } from '../data/model.js';
import { accounts, categories, transactions, categoryName, accountName, period } from '../data/store.js';
import { money, shortDate, monthKey, monthLabel } from '../data/format.js';
import { spendingReviewCause, spendingReviewQueue } from '../data/review.js';
import { TransactionDialog } from './transaction-dialog.js';

type Filters = { q: string; categoryId: string; accountId: string; month: string; needsReview: boolean };

const emptyFilters = (): Filters => ({ q: '', categoryId: '', accountId: '', month: '', needsReview: false });

/**
 * The Overview's drill deep-links land here: `?q=<series key>` (the
 * transactions behind a recurring series), `?category=<id>&period=<key>`
 * (the rows behind a rollup line) and `?review` (the category review queue).
 * Read once at mount — the filters are the user's from then on.
 */
const filtersFromUrl = (): Filters => {
  const url = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  return {
    q: url.get('q') ?? '',
    categoryId: url.get('category') ?? '',
    accountId: '',
    month: url.get('period') ?? '',
    needsReview: url.has('review'),
  };
};

export const TransactionsScreen = component('ledger-transactions', () => {
  const initial = filtersFromUrl();
  const filters = signal<Filters>(initial);
  const sort = signal<Sort>(initial.needsReview ? { by: 'amount', order: 'asc' } : { by: 'date', order: 'desc' });
  const editing = signal<Transaction | undefined>(undefined);
  const open = signal(false);

  const filterFields = computed<Field<Filters>[]>(() => [
    { name: 'q', label: 'Search', kind: 'text', placeholder: 'Payee or note' },
    { name: 'categoryId', label: 'Category', placeholder: 'All categories', options: categories.value.map((c) => ({ value: c.id, label: c.name })) },
    { name: 'accountId', label: 'Account', placeholder: 'All accounts', options: accounts.value.map((a) => ({ value: a.id, label: a.name })) },
    { name: 'month', label: 'Month', placeholder: 'All months', options: [...new Set(transactions.value.map((t) => monthKey(t.date)))].sort().reverse().map((m) => ({ value: m, label: monthLabel(m) })) },
    { name: 'needsReview', label: 'Only needs category review', kind: 'boolean' },
  ]);

  const reviewQueue = computed(() => spendingReviewQueue(transactions.value, period.value));
  const rows = computed(() => {
    const f = filters.value;
    const q = f.q.trim().toLowerCase();
    const source = f.needsReview ? reviewQueue.value : transactions.value;
    const list = source.filter((t) =>
      (!q || t.payee.toLowerCase().includes(q) || (t.note ?? '').toLowerCase().includes(q)) &&
      (!f.categoryId || t.categoryId === f.categoryId) &&
      (!f.accountId || t.accountId === f.accountId) &&
      (!f.month || monthKey(t.date) === f.month),
    );
    const s = sort.value;
    const dir = s.order === 'asc' ? 1 : -1;
    const keyOf = (t: Transaction): string | number =>
      s.by === 'amount' ? t.amount : s.by === 'payee' ? t.payee.toLowerCase() : s.by === 'category' ? categoryName(t.categoryId) : t.date;
    return [...list].sort((a, b) => { const x = keyOf(a), y = keyOf(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
  });
  const total = computed(() => rows.value.reduce((s, t) => s + t.amount, 0));

  const columns: Column<Transaction>[] = [
    { id: 'date', label: 'Date', kind: 'date', cell: (t) => shortDate(t.date), priority: 'primary', sortable: true },
    { id: 'payee', label: 'Payee', cell: (t) => t.payee, priority: 'primary', sortable: true },
    { id: 'category', label: 'Category', cell: (t) => categoryName(t.categoryId), sortable: true },
    { id: 'review', label: 'Review', cell: (t) => spendingReviewCause(t)?.label ?? (t.reviewedAt ? 'Reviewed' : ''), priority: 'tertiary' },
    { id: 'account', label: 'Account', cell: (t) => accountName(t.accountId), priority: 'tertiary' },
    { id: 'note', label: 'Note', cell: (t) => t.note ?? '', priority: 'tertiary' },
    { id: 'amount', label: 'Amount', kind: 'money', cell: (t) => Text({ text: money(t.amount, { sign: true }), tone: t.amount > 0 ? 'positive' : 'neutral' }), priority: 'primary', sortable: true },
  ];

  const clearFilters: Action = { id: 'clear', label: 'Clear filters', priority: 'tertiary', onSelect: () => { filters.value = emptyFilters(); } };

  return Page({
    title: 'Transactions',
    actions: [
      { id: 'add', label: 'Add transaction', priority: 'primary', onSelect: () => { editing.value = undefined; open.value = true; } },
      { id: 'review', label: 'Review categories', priority: 'secondary', onSelect: () => {
        filters.value = { ...emptyFilters(), needsReview: true };
        sort.value = { by: 'amount', order: 'asc' };
      } },
      clearFilters,
    ],
    children: [
      Section({ children: [Form<Filters>({
        fields: filterFields,
        value: filters,
        onChange: (value) => {
          if (value.needsReview && !filters.value.needsReview) sort.value = { by: 'amount', order: 'asc' };
          filters.value = value;
        },
        onSubmit: () => {},
        mode: 'live',
      })] }),
      Section({
        title: 'Results',
        children: [
          Text({
            text: computed(() => filters.value.needsReview
              ? `${rows.value.length} need category review · ${money(-total.value)} spending`
              : `${rows.value.length} transactions · net ${money(total.value, { sign: true })}`),
            role: 'note',
          }),
          Table<Transaction>({ columns, rows, rowKey: (t) => t.id, sort, onSort: (s) => { sort.value = s; }, onOpen: (t) => { editing.value = t; open.value = true; }, empty: { title: 'No transactions match these filters.', actions: [clearFilters] } }),
        ],
      }),
      TransactionDialog({ open, transaction: editing, onClose: () => { open.value = false; } }),
    ],
  });
});
