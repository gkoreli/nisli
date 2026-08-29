# Bank-data provider selection for Ledger — 2026-08-29

**Status**: decision taken (see below) · **Scope**: one user, self-hosted on a
Mac behind Tailscale, needs Chase checking + savings + Sapphire card,
daily sync · **Method**: web research by an agent on 2026-08-29, every fact
cited to a public source read that day; per-item Plaid prices are not public
and are marked as community reports.

## Decision

1. **Primary: Plaid on the Trial plan.** Teams created on/after 2026-04-15
   get free Production access for up to 10 Items (one Item = one bank login;
   all three Chase accounts are one Item), Transactions + Balance included,
   immediate access to OAuth institutions including Chase. Login happens on
   chase.com (Chase OAuth), revocable in Chase Security Center. Plaid has a
   signed Chase data-access agreement (Sept 2025), so its Chase access is the
   least exposed to the 2025–26 fee regime. `/transactions/sync` cursor,
   pending flags, categories, up to 730 days of history. Webhooks optional —
   daily polling is fine.
2. **Parallel track: SimpleFIN Bridge** ($15/yr, MX underneath). No
   application, one secret (an access URL), one endpoint. 24 h refresh, no
   categories, 90-day query windows. Two-person company; exercises the
   adapter seam so Ledger never depends on one vendor.
3. **Always: CSV/QFX import** from chase.com (≤24 months, ≤1,000 rows/file;
   OFX Direct Connect ended 2022-10-06). Backfill and outage path.
4. **Not chosen**: Teller (free, lists Chase, but connects via the bank's
   private mobile-app APIs with credentials typed into Teller — the access
   model Chase is closing; violates tenet 4 in spirit); MX direct, Finicity,
   Yodlee, Akoya (commercial onboarding, not for individuals).

## The one wrinkle for a Tailscale-only host

Plaid Production requires an **HTTPS** OAuth `redirect_uri`. Use
`tailscale serve --bg --https=443 http://127.0.0.1:<port>` → the app is
`https://<mac>.<tailnet>.ts.net` with a public Let's Encrypt certificate; the
redirect is followed by the owner's own browser inside the tailnet, so the
Mac is never publicly reachable. No webhooks needed.

## Scorecard (1 poor – 5 excellent)

| Criterion | Plaid (Trial) | SimpleFIN | Teller | Akoya | MX / Finicity / Yodlee | Chase export |
|---|---|---|---|---|---|---|
| Individual can get production, fast | 4 | 5 | 5 | 2 | 1 | 5 |
| Chase supported / method | 5 (OAuth) | 4 (via MX, OAuth very likely) | 3 (credential login) | 5 | 3–5 | manual |
| Cost, 1 user / 3 accounts | 5 ($0; ≈$0.30/mo if paid) | 5 ($15/yr) | 5 ($0) | ? | 1 | 5 |
| Data quality (pending, categories, history) | 5 | 3 | 4 | 4 | 4 | 2 |
| Security model | 5 | 5 | 2 | 5 | 4 | 5 |
| Node ergonomics | 5 | 4 | 4 | 3 | 3 | 2 |
| Longevity / vendor risk | 4 | 3 | 2 | 4 | 4 | 5 |
| Tailscale / localhost fit | 4 (HTTPS redirect) | 5 | 5 | 3 | 3 | 5 |

## Context that shaped it (2025–2026)

- CFPB §1033 open-banking rule is enjoined (E.D. Ky., Nov 2025) and being
  rewritten; an Aug 2026 NPRM reopens whether banks may charge for data.
- JPMorgan Chase began charging aggregators in 2025; Plaid (Sept 2025),
  Yodlee, Morningstar and Akoya signed. MX's status is not public.
- Chase ended OFX Direct Connect on 2022-10-06; only site downloads remain.

## Steps the owner does himself (credentials are never shared with anyone)

**Tailscale HTTPS**: admin console → enable MagicDNS + HTTPS certificates;
on the Mac `tailscale serve --bg --https=443 http://127.0.0.1:<port>`.

**Plaid**: dashboard.plaid.com → new team (created after 2026-04-15 →
Trial) → complete the streamlined questionnaire (personal budgeting, single
user, self-hosted) → Team Settings → Keys → `PLAID_CLIENT_ID`,
Production `PLAID_SECRET`, `PLAID_ENV=production` into the server env →
API → allowed redirect URIs → `https://<mac>.<tailnet>.ts.net/plaid/oauth-return`
→ verify Chase is listed under OAuth institutions → link from Ledger with
`days_requested: 730`.

**SimpleFIN**: beta-bridge.simplefin.org → pay → connect Chase in the
MX-hosted widget → New App → setup token → paste once into Ledger (it claims
the access URL and stores it encrypted).

## What the adapter must abstract (input to the server design)

- `beginLink()` returns one of `hosted-ui` (Plaid Link, needs a token and a
  redirect URI) · `paste-token` (SimpleFIN) · `file` (CSV/QFX).
- `SyncState` is opaque per provider: Plaid = `next_cursor`; SimpleFIN = last
  window + known ids (diff locally, including pending → posted).
- Normalised transaction: `{ providerTxId, accountId, amount (signed minor
  units), currency, date, authorizedDate?, pending, pendingTxId?,
  description, merchant?, category? (nullable), raw }`.
- Sign convention differs (Plaid positive = outflow; SimpleFIN negative =
  outflow): normalise at the boundary.
- `Connection.status = 'ok' | 'reauth-required' | 'error'` unifies
  `ITEM_LOGIN_REQUIRED` / 403s. Expose `minSyncInterval` per provider
  (SimpleFIN ≈ 24 calls/day).
- Secrets: one encrypted row per connection; key outside the repo.

## Open unknowns

Plaid Trial approval turnaround; Plaid pay-as-you-go per-Item price
(community ≈ $0.30/Item/mo); whether MX signed a Chase fee agreement;
whether Teller's Chase path is sanctioned today; Akoya's terms for an
individual.

## Sources (read 2026-08-29)

Plaid: docs/account/billing · docs/link/oauth · docs/transactions ·
docs/api/products/transactions · docs/api/items · support "What is the Plaid
Trial plan" · support "Do access tokens expire" · releasebot.io/updates/plaid
· checkthat.ai/brands/plaid/pricing · vendr.com/marketplace/plaid.
SimpleFIN: beta-bridge.simplefin.org (developers, security, mission) ·
simplefin.org/protocol.html · actualbudget.org bank-sync/simplefin · GitHub
actualbudget/actual#6649. Teller: teller.io (auth, connect, quickstart,
transactions, webhooks, institutions) · HN 14605953. Akoya: akoya.com/pricing,
/getaccess. MX: dashboard.mx.com/sign_up · docs.mx.com integration checklist.
Mastercard Open Banking test docs · quiltt.dev Finicity. Regulatory/market:
ABA Banking Journal (2025-11) · Consumer Finance Monitor (2026-06-26,
2026-08-06) · PYMNTS · Bloomberg Law · FinTech Weekly (2025-11-15) · CNBC
(2025-11-14). Chase export: Infinite Kind KB · DocuClipper · bankxlsx.
Tailscale: docs how-to set-up-https-certificates · features/tailscale-serve.
