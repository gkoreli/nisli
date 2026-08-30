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
} from './banking/domain.mjs';
import { createHash } from 'node:crypto';

export { projectBankSync, shouldRunDaily } from './banking/domain.mjs';

const publicError = (error) => ({ code: error?.code ?? 'SYNC_FAILED', message: error?.message ?? 'Bank sync failed' });
const needsReauth = (error) => ['ITEM_LOGIN_REQUIRED', 'INVALID_ACCESS_TOKEN'].includes(error?.code);

export class BankingError extends Error {
  constructor(message, status = 400, code = 'BANKING_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function createBankingService({ activeProvider, providerFor, loadConnections, updateConnections, getLedger, updateLedger }) {
  let chain = Promise.resolve();
  const serial = (work) => (chain = chain.then(work, work));
  const getConnection = async (id) => {
    const connection = (await loadConnections()).find((candidate) => candidate.id === id);
    if (!connection) throw new BankingError('Unknown bank connection', 404, 'CONNECTION_NOT_FOUND');
    return normalizeConnection(connection, { liveProvider: activeProvider.name, liveEnvironment: activeProvider.env });
  };
  const recordFailure = async (connection, error) => {
    await updateConnections((current) => current.map((candidate) => candidate.id === connection.id ? {
      ...candidate,
      status: needsReauth(error) ? 'reauth-required' : 'error',
      error: publicError(error),
    } : candidate));
  };
  const persistResult = async (connection, result, { rebuild = false, backupLabel } = {}) => {
    let summary;
    const updated = await updateLedger((ledger) => {
      const applied = projectBankSync(ledger, connection, result, { rebuild });
      summary = applied.summary;
      return applied.ledger;
    }, { backupLabel });
    await updateConnections((current) => current.map((candidate) => candidate.id === connection.id ? {
      ...candidate,
      provider: connection.provider,
      environment: connection.environment,
      accounts: result.accounts,
      checkpoint: result.checkpoint ?? candidate.checkpoint,
      historyStatus: result.updateStatus ?? candidate.historyStatus,
      status: 'ok',
      error: undefined,
    } : candidate));
    return { ...summary, backup: updated.backup };
  };
  const syncConnection = async (connection, { rebuild = false, backupLabel } = {}) => {
    try {
      const provider = providerFor(connection);
      const pendingRestore = (await getLedger()).ledger?.pendingBankRebuild?.includes(connection.id) ?? false;
      const effectiveRebuild = rebuild || pendingRestore;
      const input = effectiveRebuild ? { ...connection, checkpoint: null } : connection;
      const result = await provider.sync(input);
      if (effectiveRebuild && result.historyReady !== true) {
        throw new BankingError(`${connection.institution} is still preparing historical transactions; sync again shortly`, 409, 'HISTORY_NOT_READY');
      }
      return await persistResult(connection, result, { rebuild: effectiveRebuild, backupLabel });
    } catch (error) {
      if (error?.code !== 'HISTORY_NOT_READY') await recordFailure(connection, error);
      throw error;
    }
  };

  return {
    list: async () => (await loadConnections()).map(connectionView),

    composition: async () => {
      const [{ ledger }, connections] = await Promise.all([getLedger(), loadConnections()]);
      if (!ledger) return { accounts: { live: 0, simulated: 0, unowned: 0 }, transactions: { live: 0, simulated: 0, unowned: 0 }, history: 0 };
      return financialComposition(ledger, connections);
    },

    beginLink: (connectionId) => serial(async () => {
      if (!connectionId) return activeProvider.linkToken();
      const connection = await getConnection(connectionId);
      return providerFor(connection).linkToken(connection);
    }),

    connect: (body) => serial(async () => {
      const completionKey = body.public_token
        ? createHash('sha256').update(body.public_token).digest('hex')
        : undefined;
      if (completionKey) {
        const completed = (await loadConnections()).find((connection) => connection.completionKey === completionKey);
        if (completed) return connectionView(completed);
      }
      const connection = normalizeConnection({
        ...await activeProvider.exchange(body),
        ...(completionKey ? { completionKey } : {}),
      }, {
        liveProvider: activeProvider.name,
        liveEnvironment: activeProvider.env,
      });
      await updateConnections((current) => [...current.filter((candidate) => candidate.id !== connection.id), connection]);
      return connectionView(connection);
    }),

    syncOne: (connectionId) => serial(async () => syncConnection(await getConnection(connectionId))),

    rebuildOne: (connectionId) => serial(async () => {
      const connection = await getConnection(connectionId);
      return syncConnection(connection, { rebuild: true, backupLabel: 'pre-bank-rebuild' });
    }),

    syncAll: () => serial(async () => {
      const connections = await loadConnections();
      const summaries = [];
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
     * No new provider connection is created and simulated connections are dropped.
     */
    useLiveDataOnly: () => serial(async () => {
      const all = (await loadConnections()).map((connection) => normalizeConnection(connection, {
        liveProvider: activeProvider.name,
        liveEnvironment: activeProvider.env,
      }));
      const live = all.filter(isLiveConnection);
      if (!live.length) throw new BankingError('Connect a live bank before replacing demo data', 409, 'NO_LIVE_CONNECTION');
      const snapshots = [];
      for (const connection of live) {
        if (!canSynchronize(connection)) throw new BankingError(`${connection.institution} must be reconnected first`, 409, 'REAUTH_REQUIRED');
        try {
          const result = await providerFor(connection).sync({ ...connection, checkpoint: null });
          if (result.historyReady !== true) {
            throw new BankingError(`${connection.institution} is still preparing historical transactions; sync again shortly`, 409, 'HISTORY_NOT_READY');
          }
          snapshots.push({ connection, result });
        } catch (error) {
          if (error?.code !== 'HISTORY_NOT_READY') await recordFailure(connection, error);
          throw error;
        }
      }

      // Stage simulated connections as disabled before changing the ledger.
      // A crash at any later point cannot make the scheduler re-import them.
      await updateConnections((current) => current.map((connection) => isLiveConnection(connection)
        ? connection
        : { ...connection, status: 'disabled', error: undefined }));

      const totals = { added: 0, modified: 0, unmatched: 0, removed: 0, accounts: 0 };
      const updated = await updateLedger((ledger) => {
        let projection = financialBlank(ledger);
        for (const snapshot of snapshots) {
          const applied = projectBankSync(projection, snapshot.connection, snapshot.result, { rebuild: true });
          projection = applied.ledger;
          for (const key of Object.keys(totals)) totals[key] += applied.summary[key];
        }
        return projection;
      }, { backupLabel: 'pre-live-data' });

      await updateConnections(() => snapshots.map(({ connection, result }) => ({
        ...connection,
        accounts: result.accounts,
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
        await providerFor(connection).remove(connection);
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
