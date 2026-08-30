import { signal, computed, type ReadonlySignal } from '@nisli/core';
import { UNCATEGORIZED, type Account, type Budget, type Category, type Ledger, type Rule, type Settings, type Transaction } from './model.js';
import { notify } from '@nisli/engine';
import * as api from './api.js';
import { initialLedger } from './initial-ledger.js';

const KEY = 'ledger.v2';

/** Bring any stored shape up to the current model. */
function migrate(raw: Partial<Ledger>): Ledger {
  const base = initialLedger();
  const currency = raw.settings?.currency ?? base.settings.currency;
  const migratedAccounts = (raw.accounts ?? base.accounts).map((account) => {
    const external = account.external as (typeof account.external & { itemId?: string }) | undefined;
    return {
      ...account,
      currency: account.currency ?? currency,
      ...(external ? { external: {
        provider: external.provider,
        environment: external.environment,
        connectionId: external.connectionId ?? external.itemId!,
        accountId: external.accountId,
        status: external.status ?? 'active',
      } } : {}),
    };
  });
  const accountById = new Map(migratedAccounts.map((account) => [account.id, account]));
  const migratedTransactions = (raw.transactions ?? base.transactions).map((transaction) => {
    if (transaction.bank || !transaction.externalId) return transaction;
    const account = accountById.get(transaction.accountId);
    return account?.external ? {
      ...transaction,
      bank: {
        provider: account.external.provider,
        environment: account.external.environment,
        connectionId: account.external.connectionId,
        transactionId: transaction.externalId,
      },
    } : transaction;
  });
  const l: Ledger = {
    accounts: migratedAccounts,
    categories: raw.categories ?? base.categories,
    transactions: migratedTransactions,
    budgets: raw.budgets ?? base.budgets,
    rules: raw.rules ?? [],
    settings: { ...base.settings, appearance: 'system', ...(raw.settings ?? {}) },
    sync: raw.sync ?? {},
    bankHistory: raw.bankHistory ?? [],
    pendingBankRebuild: raw.pendingBankRebuild ?? [],
  };
  if (!l.categories.some((c) => c.id === UNCATEGORIZED)) l.categories = [...l.categories, { id: UNCATEGORIZED, name: 'Uncategorized' }];
  return l;
}

const readCache = (): Ledger | undefined => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) return migrate(JSON.parse(raw) as Partial<Ledger>);
  } catch { /* no usable cache */ }
  return undefined;
};
const writeCache = (l: Ledger) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* storage unavailable */ } };

const state = signal<Ledger>(readCache() ?? initialLedger());
let acknowledged = structuredClone(state.value);
let version = 0;
let pending: { timer: ReturnType<typeof setTimeout> | undefined; retry: number; inflight: boolean; dirty: boolean } =
  { timer: undefined, retry: 0, inflight: false, dirty: false };

const DEBOUNCE = 400;
const BACKOFF = [2000, 4000, 8000, 16000, 30000];

const _syncState = signal<'saved' | 'saving' | 'offline' | 'conflict'>('saved');
const _lastSavedAt = signal<string | undefined>(undefined);
/** Where the browser stands against the server. */
export const syncState: ReadonlySignal<'saved' | 'saving' | 'offline' | 'conflict'> = _syncState;
export const lastSavedAt: ReadonlySignal<string | undefined> = _lastSavedAt;

/** Take the server's state as truth (after a 409 or a reload). */
const adopt = (l: Ledger, v: number) => {
  state.value = migrate(l);
  acknowledged = structuredClone(state.value);
  version = v;
  pending.dirty = false;
  writeCache(state.value);
};

async function flush(): Promise<void> {
  if (pending.inflight) { pending.dirty = true; return; }
  if (!pending.dirty) return;
  pending.inflight = true;
  pending.dirty = false;
  _syncState.value = 'saving';
  const snapshot = state.value;
  try {
    const { version: v, ledger: saved } = await api.putLedger(version, snapshot);
    const accepted = migrate(saved ?? snapshot);
    const localAfterSave = state.value;
    version = v;
    acknowledged = structuredClone(accepted);
    if (pending.dirty) {
      state.value = replayOwnerChanges(snapshot, localAfterSave, accepted);
      pending.dirty = !same(state.value, accepted);
    } else {
      state.value = accepted;
    }
    pending.retry = 0;
    writeCache(state.value);
    _lastSavedAt.value = new Date().toISOString();
    _syncState.value = 'saved';
    pending.inflight = false;
    if (pending.dirty) schedule();
  } catch (e) {
    pending.inflight = false;
    if (e instanceof api.ConflictError) {
      const local = state.value;
      const base = acknowledged;
      pending.retry = 0;
      if (e.ledger) {
        const remote = migrate(e.ledger);
        const replayed = replayOwnerChanges(base, local, remote);
        adopt(remote, e.version);
        if (JSON.stringify(replayed) !== JSON.stringify(remote)) {
          state.value = replayed;
          pending.dirty = true;
          writeCache(replayed);
          schedule();
        }
      } else {
        version = e.version;
        pending.dirty = true;
        schedule();
      }
      _syncState.value = 'conflict';
      notify('Merged your changes with newer server data', 'warning');
      return;
    }
    _syncState.value = 'offline';
    pending.dirty = true;
    const wait = BACKOFF[Math.min(pending.retry, BACKOFF.length - 1)]!;
    pending.retry++;
    clearTimeout(pending.timer);
    pending.timer = setTimeout(() => { void flush(); }, wait);
  }
}

const schedule = () => {
  clearTimeout(pending.timer);
  pending.timer = setTimeout(() => { void flush(); }, DEBOUNCE);
};

/** Apply locally at once; the server catches up. */
const persist = (next: Ledger) => {
  state.value = next;
  writeCache(next);
  pending.dirty = true;
  schedule();
};

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const replayCollection = <T extends { id: string }>(
  base: T[],
  local: T[],
  remote: T[],
  options: { preserveRemote?: (value: T) => boolean; merge?: (current: T, desired: T) => T } = {},
): T[] => {
  const before = new Map(base.map((value) => [value.id, value]));
  const desired = new Map(local.map((value) => [value.id, value]));
  const out = new Map(remote.map((value) => [value.id, value]));
  for (const [id, value] of desired) {
    const original = before.get(id);
    if (!original || !same(original, value)) {
      const current = out.get(id);
      // A missing server-owned row means the provider removed it while the
      // owner was editing. Never resurrect it, and never replay newly forged
      // provenance into the client projection.
      if (!current && options.preserveRemote?.(value)) continue;
      if (current && options.preserveRemote?.(current)) out.set(id, options.merge?.(current, value) ?? current);
      else out.set(id, value);
    }
  }
  for (const id of before.keys()) {
    if (desired.has(id)) continue;
    const current = out.get(id);
    if (!current || !options.preserveRemote?.(current)) out.delete(id);
  }
  return [...out.values()];
};

/** Replay owner changes over a newer server projection after a version conflict. */
export function replayOwnerChanges(base: Ledger, local: Ledger, remote: Ledger): Ledger {
  return {
    ...remote,
    accounts: replayCollection(base.accounts, local.accounts, remote.accounts, {
      preserveRemote: (account) => !!account.external,
    }),
    categories: replayCollection(base.categories, local.categories, remote.categories),
    transactions: replayCollection(base.transactions, local.transactions, remote.transactions, {
      preserveRemote: (transaction) => !!transaction.bank,
      merge: (current, desired) => ({ ...current, categoryId: desired.categoryId, note: desired.note }),
    }),
    budgets: replayCollection(base.budgets, local.budgets, remote.budgets),
    rules: replayCollection(base.rules, local.rules, remote.rules),
    settings: same(base.settings, local.settings) ? remote.settings : local.settings,
    sync: remote.sync,
    bankHistory: remote.bankHistory,
    pendingBankRebuild: remote.pendingBankRebuild,
  };
}

/** Make pending owner edits durable before an explicit server-side command. */
export async function flushNow(): Promise<void> {
  clearTimeout(pending.timer);
  for (let attempt = 0; attempt < 3; attempt++) {
    while (pending.inflight) await new Promise((resolve) => setTimeout(resolve, 10));
    if (!pending.dirty) break;
    await flush();
  }
  while (pending.inflight) await new Promise((resolve) => setTimeout(resolve, 10));
  if (pending.dirty || _syncState.value === 'offline') {
    throw new Error('Ledger could not save your pending changes; wait for it to reconnect before changing bank data.');
  }
}

async function boot(): Promise<void> {
  try {
    const { version: v, ledger } = await api.getLedger();
    if (ledger) { adopt(ledger, v); return; }
    // The server is the only authority. Never bootstrap it from a browser
    // cache: ledger.v1 could contain the retired sample ledger, and even a
    // genuine cache is not evidence that this empty server owns those facts.
    const first = initialLedger();
    state.value = first;
    version = v;
    try {
      const r = await api.putLedger(v, first);
      version = r.version;
      writeCache(first);
      _lastSavedAt.value = new Date().toISOString();
    } catch (e) {
      if (e instanceof api.ConflictError) { if (e.ledger) adopt(e.ledger, e.version); return; }
      _syncState.value = 'offline';
      schedule();
    }
  } catch {
    // Server unreachable: run from the cache and keep trying once something changes.
    _syncState.value = 'offline';
  }
}

/** Resolves once the authoritative server boot has finished. */
export const ready: Promise<void> = boot();

/** Drop local state for the server's. */
export const reloadFromServer = async (): Promise<void> => {
  const { version: v, ledger } = await api.getLedger();
  if (ledger) adopt(ledger, v); else version = v;
  _syncState.value = 'saved';
};

/** Adopt a ledger the server just restored from a backup. */
export const applyRestored = (ledger: Ledger, v: number): void => {
  adopt(ledger, v);
  _lastSavedAt.value = new Date().toISOString();
  _syncState.value = 'saved';
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

export const categoryDecisionFor = (payee: string): { categoryId: string; ruleId: string } | undefined => {
  const p = payee.toLowerCase();
  const rule = rules.value.find((candidate) => candidate.match && p.includes(candidate.match.toLowerCase()));
  return rule ? { categoryId: rule.categoryId, ruleId: rule.id } : undefined;
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
export const findAccountByExternal = (connectionId: string, accountId: string): Account | undefined =>
  state.value.accounts.find((account) => account.external?.connectionId === connectionId && account.external.accountId === accountId);

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
    const decision = categoryDecisionFor(t.payee);
    if (!decision) return t;
    n++;
    return { ...t, categoryId: decision.categoryId, classification: { source: 'rule' as const, ruleId: decision.ruleId } };
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

export const exportBackup = (): string => JSON.stringify(state.value, null, 2);
export const importBackup = (json: string): Ledger => {
  const parsed = JSON.parse(json) as Partial<Ledger>;
  if (!Array.isArray(parsed.transactions) || !Array.isArray(parsed.accounts)) throw new Error('Not a Ledger backup.');
  const next = migrate(parsed);
  persist(next);
  return next;
};
