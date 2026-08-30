import { component, signal, computed } from '@nisli/core';
import { Dialog, Form, Text, confirm, notify, type Field } from '@nisli/engine';
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
  // The engine owns the draft; a new key starts it over from `initial`.
  // Editing: the transaction id. Adding: one key per opening, so a closed-and-reopened dialog is blank.
  const opens = signal(0);
  props.open.subscribe((open) => { if (open) opens.value++; });
  const draftKey = computed(() => props.transaction.value?.id ?? `new-${opens.value}`);

  const fields = computed<Field<Draft>[]>(() => {
    const bankOwned = !!props.transaction.value?.bank;
    return [
    { key: 'date', label: 'Date', kind: 'date', required: true, readOnly: bankOwned },
    { key: 'kind', label: 'Type', kind: 'select', required: true, readOnly: bankOwned, options: [{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }] },
    { key: 'amount', label: 'Amount', kind: 'money', required: true, readOnly: bankOwned, placeholder: '0.00', min: 0, step: 0.01 },
    { key: 'payee', label: 'Payee', kind: 'text', required: true, readOnly: bankOwned, placeholder: 'Who was paid' },
    { key: 'accountId', label: 'Account', kind: 'select', required: true, readOnly: bankOwned, options: accounts.value.map((a) => ({ value: a.id, label: a.name })) },
    {
      key: 'categoryId', label: 'Category', kind: 'select',
      options: (d) => categories.value.filter((c) => c.id === 'transfer' || !!c.income === (d.kind === 'income')).map((c) => ({ value: c.id, label: c.name })),
      hint: 'Left blank, a matching rule decides; otherwise Uncategorized.',
    },
    { key: 'note', label: 'Note', kind: 'textarea', placeholder: 'Optional', long: true },
    ];
  });

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
      ...(props.transaction.value?.bank ? [Text({ text: 'Date, amount, payee, and account are bank observations. You can change only your category and note; provider corrections are retained in local history.', role: 'muted' })] : []),
      Form<Draft>({
        fields,
        initial: toDraft(props.transaction.value, props.accountId.value),
        key: draftKey.value,
        onSubmit: submit,
        submitLabel: props.transaction.value ? 'Save changes' : 'Add transaction',
        onCancel: () => props.onClose.value(),
        destructive: props.transaction.value && !props.transaction.value.bank
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
