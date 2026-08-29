# Changelog

All notable changes to `@nisli/ledger`. Keep-a-changelog-lite — one section
per version, human-readable highlights.

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
