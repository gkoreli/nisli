import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectBankSync, shouldRunDaily } from './bank-sync.ts';
import { financialBlank, financialComposition, mergeOwnerLedgerWrite, normalizeConnection } from './banking/domain.ts';
import type { BankConnection, BankSyncResult, ProviderTransaction } from './banking/domain.ts';
import { plaidProvider } from './providers/plaid.ts';
import type { Ledger } from '../src/data/model.ts';

const ledger = (): Ledger => ({
  accounts: [],
  categories: [{ id: 'uncategorized', name: 'Uncategorized' }, { id: 'food', name: 'Food' }],
  transactions: [], budgets: [], rules: [{ id: 'r1', match: 'coffee', categoryId: 'food' }],
  settings: { name: 'Owner', currency: 'USD', locale: 'en-US' }, sync: {},
});
const item: BankConnection = {
  id: 'item-1', provider: 'plaid', environment: 'sandbox', institution: 'Chase', status: 'ok', checkpoint: null, createdAt: '2026-08-29T00:00:00.000Z',
  accounts: [{ id: 'bank-checking', name: 'Chase Total Checking', mask: '1234', kind: 'checking', type: 'depository', subtype: 'checking', balanceMinor: 10_000, currency: 'USD' }],
};
const result = (transactions: ProviderTransaction[], extra: Partial<BankSyncResult> = {}): BankSyncResult => ({
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
    expect(applied.ledger.transactions[0]!).toMatchObject({
      amount: -1234, categoryId: 'food', pending: true, note: undefined,
      classification: { source: 'rule', ruleId: 'r1' },
      bank: { provider: 'plaid', connectionId: 'item-1', transactionId: 'pending-1' },
    });
    expect(applied.ledger.accounts[0]!.opening).toBe(11_234);
    expect(applied.ledger.sync?.['item-1']).toEqual({ at: '2026-08-29T13:00:00.000Z', added: 1 });
  });

  it('replaces a pending transaction without losing its category or local identity', () => {
    const first = projectBankSync(ledger(), item, result([
      { id: 'pending-1', accountId: 'bank-checking', bookedOn: '2026-08-28', description: 'Coffee', amountMinor: -1000, currency: 'USD', pending: true },
    ]), { createId: () => 'stable-id' }).ledger;
    first.transactions[0]!.categoryId = 'food';
    const posted = projectBankSync(first, item, result([
      { id: 'posted-1', accountId: 'bank-checking', bookedOn: '2026-08-29', description: 'Coffee', amountMinor: -1000, currency: 'USD', pending: false, replacesId: 'pending-1' },
    ]), { createId: () => 'wrong-id' });

    expect(posted.ledger.transactions).toHaveLength(1);
    expect(posted.ledger.transactions[0]!).toMatchObject({ id: 'stable-id', bank: { transactionId: 'posted-1' }, categoryId: 'food' });
    expect(posted.ledger.bankHistory).toEqual([
      expect.objectContaining({ change: 'replaced', transactionId: 'pending-1', replacementId: 'posted-1', transaction: expect.objectContaining({ id: 'stable-id' }) }),
    ]);
  });

  it('projects PFCv2 through the versioned mapping while retaining the exact provider fact server-side', () => {
    const current = ledger();
    current.rules = [];
    const source = {
      schema: 'plaid.Transaction', schemaVersion: '2020-09-14',
      payload: {
        transaction_id: 'categorized', account_id: 'bank-checking', name: 'RAW CAFE', merchant_name: 'Cafe',
        amount: 12.34, iso_currency_code: 'USD', pending: false,
        original_description: 'RAW CAFE 001', location: { city: 'Oakland', region: 'CA' },
        personal_finance_category: {
          primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_COFFEE', confidence_level: 'LOW',
        },
      },
    };
    const applied = projectBankSync(current, item, result([{
      id: 'categorized', accountId: 'bank-checking', bookedOn: '2026-08-28', authorizedOn: '2026-08-27',
      description: 'Cafe', amountMinor: -1234, currency: 'USD', pending: false,
      providerCategory: {
        taxonomy: 'personal_finance_category',
        primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_COFFEE', confidenceLevel: 'LOW', version: 'v2',
      },
      source,
    }]), { now: () => '2026-08-30T12:00:00.000Z' });

    expect(applied.ledger.transactions[0]).toMatchObject({
      categoryId: 'dining', authorizedDate: '2026-08-27', currency: 'USD', pending: false,
      classification: {
        source: 'provider', provider: 'plaid', taxonomy: 'personal_finance_category', taxonomyVersion: 'v2',
        mappingVersion: 'plaid-pfc-v2-ledger-v2', primary: 'FOOD_AND_DRINK',
        detailed: 'FOOD_AND_DRINK_COFFEE', confidence: 'LOW',
      },
    });
    expect(applied.ledger.categories).toContainEqual({ id: 'dining', name: 'Dining out' });
    const observation = Object.values(applied.bankFacts.observations).find((candidate) => candidate.endpoint === 'plaid.Transaction');
    expect(observation?.payload).toEqual(source.payload);
    expect(Object.values(applied.bankFacts.current.transactions)[0]?.value).toMatchObject({
      authorizedOn: '2026-08-27', pending: false, providerCategory: { detailed: 'FOOD_AND_DRINK_COFFEE' },
    });
  });

  it('keeps debt payments as loans while excluding credit-card movements from cash flow', () => {
    const providerCategory = (primary: string, detailed: string) => ({
      taxonomy: 'personal_finance_category',
      primary,
      detailed,
      confidenceLevel: 'VERY_HIGH',
      version: 'v2',
    });
    const applied = projectBankSync(ledger(), item, result([
      {
        id: 'card-payment', accountId: 'bank-checking', bookedOn: '2026-08-28', description: 'Card payment',
        amountMinor: -12500, currency: 'USD', pending: false,
        providerCategory: providerCategory('LOAN_PAYMENTS', 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT'),
      },
      {
        id: 'loan-payment', accountId: 'bank-checking', bookedOn: '2026-08-27', description: 'Vehicle finance payment',
        amountMinor: -45000, currency: 'USD', pending: false,
        providerCategory: providerCategory('LOAN_PAYMENTS', 'LOAN_PAYMENTS_CAR_PAYMENT'),
      },
      {
        id: 'loan-proceeds', accountId: 'bank-checking', bookedOn: '2026-08-26', description: 'Loan proceeds',
        amountMinor: 500000, currency: 'USD', pending: false,
        providerCategory: providerCategory('LOAN_DISBURSEMENTS', 'LOAN_DISBURSEMENTS_PERSONAL'),
      },
    ])).ledger.transactions;

    expect(applied.find((transaction) => transaction.bank?.transactionId === 'card-payment')).toMatchObject({
      categoryId: 'transfer', classification: { mappingVersion: 'plaid-pfc-v2-ledger-v2' },
    });
    expect(applied.find((transaction) => transaction.bank?.transactionId === 'loan-payment')).toMatchObject({
      categoryId: 'loans', classification: { mappingVersion: 'plaid-pfc-v2-ledger-v2' },
    });
    expect(applied.find((transaction) => transaction.bank?.transactionId === 'loan-proceeds')).toMatchObject({
      categoryId: 'transfer', classification: { mappingVersion: 'plaid-pfc-v2-ledger-v2' },
    });
  });

  it('preserves owner authority but reprojects legacy automatic uncategorized rows', () => {
    const current = ledger();
    current.rules = [];
    const initial = projectBankSync(current, item, result([{
      id: 'provider-row', accountId: 'bank-checking', bookedOn: '2026-08-28', description: 'Market',
      amountMinor: -2000, currency: 'USD', pending: false,
      providerCategory: {
        taxonomy: 'personal_finance_category',
        primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES', confidenceLevel: 'VERY_HIGH', version: 'v2',
      },
    }])).ledger;
    const row = initial.transactions[0]!;
    row.categoryId = 'food';
    row.classification = { source: 'owner' };

    const ownerRebuilt = projectBankSync(initial, item, result([{
      id: 'provider-row', accountId: 'bank-checking', bookedOn: '2026-08-28', description: 'Market',
      amountMinor: -2000, currency: 'USD', pending: false,
      providerCategory: {
        taxonomy: 'personal_finance_category',
        primary: 'GENERAL_MERCHANDISE', detailed: 'GENERAL_MERCHANDISE_SUPERSTORES', confidenceLevel: 'VERY_HIGH', version: 'v2',
      },
    }]), { rebuild: true }).ledger.transactions[0]!;
    expect(ownerRebuilt).toMatchObject({ categoryId: 'food', classification: { source: 'owner' } });

    row.categoryId = 'uncategorized';
    row.classification = undefined;
    const legacyRebuilt = projectBankSync(initial, item, result([{
      id: 'provider-row', accountId: 'bank-checking', bookedOn: '2026-08-28', description: 'Market',
      amountMinor: -2000, currency: 'USD', pending: false,
      providerCategory: {
        taxonomy: 'personal_finance_category',
        primary: 'GENERAL_MERCHANDISE', detailed: 'GENERAL_MERCHANDISE_SUPERSTORES', confidenceLevel: 'VERY_HIGH', version: 'v2',
      },
    }]), { rebuild: true }).ledger.transactions[0]!;
    expect(legacyRebuilt).toMatchObject({ categoryId: 'shopping', classification: { source: 'provider' } });
  });

  it('removes provider-deleted transactions', () => {
    const first = projectBankSync(ledger(), item, result([
      { id: 'gone', accountId: 'bank-checking', bookedOn: '2026-08-28', description: 'Coffee', amountMinor: -1000, currency: 'USD', pending: false },
    ]), { createId: () => 'local-id' }).ledger;
    const removed = projectBankSync(first, item, result([], { removed: ['gone'] }));
    expect(removed.summary.removed).toBe(1);
    expect(removed.ledger.transactions).toHaveLength(0);
    expect(removed.ledger.bankHistory?.at(-1)).toMatchObject({ change: 'removed', transactionId: 'gone', transaction: { id: 'local-id' } });
  });

  it('rebuilds a complete projection while preserving local identity, category, and note', () => {
    const first = projectBankSync(ledger(), item, result([
      { id: 'keep', accountId: 'bank-checking', bookedOn: '2026-08-20', description: 'Coffee', amountMinor: -800, currency: 'USD', pending: false },
      { id: 'stale', accountId: 'bank-checking', bookedOn: '2026-08-19', description: 'Old', amountMinor: -500, currency: 'USD', pending: false },
    ]), { createId: (() => { let n = 0; return () => `id-${++n}`; })() }).ledger;
    const keep = first.transactions.find((transaction) => transaction.bank?.transactionId === 'keep')!;
    keep.categoryId = 'food';
    keep.note = 'owner note';

    const rebuilt = projectBankSync(first, item, result([
      { id: 'keep', accountId: 'bank-checking', bookedOn: '2026-08-21', description: 'Coffee Shop', amountMinor: -900, currency: 'USD', pending: false },
    ]), { rebuild: true, createId: () => 'wrong-id' });

    expect(rebuilt.ledger.transactions).toHaveLength(1);
    expect(rebuilt.ledger.transactions[0]!).toMatchObject({ id: keep.id, categoryId: 'food', note: 'owner note', amount: -900 });
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
    current.sync!['item-1'] = { at: new Date(2026, 7, 29, 6, 30).toISOString(), added: 0 };
    expect(shouldRunDaily([item], current, now, 6)).toBe(false);
  });

  it('runs after the configured hour when restore requires a bank rebuild, even if it synced today', () => {
    const current = ledger();
    current.sync!['item-1'] = { at: new Date(2026, 7, 29, 6, 30).toISOString(), added: 0 };
    current.pendingBankRebuild = ['item-1'];
    expect(shouldRunDaily([item], current, now, 6)).toBe(true);
  });

  it('retries an incomplete historical import after fifteen minutes on the same day', () => {
    const current = ledger();
    current.sync!['item-1'] = { at: new Date(2026, 7, 29, 6, 30).toISOString(), added: 0 };
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
    proposed.transactions[0] = { ...proposed.transactions[0]!, date: '1999-01-01', amount: 999, payee: 'Forged', categoryId: 'food', note: 'owner note' };
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
      id: 'forged', accountId: current.accounts[0]!.id, categoryId: 'uncategorized', date: '2026-08-29', amount: -1,
      payee: 'Forged', bank: { provider: 'plaid', environment: 'production', connectionId: 'item-1', transactionId: 'forged' },
    });
    expect(() => mergeOwnerLedgerWrite(current, proposed)).toThrow('cannot create or rebind a bank transaction');
  });

});

describe('financial provenance', () => {
  it('separates live, retired-sample, and local/imported projections', () => {
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
      accounts: { live: 1, legacy: 1, unowned: 1 },
      transactions: { live: 1, legacy: 1, unowned: 1 },
      history: 0,
      legacyConfiguration: 0,
    });
  });

  it('quarantines retired mock metadata and removes only unchanged sample configuration', () => {
    expect(normalizeConnection({ id: 'old', institution: 'Demo', provider: 'mock', environment: 'mock', status: 'ok' })).toMatchObject({ status: 'disabled' });
    const current = ledger();
    current.budgets = [
      { id: 'b1', categoryId: 'groceries', limit: 60_000 },
      { id: 'owner-budget', categoryId: 'food', limit: 12_345 },
    ];
    current.rules = [
      { id: 'r1', match: 'whole foods', categoryId: 'groceries' },
      { id: 'owner-rule', match: 'cafe', categoryId: 'food' },
    ];
    const cleaned = financialBlank(current);
    expect(cleaned.budgets).toEqual([{ id: 'owner-budget', categoryId: 'food', limit: 12_345 }]);
    expect(cleaned.rules).toEqual([{ id: 'owner-rule', match: 'cafe', categoryId: 'food' }]);
  });
});

describe('Plaid link configuration', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the exchanged Item credential without fetching accounts first', async () => {
    const paths: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => {
      paths.push(new URL(String(url)).pathname);
      return {
        ok: true,
        json: async () => ({ access_token: 'durable-access-token', item_id: 'durable-item' }),
      };
    }));
    const provider = plaidProvider({ clientId: 'client', secret: 'secret', env: 'production' });

    await expect(provider.exchange({ public_token: 'one-use-token', institution: 'Selected Bank' })).resolves.toMatchObject({
      id: 'durable-item',
      access_token: 'durable-access-token',
      institution: 'Selected Bank',
      accounts: [],
    });
    expect(paths).toEqual(['/item/public_token/exchange']);
  });

  it('requests 730 days and the configured OAuth redirect for a new Item', async () => {
    let body: Record<string, unknown> | undefined;
    vi.stubGlobal('fetch', vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return { ok: true, json: async () => ({ link_token: 'link-token' }) };
    }));
    const provider = plaidProvider({ clientId: 'client', secret: 'secret', env: 'development', redirectUri: 'https://ledger.example/connections' });
    await provider.linkToken();
    expect(body).toMatchObject({
      client_id: 'client', products: ['transactions'], transactions: { days_requested: 730 },
      redirect_uri: 'https://ledger.example/connections',
    });
  });

  it('uses the existing access token in update mode without re-requesting products', async () => {
    let body: Record<string, unknown> | undefined;
    vi.stubGlobal('fetch', vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return { ok: true, json: async () => ({ link_token: 'update-token' }) };
    }));
    const provider = plaidProvider({ clientId: 'client', secret: 'secret', env: 'development' });
    await provider.linkToken({ access_token: 'access-token' });
    expect(body?.access_token).toBe('access-token');
    expect(body?.products).toBeUndefined();
    expect(body?.transactions).toBeUndefined();
  });

  it('normalizes Plaid signs, cents, currency, names, and checkpoint at the adapter boundary', async () => {
    const syncRequests: RequestInit[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (String(url).endsWith('/transactions/sync')) syncRequests.push(init ?? {});
      if (String(url).endsWith('/transactions/sync')) return {
        ok: true,
        json: async () => ({
          added: [{
            transaction_id: 'transaction-1', account_id: 'account-1', date: '2026-08-29', authorized_date: '2026-08-28',
            merchant_name: 'Coffee', name: 'COFFEE 123', amount: 12.34, iso_currency_code: 'USD', pending: false,
            pending_transaction_id: 'pending-1', original_description: 'POS COFFEE 123',
            personal_finance_category: {
              primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_COFFEE', confidence_level: 'VERY_HIGH',
            },
          }],
          modified: [], removed: [{ transaction_id: 'removed-1', account_id: 'account-1' }], next_cursor: 'next-checkpoint', has_more: false,
          transactions_update_status: 'HISTORICAL_UPDATE_COMPLETE', request_id: 'request-1',
        }),
      } as Response;
      return {
        ok: true,
        json: async () => ({ accounts: [{
          account_id: 'account-1', name: 'Checking', mask: '1234', type: 'depository', subtype: 'checking',
          balances: { current: 87.66, iso_currency_code: 'USD' },
        }] }),
      } as Response;
    }));
    const provider = plaidProvider({ clientId: 'client', secret: 'secret', env: 'development' });
    const synced = await provider.sync({ access_token: 'access-token', checkpoint: 'old-checkpoint' });

    expect(synced).toMatchObject({
      checkpoint: 'next-checkpoint', complete: true, historyReady: true, updateStatus: 'HISTORICAL_UPDATE_COMPLETE',
      removed: [{ id: 'removed-1', accountId: 'account-1' }],
      receipt: { schema: 'plaid.TransactionsSync', schemaVersion: '2020-09-14', pages: [{
        requestId: 'request-1', cursor: 'old-checkpoint', nextCursor: 'next-checkpoint', hasMore: false,
        updateStatus: 'HISTORICAL_UPDATE_COMPLETE',
      }] },
    });
    expect(synced.added[0]).toMatchObject({
      id: 'transaction-1', accountId: 'account-1', bookedOn: '2026-08-29', authorizedOn: '2026-08-28',
      description: 'Coffee', amountMinor: -1234, currency: 'USD', pending: false, replacesId: 'pending-1',
      providerCategory: {
        taxonomy: 'personal_finance_category',
        primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_COFFEE', confidenceLevel: 'VERY_HIGH', version: 'v2',
      },
      source: { schema: 'plaid.Transaction', schemaVersion: '2020-09-14', payload: {
        transaction_id: 'transaction-1', original_description: 'POS COFFEE 123',
      } },
    });
    expect(synced.added[0]?.source.payload.personal_finance_category).not.toHaveProperty('version');
    expect(synced.removed[0]?.source.payload).toEqual({ transaction_id: 'removed-1', account_id: 'account-1' });
    expect(synced.accounts[0]).toMatchObject({
      kind: 'checking', balanceMinor: 8766, currency: 'USD',
      source: { schema: 'plaid.AccountBase', schemaVersion: '2020-09-14', payload: { account_id: 'account-1' } },
    });
    const syncBody = JSON.parse(String(syncRequests[0]?.body)) as Record<string, unknown>;
    expect(syncBody.options).toEqual({ include_original_description: true, personal_finance_category_version: 'v2' });
    expect(syncRequests[0]?.headers).toMatchObject({ 'Plaid-Version': '2020-09-14' });
    expect(JSON.stringify(synced)).not.toContain('access-token');
  });

  it('does not call an empty initial Plaid response historical history', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('/transactions/sync') ? {
      ok: true,
      json: async () => ({
        added: [], modified: [], removed: [], next_cursor: '', has_more: false,
        transactions_update_status: 'NOT_READY',
      }),
    } : { ok: true, json: async () => ({ accounts: [] }) }));
    const provider = plaidProvider({ clientId: 'client', secret: 'secret', env: 'development' });

    await expect(provider.sync({ access_token: 'access-token', checkpoint: null })).resolves.toMatchObject({
      complete: true, historyReady: false, updateStatus: 'NOT_READY', added: [], checkpoint: '',
    });
  });

  it('uses ISO currency fraction digits without inventing a default currency', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('/transactions/sync') ? {
      ok: true,
      json: async () => ({
        added: [{
          transaction_id: 'yen-transaction', account_id: 'yen-account', date: '2026-08-29', name: 'Rail',
          amount: 1234, iso_currency_code: 'JPY', pending: false,
        }],
        modified: [], removed: [], next_cursor: 'yen-cursor', has_more: false,
        transactions_update_status: 'HISTORICAL_UPDATE_COMPLETE',
      }),
    } : {
      ok: true,
      json: async () => ({ accounts: [{
        account_id: 'yen-account', name: 'JPY Checking', mask: null, type: 'depository', subtype: 'checking',
        balances: { current: 5678, iso_currency_code: 'JPY' },
      }] }),
    }));
    const provider = plaidProvider({ clientId: 'client', secret: 'secret', env: 'development' });

    const synced = await provider.sync({ access_token: 'access-token', checkpoint: null });
    expect(synced.added[0]).toMatchObject({ amountMinor: -1234, currency: 'JPY' });
    expect(synced.accounts[0]).toMatchObject({ balanceMinor: 5678, currency: 'JPY' });
  });

  it('restarts pagination from the original checkpoint after a mutation error', async () => {
    const cursors: Array<string | undefined> = [];
    const options: unknown[] = [];
    let transactionCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (!String(url).endsWith('/transactions/sync')) return { ok: true, json: async () => ({ accounts: [] }) };
      const body = JSON.parse(String(init?.body)) as { cursor?: string; options?: unknown };
      cursors.push(body.cursor);
      options.push(body.options);
      transactionCalls++;
      if (transactionCalls === 2) return {
        ok: false, status: 400,
        json: async () => ({ error_code: 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION', error_message: 'restart' }),
      };
      return {
        ok: true,
        json: async () => ({
          added: transactionCalls === 1
            ? [{ transaction_id: 'discarded', account_id: 'a', date: '2026-08-28', name: 'Discarded', amount: 1, iso_currency_code: 'USD', pending: false }]
            : [{ transaction_id: 'kept', account_id: 'a', date: '2026-08-29', name: 'Kept', amount: 2, iso_currency_code: 'USD', pending: false }],
          modified: [], removed: [], next_cursor: transactionCalls === 1 ? 'middle' : 'done',
          has_more: transactionCalls === 1, transactions_update_status: 'HISTORICAL_UPDATE_COMPLETE',
        }),
      };
    }));
    const provider = plaidProvider({ clientId: 'client', secret: 'secret', env: 'development' });
    const synced = await provider.sync({ access_token: 'access-token', checkpoint: 'original' });

    expect(cursors).toEqual(['original', 'middle', 'original']);
    expect(options).toEqual(Array.from({ length: 3 }, () => ({
      include_original_description: true,
      personal_finance_category_version: 'v2',
    })));
    expect(synced.added.map((transaction) => transaction.id)).toEqual(['kept']);
    expect(synced.checkpoint).toBe('done');
  });
});
