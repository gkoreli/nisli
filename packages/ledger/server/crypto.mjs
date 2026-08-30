/**
 * AES-256-GCM at rest for provider access tokens (TENETS §4).
 *
 * Key: LEDGER_KEY env (64 hex chars) if set; otherwise generated once into
 * server/data/.key (mode 0o600). Ciphertext format: "v1:<iv>:<tag>:<data>" (hex).
 */
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY_FILE = join(dirname(fileURLToPath(import.meta.url)), 'data', '.key');
let key;

function loadKey() {
  if (key) return key;
  const env = process.env.LEDGER_KEY ?? '';
  if (env) {
    if (!/^[0-9a-fA-F]{64}$/.test(env)) throw new Error('LEDGER_KEY must be 64 hex chars');
    return (key = Buffer.from(env, 'hex'));
  }
  try {
    const hex = readFileSync(KEY_FILE, 'utf8').trim();
    if (/^[0-9a-fA-F]{64}$/.test(hex)) return (key = Buffer.from(hex, 'hex'));
    throw new Error('Stored Ledger encryption key is invalid; refusing to replace it');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  key = randomBytes(32);
  mkdirSync(dirname(KEY_FILE), { recursive: true });
  writeFileSync(KEY_FILE, key.toString('hex') + '\n', { mode: 0o600 });
  return key;
}

export function encrypt(plain) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', loadKey(), iv);
  const data = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return `v1:${iv.toString('hex')}:${c.getAuthTag().toString('hex')}:${data.toString('hex')}`;
}

export function decrypt(sealed) {
  const [v, iv, tag, data] = String(sealed).split(':');
  if (v !== 'v1' || !iv || !tag || !data) throw new Error('Unrecognised sealed token');
  const d = createDecipheriv('aes-256-gcm', loadKey(), Buffer.from(iv, 'hex'));
  d.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([d.update(Buffer.from(data, 'hex')), d.final()]).toString('utf8');
}

export const isSealed = (s) => typeof s === 'string' && s.startsWith('v1:');
