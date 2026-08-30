/**
 * The system of record: the ledger document, its version, atomic writes,
 * dated backups and restore (TENETS §2, §3). Also the bank-item store, with
 * provider access tokens sealed at rest (TENETS §4).
 */
import { readFile, rename, mkdir, readdir, stat, unlink, copyFile, open } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encrypt, decrypt, isSealed } from './crypto.mjs';
import { canSynchronize, mergeOwnerLedgerWrite, normalizeConnection } from './banking/domain.mjs';

export const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data');
const LEDGER_FILE = join(DATA_DIR, 'ledger.json');
const ITEMS_FILE = join(DATA_DIR, 'items.json');
export const BACKUP_DIR = join(DATA_DIR, 'backups');
const KEEP_BACKUPS = 30;
const DAILY = /^ledger-(\d{4}-\d{2}-\d{2})\.json$/;
const ANY_BACKUP = /^ledger-(\d{4}-\d{2}-\d{2})(?:\.(pre-[a-z-]+)(?:-\d+)?)?\.json$/;

export class StoreError extends Error { constructor(message, status, extra = {}) { super(message); this.status = status; Object.assign(this, extra); } }

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    if (error instanceof SyntaxError) throw new StoreError(`Stored ${basename(file)} is not valid JSON`, 500);
    throw error;
  }
}
/** Durable before acknowledged: fsync a private temp file, rename, then fsync its directory. */
async function writeAtomic(file, value) {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    const handle = await open(tmp, 'w', 0o600);
    try {
      await handle.writeFile(JSON.stringify(value, null, 2));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(tmp, file);
    const directory = await open(dirname(file), 'r');
    try { await directory.sync(); } catch { /* not every filesystem permits directory fsync */ }
    finally { await directory.close(); }
  } catch (error) {
    await unlink(tmp).catch(() => {});
    throw error;
  }
}

const today = () => new Date().toISOString().slice(0, 10);
let chain = Promise.resolve();
/** Serialise all ledger mutations so version checks and file renames never interleave. */
const serial = (fn) => (chain = chain.then(fn, fn));

// ── Ledger document ──────────────────────────────────────────────────
async function readDoc() {
  const doc = await readJson(LEDGER_FILE, null);
  if (doc === null) return { version: 0, ledger: null };
  if (typeof doc.version !== 'number' || !Object.hasOwn(doc, 'ledger')) throw new StoreError('Stored ledger.json has an invalid shape', 500);
  return doc;
}
export const getLedger = () => readDoc();

async function pruneBackups() {
  const names = (await readdir(BACKUP_DIR).catch(() => [])).filter((n) => DAILY.test(n)).sort().reverse();
  await Promise.all(names.slice(KEEP_BACKUPS).map((n) => unlink(join(BACKUP_DIR, n)).catch(() => {})));
}
async function backupToday() {
  const target = join(BACKUP_DIR, `ledger-${today()}.json`);
  await mkdir(BACKUP_DIR, { recursive: true });
  try { await stat(target); return; } catch { /* first write today */ }
  try { await copyFile(LEDGER_FILE, target); } catch { return; } // nothing stored yet
  await pruneBackups();
}

async function backupNamed(label) {
  if (!/^pre-[a-z-]+$/.test(label)) throw new StoreError('Invalid backup label', 400);
  await mkdir(BACKUP_DIR, { recursive: true });
  let target = join(BACKUP_DIR, `ledger-${today()}.${label}.json`);
  for (let i = 1; await stat(target).then(() => true, () => false); i++) {
    target = join(BACKUP_DIR, `ledger-${today()}.${label}-${i}.json`);
  }
  await copyFile(LEDGER_FILE, target);
  const backup = await open(target, 'r');
  try { await backup.sync(); } finally { await backup.close(); }
  const directory = await open(BACKUP_DIR, 'r');
  try { await directory.sync(); } catch { /* not every filesystem permits directory fsync */ }
  finally { await directory.close(); }
  return basename(target);
}

export function putLedger(version, ledger) {
  return serial(async () => {
    const current = await readDoc();
    if (version !== current.version) throw new StoreError('Stale version — reload and retry', 409, current);
    await backupToday();
    const accepted = mergeOwnerLedgerWrite(current.ledger, ledger);
    const next = { version: current.version + 1, ledger: accepted, savedAt: new Date().toISOString() };
    await writeAtomic(LEDGER_FILE, next);
    return { version: next.version, ledger: next.ledger };
  });
}

/** Atomically replace the current ledger from a trusted server-side operation. */
export function updateLedger(update, { backupLabel } = {}) {
  return serial(async () => {
    const current = await readDoc();
    if (current.ledger === null) throw new StoreError('Ledger is not initialized', 409, current);
    const ledger = await update(structuredClone(current.ledger));
    const backup = backupLabel ? await backupNamed(backupLabel) : (await backupToday(), undefined);
    const next = { version: current.version + 1, ledger, savedAt: new Date().toISOString() };
    await writeAtomic(LEDGER_FILE, next);
    return { version: next.version, ledger: next.ledger, backup };
  });
}

export async function listBackups() {
  const names = (await readdir(BACKUP_DIR).catch(() => [])).filter((n) => ANY_BACKUP.test(n));
  const out = await Promise.all(names.map(async (name) => ({ name, date: ANY_BACKUP.exec(name)[1], bytes: (await stat(join(BACKUP_DIR, name))).size })));
  return out.sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
}

export function restoreBackup(name) {
  return serial(async () => {
    if (typeof name !== 'string' || basename(name) !== name || !ANY_BACKUP.test(name)) throw new StoreError('Unknown backup', 400);
    const src = join(BACKUP_DIR, name);
    const doc = await readJson(src, null);
    if (!doc || typeof doc.version !== 'number' || !doc.ledger || typeof doc.ledger !== 'object') throw new StoreError('Unknown backup', 404);
    const current = await readDoc();
    if (current.ledger !== null) await backupNamed('pre-restore');
    // The version keeps moving forward so a client holding the old number gets a clean 409, never a silent overwrite.
    const activeConnections = (await loadConnections()).filter(canSynchronize).map((connection) => connection.id);
    const restoredLedger = { ...doc.ledger, pendingBankRebuild: activeConnections };
    const next = { version: current.version + 1, ledger: restoredLedger, savedAt: new Date().toISOString(), restoredFrom: name };
    await writeAtomic(LEDGER_FILE, next);
    return { version: next.version, ledger: next.ledger };
  });
}

// ── Bank connections (provider credentials sealed at rest) ──────────
/** Returns connections with credentials decrypted in memory and old Item shapes migrated. */
export async function loadConnections({ liveProvider = 'plaid', liveEnvironment = 'unknown' } = {}) {
  const items = await readJson(ITEMS_FILE, []);
  if (!Array.isArray(items)) throw new StoreError('Stored items.json has an invalid shape', 500);
  return items.map((item) => {
    const decrypted = item.access_token && isSealed(item.access_token) ? { ...item, access_token: decrypt(item.access_token) } : item;
    return normalizeConnection(decrypted, { liveProvider, liveEnvironment });
  });
}
export async function saveConnections(connections) {
  await writeAtomic(ITEMS_FILE, connections.map((connection) => (connection.access_token
    ? { ...connection, access_token: encrypt(connection.access_token) }
    : connection)));
}
/** Serialize a connection mutation and always apply it to the latest file. */
export function updateConnections(update, options) {
  return serial(async () => {
    const current = await loadConnections(options);
    const next = await update(current);
    await saveConnections(next);
    return next;
  });
}
