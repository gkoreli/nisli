import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import type { Ledger } from '../src/data/model.ts';
import type { BankFactStore } from './banking/facts.ts';

const originalDataDirectory = process.env.LEDGER_DATA_DIR;
const originalKey = process.env.LEDGER_KEY;
const temporaryDirectories: string[] = [];

const ledger = (): Ledger => ({
  accounts: [],
  categories: [{ id: 'uncategorized', name: 'Uncategorized' }],
  transactions: [],
  budgets: [],
  rules: [],
  settings: { name: 'Owner', currency: 'USD', locale: 'en-US' },
});

const bankFacts = (): BankFactStore => ({
  schemaVersion: 1,
  observations: {
    observation: {
      id: 'observation', provider: 'plaid', environment: 'production', connectionId: 'connection',
      endpoint: '/transactions/sync', observedAt: '2026-08-30T12:00:00.000Z', apiVersion: '2020-09-14',
      taxonomyVersion: 'v2', requestId: 'request', payload: { added: [], has_more: false },
    },
  },
  current: {
    accounts: {
      account: {
        id: 'account', kind: 'account', providerId: 'provider-account', connectionId: 'connection',
        observationId: 'observation', observedAt: '2026-08-30T12:00:00.000Z', value: { currentMinor: 10_000 },
      },
    },
    transactions: {},
  },
  history: [],
  tombstones: [],
  syncReceipts: [{
    id: 'receipt', provider: 'plaid', environment: 'production', connectionId: 'connection',
    startedAt: '2026-08-30T11:59:59.000Z', completedAt: '2026-08-30T12:00:00.000Z',
    complete: true, updateStatus: 'HISTORICAL_UPDATE_COMPLETE', checkpointBefore: null,
    checkpointAfter: 'cursor', requestIds: ['request'], observationIds: ['observation'],
    added: [], modified: [], removed: [],
  }],
});

async function isolatedStore() {
  const directory = await mkdtemp(join(tmpdir(), 'nisli-ledger-persistence-'));
  temporaryDirectories.push(directory);
  process.env.LEDGER_DATA_DIR = directory;
  delete process.env.LEDGER_KEY;
  vi.resetModules();
  return { directory, store: await import('./store.ts') };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(async () => {
  vi.doUnmock('node:fs');
  vi.resetModules();
  if (originalDataDirectory === undefined) delete process.env.LEDGER_DATA_DIR;
  else process.env.LEDGER_DATA_DIR = originalDataDirectory;
  if (originalKey === undefined) delete process.env.LEDGER_KEY;
  else process.env.LEDGER_KEY = originalKey;
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('ledger persistence validation', () => {
  it('persists provider facts internally while the public document omits them', async () => {
    const { directory, store } = await isolatedStore();
    await writeFile(join(directory, 'ledger.json'), JSON.stringify({ version: 2, ledger: ledger(), bankFacts: bankFacts() }));

    const internal = await store.getLedger();
    expect(internal.bankFacts).toEqual(bankFacts());
    expect(store.publicLedgerDocument(internal)).toEqual({ version: 2, ledger: ledger() });
    expect(store.publicLedgerDocument(internal)).not.toHaveProperty('bankFacts');
  });

  it('rejects malformed nested fact stores instead of accepting partial evidence', async () => {
    const { directory, store } = await isolatedStore();
    const malformed = bankFacts() as unknown as { current: { accounts: Record<string, unknown> } };
    malformed.current.accounts.wrongKey = malformed.current.accounts.account;
    delete malformed.current.accounts.account;
    await writeFile(join(directory, 'ledger.json'), JSON.stringify({ version: 2, ledger: ledger(), bankFacts: malformed }));

    await expect(store.getLedger()).rejects.toMatchObject({
      name: 'StoreError', message: 'Stored ledger.json has an invalid shape', status: 500,
    });
  });

  it('validates and retains explainable transaction projection fields', async () => {
    const { directory, store } = await isolatedStore();
    const projected = ledger();
    projected.transactions = [{
      id: 'transaction', accountId: 'account', categoryId: 'dining', date: '2026-08-30',
      authorizedDate: '2026-08-29', amount: -2_500, currency: 'USD', payee: 'Restaurant', pending: false,
      classification: {
        source: 'provider', provider: 'plaid', taxonomy: 'personal_finance_category', taxonomyVersion: 'v2',
        mappingVersion: 'ledger-pfc-v2-1', primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_RESTAURANTS',
        confidence: 'VERY_HIGH',
      },
      reviewedAt: '2026-08-30T12:00:00.000Z',
    }];
    await writeFile(join(directory, 'ledger.json'), JSON.stringify({ version: 2, ledger: projected }));

    await expect(store.getLedger()).resolves.toMatchObject({ ledger: { transactions: projected.transactions } });

    const invalid = structuredClone(projected) as unknown as { transactions: Array<Record<string, unknown>> };
    invalid.transactions[0]!.classification = { source: 'provider', provider: 'plaid', confidence: 99 };
    await writeFile(join(directory, 'ledger.json'), JSON.stringify({ version: 3, ledger: invalid }));
    await expect(store.getLedger()).rejects.toMatchObject({ name: 'StoreError', status: 500 });

    const invalidReview = structuredClone(projected) as unknown as { transactions: Array<Record<string, unknown>> };
    invalidReview.transactions[0]!.reviewedAt = 'August 30';
    await writeFile(join(directory, 'ledger.json'), JSON.stringify({ version: 4, ledger: invalidReview }));
    await expect(store.getLedger()).rejects.toMatchObject({ name: 'StoreError', status: 500 });
  });

  it('preserves facts across owner writes and rejects attempts to forge them inside the owner ledger', async () => {
    const { directory, store } = await isolatedStore();
    await writeFile(join(directory, 'ledger.json'), JSON.stringify({ version: 2, ledger: ledger(), bankFacts: bankFacts() }));
    const ownerEdit = { ...ledger(), settings: { ...ledger().settings, name: 'Edited' } };

    await expect(store.putLedger(2, ownerEdit)).resolves.toMatchObject({ version: 3, ledger: ownerEdit });
    expect((await store.getLedger()).bankFacts).toEqual(bankFacts());

    const forged = { ...ownerEdit, bankFacts: { schemaVersion: 999 } } as unknown as Ledger;
    await expect(store.putLedger(3, forged)).rejects.toMatchObject({ name: 'StoreError', status: 400 });
    expect((await store.getLedger()).bankFacts).toEqual(bankFacts());
  });

  it('atomically updates the projection and facts in one serialized document write', async () => {
    const { directory, store } = await isolatedStore();
    await writeFile(join(directory, 'ledger.json'), JSON.stringify({ version: 4, ledger: ledger() }));
    const facts = bankFacts();

    await store.updateLedger((current, currentFacts) => {
      expect(currentFacts).toEqual({
        schemaVersion: 1, observations: {}, current: { accounts: {}, transactions: {} },
        history: [], tombstones: [], syncReceipts: [],
      });
      return {
        ledger: { ...current, settings: { ...current.settings, name: 'Projected' } },
        bankFacts: facts,
      };
    });

    const stored = JSON.parse(await readFile(join(directory, 'ledger.json'), 'utf8')) as Record<string, unknown>;
    expect(stored).toMatchObject({ version: 5, ledger: { settings: { name: 'Projected' } }, bankFacts: facts });
  });

  it('never exposes facts in stale-write conflicts or restore responses', async () => {
    const { directory, store } = await isolatedStore();
    await writeFile(join(directory, 'ledger.json'), JSON.stringify({ version: 4, ledger: ledger(), bankFacts: bankFacts() }));

    const conflict = await store.putLedger(3, ledger()).catch((error: unknown) => error) as Record<string, unknown>;
    expect(conflict).toMatchObject({ name: 'StoreError', status: 409, version: 4, ledger: ledger() });
    expect(conflict).not.toHaveProperty('bankFacts');

    await mkdir(join(directory, 'backups'));
    const name = 'ledger-2026-08-30.pre-provider-facts.json';
    await writeFile(join(directory, 'backups', name), JSON.stringify({ version: 2, ledger: ledger(), bankFacts: bankFacts() }));
    const restored = await store.restoreBackup(name);
    expect(restored).not.toHaveProperty('bankFacts');
    expect((await store.getLedger()).bankFacts).toEqual(bankFacts());
  });

  it('normalizes pre-domain account currency, connection identity, and transaction provenance', async () => {
    const { directory, store } = await isolatedStore();
    const legacy = ledger() as unknown as Record<string, unknown>;
    legacy.accounts = [{
      id: 'account', name: 'Checking', kind: 'checking', opening: 0, institution: 'Bank',
      external: { provider: 'plaid', itemId: 'connection', accountId: 'provider-account' },
    }];
    legacy.transactions = [{
      id: 'transaction', accountId: 'account', categoryId: 'uncategorized', date: '2026-08-30',
      amount: -100, payee: 'Merchant', externalId: 'provider-transaction',
    }];
    await writeFile(join(directory, 'ledger.json'), JSON.stringify({ version: 3, ledger: legacy }));

    const loaded = await store.getLedger();
    expect(loaded.ledger?.accounts[0]).toMatchObject({
      currency: 'USD',
      external: { provider: 'plaid', connectionId: 'connection', accountId: 'provider-account' },
    });
    expect(loaded.ledger?.transactions[0]?.bank).toEqual({
      provider: 'plaid', connectionId: 'connection', transactionId: 'provider-transaction',
    });
  });

  it('rejects valid JSON whose nested ledger fields do not match the persisted Ledger shape', async () => {
    const { directory, store } = await isolatedStore();
    await writeFile(join(directory, 'ledger.json'), JSON.stringify({
      version: 1,
      ledger: { ...ledger(), accounts: [{ id: 'a', name: 'Checking', kind: 'checking', opening: '100', institution: 'Bank', currency: 'USD' }] },
    }));

    await expect(store.getLedger()).rejects.toMatchObject({
      name: 'StoreError',
      message: 'Stored ledger.json has an invalid shape',
      status: 500,
    });
  });

  it('validates the full backup before restoring and leaves the current document unchanged', async () => {
    const { directory, store } = await isolatedStore();
    await writeFile(join(directory, 'ledger.json'), JSON.stringify({ version: 4, ledger: ledger() }));
    await mkdir(join(directory, 'backups'));
    const name = 'ledger-2026-08-30.json';
    await writeFile(join(directory, 'backups', name), JSON.stringify({
      version: 2,
      ledger: { ...ledger(), budgets: [{ id: 'budget', categoryId: 'uncategorized', limit: '500' }] },
    }));

    await expect(store.restoreBackup(name)).rejects.toMatchObject({ name: 'StoreError', status: 404 });
    expect(JSON.parse(await readFile(join(directory, 'ledger.json'), 'utf8'))).toMatchObject({ version: 4 });
  });

  it('rejects malformed nested bank-connection persistence instead of normalizing it', async () => {
    const { directory, store } = await isolatedStore();
    await writeFile(join(directory, 'items.json'), JSON.stringify([{
      id: 'connection',
      institution: 'Bank',
      provider: 'plaid',
      environment: 'production',
      status: 'ok',
      checkpoint: null,
      accounts: [{ id: 'account', name: 'Checking', balanceMinor: 10.5 }],
    }]));

    await expect(store.loadConnections()).rejects.toMatchObject({
      name: 'StoreError',
      message: 'Stored items.json has an invalid shape',
      status: 500,
    });
  });
});

describe('backup filesystem errors', () => {
  it('treats only a missing backup directory as an empty list', async () => {
    const { directory, store } = await isolatedStore();
    await expect(store.listBackups()).resolves.toEqual([]);
    await writeFile(join(directory, 'backups'), 'not a directory');
    await expect(store.listBackups()).rejects.toMatchObject({ code: 'ENOTDIR' });
  });

  it('surfaces an unreadable backup target instead of treating it as absent', async () => {
    const { directory, store } = await isolatedStore();
    await writeFile(join(directory, 'ledger.json'), JSON.stringify({ version: 1, ledger: ledger() }));
    await mkdir(join(directory, 'backups'));
    const target = join(directory, 'backups', `ledger-${new Date().toISOString().slice(0, 10)}.json`);
    await symlink(target, target);

    await expect(store.putLedger(1, ledger())).rejects.toMatchObject({ code: 'ELOOP' });
    expect(JSON.parse(await readFile(join(directory, 'ledger.json'), 'utf8'))).toMatchObject({ version: 1 });
  });
});

describe('encryption-key initialization', () => {
  it('converges concurrent processes on the exclusively created winning key', async () => {
    delete process.env.LEDGER_KEY;
    const directory = await mkdtemp(join(tmpdir(), 'nisli-ledger-key-race-'));
    temporaryDirectories.push(directory);
    process.env.LEDGER_DATA_DIR = directory;
    const workers = 12;
    const source = `
      import { readdirSync, writeFileSync } from 'node:fs';
      import { join } from 'node:path';
      const directory = process.env.LEDGER_DATA_DIR;
      writeFileSync(join(directory, 'ready-' + process.pid), '');
      while (readdirSync(directory).filter((name) => name.startsWith('ready-')).length < ${workers}) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
      }
      const { encrypt } = await import('./server/crypto.ts');
      console.log(encrypt('production-token'));
    `;
    const environment: NodeJS.ProcessEnv = { LEDGER_DATA_DIR: directory };
    if (process.env.PATH) environment.PATH = process.env.PATH;
    const run = promisify(execFile);
    const results = await Promise.all(Array.from({ length: workers }, () => run(
      'bun',
      ['--no-env-file', '-e', source],
      { cwd: join(import.meta.dirname, '..'), env: environment },
    )));

    vi.resetModules();
    const crypto = await import('./crypto.ts');
    for (const result of results) expect(crypto.decrypt(result.stdout.trim())).toBe('production-token');
    expect((await readFile(join(directory, '.key'), 'utf8')).trim()).toMatch(/^[0-9a-f]{64}$/);
  });
});
