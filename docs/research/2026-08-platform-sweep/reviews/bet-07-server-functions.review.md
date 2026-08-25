## 1. Verdict — UNSOUND

The product direction is plausible, but this brief is not safe to implement as written. It mistakes the router’s narrowly scoped purity check for proof that a secret-bearing dual bundle will be correct, claims zero-change query and SSG integration where the actual lifecycle semantics disagree, and calls a custom portability abstraction “ECMA-429-only.” The six-week estimate describes a happy-path prototype, not the security-sensitive, cross-runtime, publishable MVP in the verification plan.

## 2. Findings, ordered by severity

### Critical — Bundle secrecy has no fail-closed design

**Claim:** The router catalog/purity guard is the “perfect precedent,” and module-boundary replacement plus sentinel-grep adequately prevents server leakage.

**Status: CONFIRMED in the narrow sense; REFUTED as a precedent for secrecy; the proposed Vite split is UNVERIFIABLE.**

**Evidence:**

- The catalog really is a separate export, and it only re-exports route, matcher, and codec modules: [catalog.ts:1–16](/Users/goga/Documents/goga/nisli/packages/router/src/catalog.ts:1), [router/package.json:20–24](/Users/goga/Documents/goga/nisli/packages/router/package.json:20).
- `route.ts` imports core only as a type: [route.ts:1](/Users/goga/Documents/goga/nisli/packages/router/src/route.ts:1).
- But the source guard is a regex over four hard-coded internal modules and two forbidden import families: [purity.test.ts:18–57](/Users/goga/Documents/goga/nisli/packages/router/src/purity.test.ts:18). Its built-graph BFS only proves absence of the literal `@nisli/core` specifier: [purity.test.ts:73–100](/Users/goga/Documents/goga/nisli/packages/router/src/purity.test.ts:73).
- ADR 0026 explicitly admits that consumer render separation is convention, not enforcement: “the router guard covers only its own modules”: [ADR 0026:904–908](/Users/goga/Documents/goga/nisli/docs/adr/0026-typed-application-router.md:904).
- Named client stubs require discovering the ESM export surface. The brief simultaneously promises “for each export” and rejects AST work. Re-exports, aliases, `export *`, type exports, and default exports make regex discovery unsafe.
- Sentinel search is only a smoke test. Minification, constant folding, encoding, dead-code elimination, or a different secret can remove the sentinel while server code remains.
- The repository currently runs Vite 7.3.6, not the proposed Vite 8 baseline: [pnpm-lock.yaml:90–92](/Users/goga/Documents/goga/nisli/pnpm-lock.yaml:90). Its multi-environment builder and runnable module-runner surfaces are explicitly marked experimental: [Vite types:2209–2231](/Users/goga/Documents/goga/nisli/node_modules/.pnpm/vite@7.3.6_@types+node@22.19.17_jiti@2.7.0_lightningcss@1.32.0/node_modules/vite/dist/node/index.d.ts:2209), [Vite types:3540–3560](/Users/goga/Documents/goga/nisli/node_modules/.pnpm/vite@7.3.6_@types+node@22.19.17_jiti@2.7.0_lightningcss@1.32.0/node_modules/vite/dist/node/index.d.ts:3540).

**Consequence:** A false negative exposes credentials or privileged code. This cannot be protected by a test that searches for one string.

**Suggested revision:** Make a split prototype the investment gate. Admit that export-surface parsing is required, define a deliberately small allowed grammar, and fail builds on unknown export syntax. In `generateBundle`, assert that no real `*.server.*` or `server-only` module appears in `chunk.modules`; keep per-module sentinels only as secondary evidence. Test direct imports, barrels, aliases, re-exports, type-only imports, dynamic imports, source maps, dev, and both production bundles.

---

### Critical — `query()` is callable-compatible but semantically incompatible

**Claim:** A POST stub “slots in with zero API change,” including AbortSignal, typed errors, redirects, and loader-like prefetch.

**Status: CONFIRMED only for the function signature; REFUTED for the stronger claim.**

**Evidence:**

- The structural part is real: `QueryFetcher<T>` receives `AbortSignal`: [query.ts:131–133](/Users/goga/Documents/goga/nisli/packages/core/src/query.ts:131), and the run passes its controller signal: [query.ts:374–383](/Users/goga/Documents/goga/nisli/packages/core/src/query.ts:374).
- Query failures do not reject to the caller. They are caught, retried indiscriminately, and committed to an `Error | null` signal: [query.ts:135–143](/Users/goga/Documents/goga/nisli/packages/core/src/query.ts:135), [query.ts:389–395](/Users/goga/Documents/goga/nisli/packages/core/src/query.ts:389). A `FnError` subclass would retain runtime identity because existing `Error` objects are preserved: [query.ts:213–219](/Users/goga/Documents/goga/nisli/packages/core/src/query.ts:213). Its code/data type still does not flow through `QueryResult`.
- The brief’s exact closure has a cache-corruption race. The key is read before starting the run: [query.ts:466–495](/Users/goga/Documents/goga/nisli/packages/core/src/query.ts:466), but the fetcher reads `userId.value` in a later microtask: [query.ts:380–383](/Users/goga/Documents/goga/nisli/packages/core/src/query.ts:380). The tests explicitly acknowledge that delay and avoid signal-gating for it: [query.test.ts:136–145](/Users/goga/Documents/goga/nisli/packages/core/src/query.test.ts:136). A synchronous ID change can therefore cache user B’s response under user A’s key.
- Moving away from a key does not abort the old record; its response deliberately commits to that old cache record: [query.test.ts:156–167](/Users/goga/Documents/goga/nisli/packages/core/src/query.test.ts:156). Component disposal also deliberately does not abort: [query.ts:499–507](/Users/goga/Documents/goga/nisli/packages/core/src/query.ts:499).
- `prefetch()` returns `Promise<void>` and absorbs terminal errors into the record: [query.ts:278–292](/Users/goga/Documents/goga/nisli/packages/core/src/query.ts:278). It is not a normal loader that returns data or throws.
- Typed thrown errors cannot be inferred from the proposed `serverFn({input, handler})` signature. TypeScript has no thrown-error type channel; an explicit error map is missing.

**Consequence:** The advertised example can poison a shared cache, redirects have no defined query state, domain errors lose their useful static type, and unmounting does not cancel server work.

**Suggested revision:** Either narrow the promise to “usable via a closure, with current query semantics,” or make an additive core change: type the fetcher as `(signal, capturedKey)`, so input is derived from the exact run key. Give generated functions a collision-resistant `queryKey(input)` including function identity. Add an explicit `errors` map to `serverFn`; decide which errors are retryable. Redirects should not be hidden inside an ordinary query fetcher.

---

### High — “SSG unchanged” is contradicted by the renderer

**Claim:** Existing `settle()` is already the SSG barrier, and static output can simply sit behind adapters.

**Status: REFUTED.**

**Evidence:**

- `buildStaticSite` renders a page and immediately hands the result to `renderToHtml`: [build.ts:163–179](/Users/goga/Documents/goga/nisli/packages/ssg/src/build.ts:163).
- `renderToHtml` mounts, awaits only `tick()`, and snapshots: [core-render.ts:55–75](/Users/goga/Documents/goga/nisli/packages/ssg/src/core-render.ts:55), [core-render.ts:79–89](/Users/goga/Documents/goga/nisli/packages/ssg/src/core-render.ts:79). It never calls `settle()`.
- The SSG tests prove only microtask projection settlement, not network/query quiescence: [build.test.ts:108–141](/Users/goga/Documents/goga/nisli/packages/ssg/src/build.test.ts:108).
- The site’s SSG is executed directly under Vitest: [www/package.json:8–12](/Users/goga/Documents/goga/nisli/packages/www/package.json:8), with no server-function Vite plugin in its configuration: [www/vitest.config.ts:1–8](/Users/goga/Documents/goga/nisli/packages/www/vitest.config.ts:1). A page importing `*.server.ts` during SSG will therefore see the real module unless a separate SSG policy is added.
- Static output maps arbitrary route paths to directories and has no reserved endpoint prefix: [output.ts:55–73](/Users/goga/Documents/goga/nisli/packages/ssg/src/output.ts:55). A page or public asset under `/_nisli/fn` can become unreachable once the adapter takes precedence.
- SSG cleans the output directory by default: [build.ts:147–155](/Users/goga/Documents/goga/nisli/packages/ssg/src/build.ts:147). A worker/server artifact emitted into the same directory beforehand will be deleted.

**Consequence:** Function-backed query data will generally miss the snapshot. Direct local handler execution lacks `request`, `env`, and `waitUntil`; stub execution lacks a live endpoint. Output and endpoint namespaces can collide.

**Suggested revision:** Specify one SSG policy:

1. Fail loudly when a server function is invoked during static rendering; or
2. Provide an explicit build executor/env and change the renderer to await `settle()` before serialization.

Reserve and validate the endpoint prefix, keep worker artifacts outside the static output directory, and test page/public/mount collisions.

---

### High — The security ingredients are promising, but the policy is not executable

**Claim:** POST, a custom header, same-origin checks, and redacted errors are secure defaults.

**Status: UNVERIFIABLE; the redaction claim is incomplete.**

**Evidence:**

- No request handler or wire implementation exists at this baseline; the brief itself records that absence: [brief:30](</private/tmp/claude-501/-Users-goga-Documents-goga-nisli/555a71eb-93f0-40a2-a436-90da1f5456d0/scratchpad/bets/bet-07-server-functions.md:30).
- POST alone does not prevent CSRF. A required non-simple header plus a strict `Origin` check can, but the allowlist path does not define preflight, credential, or `Vary: Origin` behavior: [brief:169–170](</private/tmp/claude-501/-Users-goga-Documents-goga-nisli/555a71eb-93f0-40a2-a436-90da1f5456d0/scratchpad/bets/bet-07-server-functions.md:169).
- “Standard Schema issues are safe to render” is unjustified. The design accepts arbitrary schema implementations and custom validation messages. Those can echo passwords, tokens, or raw input.
- `fnError(code, data)` exposes arbitrary, unvalidated payloads. “Only FnError crosses the wire” does not make its data safe.
- HTTP status selection is undefined: `fnError` has only `code` and `data`, yet the wire promises arbitrary 4xx/5xx status.
- Plain JSON does not naturally “reject” unsupported values: `Date` converts to a string, `Map` to `{}`, and `undefined` disappears unless an explicit deep validator is added.

**Consequence:** A superficially redacted protocol can still leak secrets through validation messages or developer-selected error data. CORS/CSRF behavior will differ between Node, Workers, and reverse-proxy deployments.

**Suggested revision:** Specify exact gates: POST; matching path/header ID; `Content-Type: application/json`; body-size cap; strict configured origin; reject `null`/missing Origin for cookie-authenticated mutations; `Sec-Fetch-Site` only as defense-in-depth; explicit credentialed preflight behavior; `Cache-Control: no-store`; and `X-Content-Type-Options: nosniff`. Whitelist normalized validation issue fields, validate/cap `FnError.data`, add an explicit code→status/error-schema map, and validate output as real JSON before serializing.

---

### High — The context is not “ECMA-429-only”

**Claim:** The proposed context is ECMA-429-only and therefore one handler runs unchanged on Node and Workers.

**Status: REFUTED.**

**Evidence:**

- `Request` is a common Web API, but `env`, `waitUntil`, and `setHeader` are custom capabilities: [brief:87–92](</private/tmp/claude-501/-Users-goga-Documents-goga-nisli/555a71eb-93f0-40a2-a436-90da1f5456d0/scratchpad/bets/bet-07-server-functions.md:87).
- The brief later concedes that `waitUntil` is not ECMA-429: [brief:156–158](</private/tmp/claude-501/-Users-goga-Documents-goga-nisli/555a71eb-93f0-40a2-a436-90da1f5456d0/scratchpad/bets/bet-07-server-functions.md:156).
- `env` is deliberately allowed to contain Workers bindings or Node wrappers. The example’s `ctx.env.DB.get()` is only portable if the consumer supplies behaviorally identical DB adapters; the standard supplies none of that.

**Consequence:** The interface can be portable, but handler portability is a consumer obligation. Calling it standards-only overstates the guarantee and hides the hardest parity work: bindings, cookies, background-task lifetime, and request-origin construction.

**Suggested revision:** Rename this a “Web-API-based portability layer.” Publish a precise portable core plus adapter-provided capabilities, document that `Env` must be app-defined and cross-runtime compatible, and require parity tests for the same handler and envelope on Node and workerd.

---

### High — Optional router redirect integration is unsafe

**Claim:** A client stub can detect `@nisli/router`, call `inject(Router).navigate()`, and otherwise assign `location.href`.

**Status: REFUTED.**

**Evidence:**

- `inject()` does not test whether a service already exists; it auto-constructs missing class tokens: [injector.ts:50–65](/Users/goga/Documents/goga/nisli/packages/core/src/injector.ts:50), [injector.ts:81–102](/Users/goga/Documents/goga/nisli/packages/core/src/injector.ts:81).
- A newly created Router has no connected outlet. `navigate()` mutates history before transition: [router.ts:231–249](/Users/goga/Documents/goga/nisli/packages/router/src/router.ts:231), then throws when no outlet is connected: [router.ts:276–284](/Users/goga/Documents/goga/nisli/packages/router/src/router.ts:276).
- An optional dynamic import can still fail bundler resolution when the peer is absent; package presence is not the same as an active router.

**Consequence:** A redirect before app mount—or in a non-router app that happens to install the package—can mutate history and then fail.

**Suggested revision:** Remove implicit router discovery. Give the client runtime an explicit `onRedirect` registration hook. Default to a validated HTTP(S)/relative `location.assign`; the application router can register `router.replace` only after its outlet connects.

---

### Medium — “Small adapters” and six engineer-weeks are not credible

**Claim:** Adapters are small and the full verified MVP is about six engineer-weeks.

**Status: UNVERIFIABLE as an estimate; strongly unsupported by source.**

**Evidence:**

- Node serving must reproduce clean-route output and root `404.html` conventions: [output.ts:55–80](/Users/goga/Documents/goga/nisli/packages/ssg/src/output.ts:55), [build.ts:226–229](/Users/goga/Documents/goga/nisli/packages/ssg/src/build.ts:226). It also needs safe path mapping, MIME types, HEAD, abort propagation, multiple `Set-Cookie`, proxy/origin policy, and shutdown semantics.
- The SSG public entry eagerly imports its happy-dom environment: [ssg/index.ts:5](/Users/goga/Documents/goga/nisli/packages/ssg/src/index.ts:5), which imports `happy-dom`: [environment.ts:1](/Users/goga/Documents/goga/nisli/packages/ssg/src/environment.ts:1). Runtime adapters cannot casually reuse the SSG package root.
- The publishing workflow knows exactly four packages: [auto-tag.yml:23–40](/Users/goga/Documents/goga/nisli/.github/workflows/auto-tag.yml:23). A fifth public package needs release matrix, tag, Trusted Publisher, documentation, tarball, and npm E2E work.
- The promised workerd/D1, Better Auth/SQLite, Vite multi-build, CSRF, redaction, SSG, and leakage suites are all new infrastructure.

**Consequence:** Six weeks creates pressure to ship the compiler boundary or security matrix half-proven.

**Suggested revision:** Budget a 1–2 week feasibility gate, then approximately 9–13 additional engineer-weeks for a production MVP. Six weeks is defensible only for a Node-only prototype with one Vite version, no auth E2E, and no portability claim.

## 3. Riskiest assumption and cheapest experiment

The riskiest assumption is that one Vite plugin can produce matching named client stubs and lazy server manifests—across dev, client build, and Worker/Node build—while proving that no real server module or server-only dependency reaches the client.

The cheapest useful experiment is a one- or two-day throwaway fixture:

- Two direct server exports, a type export, a barrel re-export, an aliased import, and a shared module containing unique sentinels.
- A client entry importing functions both directly and through the barrel.
- A Worker entry consuming the virtual manifest.
- One dev call, one client production build, and one Worker production build on the repository’s current Vite version.
- `generateBundle` assertions that client `chunk.modules` contains no real `.server` or `server-only` module, plus sentinel/source-map checks.
- Runtime assertion that stub IDs exactly match manifest IDs.
- HMR probes for handler-body edits versus export additions/removals.

If this cannot fail closed, stop the bet or change the authoring shape.

## 4. Source-revealed omissions

- Query keys are flat primitives and reject input objects: [query.ts:79–109](/Users/goga/Documents/goga/nisli/packages/core/src/query.ts:79). Arbitrary schema inputs therefore do not “pair naturally” with keys; generated functions need a canonical key helper.
- Query records are never garbage-collected: [query.ts:25–35](/Users/goga/Documents/goga/nisli/packages/core/src/query.ts:25). High-cardinality function inputs can grow the browser cache for the application lifetime.
- The hard-coded root endpoint ignores the router’s supported application base. Router matching explicitly supports bases: [matcher.ts:200–210](/Users/goga/Documents/goga/nisli/packages/router/src/matcher.ts:200). The endpoint needs a configurable/public base.
- The in-repo “Worker proof” is primarily an import-graph guard and a happy-dom render-separation test. ADR 0026 attributes real Worker evidence to an external consumer: [ADR 0026:867–873](/Users/goga/Documents/goga/nisli/docs/adr/0026-typed-application-router.md:867). That evidence is not reproducible from this repository alone.
- Existing code does help: `QueryFetcher` already supplies AbortSignal, `toError` preserves Error subclasses, the catalog matcher is genuinely core-free, and SSG output conventions are explicit. Those reduce plumbing; they do not solve the compiler/security boundary.

## 5. Execution record

Model: `gpt-5.6-sol`  
Reasoning effort: `xhigh`  
Web access: not used  
Workspace changes: none

Files inspected included the brief; repository/skill instructions; root workspace, TypeScript, lockfile, README, and publish workflow; router `catalog.ts`, `route.ts`, `matcher.ts`, `application.ts`, `router.ts`, `vite.ts`, purity/render/Vite tests, README, changelog, package metadata, and ADR 0026; core `query.ts`, query tests, `settle.ts`, settle tests, injector, index, package metadata, and Vite HMR plugin/tests; SSG build/output/render/environment sources and tests; www build/router/render/Vite/Vitest/Wrangler configuration; and the installed Vite 7 type surface.