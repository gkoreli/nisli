# Changelog

All notable changes to `@nisli/ledger`. Keep-a-changelog-lite — one section
per version, human-readable highlights.

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
