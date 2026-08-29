/**
 * Bank connections through the Ledger server (which talks to Plaid, or mocks
 * it). The browser never sees a Plaid secret or access token — only item ids.
 */
import type { AccountKind } from './model.js';
import { UNCATEGORIZED } from './model.js';
import { addAccount, categorize, findAccountByExternal, importTransactions, recordSync, removeTransactionsByExternalId, transactions, updateAccount } from './store.js';

export interface BankAccount {
  id: string;
  name: string;
  mask: string;
  type: string;
  subtype: string | null;
  /** Current balance as the bank reports it (dollars; positive owed for credit). */
  balance: number;
}

export interface BankItem {
  id: string;
  institution: string;
  accounts: BankAccount[];
  cursor: string | null;
  createdAt: string;
}

export interface BankTransaction {
  id: string;
  account_id: string;
  date: string;
  name: string;
  /** Plaid convention: positive = money out. */
  amount: number;
  pending: boolean;
  category?: string;
}

export interface SyncResult {
  added: BankTransaction[];
  modified: BankTransaction[];
  removed: { transaction_id: string }[];
  accounts: BankAccount[];
}

export interface BankStatus { mode: 'mock' | 'plaid'; env: string }

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & T;
  if (!res.ok) throw new Error(body.error?.message ?? `${init?.method ?? 'GET'} ${path} failed (${res.status})`);
  return body;
}
const post = <T>(path: string, body: unknown) => call<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const getBankStatus = () => call<BankStatus>('/api/bank/status');
export const createLinkToken = () => post<{ link_token?: string; mock?: boolean }>('/api/bank/link-token', {});
export const exchange = (body: { public_token: string; institution?: string } | { mock: true; institution: string }) => post<BankItem>('/api/bank/exchange', body);
export const listItems = () => call<BankItem[]>('/api/bank/items');
export const syncItem = (itemId: string) => post<SyncResult>('/api/bank/sync', { itemId });
export const removeItem = (itemId: string) => call<{ ok: true }>(`/api/bank/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' });

/** Connect a pretend institution (mock mode only). */
export const connectMock = (institution = 'Chase') => exchange({ mock: true, institution });

// ── Plaid Link (real mode) ────────────────────────────────────────────
declare global {
  interface Window {
    Plaid?: {
      create(config: {
        token: string;
        onSuccess: (public_token: string, metadata: { institution?: { name?: string } | null }) => void;
        onExit: (err: unknown) => void;
      }): { open(): void };
    };
  }
}

let linkScript: Promise<void> | null = null;
function loadLinkScript(): Promise<void> {
  if (window.Plaid) return Promise.resolve();
  linkScript ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { linkScript = null; reject(new Error('Could not load Plaid Link')); };
    document.head.appendChild(s);
  });
  return linkScript;
}

/** Open Plaid Link and resolve with the public token once the person finishes. */
export async function openPlaidLink(linkToken: string): Promise<{ public_token: string; institution: string }> {
  await loadLinkScript();
  const Plaid = window.Plaid;
  if (!Plaid) throw new Error('Plaid Link is unavailable');
  return new Promise((resolve, reject) => {
    Plaid.create({
      token: linkToken,
      onSuccess: (public_token, metadata) => resolve({ public_token, institution: metadata.institution?.name ?? 'Bank' }),
      onExit: () => reject(new Error('Link closed')),
    }).open();
  });
}

/** Connect a bank end to end: mock or real, the caller doesn't care. */
export async function connect(): Promise<BankItem> {
  const status = await getBankStatus();
  if (status.mode === 'mock') return connectMock('Chase');
  const { link_token } = await createLinkToken();
  if (!link_token) throw new Error('No link token');
  const { public_token, institution } = await openPlaidLink(link_token);
  return exchange({ public_token, institution });
}

// ── Sync into the ledger ──────────────────────────────────────────────
const kindOf = (a: BankAccount): AccountKind => {
  if (a.type === 'credit') return 'credit';
  if (a.type === 'investment' || a.type === 'brokerage') return 'investment';
  if (a.subtype === 'savings' || a.subtype === 'money market' || a.subtype === 'cd') return 'savings';
  return 'checking';
};
/** The bank's balance, signed our way (credit = negative = owed), in cents. */
const ledgerBalance = (a: BankAccount) => Math.round(a.balance * 100) * (a.type === 'credit' ? -1 : 1);

export interface ApplyResult { added: number; skipped: number; removed: number; accounts: number }

/**
 * Fold a sync result into the ledger: ensure each bank account exists here,
 * import added rows (deduped by the bank's id), drop removed ones, and keep the
 * opening balance such that opening + transactions = the bank's balance.
 */
export function applySync(item: BankItem, result: SyncResult): ApplyResult {
  let accounts = 0;
  const ledgerAccountFor = new Map<string, string>();
  for (const a of result.accounts.length ? result.accounts : item.accounts) {
    let account = findAccountByExternal(item.id, a.id);
    if (!account) {
      account = addAccount({
        name: `${a.name.toLowerCase().startsWith(item.institution.toLowerCase()) ? a.name : `${item.institution} ${a.name}`} ···${a.mask}`,
        kind: kindOf(a),
        institution: item.institution,
        opening: 0,
        external: { provider: 'plaid', itemId: item.id, accountId: a.id },
      });
      accounts++;
    }
    ledgerAccountFor.set(a.id, account.id);
  }

  const removed = removeTransactionsByExternalId(result.removed.map((r) => r.transaction_id));

  const rows = [...result.added, ...result.modified]
    .filter((t) => ledgerAccountFor.has(t.account_id))
    .map((t) => ({
      accountId: ledgerAccountFor.get(t.account_id)!,
      categoryId: categorize(t.name) ?? UNCATEGORIZED,
      date: t.date,
      amount: -Math.round(t.amount * 100),
      payee: t.name,
      note: t.pending ? 'pending' : undefined,
      externalId: t.id,
    }));
  const { added, skipped } = importTransactions(rows);

  // Reconcile: opening = bank balance − everything we hold for that account.
  for (const a of result.accounts.length ? result.accounts : item.accounts) {
    const id = ledgerAccountFor.get(a.id);
    if (!id) continue;
    const account = findAccountByExternal(item.id, a.id);
    if (!account) continue;
    const held = transactions.value.filter((t) => t.accountId === id).reduce((s, t) => s + t.amount, 0);
    const opening = ledgerBalance(a) - held;
    if (opening !== account.opening) updateAccount({ ...account, opening });
  }

  recordSync(item.id, added);
  return { added, skipped, removed, accounts };
}

/** Sync one connection: fetch from the server and apply. */
export async function sync(item: BankItem): Promise<ApplyResult> {
  return applySync(item, await syncItem(item.id));
}
