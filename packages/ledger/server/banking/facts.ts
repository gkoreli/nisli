/**
 * Server-owned bank observations and normalized facts.
 *
 * This model is deliberately absent from `src/data/model.ts`: provider payloads
 * are durable evidence used to build the owner's Ledger projection, not part of
 * the browser's writable document. Provider credentials never belong here.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject { readonly [key: string]: JsonValue }

export type BankFactKind = 'account' | 'transaction';

/** One complete, unmodified JSON response received from a provider endpoint. */
export interface ProviderObservation {
  readonly id: string;
  readonly provider: string;
  readonly environment: string;
  readonly connectionId: string;
  readonly endpoint: string;
  readonly observedAt: string;
  readonly apiVersion?: string;
  readonly taxonomyVersion?: string;
  readonly requestId?: string;
  readonly payload: JsonObject;
}

/** A provider-independent fact derived from one raw observation. */
export interface BankFact {
  readonly id: string;
  readonly kind: BankFactKind;
  readonly providerId: string;
  readonly connectionId: string;
  readonly observationId: string;
  readonly observedAt: string;
  readonly value: JsonObject;
}

/** A previous fact retained when a newer observation supersedes it. */
export interface BankFactRevision {
  readonly fact: BankFact;
  readonly supersededAt: string;
  readonly supersededByObservationId: string;
}

/** Durable evidence that a provider removed or replaced a current fact. */
export interface BankFactTombstone {
  readonly id: string;
  readonly kind: BankFactKind;
  readonly providerId: string;
  readonly connectionId: string;
  readonly observationId: string;
  readonly removedAt: string;
  readonly reason: 'removed' | 'replaced' | 'inactive';
  readonly replacementProviderId?: string;
  readonly lastFact?: BankFact;
}

/** The evidence needed to explain and troubleshoot one completed sync. */
export interface BankSyncReceipt {
  readonly id: string;
  readonly provider: string;
  readonly environment: string;
  readonly connectionId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly complete: boolean;
  readonly updateStatus: string;
  readonly checkpointBefore?: JsonValue;
  readonly checkpointAfter?: JsonValue;
  readonly requestIds: readonly string[];
  readonly observationIds: readonly string[];
  readonly added: readonly string[];
  readonly modified: readonly string[];
  readonly removed: readonly string[];
}

/**
 * Embedded only in the persisted server document. Maps use stable, composite
 * fact ids so two connections can never alias the same provider identifier.
 */
export interface BankFactStore {
  readonly schemaVersion: 1;
  readonly observations: Readonly<Record<string, ProviderObservation>>;
  readonly current: {
    readonly accounts: Readonly<Record<string, BankFact>>;
    readonly transactions: Readonly<Record<string, BankFact>>;
  };
  readonly history: readonly BankFactRevision[];
  readonly tombstones: readonly BankFactTombstone[];
  readonly syncReceipts: readonly BankSyncReceipt[];
}

export const emptyBankFactStore = (): BankFactStore => ({
  schemaVersion: 1,
  observations: {},
  current: { accounts: {}, transactions: {} },
  history: [],
  tombstones: [],
  syncReceipts: [],
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isOptionalString = (value: unknown): value is string | undefined => value === undefined || isString(value);
const hasOnly = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).every((key) => keys.includes(key));

/** JSON.stringify-safe data: finite numbers, string keys, and no cycles. */
export function isJsonValue(value: unknown, stack = new WeakSet<object>(), depth = 0): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value) && !Object.is(value, -0);
  if (typeof value !== 'object' || depth > 100 || stack.has(value)) return false;
  stack.add(value);
  const valid = Array.isArray(value)
    ? Object.keys(value).length === value.length
      && value.every((entry) => isJsonValue(entry, stack, depth + 1))
    : (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
      && Reflect.ownKeys(value).every((key) => typeof key === 'string'
        && Object.prototype.propertyIsEnumerable.call(value, key))
      && Object.values(value).every((entry) => isJsonValue(entry, stack, depth + 1));
  stack.delete(value);
  return valid;
}

const isJsonObject = (value: unknown): value is JsonObject => isObject(value) && isJsonValue(value);

export function isProviderObservation(value: unknown): value is ProviderObservation {
  if (!isObject(value) || !hasOnly(value, [
    'id', 'provider', 'environment', 'connectionId', 'endpoint', 'observedAt',
    'apiVersion', 'taxonomyVersion', 'requestId', 'payload',
  ])) return false;
  return isString(value.id)
    && isString(value.provider)
    && isString(value.environment)
    && isString(value.connectionId)
    && isString(value.endpoint)
    && isString(value.observedAt)
    && isOptionalString(value.apiVersion)
    && isOptionalString(value.taxonomyVersion)
    && isOptionalString(value.requestId)
    && isJsonObject(value.payload);
}

export function isBankFact(value: unknown, kind?: BankFactKind): value is BankFact {
  if (!isObject(value) || !hasOnly(value, [
    'id', 'kind', 'providerId', 'connectionId', 'observationId', 'observedAt', 'value',
  ])) return false;
  return isString(value.id)
    && (value.kind === 'account' || value.kind === 'transaction')
    && (kind === undefined || value.kind === kind)
    && isString(value.providerId)
    && isString(value.connectionId)
    && isString(value.observationId)
    && isString(value.observedAt)
    && isJsonObject(value.value);
}

const isRevision = (value: unknown): value is BankFactRevision => isObject(value)
  && hasOnly(value, ['fact', 'supersededAt', 'supersededByObservationId'])
  && isBankFact(value.fact)
  && isString(value.supersededAt)
  && isString(value.supersededByObservationId);

const isTombstone = (value: unknown): value is BankFactTombstone => isObject(value)
  && hasOnly(value, [
    'id', 'kind', 'providerId', 'connectionId', 'observationId', 'removedAt',
    'reason', 'replacementProviderId', 'lastFact',
  ])
  && isString(value.id)
  && (value.kind === 'account' || value.kind === 'transaction')
  && isString(value.providerId)
  && isString(value.connectionId)
  && isString(value.observationId)
  && isString(value.removedAt)
  && (value.reason === 'removed' || value.reason === 'replaced' || value.reason === 'inactive')
  && isOptionalString(value.replacementProviderId)
  && (value.lastFact === undefined || isBankFact(value.lastFact, value.kind));

const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const isReceipt = (value: unknown): value is BankSyncReceipt => isObject(value)
  && hasOnly(value, [
    'id', 'provider', 'environment', 'connectionId', 'startedAt', 'completedAt',
    'complete', 'updateStatus', 'checkpointBefore', 'checkpointAfter', 'requestIds',
    'observationIds', 'added', 'modified', 'removed',
  ])
  && isString(value.id)
  && isString(value.provider)
  && isString(value.environment)
  && isString(value.connectionId)
  && isString(value.startedAt)
  && isString(value.completedAt)
  && typeof value.complete === 'boolean'
  && isString(value.updateStatus)
  && (value.checkpointBefore === undefined || isJsonValue(value.checkpointBefore))
  && (value.checkpointAfter === undefined || isJsonValue(value.checkpointAfter))
  && isStringList(value.requestIds)
  && isStringList(value.observationIds)
  && isStringList(value.added)
  && isStringList(value.modified)
  && isStringList(value.removed);

const isKeyed = <T>(
  value: unknown,
  validate: (entry: unknown) => entry is T,
  idOf: (entry: T) => string,
): value is Record<string, T> => isObject(value)
  && Object.entries(value).every(([key, entry]) => validate(entry) && idOf(entry) === key);

/** Strict authored schema with recursively validated, forward-compatible raw payloads. */
export function isBankFactStore(value: unknown): value is BankFactStore {
  if (!isObject(value) || !hasOnly(value, [
    'schemaVersion', 'observations', 'current', 'history', 'tombstones', 'syncReceipts',
  ]) || value.schemaVersion !== 1 || !isObject(value.current)
    || !hasOnly(value.current, ['accounts', 'transactions'])) return false;
  const structural = isKeyed(value.observations, isProviderObservation, (entry) => entry.id)
    && isKeyed(value.current.accounts, (entry): entry is BankFact => isBankFact(entry, 'account'), (entry) => entry.id)
    && isKeyed(value.current.transactions, (entry): entry is BankFact => isBankFact(entry, 'transaction'), (entry) => entry.id)
    && Array.isArray(value.history) && value.history.every(isRevision)
    && Array.isArray(value.tombstones) && value.tombstones.every(isTombstone)
    && Array.isArray(value.syncReceipts) && value.syncReceipts.every(isReceipt);
  if (!structural) return false;

  const store = value as unknown as BankFactStore;
  const observationMatches = (observationId: string, connectionId: string): boolean =>
    store.observations[observationId]?.connectionId === connectionId;
  const factMatches = (fact: BankFact): boolean => observationMatches(fact.observationId, fact.connectionId);
  return Object.values(store.current.accounts).every(factMatches)
    && Object.values(store.current.transactions).every(factMatches)
    && store.history.every((revision) => factMatches(revision.fact)
      && observationMatches(revision.supersededByObservationId, revision.fact.connectionId))
    && store.tombstones.every((tombstone) => observationMatches(tombstone.observationId, tombstone.connectionId)
      && (!tombstone.lastFact || tombstone.lastFact.connectionId === tombstone.connectionId && factMatches(tombstone.lastFact)))
    && store.syncReceipts.every((receipt) => receipt.observationIds.every((id) => observationMatches(id, receipt.connectionId)));
}
