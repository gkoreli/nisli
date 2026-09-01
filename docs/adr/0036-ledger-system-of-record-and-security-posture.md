# 0036. Ledger — System of Record and Security Posture

**Date**: 2026-08-29
**Status**: Accepted
**Depends on**: [0034-engine-typed-blocks-decided-by-an-engine](./0034-engine-typed-blocks-decided-by-an-engine.md)
**Governed by**: [`packages/ledger/TENETS.md`](../../packages/ledger/TENETS.md) — tenet numbers below refer to it
**Code**: [`server/index.ts`](../../packages/ledger/server/index.ts), [`server/store.ts`](../../packages/ledger/server/store.ts), [`server/crypto.ts`](../../packages/ledger/server/crypto.ts), [`server/providers/plaid.ts`](../../packages/ledger/server/providers/plaid.ts), [`src/data/api.ts`](../../packages/ledger/src/data/api.ts), [`src/data/store.ts`](../../packages/ledger/src/data/store.ts), [`src/data/finance/commitment.ts`](../../packages/ledger/src/data/finance/commitment.ts), [`src/data/finance/safe-to-spend.ts`](../../packages/ledger/src/data/finance/safe-to-spend.ts), [`src/screens/settings.ts`](../../packages/ledger/src/screens/settings.ts), [`src/screens/overview.ts`](../../packages/ledger/src/screens/overview.ts)
**Tests**: [`src/data/store.test.ts`](../../packages/ledger/src/data/store.test.ts), [`src/data/finance/commitment.test.ts`](../../packages/ledger/src/data/finance/commitment.test.ts), [`src/data/finance/safe-to-spend.test.ts`](../../packages/ledger/src/data/finance/safe-to-spend.test.ts), [`src/screens/screens.proof.test.ts`](../../packages/ledger/src/screens/screens.proof.test.ts)

> **2026-08-29 extension:** ADR 0039 replaces the provider-facing Item/cursor
> vocabulary below with the BankConnection/checkpoint domain, adds normalized
> signed-minor-unit adapters, provenance, and replay-safe projection rebuilds.
> The system-of-record and security decisions in this ADR remain in force.

> **2026-08-30 runtime extension:** Ledger pins Bun 1.4.0. `server/index.ts`
> uses native `Bun.serve`; supervised processes use `Bun.spawn`; and Vite runs
> with Bun's documented `bunx --bun` integration. pnpm remains the workspace
> package manager. Every executable Ledger source file is strict TypeScript.
> Automatic `.env` discovery is disabled and the server receives one explicit
> `.env`, preventing the client tooling process from inheriting provider
> secrets. This follows Bun's primary TypeScript, environment, HTTP server,
> child-process, and Vite documentation.

> **2026-08-31 finance-domain extension:** the prototype `insights.ts` module
> was replaced by the pure `src/data/finance/` bounded context. Safe to spend
> is a current-position decision derived from the owner's local `today`; a
> selected historical month controls reports only and cannot be passed into
> that operation. The remainder of §5 describes the current domain.

## Context

Ledger 0.1.0 ([CHANGELOG](../../packages/ledger/CHANGELOG.md)) kept the whole
ledger in the browser's `localStorage` under `ledger.v1`. The tenets, recorded
the same day, call that a stopgap: *the browser is a client. It may cache, it
never owns the data* (tenet 2). The same release held Plaid access tokens as
plaintext in `server/data/items.json`, and the only insight on the Overview was
a savings-rate percentage.

This ADR records the round that moved the system of record onto the server,
fixed the security posture that tenets 2, 4 and 8 demand, and added the first
ambient insight (tenets 5, 11, 12) — and why each shape was chosen. It says
nothing about appearance; the screens remain engine-block compositions per
0034 and 0035.

## Decision

### 1. The server is the system of record

`server/store.ts` owns one **ledger document**:

```
{ version: number, ledger: Ledger | null, savedAt: ISO, restoredFrom?: name }
```

stored at `server/data/ledger.json` (git-ignored via
[`packages/ledger/.gitignore`](../../packages/ledger/.gitignore)). Its rules:

- **Version.** `GET /api/ledger` returns `{ version, ledger }`; a fresh
  install answers `{ version: 0, ledger: null }`. `PUT /api/ledger` carries
  `{ version, ledger }` and succeeds only when `version` equals the stored
  one, answering `{ version: n+1 }`. A stale version is a **409** whose body
  carries the current `{ version, ledger }`, so the loser of a race gets the
  truth in the same round-trip (`StoreError` in `store.ts`, mapped in
  `index.ts`).
- **Atomic write.** `writeAtomic` writes a `.tmp` beside the target and
  `rename`s over it; every mutation runs through one promise chain
  (`serial`) so version checks and renames never interleave. The write is
  durable before the response is sent (tenet 3, "durable before
  acknowledged").
- **Dated backups.** The first successful `PUT` of a calendar day copies the
  previous `ledger.json` to `server/data/backups/ledger-YYYY-MM-DD.json`
  (`backupToday`). Daily backups are pruned to the newest 30
  (`KEEP_BACKUPS`). `GET /api/backups` lists them newest-first with date and
  size. Only `ENOENT` means “not created yet”; permission, disk, directory,
  copy, and fsync failures abort the mutation instead of silently acknowledging
  an unprotected write.
- **Restore.** `POST /api/backups/restore { name }` validates the name
  against the backup pattern (no path traversal — `basename(name) === name`),
  copies the current file to `ledger-YYYY-MM-DD.pre-restore.json` (`-N`
  suffixed if one already exists that day; not counted against the 30),
  writes the backup's ledger with **version + 1**, and returns
  `{ version, ledger }`. The version keeps moving forward so any client
  holding the old number gets a clean 409 rather than silently overwriting
  the restored data. Restore is a first-class path in Settings (tenet 3).

`GET /api/health` reports `{ ok, mode, host, version }` so the screen can say
which mode it is in (tenet 1).

### 2. The client is an optimistic cache

`src/data/api.ts` is the typed client for the endpoints above; a 409 becomes
a `ConflictError` carrying the server's `version` and `ledger`.
`src/data/store.ts` keeps every export that screens already used and changes
only where the data lives:

- **Boot** (`boot()`, awaited as `ready` in `main.ts` before the skin is
  wired): `GET /api/ledger`. If the server holds a ledger, adopt it. If the
  server is at version 0, initialize it from the empty reference-category
  ledger with one `PUT`; a browser cache is never promoted into the system of
  record. If the server is
  unreachable, run from the cache in the `offline` state.
- **Writes** apply locally at once (`persist`) and schedule a 400 ms-debounced
  `PUT` with the current version. Success bumps the version and
  `lastSavedAt`. A write that lands during an in-flight `PUT` marks the store
  dirty and is flushed afterwards.
- **Conflict**: on 409 the store adopts the newer server version, replays the
  owner's changes against it, and retries. Server-owned bank observations win;
  owner-owned categories, budgets, rules, settings, local facts, and the
  category/note overlay on bank transactions survive the race (ADR 0039).
- **Offline**: network failure sets `offline` and retries at 2/4/8/16 s,
  capped at 30 s. Nothing is dropped; the local state stays and the next
  attempt carries it (tenet 3).
- `localStorage` is thereafter a **read cache**, written on each successful
  save; nothing new is built on it.

`syncState` (`saved` / `saving` / `offline` / `conflict`) and `lastSavedAt`
are shown on Settings as a **Last saved** stat with plain words
(`SYNC_WORDS` in `settings.ts`), alongside the server-backup table and its
confirmed **Restore** dialog. `applyRestored` and `reloadFromServer` let
Settings adopt server state without going through a write.

### 3. Security posture

| rule | where |
|---|---|
| Binds `HOST ?? 127.0.0.1` on `PORT ?? 5201`; startup rejects anything except loopback or a Tailscale IP/name. Write requests also reject cross-site origins and non-JSON bodies. | `server/index.ts`; `package.json` `server:tailscale` |
| Provider access tokens are sealed at rest with **AES-256-GCM**, format `v1:<iv>:<tag>:<data>` hex. Connections are decrypted only in memory on load and re-sealed on every save; a plaintext token left by 0.1.0 is sealed on the next save. | `server/crypto.ts`; `loadConnections` / `saveConnections` in `store.ts` |
| Key from `LEDGER_KEY` (64 hex, validated) or generated once into `server/data/.key` with mode `0o600`. Generation uses exclusive `wx`; concurrent starters reread the winning file rather than encrypting with divergent keys. | `crypto.ts` `loadKey` |
| Secrets are env only: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `LEDGER_KEY`. `server/data/` is git-ignored. | `index.ts`; `.gitignore` |
| The browser never receives a token: the bank application service returns a credential-free `ConnectionView`; checkpoints are also server-only. | `bank-sync.ts`; `index.ts` bank routes |
| Logs are one line per request — `METHOD path → status (ms)` — never a token, payee or amount. Errors return the message only. | `index.ts` `Bun.serve` `finally` |
| Bank logins happen only in the provider's own Link window. After the one-use `public_token` exchange, Ledger encrypts and stages the credential before account enrichment; a failed enrichment resumes from that staged connection instead of consuming another Item. No Ledger form ever asks for a bank credential. | `providers/plaid.ts` `exchange`; `bank-sync.ts` `connect`; tenet 4 |
| Valid JSON is not assumed to be valid state: ledger documents, backups, nested financial facts, and stored connections are structurally validated before use or restore. | `store.ts` persistence guards |

The application has one owner and no shared-account domain. Consequently,
loopback is trusted, and private phone access deliberately treats the owner's
Tailscale identity plus ACL as the authentication boundary. Every device able
to reach Ledger's tailnet listener is trusted to perform owner commands,
including restore, disconnect, and backed-up live-data replacement. This is
acceptable only on a single-owner tailnet (or an ACL narrowed to the owner's
devices); Ledger must not use Tailscale Funnel, a public bind, a LAN bind, or a
multi-user tailnet grant. Application-level multi-user authentication would be
a new product capability and is outside this single-owner decision.

### 4. The provider adapter

One provider port is implemented by `plaid.ts`; test doubles exercise the port
only in automated tests. Runtime startup requires `PLAID_CLIENT_ID`,
`PLAID_SECRET`, and a real-data environment (`development` or `production`):

```
{ name, env,
  linkToken(),                       // → what the Link widget needs
  exchange(body) → stagedConnection, // one-use token → durable credential boundary
  accounts(connection),
  sync(connection) → { added, modified, removed, accounts, checkpoint },
  remove(connection) }
```

`index.ts` is routing only and knows no provider detail; connections are handed to
the adapter with the token already decrypted. Historical mock records are
quarantined and can only be removed by the backed-up cleanup command. This is
the *link → accounts → sync-with-cursor → remove* contract of tenet 7;
SimpleFIN, Teller or CSV would be a third file in `providers/`, not a rewrite.

### 5. Finance decisions, and "explained arithmetic" as a rule

The pure `src/data/finance/` modules have no clock, I/O, signal, store, or
formatting dependency. Their boundary receives plain readonly data plus an
explicit local `today` where time matters:

- **`detectRecurringSeries(transactions, today)`** groups by normalised payee;
  keeps same-sign occurrences within ±20% of the median amount; requires at
  least three; and recognises only weekly (6–8 days), monthly (27–33), or
  yearly (350–380) intervals. A beat outside those bands is undetected rather
  than forced into a label. Each `RecurringSeries` carries its exact evidence:
  amount, last and next dates, cadence, confidence, and occurrence count.
- **`safeToSpend(input, today, format)`** computes posted default-currency
  checking cash minus fixed commitments due before the next expected income
  (capped at 30 days) minus room still open in the calendar month containing
  `today`. Pending income, transfers, savings, credit, and other currencies do
  not silently enter cash. The selected report `Period` is deliberately not an
  argument: current budget definitions cannot truthfully reconstruct a
  historical as-of decision.
- **`runway(input, today, format)`** divides posted checking and savings cash
  by the median default-currency outflow of the last three complete months. It
  returns no duration when that denominator is absent.

Overview names the split explicitly: Safe to spend, Runway, and Coming up use
local today; Money in, Money out, Net, category rollups, comparisons, and the
trend use the selected report month. Each decision exposes its arithmetic in
the block hint or an ambient line, and recurring commitments remain visible in
the Coming up table.

The rule this establishes: **an insight ships with its arithmetic, or it
does not ship.** Tenet 5 says a recommendation the user cannot check is not a
recommendation, and tenet 11 says the intelligence is ambient with its
reasoning one tap away. The mechanical consequence is that every insight
function returns its explanation as data next to its number — the screen
never composes prose about a figure it did not compute, and a future insight
without an `explanation` field is incomplete by construction. It also keeps
the door closed on a chat box: there is nothing to ask, because the answer is
already on the screen (tenets 11, 12).

## Tenets enforced

| tenet | how |
|---|---|
| 1 — not a toy | `/api/health` and `/api/bank/status` name the mode; Settings shows the sync state in words. |
| 2 — local-first, owner-hosted | The document lives in `server/data/ledger.json` on the Mac; the browser holds a read cache; the server binds localhost/tailnet only. |
| 3 — nothing lost | Atomic, serialised writes; daily dated backups kept 30 deep; pre-restore copies; restore in Settings behind a confirm; offline writes retried, never dropped. |
| 4 — credentials never pass through Ledger | Tokens sealed with AES-256-GCM, never sent to the browser; secrets in env; bank login only in the provider's window. |
| 5 — full visibility, explained | `safeToSpend.explanation`, `RecurringSeries.confidence` / `occurrences`. |
| 6 — money is exact | `typicalAmount`, `amount`, `parts` are integer cents; `money()` formats only at the edge. |
| 7 — provider-independent | One adapter shape; provider chosen by configuration. |
| 8 — private by construction | Request log carries method, path, status, ms — nothing else. |
| 11, 12 — intelligence without a chat box | Insights are computed and shown in place; the only inputs are what the user already did in the UI. |

## Consequences

- A second browser (a phone on the tailnet) sees the same ledger, and a race
  between a browser edit and bank projection preserves both bounded owners'
  changes with a visible merge warning.
- `localStorage` migrates itself once, then stops mattering; a cleared
  browser loses nothing.
- Restoring a backup is reversible: the pre-restore copy is listed and
  restorable like any other.
- A backup written "tonight" means the first write of the next day, so an
  edit-free day writes none; destructive bank and restore commands create
  unconditional named backups instead.
- Verified: 7 store tests (boot, migration, optimistic write, ownership-aware
  conflict replay, offline retry), 24 banking tests, and 13 insight tests;
  the server was smoke-tested end to end — health, GET/PUT, stale-PUT 409,
  backup listing, restore, pre-restore copy — before this ADR was written.
