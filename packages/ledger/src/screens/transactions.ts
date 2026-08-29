import { component, signal, computed } from '@nisli/core';
import { Page, Section, Table, Form, Text, type Column, type Sort, type Field } from '@nisli/engine';
import { UNCATEGORIZED, type Transaction } from '../data/model.js';
import { accounts, categories, transactions, categoryName, accountName } from '../data/store.js';
import { money, shortDate } from '../data/format.js';
import { TransactionDialog } from './transaction-dialog.js';

type Filters = { q: string; categoryId: string; accountId: string; uncategorized: boolean };

export const TransactionsScreen = component('ledger-transactions', () => {
  const filters = signal<Filters>({ q: '', categoryId: '', accountId: '', uncategorized: false });
  const sort = signal<Sort>({ by: 'date', dir: 'desc' });
  const editing = signal<Transaction | undefined>(undefined);
  const open = signal(false);

  const filterFields = computed<Field<Filters>[]>(() => [
    { key: 'q', label: 'Search', kind: 'text', placeholder: 'Payee or note' },
    { key: 'categoryId', label: 'Category', kind: 'select', placeholder: 'All categories', options: categories.value.map((c) => ({ value: c.id, label: c.name })) },
    { key: 'accountId', label: 'Account', kind: 'select', placeholder: 'All accounts', options: accounts.value.map((a) => ({ value: a.id, label: a.name })) },
    { key: 'uncategorized', label: 'Filed', kind: 'checkbox', placeholder: 'Only uncategorized' },
  ]);

  const rows = computed(() => {
    const f = filters.value;
    const q = f.q.trim().toLowerCase();
    const list = transactions.value.filter((t) =>
      (!q || t.payee.toLowerCase().includes(q) || (t.note ?? '').toLowerCase().includes(q)) &&
      (!f.categoryId || t.categoryId === f.categoryId) &&
      (!f.accountId || t.accountId === f.accountId) &&
      (!f.uncategorized || t.categoryId === UNCATEGORIZED),
    );
    const s = sort.value;
    const dir = s.dir === 'asc' ? 1 : -1;
    const keyOf = (t: Transaction): string | number =>
      s.by === 'amount' ? t.amount : s.by === 'payee' ? t.payee.toLowerCase() : s.by === 'category' ? categoryName(t.categoryId) : t.date;
    return [...list].sort((a, b) => { const x = keyOf(a), y = keyOf(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
  });
  const total = computed(() => rows.value.reduce((s, t) => s + t.amount, 0));

  const columns: Column<Transaction>[] = [
    { id: 'date', header: 'Date', kind: 'date', cell: (t) => shortDate(t.date), priority: 'primary', sortable: true },
    { id: 'payee', header: 'Payee', cell: (t) => t.payee, priority: 'primary', sortable: true },
    { id: 'category', header: 'Category', cell: (t) => categoryName(t.categoryId), sortable: true },
    { id: 'account', header: 'Account', cell: (t) => accountName(t.accountId), priority: 'tertiary' },
    { id: 'note', header: 'Note', cell: (t) => t.note ?? '', priority: 'tertiary' },
    { id: 'amount', header: 'Amount', kind: 'money', cell: (t) => Text({ text: money(t.amount, { sign: true }), tone: t.amount > 0 ? 'positive' : 'neutral' }), priority: 'primary', sortable: true },
  ];

  return Page({
    title: 'Transactions',
    actions: [
      { id: 'add', label: 'Add transaction', priority: 'primary', onSelect: () => { editing.value = undefined; open.value = true; } },
      { id: 'clear', label: 'Clear filters', priority: 'tertiary', onSelect: () => { filters.value = { q: '', categoryId: '', accountId: '', uncategorized: false }; } },
    ],
    children: [
      Section({ children: [Form<Filters>({ fields: filterFields, value: filters, onChange: (v) => { filters.value = v; }, onSubmit: () => {}, mode: 'live' })] }),
      Section({
        title: computed(() => `${rows.value.length} transactions · net ${money(total.value, { sign: true })}`),
        children: [Table<Transaction>({ columns, rows, key: (t) => t.id, sort, onSort: (s) => { sort.value = s; }, onSelect: (t) => { editing.value = t; open.value = true; }, empty: 'No transactions match these filters.' })],
      }),
      TransactionDialog({ open, transaction: editing, onClose: () => { open.value = false; } }),
    ],
  });
});
