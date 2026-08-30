import { component, signal, computed } from '@nisli/core';
import { Page, Grid, Stat, Section, Table, Text, Empty, type Column, type Delta } from '@nisli/engine';
import { UNCATEGORIZED, type Transaction } from '../data/model.js';
import { accounts, transactions, balance, categoryName } from '../data/store.js';
import { money, shortDate, monthKey, thisMonth } from '../data/format.js';
import { TransactionDialog } from './transaction-dialog.js';

export const AccountScreen = component<{ id: string }>('ledger-account', (props) => {
  const account = computed(() => accounts.value.find((a) => a.id === props.id.value));
  const rows = computed(() => transactions.value.filter((t) => t.accountId === props.id.value));
  const month = thisMonth();
  const flow = (sign: 1 | -1) => computed(() => rows.value.filter((t) => monthKey(t.date) === month && Math.sign(t.amount) === sign).reduce((s, t) => s + t.amount, 0));
  const uncategorized = computed(() => rows.value.filter((t) => t.categoryId === UNCATEGORIZED).length);
  const editing = signal<Transaction | undefined>(undefined);
  const open = signal(false);

  const columns: Column<Transaction>[] = [
    { id: 'date', label: 'Date', kind: 'date', cell: (t) => shortDate(t.date), priority: 'primary' },
    { id: 'payee', label: 'Payee', cell: (t) => t.payee, priority: 'primary' },
    { id: 'category', label: 'Category', cell: (t) => categoryName(t.categoryId) },
    { id: 'note', label: 'Note', cell: (t) => t.note ?? '', priority: 'tertiary' },
    { id: 'amount', label: 'Amount', kind: 'money', cell: (t) => Text({ text: money(t.amount, { sign: true }), tone: t.amount > 0 ? 'positive' : 'neutral' }), priority: 'primary' },
  ];

  return Page({
    title: computed(() => account.value?.name ?? 'Account'),
    actions: [{ id: 'add', label: 'Add transaction', priority: 'primary', onSelect: () => { editing.value = undefined; open.value = true; } }],
    children: computed(() => account.value ? [
      Grid({
        children: [
          Stat({ label: 'Balance', value: computed(() => money(balance(props.id.value))), hint: account.value!.institution }),
          Stat({ label: 'In this month', value: computed(() => money(flow(1).value)) }),
          Stat({ label: 'Out this month', value: computed(() => money(-flow(-1).value)) }),
          Stat({ label: 'Uncategorized', value: computed(() => String(uncategorized.value)), delta: computed<Delta>(() => (uncategorized.value > 0 ? { text: 'need a category or a rule', tone: 'warning' } : { text: 'all filed', tone: 'positive' })) }),
        ],
      }),
      Section({
        title: 'Transactions',
        children: [Table<Transaction>({ columns, rows, rowKey: (t) => t.id, onOpen: (t) => { editing.value = t; open.value = true; }, empty: { title: 'No transactions in this account yet.', actions: [{ id: 'add', label: 'Add transaction', onSelect: () => { editing.value = undefined; open.value = true; } }] } })],
      }),
      TransactionDialog({ open, transaction: editing, accountId: props.id.value, onClose: () => { open.value = false; } }),
    ] : [Empty({ title: 'No such account', hint: 'It may have been removed.' })]),
  });
});
