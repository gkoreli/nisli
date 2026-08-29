/**
 * The system of record: the ledger document, its version, atomic writes,
 * dated backups and restore (TENETS §2, §3). Also the bank-item store, with
 * provider access tokens sealed at rest (TENETS §4).
 */
import { readFile, writeFile, rename, mkdir, readdir, stat, unlink, copyFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encrypt, decrypt, isSealed } from './crypto.mjs';

export const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data');
const LEDGER_FILE = join(DATA_DIR, 'ledger.json');
const ITEMS_FILE = join(DATA_DIR, 'items.json');
export const BACKUP_DIR = join(DATA_DIR, 'backups');
const KEEP_BACKUPS = 30;
const DAILY = /^ledger-(\d{4}-\d{2}-\d{2})\.json$/;
const ANY_BACKUP = /^ledger-(\d{4}-\d{2}-\d{2})(\.pre-restore(-\d+)?)?\.json$/;

export class StoreError extends Error { constructor(message, status, extra = {}) { super(message); this.status = status; Object.assign(this, extra); } }

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}
/** Durable before acknowledged: write a temp file, fsync-by-close, then rename over the target. */
async function writeAtomic(file, value) {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2));
  await rename(tmp, file);
}

const today = () => new Date().toISOString().slice(0, 10);
let chain = Promise.resolve();
/** Serialise all ledger mutations so version checks and file renames never interleave. */
const serial = (fn) => (chain = chain.then(fn, fn));

// ── Ledger document ──────────────────────────────────────────────────
async function readDoc() {
  const doc = await readJson(LEDGER_FILE, null);
  return doc && typeof doc.version === 'number' ? doc : { version: 0, ledger: null };
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

export function putLedger(version, ledger) {
  return serial(async () => {
    const current = await readDoc();
    if (version !== current.version) throw new StoreError('Stale version — reload and retry', 409, current);
    await backupToday();
    const next = { version: current.version + 1, ledger, savedAt: new Date().toISOString() };
    await writeAtomic(LEDGER_FILE, next);
    return { version: next.version };
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
    if (!doc || typeof doc.version !== 'number') throw new StoreError('Unknown backup', 404);
    const current = await readDoc();
    if (current.ledger !== null) {
      let pre = join(BACKUP_DIR, `ledger-${today()}.pre-restore.json`);
      for (let i = 1; await stat(pre).then(() => true, () => false); i++) pre = join(BACKUP_DIR, `ledger-${today()}.pre-restore-${i}.json`);
      await copyFile(LEDGER_FILE, pre);
    }
    // The version keeps moving forward so a client holding the old number gets a clean 409, never a silent overwrite.
    const next = { version: current.version + 1, ledger: doc.ledger, savedAt: new Date().toISOString(), restoredFrom: name };
    await writeAtomic(LEDGER_FILE, next);
    return { version: next.version, ledger: next.ledger };
  });
}

// ── Bank items (access tokens sealed at rest) ────────────────────────
/** Returns items with the token decrypted in memory only. Plaintext tokens found on disk are re-sealed on next save. */
export async function loadItems() {
  const items = await readJson(ITEMS_FILE, []);
  return items.map((it) => (it.access_token && isSealed(it.access_token) ? { ...it, access_token: decrypt(it.access_token) } : it));
}
export async function saveItems(items) {
  await writeAtomic(ITEMS_FILE, items.map((it) => (it.access_token ? { ...it, access_token: encrypt(it.access_token) } : it)));
}
export const publicItem = ({ access_token, ...item }) => item;
