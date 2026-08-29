import { component, signal, computed } from '@nisli/core';
import { Page, Section, Grid, Stat, Form, Table, Text, notify, type Field, type Column } from '@nisli/engine';
import { UNCATEGORIZED, type Transaction } from '../data/model.js';
import { accounts, categorize, categoryName, importTransactions } from '../data/store.js';
import { parseCsv, parseDate, parseAmount, type DateFormat } from '../data/csv.js';
import { money, shortDate } from '../data/format.js';

interface FileStep { file: File | undefined; accountId: string }
interface Mapping {
  date: string; dateFormat: DateFormat; payee: string; amount: string;
  debit: string; credit: string; note: string; hasHeader: boolean; invert: boolean;
}
interface Candidate { id: string; date?: string; payee: string; categoryId: string; amount?: number; note?: string; status: string; ok: boolean }

const guess = (headers: string[], re: RegExp) => headers.find((h) => re.test(h)) ?? '';
const guessMapping = (headers: string[], firstData: string[]): Mapping => {
  const dateCol = guess(headers, /date/i);
  const sample = firstData[headers.indexOf(dateCol)] ?? '';
  return {
    date: dateCol,
    dateFormat: /^\d{4}-/.test(sample) ? 'YMD' : 'DMY',
    payee: guess(headers, /payee|description|merchant|name|details/i),
    amount: guess(headers, /amount|sum/i),
    debit: guess(headers, /debit|withdraw|out/i),
    credit: guess(headers, /credit|deposit|in$/i),
    note: guess(headers, /note|memo|category/i),
    hasHeader: true,
    invert: false,
  };
};

export const ImportScreen = component('ledger-import', () => {
  const step1 = signal<FileStep>({ file: undefined, accountId: accounts.value[0]?.id ?? '' });
  const rows = signal<string[][]>([]);
  const mapping = signal<Mapping | undefined>(undefined);
  const fileKey = signal(0); // bumps to remount the file form after import

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
  const mapFields = computed<Field<Mapping>[]>(() => [
    { key: 'date', label: 'Date column', kind: 'select', required: true, options: colOptions.value },
    { key: 'dateFormat', label: 'Date format', kind: 'select', required: true, options: [{ value: 'YMD', label: 'Year-Month-Day' }, { value: 'DMY', label: 'Day/Month/Year' }, { value: 'MDY', label: 'Month/Day/Year' }] },
    { key: 'payee', label: 'Payee column', kind: 'select', required: true, options: colOptions.value },
    { key: 'amount', label: 'Amount column', kind: 'select', options: colOptions.value, placeholder: 'None', hint: 'One signed column' },
    { key: 'debit', label: 'Money out column', kind: 'select', options: colOptions.value, placeholder: 'None', hint: 'Or separate money-out / money-in columns' },
    { key: 'credit', label: 'Money in column', kind: 'select', options: colOptions.value, placeholder: 'None' },
    { key: 'note', label: 'Note column', kind: 'select', options: colOptions.value, placeholder: 'None' },
    { key: 'hasHeader', label: 'Header row', kind: 'checkbox', placeholder: 'First row is a header' },
    { key: 'invert', label: 'Sign', kind: 'checkbox', placeholder: 'Amounts are positive for money out' },
  ]);

  const candidates = computed<Candidate[]>(() => {
    const m = mapping.value;
    if (!m) return [];
    const idx = (name: string) => headers.value.indexOf(name);
    const iDate = idx(m.date), iPayee = idx(m.payee), iAmount = idx(m.amount), iDebit = idx(m.debit), iCredit = idx(m.credit), iNote = idx(m.note);
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
    const accountId = step1.value.accountId;
    const rowsToAdd: Omit<Transaction, 'id'>[] = ready.value.map((c) => ({
      accountId, categoryId: c.categoryId, date: c.date!, amount: c.amount!, payee: c.payee, note: c.note,
    }));
    const { added, skipped } = importTransactions(rowsToAdd);
    notify(`Imported ${added} transactions${skipped ? `, ${skipped} already present` : ''}`, 'positive');
    rows.value = [];
    mapping.value = undefined;
    step1.value = { ...step1.value, file: undefined };
    fileKey.value++;
  };

  return Page({
    title: 'Import transactions',
    actions: computed(() => ready.value.length > 0
      ? [{ id: 'import', label: `Import ${ready.value.length} transactions`, priority: 'primary' as const, onSelect: doImport }]
      : []),
    children: computed(() => {
      void fileKey.value;
      const out = [
        Section({
          title: '1. File',
          children: [Form<FileStep>({
            fields: fileFields, value: step1, mode: 'live',
            onChange: (v) => { const changed = v.file !== step1.value.file; step1.value = v; if (changed) void loadFile(v.file); },
            onSubmit: () => {},
          })],
        }),
      ];
      if (mapping.value) {
        out.push(Section({
          title: '2. Columns',
          children: [Form<Mapping>({ fields: mapFields, value: mapping as unknown as Mapping, mode: 'live', onChange: (v) => { mapping.value = v; }, onSubmit: () => {} })],
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
