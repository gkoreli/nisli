/**
 * The system of record: the ledger document, its version, atomic writes,
 * dated backups and restore (TENETS §2, §3). Also the bank-item store, with
 * provider access tokens sealed at rest (TENETS §4).
 */
import { copyFile, mkdir, open, readFile, readdir, rename, stat, unlink } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CategoryDecision, Ledger } from '../src/data/model.ts';
import { canSynchronize, mergeOwnerLedgerWrite, normalizeConnection } from './banking/domain.ts';
import type { BankConnection, BankConnectionInput } from './banking/domain.ts';
import { emptyBankFactStore, isBankFactStore, isJsonValue } from './banking/facts.ts';
import type { BankFactStore } from './banking/facts.ts';
import { decrypt, encrypt, isSealed } from './crypto.ts';

export interface LedgerDocument {
  version: number;
  ledger: Ledger | null;
  /** Server-only provider evidence. Never serialize through a public API. */
  bankFacts?: BankFactStore;
  savedAt?: string;
  restoredFrom?: string;
}

export interface PublicLedgerDocument {
  version: number;
  ledger: Ledger | null;
}

export interface InternalLedgerState {
  ledger: Ledger;
  bankFacts: BankFactStore;
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

const hasOnly = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).every((key) => keys.includes(key));

const isString = (value: unknown): value is string => typeof value === 'string';
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isInteger = (value: unknown): value is number => Number.isInteger(value);
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isOptional = <T>(value: unknown, validate: (candidate: unknown) => candidate is T): value is T | undefined => value === undefined || validate(value);
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const isOneOf = <T extends string>(values: readonly T[]) => (value: unknown): value is T => isString(value) && values.includes(value as T);

const isAccountKind = isOneOf(['checking', 'savings', 'credit', 'investment', 'loan'] as const);
const isConnectionStatus = isOneOf(['ok', 'error', 'reauth-required', 'disabled', 'disconnect-pending'] as const);

function isCategoryDecision(value: unknown): value is CategoryDecision {
  if (!isRecord(value) || !isString(value.source)) return false;
  if (value.source === 'owner') return hasOnly(value, ['source']);
  if (value.source === 'rule') return hasOnly(value, ['source', 'ruleId']) && isString(value.ruleId);
  if (value.source === 'provider') return hasOnly(value, [
    'source', 'provider', 'taxonomy', 'taxonomyVersion', 'mappingVersion',
    'primary', 'detailed', 'confidence',
  ])
    && isString(value.provider)
    && isString(value.taxonomy)
    && isString(value.taxonomyVersion)
    && isString(value.mappingVersion)
    && isString(value.primary)
    && isString(value.detailed)
    && (value.confidence === null || isString(value.confidence));
  return value.source === 'unassigned'
    && hasOnly(value, ['source', 'reason'])
    && isOneOf(['no-rule-or-provider-category', 'unmapped-provider-category'] as const)(value.reason);
}

function isAccount(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const external = value.external;
  return isString(value.id)
    && isString(value.name)
    && isAccountKind(value.kind)
    && isInteger(value.opening)
    && isString(value.institution)
    && isString(value.currency)
    && (external === undefined || (isRecord(external)
      && isString(external.provider)
      && isOptional(external.environment, isString)
      && isString(external.connectionId)
      && isString(external.accountId)
      && isOptional(external.status, isOneOf(['active', 'inactive'] as const))));
}

function isTransaction(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const bank = value.bank;
  return isString(value.id)
    && isString(value.accountId)
    && isString(value.categoryId)
    && isString(value.date)
    && isOptional(value.authorizedDate, isString)
    && isInteger(value.amount)
    && isOptional(value.currency, isString)
    && isString(value.payee)
    && isOptional(value.pending, isBoolean)
    && isOptional(value.note, isString)
    && isOptional(value.classification, isCategoryDecision)
    && isOptional(value.externalId, isString)
    && (bank === undefined || (isRecord(bank)
      && isString(bank.provider)
      && isOptional(bank.environment, isString)
      && isString(bank.connectionId)
      && isString(bank.transactionId)));
}

function isLedger(value: unknown): value is Ledger {
  if (!isRecord(value) || Object.hasOwn(value, 'bankFacts')) return false;
  const settings = value.settings;
  const sync = value.sync;
  const history = value.bankHistory;
  return Array.isArray(value.accounts) && value.accounts.every(isAccount)
    && Array.isArray(value.categories) && value.categories.every((category) => isRecord(category)
      && isString(category.id) && isString(category.name) && isOptional(category.income, isBoolean))
    && Array.isArray(value.transactions) && value.transactions.every(isTransaction)
    && Array.isArray(value.budgets) && value.budgets.every((budget) => isRecord(budget)
      && isString(budget.id) && isString(budget.categoryId) && isInteger(budget.limit))
    && Array.isArray(value.rules) && value.rules.every((rule) => isRecord(rule)
      && isString(rule.id) && isString(rule.match) && isString(rule.categoryId))
    && isRecord(settings)
    && isString(settings.name)
    && isString(settings.currency)
    && isString(settings.locale)
    && isOptional(settings.appearance, isOneOf(['system', 'light', 'dark'] as const))
    && (sync === undefined || (isRecord(sync) && Object.values(sync).every((entry) => isRecord(entry)
      && isString(entry.at) && isInteger(entry.added))))
    && (history === undefined || (Array.isArray(history) && history.every((entry) => isRecord(entry)
      && isString(entry.id)
      && isString(entry.observedAt)
      && isOneOf(['modified', 'removed', 'replaced'] as const)(entry.change)
      && isString(entry.provider)
      && isString(entry.environment)
      && isString(entry.connectionId)
      && isOptional(entry.transactionId, isString)
      && isOptional(entry.replacementId, isString)
      && isTransaction(entry.transaction))))
    && isOptional(value.pendingBankRebuild, isStringArray);
}

/** Normalize persisted shapes written before currency and explicit bank provenance. */
function normalizePersistedLedger(value: unknown): Ledger | undefined {
  if (!isRecord(value) || !isRecord(value.settings) || !isString(value.settings.currency)
    || !Array.isArray(value.accounts) || !Array.isArray(value.transactions)) return undefined;
  const currency = value.settings.currency;
  const accounts = value.accounts.map((account) => {
    if (!isRecord(account)) return account;
    const legacyExternal = isRecord(account.external) ? account.external : undefined;
    const connectionId = legacyExternal && (isString(legacyExternal.connectionId)
      ? legacyExternal.connectionId
      : isString(legacyExternal.itemId) ? legacyExternal.itemId : undefined);
    const external = legacyExternal && connectionId
      ? {
        provider: legacyExternal.provider,
        ...(isString(legacyExternal.environment) ? { environment: legacyExternal.environment } : {}),
        connectionId,
        accountId: legacyExternal.accountId,
        ...(isOneOf(['active', 'inactive'] as const)(legacyExternal.status) ? { status: legacyExternal.status } : {}),
      }
      : account.external;
    return {
      ...account,
      currency: isString(account.currency) ? account.currency : currency,
      ...(external === undefined ? {} : { external }),
    };
  });
  const accountById = new Map(accounts.filter(isRecord).map((account) => [account.id, account]));
  const transactions = value.transactions.map((transaction) => {
    if (!isRecord(transaction) || transaction.bank !== undefined || !isString(transaction.externalId)) return transaction;
    const account = accountById.get(transaction.accountId);
    const external = isRecord(account?.external) ? account.external : undefined;
    if (!external || !isString(external.provider) || !isString(external.connectionId)) return transaction;
    return {
      ...transaction,
      bank: {
        provider: external.provider,
        ...(isString(external.environment) ? { environment: external.environment } : {}),
        connectionId: external.connectionId,
        transactionId: transaction.externalId,
      },
    };
  });
  const normalized = { ...value, accounts, transactions };
  return isLedger(normalized) ? normalized : undefined;
}

function normalizeLedgerDocument(value: unknown): LedgerDocument | undefined {
  if (!isRecord(value) || !hasOnly(value, ['version', 'ledger', 'bankFacts', 'savedAt', 'restoredFrom'])
    || !isInteger(value.version) || value.version < 0
    || !isOptional(value.bankFacts, isBankFactStore)
    || !isOptional(value.savedAt, isString) || !isOptional(value.restoredFrom, isString)) return undefined;
  const ledger = value.ledger === null ? null : normalizePersistedLedger(value.ledger);
  if (ledger === undefined) return undefined;
  return {
    version: value.version,
    ledger,
    ...(value.bankFacts ? { bankFacts: structuredClone(value.bankFacts) } : {}),
    ...(isString(value.savedAt) ? { savedAt: value.savedAt } : {}),
    ...(isString(value.restoredFrom) ? { restoredFrom: value.restoredFrom } : {}),
  };
}

const isProviderObservationInput = (value: unknown): value is NonNullable<BankConnectionInput['accountObservation']> => isRecord(value)
  && isString(value.schema)
  && isString(value.schemaVersion)
  && isRecord(value.payload)
  && isJsonValue(value.payload);

function isProviderAccountInput(value: unknown): boolean {
  const source = isRecord(value) ? value.source : undefined;
  return isRecord(value)
    && isString(value.id)
    && isString(value.name)
    && isOptional(value.mask, isString)
    && isOptional(value.kind, isAccountKind)
    && isOptional(value.type, isString)
    && (value.subtype === undefined || value.subtype === null || isString(value.subtype))
    && isOptional(value.balanceMinor, isInteger)
    && isOptional(value.balance, isFiniteNumber)
    && isOptional(value.currency, isString)
    && (source === undefined || isProviderObservationInput(source));
}

function isBankConnectionInput(value: unknown): value is BankConnectionInput {
  const error = isRecord(value) ? value.error : undefined;
  return isRecord(value)
    && isString(value.id)
    && isString(value.institution)
    && isOptional(value.provider, isString)
    && isOptional(value.environment, isString)
    && isOptional(value.status, isConnectionStatus)
    && (value.checkpoint === undefined || value.checkpoint === null || isString(value.checkpoint))
    && (value.cursor === undefined || value.cursor === null || isString(value.cursor))
    && isOptional(value.createdAt, isString)
    && (value.accounts === undefined || (Array.isArray(value.accounts) && value.accounts.every(isProviderAccountInput)))
    && isOptional(value.access_token, isString)
    && isOptional(value.completionKey, isString)
    && isOptional(value.historyStatus, isString)
    && isOptional(value.accountObservation, isProviderObservationInput)
    && (error === undefined || (isRecord(error) && isString(error.code) && isString(error.message)));
}

// ── Ledger document ──────────────────────────────────────────────────
async function readDoc(): Promise<LedgerDocument> {
  const document = await readJson(LEDGER_FILE, null);
  if (document === null) return { version: 0, ledger: null };
  const normalized = normalizeLedgerDocument(document);
  if (!normalized) throw new StoreError('Stored ledger.json has an invalid shape', 500);
  return normalized;
}

export const getLedger = (): Promise<LedgerDocument> => readDoc();

/** Explicit public DTO: persistence metadata and provider evidence stay server-side. */
export const publicLedgerDocument = ({ version, ledger }: LedgerDocument): PublicLedgerDocument => ({ version, ledger });

async function pruneBackups(): Promise<void> {
  const names = (await readdir(BACKUP_DIR).catch((error: unknown) => {
    if (errorCode(error) === 'ENOENT') return [];
    throw error;
  }))
    .filter((name) => DAILY.test(name))
    .sort()
    .reverse();
  await Promise.all(names.slice(KEEP_BACKUPS).map((name) => unlink(join(BACKUP_DIR, name)).catch((error: unknown) => {
    if (errorCode(error) !== 'ENOENT') throw error;
  })));
}

async function backupToday(): Promise<void> {
  const target = join(BACKUP_DIR, `ledger-${today()}.json`);
  await mkdir(BACKUP_DIR, { recursive: true });
  try {
    await stat(target);
    return;
  } catch (error: unknown) {
    if (errorCode(error) !== 'ENOENT') throw error;
  }
  try {
    await copyFile(LEDGER_FILE, target);
  } catch (error: unknown) {
    if (errorCode(error) === 'ENOENT') return; // Nothing stored yet.
    throw error;
  }
  await pruneBackups();
}

async function backupNamed(label: string): Promise<string> {
  if (!/^pre-[a-z-]+$/.test(label)) throw new StoreError('Invalid backup label', 400);
  await mkdir(BACKUP_DIR, { recursive: true });
  let target = join(BACKUP_DIR, `ledger-${today()}.${label}.json`);
  for (let index = 1; await stat(target).then(() => true, (error: unknown) => {
    if (errorCode(error) === 'ENOENT') return false;
    throw error;
  }); index++) {
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
  } finally {
    await directory.close();
  }
  return basename(target);
}

export function putLedger(version: number, ledger: Ledger): Promise<LedgerSnapshot> {
  return serial(async () => {
    const current = await readDoc();
    if (version !== current.version) {
      throw new StoreError('Stale version — reload and retry', 409, { version: current.version, ledger: current.ledger });
    }
    if (!isLedger(ledger)) throw new StoreError('The owner ledger has an invalid shape', 400);
    await backupToday();
    const accepted = mergeOwnerLedgerWrite(current.ledger, ledger) as Ledger;
    const next: LedgerDocument = {
      version: current.version + 1,
      ledger: accepted,
      ...(current.bankFacts ? { bankFacts: current.bankFacts } : {}),
      savedAt: new Date().toISOString(),
    };
    await writeAtomic(LEDGER_FILE, next);
    return { version: next.version, ledger: accepted };
  });
}

/** Atomically replace the current ledger from a trusted server-side operation. */
export function updateLedger(
  update: (
    ledger: Ledger,
    bankFacts: BankFactStore,
  ) => Ledger | InternalLedgerState | Promise<Ledger | InternalLedgerState>,
  { backupLabel }: { backupLabel?: string } = {},
): Promise<LedgerUpdateResult> {
  return serial(async () => {
    const current = await readDoc();
    if (current.ledger === null) {
      throw new StoreError('Ledger is not initialized', 409, { version: current.version, ledger: current.ledger });
    }
    const existingFacts = structuredClone(current.bankFacts ?? emptyBankFactStore());
    const output = await update(structuredClone(current.ledger), existingFacts);
    const state = isRecord(output) && Object.hasOwn(output, 'ledger') && Object.hasOwn(output, 'bankFacts')
      ? output as unknown as InternalLedgerState
      : { ledger: output as Ledger, bankFacts: existingFacts };
    if (!isLedger(state.ledger) || !isBankFactStore(state.bankFacts)) {
      throw new StoreError('A trusted ledger update produced an invalid internal document', 500);
    }
    const backup = backupLabel ? await backupNamed(backupLabel) : (await backupToday(), undefined);
    const next: LedgerDocument = {
      version: current.version + 1,
      ledger: state.ledger,
      bankFacts: structuredClone(state.bankFacts),
      savedAt: new Date().toISOString(),
    };
    await writeAtomic(LEDGER_FILE, next);
    return { version: next.version, ledger: state.ledger, ...(backup ? { backup } : {}) };
  });
}

export async function listBackups(): Promise<BackupView[]> {
  const names = (await readdir(BACKUP_DIR).catch((error: unknown) => {
    if (errorCode(error) === 'ENOENT') return [];
    throw error;
  })).filter((name) => ANY_BACKUP.test(name));
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
    const normalized = normalizeLedgerDocument(stored);
    if (!normalized || normalized.ledger === null) throw new StoreError('Unknown backup', 404);
    const current = await readDoc();
    if (current.ledger !== null) await backupNamed('pre-restore');
    // The version keeps moving forward so a client holding the old number gets a clean 409, never a silent overwrite.
    const activeConnections = (await loadConnections()).filter(canSynchronize).map((connection) => connection.id);
    const restoredLedger: Ledger = { ...normalized.ledger, pendingBankRebuild: activeConnections };
    const next: LedgerDocument = {
      version: current.version + 1,
      ledger: restoredLedger,
      ...(normalized.bankFacts ? { bankFacts: normalized.bankFacts } : {}),
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
    if (!isBankConnectionInput(item)) throw new StoreError('Stored items.json has an invalid shape', 500);
    const decrypted = item.access_token && isSealed(item.access_token)
      ? { ...item, access_token: decrypt(item.access_token) }
      : item;
    // The persistence boundary validates the collection shape; the domain
    // normalizer owns migration and required-field normalization for each row.
    return normalizeConnection(decrypted, { liveProvider, liveEnvironment });
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
