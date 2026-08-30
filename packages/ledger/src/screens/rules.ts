import { component, signal, computed } from '@nisli/core';
import { Page, Grid, Section, Stat, Table, Dialog, Form, notify, confirm, type Column, type Field } from '@nisli/engine';
import { UNCATEGORIZED, type Rule } from '../data/model.js';
import { rules, categories, transactions, categoryName, saveRule, removeRule, applyRules, addCategory } from '../data/store.js';
import { money } from '../data/format.js';

interface RuleRow { id: string; match: string; category: string; hits: number }
interface PayeeRow { payee: string; count: number; total: number }
type RuleDraft = { match: string; categoryId: string };
type CategoryDraft = { name: string; income: boolean };

export const RulesScreen = component('ledger-rules', () => {
  const editing = signal<Rule | undefined>(undefined);
  const ruleOpen = signal(false);
  const ruleOpens = signal(0); // one draft per opening: the engine resets on a new key
  const prefill = signal('');
  const categoryOpen = signal(false);
  const categoryOpens = signal(0);

  const uncategorized = computed(() => transactions.value.filter((t) => t.categoryId === UNCATEGORIZED));

  const ruleRows = computed<RuleRow[]>(() =>
    rules.value.map((r) => {
      const m = r.match.toLowerCase();
      const hits = m ? transactions.value.filter((t) => t.payee.toLowerCase().includes(m)).length : 0;
      return { id: r.id, match: r.match, category: categoryName(r.categoryId), hits };
    }),
  );

  const payeeRows = computed<PayeeRow[]>(() => {
    const byPayee = new Map<string, PayeeRow>();
    for (const t of uncategorized.value) {
      const row = byPayee.get(t.payee) ?? { payee: t.payee, count: 0, total: 0 };
      row.count++;
      row.total += t.amount;
      byPayee.set(t.payee, row);
    }
    return [...byPayee.values()].sort((a, b) => b.count - a.count);
  });

  const ruleFields = computed<Field<RuleDraft>[]>(() => [
    { name: 'match', label: 'Payee contains', kind: 'text', required: true, hint: 'Case-insensitive; matched against the payee' },
    { name: 'categoryId', label: 'Category', required: true, options: categories.value.filter((c) => c.id !== 'transfer').map((c) => ({ value: c.id, label: c.name })) },
  ]);
  const categoryFields: Field<CategoryDraft>[] = [
    { name: 'name', label: 'Name', kind: 'text', required: true },
    { name: 'income', label: 'This is income', kind: 'boolean' },
  ];

  const editRule = (r?: Rule, match = '') => {
    editing.value = r;
    prefill.value = match;
    ruleOpens.value++;
    ruleOpen.value = true;
  };
  const apply = () => {
    const n = applyRules();
    notify(`Filed ${n} transactions`, n ? 'positive' : 'neutral');
  };

  const ruleColumns: Column<RuleRow>[] = [
    { id: 'match', label: 'Matches', cell: (r) => `payee contains “${r.match}”`, priority: 'primary' },
    { id: 'category', label: 'Category', cell: (r) => r.category },
    { id: 'hits', label: 'Hits', kind: 'number', cell: (r) => r.hits, priority: 'tertiary' },
  ];
  const payeeColumns: Column<PayeeRow>[] = [
    { id: 'payee', label: 'Payee', cell: (r) => r.payee, priority: 'primary' },
    { id: 'count', label: 'Count', kind: 'number', cell: (r) => r.count },
    { id: 'total', label: 'Total', kind: 'money', cell: (r) => money(r.total, { sign: true }) },
  ];

  return Page({
    title: 'Rules',
    actions: [
      { id: 'add', label: 'Add rule', priority: 'primary', onSelect: () => editRule() },
      { id: 'apply', label: 'Apply to uncategorized', priority: 'secondary', onSelect: apply },
      { id: 'category', label: 'Add category', priority: 'tertiary', onSelect: () => { categoryOpens.value++; categoryOpen.value = true; } },
    ],
    children: [
      Grid({
        children: [
          Stat({ label: 'Rules', value: computed(() => String(rules.value.length)) }),
          Stat({ label: 'Uncategorized', value: computed(() => String(uncategorized.value.length)), hint: 'transactions without a category' }),
          Stat({ label: 'Categories', value: computed(() => String(categories.value.length)) }),
        ],
      }),
      Section({
        title: 'Rules',
        children: [Table<RuleRow>({ columns: ruleColumns, rows: ruleRows, rowKey: (r) => r.id, onOpen: (r) => editRule(rules.value.find((x) => x.id === r.id)), empty: { title: 'No rules yet', hint: 'Add one, or pick a payee below.', actions: [{ id: 'add', label: 'Add rule', onSelect: () => editRule() }] } })],
      }),
      Section({
        title: 'Uncategorized payees',
        children: [Table<PayeeRow>({ columns: payeeColumns, rows: payeeRows, rowKey: (r) => r.payee, onOpen: (r) => editRule(undefined, r.payee.toLowerCase()), empty: 'Everything is categorized.' })],
      }),
      Dialog({
        title: computed(() => (editing.value ? 'Edit rule' : 'Add rule')),
        open: ruleOpen,
        onClose: () => { ruleOpen.value = false; },
        children: computed(() => [
          Form<RuleDraft>({
            fields: ruleFields,
            initial: { match: editing.value?.match ?? prefill.value, categoryId: editing.value?.categoryId ?? '' },
            key: editing.value?.id ?? `new-${ruleOpens.value}`,
            onSubmit: (d) => {
              saveRule({ id: editing.value?.id, match: d.match.trim(), categoryId: d.categoryId });
              ruleOpen.value = false;
              notify(editing.value ? 'Rule updated' : 'Rule added', 'positive');
            },
            submitLabel: editing.value ? 'Save changes' : 'Add rule',
            onCancel: () => { ruleOpen.value = false; },
            actions: editing.value
              ? [{
                  id: 'delete', label: 'Delete rule', destructive: true,
                  onSelect: async () => {
                    const rule = editing.value!;
                    const ok = await confirm({ title: 'Delete rule?', text: `Transactions already filed under “${categoryName(rule.categoryId)}” keep their category.`, action: { label: 'Delete', destructive: true } });
                    if (!ok) return;
                    removeRule(rule.id);
                    ruleOpen.value = false;
                    notify('Rule deleted', 'neutral');
                  },
                }]
              : [],
          }),
        ]),
      }),
      Dialog({
        title: 'Add category',
        open: categoryOpen,
        onClose: () => { categoryOpen.value = false; },
        children: computed(() => [
          Form<CategoryDraft>({
            fields: categoryFields,
            initial: { name: '', income: false },
            key: categoryOpens.value,
            onSubmit: (d) => {
              addCategory(d.name.trim(), d.income);
              categoryOpen.value = false;
              notify(`Category “${d.name.trim()}” added`, 'positive');
            },
            submitLabel: 'Add category',
            onCancel: () => { categoryOpen.value = false; },
          }),
        ]),
      }),
    ],
  });
});
