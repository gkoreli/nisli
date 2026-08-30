import { describe, expect, it, vi } from 'vitest';
import { createBankingService } from '../bank-sync.ts';
import type { AuthenticatedBankConnection, BankingProvider } from '../bank-sync.ts';
import type { BankConnection, BankSyncResult, ProviderAccount } from './domain.ts';
import type { Ledger } from '../../src/data/model.ts';

const account = (id: string, balanceMinor = 10_000): ProviderAccount => ({
  id, name: 'Checking', mask: '1234', kind: 'checking', type: 'depository', subtype: 'checking',
  balanceMinor, currency: 'USD',
});
const connection = (id: string, provider: string, accounts = [account(`${id}-account`)]): BankConnection => ({
  id, provider, environment: provider === 'mock' ? 'mock' : 'production', institution: provider === 'mock' ? 'Demo Bank' : 'Live Bank',
  checkpoint: 'old-checkpoint', status: 'ok', createdAt: '2026-08-29T00:00:00.000Z', accounts, access_token: `${id}-access-token`,
});
const ledger = (): Ledger => ({
  accounts: [{ id: 'demo', name: 'Demo checking', kind: 'checking', opening: 100, institution: 'Demo', currency: 'USD' }],
  categories: [{ id: 'uncategorized', name: 'Uncategorized' }],
  transactions: [{ id: 'demo-tx', accountId: 'demo', categoryId: 'uncategorized', date: '2026-08-01', amount: -100, payee: 'Demo' }],
  budgets: [{ id: 'budget', categoryId: 'uncategorized', limit: 5000 }],
  rules: [], settings: { name: 'Owner', currency: 'USD', locale: 'en-US' }, sync: {},
});
const snapshot = (connectionId: string): BankSyncResult => ({
  added: [{ id: `${connectionId}-tx`, accountId: `${connectionId}-account`, bookedOn: '2026-08-29', description: 'Grocer', amountMinor: -1250, currency: 'USD', pending: false }],
  modified: [], removed: [], accounts: [account(`${connectionId}-account`, 8750)], checkpoint: 'fresh-checkpoint', complete: true,
  updateStatus: 'HISTORICAL_UPDATE_COMPLETE', historyReady: true,
});

function harness({ failLive = false, historyReady = true }: { failLive?: boolean; historyReady?: boolean } = {}) {
  let connections: BankConnection[] = [connection('simulated', 'mock'), connection('live', 'plaid')];
  let currentLedger: Ledger = ledger();
  const backupLabels: Array<string | undefined> = [];
  const plaid: BankingProvider = {
    name: 'plaid',
    env: 'production',
    linkToken: vi.fn(async () => ({ link_token: 'link-token' })),
    exchange: vi.fn(async () => connection('live', 'plaid')),
    accounts: vi.fn(async (candidate: AuthenticatedBankConnection) => ({ accounts: candidate.accounts })),
    remove: vi.fn(async () => undefined),
    sync: vi.fn(async (candidate: AuthenticatedBankConnection) => {
      expect(candidate.checkpoint).toBeNull();
      if (failLive) throw Object.assign(new Error('provider unavailable'), { code: 'PROVIDER_DOWN' });
      return { ...snapshot(candidate.id), historyReady, updateStatus: historyReady ? 'HISTORICAL_UPDATE_COMPLETE' : 'NOT_READY' };
    }),
  };
  const providerFor = vi.fn((candidate: BankConnection): BankingProvider => {
    if (candidate.provider !== 'plaid') throw new Error(`Retired provider ${candidate.provider} cannot run`);
    return plaid;
  });
  const service = createBankingService({
    activeProvider: plaid,
    providerFor,
    loadConnections: async () => structuredClone(connections),
    updateConnections: async (update) => { connections = await update(structuredClone(connections)); return connections; },
    getLedger: async () => ({ version: 1, ledger: structuredClone(currentLedger) }),
    updateLedger: async (update, options = {}) => {
      backupLabels.push(options.backupLabel);
      currentLedger = await update(structuredClone(currentLedger));
      return { version: 2, ledger: currentLedger, backup: 'ledger.pre-live-data.json' };
    },
  });
  return { service, plaid, providerFor, backupLabels, connections: () => connections, ledger: () => currentLedger };
}

describe('banking application service', () => {
  it('replaces mixed financial projections from existing live connections only', async () => {
    const h = harness();
    const outcome = await h.service.useLiveDataOnly();

    expect(h.plaid.sync).toHaveBeenCalledOnce();
    expect(h.providerFor).not.toHaveBeenCalledWith(expect.objectContaining({ provider: 'mock' }));
    expect(h.backupLabels).toEqual(['pre-live-data']);
    expect(h.connections()).toHaveLength(1);
    expect(h.connections()[0]!).toMatchObject({ id: 'live', checkpoint: 'fresh-checkpoint' });
    expect(h.ledger().accounts).toHaveLength(1);
    expect(h.ledger().accounts[0]!.external).toMatchObject({ connectionId: 'live', provider: 'plaid' });
    expect(h.ledger().transactions).toHaveLength(1);
    expect(h.ledger().transactions[0]!.bank).toMatchObject({ connectionId: 'live', transactionId: 'live-tx' });
    expect(h.ledger().budgets).toHaveLength(1);
    expect(outcome).toMatchObject({ connections: 1, accounts: 1, added: 1, backup: 'ledger.pre-live-data.json' });
  });

  it('does not mutate the ledger when a live snapshot cannot be fetched', async () => {
    const h = harness({ failLive: true });
    const before = structuredClone(h.ledger());

    await expect(h.service.useLiveDataOnly()).rejects.toThrow('provider unavailable');
    expect(h.ledger()).toEqual(before);
    expect(h.backupLabels).toEqual([]);
    expect(h.connections().find((candidate) => candidate.id === 'live')).toMatchObject({ status: 'error' });
  });

  it('does not replace data or mark the connection failed while Plaid history is still loading', async () => {
    const h = harness({ historyReady: false });
    const before = structuredClone(h.ledger());

    await expect(h.service.useLiveDataOnly()).rejects.toMatchObject({ code: 'HISTORY_NOT_READY', status: 409 });
    expect(h.ledger()).toEqual(before);
    expect(h.backupLabels).toEqual([]);
    expect(h.connections().find((candidate) => candidate.id === 'live')).toMatchObject({ status: 'ok' });
  });

  it('reports financial provenance without exposing provider credentials or checkpoints', async () => {
    const h = harness();
    const views = await h.service.list();
    const composition = await h.service.composition();

    expect(views).toEqual([expect.objectContaining({ id: 'live', provider: 'plaid' })]);
    expect(views.every((view) => !('checkpoint' in view) && !('access_token' in view))).toBe(true);
    expect(composition).toEqual({
      accounts: { live: 0, legacy: 0, unowned: 1 },
      transactions: { live: 0, legacy: 0, unowned: 1 },
      history: 0,
      legacyConfiguration: 0,
    });
  });

  it('forces a null-checkpoint rebuild after restore and clears the marker only after projection', async () => {
    const h = harness();
    h.ledger().pendingBankRebuild = ['live'];

    await h.service.syncOne('live');

    expect(h.plaid.sync).toHaveBeenCalledOnce();
    expect(h.ledger().pendingBankRebuild).toEqual([]);
    expect(h.connections()[1]).toMatchObject({ id: 'live', checkpoint: 'fresh-checkpoint' });
  });

  it('returns the saved connection when a one-use link completion is retried', async () => {
    const h = harness();
    const body = { public_token: 'one-use-public-token', institution: 'Live Bank' };

    await h.service.connect(body);
    const repeated = await h.service.connect(body);

    expect(h.plaid.exchange).toHaveBeenCalledOnce();
    expect(repeated).toMatchObject({ id: 'live', provider: 'plaid' });
    expect(repeated).not.toHaveProperty('completionKey');
  });

  it('stages one-use credentials before enrichment and resumes without exchanging again', async () => {
    let connections: BankConnection[] = [];
    let enrichmentAttempts = 0;
    const plaid: BankingProvider = {
      name: 'plaid',
      env: 'production',
      linkToken: vi.fn(async () => ({ link_token: 'link-token' })),
      exchange: vi.fn(async () => ({
        ...connection('scarce-item', 'plaid', []),
        checkpoint: null,
        accounts: [],
      })),
      accounts: vi.fn(async () => {
        enrichmentAttempts++;
        if (enrichmentAttempts === 1) {
          throw Object.assign(new Error('accounts temporarily unavailable'), { code: 'PROVIDER_DOWN' });
        }
        return { accounts: [account('scarce-account')], institution: 'Durable Bank' };
      }),
      remove: vi.fn(async () => undefined),
      sync: vi.fn(async () => snapshot('scarce-item')),
    };
    const service = createBankingService({
      activeProvider: plaid,
      providerFor: () => plaid,
      loadConnections: async () => structuredClone(connections),
      updateConnections: async (update) => {
        connections = await update(structuredClone(connections));
        return structuredClone(connections);
      },
      getLedger: async () => ({ version: 1, ledger: ledger() }),
      updateLedger: async (update) => ({ version: 2, ledger: await update(ledger()) }),
    });
    const completion = { public_token: 'single-use-production-token', institution: 'Selected Bank' };

    await expect(service.connect(completion)).rejects.toThrow('accounts temporarily unavailable');

    expect(plaid.exchange).toHaveBeenCalledOnce();
    expect(connections).toHaveLength(1);
    expect(connections[0]).toMatchObject({
      id: 'scarce-item',
      access_token: 'scarce-item-access-token',
      accounts: [],
      status: 'error',
      error: { code: 'PROVIDER_DOWN' },
    });
    expect(connections[0]!.completionKey).toMatch(/^[a-f0-9]{64}$/);
    expect(connections[0]!.completionKey).not.toContain(completion.public_token);
    const publicView = await service.list();
    expect(publicView[0]).not.toHaveProperty('access_token');
    expect(publicView[0]).not.toHaveProperty('completionKey');

    await expect(service.connect(completion)).resolves.toMatchObject({
      id: 'scarce-item', institution: 'Durable Bank', status: 'ok',
      accounts: [expect.objectContaining({ id: 'scarce-account' })],
    });
    expect(plaid.exchange).toHaveBeenCalledOnce();
    expect(plaid.accounts).toHaveBeenCalledTimes(2);
    expect(connections[0]).toMatchObject({ status: 'ok', institution: 'Durable Bank' });
    expect(connections[0]!.error).toBeUndefined();
  });
});
