/**
 * Bank-connectivity application service. Commands are serialized so link,
 * sync, disconnect and projection rebuild cannot interleave.
 */
import {
  canSynchronize,
  connectionView,
  financialBlank,
  financialComposition,
  isLiveConnection,
  normalizeConnection,
  projectBankSync,
} from './banking/domain.ts';
import type {
  BankConnection,
  BankConnectionInput,
  BankSyncResult,
  BankSyncSummary,
  ConnectionView,
  FinancialComposition,
  ProviderAccount,
  PublicBankingError,
} from './banking/domain.ts';
import type { Ledger } from '../src/data/model.ts';
import { emptyBankFactStore } from './banking/facts.ts';
import type { BankFactStore } from './banking/facts.ts';
import { createHash } from 'node:crypto';

export { projectBankSync, shouldRunDaily } from './banking/domain.ts';

type Awaitable<T> = T | Promise<T>;
type BankErrorLike = { code?: string; message?: string };
export type AuthenticatedBankConnection = BankConnection & { access_token: string };

export interface BankingProvider {
  name: string;
  env: string;
  linkToken(connection?: AuthenticatedBankConnection): Promise<{ link_token: string }>;
  exchange(body: LinkCompletion): Promise<BankConnectionInput>;
  accounts(connection: AuthenticatedBankConnection): Promise<{ accounts: ProviderAccount[]; institution?: string; source?: import('./banking/domain.ts').ProviderObservation }>;
  sync(connection: AuthenticatedBankConnection): Promise<BankSyncResult>;
  remove(connection: AuthenticatedBankConnection): Promise<void>;
}

export interface LinkCompletion extends Record<string, unknown> {
  public_token?: string;
  institution?: string;
}

export interface LedgerDocument {
  version: number;
  ledger: Ledger | null;
  bankFacts?: BankFactStore;
}

export interface LedgerUpdateResult extends LedgerDocument {
  backup?: string;
}

export interface BankingServiceDependencies {
  activeProvider: BankingProvider;
  providerFor(connection: BankConnection): BankingProvider;
  loadConnections(): Promise<BankConnection[]>;
  updateConnections(update: (connections: BankConnection[]) => Awaitable<BankConnection[]>): Promise<BankConnection[]>;
  getLedger(): Promise<LedgerDocument>;
  updateLedger(
    update: (ledger: Ledger, bankFacts: BankFactStore) => Awaitable<Ledger | { ledger: Ledger; bankFacts: BankFactStore }>,
    options?: { backupLabel?: string },
  ): Promise<LedgerUpdateResult>;
}

export interface PersistedSyncSummary extends BankSyncSummary {
  backup?: string;
}

export interface ConnectionSyncSummary extends PersistedSyncSummary {
  connectionId: string;
  ok: true;
}

export interface FailedConnectionSyncSummary {
  connectionId: string;
  ok: false;
  error: PublicBankingError;
}

export interface LiveDataReplacementSummary {
  added: number;
  modified: number;
  unmatched: number;
  removed: number;
  accounts: number;
  connections: number;
  backup?: string;
}

export interface BankingService {
  list(): Promise<ConnectionView[]>;
  composition(): Promise<FinancialComposition>;
  beginLink(connectionId?: string): Promise<{ link_token: string }>;
  connect(body: LinkCompletion): Promise<ConnectionView>;
  syncOne(connectionId: string): Promise<PersistedSyncSummary>;
  rebuildOne(connectionId: string): Promise<PersistedSyncSummary>;
  syncAll(): Promise<Array<ConnectionSyncSummary | FailedConnectionSyncSummary>>;
  useLiveDataOnly(): Promise<LiveDataReplacementSummary>;
  disconnect(connectionId: string): Promise<{ ok: true }>;
}

const asBankError = (error: unknown): BankErrorLike => error instanceof Error
  ? { code: 'code' in error && typeof error.code === 'string' ? error.code : undefined, message: error.message }
  : (typeof error === 'object' && error !== null ? error as BankErrorLike : {});
const publicError = (error: unknown): PublicBankingError => {
  const value = asBankError(error);
  return { code: value.code ?? 'SYNC_FAILED', message: value.message ?? 'Bank sync failed' };
};
const needsReauth = (error: unknown): boolean => ['ITEM_LOGIN_REQUIRED', 'INVALID_ACCESS_TOKEN'].includes(asBankError(error).code ?? '');

export class BankingError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 400, code = 'BANKING_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function createBankingService({ activeProvider, providerFor, loadConnections, updateConnections, getLedger, updateLedger }: BankingServiceDependencies): BankingService {
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const next = chain.then(work, work);
    chain = next;
    return next;
  };
  const getConnection = async (id: string): Promise<BankConnection> => {
    const connection = (await loadConnections()).find((candidate) => candidate.id === id);
    if (!connection) throw new BankingError('Unknown bank connection', 404, 'CONNECTION_NOT_FOUND');
    return normalizeConnection(connection, { liveProvider: activeProvider.name, liveEnvironment: activeProvider.env });
  };
  const authenticated = (connection: BankConnection): AuthenticatedBankConnection => {
    if (!connection.access_token) {
      throw new BankingError('Bank connection credentials are unavailable', 409, 'CONNECTION_CREDENTIAL_MISSING');
    }
    return connection as AuthenticatedBankConnection;
  };
  const recordFailure = async (connection: BankConnection, error: unknown): Promise<void> => {
    await updateConnections((current) => current.map((candidate) => candidate.id === connection.id ? {
      ...candidate,
      status: needsReauth(error) ? 'reauth-required' : 'error',
      error: publicError(error),
    } : candidate));
  };
  const persistResult = async (
    connection: BankConnection,
    result: BankSyncResult,
    { rebuild = false, backupLabel }: { rebuild?: boolean; backupLabel?: string } = {},
  ): Promise<PersistedSyncSummary> => {
    let summary!: BankSyncSummary;
    const updated = await updateLedger((ledger, bankFacts) => {
      const applied = projectBankSync(ledger, connection, result, { rebuild, bankFacts });
      summary = applied.summary;
      return { ledger: applied.ledger, bankFacts: applied.bankFacts };
    }, { backupLabel });
    await updateConnections((current) => current.map((candidate) => candidate.id === connection.id ? {
      ...candidate,
      provider: connection.provider,
      environment: connection.environment,
      accounts: result.accounts,
      ...(result.accountObservation ? { accountObservation: result.accountObservation } : {}),
      checkpoint: result.checkpoint ?? candidate.checkpoint,
      historyStatus: result.updateStatus ?? candidate.historyStatus,
      status: 'ok',
      error: undefined,
    } : candidate));
    return { ...summary, backup: updated.backup };
  };
  const syncConnection = async (
    connection: BankConnection,
    { rebuild = false, backupLabel }: { rebuild?: boolean; backupLabel?: string } = {},
  ): Promise<PersistedSyncSummary> => {
    try {
      const provider = providerFor(connection);
      const pendingRestore = (await getLedger()).ledger?.pendingBankRebuild?.includes(connection.id) ?? false;
      const effectiveRebuild = rebuild || pendingRestore;
      const input = effectiveRebuild ? { ...connection, checkpoint: null } : connection;
      const result = await provider.sync(authenticated(input));
      if (effectiveRebuild && result.historyReady !== true) {
        throw new BankingError(`${connection.institution} is still preparing historical transactions; sync again shortly`, 409, 'HISTORY_NOT_READY');
      }
      return await persistResult(connection, result, { rebuild: effectiveRebuild, backupLabel });
    } catch (error) {
      if (asBankError(error).code !== 'HISTORY_NOT_READY') await recordFailure(connection, error);
      throw error;
    }
  };

  return {
    list: async () => (await loadConnections()).filter(isLiveConnection).map(connectionView),

    composition: async () => {
      const [{ ledger }, connections] = await Promise.all([getLedger(), loadConnections()]);
      if (!ledger) return { accounts: { live: 0, legacy: 0, unowned: 0 }, transactions: { live: 0, legacy: 0, unowned: 0 }, history: 0, legacyConfiguration: 0 };
      return financialComposition(ledger, connections);
    },

    beginLink: (connectionId) => serial(async () => {
      if (!connectionId) return activeProvider.linkToken();
      const connection = await getConnection(connectionId);
      return providerFor(connection).linkToken(authenticated(connection));
    }),

    connect: (body) => serial(async () => {
      const completionKey = body.public_token
        ? createHash('sha256').update(body.public_token).digest('hex')
        : undefined;
      let connection: BankConnection | undefined;
      if (completionKey) {
        const completed = (await loadConnections()).find((connection) => connection.completionKey === completionKey);
        if (completed?.status === 'ok') return connectionView(completed);
        if (completed) {
          connection = normalizeConnection(completed, {
            liveProvider: activeProvider.name,
            liveEnvironment: activeProvider.env,
          });
        }
      }
      if (!connection) {
        const exchanged = await activeProvider.exchange(body);
        connection = normalizeConnection({
          ...exchanged,
          ...(completionKey ? { completionKey } : {}),
          status: 'error',
          error: {
            code: 'CONNECTION_ENRICHMENT_PENDING',
            message: 'Bank connection setup is incomplete; retry to finish',
          },
        }, {
          liveProvider: activeProvider.name,
          liveEnvironment: activeProvider.env,
        });
        // The encrypted connection store is the durability boundary for the
        // one-use public token. No provider enrichment may happen before it.
        await updateConnections((current) => [
          ...current.filter((candidate) => candidate.id !== connection!.id),
          connection!,
        ]);
      }
      try {
        const details = await providerFor(connection).accounts(authenticated(connection));
        const updated = await updateConnections((current) => current.map((candidate) => candidate.id === connection!.id
          ? {
            ...candidate,
            institution: details.institution || candidate.institution,
            accounts: details.accounts,
            ...(details.source ? { accountObservation: details.source } : {}),
            status: 'ok',
            error: undefined,
          }
          : candidate));
        return connectionView(updated.find((candidate) => candidate.id === connection!.id) ?? connection);
      } catch (error) {
        await recordFailure(connection, error);
        throw error;
      }
    }),

    syncOne: (connectionId) => serial(async () => syncConnection(await getConnection(connectionId))),

    rebuildOne: (connectionId) => serial(async () => {
      const connection = await getConnection(connectionId);
      return syncConnection(connection, { rebuild: true, backupLabel: 'pre-bank-rebuild' });
    }),

    syncAll: () => serial(async () => {
      const connections = await loadConnections();
      const summaries: Array<ConnectionSyncSummary | FailedConnectionSyncSummary> = [];
      for (const raw of connections) {
        const connection = normalizeConnection(raw, { liveProvider: activeProvider.name, liveEnvironment: activeProvider.env });
        if (!canSynchronize(connection)) continue;
        try {
          summaries.push({ connectionId: connection.id, ok: true, ...(await syncConnection(connection)) });
        } catch (error) {
          summaries.push({ connectionId: connection.id, ok: false, error: publicError(error) });
        }
      }
      return summaries;
    }),

    /**
     * Explicit recovery/migration command: fetch every live snapshot first,
     * then replace financial projections once, behind an always-created backup.
     * No new provider connection is created and retired mock metadata is dropped.
     */
    useLiveDataOnly: () => serial(async (): Promise<LiveDataReplacementSummary> => {
      const all = (await loadConnections()).map((connection) => normalizeConnection(connection, {
        liveProvider: activeProvider.name,
        liveEnvironment: activeProvider.env,
      }));
      const live = all.filter(isLiveConnection);
      if (!live.length) throw new BankingError('Connect a bank before replacing legacy sample data', 409, 'NO_LIVE_CONNECTION');
      const snapshots: Array<{ connection: BankConnection; result: BankSyncResult }> = [];
      for (const connection of live) {
        if (!canSynchronize(connection)) throw new BankingError(`${connection.institution} must be reconnected first`, 409, 'REAUTH_REQUIRED');
        try {
          const result = await providerFor(connection).sync(authenticated({ ...connection, checkpoint: null }));
          if (result.historyReady !== true) {
            throw new BankingError(`${connection.institution} is still preparing historical transactions; sync again shortly`, 409, 'HISTORY_NOT_READY');
          }
          snapshots.push({ connection, result });
        } catch (error) {
          if (asBankError(error).code !== 'HISTORY_NOT_READY') await recordFailure(connection, error);
          throw error;
        }
      }

      // Stage retired mock connections as disabled before changing the ledger.
      await updateConnections((current) => current.map((connection) => isLiveConnection(connection)
        ? connection
        : { ...connection, status: 'disabled', error: undefined }));

      const totals = { added: 0, modified: 0, unmatched: 0, removed: 0, accounts: 0 };
      const totalKeys = ['added', 'modified', 'unmatched', 'removed', 'accounts'] as const;
      const updated = await updateLedger((ledger) => {
        let projection = financialBlank(ledger);
        let bankFacts = emptyBankFactStore();
        for (const snapshot of snapshots) {
          const applied = projectBankSync(projection, snapshot.connection, snapshot.result, { rebuild: true, bankFacts });
          projection = applied.ledger;
          bankFacts = applied.bankFacts;
          for (const key of totalKeys) totals[key] += applied.summary[key];
        }
        return { ledger: projection, bankFacts };
      }, { backupLabel: 'pre-live-data' });

      await updateConnections(() => snapshots.map(({ connection, result }) => ({
        ...connection,
        accounts: result.accounts,
        ...(result.accountObservation ? { accountObservation: result.accountObservation } : {}),
        checkpoint: result.checkpoint ?? connection.checkpoint,
        historyStatus: result.updateStatus ?? connection.historyStatus,
        status: 'ok',
        error: undefined,
      })));
      return { ...totals, connections: live.length, backup: updated.backup };
    }),

    disconnect: (connectionId) => serial(async () => {
      const connection = await getConnection(connectionId);
      await updateConnections((current) => current.map((candidate) => candidate.id === connection.id
        ? { ...candidate, status: 'disabled', error: undefined }
        : candidate));
      try {
        await providerFor(connection).remove(authenticated(connection));
        await updateConnections((current) => current.filter((candidate) => candidate.id !== connection.id));
      } catch (error) {
        await updateConnections((current) => current.map((candidate) => candidate.id === connection.id
          ? { ...candidate, status: 'disconnect-pending', error: publicError(error) }
          : candidate));
        throw error;
      }
      return { ok: true };
    }),
  };
}
