/** Bank connections through the owner-hosted Ledger server. */

export interface BankAccount {
  id: string;
  name: string;
  mask: string;
  type: string;
  subtype: string | null;
  kind: 'checking' | 'savings' | 'credit' | 'investment';
  /** Signed current balance in integer minor units. */
  balanceMinor: number;
  currency: string;
}

export interface BankConnection {
  id: string;
  provider: string;
  environment: string;
  institution: string;
  accounts: BankAccount[];
  status: 'ok' | 'reauth-required' | 'error' | 'disabled' | 'disconnect-pending';
  historyStatus?: 'TRANSACTIONS_UPDATE_STATUS_UNKNOWN' | 'NOT_READY' | 'INITIAL_UPDATE_COMPLETE' | 'HISTORICAL_UPDATE_COMPLETE';
  error?: { code: string; message: string };
  createdAt: string;
}

export interface SyncSummary {
  added: number;
  modified: number;
  unmatched: number;
  removed: number;
  accounts: number;
  inactiveAccounts?: number;
  at: string;
  historyStatus?: string;
}

export interface SyncAllResult extends Partial<SyncSummary> {
  connectionId: string;
  ok: boolean;
  error?: { code: string; message: string };
}

export interface BankStatus {
  mode: 'plaid';
  env: string;
  oauthRedirect: boolean;
  syncHour: number;
}

export interface FinancialComposition {
  accounts: { live: number; legacy: number; unowned: number };
  transactions: { live: number; legacy: number; unowned: number };
  history: number;
  legacyConfiguration: number;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } } & T;
  if (!res.ok) throw new Error(body.error?.message ?? `${init?.method ?? 'GET'} ${path} failed (${res.status})`);
  return body;
}
const post = <T>(path: string, body: unknown) => call<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const getBankStatus = () => call<BankStatus>('/api/bank/status');
export const createLinkToken = (connectionId?: string) => post<{ link_token: string }>('/api/bank/link-token', connectionId ? { connectionId } : {});
export const exchange = async (body: { public_token: string; institution?: string }): Promise<BankConnection> => {
  try {
    return await post<BankConnection>('/api/bank/exchange', body);
  } catch (error) {
    // A dropped response may follow a successful one-use token exchange. The
    // server's completion key makes this single retry return the saved connection.
    if (!(error instanceof TypeError) || !('public_token' in body)) throw error;
    return post<BankConnection>('/api/bank/exchange', body);
  }
};
export const listConnections = () => call<BankConnection[]>('/api/bank/connections');
export const getFinancialComposition = () => call<FinancialComposition>('/api/bank/composition');
export const syncConnection = (connectionId: string) => post<SyncSummary>(`/api/bank/connections/${encodeURIComponent(connectionId)}/sync`, {});
export const rebuildConnection = (connectionId: string) => post<SyncSummary>(`/api/bank/connections/${encodeURIComponent(connectionId)}/rebuild`, {});
export const syncAllItems = () => post<SyncAllResult[]>('/api/bank/sync-all', {});
export const useLiveDataOnly = () => post<SyncSummary & { connections: number; backup: string }>('/api/bank/use-live-data', {});
export const disconnectConnection = (connectionId: string) => call<{ ok: true }>(`/api/bank/connections/${encodeURIComponent(connectionId)}`, { method: 'DELETE' });

// Plaid Link is the only third-party script and is loaded only while linking.
declare global {
  interface Window {
    Plaid?: {
      create(config: {
        token: string;
        receivedRedirectUri?: string;
        onSuccess: (public_token: string | null, metadata: { institution?: { name?: string } | null }) => void;
        onExit: (err: unknown) => void;
      }): { open(): void };
    };
  }
}

let linkScript: Promise<void> | null = null;
function loadLinkScript(): Promise<void> {
  if (window.Plaid) return Promise.resolve();
  linkScript ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { linkScript = null; reject(new Error('Could not load Plaid Link')); };
    document.head.appendChild(script);
  });
  return linkScript;
}

/** Open or resume Plaid Link. Chase credentials stay on Chase's OAuth page. */
export async function openPlaidLink(linkToken: string, receivedRedirectUri?: string): Promise<{ public_token: string | null; institution: string }> {
  await loadLinkScript();
  const Plaid = window.Plaid;
  if (!Plaid) throw new Error('Plaid Link is unavailable');
  return new Promise((resolve, reject) => {
    Plaid.create({
      token: linkToken,
      ...(receivedRedirectUri ? { receivedRedirectUri } : {}),
      onSuccess: (public_token, metadata) => resolve({ public_token, institution: metadata.institution?.name ?? 'Bank' }),
      onExit: () => reject(new Error('Link closed')),
    }).open();
  });
}
