import { emptyBankFactStore } from './facts.ts';
import type {
  BankFact,
  BankFactRevision,
  BankFactStore,
  BankFactTombstone,
  JsonObject,
  ProviderObservation as StoredObservation,
} from './facts.ts';
import type {
  BankConnection,
  BankSyncResult,
  ProviderAccount,
  ProviderObservation,
  ProviderRemoval,
  ProviderTransaction,
} from './domain.ts';

const key = (connectionId: string, kind: 'account' | 'transaction', providerId: string): string =>
  `${encodeURIComponent(connectionId)}:${kind}:${encodeURIComponent(providerId)}`;

const json = (value: object): JsonObject => JSON.parse(JSON.stringify(value)) as JsonObject;
const same = (left: JsonObject, right: JsonObject): boolean => JSON.stringify(left) === JSON.stringify(right);

interface ProjectionContext {
  connection: BankConnection;
  observedAt: string;
  sequence: number;
  observationIds: string[];
}

const retainObservation = (
  store: BankFactStore,
  context: ProjectionContext,
  providerId: string,
  source: ProviderObservation,
  taxonomyVersion?: string | null,
): { store: BankFactStore; observation: StoredObservation } => {
  const id = `${key(context.connection.id, 'transaction', providerId)}:observation:${context.observedAt}:${++context.sequence}`;
  const observation: StoredObservation = {
    id,
    provider: context.connection.provider,
    environment: context.connection.environment,
    connectionId: context.connection.id,
    endpoint: source.schema,
    observedAt: context.observedAt,
    apiVersion: source.schemaVersion,
    ...(taxonomyVersion ? { taxonomyVersion } : {}),
    payload: json(source.payload),
  };
  context.observationIds.push(id);
  return {
    observation,
    store: { ...store, observations: { ...store.observations, [id]: observation } },
  };
};

const accountValue = ({ source: _source, ...account }: ProviderAccount): JsonObject => json(account);
const transactionValue = ({ source: _source, ...transaction }: ProviderTransaction): JsonObject => json(transaction);

const upsert = (
  store: BankFactStore,
  kind: 'account' | 'transaction',
  providerId: string,
  value: JsonObject,
  observation: StoredObservation,
): BankFactStore => {
  const id = key(observation.connectionId, kind, providerId);
  const collection = store.current[kind === 'account' ? 'accounts' : 'transactions'];
  const previous = collection[id];
  const fact: BankFact = {
    id,
    kind,
    providerId,
    connectionId: observation.connectionId,
    observationId: observation.id,
    observedAt: observation.observedAt,
    value,
  };
  const history: readonly BankFactRevision[] = previous && !same(previous.value, value)
    ? [...store.history, { fact: previous, supersededAt: observation.observedAt, supersededByObservationId: observation.id }]
    : store.history;
  return {
    ...store,
    history,
    current: {
      ...store.current,
      [kind === 'account' ? 'accounts' : 'transactions']: { ...collection, [id]: fact },
    },
  };
};

const remove = (
  store: BankFactStore,
  context: ProjectionContext,
  providerId: string,
  observationId: string,
  reason: BankFactTombstone['reason'],
  replacementProviderId?: string,
): BankFactStore => {
  const id = key(context.connection.id, 'transaction', providerId);
  const previous = store.current.transactions[id];
  if (!previous && store.tombstones.some((entry) => entry.id === `${id}:tombstone:${observationId}`)) return store;
  const { [id]: _removed, ...transactions } = store.current.transactions;
  const tombstone: BankFactTombstone = {
    id: `${id}:tombstone:${observationId}`,
    kind: 'transaction',
    providerId,
    connectionId: context.connection.id,
    observationId,
    removedAt: context.observedAt,
    reason,
    ...(replacementProviderId ? { replacementProviderId } : {}),
    ...(previous ? { lastFact: previous } : {}),
  };
  return {
    ...store,
    current: { ...store.current, transactions },
    tombstones: [...store.tombstones, tombstone],
  };
};

/** Persist the exact provider evidence and its typed revisions independently of the browser projection. */
export function projectBankFacts(
  current: BankFactStore | undefined,
  connection: BankConnection,
  result: BankSyncResult,
  observedAt: string,
): BankFactStore {
  let store: BankFactStore = structuredClone(current ?? emptyBankFactStore());
  const context: ProjectionContext = { connection, observedAt, sequence: 0, observationIds: [] };
  const currentAccountIds = new Set(result.accounts.map((account) => key(connection.id, 'account', account.id)));

  if (result.accountObservation) {
    const retained = retainObservation(store, context, 'accounts-snapshot', result.accountObservation);
    store = retained.store;
  }
  for (const [index, page] of (result.receipt?.pages ?? []).entries()) {
    if (!page.source) continue;
    const retained = retainObservation(store, context, `sync-page-${index + 1}`, page.source, 'v2');
    store = retained.store;
  }

  for (const account of result.accounts) {
    if (!account.source) continue;
    const retained = retainObservation(store, context, account.id, account.source);
    store = upsert(retained.store, 'account', account.id, accountValue(account), retained.observation);
  }
  for (const [id, fact] of Object.entries(store.current.accounts)) {
    if (fact.connectionId !== connection.id || currentAccountIds.has(id)) continue;
    const { [id]: _inactive, ...accounts } = store.current.accounts;
    store = {
      ...store,
      current: { ...store.current, accounts },
      tombstones: [...store.tombstones, {
        id: `${id}:tombstone:${observedAt}`,
        kind: 'account',
        providerId: fact.providerId,
        connectionId: connection.id,
        observationId: fact.observationId,
        removedAt: observedAt,
        reason: 'inactive',
        lastFact: fact,
      }],
    };
  }

  const replacements = new Map([...result.added, ...result.modified]
    .flatMap((transaction) => transaction.replacesId ? [[transaction.replacesId, transaction.id] as const] : []));
  for (const transaction of [...result.added, ...result.modified]) {
    if (!transaction.source) continue;
    const retained = retainObservation(
      store,
      context,
      transaction.id,
      transaction.source,
      transaction.providerCategory?.version,
    );
    store = upsert(retained.store, 'transaction', transaction.id, transactionValue(transaction), retained.observation);
    if (transaction.replacesId) {
      store = remove(store, context, transaction.replacesId, retained.observation.id, 'replaced', transaction.id);
    }
  }
  for (const rawRemoval of result.removed) {
    const removal: ProviderRemoval = typeof rawRemoval === 'string' ? { id: rawRemoval } : rawRemoval;
    let observationId = store.current.transactions[key(connection.id, 'transaction', removal.id)]?.observationId;
    if (removal.source) {
      const retained = retainObservation(store, context, removal.id, removal.source);
      store = retained.store;
      observationId = retained.observation.id;
    }
    if (!observationId) continue;
    const replacement = replacements.get(removal.id);
    store = remove(store, context, removal.id, observationId, replacement ? 'replaced' : 'removed', replacement);
  }

  const requestIds = result.receipt?.pages.flatMap((page) => page.requestId ? [page.requestId] : []) ?? [];
  return {
    ...store,
    syncReceipts: [...store.syncReceipts, {
      id: `${encodeURIComponent(connection.id)}:sync:${observedAt}`,
      provider: connection.provider,
      environment: connection.environment,
      connectionId: connection.id,
      startedAt: observedAt,
      completedAt: observedAt,
      complete: result.complete,
      updateStatus: result.updateStatus,
      ...(connection.checkpoint === null ? {} : { checkpointBefore: connection.checkpoint }),
      ...(result.checkpoint === null ? {} : { checkpointAfter: result.checkpoint }),
      requestIds,
      observationIds: context.observationIds,
      added: result.added.map((transaction) => transaction.id),
      modified: result.modified.map((transaction) => transaction.id),
      removed: result.removed.map((removed) => typeof removed === 'string' ? removed : removed.id),
    }],
  };
}
