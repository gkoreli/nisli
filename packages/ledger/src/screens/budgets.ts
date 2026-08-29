import { component, signal, computed } from '@nisli/core';
import { Page, Grid, Section, Meter, Table, Text, Dialog, Form, Stat, confirm, notify, type Column, type Field } from '@nisli/engine';
import type { Budget } from '../data/model.js';
import { budgets, categories, transactions, categoryName, saveBudget, removeBudget, period, shiftPeriod } from '../data/store.js';
import { money, monthKey, monthLabel } from '../data/format.js';

interface Row { id: string; categoryId: string; category: string; limit: number; spent: number; remaining: number }
type Draft = { categoryId: string; limit: number | undefined };

export const BudgetsScreen = component('ledger-budgets', () => {
  const editing = signal<Budget | undefined>(undefined);
  const open = signal(false);
  const opens = signal(0); // one draft per opening: the engine resets on a new key

  const rows = computed<Row[]>(() =>
    budgets.value.map((b) => {
      const spent = -transactions.value.filter((t) => monthKey(t.date) === period.value && t.categoryId === b.categoryId && t.amount < 0).reduce((s, t) => s + t.amount, 0);
      return { id: b.id, categoryId: b.categoryId, category: categoryName(b.categoryId), limit: b.limit, spent, remaining: b.limit - spent };
    }).sort((a, b) => b.spent / b.limit - a.spent / a.limit),
  );
  const totalLimit = computed(() => rows.value.reduce((s, r) => s + r.limit, 0));
  const totalSpent = computed(() => rows.value.reduce((s, r) => s + r.spent, 0));
  const over = computed(() => rows.value.filter((r) => r.remaining < 0).length);

  const fields = computed<Field<Draft>[]>(() => [
    { key: 'categoryId', label: 'Category', kind: 'select', required: true, options: categories.value.filter((c) => !c.income && c.id !== 'transfer').map((c) => ({ value: c.id, label: c.name })) },
    { key: 'limit', label: 'Monthly limit', kind: 'money', required: true, min: 0 },
  ]);
  const edit = (b?: Budget) => { editing.value = b; opens.value++; open.value = true; };

  const columns: Column<Row>[] = [
    { id: 'category', header: 'Category', cell: (r) => r.category, priority: 'primary' },
    { id: 'limit', header: 'Limit', kind: 'money', cell: (r) => money(r.limit), priority: 'tertiary' },
    { id: 'spent', header: 'Spent', kind: 'money', cell: (r) => money(r.spent) },
    { id: 'remaining', header: 'Remaining', kind: 'money', cell: (r) => Text({ text: money(r.remaining, { sign: true }), tone: r.remaining < 0 ? 'negative' : r.remaining < r.limit * 0.15 ? 'warning' : 'positive' }), priority: 'primary' },
  ];

  return Page({
    title: computed(() => `Budgets · ${monthLabel(period.value)}`),
    actions: [
      { id: 'add', label: 'Add budget', priority: 'primary', onSelect: () => edit() },
      { id: 'prev', label: '‹ Previous', priority: 'secondary', onSelect: () => shiftPeriod(-1) },
      { id: 'next', label: 'Next ›', priority: 'secondary', onSelect: () => shiftPeriod(1) },
    ],
    children: [
      Grid({
        children: [
          Stat({ label: 'Budgeted', value: computed(() => money(totalLimit.value)) }),
          Stat({ label: 'Spent', value: computed(() => money(totalSpent.value)), delta: computed(() => ({ text: `${totalLimit.value ? Math.round((totalSpent.value / totalLimit.value) * 100) : 0}% of budget`, tone: totalSpent.value > totalLimit.value ? 'negative' as const : 'neutral' as const })) }),
          Stat({ label: 'Over budget', value: computed(() => String(over.value)), delta: computed(() => ({ text: over.value ? 'categories need attention' : 'all within limits', tone: over.value ? 'negative' as const : 'positive' as const })) }),
        ],
      }),
      Section({ title: 'Progress', children: computed(() => rows.value.map((r) => Meter({ label: r.category, value: r.spent, max: r.limit, detail: `${money(r.spent)} of ${money(r.limit)}` }))) }),
      Section({ title: 'All budgets', children: [Table<Row>({ columns, rows, key: (r) => r.id, onSelect: (r) => edit(budgets.value.find((b) => b.id === r.id)), empty: 'No budgets yet.' })] }),
      Dialog({
        title: computed(() => (editing.value ? 'Edit budget' : 'Add budget')),
        open, onClose: () => { open.value = false; },
        children: computed(() => [
          Form<Draft>({
            fields,
            initial: { categoryId: editing.value?.categoryId ?? '', limit: editing.value ? editing.value.limit / 100 : undefined },
            key: editing.value?.id ?? `new-${opens.value}`,
            onSubmit: (d) => { saveBudget({ id: editing.value?.id, categoryId: d.categoryId, limit: Math.round((d.limit ?? 0) * 100) }); open.value = false; notify(editing.value ? 'Budget saved' : 'Budget added', 'positive'); },
            submitLabel: editing.value ? 'Save changes' : 'Add budget', onCancel: () => { open.value = false; },
            destructive: editing.value ? { id: 'delete', label: 'Delete budget', destructive: true, onSelect: async () => {
              const b = editing.value!;
              if (!(await confirm({ title: 'Delete budget?', message: `${categoryName(b.categoryId)} · ${money(b.limit)} per month`, confirmLabel: 'Delete', destructive: true }))) return;
              removeBudget(b.id); open.value = false; notify('Budget deleted');
            } } : undefined,
          }),
        ]),
      }),
    ],
  });
});
