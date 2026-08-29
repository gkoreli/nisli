import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { seed } from './seed.js';
import type { Ledger } from './model.js';

vi.mock('@nisli/engine', () => ({ notify: vi.fn() }));

const KEY = 'ledger.v1';
type Call = { url: string; method: string; body?: { version: number; ledger: Ledger } };
let calls: Call[];
let handler: (c: Call) => { status: number; body: unknown } | 'network';

const json = (status: number, body: unknown) =>
  ({ ok: status < 400, status, statusText: String(status), json: async () => body }) as unknown as Response;

const stored = (l: Ledger): Ledger => ({ ...l, settings: { ...l.settings, name: 'From server' } });

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
    const server = stored(seed());
    handler = (c) => (c.method === 'GET' ? { status: 200, body: { version: 3, ledger: server } } : { status: 500, body: {} });
    const store = await loadStore();
    expect(store.settings.value.name).toBe('From server');
    expect(store.syncState.value).toBe('saved');
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem(KEY)!).settings.name).toBe('From server');
  });

  it('migrates a localStorage ledger once when the server is empty', async () => {
    const local = { ...seed(), settings: { ...seed().settings, name: 'From cache' } };
    localStorage.setItem(KEY, JSON.stringify(local));
    handler = (c) =>
      c.method === 'GET' ? { status: 200, body: { version: 0, ledger: null } } : { status: 200, body: { version: 1 } };
    const store = await loadStore();
    const puts = calls.filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0]!.body!.version).toBe(0);
    expect(puts[0]!.body!.ledger.settings.name).toBe('From cache');
    expect(store.settings.value.name).toBe('From cache');
    expect(store.lastSavedAt.value).toBeDefined();
  });

  it('applies a write at once and PUTs it with the current version after the debounce', async () => {
    handler = (c) =>
      c.method === 'GET' ? { status: 200, body: { version: 5, ledger: seed() } } : { status: 200, body: { version: 6 } };
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

  it('on 409 takes the server state and flags the conflict', async () => {
    const { notify } = await import('@nisli/engine');
    const newer = stored(seed());
    handler = (c) =>
      c.method === 'GET'
        ? { status: 200, body: { version: 1, ledger: seed() } }
        : { status: 409, body: { error: { message: 'stale' }, version: 2, ledger: newer } };
    const store = await loadStore();
    store.addCategory('Bikes');
    expect(store.categories.value.some((c) => c.id === 'bikes')).toBe(true);
    await flushAll(400);
    expect(store.syncState.value).toBe('conflict');
    expect(store.categories.value.some((c) => c.id === 'bikes')).toBe(false);
    expect(store.settings.value.name).toBe('From server');
    expect(notify).toHaveBeenCalledWith('Reloaded newer data from the server', 'warning');
    // Subsequent writes use the server's version.
    handler = () => ({ status: 200, body: { version: 3 } });
    store.addCategory('Boats');
    await flushAll(400);
    expect(calls.at(-1)!.body!.version).toBe(2);
    expect(store.syncState.value).toBe('saved');
  });

  it('goes offline on a network failure and recovers with backoff', async () => {
    let down = false;
    handler = (c) => {
      if (c.method === 'GET') return { status: 200, body: { version: 1, ledger: seed() } };
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
