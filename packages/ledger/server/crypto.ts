/**
 * AES-256-GCM at rest for provider access tokens (TENETS §4).
 *
 * Key: LEDGER_KEY env (64 hex chars) if set; otherwise generated once into
 * server/data/.key (mode 0o600). Ciphertext format: "v1:<iv>:<tag>:<data>" (hex).
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { closeSync, fsyncSync, linkSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function dataDirectory(): string {
  const configured = process.env.LEDGER_DATA_DIR?.trim();
  if (!configured) return join(dirname(fileURLToPath(import.meta.url)), 'data');
  if (!isAbsolute(configured)) throw new Error('LEDGER_DATA_DIR must be an absolute path');
  const directory = resolve(configured);
  if (directory === parse(directory).root) throw new Error('LEDGER_DATA_DIR cannot be a filesystem root');
  return directory;
}

const KEY_FILE = join(dataDirectory(), '.key');
let key: Buffer | undefined;

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;
}

function loadKey(): Buffer {
  if (key) return key;
  const env = process.env.LEDGER_KEY ?? '';
  if (env) {
    if (!/^[0-9a-fA-F]{64}$/.test(env)) throw new Error('LEDGER_KEY must be 64 hex chars');
    key = Buffer.from(env, 'hex');
    return key;
  }
  const readStoredKey = (): Buffer => {
    const hex = readFileSync(KEY_FILE, 'utf8').trim();
    if (/^[0-9a-fA-F]{64}$/.test(hex)) {
      return Buffer.from(hex, 'hex');
    }
    throw new Error('Stored Ledger encryption key is invalid; refusing to replace it');
  };
  try {
    key = readStoredKey();
    return key;
  } catch (error: unknown) {
    if (errorCode(error) !== 'ENOENT') throw error;
  }
  const generated = randomBytes(32);
  mkdirSync(dirname(KEY_FILE), { recursive: true });
  // Write and sync a private inode before making it visible at KEY_FILE.
  // Opening KEY_FILE itself with `wx` is not enough: another process can see
  // that directory entry while its contents are still being written.
  const temporary = `${KEY_FILE}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    const handle = openSync(temporary, 'wx', 0o600);
    try {
      writeFileSync(handle, `${generated.toString('hex')}\n`);
      fsyncSync(handle);
    } finally {
      closeSync(handle);
    }
    try {
      // A hard link is an atomic, no-clobber publication. Exactly one starter
      // wins; every loser can immediately read the already-complete inode.
      linkSync(temporary, KEY_FILE);
      key = generated;
    } catch (error: unknown) {
      if (errorCode(error) !== 'EEXIST') throw error;
      key = readStoredKey();
    }
  } finally {
    try {
      unlinkSync(temporary);
    } catch (error: unknown) {
      if (errorCode(error) !== 'ENOENT') throw error;
    }
  }
  return key;
}

export function encrypt(plain: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', loadKey(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${data.toString('hex')}`;
}

export function decrypt(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(':');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unrecognised sealed token');
  const decipher = createDecipheriv('aes-256-gcm', loadKey(), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
}

export function isSealed(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('v1:');
}
