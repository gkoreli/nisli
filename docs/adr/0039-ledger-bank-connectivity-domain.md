# 0039. Ledger Bank Connectivity — Connections, Provider Boundary, and Projections

**Date**: 2026-08-29
**Status**: Accepted
**Extends**: [0036-ledger-system-of-record-and-security-posture](./0036-ledger-system-of-record-and-security-posture.md)
**Governed by**: [`packages/ledger/TENETS.md`](../../packages/ledger/TENETS.md)
**Code**: [`server/banking/domain.ts`](../../packages/ledger/server/banking/domain.ts), [`server/bank-sync.ts`](../../packages/ledger/server/bank-sync.ts), [`server/providers`](../../packages/ledger/server/providers), [`src/data/bank.ts`](../../packages/ledger/src/data/bank.ts), [`src/screens/connections.ts`](../../packages/ledger/src/screens/connections.ts)
**Tests**: [`server/bank-sync.test.mjs`](../../packages/ledger/server/bank-sync.test.mjs), [`server/banking/application.test.mjs`](../../packages/ledger/server/banking/application.test.mjs)

## Context

The first Plaid implementation used Plaid's own vocabulary throughout the
server and browser: Items, cursors, floating-point balances, positive-outflow
amounts, and `transaction_id`. That made the provider adapter nominal rather
than real. It also let a mock connection be synchronized by the active Plaid
adapter, exposed opaque cursors to the browser, and left the owner without a
reliable answer to “is this ledger live, simulated, or mixed?”

The immediate production state can legitimately contain one simulated
connection, one live Plaid connection, seeded/local facts, and live facts. A
cleanup must not consume another scarce Plaid Item, advance a checkpoint before
its projection is durable, or destroy the only recoverable copy of the old
ledger.

## Decision

### 1. Two bounded contexts

**Bank Connectivity** owns authorization and synchronization. Its aggregate is
`BankConnection`: identity, provider, environment, institution, health,
provider accounts, encrypted credential, and opaque checkpoint. Credentials
and checkpoints are server-only.

**Ledger** owns the financial projection used by reports and editing. Bank
accounts carry `{ provider, connectionId, accountId }`; bank transactions carry
`{ provider, connectionId, transactionId }`. Local and CSV facts have no bank
reference. The reference is provenance, not a provider object leaking into the
Ledger model.

The application service in `server/bank-sync.ts` coordinates the contexts. It
serializes the commands `Connect`, `Synchronize`, `RebuildAfterRestore`,
`RebuildProjection`, `StartFreshWithLiveData`, and `Disconnect`. HTTP routes are
delivery adapters for those commands; screens never mutate provider or
projection files themselves.

### 2. One anti-corruption boundary per provider

Providers return Ledger's bank language, not Plaid response shapes:

```text
ProviderAccount {
  id, name, mask, kind, type, subtype,
  balanceMinor: signed integer, currency
}

ProviderTransaction {
  id, accountId, bookedOn, authorizedOn?, description,
  amountMinor: signed integer, currency, pending, replacesId?
}

SyncResult {
  added, modified, removed: transaction ids,
  accounts, checkpoint, complete
}
```

Plaid's positive-outflow decimals become signed integer minor units inside
`providers/plaid.mjs`. Test fixtures implement the same normalized port, but
there is no selectable runtime mock provider. The domain fold therefore has no
Plaid sign, key, or account-kind rules without exposing invented data in the
application.

Persisted legacy Items migrate on read to connections (`cursor` → `checkpoint`,
missing provider inferred once, decimal balances → signed minor units). The
next connection write stores the modern shape. The legacy filename
`server/data/items.json` remains an implementation detail to avoid an unsafe
in-place file move.

### 3. Projection and checkpoint invariants

- A provider page-set must complete before any ledger mutation. A 50-page
  safety limit fails closed; its checkpoint is not advanced.
- Plaid requests have a bounded timeout and bounded retry for network,
  throttling, and server failures. A mutation-during-pagination response
  restarts from the original checkpoint and discards the interrupted pass.
- The ledger projection is written and fsynced before the connection checkpoint
  advances. A crash between them replays the same provider changes; explicit
  bank references make the fold idempotent.
- Pending-to-posted replacement keeps the local transaction id, category, and
  owner note while replacing the provider identity.
- A rebuild starts from a null checkpoint and is accepted only when the adapter
  says the snapshot is complete. Existing rows retain local identity and
  overrides; provider rows absent from the complete snapshot leave the active
  projection.
- A failed account refresh fails the whole sync. Ledger does not reconcile a
  fresh transaction set against stale balances.
- Provider credentials are encrypted before the connection file is written.
  Store writes use private `0600` temp files, file fsync, atomic rename, and a
  best-effort directory fsync. Corrupt JSON fails closed rather than becoming an
  empty store that a later command could overwrite.
- Provider modifications and removals leave an append-only prior-observation
  record in `bankHistory`; they disappear only from the active projection.
- The provider account list is authoritative for lifecycle. An account no
  longer reported is marked inactive, while its transactions remain available
  for historical continuity; a later appearance makes it active again.
- A restored ledger marks every synchronizable connection for a null-checkpoint
  rebuild. The marker clears only after complete historical data has projected,
  preventing an old ledger from being paired with a newer checkpoint.
- Browser writes cross an owner-command boundary. They cannot create, delete,
  or alter bank observations; category and note are the only accepted overlay
  on a bank transaction. Before any explicit bank command, pending owner edits
  are durably flushed. A version conflict replays owner changes over the newer
  bank projection rather than dropping either side, and every successful write
  returns the exact accepted projection so the client cannot retain a rejected
  view of bank-owned fields.

### 4. Start fresh with live data is a domain command

The Banks screen asks the server for projection composition: provider-backed,
retired-sample, and unclassified local/imported account and transaction counts.
When a live
connection exists and the projection is not exclusively live, it offers
**Start fresh with live data**.

The command:

1. loads existing live connections — it never calls link or creates an Item;
2. fetches a complete, historically ready null-checkpoint snapshot for every
   live connection;
3. aborts without touching the ledger if any snapshot fails;
4. disables retired mock connection metadata so a crash cannot let the
   scheduler consider it;
5. creates an unconditional named `pre-live-data` backup;
6. atomically replaces accounts, transactions, and sync metadata from the live
   snapshots while preserving categories, customized budgets/rules, and
   preferences; exact unchanged legacy sample budgets/rules are removed;
7. advances live checkpoints and removes retired mock metadata.

The success notice names the restorable backup. The old client-side “Start
fresh” and routine demo-reset actions are removed because they could clear a
projection while leaving provider checkpoints advanced.

### 5. Public language and visibility

The browser receives only provider-backed `BankConnection` views with
provider/environment, health, and normalized account summaries. It never
receives credentials or checkpoints. Banks shows projection composition in
plain words; untagged older facts are called local/imported, never guessed to
be demo.

`Dialog.actions` remains an engine capability gap tracked by issue 0023. Until
the concurrently changing engine lane resolves it, the connection dialog's
existing fieldless Form is contained legacy debt; no new fake Form is added.

## Consequences

- Plaid and any future provider share one real contract; tests use doubles at
  the port without creating a runtime mode.
- A live connection can repair or replace its projection without another bank
  authorization or Trial Item.
- Crash recovery is replay, not manual cursor surgery.
- Provider history is retained as evidence even as the active projection
  follows modifications and removals.
- Financial origin is inspectable before a destructive cleanup.
- The ledger and connection store are still two files, so multi-file commands
  use ordered, retry-safe state transitions rather than pretending to provide a
  cross-file transaction.
- Provider-removed accounts remain as explicitly inactive historical accounts;
  they are never silently presented as still connected.
