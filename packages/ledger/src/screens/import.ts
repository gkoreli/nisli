import { component, signal, computed, untrack } from '@nisli/core';
import { Page, Section, Grid, Stat, Form, Table, Text, notify, type Field, type Column } from '@nisli/engine';
import { UNCATEGORIZED, type Transaction } from '../data/model.js';
import { accounts, categorize, categoryName, importTransactions } from '../data/store.js';
import { parseCsv, parseDate, parseAmount, type DateFormat } from '../data/csv.js';
import { money, shortDate } from '../data/format.js';

interface FileStep { file: File | undefined; accountId: string }
/** How the file states an amount: one signed column, or separate money-out / money-in columns. */
type AmountShape = 'signed' | 'split';
interface Mapping {
  date: string; dateFormat: DateFormat; payee: string; amountShape: AmountShape; amount: string;
  debit: string; credit: string; note: string; hasHeader: boolean; invert: boolean;
}
interface Candidate { id: string; date?: string; payee: string; categoryId: string; amount?: number; note?: string; status: string; ok: boolean }

const guess = (headers: string[], re: RegExp) => headers.find((h) => re.test(h)) ?? '';
/** The engine's initial draft for step 2: every guess, including the date format, is a field's starting value. */
const guessMapping = (headers: string[], firstData: string[]): Mapping => {
  const dateCol = guess(headers, /date/i);
  const sample = firstData[headers.indexOf(dateCol)] ?? '';
  const amount = guess(headers, /amount|sum/i);
  const debit = guess(headers, /debit|withdraw|out/i);
  const credit = guess(headers, /credit|deposit|in$/i);
  return {
    date: dateCol,
    dateFormat: /^\d{4}-/.test(sample) ? 'YMD' : 'DMY',
    payee: guess(headers, /payee|description|merchant|name|details/i),
    amountShape: !amount && (debit || credit) ? 'split' : 'signed',
    amount, debit, credit,
    note: guess(headers, /note|memo|category/i),
    hasHeader: true,
    invert: false,
  };
};

const differsFrom = (other: keyof Mapping, what: string) => (value: unknown, draft: Partial<Mapping>) =>
  value && value === draft[other] ? `This is already the ${what} column` : undefined;

export const ImportScreen = component('ledger-import', () => {
  const fileKey = signal(0); // a new key = a fresh, empty file step (the engine resets the draft, file input included)
  const accountId = signal(accounts.value[0]?.id ?? '');
  const rows = signal<string[][]>([]);
  const mapping = signal<Mapping | undefined>(undefined);

  const headers = computed(() => (rows.value[0] ?? []).map((h, i) => h.trim() || `Column ${i + 1}`));
  const dataRows = computed(() => (mapping.value?.hasHeader === false ? rows.value : rows.value.slice(1)));

  const loadFile = async (file: File | undefined) => {
    if (!file) { rows.value = []; mapping.value = undefined; return; }
    const parsed = parseCsv(await file.text());
    rows.value = parsed;
    const hs = (parsed[0] ?? []).map((h, i) => h.trim() || `Column ${i + 1}`);
    mapping.value = guessMapping(hs, parsed[1] ?? []);
  };

  const fileFields = computed<Field<FileStep>[]>(() => [
    { key: 'file', label: 'CSV file', kind: 'file', accept: '.csv,text/csv', required: true, hint: 'An export from your bank' },
    { key: 'accountId', label: 'Into account', kind: 'select', required: true, options: accounts.value.map((a) => ({ value: a.id, label: a.name })) },
  ]);

  const colOptions = computed(() => headers.value.map((h) => ({ value: h, label: h })));
  const signed = (d: Partial<Mapping>) => d.amountShape === 'signed';
  const split = (d: Partial<Mapping>) => d.amountShape === 'split';
  const mapFields = computed<Field<Mapping>[]>(() => [
    { key: 'date', label: 'Date column', kind: 'select', required: true, options: colOptions.value, validate: differsFrom('payee', 'payee') },
    { key: 'dateFormat', label: 'Date format', kind: 'select', required: true, options: [{ value: 'YMD', label: 'Year-Month-Day' }, { value: 'DMY', label: 'Day/Month/Year' }, { value: 'MDY', label: 'Month/Day/Year' }] },
    { key: 'payee', label: 'Payee column', kind: 'select', required: true, options: colOptions.value, validate: differsFrom('date', 'date') },
    { key: 'amountShape', label: 'Amounts are', kind: 'select', required: true, options: [{ value: 'signed', label: 'One signed column' }, { value: 'split', label: 'Money out / money in' }] },
    { key: 'amount', label: 'Amount column', kind: 'select', required: true, options: colOptions.value, when: signed, validate: differsFrom('date', 'date') },
    { key: 'debit', label: 'Money out column', kind: 'select', options: colOptions.value, placeholder: 'None', when: split, validate: differsFrom('credit', 'money in') },
    { key: 'credit', label: 'Money in column', kind: 'select', options: colOptions.value, placeholder: 'None', when: split, validate: differsFrom('debit', 'money out') },
    { key: 'note', label: 'Note column', kind: 'select', options: colOptions.value, placeholder: 'None' },
    { key: 'hasHeader', label: 'Header row', kind: 'checkbox', placeholder: 'First row is a header' },
    { key: 'invert', label: 'Sign', kind: 'checkbox', placeholder: 'Amounts are positive for money out', when: signed },
  ]);

  const candidates = computed<Candidate[]>(() => {
    const m = mapping.value;
    if (!m) return [];
    const idx = (name: string | undefined) => (name ? headers.value.indexOf(name) : -1);
    const iDate = idx(m.date), iPayee = idx(m.payee), iNote = idx(m.note);
    const iAmount = m.amountShape === 'signed' ? idx(m.amount) : -1;
    const iDebit = m.amountShape === 'split' ? idx(m.debit) : -1;
    const iCredit = m.amountShape === 'split' ? idx(m.credit) : -1;
    return dataRows.value.map((r, i) => {
      const payee = (iPayee >= 0 ? r[iPayee] : '')?.trim() ?? '';
      const date = iDate >= 0 ? parseDate(r[iDate] ?? '', m.dateFormat) : undefined;
      let amount: number | undefined;
      if (iAmount >= 0) amount = parseAmount(r[iAmount] ?? '');
      else if (iDebit >= 0 || iCredit >= 0) {
        const d = iDebit >= 0 ? parseAmount(r[iDebit] ?? '') : undefined;
        const c = iCredit >= 0 ? parseAmount(r[iCredit] ?? '') : undefined;
        amount = d === undefined && c === undefined ? undefined : Math.abs(c ?? 0) - Math.abs(d ?? 0);
      }
      if (amount !== undefined && m.invert && iAmount >= 0) amount = -amount;
      const note = iNote >= 0 ? (r[iNote] ?? '').trim() || undefined : undefined;
      const status = !date ? 'bad date' : amount === undefined ? 'bad amount' : !payee ? 'no payee' : 'ok';
      return { id: `c${i}`, date, payee, categoryId: categorize(payee) ?? UNCATEGORIZED, amount, note, status, ok: status === 'ok' };
    });
  });
  const ready = computed(() => candidates.value.filter((c) => c.ok));
  const problems = computed(() => candidates.value.length - ready.value.length);

  const columns: Column<Candidate>[] = [
    { id: 'date', header: 'Date', kind: 'date', cell: (c) => (c.date ? shortDate(c.date) : '—'), priority: 'primary' },
    { id: 'payee', header: 'Payee', cell: (c) => c.payee || '—', priority: 'primary' },
    { id: 'category', header: 'Category', cell: (c) => categoryName(c.categoryId) },
    { id: 'amount', header: 'Amount', kind: 'money', cell: (c) => (c.amount === undefined ? '—' : Text({ text: money(c.amount, { sign: true }), tone: c.amount > 0 ? 'positive' : 'neutral' })), priority: 'primary' },
    { id: 'status', header: 'Status', cell: (c) => Text({ text: c.status, tone: c.ok ? 'positive' : 'negative' }), priority: 'secondary' },
  ];

  const doImport = () => {
    const rowsToAdd: Omit<Transaction, 'id'>[] = ready.value.map((c) => ({
      accountId: accountId.value, categoryId: c.categoryId, date: c.date!, amount: c.amount!, payee: c.payee, note: c.note,
    }));
    const { added, skipped } = importTransactions(rowsToAdd);
    notify(`Imported ${added} transactions${skipped ? `, ${skipped} already present` : ''}`, 'positive');
    rows.value = [];
    mapping.value = undefined;
    fileKey.value++; // reset after import: the engine starts step 1 over
  };

  const mapped = computed(() => mapping.value !== undefined);

  const fileStep = Section({
    title: '1. File',
    children: computed(() => [Form<FileStep>({
      fields: fileFields, mode: 'live',
      initial: { file: undefined, accountId: untrack(() => accountId.value) }, key: fileKey.value,
      onChange: (v) => { accountId.value = v.accountId; void loadFile(v.file); },
      onSubmit: () => {},
    })]),
  });

  return Page({
    title: 'Import transactions',
    actions: computed(() => ready.value.length > 0
      ? [{ id: 'import', label: `Import ${ready.value.length} transactions`, priority: 'primary' as const, onSelect: doImport }]
      : []),
    children: computed(() => {
      const out = [fileStep];
      // Structure depends only on whether a mapping exists; its content is the engine's draft.
      const guessed = mapped.value ? untrack(() => mapping.value) : undefined;
      if (guessed) {
        out.push(Section({
          title: '2. Columns',
          children: [Form<Mapping>({
            fields: mapFields, mode: 'live',
            initial: guessed, key: `${fileKey.value}:${headers.value.join(' ')}`,
            onChange: (v) => { mapping.value = v; },
            onSubmit: () => {},
          })],
        }));
        out.push(Section({
          title: '3. Preview',
          children: [
            Grid({ children: [
              Stat({ label: 'Rows found', value: computed(() => String(candidates.value.length)) }),
              Stat({ label: 'Ready to import', value: computed(() => String(ready.value.length)) }),
              Stat({ label: 'Problems', value: computed(() => String(problems.value)), delta: computed(() => (problems.value ? { text: 'Fix the column mapping above', tone: 'warning' as const } : { text: 'All rows parsed', tone: 'positive' as const })) }),
            ] }),
            Table<Candidate>({ columns, rows: candidates, key: (c) => c.id, empty: 'No rows in this file.' }),
          ],
        }));
      }
      return out;
    }),
  });
});
