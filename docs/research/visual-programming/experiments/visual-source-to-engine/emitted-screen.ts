import { computed, signal } from '@nisli/core';
import {
  Form,
  Grid,
  Page,
  Section,
  Stat,
  Table,
  type Action,
  type Column,
  type Delta,
  type Field,
} from '@nisli/engine';

type Phase = 'empty' | 'populated';

interface FileDraft {
  file: File | undefined;
  account: string;
}

interface MappingDraft {
  date: string;
  payee: string;
  amount: string;
  note: string;
}

interface Candidate {
  id: string;
  date: string;
  payee: string;
  amount: number;
  status: string;
}

const accountOptions = [
  { value: 'checking', label: 'Checking account' },
  { value: 'savings', label: 'Savings account' },
];

const columnOptions = ['Date', 'Description', 'Amount', 'Note'].map((label) => ({
  value: label,
  label,
}));

const fileFields: Field<FileDraft>[] = [
  { name: 'file', label: 'CSV file', kind: 'file', required: true, accept: '.csv,text/csv' },
  { name: 'account', label: 'Into account', required: true, options: accountOptions },
];

const mappingFields: Field<MappingDraft>[] = [
  { name: 'date', label: 'Date column', required: true, options: columnOptions },
  { name: 'payee', label: 'Payee column', required: true, options: columnOptions },
  { name: 'amount', label: 'Amount column', required: true, options: columnOptions },
  { name: 'note', label: 'Note column', options: columnOptions, placeholder: 'None' },
];

const candidates = signal<Candidate[]>([
  { id: '1', date: 'May 24', payee: 'Grocery Store', amount: -85.42, status: 'ok' },
  { id: '2', date: 'May 23', payee: 'Payroll Deposit', amount: 2300, status: 'ok' },
  { id: '3', date: 'May 22', payee: 'Electric Company', amount: -120.12, status: 'ok' },
]);

const columns: Column<Candidate>[] = [
  { id: 'date', label: 'Date', kind: 'date', priority: 'primary', cell: (row) => row.date },
  { id: 'payee', label: 'Payee', priority: 'primary', cell: (row) => row.payee },
  { id: 'amount', label: 'Amount', kind: 'money', priority: 'primary', cell: (row) => `$${row.amount.toFixed(2)}` },
  { id: 'status', label: 'Status', priority: 'secondary', cell: (row) => row.status },
];

export function EmittedImportScreen(options: { phase: Phase }) {
  const ready = computed(() => (options.phase === 'populated' ? candidates.value.length : 0));
  const problems = computed(() => 0);

  const actions = computed<Action[]>(() => ready.value === 0 ? [] : [{
    id: 'import',
    label: `Import ${ready.value} transactions`,
    priority: 'primary',
    onSelect: () => {},
  }]);

  const file = Section({
    title: '1. File',
    children: [Form<FileDraft>({
      fields: fileFields,
      initial: { file: undefined, account: '' },
      key: options.phase,
      onSubmit: () => {},
    })],
  });

  return Page({
    title: 'Import transactions',
    actions,
    children: options.phase === 'empty' ? [file] : [
      file,
      Section({
        title: '2. Columns',
        children: [Form<MappingDraft>({
          fields: mappingFields,
          initial: { date: 'Date', payee: 'Description', amount: 'Amount', note: 'Note' },
          key: 'mapping',
          mode: 'live',
          onChange: () => {},
          onSubmit: () => {},
        })],
      }),
      Section({
        title: '3. Preview',
        children: [
          Grid({ children: [
            Stat({ label: 'Rows found', value: computed(() => String(candidates.value.length)) }),
            Stat({ label: 'Ready to import', value: computed(() => String(ready.value)) }),
            Stat({
              label: 'Problems',
              value: computed(() => String(problems.value)),
              delta: computed<Delta>(() => problems.value > 0
                ? { text: 'Fix the column mapping above', tone: 'warning' }
                : { text: 'All rows parsed', tone: 'positive' }),
            }),
          ] }),
          Table<Candidate>({
            columns,
            rows: candidates,
            rowKey: (row) => row.id,
            empty: 'No rows in this file.',
          }),
        ],
      }),
    ],
  });
}
