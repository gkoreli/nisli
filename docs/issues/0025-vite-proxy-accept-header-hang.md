# 0025 — A JSON `POST` through the Vite dev proxy hung with `Accept: */*`

**Status**: open — observed, root cause not found
**Priority**: P3
**Area**: `packages/ledger` dev setup — `vite.config.ts` `server.proxy`, `@nisli/router` `nisliRoutes`, `@nisli/core/vite-hmr`
**Found**: 2026-08-29, wiring the Banks screen to the Ledger API server

## Summary

With the Ledger dev server proxying `/api` to the Node API server, an in-page
`fetch('/api/bank/link-token', { method: 'POST', headers: { 'Content-Type':
'application/json' }, body: '{}' })` — the browser's default `Accept: */*` —
did not resolve within 2.5 s, while the same request with
`Accept: application/json`, with a `text/plain` body, or with no body resolved
immediately. The API server logged `→ 200` for the hung request, so the
response was lost between server and page.

Two things were true at once that day, and only one was explained:

- **Explained**: a stray Vite instance had hopped onto the API's port and sat on
  `::1:5201`; the proxy target `localhost:5201` reached *it* first and it
  proxied back to 5201. That accounted for ~2.4 s on *every* proxied call, GET
  included. Fixed by `strictPort: true`, a `127.0.0.1` target, and killing the
  stray process.
- **Unexplained**: the `Accept` sensitivity above was observed *before* that
  fix and not re-tested after it in isolation. `nisliRoutes`
  (`packages/router/src/vite.ts`) calls `next()` for any non-GET/HEAD and for
  any request not accepting HTML, so it is not the obvious culprit.

The client now sends `Accept: application/json` on every call
(`packages/ledger/src/data/bank.ts`), which is correct regardless.

## Reproduce (to confirm or close)

1. `pnpm dev:all` in `packages/ledger` with nothing else on 5200/5201.
2. In the page console: `fetch('/api/bank/link-token', { method: 'POST',
   headers: { 'Content-Type': 'application/json' }, body: '{}' })`.
3. Compare against the same call with `Accept: application/json`.

If both resolve promptly, close this as a symptom of the port collision.
