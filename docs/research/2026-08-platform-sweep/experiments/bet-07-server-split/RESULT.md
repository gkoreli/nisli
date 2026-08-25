# BET07 — fail-closed server/client bundle-split experiment

Cheapest-useful experiment for the riskiest assumption named at
`docs/research/2026-08-platform-sweep/reviews/bet-07-server-functions.review.md:150-164`:

> one Vite plugin can produce matching named client stubs and lazy server manifests
> — across dev, client build, and Worker/Node build — while proving that no real
> server module or server-only dependency reaches the client.

Throwaway fixture. Nothing under `packages/` was modified, no `packages/server` was
created, no dependency was added, and the repository's Vite version was not bumped.

## Command

```
node docs/research/2026-08-platform-sweep/experiments/bet-07-server-split/run.mjs
```

Runtime ~3.2 s, exit code 0, 35/35 checks conclusive. Repeated runs are byte-identical
modulo temp-directory names (verified by diffing two consecutive runs).

## Vite version actually exercised

The brief assumed Vite 8 / Rolldown (`briefs/bet-07-server-functions.md:72`). This
repository runs Vite 7.3.6:

| Evidence | Location |
| --- | --- |
| declared range `^7.1.5` | `packages/www/package.json:33` |
| resolved version `7.3.6` | `pnpm-lock.yaml:90-92` |
| runtime confirmation | `run.mjs:169-174` prints `vite 7.3.6` from `vite/package.json` |

The experiment resolves Vite through `createRequire(packages/www/package.json)`
(`run.mjs:40-42`), so it exercises exactly the installed copy. All three experimental
surfaces the review flagged are present and functional on 7.3.6:
`createBuilder`/`environments` (`run.mjs:148`), `isRunnableDevEnvironment` +
`RunnableDevEnvironment.runner.import()` (`run.mjs:312-316`), and per-environment
`hotUpdate` (`plugin.mjs:434`).

## Fixture shape

| Requirement from the review | Where |
| --- | --- |
| two direct server exports | `app/src/server/users.server.ts` (`getUser`, `updateUser`) |
| type-only export | `app/src/server/users.server.ts` (`export type User`, `export type { AdminAudit }`) |
| barrel re-export | `app/src/server/api.ts` (plain client module re-exporting stubs, incl. `updateUser as saveUser`) |
| aliased import | `app/src/client/entry.ts` imports through the `@app` alias and binds `getUser as fetchUser` |
| cross-module value re-export | `users.server.ts` re-exports `deleteUser` from `admin.server.ts` |
| shared module with unique sentinels | `app/src/shared/secrets.ts` (marked `server-only`), `app/src/shared/leaky.ts` (deliberately unmarked) |
| client entry using both paths | `app/src/client/entry.ts` |
| Worker entry consuming the virtual manifest | `app/src/worker/entry.ts` (`import manifest from 'virtual:nisli-server-fns'`) |
| dev call, client prod build, Worker prod build | `run.mjs` sections 1–3 |
| `generateBundle` assertions | `plugin.mjs:473-544` |
| runtime stub-id ↔ manifest-id assertion | `run.mjs` section 2 (imports both built bundles in Node) |
| HMR probes | `run.mjs` section 3 (`probe()` at `run.mjs:415`) |

Two plugin modes are compared: `strict: true` (the review's suggested revision — real
export-surface parsing, small grammar, unknown syntax is a build error) and
`strict: false` (the brief as written — specifier-suffix matching plus regex export
discovery).

## Per-check results

### Checks named in the acceptance criteria

| Check | Result | Evidence |
| --- | --- | --- |
| dev | **PASS** | `RunnableDevEnvironment` dispatch returned `{"ok":true,"data":{"id":"42","name":"Lovelace, Ada","fingerprint":"NISLI_:42"}}` — the real handler ran through `runner.import()` + the manifest's lazy `entry.load()` |
| client build | **PASS** | client environment built via `createBuilder`; 2 artifacts; 0 audit violations |
| worker build | **PASS** | worker environment (`consumer: 'server'`, `build.ssr: true`) built; `dispatch()` executed the real handler out of the built manifest |
| sentinel | **PASS** | 0 of 5 sentinels in the unminified client output; 0 in the `minify: 'esbuild'` rebuild |
| source-map | **PASS** | 1 client sourcemap; 0 `.server.*` entries in `sources`; 0 sentinels in `sourcesContent` |
| stub-id match | **PASS** | client `{deleteUser: 82f02a01b4a343e7, getUser: 0b86453c274ba6fc, listUsers: 58fe54502be9c041, updateUser: 816b8d7a489029cc}` is exactly the worker manifest key set; additionally a built stub called the live dev endpoint and got `{"id":"7","name":"Lovelace, Ada",…}` |
| HMR — handler body | **PASS** | 0 client HMR payloads sent; stub bytes unchanged; the server immediately returned the new value (`"Byron, Ada"`) |
| HMR — export add | **PASS** | client received `full-reload`; new stub id present in the regenerated stub; dev manifest served the new fn (`{"ok":true,"data":{"archived":"9"}}`) |
| HMR — export remove | **PASS** | client received `full-reload`; removed id gone from the stub; stale call → `404 {"ok":false,"error":{"code":"UNKNOWN_FN"}}` |

### Supporting correctness checks

| Check | Result | Evidence |
| --- | --- | --- |
| chunk-modules audit | PASS | no `.server.*` and no `server-only` module id in any client chunk |
| re-export identity | PASS | `deleteUser` reached through `users.server.ts` and through the barrel keeps `admin.server.ts`'s id — one function, one id |
| type-export erased | PASS | client stub surface is exactly `["deleteUser","getUser","listUsers","updateUser"]`; no stub for `User`/`AdminAudit` |
| worker dispatch | PASS | built worker manifest lazily imported the real module and ran it |
| dev stub substitution | PASS | dev client transform of `users.server.ts` is a 943-byte stub module; no sentinel, no `privilegedLookup` |

### Negative controls — the actual question

Every row below is an attempted leak. "Blocked" means the build exited non-zero.

| Control | Blocked? | What it proves |
| --- | --- | --- |
| client imports a `server-only`-marked module | **yes** (`resolveId`) | marker-based blocking works when the marker is present |
| `?raw` on a server module, strict plugin | **yes** (`resolveId` query guard) | query access is refused by name |
| `?raw` on a server module, brief-as-written plugin | **yes**, but only by the `generateBundle` audit | the brief's specifier-suffix substitution **misses `?raw` entirely** and ships the verbatim server source (`sentinels in js=["NISLI_SENTINEL_HANDLER_BODY_9d20ba61"]`, `real server source in output=true`). Only the chunk-modules assertion caught it |
| `new URL('./x.server.ts', import.meta.url)`, inlined | **yes**, but only by a *content* arm | Vite 7.3.6 inlines the whole file as `data:video/mp2t;base64,…` inside the chunk. It is **not** in `chunk.modules` and sentinel grep finds **nothing** (base64). Detected only by matching the module's base64-encoded source (`plugin.mjs:505-512`) |
| `new URL(...)` above `assetsInlineLimit: 0` | **yes**, only by the emitted-asset arm | the server module lands in dist as `assets/users.server-<hash>.ts`; `chunk.modules` never sees it (`plugin.mjs:519-531`) |
| statically analysable `import('./x.server.js')` | no (correct) | stub substitution holds for dynamic imports |
| runtime-computed `import(specifier)` | no (correct) | no hook sees the specifier; Vite leaves it unresolved, so nothing leaks — it fails at runtime instead |
| unmarked privileged shared module | **no — leak shipped** | `derivePrivilegedSignature` is in the client chunk; **every sentinel was tree-shaken away**, so a sentinel-grep gate would have reported this build clean |
| sourcemap of the same build | **no — leak shipped** | `NISLI_SENTINEL_ROTATION_c51d77ae`, removed from the JS by tree-shaking, is republished verbatim in `sourcesContent` |
| fail phase | — | failing in `generateBundle` leaves `dist` empty (0 files); failing in `writeBundle` leaves the leaked artifacts on disk (2 files) even though the build exits non-zero |
| `export *` in a server module | **yes** | grammar error: "`export *` is not an analysable export surface" |
| non-`serverFn` export in a server module | **yes** | grammar error naming `API_KEY` |
| default export in a server module | **yes** | grammar error |
| non-`serverFn` export, brief-as-written plugin | **no — build succeeded** | regex discovery turned `export const API_KEY` into a callable client stub, i.e. it converted a secret constant into a public HTTP endpoint instead of failing |

## Full output

```
vite 7.3.6
resolved node_modules/.pnpm/vite@7.3.6_@types+node@22.19.17_jiti@2.7.0_lightningcss@1.32.0/node_modules/vite/dist/node/index.js
node v22.23.2

=== 0. environment ===
  [PASS] vite-version — installed Vite is 7.3.6 (brief assumed Vite 8); createBuilder/environments present: true

=== 1. baseline production builds (unminified, sourcemap) ===
  [PASS] client-build — client build succeeded, audit violations: 0
  [PASS] worker-build — worker build succeeded
  [PASS] chunk-modules-audit — no .server.* / server-only module in any client chunk (2 client artifacts)
  [PASS] sourcemap — 1 client sourcemap(s); server sources in map: []; sentinels in sourcesContent: []
  [PASS] sentinel — unminified hits: []; minified hits: []

=== 2. stub id <-> manifest id (runtime) ===
  [PASS] stub-id-match — client stub ids {"deleteUser":"82f02a01b4a343e7","getUser":"0b86453c274ba6fc","listUsers":"58fe54502be9c041","updateUser":"816b8d7a489029cc"} vs worker manifest ["0b86453c274ba6fc","58fe54502be9c041","816b8d7a489029cc","82f02a01b4a343e7"]
  [PASS] reexport-identity — deleteUser re-exported through users.server.ts keeps admin.server.ts's id (82f02a01b4a343e7 === 82f02a01b4a343e7)
  [PASS] type-export-erased — client surface is ["deleteUser","getUser","listUsers","updateUser"]; no stub generated for type-only exports
  [PASS] worker-dispatch — worker manifest dispatch returned {"ok":true,"data":{"id":"42","name":"Lovelace, Ada","fingerprint":"NISLI_:42"}}

=== 3. dev mode + HMR ===
  [PASS] dev-stub-substitution — dev client transform of users.server.ts is a stub module (943 bytes), sentinel hits: []
[vite] connected.
  [PASS] dev — Environment API runner dispatch (RunnableDevEnvironment): {"status":200,"body":{"ok":true,"data":{"id":"42","name":"Lovelace, Ada","fingerprint":"NISLI_:42"}}}
  [PASS] stub-wire-roundtrip — built client stub called the dev endpoint: {"id":"7","name":"Lovelace, Ada","fingerprint":"NISLI_:7"}
[vite] program reload
  [PASS] hmr-body — handler-body edit: client payloads [], stub bytes changed: false, server now returns "Byron, Ada"
[vite] program reload
  [PASS] hmr-export-add — export add: client payloads ["full-reload"], new stub id present: true, dev manifest serves new fn: {"ok":true,"data":{"archived":"9"}}
[vite] program reload
  [PASS] hmr-export-remove — export remove: client payloads ["full-reload"], stub still exposes removed id: false, stale call -> 404 {"ok":false,"error":{"code":"UNKNOWN_FN"}}

=== 4. negative controls — does the audit fail closed? ===
  [PASS] control:server-only-import — client imports a `server-only`-marked shared module | blocked=true ([commonjs--resolver] [plugin nisli-server-split] `server-only` module reached the client graph through /private/var/folders/.../app/src/shared/secrets.ts; violations=["server-only-in-client"]) | sentinels in js=[] | sentinels in sourcemap=[] | real server source in output=false
  [PASS] control:raw-query-strict — client reads the server module via `?raw` (strict plugin) | blocked=true ([commonjs--resolver] [plugin nisli-server-split] server module accessed with an unsupported query: `../server/users.server.ts?raw` (importer: /private/var/folders/.../app/src/leaks/raw-query.ts). Query access (?raw/?url/?inline) bypasses stub substitution.; violations=["server-module-query-access"]) | sentinels in js=[] | sentinels in sourcemap=[] | real server source in output=false
  [PASS] control:raw-query-naive — client reads the server module via `?raw` (brief-as-written plugin) | blocked=true ([nisli-server-split] [plugin nisli-server-split] nisli-server-split client audit failed:   server-module-in-client-chunk: entry.js <- src/server/users.server.ts?raw; violations=["server-module-in-client-chunk"]) | sentinels in js=["NISLI_SENTINEL_HANDLER_BODY_9d20ba61"] | sentinels in sourcemap=["NISLI_SENTINEL_HANDLER_BODY_9d20ba61"] | real server source in output=true
  [PASS] control:raw-query-naive-detected-by — ?raw under the naive plugin is caught by the generateBundle chunk.modules audit, not by stub substitution: [{"kind":"server-module-in-client-chunk","detail":"entry.js <- src/server/users.server.ts?raw"}]
  [PASS] control:url-asset-inlined — new URL(server module, import.meta.url) below assetsInlineLimit — Vite inlines the file as a base64 data URI | blocked=true ([nisli-server-split] [plugin nisli-server-split] nisli-server-split client audit failed:   server-source-inlined-as-data-uri: entry.js <- base64(src/server/users.server.ts); violations=["server-source-inlined-as-data-uri"]) | sentinels in js=[] | sentinels in sourcemap=[] | real server source in output=true
  [PASS] control:url-asset-invisible-to-chunk-modules — the whole server module ships base64-encoded inside the chunk: chunk.modules sees nothing and sentinel grep sees nothing (js sentinel hits []); only the content arm of the audit catches it — ["server-source-inlined-as-data-uri"]
  [PASS] control:url-asset-emitted — same leak above assetsInlineLimit — the server module is emitted as a dist file | blocked=true ([nisli-server-split] [plugin nisli-server-split] nisli-server-split client audit failed:   server-module-emitted-as-asset: assets/users.server-nammFSms.ts <- /private/var/folders/.../app/src/server/users.server.ts; violations=["server-module-emitted-as-asset"]) | sentinels in js=["NISLI_SENTINEL_HANDLER_BODY_9d20ba61"] | sentinels in sourcemap=[] | real server source in output=true
  [PASS] control:url-asset-on-disk — emitted server module lands in dist as ["users.server-nammFSms.ts"]; caught only by the emitted-asset arm
  [PASS] control:dynamic-static — statically analysable dynamic import of a server module (stub substitution should hold) | blocked=false (no build error; violations=[]) | sentinels in js=[] | sentinels in sourcemap=[] | real server source in output=false
  [PASS] control:dynamic-computed — runtime-computed dynamic import — no hook ever sees the specifier | blocked=false (no build error; violations=[]) | sentinels in js=[] | sentinels in sourcemap=[] | real server source in output=false
  [PASS] control:dynamic-computed-outcome — computed dynamic import ships no server code (the import is left unresolved and fails at runtime instead)
  [PASS] control:unmarked-privileged — privileged shared module the developer forgot to mark `server-only` | blocked=false (no build error; violations=[]) | sentinels in js=[] | sentinels in sourcemap=["NISLI_SENTINEL_ROTATION_c51d77ae"] | real server source in output=false
  [PASS] control:sentinel-is-not-fail-closed — privileged algorithm shipped to the client while every sentinel was tree-shaken out of the JS (js sentinel hits: []); sentinel grep would have reported this build clean
  [PASS] control:sourcemap-resurrects-tree-shaken-secret — the same secret that tree-shaking removed from the JS is republished verbatim in sourcesContent (["NISLI_SENTINEL_ROTATION_c51d77ae"]) — shipping client sourcemaps re-opens every shared-module leak
  [PASS] control:fail-closed-before-write — failing in generateBundle leaves dist empty (0 files); failing in writeBundle leaves the leaked artifacts on disk (2 files) even though the build exits non-zero
  [PASS] grammar:star.server.ts — server module uses `export *` -> [nisli-server-split] [plugin nisli-server-split] src/bad/star.server.ts: `export *` is not an analysable export surface | violations=[]
  [PASS] grammar:plain.server.ts — server module exports a non-serverFn secret constant -> [nisli-server-split] [plugin nisli-server-split] src/bad/plain.server.ts: exported `API_KEY` is not a serverFn() call — a server module may export only server functions and types | violations=[]
  [PASS] grammar:default.server.ts — server module uses a default export -> [nisli-server-split] [plugin nisli-server-split] src/bad/default.server.ts: default exports are not allowed in a server module | violations=[]
  [PASS] grammar:naive-stubs-a-secret — brief-as-written regex discovery turned `export const API_KEY` into a callable client stub instead of failing: build error=false, secret literal in bundle=false

=== summary ===
vite-version                                     PASS
client-build                                     PASS
worker-build                                     PASS
chunk-modules-audit                              PASS
sourcemap                                        PASS
sentinel                                         PASS
stub-id-match                                    PASS
reexport-identity                                PASS
type-export-erased                               PASS
worker-dispatch                                  PASS
dev-stub-substitution                            PASS
dev                                              PASS
stub-wire-roundtrip                              PASS
hmr-body                                         PASS
hmr-export-add                                   PASS
hmr-export-remove                                PASS
control:server-only-import                       PASS
control:raw-query-strict                         PASS
control:raw-query-naive                          PASS
control:raw-query-naive-detected-by              PASS
control:url-asset-inlined                        PASS
control:url-asset-invisible-to-chunk-modules     PASS
control:url-asset-emitted                        PASS
control:url-asset-on-disk                        PASS
control:dynamic-static                           PASS
control:dynamic-computed                         PASS
control:dynamic-computed-outcome                 PASS
control:unmarked-privileged                      PASS
control:sentinel-is-not-fail-closed              PASS
control:sourcemap-resurrects-tree-shaken-secret  PASS
control:fail-closed-before-write                 PASS
grammar:star.server.ts                           PASS
grammar:plain.server.ts                          PASS
grammar:default.server.ts                        PASS
grammar:naive-stubs-a-secret                     PASS

35/35 checks passed
```

(Two `/private/var/folders/...` temp paths were elided to `/private/var/folders/.../`
for readability; nothing else is edited.)

## Findings

### 1. The mechanism works on Vite 7.3.6, without Vite 8

`createBuilder` + per-environment `consumer: 'client' | 'server'` produced matching
client stubs and a lazy server manifest in one plugin instance. The `RunnableDevEnvironment`
module runner dispatched the real handler in dev. The experimental marking on these
surfaces did not manifest as a functional gap for this use case. The bet does not
need a Vite 8 upgrade.

### 2. Export-surface parsing is mandatory, and it is cheap

The brief rejected AST work; the review said parsing is required. The review is right,
and the cost is near zero: Vite re-exports `transformWithEsbuild` and `parseAst`, so
types can be erased and the module parsed with **no new dependency**
(`plugin.mjs:142-143`). The grammar that survives contact with the fixture is four
productions: `export const NAME = serverFn(…)`, `export { local as exported }`,
`export { name as exported } from './other.server.js'`, and any `export type`. Everything
else is a build error (`plugin.mjs:163-229`).

The naive regex alternative did not merely miss exports — it **turned
`export const API_KEY = '…'` into a callable client stub**, i.e. it published a secret
constant as an HTTP endpoint and the build stayed green. That is the single worst
observed outcome in the experiment and it is caused directly by the brief's
"no AST work" constraint.

### 3. Function identity must be normalised through `realpath`

The first working version of the plugin produced client stub ids that disagreed with
the manifest ids on every function. Cause: Vite's resolver reports real paths
(`preserveSymlinks: false`) while a filesystem scan reports the caller's path, and on
macOS `/var/folders/...` vs `/private/var/folders/...` hash differently. The failure
was total, silent, and every runtime call returned `UNKNOWN_FN`. Fixed at
`plugin.mjs:42-61`. Any production implementation needs the same normalisation plus a
test that actually compares built client ids to built manifest ids — comparing what the
plugin *thinks* it emitted proves nothing.

Identity also has to follow re-exports to the *defining* module, otherwise the same
function reached through a barrel and through its own module gets two different ids
and one of them is not in the manifest (`plugin.mjs:195-218`).

### 4. `chunk.modules` is necessary and *not* sufficient

The review's proposed assertion — "no real `*.server.*` or `server-only` module in
`chunk.modules`" — caught the `?raw` leak that stub substitution missed. But two
channels ship the verbatim server module without ever appearing in `chunk.modules`:

- **base64 data URI.** `new URL('./users.server.ts', import.meta.url)` under the default
  `assetsInlineLimit` makes Vite inline the entire file as
  `data:video/mp2t;base64,aW1wb3J0IHsgc2VydmVyRm4g…` inside the client chunk. No module
  id, no emitted asset, and sentinel grep finds nothing because the payload is encoded.
- **emitted asset.** The same expression above the inline limit writes
  `dist/client/assets/users.server-<hash>.ts` — the complete source, as a served file.

Neither is reachable from `resolveId`: Vite's `vite:asset-import-meta-url` transform
resolves the target itself. The only detector that worked was a content arm — matching
each server module's exact source text and its base64 encoding against every chunk and
asset (`plugin.mjs:505-532`). A production audit needs all three arms.

### 5. Sentinel grep is not a detector, in two independent ways

- **Tree-shaking hides the sentinel, not the code.** A client that imports only
  `derivePrivilegedSignature` from an unmarked shared module ships the privileged
  algorithm while `ROTATION_SECRET` is eliminated. Sentinel grep reports the build clean.
- **Encoding hides the sentinel.** The base64 inline case above contains the full
  handler source and zero sentinel matches.

The review's "keep sentinels only as secondary evidence" is understated: as a *gate*,
sentinel grep produces false negatives on both the most likely leak (an unmarked shared
module) and the most severe one (verbatim source inlined).

### 6. Source maps are an unguarded leak channel

`sourcesContent` republished a secret that tree-shaking had already removed from the
JavaScript. This is not specific to server functions — it applies to every shared
module in the client graph — but a "bundle secrecy" story that ships client sourcemaps
has a hole regardless of how good the module split is.

### 7. Marker-based blocking works but is opt-in, so it cannot be the primary gate

`import 'server-only'` blocked at `resolveId` with a clear error. The same module
without the marker leaked silently. Convention-dependent enforcement reproduces exactly
the weakness ADR 0026 already admits for render separation (`docs/adr/0026-typed-application-router.md:925-928`).

### 8. Fail phase matters operationally

Throwing in `writeBundle` fails the build but leaves the leaked artifacts on disk
(observed: 2 files, containing the verbatim handler). Throwing in `generateBundle`
leaves `dist` empty. Any CI that publishes `dist` before checking the exit code, or any
developer inspecting a failed build directory, is exposed by the first shape. The audit
must fail in `generateBundle`.

### 9. HMR behaves, with one product consequence

- Handler-body edit: **zero** client HMR traffic and the server picks up the new body
  immediately. The brief's "client stubs are content-stable" claim holds — but only
  because the plugin explicitly compares the export surface in `hotUpdate` and returns
  `[]` (`plugin.mjs:441-453`). Without that, every server edit reloads the page.
- Export add/remove: the client gets a **`full-reload`**, not an HMR patch. Stub modules
  export const bindings and cannot self-accept, so any surface change is a dead end for
  HMR propagation. That is acceptable but should be documented, not promised away.
- The virtual manifest has **no import edge** to the server modules it lists, so it goes
  stale on add/remove unless the plugin explicitly invalidates it in the server
  environment's `hotUpdate` (`plugin.mjs:455-463`). Adding a function without this fix
  yields `UNKNOWN_FN` in dev until restart.

## Verdict

**Can bundle secrecy be enforced fail-closed on Vite 7.3.6?**
Yes — but not by the design in the brief, and not by any single check. Fail-closed
enforcement was achieved and demonstrated against nine distinct leak attempts, and it
required all five of: (a) real export-surface parsing over a closed grammar with unknown
syntax as a build error; (b) query-bearing access to a server module as a build error;
(c) a `generateBundle` `chunk.modules` assertion; (d) a `generateBundle` *content*
assertion covering inlined data URIs and emitted assets; (e) failure raised in
`generateBundle`, before write. Drop any one and a demonstrated leak ships.

**Which leaks slip through?**
Under the design as briefed (suffix matching + regex export discovery + sentinel grep),
four leaks ship silently: `?raw` access, `new URL(...)` inlining, `new URL(...)` asset
emission, and a non-`serverFn` export republished as a callable stub. Under the hardened
design, two leaks remain outside the plugin's reach and must be closed by policy rather
than by the split:

1. **Unmarked privileged shared modules.** No bundler signal exists. Requires either a
   mandatory marker with an import-graph guard (the `purity.test.ts` BFS style already
   in `packages/router`) or an explicit allowlist of client-reachable shared modules.
2. **Client sourcemaps.** Must be disabled, or restricted to a non-published artifact,
   for any build that claims secrecy.

**Does the `*.server.ts` module-boundary authoring shape survive?**
Yes. The module boundary itself is the strongest part of the design: it made
substitution total, made ids derivable, made the manifest lazy, made barrels and aliases
work unchanged, and made type-only exports free. What does **not** survive is the
brief's companion claim that the boundary can be implemented "without AST surgery" and
verified by sentinel grep. Both must go.

### Recommendation: **PROCEED — with a changed verification shape, not a changed authoring shape**

Keep `*.server.ts` as the split unit. Amend the brief before implementation:

1. Replace "module-boundary replacement, no AST work" with "module-boundary replacement
   over a closed export grammar, enforced by `parseAst` on esbuild-erased source; unknown
   export syntax fails the build." Cost: ~120 lines, no new dependency.
2. Replace "sentinel-grep the client chunks" with the three-arm `generateBundle` audit
   (module ids, inlined content, emitted assets), failing before write. Keep sentinels
   as evidence only.
3. Add two non-negotiable policies: `build.sourcemap: false` for client builds that carry
   secrets, and a mandatory `server-only` marker with an import-graph guard for shared
   modules — modelled on `packages/router/src/purity.test.ts`.
4. Normalise every path through `realpath` before hashing function ids, and gate CI on a
   test that compares ids extracted from the *built* client bundle to ids extracted from
   the *built* server manifest.
5. Budget the Vite plugin at the review's higher figure, not the brief's. The mechanism
   works, but the plugin that survived this fixture is materially larger than
   `resolveId`/`load`/`transform`: it needs the parser, the grammar, three audit arms,
   surface-diffing `hotUpdate` for two environments, and manifest invalidation. Nothing
   here changes the review's other four critical/high findings (`query()` semantics, SSG
   policy, security policy, portability claims), which remain unaddressed by this
   experiment and still gate the bet.
