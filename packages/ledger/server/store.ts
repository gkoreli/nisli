/**
 * The system of record: the ledger document, its version, atomic writes,
 * dated backups and restore (TENETS §2, §3). Also the bank-item store, with
 * provider access tokens sealed at rest (TENETS §4).
 */
import { copyFile, mkdir, open, readFile, readdir, rename, stat, unlink } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Ledger } from '../src/data/model.ts';
import { canSynchronize, mergeOwnerLedgerWrite, normalizeConnection } from './banking/domain.ts';
import type { BankConnection, BankConnectionInput } from './banking/domain.ts';
import { decrypt, encrypt, isSealed } from './crypto.ts';

export interface LedgerDocument {
  version: number;
  ledger: Ledger | null;
  savedAt?: string;
  restoredFrom?: string;
}

export interface LedgerSnapshot {
  version: number;
  ledger: Ledger;
}

export interface LedgerUpdateResult extends LedgerSnapshot {
  backup?: string;
}

export interface BackupView {
  name: string;
  date: string;
  bytes: number;
}

export interface ConnectionOptions {
  liveProvider?: string;
  liveEnvironment?: string;
}

export class StoreError extends Error {
  readonly status: number;
  readonly version: number | undefined;
  readonly ledger: Ledger | null | undefined;

  constructor(message: string, status: number, extra: Record<string, unknown> = {}) {
    super(message);
    this.name = 'StoreError';
    this.status = status;
    this.version = typeof extra.version === 'number' ? extra.version : undefined;
    this.ledger = extra.ledger === null || isRecord(extra.ledger) ? extra.ledger as Ledger | null : undefined;
    Object.assign(this, extra);
  }
}

function dataDirectory(): string {
  const configured = process.env.LEDGER_DATA_DIR?.trim();
  if (!configured) return join(dirname(fileURLToPath(import.meta.url)), 'data');
  if (!isAbsolute(configured)) throw new Error('LEDGER_DATA_DIR must be an absolute path');
  const directory = resolve(configured);
  if (directory === parse(directory).root) throw new Error('LEDGER_DATA_DIR cannot be a filesystem root');
  return directory;
}

export const DATA_DIR = dataDirectory();
const LEDGER_FILE = join(DATA_DIR, 'ledger.json');
const ITEMS_FILE = join(DATA_DIR, 'items.json');
export const BACKUP_DIR = join(DATA_DIR, 'backups');
const KEEP_BACKUPS = 30;
const DAILY = /^ledger-(\d{4}-\d{2}-\d{2})\.json$/;
const ANY_BACKUP = /^ledger-(\d{4}-\d{2}-\d{2})(?:\.(pre-[a-z-]+)(?:-\d+)?)?\.json$/;

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;
}

async function readJson(file: string): Promise<unknown>;
async function readJson<T>(file: string, fallback: T): Promise<unknown | T>;
async function readJson<T>(file: string, fallback?: T): Promise<unknown | T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as unknown;
  } catch (error: unknown) {
    if (errorCode(error) === 'ENOENT') return fallback;
    if (error instanceof SyntaxError) throw new StoreError(`Stored ${basename(file)} is not valid JSON`, 500);
    throw error;
  }
}

/** Durable before acknowledged: fsync a private temp file, rename, then fsync its directory. */
async function writeAtomic(file: string, value: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    const handle = await open(temporary, 'w', 0o600);
    try {
      await handle.writeFile(JSON.stringify(value, null, 2));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, file);
    const directory = await open(dirname(file), 'r');
    try {
      await directory.sync();
    } catch {
      // Not every filesystem permits directory fsync.
    } finally {
      await directory.close();
    }
  } catch (error: unknown) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

const today = (): string => new Date().toISOString().slice(0, 10);
let mutationChain: Promise<void> = Promise.resolve();

/** Serialise all ledger mutations so version checks and file renames never interleave. */
function serial<T>(work: () => Promise<T>): Promise<T> {
  const result = mutationChain.then(work, work);
  mutationChain = result.then(() => undefined, () => undefined);
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLedgerDocument(value: unknown): value is LedgerDocument {
  return isRecord(value) && typeof value.version === 'number' && Object.hasOwn(value, 'ledger');
}

// ── Ledger document ──────────────────────────────────────────────────
async function readDoc(): Promise<LedgerDocument> {
  const document = await readJson(LEDGER_FILE, null);
  if (document === null) return { version: 0, ledger: null };
  if (!isLedgerDocument(document)) throw new StoreError('Stored ledger.json has an invalid shape', 500);
  return document;
}

export const getLedger = (): Promise<LedgerDocument> => readDoc();

async function pruneBackups(): Promise<void> {
  const names = (await readdir(BACKUP_DIR).catch(() => []))
    .filter((name) => DAILY.test(name))
    .sort()
    .reverse();
  await Promise.all(names.slice(KEEP_BACKUPS).map((name) => unlink(join(BACKUP_DIR, name)).catch(() => undefined)));
}

async function backupToday(): Promise<void> {
  const target = join(BACKUP_DIR, `ledger-${today()}.json`);
  await mkdir(BACKUP_DIR, { recursive: true });
  try {
    await stat(target);
    return;
  } catch {
    // First write today.
  }
  try {
    await copyFile(LEDGER_FILE, target);
  } catch {
    return; // Nothing stored yet.
  }
  await pruneBackups();
}

async function backupNamed(label: string): Promise<string> {
  if (!/^pre-[a-z-]+$/.test(label)) throw new StoreError('Invalid backup label', 400);
  await mkdir(BACKUP_DIR, { recursive: true });
  let target = join(BACKUP_DIR, `ledger-${today()}.${label}.json`);
  for (let index = 1; await stat(target).then(() => true, () => false); index++) {
    target = join(BACKUP_DIR, `ledger-${today()}.${label}-${index}.json`);
  }
  await copyFile(LEDGER_FILE, target);
  const backup = await open(target, 'r');
  try {
    await backup.sync();
  } finally {
    await backup.close();
  }
  const directory = await open(BACKUP_DIR, 'r');
  try {
    await directory.sync();
  } catch {
    // Not every filesystem permits directory fsync.
  } finally {
    await directory.close();
  }
  return basename(target);
}

export function putLedger(version: number, ledger: Ledger): Promise<LedgerSnapshot> {
  return serial(async () => {
    const current = await readDoc();
    if (version !== current.version) {
      throw new StoreError('Stale version — reload and retry', 409, { ...current });
    }
    await backupToday();
    const accepted = mergeOwnerLedgerWrite(current.ledger, ledger) as Ledger;
    const next: LedgerDocument = {
      version: current.version + 1,
      ledger: accepted,
      savedAt: new Date().toISOString(),
    };
    await writeAtomic(LEDGER_FILE, next);
    return { version: next.version, ledger: accepted };
  });
}

/** Atomically replace the current ledger from a trusted server-side operation. */
export function updateLedger(
  update: (ledger: Ledger) => Ledger | Promise<Ledger>,
  { backupLabel }: { backupLabel?: string } = {},
): Promise<LedgerUpdateResult> {
  return serial(async () => {
    const current = await readDoc();
    if (current.ledger === null) throw new StoreError('Ledger is not initialized', 409, { ...current });
    const ledger = await update(structuredClone(current.ledger));
    const backup = backupLabel ? await backupNamed(backupLabel) : (await backupToday(), undefined);
    const next: LedgerDocument = {
      version: current.version + 1,
      ledger,
      savedAt: new Date().toISOString(),
    };
    await writeAtomic(LEDGER_FILE, next);
    return { version: next.version, ledger, ...(backup ? { backup } : {}) };
  });
}

export async function listBackups(): Promise<BackupView[]> {
  const names = (await readdir(BACKUP_DIR).catch(() => [])).filter((name) => ANY_BACKUP.test(name));
  const backups = await Promise.all(names.map(async (name): Promise<BackupView> => {
    const match = ANY_BACKUP.exec(name);
    if (!match?.[1]) throw new StoreError('Stored backup has an invalid name', 500);
    return { name, date: match[1], bytes: (await stat(join(BACKUP_DIR, name))).size };
  }));
  return backups.sort((left, right) => (left.name < right.name ? 1 : left.name > right.name ? -1 : 0));
}

export function restoreBackup(name: string): Promise<LedgerSnapshot> {
  return serial(async () => {
    if (basename(name) !== name || !ANY_BACKUP.test(name)) throw new StoreError('Unknown backup', 400);
    const source = join(BACKUP_DIR, name);
    const stored = await readJson(source, null);
    if (!isLedgerDocument(stored) || !isRecord(stored.ledger)) throw new StoreError('Unknown backup', 404);
    const current = await readDoc();
    if (current.ledger !== null) await backupNamed('pre-restore');
    // The version keeps moving forward so a client holding the old number gets a clean 409, never a silent overwrite.
    const activeConnections = (await loadConnections()).filter(canSynchronize).map((connection) => connection.id);
    const restoredLedger: Ledger = { ...(stored.ledger as unknown as Ledger), pendingBankRebuild: activeConnections };
    const next: LedgerDocument = {
      version: current.version + 1,
      ledger: restoredLedger,
      savedAt: new Date().toISOString(),
      restoredFrom: name,
    };
    await writeAtomic(LEDGER_FILE, next);
    return { version: next.version, ledger: restoredLedger };
  });
}

// ── Bank connections (provider credentials sealed at rest) ──────────
/** Returns connections with credentials decrypted in memory and old Item shapes migrated. */
export async function loadConnections(
  { liveProvider = 'plaid', liveEnvironment = 'unknown' }: ConnectionOptions = {},
): Promise<BankConnection[]> {
  const stored = await readJson(ITEMS_FILE, []);
  if (!Array.isArray(stored)) throw new StoreError('Stored items.json has an invalid shape', 500);
  return stored.map((item) => {
    if (!isRecord(item)) throw new StoreError('Stored items.json has an invalid shape', 500);
    const decrypted = item.access_token && isSealed(item.access_token)
      ? { ...item, access_token: decrypt(item.access_token) }
      : item;
    // The persistence boundary validates the collection shape; the domain
    // normalizer owns migration and required-field normalization for each row.
    return normalizeConnection(decrypted as unknown as BankConnectionInput, { liveProvider, liveEnvironment });
  });
}

export async function saveConnections(connections: readonly BankConnectionInput[]): Promise<void> {
  await writeAtomic(ITEMS_FILE, connections.map((connection) => connection.access_token
    ? { ...connection, access_token: encrypt(connection.access_token) }
    : connection));
}

/** Serialize a connection mutation and always apply it to the latest file. */
export function updateConnections(
  update: (connections: BankConnection[]) => BankConnection[] | Promise<BankConnection[]>,
  options?: ConnectionOptions,
): Promise<BankConnection[]> {
  return serial(async () => {
    const current = await loadConnections(options);
    const next = await update(current);
    await saveConnections(next);
    return next;
  });
}
