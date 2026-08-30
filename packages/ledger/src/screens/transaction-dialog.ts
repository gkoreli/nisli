import { component, signal, computed } from '@nisli/core';
import { Dialog, Form, Text, confirm, notify, type Field } from '@nisli/engine';
import { UNCATEGORIZED, type Transaction } from '../data/model.js';
import { accounts, categories, addTransaction, updateTransaction, removeTransaction, categoryDecisionFor } from '../data/store.js';
import { today, money } from '../data/format.js';
import { needsSpendingReview, spendingReviewCause } from '../data/review.js';

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
  const reviewCause = computed(() => props.transaction.value ? spendingReviewCause(props.transaction.value) : undefined);

  const fields = computed<Field<Draft>[]>(() => {
    const bankOwned = !!props.transaction.value?.bank;
    return [
    { name: 'date', label: 'Date', kind: 'date', required: true, readOnly: bankOwned },
    { name: 'kind', label: 'Type', required: true, readOnly: bankOwned, options: [{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }] },
    { name: 'amount', label: 'Amount', kind: 'money', required: true, readOnly: bankOwned, placeholder: '0.00', min: 0, step: 0.01 },
    { name: 'payee', label: 'Payee', kind: 'text', required: true, readOnly: bankOwned, placeholder: 'Who was paid' },
    { name: 'accountId', label: 'Account', required: true, readOnly: bankOwned, options: accounts.value.map((a) => ({ value: a.id, label: a.name })) },
    {
      name: 'categoryId', label: 'Category',
      options: (d) => categories.value.filter((c) => c.id === 'transfer' || !!c.income === (d.kind === 'income')).map((c) => ({ value: c.id, label: c.name })),
      hint: 'Left blank, a matching rule decides; otherwise Uncategorized.',
    },
    { name: 'note', label: 'Note', placeholder: 'Optional', long: true },
    ];
  });

  const submit = (d: Draft) => {
    const amount = Math.round((d.amount ?? 0) * 100) * (d.kind === 'income' ? 1 : -1);
    const existing = props.transaction.value;
    const rule = d.categoryId ? undefined : categoryDecisionFor(d.payee);
    const categoryId = d.categoryId || rule?.categoryId || UNCATEGORIZED;
    const classification = existing && categoryId === existing.categoryId
      ? existing.classification
      : d.categoryId
        ? { source: 'owner' as const }
        : rule
          ? { source: 'rule' as const, ruleId: rule.ruleId }
          : { source: 'unassigned' as const, reason: 'no-rule-or-provider-category' as const };
    const base = {
      date: d.date, amount, payee: d.payee, accountId: d.accountId, categoryId, classification,
      note: d.note || undefined,
      ...(existing ? { reviewedAt: new Date().toISOString() } : {}),
    };
    const confirming = !!existing && needsSpendingReview(existing);
    if (existing) updateTransaction({ ...existing, ...base }); else addTransaction(base);
    props.onClose.value();
    notify(confirming ? 'Category confirmed' : existing ? 'Transaction saved' : 'Transaction added', 'positive');
  };

  return Dialog({
    title: computed(() => (props.transaction.value ? 'Edit transaction' : 'Add transaction')),
    open: props.open,
    onClose: props.onClose,
    children: computed(() => [
      ...(props.transaction.value?.bank ? [Text({ text: 'Date, amount, payee, and account are bank observations. You can change only your category and note; provider corrections are retained in local history.', role: 'note' })] : []),
      ...(reviewCause.value ? [Text({
        text: props.transaction.value?.reviewedAt
          ? `${reviewCause.value.label}. This category was reviewed; choose Review again to return it to the queue.`
          : `Category review needed: ${reviewCause.value.label}. Saving confirms the selected category while retaining its classification provenance.`,
        role: 'note',
      })] : []),
      Form<Draft>({
        fields,
        initial: toDraft(props.transaction.value, props.accountId.value),
        key: draftKey.value,
        onSubmit: submit,
        submitLabel: props.transaction.value && needsSpendingReview(props.transaction.value) ? 'Confirm category' : props.transaction.value ? 'Save changes' : 'Add transaction',
        onCancel: () => props.onClose.value(),
        actions: [
          ...(props.transaction.value && !props.transaction.value.bank ? [{ id: 'delete', label: 'Delete', destructive: true, onSelect: async () => {
              const t = props.transaction.value!;
              if (!(await confirm({ title: 'Delete transaction?', text: `${t.payee} · ${money(t.amount)}`, action: { label: 'Delete', destructive: true } }))) return;
              removeTransaction(t.id); props.onClose.value(); notify('Transaction deleted');
            } }] : []),
          ...(props.transaction.value?.reviewedAt && reviewCause.value ? [{ id: 'review-again', label: 'Review again', onSelect: () => {
            const transaction = props.transaction.value!;
            updateTransaction({ ...transaction, reviewedAt: undefined });
            props.onClose.value();
            notify('Returned to category review');
          } }] : []),
        ],
      }),
    ]),
  });
});
