# Ledger

A personal-finance app built on `@nisli/engine`. No visual decisions in app
code; the engine lays it out, the skin dresses it.

## Run

```sh
mise install                              # Bun 1.4.0, Node 22, pnpm 10.17.1
pnpm --filter @nisli/ledger dev:all     # ledger server on :5201 + Vite on :5200
```

`dev:all` supervises both processes: stopping it stops the API and Vite
together, so a later run does not inherit an orphaned listener on port 5201.

Ledger pins Bun 1.4.0 exactly. pnpm remains the repository's workspace/package
manager; Bun runs Ledger's typed server and, through the officially supported
`bunx --bun vite` path, the client dev/build toolchain. The executable Ledger
surface is TypeScript — there are no `.mjs` server or service scripts.

The server (`server/index.ts`, zero runtime dependencies) is the system of record;
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

For a production-shaped local run, build once and let the same server deliver
the app and API on port 5201:

```sh
pnpm --filter @nisli/ledger build
pnpm --filter @nisli/ledger start
```

## Data & backups

- The ledger is one JSON document, `server/data/ledger.json`, with a version
  number. Every write is a temp-file-and-rename, so it is durable before the
  browser hears "saved"; every write carries the version it was based on and
  a stale one is refused (409) — the browser then replays owner edits over the
  newer server projection and retries, without overriding bank-owned facts.
- The browser keeps a read cache in `localStorage` (`ledger.v2`) and works
  from it while offline; edits are retried until they land. A browser cache is
  never promoted into an empty server, so retired sample data cannot become
  authoritative. Existing server data is the migration boundary.
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
- A one-use Plaid token is exchanged into an encrypted staged connection before
  account enrichment. If Plaid is temporarily unavailable after exchange,
  retry/sync resumes that connection instead of allocating another Item.
- Access tokens live in `server/data/items.json`, encrypted with AES-256-GCM
  (`server/crypto.ts`); they are decrypted in memory for a sync and never
  sent to the browser. Opaque provider checkpoints are server-only too.
- Secrets are env (`PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`,
  `LEDGER_KEY`); nothing is in code or git.
- The server refuses LAN/public bind addresses, validates write origins and
  JSON content types, and accepts localhost or tailnet hosts only (see Run).
- Ledger is a single-owner application. Loopback is trusted; for phone access,
  the owner's Tailscale identity and ACL are the authentication boundary.
  Do not expose Ledger to a shared tailnet unless its ACL grants access only to
  the owner's devices, and never use Funnel or a public/LAN bind.
- Logs are one line per request — method, redacted route, status, milliseconds
  — never a connection id, token, payee or amount.

Rationale and the full table of rules: [ADR 0036](../../docs/adr/0036-ledger-system-of-record-and-security-posture.md).

## Connect real accounts with Plaid

The browser never holds a bank secret. The server owns the Plaid credentials
and the per-connection access tokens. The app only sees item ids and account
summaries through `/api/bank/*`, proxied by Vite. Providers sit behind one
normalized adapter shape (`server/providers/plaid.ts`): link →
signed-minor-unit accounts and transactions → sync-with-checkpoint → remove.
There is no runtime mock provider and no sample ledger. A fresh installation
starts with reference categories and empty accounts, transactions, rules, and
budgets. Missing Plaid credentials or `PLAID_ENV=sandbox` stops startup with a
clear error rather than inventing financial data. Retired mock connection
records are recognized only so **Start fresh with live data** can remove them
safely behind a backup.

- Copy `.env.example` to `.env`, make it owner-readable only, and enter the
  keys from dashboard.plaid.com. The server loads this file; it is git-ignored.
- `PLAID_ENV` must be `development` or `production`; this owner installation
  uses `production`.
- A new Item requests 730 days of Transactions history. Do not create a real
  Production Item with older Ledger code: Plaid does not let an Item increase
  `days_requested` later, and removing an Item does not restore a Trial slot.

```sh
cd packages/ledger
cp .env.example .env
chmod 600 .env
# Edit .env locally; never paste its values into chat or git.
pnpm dev:all
```

The safe sequence is:

1. Use the Production client id/secret with `PLAID_ENV=production`, restart
   Ledger, and connect Chase once. Select checking, savings, and Sapphire in
   that single Chase authorization.
2. Banks calls the projection **Mixed** when older sample/local/imported facts
   remain. Choose **Start fresh with live data**. Ledger fetches a complete
   snapshot first, creates a named restorable backup, reuses the existing
   Production Item, removes retired sample-bank records plus unchanged sample
   budgets/rules, and preserves categories, customized configuration, and
   preferences.
3. Confirm all selected masks and balances, sync, and inspect history older than
   90 days before treating setup as complete.

Sync uses Plaid's `/transactions/sync` cursor, so each sync brings only what
changed. The server atomically dedupes, replaces pending transactions when they
post, applies rules, and keeps each account's opening balance such that opening
+ transactions = the bank's reported balance. It also syncs once per local day
at 06:00 (or after wake/restart if that run was missed); `LEDGER_SYNC_HOUR`
changes the hour. Initial historical loading is retried every 15 minutes until
Plaid reports it complete. Provider changes are retained in an audit history,
and accounts no longer reported by a bank remain visible as inactive rather
than disappearing with their transaction history.

## Private phone access

Install Tailscale on the Mac and phone and sign both into the same tailnet.
Enable MagicDNS and HTTPS certificates in the Tailscale admin DNS page, then
keep Ledger on localhost and proxy it privately:

```sh
tailscale serve --bg 5201
tailscale serve status
```

Use the shown `https://<machine>.<tailnet>.ts.net` address. Add its exact
`/connections` URL to Plaid Dashboard → API → Allowed redirect URIs, then put
that same URL in `.env` as `PLAID_REDIRECT_URI` and restart Ledger. This enables
OAuth resumption on mobile; do not use Tailscale Funnel.

To keep the built server running at login without storing secrets in the
LaunchAgent plist:

```sh
pnpm --filter @nisli/ledger service:install
# later, to remove it:
pnpm --filter @nisli/ledger service:remove
```

## Finance domain

Overview is derived by the pure modules in `src/data/finance/` from the real
accounts and transactions already in Ledger — no prompt, chat box, mock, or
parallel reporting model.

- Money stays in integer minor units and is aggregated per currency. A report
  never converts or silently adds currencies; the screen names exclusions.
- Money in, money out, transfers, category rollups, and comparison windows use
  one shared flow and period model. Every rollup row drills into the exact
  transaction filter behind it.
- A recurring series requires a payee seen three or more times within ±20% of
  the same amount on a weekly (6–8 days), monthly (27–33), or yearly (350–380)
  beat. Anything else is left undetected rather than guessed.
- *Safe to spend* = posted checking cash − recurring bills due before the next
  expected income (at most 30 days) − open current-calendar-month budget room.
  Pending outflows are reserved; pending income, transfers, non-default
  currencies, and the full arithmetic are explicit. A due bill covers only
  the matching portion of its category's remaining budget room.
- *Runway* = posted checking and savings cash ÷ the median outflow of the last
  three complete months. When the denominator is absent, Ledger says the
  figure is not measurable instead of inventing one.

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
and [0036 — system of record and security posture](../../docs/adr/0036-ledger-system-of-record-and-security-posture.md),
[0039 — bank connectivity domain](../../docs/adr/0039-ledger-bank-connectivity-domain.md).

The Bun integration follows Bun's primary documentation for
[TypeScript](https://bun.com/docs/typescript),
[explicit environment files](https://bun.com/docs/runtime/environment-variables),
[Bun.serve](https://bun.com/docs/runtime/http/server),
[child processes](https://bun.com/docs/runtime/child-process), and
[Vite](https://bun.com/docs/guides/ecosystem/vite). Bun 1.4 is pinned rather
than floating; its release rationale and compatibility changes are recorded in
the [official Bun 1.4 release](https://bun.com/blog/bun-v1.4).

## Privacy

Nothing leaves your machine except calls to Plaid from the server you run,
and the ledger itself never leaves `server/data/`. Delete `server/data/items.json` (or remove the connection in the app, which
also calls Plaid's `/item/remove`) to revoke access.
