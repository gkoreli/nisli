import { component, signal, computed } from '@nisli/core';
import { Dialog, Form, confirm, notify, type Field } from '@nisli/engine';
import { UNCATEGORIZED, type Transaction } from '../data/model.js';
import { accounts, categories, addTransaction, updateTransaction, removeTransaction, categorize } from '../data/store.js';
import { today, money } from '../data/format.js';

/** The form's shape: what a person fills in, not what is stored. */
interface Draft {
  date: string;
  kind: 'expense' | 'income';
  amount: number | undefined;
  payee: string;
  accountId: string;
  categoryId: string;
  note: string;
}

export interface TransactionDialogProps {
  open: boolean;
  /** Editing an existing row, or adding (undefined). */
  transaction: Transaction | undefined;
  /** Preselected account for new rows. */
  accountId?: string;
  onClose: () => void;
}

const toDraft = (t: Transaction | undefined, accountId?: string): Draft => ({
  date: t?.date ?? today(),
  kind: t && t.amount > 0 ? 'income' : 'expense',
  amount: t ? Math.abs(t.amount) / 100 : undefined,
  payee: t?.payee ?? '',
  accountId: t?.accountId ?? accountId ?? accounts.value[0]?.id ?? '',
  categoryId: t?.categoryId ?? '',
  note: t?.note ?? '',
});

export const TransactionDialog = component<TransactionDialogProps>('ledger-transaction-dialog', (props) => {
  const draft = signal<Draft>(toDraft(undefined));
  // Re-seed the draft whenever the dialog opens.
  computed(() => { if (props.open.value) draft.value = toDraft(props.transaction.value, props.accountId.value); }).value;
  const reseed = computed(() => props.open.value && props.transaction.value);
  reseed.subscribe(() => { if (props.open.value) draft.value = toDraft(props.transaction.value, props.accountId.value); });

  const fields = computed<Field<Draft>[]>(() => [
    { key: 'date', label: 'Date', kind: 'date', required: true },
    { key: 'kind', label: 'Type', kind: 'select', required: true, options: [{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }] },
    { key: 'amount', label: 'Amount', kind: 'money', required: true, placeholder: '0.00' },
    { key: 'payee', label: 'Payee', kind: 'text', required: true, placeholder: 'Who was paid' },
    { key: 'accountId', label: 'Account', kind: 'select', required: true, options: accounts.value.map((a) => ({ value: a.id, label: a.name })) },
    { key: 'categoryId', label: 'Category', kind: 'select', options: categories.value.map((c) => ({ value: c.id, label: c.name })), hint: 'Left blank, a matching rule decides; otherwise Uncategorized.' },
    { key: 'note', label: 'Note', kind: 'textarea', placeholder: 'Optional' },
  ]);

  const submit = (d: Draft) => {
    const amount = Math.round((d.amount ?? 0) * 100) * (d.kind === 'income' ? 1 : -1);
    const base = { date: d.date, amount, payee: d.payee, accountId: d.accountId, categoryId: d.categoryId || categorize(d.payee) || UNCATEGORIZED, note: d.note || undefined };
    const existing = props.transaction.value;
    if (existing) updateTransaction({ ...existing, ...base }); else addTransaction(base);
    props.onClose.value();
    notify(existing ? 'Transaction saved' : 'Transaction added', 'positive');
  };

  return Dialog({
    title: computed(() => (props.transaction.value ? 'Edit transaction' : 'Add transaction')),
    open: props.open,
    onClose: props.onClose,
    children: computed(() => [
      Form<Draft>({
        fields: fields.value,
        value: draft,
        onChange: (v) => { draft.value = v; },
        onSubmit: submit,
        submitLabel: props.transaction.value ? 'Save changes' : 'Add transaction',
        onCancel: () => props.onClose.value(),
        destructive: props.transaction.value
          ? { id: 'delete', label: 'Delete', destructive: true, onSelect: async () => {
              const t = props.transaction.value!;
              if (!(await confirm({ title: 'Delete transaction?', message: `${t.payee} · ${money(t.amount)}`, confirmLabel: 'Delete', destructive: true }))) return;
              removeTransaction(t.id); props.onClose.value(); notify('Transaction deleted');
            } }
          : undefined,
      }),
    ]),
  });
});
