# Bet 07 — Typed Server Functions, Standard Schema Validation, Deploy Adapters, and an Auth Recipe

**Status:** Draft investment brief (August 2026 research sweep)
**Repo baseline:** local `main` @ `b17e3ae`; `@nisli/router` 0.5.1, `@nisli/core` 0.54.1, `@nisli/ssg` 0.4.0

## Context

The 2026 full-stack adoption gate moved. Typed route catalogs — nisli's ADR 0026 achievement — read as table stakes now; the breakout feature of the year is the **typed isomorphic server function**. TanStack Start's v1 launch built its pitch on `createServerFn`: a builder that validates input, strips the handler from the client bundle, and leaves a typed RPC stub behind ([TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)). SvelteKit shipped the same idea as **remote functions** (`query`/`form`/`command`/`prerender` exported from `.remote.ts` files, transformed to fetch wrappers on the client) and has been hardening it through 2026 ([SvelteKit remote functions](https://svelte.dev/docs/kit/remote-functions)). A framework without this in 2026 is evaluated as front-end-only.

Three ecosystem facts shape the design space:

1. **[Standard Schema](https://jsonkit.in/blog/zod-v4-vs-valibot-vs-arktype)** is the settled interop layer: a ~60-line TypeScript spec (`~standard` property + `validate`) implemented by Zod v4, Valibot, ArkType, and TypeBox, and consumed by tRPC, oRPC, Hono, and TanStack. Accept `StandardSchemaV1`; never hard-depend on Zod. Zero runtime cost — it is a type-level contract, which fits nisli's zero-dependency core rule exactly.
2. **[WinterTC ECMA-429](https://ecma-international.org/publications-and-standards/standards/ecma-429/)** ("Minimum Common Web API", 1st edition adopted by the Ecma General Assembly, December 2025) is the sanctioned portability target across Node, Deno, Bun, and Workers. A server-function `ctx` designed to that surface runs everywhere without adapter-specific handler code.
3. **Edge *rendering* is dead as a pitch; edge *deploy* is not.** Vercel [deprecated standalone Edge Functions](https://vercel.com/docs/functions/runtimes/edge/edge-functions.rsc) (June 2025) and Next 16.3 removed `runtime = 'edge'` — but Cloudflare Workers as a deploy target is mainstream (18+ frameworks). nisli should sell "one catalog, one handler, Node or Workers", not "edge-first".

Finally, **auth absence is a cited adoption blocker** (SolidStart's explicitly named gap). The ecosystem norm is "works with [Better Auth](https://github.com/zpg6/better-auth-cloudflare) day one" — Better Auth is framework-agnostic (`auth.handler(request: Request)`), runs on Workers/D1 and Node, and needs only a mounted route prefix plus header access. That is a recipe, not framework code — but the ctx/adapter surface must be designed for it.

nisli is unusually well-positioned for this bet: ADR 0026's environment-neutral catalog (`@nisli/router/catalog`, core-free, Worker-proven via the erent 0.3.0/0.4.0 amendments) already established the exact architectural pattern a server-function system needs — **identity travels everywhere; behavior binds per environment**. Bet 07 is that philosophy applied to functions instead of routes.

## Current state in nisli

**What exists (verified):**

- **Environment-neutral route catalog.** `packages/router/src/catalog.ts:1-16` documents the pure subpath: `route`/`redirect`/`notFound`, codecs, `createMatcher`/`defineRoutes` with no `@nisli/core` runtime in its import graph, guarded by `packages/router/src/purity.test.ts` (source `import type` audit + BFS over the built subpath graph). Exports map: `packages/router/package.json:19-24` (`.`, `./catalog`, `./vite`).
- **Render-separated definitions.** `route()`'s `render` is optional (`packages/router/src/route.ts:80-92`); `bindRenders()` attaches client renderers exhaustively and identity-preservingly (ADR 0026, 0.4.0 section, `docs/adr/0026-typed-application-router.md:928-997`). A Worker consumes the render-less catalog via `createMatcher` for matching + metadata only.
- **Vite plugin = serve-only fallback middleware.** `packages/router/src/vite.ts:49-85` — `nisliRoutes(AppRouter)` registers one dev middleware that serves the transformed `index.html` shell for any GET/HEAD `Accept: text/html` request the router matches. **It has no `transform`, no `resolveId`/`load`, no build-mode behavior** (`apply: 'serve'`, `vite.ts:56`), and ADR 0026 RTR-4 records that deliberately. There is no code-splitting transform machinery anywhere in the repo to extend — the server-fn transform is greenfield.
- **SSG.** `packages/ssg/src/build.ts:144` `buildStaticSite({ router })` expands `entries()`, renders under happy-dom (`packages/ssg/src/environment.ts:1,41`), writes `dist/<path>/index.html` + `404.html`. Purely static output; no request handler is emitted.
- **Query/QueryClient in core.** `packages/core/src/query.ts:229` (`QueryClient` with `invalidate`/`clear`/`prefetch`), `query.ts:430` (`query(keyFn, fetcher, options)`), fetcher contract `(signal: AbortSignal) => Promise<T>` at `query.ts:133`. `packages/core/src/settle.ts:1-33` — `await settle()` is the SSG pre-snapshot barrier for framework-started async.

**What does not exist (verified by sweep):** no server functions, no RPC, no `Request`-handling adapter, no auth integration, no Standard Schema import — greps for `serverFn`/`rpc`/`adapter`/`auth` across `packages/*/src` hit only UI-component filenames. The router's ADR explicitly deferred "loaders/actions and mutation protocols" (`docs/adr/0026:457`).

## Proposed design

New package **`@nisli/server`** with subpaths mirroring the router's discipline: `.` (pure primitive, ECMA-429 only), `./vite` (plugin), `./worker`, `./node` (adapters). Router stays untouched.

### Authoring: module-boundary split, not AST surgery

Server functions live in `*.server.ts` modules (SvelteKit's `.remote.ts` precedent, chosen over TanStack's per-expression compiler extraction). The **module is the split unit**: the client build replaces the whole module with generated stubs keyed by export name; the server build keeps it verbatim. This is the same discipline as ADR 0026's "render callbacks must use dynamic `import()`" rule — a file-level contract that a purity test can enforce, instead of closure-capture analysis that fails silently.

```ts
// src/server/users.server.ts
import { serverFn, fnError } from '@nisli/server';
import * as v from 'valibot'; // any Standard Schema library — or zod, arktype, typebox

export const getUser = serverFn({
  input: v.object({ userId: v.string() }),
  handler: async (input, ctx) => {
    const user = await ctx.env.DB.get(input.userId);       // consumer-typed env
    if (!user) throw fnError('NOT_FOUND', { userId: input.userId });
    return { id: user.id, name: user.name };               // must be JSON-serializable
  },
});

export const updateUser = serverFn({
  input: UpdateUserSchema,
  handler: async (input, ctx) => { /* … */ },
});
```

`serverFn` is generic over `StandardSchemaV1`: input type = `InferInput<S>`, handler receives `InferOutput<S>` (post-validation, so transforms/defaults apply), return type flows to the client. **`input` is mandatory** when the client passes an argument; a zero-argument fn declares `input: 'none'` explicitly — there is no unvalidated passthrough. A `.server.ts` module may export only server fns and types; anything else is a build error (prevents accidental secret re-export through the stub module).

Client call site is just the import — no hook, no wrapper:

```ts
import { getUser } from './server/users.server.js'; // client build sees the stub
const user = await getUser({ userId: '42' });                    // typed
const user2 = await getUser({ userId: '42' }, { signal });        // AbortSignal passthrough
```

### Transform (`@nisli/server/vite`)

Standard `resolveId`/`load`/`transform` hooks (Rolldown-compatible — Vite 8 preserves the plugin API; [Vite 8.0](https://vite.dev/blog/announcing-vite8)):

- **Client environment:** a `*.server.ts` module resolves to a virtual stub module: for each export, `createStub(id, name)` producing `(input, opts?) => fetch('/_nisli/fn/' + id, …)`. Function id = SHA-256 of `(root-relative module path, export name)` — deterministic and identical in both builds (TanStack's `generateFunctionId` precedent).
- **Server environment:** the real module, plus a generated **manifest module** `virtual:nisli-server-fns` mapping id → lazy `() => import(module)` + export name. Adapters consume the manifest; handlers stay code-split and lazy on the server too.
- **Dev:** the plugin registers middleware (same shape as `nisliRoutes`) that dispatches `/_nisli/fn/*` by importing the real module through the **Vite Environment API** ssr environment (`server.environments.ssr.runner.import(...)`) — the integration surface serious frameworks build on (Astro 6/7 did; [InfoQ on Vite 8](https://www.infoq.com/news/2026/05/vite-v8-rust/)). HMR of a `.server.ts` module invalidates only the server environment; client stubs are content-stable (id doesn't change on body edits).

### Wire format and error semantics

- **POST only** in v1 (mutation-safe default; deliberately *not* TanStack's GET default — GET caching semantics and CSRF-prone side effects are a phase-2 concern for cacheable reads). Path `/_nisli/fn/<id>`, body `{ input }` as JSON, and a required `X-Nisli-Fn: <id>` header.
- Response envelope: `200 {ok:true, data}` · `400 {ok:false, error:{code:'VALIDATION', issues}}` (Standard Schema issues, safe to render) · `4xx/5xx {ok:false, error:{code, data?}}` for thrown `fnError(code, data)` · `500 {ok:false, error:{code:'INTERNAL'}}` for any other thrown error — **message redacted by default**; only `FnError` instances cross the wire with payloads. The stub re-throws `FnError` with the typed `code`/`data`, so client `catch` is typed via `isFnError(e, 'NOT_FOUND')`.
- **Redirects:** handler throws `fnRedirect(href)`; serialized as `{ok:false, redirect}` (never HTTP 3xx — fetch would follow it into JSON-vs-HTML confusion; TanStack made the same call). The stub, when `@nisli/router` is present, calls `inject(Router).navigate(href)`; standalone it assigns `location.href`. Route hrefs compose naturally: `fnRedirect(catalog.login.href())`.

### `ctx` — ECMA-429-only by construction

```ts
interface ServerFnCtx<Env = unknown> {
  request: Request;                       // headers, cookies, URL — never the body (consumed)
  env: Env;                               // Workers bindings | Node: adapter-provided (process.env wrapper, db handles)
  waitUntil(p: Promise<unknown>): void;   // Workers-native; Node adapter: tracked for graceful shutdown
  setHeader(name: string, value: string): void;  // response headers incl. Set-Cookie (append semantics)
}
```

Everything is fetch-spec vocabulary; nothing is Node-only. `Env` is a consumer-side generic (module augmentation `declare module '@nisli/server' { interface ServerEnv {…} }`), the same move Workers' own typegen uses.

### Adapters

The honest insight: because nisli is SSG-first and catalog matching is already edge-capable, **the adapters are small** — the only new production piece is a request handler that routes serverFn endpoints and optionally fronts SSG output.

```ts
// worker.ts — @nisli/server/worker
import manifest from 'virtual:nisli-server-fns';
export default {
  fetch: createWorkerHandler({
    fns: manifest,
    mounts: { '/api/auth': (req) => auth.handler(req) },   // Better Auth passthrough
    assets: (req, env) => env.ASSETS.fetch(req),           // Workers Static Assets = SSG dist
    catalog,                                               // optional: createMatcher for 404/redirect parity
  }),
};
```

`createNodeHandler` returns the same `(Request) => Promise<Response>` core; `serve({ port, static: 'dist' })` wraps it in `node:http` with Request/Response conversion — the *only* Node-specific code in the package, isolated exactly like the router isolates `@nisli/core` behind `/catalog`.

### Query composition — server fn as fetcher

The stub's `(input, {signal})` shape is assignable to core's `QueryFetcher` with one closure:

```ts
const user = query(
  () => ['user', userId.value],
  (signal) => getUser({ userId: userId.value }, { signal }),
);
// mutation → invalidate: await updateUser(input); inject(QueryClient).invalidate(['user']);
```

No new API in core. Route-level "loader-ish" usage falls out of `QueryClient.prefetch` (`query.ts:284`) inside the route's existing async `render` — ADR 0026's deferred loader contract stays deferred, honestly.

### Auth recipe (documented, not framework code)

Better Auth needs exactly three things from nisli, all in the design above: (1) an adapter **mount** for `/api/auth/*` returning `auth.handler(request)` verbatim (its `Response` carries `Set-Cookie` untouched); (2) `ctx.request.headers` for `auth.api.getSession({ headers })`; (3) `ctx.setHeader` append semantics for session refresh cookies. The recipe ships a ~20-line protected wrapper:

```ts
export const authed = <S extends StandardSchemaV1, R>(cfg: {input: S; handler: (i, ctx & {session}) => R}) =>
  serverFn({ input: cfg.input, handler: async (input, ctx) => {
    const session = await auth.api.getSession({ headers: ctx.request.headers });
    if (!session) throw fnError('UNAUTHORIZED');
    return cfg.handler(input, { ...ctx, session });
  }});
```

Documented end-to-end for both adapters (Node + [Workers/D1](https://hono.dev/examples/better-auth-on-cloudflare)).

## Implementation plan

**Phase 1 — MVP (ships as `@nisli/server@0.1`):**
1. `serverFn` + `fnError`/`fnRedirect` + wire codec, pure module, ECMA-429-only, purity guard test cloned from `purity.test.ts`.
2. Vite plugin: client stub / server manifest environments split, dev dispatch middleware via Environment API, deterministic ids.
3. Workers adapter + Node adapter (`createWorkerHandler`/`createNodeHandler`/`serve`), mounts, static fronting.
4. Security defaults on (below); Standard Schema validation mandatory.
5. Better Auth recipe (docs + example app under `packages/www` or a new `examples/`), query-integration docs.

**Phase 2 (explicitly deferred):** middleware chains (TanStack-style composable — `authed` wrapper covers 80% first); streaming responses (`ReadableStream` is already legal in the envelope escape hatch, but no API); **form actions with progressive enhancement** — nisli's light-DOM, native-anchor philosophy (ADR 0026 §6) makes `<form action="/_nisli/fn/<id>" method="post">` + FormData-mode serverFn a genuine differentiator (SvelteKit's `form` remote function proves demand; nisli's no-JS story is already better than its peers'); GET/cacheable read fns; optimistic mutation helpers; rate-limit hooks.

## Runtime portability — ECMA-429 surface audit

Everything `@nisli/server` core touches, checked against the [Minimum Common Web API](https://min-common-api.proposal.wintertc.org/): `Request`/`Response`/`Headers`/`fetch` ✓, `URL`/`URLSearchParams` ✓, `AbortController`/`AbortSignal` ✓, `TextEncoder`/`TextDecoder` ✓, `crypto.randomUUID`/`SubtleCrypto` ✓ (request-id + any token compare; fn-id hashing runs at build time in the plugin, not the runtime), `structuredClone` ✓, `queueMicrotask` ✓, `console` ✓, `ReadableStream` ✓ (phase 2). **Not used:** filesystem, `process`, Node streams, `Buffer`. The Node adapter alone imports `node:http`/`node:fs` (static serving) and lives behind `./node`. Enforcement is a BFS import-graph test per subpath — the router already proved this guard style works (`purity.test.ts`). `waitUntil` is the one non-429 concept; it is adapter-injected capability, absent from the pure surface.

## Interactions

- **Bet 03 (engine).** The adapters' `(Request) => Promise<Response>` core is exactly the seam a future server-render/streaming engine plugs into: today the handler serves SSG output for page requests; an engine bet swaps that branch for on-demand render without touching the fn protocol. Design the handler as `route → (fn | mount | page)` dispatch so bet 03 replaces only the `page` arm.
- **Query/QueryClient (ADR 0030.2 T1/T2).** Server fns are the missing typed fetcher for `query()` — zero core changes, flat keys pair naturally with fn input tuples. `settle()` remains the SSG barrier: any build-time fn call must terminate before snapshot, and the SSG stance in `query.ts:43-47` (disable or settle) carries over verbatim.
- **SSG.** Unchanged and load-bearing: the pitch is "static site + typed functions", not SSR. `buildStaticSite` output becomes the `assets`/`static` arm of both adapters; `404.html` conventions already match Workers static hosting.
- **Bet 06 (WebMCP / agent-native, ADR 0029/0030).** A serverFn is already `{name, input schema, typed result}` — precisely a tool descriptor. A later `describeFns(manifest)` can emit MCP tool definitions or WebMCP `document.modelContext` registrations mechanically; Standard Schema → JSON Schema conversion is the only added piece. Server fns make bet 06 cheaper; nothing here blocks it.

## Risks & open questions

1. **Bundle-split correctness is the whole game.** A server module leaking into the client bundle leaks secrets. Mitigations: module-boundary split (no partial extraction), export restriction on `.server.ts`, and a build-output guard test (sentinel string in a handler must not appear in any client chunk). Residual risk: a *client* module importing a shared module that itself imports `.server.ts` — the stub substitution handles it, but the test matrix must include transitive cases and both dev and Rolldown-build paths.
2. **CSRF.** Default-on: POST-only + required custom header (cross-origin HTML forms cannot set it) + server-side `Origin`/`Sec-Fetch-Site` same-origin check with an explicit allowlist escape. Phase-2 form actions reopen this (no custom header on native forms) and will need origin-check + token; noted now so phase 1 doesn't paint us in.
3. **Validation is mandatory, but output is not validated.** Do we offer optional `output` schema (TanStack's `strict: {output}`) in v1 or trust the type? Lean: defer; document.
4. **Serialization scope.** JSON-only v1 rejects `Date`/`Map`/binary. SvelteKit uses devalue-style encoding. Adopting a superjson-like codec adds a dependency — against core rules. Open: ship JSON-only with a documented `Response` escape hatch, revisit on demand.
5. **Wire/version skew** between a deployed Worker and cached client chunks (stale stub calling a removed fn) → `404 {code:'UNKNOWN_FN'}` with a documented client story (prompt reload). Not solved deeper in v1.
6. **Vite Environment API churn.** Stable-ish in Vite 8 but framework-runner idioms are still settling; the dev dispatcher should stay as thin as `nisliRoutes` so churn is absorbed in one file.
7. **Does `@nisli/server` depend on `@nisli/router`?** Proposed: no (peer-optional; stub uses `Router` only if injectable). Keeps widget/library consumers clean but adds a soft-dependency test axis.

## Verification plan

Following the repo's empirical-probe culture (and the harness-attestation convention for any committed scripts): type-level suites (`test-d`) proving input/output inference and rejection of un-serializable returns; wire round-trip unit tests (validation failure envelope, `fnError` typed rethrow, redirect handling, redaction of plain `Error`); **client-purity guard**: build a probe app, BFS + sentinel-grep every client chunk for server-module content, in both dev-served and Rolldown-built modes; adapter parity suite running the identical fn set under Node (`vitest`) and workerd (`@cloudflare/vitest-pool-workers`), asserting byte-identical envelopes — the analog of `router-equivalence.test.ts`; CSRF tests (missing header, cross-origin Origin → rejected); dev-server test in the `vite.test.ts` style; Better Auth recipe exercised end-to-end (sign-in → session in `ctx` → `authed` fn → sign-out) against D1-in-workerd and SQLite-on-Node; `settle()`/SSG interaction test (build with a fn-backed query must either settle or fail loudly).

## Size estimate

- Core primitive + wire codec + purity guards: **~1.5 wk** (≈600 LOC + tests)
- Vite plugin (stub/manifest environments, dev dispatch, id scheme): **~1.5 wk** (highest-risk component)
- Workers + Node adapters, mounts, static fronting: **~1 wk**
- Auth recipe + example + query/SSG docs: **~1 wk**
- Hardening, parity/CSRF/purity verification matrix: **~1 wk**

**Total v1: ~6 engineer-weeks** (one engineer, ADR-first per house style — the ADR itself is ~2 days of that). Phase 2 form actions: +2–3 wks when scheduled. This is the largest single bet in the sweep, and the one that moves nisli's category from "typed-routes framework (2023-era read)" to "full-stack-capable, agent-ready, deploy-anywhere" — the 2026 adoption gate.

## Sources

- [TanStack Start — Server Functions guide](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions) · [Middleware](https://tanstack.com/start/latest/docs/framework/react/guide/middleware)
- [SvelteKit — Remote functions](https://svelte.dev/docs/kit/remote-functions) · [remote functions in 2026 overview](https://blog.imseankim.com/sveltekit-remote-functions-query-form-command-prerender-guide-2026/)
- [ECMA-429 Minimum Common Web API (1st ed., Dec 2025)](https://ecma-international.org/publications-and-standards/standards/ecma-429/) · [readable draft](https://min-common-api.proposal.wintertc.org/)
- [Standard Schema adoption across Zod v4/Valibot/ArkType](https://jsonkit.in/blog/zod-v4-vs-valibot-vs-arktype)
- [Vercel Edge Functions deprecation](https://vercel.com/docs/functions/runtimes/edge/edge-functions.rsc) · [Fluid compute rationale](https://www.gersoncalienes.com/articles/fluid-compute-replacing-edge-functions)
- [Vite 8.0 (Rolldown) announcement](https://vite.dev/blog/announcing-vite8) · [InfoQ coverage](https://www.infoq.com/news/2026/05/vite-v8-rust/)
- [Better Auth on Cloudflare (Hono example)](https://hono.dev/examples/better-auth-on-cloudflare) · [better-auth-cloudflare](https://github.com/zpg6/better-auth-cloudflare)
