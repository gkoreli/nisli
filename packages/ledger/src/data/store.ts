import { signal, computed, type ReadonlySignal } from '@nisli/core';
import { UNCATEGORIZED, type Account, type Budget, type Category, type Ledger, type Rule, type Settings, type Transaction } from './model.js';
import { seed } from './seed.js';

const KEY = 'ledger.v1';

/** Bring any stored shape up to the current model. */
function migrate(raw: Partial<Ledger>): Ledger {
  const base = seed();
  const l: Ledger = {
    accounts: raw.accounts ?? base.accounts,
    categories: raw.categories ?? base.categories,
    transactions: raw.transactions ?? base.transactions,
    budgets: raw.budgets ?? base.budgets,
    rules: raw.rules ?? [],
    settings: { ...base.settings, appearance: 'system', ...(raw.settings ?? {}) },
    sync: raw.sync ?? {},
  };
  if (!l.categories.some((c) => c.id === UNCATEGORIZED)) l.categories = [...l.categories, { id: UNCATEGORIZED, name: 'Uncategorized' }];
  return l;
}

function load(): Ledger {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) return migrate(JSON.parse(raw) as Partial<Ledger>);
  } catch { /* fall through to seed */ }
  return seed();
}

const state = signal<Ledger>(load());
const persist = (next: Ledger) => {
  state.value = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
};
const patch = (p: Partial<Ledger>) => persist({ ...state.value, ...p });
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const byDateDesc = (a: Transaction, b: Transaction) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

export const accounts: ReadonlySignal<Account[]> = computed(() => state.value.accounts);
export const categories: ReadonlySignal<Category[]> = computed(() => state.value.categories);
export const transactions: ReadonlySignal<Transaction[]> = computed(() => state.value.transactions);
export const budgets: ReadonlySignal<Budget[]> = computed(() => state.value.budgets);
export const rules: ReadonlySignal<Rule[]> = computed(() => state.value.rules);
export const settings: ReadonlySignal<Settings> = computed(() => state.value.settings);
/** Last sync per bank connection: `{ [itemId]: { at, added } }`. */
export const lastSync: ReadonlySignal<Record<string, { at: string; added: number }>> = computed(() => state.value.sync ?? {});
export const recordSync = (itemId: string, added: number) =>
  patch({ sync: { ...(state.value.sync ?? {}), [itemId]: { at: new Date().toISOString(), added } } });

/** The month the reports look at (YYYY-MM). Not persisted. */
export const period = signal(new Date().toISOString().slice(0, 7));
export const shiftPeriod = (months: number) => {
  const [y, m] = period.value.split('-').map(Number);
  const d = new Date(y!, m! - 1 + months, 1);
  period.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const categoryName = (id: string) => categories.value.find((c) => c.id === id)?.name ?? id;
export const accountName = (id: string) => accounts.value.find((a) => a.id === id)?.name ?? id;

export const balance = (accountId: string) =>
  (accounts.value.find((a) => a.id === accountId)?.opening ?? 0) +
  transactions.value.filter((t) => t.accountId === accountId).reduce((s, t) => s + t.amount, 0);

/** The category a rule gives a payee, or undefined. */
export const categorize = (payee: string): string | undefined => {
  const p = payee.toLowerCase();
  return rules.value.find((r) => r.match && p.includes(r.match.toLowerCase()))?.categoryId;
};

export const addTransaction = (t: Omit<Transaction, 'id'>) =>
  patch({ transactions: [{ ...t, id: uid() }, ...state.value.transactions].sort(byDateDesc) });
export const updateTransaction = (t: Transaction) =>
  patch({ transactions: state.value.transactions.map((x) => (x.id === t.id ? t : x)).sort(byDateDesc) });
export const removeTransaction = (id: string) => patch({ transactions: state.value.transactions.filter((x) => x.id !== id) });

/** Bulk import; rows already present (same bank id, else same account, date, amount, payee) are skipped. */
export const importTransactions = (rows: Omit<Transaction, 'id'>[]): { added: number; skipped: number } => {
  const key = (t: Omit<Transaction, 'id'>) =>
    t.externalId ? `ext|${t.externalId}` : `${t.accountId}|${t.date}|${t.amount}|${t.payee.trim().toLowerCase()}`;
  const existing = new Set(state.value.transactions.map(key));
  const fresh: Transaction[] = [];
  let skipped = 0;
  for (const r of rows) {
    const k = key(r);
    if (existing.has(k)) { skipped++; continue; }
    existing.add(k);
    fresh.push({ ...r, id: uid() });
  }
  patch({ transactions: [...fresh, ...state.value.transactions].sort(byDateDesc) });
  return { added: fresh.length, skipped };
};

export const removeTransactionsByExternalId = (ids: string[]): number => {
  const gone = new Set(ids);
  const keep = state.value.transactions.filter((t) => !t.externalId || !gone.has(t.externalId));
  const n = state.value.transactions.length - keep.length;
  if (n) patch({ transactions: keep });
  return n;
};

export const addAccount = (a: Omit<Account, 'id'>): Account => {
  const account = { ...a, id: uid() };
  patch({ accounts: [...state.value.accounts, account] });
  return account;
};
export const updateAccount = (a: Account) => patch({ accounts: state.value.accounts.map((x) => (x.id === a.id ? a : x)) });
/** Remove an account and everything in it. */
export const removeAccount = (id: string) =>
  patch({ accounts: state.value.accounts.filter((a) => a.id !== id), transactions: state.value.transactions.filter((t) => t.accountId !== id) });
export const findAccountByExternal = (itemId: string, accountId: string): Account | undefined =>
  state.value.accounts.find((a) => a.external?.itemId === itemId && a.external.accountId === accountId);

export const saveBudget = (b: Omit<Budget, 'id'> & { id?: string }) =>
  patch({
    budgets: b.id
      ? state.value.budgets.map((x) => (x.id === b.id ? { ...x, ...b, id: b.id! } : x))
      : [...state.value.budgets, { ...b, id: uid() }],
  });
export const removeBudget = (id: string) => patch({ budgets: state.value.budgets.filter((x) => x.id !== id) });

export const saveRule = (r: Omit<Rule, 'id'> & { id?: string }) =>
  patch({ rules: r.id ? state.value.rules.map((x) => (x.id === r.id ? { ...x, ...r, id: r.id! } : x)) : [...state.value.rules, { ...r, id: uid() }] });
export const removeRule = (id: string) => patch({ rules: state.value.rules.filter((x) => x.id !== id) });
/** Re-file every uncategorized transaction the rules now cover. Returns how many changed. */
export const applyRules = (): number => {
  let n = 0;
  const next = state.value.transactions.map((t) => {
    if (t.categoryId !== UNCATEGORIZED) return t;
    const c = categorize(t.payee);
    if (!c) return t;
    n++;
    return { ...t, categoryId: c };
  });
  if (n) patch({ transactions: next });
  return n;
};

export const addCategory = (name: string, income = false) => {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uid();
  if (state.value.categories.some((c) => c.id === id)) return id;
  patch({ categories: [...state.value.categories, { id, name, income: income || undefined }] });
  return id;
};

export const saveSettings = (s: Settings) => patch({ settings: s });
export const resetToSeed = () => persist(seed());

export const exportBackup = (): string => JSON.stringify(state.value, null, 2);
export const importBackup = (json: string): Ledger => {
  const parsed = JSON.parse(json) as Partial<Ledger>;
  if (!Array.isArray(parsed.transactions) || !Array.isArray(parsed.accounts)) throw new Error('Not a Ledger backup.');
  const next = migrate(parsed);
  persist(next);
  return next;
};
