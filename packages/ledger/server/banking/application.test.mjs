import { describe, expect, it, vi } from 'vitest';
import { createBankingService } from '../bank-sync.mjs';

const account = (id, balanceMinor = 10_000) => ({
  id, name: 'Checking', mask: '1234', kind: 'checking', type: 'depository', subtype: 'checking',
  balanceMinor, currency: 'USD',
});
const connection = (id, provider, accounts = [account(`${id}-account`)]) => ({
  id, provider, environment: provider === 'mock' ? 'mock' : 'production', institution: provider === 'mock' ? 'Demo Bank' : 'Live Bank',
  checkpoint: 'old-checkpoint', status: 'ok', createdAt: '2026-08-29T00:00:00.000Z', accounts,
});
const ledger = () => ({
  accounts: [{ id: 'demo', name: 'Demo checking', kind: 'checking', opening: 100, institution: 'Demo', currency: 'USD' }],
  categories: [{ id: 'uncategorized', name: 'Uncategorized' }],
  transactions: [{ id: 'demo-tx', accountId: 'demo', categoryId: 'uncategorized', date: '2026-08-01', amount: -100, payee: 'Demo' }],
  budgets: [{ id: 'budget', categoryId: 'uncategorized', limit: 5000 }],
  rules: [], settings: { name: 'Owner', currency: 'USD', locale: 'en-US' }, sync: {},
});
const snapshot = (connectionId) => ({
  added: [{ id: `${connectionId}-tx`, accountId: `${connectionId}-account`, bookedOn: '2026-08-29', description: 'Grocer', amountMinor: -1250, currency: 'USD', pending: false }],
  modified: [], removed: [], accounts: [account(`${connectionId}-account`, 8750)], checkpoint: 'fresh-checkpoint', complete: true,
  updateStatus: 'HISTORICAL_UPDATE_COMPLETE', historyReady: true,
});

function harness({ failLive = false, historyReady = true } = {}) {
  let connections = [connection('simulated', 'mock'), connection('live', 'plaid')];
  let currentLedger = ledger();
  const backupLabels = [];
  const plaid = {
    name: 'plaid', env: 'production', linkToken: vi.fn(), exchange: vi.fn(async () => connection('live', 'plaid')), remove: vi.fn(),
    sync: vi.fn(async (candidate) => {
      expect(candidate.checkpoint).toBeNull();
      if (failLive) throw Object.assign(new Error('provider unavailable'), { code: 'PROVIDER_DOWN' });
      return { ...snapshot(candidate.id), historyReady, updateStatus: historyReady ? 'HISTORICAL_UPDATE_COMPLETE' : 'NOT_READY' };
    }),
  };
  const mock = { name: 'mock', env: 'mock', sync: vi.fn(), remove: vi.fn() };
  const service = createBankingService({
    activeProvider: plaid,
    providerFor: (candidate) => candidate.provider === 'mock' ? mock : plaid,
    loadConnections: async () => structuredClone(connections),
    updateConnections: async (update) => { connections = await update(structuredClone(connections)); return connections; },
    getLedger: async () => ({ version: 1, ledger: structuredClone(currentLedger) }),
    updateLedger: async (update, options = {}) => {
      backupLabels.push(options.backupLabel);
      currentLedger = await update(structuredClone(currentLedger));
      return { version: 2, ledger: currentLedger, backup: 'ledger.pre-live-data.json' };
    },
  });
  return { service, plaid, mock, backupLabels, connections: () => connections, ledger: () => currentLedger };
}

describe('banking application service', () => {
  it('replaces mixed financial projections from existing live connections only', async () => {
    const h = harness();
    const outcome = await h.service.useLiveDataOnly();

    expect(h.plaid.sync).toHaveBeenCalledOnce();
    expect(h.mock.sync).not.toHaveBeenCalled();
    expect(h.backupLabels).toEqual(['pre-live-data']);
    expect(h.connections()).toHaveLength(1);
    expect(h.connections()[0]).toMatchObject({ id: 'live', checkpoint: 'fresh-checkpoint' });
    expect(h.ledger().accounts).toHaveLength(1);
    expect(h.ledger().accounts[0].external).toMatchObject({ connectionId: 'live', provider: 'plaid' });
    expect(h.ledger().transactions).toHaveLength(1);
    expect(h.ledger().transactions[0].bank).toMatchObject({ connectionId: 'live', transactionId: 'live-tx' });
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

    expect(views).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'simulated', source: 'simulated' }),
      expect.objectContaining({ id: 'live', source: 'live' }),
    ]));
    expect(views.every((view) => !('checkpoint' in view) && !('access_token' in view))).toBe(true);
    expect(composition).toEqual({
      accounts: { live: 0, simulated: 0, unowned: 1 },
      transactions: { live: 0, simulated: 0, unowned: 1 },
      history: 0,
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
    expect(repeated).toMatchObject({ id: 'live', source: 'live' });
    expect(repeated).not.toHaveProperty('completionKey');
  });
});
