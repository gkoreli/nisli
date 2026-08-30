import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import type { Ledger } from '../src/data/model.ts';

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
