# Ledger

A personal-finance app built on `@nisli/engine`. No visual decisions in app
code; the engine lays it out, the skin dresses it.

## Run

```sh
pnpm --filter @nisli/ledger dev:all     # ledger server on :5201 + Vite on :5200
```

The server (`server/index.mjs`, zero dependencies) is the system of record;
`pnpm dev` alone runs Vite against whatever cache the browser holds, in the
`offline` state, and syncs once the server is back.

- **Tailscale**: the server binds `127.0.0.1` by default. To reach it from
  another device on your tailnet run `HOST=<your tailscale IP> pnpm
  --filter @nisli/ledger server:tailscale` (the script refuses to start
  without `HOST`), or keep localhost and put `tailscale serve` in front.
  Never bind `0.0.0.0` on a public network.
- **`LEDGER_KEY`**: 64 hex characters used to encrypt bank tokens at rest.
  Optional — without it the server generates a key once into
  `server/data/.key` (mode 0600). Set it if you want the key outside the
  data directory.
- `PORT` (default 5201) and the Plaid variables below are the rest of the env.

## Data & backups

- The ledger is one JSON document, `server/data/ledger.json`, with a version
  number. Every write is a temp-file-and-rename, so it is durable before the
  browser hears "saved"; every write carries the version it was based on and
  a stale one is refused (409) — the browser then reloads the server's copy
  and says so.
- The browser keeps a read cache in `localStorage` (`ledger.v1`) and works
  from it while offline; edits are retried until they land. An existing
  0.1.0 cache is migrated to the server on first boot.
- **Daily backups**: the first write of each day copies the previous file to
  `server/data/backups/ledger-YYYY-MM-DD.json`; the newest 30 are kept.
- **Restore from Settings**: Settings → Backups lists the server's backups
  with date and size; choosing one and confirming *Restore* replaces the
  current ledger with that copy, after first saving the current one as
  `ledger-YYYY-MM-DD.pre-restore.json` (also listed, also restorable).
- Settings shows *Last saved* with the sync state in words (saved / saving /
  offline / reloaded). *Export backup* still downloads a JSON copy and
  *Import backup* still reads one.

`server/data/` is git-ignored.

## Security posture

- Bank logins happen only in Plaid's own Link window. No Ledger form asks for
  a bank credential and the server only ever sees the resulting token.
- Access tokens live in `server/data/items.json`, encrypted with AES-256-GCM
  (`server/crypto.mjs`); they are decrypted in memory for a sync and never
  sent to the browser (`publicItem` strips them from every response).
- Secrets are env (`PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`,
  `LEDGER_KEY`); nothing is in code or git.
- The server binds localhost or your tailnet address only (see Run).
- Logs are one line per request — method, path, status, milliseconds — never
  a token, a payee or an amount.

Rationale and the full table of rules: [ADR 0036](../../docs/adr/0036-ledger-system-of-record-and-security-posture.md).

## Bank connections (Plaid)

The browser never holds a bank secret. The server owns the Plaid credentials
and the per-connection access tokens. The app only sees item ids and account
summaries through `/api/bank/*`, proxied by Vite. Providers sit behind one
adapter shape (`server/providers/mock.mjs`, `server/providers/plaid.mjs`:
link → accounts → sync-with-cursor → remove), chosen by env.

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

## Insight

Overview shows **Safe to spend** and a **Recurring** table, computed by
`src/data/insights.ts` from the transactions already in the ledger — no
prompt, no chat box.

- *Recurring*: a payee seen three or more times within ±20% of the same
  amount on a weekly (6–8 days), monthly (27–33) or yearly (350–380) beat.
  Anything else is left undetected rather than guessed.
- *Safe to spend* = money left of this month's income − recurring bills still
  due this month − room still open in budgets. The stat's hint is that sum in
  words, with every figure; a number you cannot check is not shown.

## Appearance

Settings → Appearance picks **System**, **Light** or **Dark**. The app stores
the preference; it never picks a colour. The engine's skin owns the palette and
switches the whole app — native controls included — from that one setting, and
"System" follows the device.

## Bookkeeping

- [`TENETS.md`](./TENETS.md) — the rules this app is measured against (local-first, owner-hosted, nothing lost, credentials never pass through Ledger).

Architecture and rationale live in the ADRs:
[0034 — typed blocks decided by an engine](../../docs/adr/0034-engine-typed-blocks-decided-by-an-engine.md),
[0035 — the appearance layer](../../docs/adr/0035-engine-appearance-layer.md)
and [0036 — system of record and security posture](../../docs/adr/0036-ledger-system-of-record-and-security-posture.md).

## Privacy

Nothing leaves your machine except calls to Plaid from the server you run,
and the ledger itself never leaves `server/data/`. Delete `server/data/items.json` (or remove the connection in the app, which
also calls Plaid's `/item/remove`) to revoke access.
