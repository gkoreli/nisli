/**
 * Bank-connectivity domain.
 *
 * Provider adapters end at this boundary. Everything below speaks Ledger's
 * language: signed integer minor units, connections, checkpoints and bank
 * references. No Plaid response shape is allowed into the ledger projection.
 */
import { randomUUID } from 'node:crypto';

export const UNCATEGORIZED = 'uncategorized';
export const SIMULATED_PROVIDER = 'mock';

const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
const connectionIdOf = (account) => account.external?.connectionId ?? account.external?.itemId;
const ownsAccount = (account, connection) => connectionIdOf(account) === connection.id
  && (!account.external?.provider || account.external.provider === connection.provider)
  && (!account.external?.environment || account.external.environment === connection.environment);
const bankTransactionId = (transaction, connection, ownedAccountIds) => {
  if (transaction.bank?.connectionId === connection.id
    && (!transaction.bank.provider || transaction.bank.provider === connection.provider)
    && (!transaction.bank.environment || transaction.bank.environment === connection.environment)) return transaction.bank.transactionId;
  // Compatibility for bank rows written before explicit provenance existed.
  if (transaction.externalId && ownedAccountIds.has(transaction.accountId)) return transaction.externalId;
  return undefined;
};
const categoryFor = (ledger, payee) => {
  const normalized = payee.toLowerCase();
  return ledger.rules.find((rule) => rule.match && normalized.includes(rule.match.toLowerCase()))?.categoryId ?? UNCATEGORIZED;
};
const accountKind = (account) => {
  if (account.kind) return account.kind;
  if (account.type === 'credit') return 'credit';
  if (account.type === 'investment' || account.type === 'brokerage') return 'investment';
  if (account.subtype === 'savings' || account.subtype === 'money market' || account.subtype === 'cd') return 'savings';
  return 'checking';
};
const normalizeProviderAccount = (account) => ({
  ...account,
  kind: accountKind(account),
  balanceMinor: Number.isInteger(account.balanceMinor)
    ? account.balanceMinor
    : Math.round((account.balance ?? 0) * 100) * (account.type === 'credit' ? -1 : 1),
  currency: account.currency ?? 'USD',
});

/** Migrate a stored provider Item into the BankConnection aggregate. */
export function normalizeConnection(raw, { liveProvider = 'plaid', liveEnvironment = 'unknown' } = {}) {
  const provider = raw.provider ?? (raw.access_token ? liveProvider : SIMULATED_PROVIDER);
  const environment = raw.environment ?? (provider === SIMULATED_PROVIDER ? 'mock' : liveEnvironment);
  const checkpoint = raw.checkpoint ?? raw.cursor ?? null;
  const connection = {
    status: 'ok',
    ...raw,
    provider,
    environment,
    checkpoint,
    accounts: (raw.accounts ?? []).map(normalizeProviderAccount),
  };
  delete connection.cursor;
  return connection;
}

/** The browser gets identity and health, never credentials or sync internals. */
export function connectionView(raw) {
  const connection = normalizeConnection(raw);
  const { access_token, checkpoint, completionKey, ...visible } = connection;
  return { ...visible, source: connection.provider === SIMULATED_PROVIDER ? 'simulated' : 'live' };
}

export const canSynchronize = (connection) => !['reauth-required', 'disabled', 'disconnect-pending'].includes(connection.status);
export const isLiveConnection = (connection) => connection.provider !== SIMULATED_PROVIDER;

/**
 * Fold one complete provider change page-set into the ledger projection.
 * `rebuild` means the provider result began at an empty checkpoint; bank rows
 * absent from that complete snapshot are removed while local edits survive on
 * rows that still exist.
 */
export function projectBankSync(
  ledger,
  rawConnection,
  result,
  { rebuild = false, createId = randomUUID, now = () => new Date().toISOString() } = {},
) {
  const connection = normalizeConnection(rawConnection);
  if (rebuild && (!result.complete || result.historyReady !== true)) {
    throw new Error('A bank projection can only be rebuilt after its complete history is ready');
  }
  const next = structuredClone(ledger);
  next.sync ??= {};
  next.bankHistory ??= [];
  const observedAt = now();
  const providerAccounts = result.accounts;
  const currentProviderAccountIds = new Set(providerAccounts.map((account) => account.id));
  const ledgerAccountFor = new Map();
  let accountsAdded = 0;
  let accountsInactive = 0;

  for (const account of next.accounts.filter((candidate) => ownsAccount(candidate, connection))) {
    if (!currentProviderAccountIds.has(account.external.accountId)) {
      account.external = { ...account.external, status: 'inactive' };
      accountsInactive++;
    }
  }

  for (const bank of providerAccounts) {
    let account = next.accounts.find((candidate) => ownsAccount(candidate, connection) && candidate.external?.accountId === bank.id);
    if (!account) {
      const institutionPrefix = bank.name.toLowerCase().startsWith(connection.institution.toLowerCase()) ? '' : `${connection.institution} `;
      account = {
        id: createId(),
        name: `${institutionPrefix}${bank.name} ···${bank.mask}`,
        kind: bank.kind,
        institution: connection.institution,
        currency: bank.currency,
        opening: 0,
        external: { provider: connection.provider, environment: connection.environment, connectionId: connection.id, accountId: bank.id, status: 'active' },
      };
      next.accounts.push(account);
      accountsAdded++;
    } else {
      // Single-write the modern provenance/currency shape as old rows are seen.
      account.external = { provider: connection.provider, environment: connection.environment, connectionId: connection.id, accountId: bank.id, status: 'active' };
      account.currency ??= bank.currency;
    }
    ledgerAccountFor.set(bank.id, account.id);
  }

  const ownedAccountIds = new Set(next.accounts.filter((account) => ownsAccount(account, connection)).map((account) => account.id));
  const priorByBankId = new Map();
  for (const transaction of next.transactions) {
    const id = bankTransactionId(transaction, connection, ownedAccountIds);
    if (id) priorByBankId.set(id, transaction);
  }

  const removedIds = new Set(result.removed);
  const replacementFor = new Map([...result.added, ...result.modified].filter((transaction) => transaction.replacesId).map((transaction) => [transaction.replacesId, transaction.id]));
  const archived = new Set();
  const archive = (transaction, change, replacementId) => {
    if (archived.has(transaction.id)) return;
    archived.add(transaction.id);
    const transactionId = bankTransactionId(transaction, connection, ownedAccountIds);
    next.bankHistory.push({
      id: createId(),
      observedAt,
      change,
      provider: connection.provider,
      environment: connection.environment,
      connectionId: connection.id,
      transactionId,
      ...(replacementId ? { replacementId } : {}),
      transaction: structuredClone(transaction),
    });
  };
  let removed = 0;
  next.transactions = next.transactions.filter((transaction) => {
    const id = bankTransactionId(transaction, connection, ownedAccountIds);
    if (!id || !removedIds.has(id)) return true;
    const replacementId = replacementFor.get(id);
    archive(transaction, replacementId ? 'replaced' : 'removed', replacementId);
    removed++;
    return false;
  });

  let added = 0;
  let modified = 0;
  let unmatched = 0;
  const snapshotIds = new Set();
  for (const bank of [...result.added, ...result.modified]) {
    snapshotIds.add(bank.id);
    const accountId = ledgerAccountFor.get(bank.accountId);
    if (!accountId) { unmatched++; continue; }
    const pending = bank.replacesId ? priorByBankId.get(bank.replacesId) : undefined;
    if (pending && bankTransactionId(pending, connection, ownedAccountIds) !== bank.id) {
      archive(pending, 'replaced', bank.id);
      const before = next.transactions.length;
      next.transactions = next.transactions.filter((transaction) => transaction.id !== pending.id);
      if (next.transactions.length !== before) removed++;
    }
    const existingIndex = next.transactions.findIndex((transaction) => bankTransactionId(transaction, connection, ownedAccountIds) === bank.id);
    const existing = existingIndex >= 0 ? next.transactions[existingIndex] : undefined;
    const previous = existing ?? pending;
    const row = {
      id: previous?.id ?? createId(),
      accountId,
      categoryId: previous?.categoryId ?? categoryFor(next, bank.description),
      date: bank.bookedOn,
      amount: bank.amountMinor,
      payee: bank.description,
      note: bank.pending ? (previous?.note ?? 'pending') : previous?.note === 'pending' ? undefined : previous?.note,
      bank: { provider: connection.provider, environment: connection.environment, connectionId: connection.id, transactionId: bank.id },
    };
    if (existing) {
      if (existing.accountId !== row.accountId || existing.date !== row.date || existing.amount !== row.amount || existing.payee !== row.payee) {
        archive(existing, 'modified');
      }
      next.transactions[existingIndex] = row;
      modified++;
    } else {
      next.transactions.push(row);
      added++;
    }
  }

  if (rebuild) {
    next.transactions = next.transactions.filter((transaction) => {
      const id = bankTransactionId(transaction, connection, ownedAccountIds);
      if (!id || snapshotIds.has(id)) return true;
      archive(transaction, 'removed');
      removed++;
      return false;
    });
  }

  next.transactions.sort(byDateDesc);
  for (const bank of providerAccounts) {
    const id = ledgerAccountFor.get(bank.id);
    const account = next.accounts.find((candidate) => candidate.id === id);
    if (!account) continue;
    const activity = next.transactions.filter((transaction) => transaction.accountId === id).reduce((sum, transaction) => sum + transaction.amount, 0);
    account.opening = bank.balanceMinor - activity;
  }

  const at = observedAt;
  next.sync[connection.id] = { at, added };
  if (rebuild && next.pendingBankRebuild) {
    next.pendingBankRebuild = next.pendingBankRebuild.filter((connectionId) => connectionId !== connection.id);
  }
  return { ledger: next, summary: { added, modified, unmatched, removed, accounts: accountsAdded, inactiveAccounts: accountsInactive, at, historyStatus: result.updateStatus } };
}

/** The destructive base used only by the explicit, backed-up live-data command. */
export const financialBlank = (ledger) => ({
  ...structuredClone(ledger), accounts: [], transactions: [], sync: {}, bankHistory: [], pendingBankRebuild: [],
});

const conflict = (message, code) => Object.assign(new Error(message), { status: 409, code });
const sameBankReference = (left, right) => left?.provider === right?.provider
  && (!left?.environment || !right?.environment || left.environment === right.environment)
  && left?.connectionId === right?.connectionId
  && left?.transactionId === right?.transactionId;

/**
 * Browser PUTs carry owner decisions, never authority over bank observations.
 * Preserve provider-owned account/transaction fields and accept only the
 * category/note overlay on an existing bank transaction.
 */
export function mergeOwnerLedgerWrite(current, proposed) {
  if (!Array.isArray(proposed?.accounts) || !Array.isArray(proposed?.categories)
    || !Array.isArray(proposed?.transactions) || !Array.isArray(proposed?.budgets)
    || !Array.isArray(proposed?.rules) || !proposed?.settings || typeof proposed.settings !== 'object') {
    throw conflict('Ledger collections and settings have an invalid shape', 'INVALID_LEDGER');
  }
  // The one-time 0.1 browser-to-server migration can legitimately carry
  // legacy bank provenance. Once initialized, all bank facts are server-owned.
  if (!current) return structuredClone(proposed);
  const currentAccounts = new Map(current.accounts.map((account) => [account.id, account]));
  const currentBankAccountIds = new Set(current.accounts.filter((account) => account.external).map((account) => account.id));
  const proposedAccountIds = new Set();
  const accounts = proposed.accounts.map((account) => {
    proposedAccountIds.add(account.id);
    const existing = currentAccounts.get(account.id);
    if (account.external && (!existing?.external
      || connectionIdOf(account) !== connectionIdOf(existing)
      || account.external.provider !== existing.external.provider
      || (account.external.environment && existing.external.environment && account.external.environment !== existing.external.environment))) {
      throw conflict('The browser cannot create or rebind a bank account', 'BANK_OWNERSHIP');
    }
    return existing?.external ? structuredClone(existing) : structuredClone(account);
  });
  for (const account of current.accounts) {
    if (account.external && !proposedAccountIds.has(account.id)) accounts.push(structuredClone(account));
  }

  const currentBankTransactions = new Map(current.transactions.filter((transaction) =>
    transaction.bank || (transaction.externalId && currentBankAccountIds.has(transaction.accountId)),
  ).map((transaction) => [transaction.id, transaction]));
  const proposedTransactionIds = new Set();
  const transactions = proposed.transactions.map((transaction) => {
    proposedTransactionIds.add(transaction.id);
    const existing = currentBankTransactions.get(transaction.id);
    if (transaction.bank && (!existing || (existing.bank && !sameBankReference(transaction.bank, existing.bank)))) {
      throw conflict('The browser cannot create or rebind a bank transaction', 'BANK_OWNERSHIP');
    }
    if (!existing && transaction.externalId && currentBankAccountIds.has(transaction.accountId)) {
      throw conflict('The browser cannot create a provider id inside a bank account', 'BANK_OWNERSHIP');
    }
    return existing ? { ...structuredClone(existing), categoryId: transaction.categoryId, note: transaction.note } : structuredClone(transaction);
  });
  for (const transaction of currentBankTransactions.values()) {
    if (!proposedTransactionIds.has(transaction.id)) transactions.push(structuredClone(transaction));
  }

  return {
    ...structuredClone(proposed),
    accounts,
    transactions,
    sync: structuredClone(current.sync ?? {}),
    bankHistory: structuredClone(current.bankHistory ?? []),
    pendingBankRebuild: structuredClone(current.pendingBankRebuild ?? []),
  };
}

/** Explain which bounded source owns the current financial projection. */
export function financialComposition(ledger, rawConnections) {
  const sourceByConnection = new Map(rawConnections.map((raw) => {
    const connection = normalizeConnection(raw);
    return [connection.id, isLiveConnection(connection) ? 'live' : 'simulated'];
  }));
  const counts = {
    accounts: { live: 0, simulated: 0, unowned: 0 },
    transactions: { live: 0, simulated: 0, unowned: 0 },
    history: ledger.bankHistory?.length ?? 0,
  };
  for (const account of ledger.accounts) {
    const source = sourceByConnection.get(connectionIdOf(account)) ?? 'unowned';
    counts.accounts[source]++;
  }
  for (const transaction of ledger.transactions) {
    const source = transaction.bank
      ? (sourceByConnection.get(transaction.bank.connectionId) ?? 'unowned')
      : 'unowned';
    counts.transactions[source]++;
  }
  return counts;
}

const localDate = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function shouldRunDaily(connections, ledger, now = new Date(), hour = 6) {
  if (now.getHours() < hour) return false;
  if (ledger?.pendingBankRebuild?.some((id) => connections.some((connection) => connection.id === id && canSynchronize(connection)))) return true;
  const historyRetryBefore = now.getTime() - 15 * 60 * 1000;
  if (connections.some((connection) => canSynchronize(connection)
    && connection.historyStatus
    && connection.historyStatus !== 'HISTORICAL_UPDATE_COMPLETE'
    && new Date(ledger?.sync?.[connection.id]?.at ?? 0).getTime() <= historyRetryBefore)) return true;
  const today = localDate(now.toISOString());
  return connections.some((connection) => canSynchronize(connection) && localDate(ledger?.sync?.[connection.id]?.at) !== today);
}
