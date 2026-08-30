/**
 * The Ledger server's data endpoints. The server (on Goga's Mac) is the system
 * of record; the browser is a client that reads and writes through here.
 */
import type { Ledger } from './model.js';

export interface LedgerResponse { version: number; ledger: Ledger | null }
export interface BackupInfo { name: string; date: string; bytes: number }
export interface Health { ok: true; mode: 'mock' | 'plaid'; host: string; version: string }

/** Thrown by `putLedger` when the server holds a newer version; carries the server's state. */
export class ConflictError extends Error {
  constructor(public readonly version: number, public readonly ledger: Ledger | null) {
    super('The server has newer data.');
    this.name = 'ConflictError';
  }
}

const HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' } as const;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { ...HEADERS, ...(init?.headers ?? {}) } });
  if (res.status === 409) {
    const body = (await res.json()) as { version: number; ledger: Ledger | null };
    throw new ConflictError(body.version, body.ledger);
  }
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try { message = ((await res.json()) as { error?: { message?: string } }).error?.message ?? message; } catch { /* keep status text */ }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export const getHealth = () => request<Health>('/api/health');
export const getLedger = () => request<LedgerResponse>('/api/ledger');
export const putLedger = (version: number, ledger: Ledger) =>
  request<{ version: number; ledger?: Ledger }>('/api/ledger', { method: 'PUT', body: JSON.stringify({ version, ledger }) });
export const listBackups = () => request<BackupInfo[]>('/api/backups');
export const restoreBackup = (name: string) =>
  request<{ version: number; ledger: Ledger }>('/api/backups/restore', { method: 'POST', body: JSON.stringify({ name }) });
