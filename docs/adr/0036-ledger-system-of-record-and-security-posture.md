# 0036. Ledger — System of Record and Security Posture

**Date**: 2026-08-29
**Status**: Accepted
**Depends on**: [0034-engine-typed-blocks-decided-by-an-engine](./0034-engine-typed-blocks-decided-by-an-engine.md)
**Governed by**: [`packages/ledger/TENETS.md`](../../packages/ledger/TENETS.md) — tenet numbers below refer to it
**Code**: [`server/index.mjs`](../../packages/ledger/server/index.mjs), [`server/store.mjs`](../../packages/ledger/server/store.mjs), [`server/crypto.mjs`](../../packages/ledger/server/crypto.mjs), [`server/providers/mock.mjs`](../../packages/ledger/server/providers/mock.mjs), [`server/providers/plaid.mjs`](../../packages/ledger/server/providers/plaid.mjs), [`src/data/api.ts`](../../packages/ledger/src/data/api.ts), [`src/data/store.ts`](../../packages/ledger/src/data/store.ts), [`src/data/insights.ts`](../../packages/ledger/src/data/insights.ts), [`src/screens/settings.ts`](../../packages/ledger/src/screens/settings.ts), [`src/screens/overview.ts`](../../packages/ledger/src/screens/overview.ts)
**Tests**: [`src/data/store.test.ts`](../../packages/ledger/src/data/store.test.ts), [`src/data/insights.test.ts`](../../packages/ledger/src/data/insights.test.ts)

> **2026-08-29 extension:** ADR 0039 replaces the provider-facing Item/cursor
> vocabulary below with the BankConnection/checkpoint domain, adds normalized
> signed-minor-unit adapters, provenance, and replay-safe projection rebuilds.
> The system-of-record and security decisions in this ADR remain in force.

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

`server/store.mjs` owns one **ledger document**:

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
  truth in the same round-trip (`StoreError` in `store.mjs`, mapped in
  `index.mjs`).
- **Atomic write.** `writeAtomic` writes a `.tmp` beside the target and
  `rename`s over it; every mutation runs through one promise chain
  (`serial`) so version checks and renames never interleave. The write is
  durable before the response is sent (tenet 3, "durable before
  acknowledged").
- **Dated backups.** The first successful `PUT` of a calendar day copies the
  previous `ledger.json` to `server/data/backups/ledger-YYYY-MM-DD.json`
  (`backupToday`). Daily backups are pruned to the newest 30
  (`KEEP_BACKUPS`). `GET /api/backups` lists them newest-first with date and
  size.
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
  server is at version 0, migrate the `localStorage` cache (or the seed) with
  one `PUT` — the one-time move off the stopgap. If the server is
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
| Binds `HOST ?? 127.0.0.1` on `PORT ?? 5201`; startup rejects anything except loopback or a Tailscale IP/name. Write requests also reject cross-site origins and non-JSON bodies. | `server/index.mjs`; `package.json` `server:tailscale` |
| Provider access tokens are sealed at rest with **AES-256-GCM**, format `v1:<iv>:<tag>:<data>` hex. Items are decrypted only in memory on load and re-sealed on every save; a plaintext token left by 0.1.0 is sealed on the next save. | `server/crypto.mjs`; `loadItems` / `saveItems` in `store.mjs` |
| Key from `LEDGER_KEY` (64 hex, validated) or generated once into `server/data/.key` with mode `0o600`. | `crypto.mjs` `loadKey` |
| Secrets are env only: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `LEDGER_KEY`. `server/data/` is git-ignored. | `index.mjs`; `.gitignore` |
| The browser never receives a token: `publicItem` strips `access_token` from every item response. | `store.mjs` `publicItem`; `index.mjs` bank routes |
| Logs are one line per request — `METHOD path → status (ms)` — never a token, payee or amount. Errors return the message only. | `index.mjs` `createServer` `finally` |
| Bank logins happen only in the provider's own Link window; Ledger exchanges the resulting `public_token` server-side and stores the result. No Ledger form ever asks for a bank credential. | `providers/plaid.mjs` `exchange`; tenet 4 |

### 4. The provider adapter

One provider port is implemented by `plaid.mjs`; test doubles exercise the port
only in automated tests. Runtime startup requires `PLAID_CLIENT_ID`,
`PLAID_SECRET`, and a real-data environment (`development` or `production`):

```
{ name, env,
  linkToken(),                       // → what the Link widget needs
  exchange(body) → item,             // link result → { id, access_token?, institution, cursor, accounts }
  accounts(item),
  sync(item) → { added, modified, removed, accounts, cursor },
  remove(item) }
```

`index.mjs` is routing only and knows no provider detail; items are handed to
the adapter with the token already decrypted. Historical mock records are
quarantined and can only be removed by the backed-up cleanup command. This is
the *link → accounts → sync-with-cursor → remove* contract of tenet 7;
SimpleFIN, Teller or CSV would be a third file in `providers/`, not a rewrite.

### 5. The one insight, and "explained arithmetic" as a rule

`src/data/insights.ts` adds two pure functions, no clock, no I/O:

- **`detectRecurring(transactions, today)`** — group by normalised payee
  (`normalisePayee`: lowercase, trailing digit/`#`/`*` tails stripped); keep
  occurrences within ±20 % of the group's median amount, same sign; require
  three; the median interval picks the cadence — 6–8 days weekly, 27–33
  monthly, 350–380 yearly. A median outside every band is *undetected*, not
  forced into a neighbour (a semi-monthly payroll is left alone rather than
  mislabelled). A series more than two intervals overdue has lapsed. Each item
  carries `typicalAmount`, `lastDate`, `nextExpected`, `confidence` and
  `occurrences`.
- **`safeToSpend({ transactions, budgets, period, today })`** —
  `balanceIn − committedBills − budgetRemaining`, where `balanceIn` is the
  period's income minus spend, `committedBills` the recurring money-out items
  due after `today` and by the period's end, and `budgetRemaining` the open
  room in budgets whose category no committed bill already covers. It returns
  the `parts` and an `explanation: string[]` whose first line is the whole
  sum in words.

Overview shows **Safe to spend** as a `Stat` whose `hint` is
`explanation[0]`, and a **Recurring** table (payee, cadence, typical, next
expected) with the empty text "it takes three occurrences on a steady beat".

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
| 5 — full visibility, explained | `safeToSpend.explanation`, `RecurringItem.confidence` / `occurrences`. |
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
