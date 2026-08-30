# Changelog

All notable changes to `@nisli/ledger`. Keep-a-changelog-lite — one section
per version, human-readable highlights.

## Unreleased

- Ledger now pins Bun 1.4.0 for both sides of the application: the API/static
  server uses native `Bun.serve`, and Vite runs through `bunx --bun`. All
  executable Ledger server, provider, persistence, test, development, and
  service code is strict TypeScript; pnpm remains the workspace package manager.
  Bun's environment loading is made explicit so only the server process sees
  `.env`, and a guarded isolated data directory makes server verification safe.
- Ledger no longer has a runtime mock provider or generated starter finances.
  A new ledger has reference categories but no accounts, transactions, budgets,
  or rules; missing Plaid credentials and Plaid Sandbox configuration fail at
  startup. Retired mock records remain recognizable only for backed-up cleanup,
  which also removes unchanged legacy sample budgets/rules without touching
  owner-customized configuration.

- Bank sync is now applied atomically by the server, shared by manual sync
  and a daily 06:00 local-time scheduler. Pending-to-posted replacements keep
  their local identity and category, and provider reauthentication is visible.
- Plaid Link requests 730 days before Item creation, supports update mode and
  a configured HTTPS OAuth return on mobile, and preserves scarce Production
  Items by reusing the existing connection for rebuild and reauthorization.
- The zero-dependency server serves the production client as well as `/api`;
  an opt-in macOS LaunchAgent keeps it running without putting secrets in its
  plist. Tailscale Serve remains the private phone-access path.
- Banks can replace legacy sample/local financial state from existing live
  connections, behind confirmation, while preserving categories, budgets,
  customized rules, and preferences. The server fetches every live snapshot first, writes
  a named backup, reuses the existing Plaid Items, and removes retired sample
  connection metadata.
- Bank connectivity now has an explicit domain boundary: provider adapters
  normalize signed integer amounts, currency, account kinds, transaction
  names, and opaque checkpoints before projection. Connections and bank facts
  carry provenance, so Banks can distinguish provider, retired sample, and
  local/imported facts; credentials and checkpoints never reach the browser.
- Store writes use private fsynced temp files and fail closed on corrupt JSON.
  Sync, disconnect, and live-data replacement use ordered, replay-safe state
  transitions across the ledger and encrypted connection store.
- Browser edits now cross an owner-only write boundary and are replayed over a
  concurrent bank sync; bank amounts, dates, accounts, provenance, and prior
  observations remain server-owned. Restore forces complete per-connection
  rebuilds, removed accounts become explicitly inactive, and provider changes
  are archived instead of silently discarded.
- Plaid synchronization has bounded network retries/timeouts, restarts a
  pagination pass after concurrent mutation, waits for historical readiness,
  and never marks reauthorization healthy before a successful sync. API writes
  enforce local/tailnet origins and logs redact connection identifiers.
- `dev:all` now supervises the API and Vite together, preventing the orphaned
  API process that previously caused repeated `EADDRINUSE` failures.

## 0.2.0 — 2026-08-29

- The server is the system of record: the ledger is a versioned JSON
  document at `server/data/ledger.json`, written atomically and refused when
  stale (`server/store.mjs`). The browser is an optimistic cache — edits
  apply at once, save after 400 ms, retry while offline, and reload the
  server's copy on a conflict with a warning (`src/data/store.ts`,
  `src/data/api.ts`). A 0.1.0 `localStorage` ledger migrates itself once.
- Daily dated backups (`server/data/backups/`, newest 30 kept) and restore
  from Settings, behind a confirm, with a pre-restore copy of what was
  replaced. Settings shows *Last saved* and the sync state in words.
- Bank access tokens encrypted at rest with AES-256-GCM (`server/crypto.mjs`;
  key from `LEDGER_KEY` or a generated `server/data/.key`). Server binds
  `127.0.0.1` by default; `pnpm server:tailscale` with `HOST` for the tailnet.
  Request log carries method, path, status and ms only.
- Bank providers behind one adapter (`server/providers/mock.mjs`,
  `server/providers/plaid.mjs`); `server/index.mjs` is routing only.
- Overview: **Safe to spend** with its arithmetic in words, and a
  **Recurring** table of payees on a weekly/monthly/yearly beat
  (`src/data/insights.ts`, 13 tests). ADR 0036 records the round.

## 0.1.0 — 2026-08-29

- Screens: Overview, Accounts, Account detail, Transactions, Budgets, Import,
  Rules, Banks, Settings — every one an engine block composition with no
  visual decision in app code.
- Import wizard: drop a bank CSV, mapping and date format guessed from the
  headers, per-row status preview, rules applied, duplicates skipped.
- Rules: "payee contains … → category", hit counts, apply to uncategorized,
  uncategorized-payee table that turns a row into a rule, category creation.
- Backup: export a JSON backup, restore one, reset behind a confirm.
- Period navigation on Overview and Budgets, and a 12-month income vs
  spending chart.
- Banks: connect through Plaid, sync, per-bank dialog, disconnect. A
  zero-dependency Node server holds the credentials; without them it runs in
  mock mode with a simulated Chase (`pnpm dev:all`).
- Phones keep every column: the engine folds dropped table columns under the
  primary cell instead of hiding them.
- Appearance preference: System / Light / Dark, applied by the engine's skin.
