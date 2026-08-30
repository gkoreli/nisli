import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initialLedger } from './initial-ledger.js';
import type { Account, Ledger } from './model.js';

vi.mock('@nisli/engine', () => ({ notify: vi.fn() }));

const KEY = 'ledger.v2';
type Call = { url: string; method: string; body?: { version: number; ledger: Ledger } };
let calls: Call[];
let handler: (c: Call) => { status: number; body: unknown } | 'network';

const json = (status: number, body: unknown) =>
  ({ ok: status < 400, status, statusText: String(status), json: async () => body }) as unknown as Response;

const stored = (l: Ledger): Ledger => ({ ...l, settings: { ...l.settings, name: 'From server' } });
const ledgerFixture = (): Ledger => {
  const ledger = initialLedger();
  ledger.accounts = [{ id: 'checking', name: 'Checking', kind: 'checking', opening: 10_000, institution: 'Bank', currency: 'USD' }];
  ledger.transactions = [{ id: 'transaction', accountId: 'checking', categoryId: 'groceries', date: '2026-08-29', amount: -100, payee: 'Grocer' }];
  return ledger;
};

async function loadStore() {
  vi.resetModules();
  const store = await import('./store.js');
  await store.ready;
  return store;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const c: Call = { url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body as string) : undefined };
    calls.push(c);
    const r = handler(c);
    if (r === 'network') throw new TypeError('Failed to fetch');
    return json(r.status, r.body);
  }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const flushAll = async (ms: number) => { await vi.advanceTimersByTimeAsync(ms); };

describe('store as a client of the server', () => {
  it('boots from the server when it has a ledger', async () => {
    const server = stored(ledgerFixture());
    handler = (c) => (c.method === 'GET' ? { status: 200, body: { version: 3, ledger: server } } : { status: 500, body: {} });
    const store = await loadStore();
    expect(store.settings.value.name).toBe('From server');
    expect(store.syncState.value).toBe('saved');
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem(KEY)!).settings.name).toBe('From server');
  });

  it('initializes an empty server without importing an old browser cache', async () => {
    const local = { ...ledgerFixture(), settings: { ...ledgerFixture().settings, name: 'From cache' } };
    localStorage.setItem('ledger.v1', JSON.stringify(local));
    handler = (c) =>
      c.method === 'GET' ? { status: 200, body: { version: 0, ledger: null } } : { status: 200, body: { version: 1 } };
    const store = await loadStore();
    const puts = calls.filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0]!.body!.version).toBe(0);
    expect(puts[0]!.body!.ledger.accounts).toEqual([]);
    expect(puts[0]!.body!.ledger.transactions).toEqual([]);
    expect(puts[0]!.body!.ledger.budgets).toEqual([]);
    expect(puts[0]!.body!.ledger.rules).toEqual([]);
    expect(store.accounts.value).toEqual([]);
    expect(store.settings.value.name).not.toBe('From cache');
    expect(store.lastSavedAt.value).toBeDefined();
  });

  it('applies a write at once and PUTs it with the current version after the debounce', async () => {
    handler = (c) =>
      c.method === 'GET' ? { status: 200, body: { version: 5, ledger: ledgerFixture() } } : { status: 200, body: { version: 6 } };
    const store = await loadStore();
    const before = store.transactions.value.length;
    store.addTransaction({ accountId: store.accounts.value[0]!.id, categoryId: 'uncategorized', date: '2026-08-29', amount: -100, payee: 'Test' });
    expect(store.transactions.value.length).toBe(before + 1);
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(0);
    await flushAll(400);
    const puts = calls.filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0]!.body!.version).toBe(5);
    expect(puts[0]!.body!.ledger.transactions.length).toBe(before + 1);
    expect(store.syncState.value).toBe('saved');
    // The next write carries the bumped version.
    store.addCategory('Bikes');
    await flushAll(400);
    expect(calls.filter((c) => c.method === 'PUT')[1]!.body!.version).toBe(6);
  });

  it('migrates legacy bank provenance and makes account currency explicit', async () => {
    type LegacyAccount = Omit<Account, 'currency' | 'external'> & { currency?: string; external?: { provider: string; itemId: string; accountId: string } };
    type LegacyLedger = Omit<Ledger, 'accounts'> & { accounts: LegacyAccount[] };
    const legacy = ledgerFixture() as unknown as LegacyLedger;
    legacy.accounts[0] = { ...legacy.accounts[0]!, currency: undefined, external: { provider: 'plaid', itemId: 'connection-1', accountId: 'bank-account-1' } };
    legacy.transactions[0] = { ...legacy.transactions[0]!, accountId: legacy.accounts[0]!.id, externalId: 'bank-transaction-1' };
    handler = (c) => c.method === 'GET'
      ? { status: 200, body: { version: 2, ledger: legacy } }
      : { status: 500, body: {} };

    const store = await loadStore();
    expect(store.accounts.value[0]).toMatchObject({ currency: 'USD', external: { provider: 'plaid', connectionId: 'connection-1', accountId: 'bank-account-1' } });
    expect(store.transactions.value[0]!.bank).toEqual({ provider: 'plaid', connectionId: 'connection-1', transactionId: 'bank-transaction-1' });
  });

  it('on 409 replays owner edits over newer server data and retries with its version', async () => {
    const { notify } = await import('@nisli/engine');
    const newer = stored(ledgerFixture());
    handler = (c) =>
      c.method === 'GET'
        ? { status: 200, body: { version: 1, ledger: ledgerFixture() } }
        : { status: 409, body: { error: { message: 'stale' }, version: 2, ledger: newer } };
    const store = await loadStore();
    store.addCategory('Bikes');
    expect(store.categories.value.some((c) => c.id === 'bikes')).toBe(true);
    await flushAll(400);
    expect(store.syncState.value).toBe('conflict');
    expect(store.categories.value.some((c) => c.id === 'bikes')).toBe(true);
    expect(store.settings.value.name).toBe('From server');
    expect(notify).toHaveBeenCalledWith('Merged your changes with newer server data', 'warning');
    // The replay and a subsequent edit are saved together using the server version.
    handler = () => ({ status: 200, body: { version: 3 } });
    store.addCategory('Boats');
    await flushAll(400);
    expect(calls.at(-1)!.body!.version).toBe(2);
    expect(calls.at(-1)!.body!.ledger.categories.map((category) => category.id)).toEqual(expect.arrayContaining(['bikes', 'boats']));
    expect(store.syncState.value).toBe('saved');
  });

  it('replays only owner overlays while retaining a concurrent bank observation', async () => {
    handler = (c) => c.method === 'GET'
      ? { status: 200, body: { version: 1, ledger: ledgerFixture() } }
      : { status: 500, body: {} };
    const store = await loadStore();
    const base = ledgerFixture();
    base.accounts[0] = {
      ...base.accounts[0]!,
      external: { provider: 'plaid', environment: 'production', connectionId: 'bank', accountId: 'account', status: 'active' },
    };
    base.transactions[0] = {
      ...base.transactions[0]!, accountId: base.accounts[0]!.id,
      bank: { provider: 'plaid', environment: 'production', connectionId: 'bank', transactionId: 'transaction' },
    };
    const local = structuredClone(base);
    local.transactions[0] = { ...local.transactions[0]!, categoryId: 'dining', note: 'owner note', amount: 999 };
    local.categories.push({ id: 'travel', name: 'Travel' });
    const remote = structuredClone(base);
    remote.accounts[0] = { ...remote.accounts[0]!, opening: 42_000 };
    remote.transactions[0] = { ...remote.transactions[0]!, amount: -4321, payee: 'New provider name' };

    const replayed = store.replayOwnerChanges(base, local, remote);
    expect(replayed.accounts[0]!.opening).toBe(42_000);
    expect(replayed.transactions[0]).toMatchObject({ amount: -4321, payee: 'New provider name', categoryId: 'dining', note: 'owner note' });
    expect(replayed.categories).toContainEqual({ id: 'travel', name: 'Travel' });

    const providerRemoved = store.replayOwnerChanges(base, local, { ...remote, transactions: [] });
    expect(providerRemoved.transactions).toEqual([]);
  });

  it('goes offline on a network failure and recovers with backoff', async () => {
    let down = false;
    handler = (c) => {
      if (c.method === 'GET') return { status: 200, body: { version: 1, ledger: ledgerFixture() } };
      return down ? 'network' : { status: 200, body: { version: 2 } };
    };
    const store = await loadStore();
    down = true;
    store.addCategory('Bikes');
    await flushAll(400);
    expect(store.syncState.value).toBe('offline');
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
    await flushAll(2000);
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(2);
    expect(store.syncState.value).toBe('offline');
    down = false;
    await flushAll(4000);
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(3);
    expect(store.syncState.value).toBe('saved');
    expect(store.lastSavedAt.value).toBeDefined();
    expect(JSON.parse(localStorage.getItem(KEY)!).categories.some((c: { id: string }) => c.id === 'bikes')).toBe(true);
  });
});
