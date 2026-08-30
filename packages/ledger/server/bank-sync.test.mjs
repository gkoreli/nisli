import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectBankSync, shouldRunDaily } from './bank-sync.mjs';
import { financialComposition, mergeOwnerLedgerWrite } from './banking/domain.mjs';
import { plaidProvider } from './providers/plaid.mjs';

const ledger = () => ({
  accounts: [],
  categories: [{ id: 'uncategorized', name: 'Uncategorized' }, { id: 'food', name: 'Food' }],
  transactions: [], budgets: [], rules: [{ id: 'r1', match: 'coffee', categoryId: 'food' }],
  settings: { name: 'Owner', currency: 'USD', locale: 'en-US' }, sync: {},
});
const item = {
  id: 'item-1', provider: 'plaid', environment: 'sandbox', institution: 'Chase', status: 'ok', checkpoint: null, createdAt: '2026-08-29T00:00:00.000Z',
  accounts: [{ id: 'bank-checking', name: 'Chase Total Checking', mask: '1234', kind: 'checking', type: 'depository', subtype: 'checking', balanceMinor: 10_000, currency: 'USD' }],
};
const result = (transactions, extra = {}) => ({
  added: transactions, modified: [], removed: [], accounts: item.accounts, checkpoint: 'cursor-1', complete: true,
  updateStatus: 'HISTORICAL_UPDATE_COMPLETE', historyReady: true, ...extra,
});

describe('server-owned bank sync fold', () => {
  it('creates accounts, applies rules, signs cents, and reconciles the balance', () => {
    let id = 0;
    const applied = projectBankSync(ledger(), item, result([
      { id: 'pending-1', accountId: 'bank-checking', bookedOn: '2026-08-28', description: 'Blue Bottle Coffee', amountMinor: -1234, currency: 'USD', pending: true },
    ]), { createId: () => `id-${++id}`, now: () => '2026-08-29T13:00:00.000Z' });

    expect(applied.summary).toMatchObject({ added: 1, accounts: 1 });
    expect(applied.ledger.transactions[0]).toMatchObject({ amount: -1234, categoryId: 'food', note: 'pending', bank: { provider: 'plaid', connectionId: 'item-1', transactionId: 'pending-1' } });
    expect(applied.ledger.accounts[0].opening).toBe(11_234);
    expect(applied.ledger.sync['item-1']).toEqual({ at: '2026-08-29T13:00:00.000Z', added: 1 });
  });

  it('replaces a pending transaction without losing its category or local identity', () => {
    const first = projectBankSync(ledger(), item, result([
      { id: 'pending-1', accountId: 'bank-checking', bookedOn: '2026-08-28', description: 'Coffee', amountMinor: -1000, currency: 'USD', pending: true },
    ]), { createId: () => 'stable-id' }).ledger;
    first.transactions[0].categoryId = 'food';
    const posted = projectBankSync(first, item, result([
      { id: 'posted-1', accountId: 'bank-checking', bookedOn: '2026-08-29', description: 'Coffee', amountMinor: -1000, currency: 'USD', pending: false, replacesId: 'pending-1' },
    ]), { createId: () => 'wrong-id' });

    expect(posted.ledger.transactions).toHaveLength(1);
    expect(posted.ledger.transactions[0]).toMatchObject({ id: 'stable-id', bank: { transactionId: 'posted-1' }, categoryId: 'food' });
    expect(posted.ledger.bankHistory).toEqual([
      expect.objectContaining({ change: 'replaced', transactionId: 'pending-1', replacementId: 'posted-1', transaction: expect.objectContaining({ id: 'stable-id' }) }),
    ]);
  });

  it('removes provider-deleted transactions', () => {
    const first = projectBankSync(ledger(), item, result([
      { id: 'gone', accountId: 'bank-checking', bookedOn: '2026-08-28', description: 'Coffee', amountMinor: -1000, currency: 'USD', pending: false },
    ]), { createId: () => 'local-id' }).ledger;
    const removed = projectBankSync(first, item, result([], { removed: ['gone'] }));
    expect(removed.summary.removed).toBe(1);
    expect(removed.ledger.transactions).toHaveLength(0);
    expect(removed.ledger.bankHistory.at(-1)).toMatchObject({ change: 'removed', transactionId: 'gone', transaction: { id: 'local-id' } });
  });

  it('rebuilds a complete projection while preserving local identity, category, and note', () => {
    const first = projectBankSync(ledger(), item, result([
      { id: 'keep', accountId: 'bank-checking', bookedOn: '2026-08-20', description: 'Coffee', amountMinor: -800, currency: 'USD', pending: false },
      { id: 'stale', accountId: 'bank-checking', bookedOn: '2026-08-19', description: 'Old', amountMinor: -500, currency: 'USD', pending: false },
    ]), { createId: (() => { let n = 0; return () => `id-${++n}`; })() }).ledger;
    const keep = first.transactions.find((transaction) => transaction.bank?.transactionId === 'keep');
    keep.categoryId = 'food';
    keep.note = 'owner note';

    const rebuilt = projectBankSync(first, item, result([
      { id: 'keep', accountId: 'bank-checking', bookedOn: '2026-08-21', description: 'Coffee Shop', amountMinor: -900, currency: 'USD', pending: false },
    ]), { rebuild: true, createId: () => 'wrong-id' });

    expect(rebuilt.ledger.transactions).toHaveLength(1);
    expect(rebuilt.ledger.transactions[0]).toMatchObject({ id: keep.id, categoryId: 'food', note: 'owner note', amount: -900 });
    expect(rebuilt.summary.removed).toBe(1);
  });

  it('refuses to rebuild from a partial provider snapshot', () => {
    expect(() => projectBankSync(ledger(), item, result([], { complete: false }), { rebuild: true })).toThrow('complete history');
  });

  it('marks an account inactive when the provider no longer reports it without deleting its history', () => {
    const current = projectBankSync(ledger(), item, result([
      { id: 'kept-history', accountId: 'bank-checking', bookedOn: '2026-08-20', description: 'Coffee', amountMinor: -800, currency: 'USD', pending: false },
    ]), { createId: (() => { let id = 0; return () => `id-${++id}`; })() }).ledger;
    current.accounts.push({
      id: 'closed-local', name: 'Old savings', kind: 'savings', institution: 'Chase', currency: 'USD', opening: 5000,
      external: { provider: 'plaid', environment: 'sandbox', connectionId: 'item-1', accountId: 'closed-provider', status: 'active' },
    });
    current.transactions.push({
      id: 'closed-tx', accountId: 'closed-local', categoryId: 'uncategorized', date: '2025-01-01', amount: 100,
      payee: 'Old deposit', bank: { provider: 'plaid', environment: 'sandbox', connectionId: 'item-1', transactionId: 'closed-transaction' },
    });

    const applied = projectBankSync(current, item, result([]));
    expect(applied.ledger.accounts.find((account) => account.id === 'closed-local')?.external?.status).toBe('inactive');
    expect(applied.ledger.transactions.some((transaction) => transaction.id === 'closed-tx')).toBe(true);
    expect(applied.summary.inactiveAccounts).toBe(1);
  });
});

describe('daily sync eligibility', () => {
  const now = new Date(2026, 7, 29, 7, 0, 0);
  it('runs after 6 when an item has not synced today', () => {
    expect(shouldRunDaily([item], ledger(), now, 6)).toBe(true);
  });
  it('does not run before 6 or after an item already synced today', () => {
    expect(shouldRunDaily([item], ledger(), new Date(2026, 7, 29, 5, 59), 6)).toBe(false);
    const current = ledger();
    current.sync['item-1'] = { at: new Date(2026, 7, 29, 6, 30).toISOString(), added: 0 };
    expect(shouldRunDaily([item], current, now, 6)).toBe(false);
  });

  it('runs after the configured hour when restore requires a bank rebuild, even if it synced today', () => {
    const current = ledger();
    current.sync['item-1'] = { at: new Date(2026, 7, 29, 6, 30).toISOString(), added: 0 };
    current.pendingBankRebuild = ['item-1'];
    expect(shouldRunDaily([item], current, now, 6)).toBe(true);
  });

  it('retries an incomplete historical import after fifteen minutes on the same day', () => {
    const current = ledger();
    current.sync['item-1'] = { at: new Date(2026, 7, 29, 6, 30).toISOString(), added: 0 };
    expect(shouldRunDaily([{ ...item, historyStatus: 'NOT_READY' }], current, now, 6)).toBe(true);
  });
});

describe('owner ledger write boundary', () => {
  const bankLedger = () => projectBankSync(ledger(), item, result([
    { id: 'bank-tx', accountId: 'bank-checking', bookedOn: '2026-08-28', description: 'Coffee', amountMinor: -1000, currency: 'USD', pending: false },
  ]), { createId: (() => { let id = 0; return () => `id-${++id}`; })() }).ledger;

  it('preserves bank observations and accepts only category/note overlays', () => {
    const current = bankLedger();
    current.pendingBankRebuild = ['item-1'];
    const proposed = structuredClone(current);
    proposed.accounts = [];
    proposed.transactions[0] = { ...proposed.transactions[0], date: '1999-01-01', amount: 999, payee: 'Forged', categoryId: 'food', note: 'owner note' };
    proposed.sync = {};

    const merged = mergeOwnerLedgerWrite(current, proposed);
    expect(merged.accounts).toEqual(current.accounts);
    expect(merged.transactions[0]).toMatchObject({ date: '2026-08-28', amount: -1000, payee: 'Coffee', categoryId: 'food', note: 'owner note' });
    expect(merged.sync).toEqual(current.sync);
    expect(merged.pendingBankRebuild).toEqual(['item-1']);
  });

  it('rejects browser-created bank provenance', () => {
    const current = bankLedger();
    const proposed = structuredClone(current);
    proposed.transactions.push({
      id: 'forged', accountId: current.accounts[0].id, categoryId: 'uncategorized', date: '2026-08-29', amount: -1,
      payee: 'Forged', bank: { provider: 'plaid', environment: 'production', connectionId: 'item-1', transactionId: 'forged' },
    });
    expect(() => mergeOwnerLedgerWrite(current, proposed)).toThrow('cannot create or rebind a bank transaction');
  });

});

describe('financial provenance', () => {
  it('separates live, simulated, and local/imported projections', () => {
    const current = ledger();
    current.accounts = [
      { id: 'live-account', name: 'Live', kind: 'checking', institution: 'Bank', currency: 'USD', opening: 0, external: { provider: 'plaid', connectionId: 'live', accountId: 'a1' } },
      { id: 'mock-account', name: 'Mock', kind: 'checking', institution: 'Demo', currency: 'USD', opening: 0, external: { provider: 'mock', connectionId: 'mock', accountId: 'a2' } },
      { id: 'local-account', name: 'Local', kind: 'checking', institution: 'Cash', currency: 'USD', opening: 0 },
    ];
    current.transactions = [
      { id: 't1', accountId: 'live-account', categoryId: 'uncategorized', date: '2026-08-29', amount: -1, payee: 'Live', bank: { provider: 'plaid', connectionId: 'live', transactionId: 'p1' } },
      { id: 't2', accountId: 'mock-account', categoryId: 'uncategorized', date: '2026-08-29', amount: -1, payee: 'Mock', bank: { provider: 'mock', connectionId: 'mock', transactionId: 'p2' } },
      { id: 't3', accountId: 'live-account', categoryId: 'uncategorized', date: '2026-08-29', amount: -1, payee: 'Manual' },
    ];

    expect(financialComposition(current, [
      { ...item, id: 'live' },
      { ...item, id: 'mock', provider: 'mock', environment: 'mock' },
    ])).toEqual({
      accounts: { live: 1, simulated: 1, unowned: 1 },
      transactions: { live: 1, simulated: 1, unowned: 1 },
      history: 0,
    });
  });
});

describe('Plaid link configuration', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requests 730 days and the configured OAuth redirect for a new Item', async () => {
    let body;
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      body = JSON.parse(init.body);
      return { ok: true, json: async () => ({ link_token: 'link-token' }) };
    }));
    const provider = plaidProvider({ clientId: 'client', secret: 'secret', env: 'sandbox', redirectUri: 'https://ledger.example/connections' });
    await provider.linkToken();
    expect(body).toMatchObject({
      client_id: 'client', products: ['transactions'], transactions: { days_requested: 730 },
      redirect_uri: 'https://ledger.example/connections',
    });
  });

  it('uses the existing access token in update mode without re-requesting products', async () => {
    let body;
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      body = JSON.parse(init.body);
      return { ok: true, json: async () => ({ link_token: 'update-token' }) };
    }));
    const provider = plaidProvider({ clientId: 'client', secret: 'secret' });
    await provider.linkToken({ access_token: 'access-token' });
    expect(body.access_token).toBe('access-token');
    expect(body.products).toBeUndefined();
    expect(body.transactions).toBeUndefined();
  });

  it('normalizes Plaid signs, cents, currency, names, and checkpoint at the adapter boundary', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).endsWith('/transactions/sync')) return {
        ok: true,
        json: async () => ({
          added: [{
            transaction_id: 'transaction-1', account_id: 'account-1', date: '2026-08-29', authorized_date: '2026-08-28',
            merchant_name: 'Coffee', name: 'COFFEE 123', amount: 12.34, iso_currency_code: 'USD', pending: false,
            pending_transaction_id: 'pending-1', personal_finance_category: { primary: 'FOOD_AND_DRINK' },
          }],
          modified: [], removed: [{ transaction_id: 'removed-1' }], next_cursor: 'next-checkpoint', has_more: false,
          transactions_update_status: 'HISTORICAL_UPDATE_COMPLETE',
        }),
      };
      return {
        ok: true,
        json: async () => ({ accounts: [{
          account_id: 'account-1', name: 'Checking', mask: '1234', type: 'depository', subtype: 'checking',
          balances: { current: 87.66, iso_currency_code: 'USD' },
        }] }),
      };
    }));
    const provider = plaidProvider({ clientId: 'client', secret: 'secret' });
    const synced = await provider.sync({ access_token: 'access-token', checkpoint: 'old-checkpoint', accounts: [] });

    expect(synced).toMatchObject({ checkpoint: 'next-checkpoint', complete: true, historyReady: true, updateStatus: 'HISTORICAL_UPDATE_COMPLETE', removed: ['removed-1'] });
    expect(synced.added[0]).toEqual({
      id: 'transaction-1', accountId: 'account-1', bookedOn: '2026-08-29', authorizedOn: '2026-08-28',
      description: 'Coffee', amountMinor: -1234, currency: 'USD', pending: false, replacesId: 'pending-1',
      providerCategory: 'FOOD_AND_DRINK',
    });
    expect(synced.accounts[0]).toMatchObject({ kind: 'checking', balanceMinor: 8766, currency: 'USD' });
  });

  it('does not call an empty initial Plaid response historical history', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('/transactions/sync') ? {
      ok: true,
      json: async () => ({
        added: [], modified: [], removed: [], next_cursor: '', has_more: false,
        transactions_update_status: 'NOT_READY',
      }),
    } : { ok: true, json: async () => ({ accounts: [] }) }));
    const provider = plaidProvider({ clientId: 'client', secret: 'secret' });

    await expect(provider.sync({ access_token: 'access-token', checkpoint: null, accounts: [] })).resolves.toMatchObject({
      complete: true, historyReady: false, updateStatus: 'NOT_READY', added: [], checkpoint: '',
    });
  });

  it('restarts pagination from the original checkpoint after a mutation error', async () => {
    const cursors = [];
    let transactionCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (!String(url).endsWith('/transactions/sync')) return { ok: true, json: async () => ({ accounts: [] }) };
      const body = JSON.parse(init.body);
      cursors.push(body.cursor);
      transactionCalls++;
      if (transactionCalls === 2) return {
        ok: false, status: 400,
        json: async () => ({ error_code: 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION', error_message: 'restart' }),
      };
      return {
        ok: true,
        json: async () => ({
          added: transactionCalls === 1
            ? [{ transaction_id: 'discarded', account_id: 'a', date: '2026-08-28', name: 'Discarded', amount: 1, pending: false }]
            : [{ transaction_id: 'kept', account_id: 'a', date: '2026-08-29', name: 'Kept', amount: 2, pending: false }],
          modified: [], removed: [], next_cursor: transactionCalls === 1 ? 'middle' : 'done',
          has_more: transactionCalls === 1, transactions_update_status: 'HISTORICAL_UPDATE_COMPLETE',
        }),
      };
    }));
    const provider = plaidProvider({ clientId: 'client', secret: 'secret' });
    const synced = await provider.sync({ access_token: 'access-token', checkpoint: 'original', accounts: [] });

    expect(cursors).toEqual(['original', 'middle', 'original']);
    expect(synced.added.map((transaction) => transaction.id)).toEqual(['kept']);
    expect(synced.checkpoint).toBe('done');
  });
});
