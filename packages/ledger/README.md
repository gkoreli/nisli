# Ledger

A personal-finance app built on `@nisli/engine`. No visual decisions in app
code; the engine lays it out, the skin dresses it.

## Run

```sh
pnpm --filter @nisli/ledger dev:all     # bank server on :5201 + Vite on :5200
```

`pnpm dev` runs Vite alone (import, rules, budgets all work; bank connections
need the server). Data lives in this browser's `localStorage` (`ledger.v1`);
use Settings → Export backup for a JSON copy.

## Bank connections (Plaid)

The browser never holds a bank secret. `server/index.mjs` is a zero-dependency
Node server that owns the Plaid credentials and the per-connection access
tokens (`server/data/items.json`, git-ignored). The app only sees item ids and
account summaries through `/api/bank/*`, proxied by Vite.

- **Mock mode** (default, no env): "Connect a bank" instantly links a pretend
  Chase with three accounts and generates realistic transactions on every
  sync. Everything else — mapping to ledger accounts, deduping, rules,
  reconciliation — runs for real.
- **Plaid mode**: set `PLAID_CLIENT_ID`, `PLAID_SECRET` and optionally
  `PLAID_ENV` (`sandbox` default). Get keys at dashboard.plaid.com. In
  sandbox, Plaid Link accepts any institution with `user_good` / `pass_good`.
  Chase (and other OAuth banks) in `development`/`production` needs your Plaid
  app approved for OAuth — a Plaid dashboard step, not a code change.

```sh
PLAID_CLIENT_ID=… PLAID_SECRET=… PLAID_ENV=sandbox pnpm --filter @nisli/ledger dev:all
```

Sync uses Plaid's `/transactions/sync` cursor, so each sync brings only what
changed; the ledger dedupes on the bank's transaction id and keeps each
account's opening balance such that opening + transactions = the bank's
reported balance.

## Appearance

Settings → Appearance picks **System**, **Light** or **Dark**. The app stores
the preference; it never picks a colour. The engine's skin owns the palette and
switches the whole app — native controls included — from that one setting, and
"System" follows the device.

## Bookkeeping

- [`TENETS.md`](./TENETS.md) — the rules this app is measured against (local-first, owner-hosted, nothing lost, credentials never pass through Ledger).

Architecture and rationale live in the ADRs:
[0034 — typed blocks decided by an engine](../../docs/adr/0034-engine-typed-blocks-decided-by-an-engine.md)
and [0035 — the appearance layer](../../docs/adr/0035-engine-appearance-layer.md).

## Privacy

Nothing leaves your machine except calls to Plaid from the server you run.
Delete `server/data/items.json` (or remove the connection in the app, which
also calls Plaid's `/item/remove`) to revoke access.
