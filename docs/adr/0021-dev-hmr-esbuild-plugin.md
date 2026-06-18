# 0021. Dev-Only HMR for Nisli — esbuild Plugin with Component Re-Mount

**Date**: 2026-06-18
**Status**: Proposed — design-first; implementation pending sign-off
**Triggered by**: backlog-mcp viewer dev loop — after the ADR 0108 (backlog-mcp) content-hash work, an esbuild `--watch` rebuild updates `dist/` but the browser does nothing; the operator wants a Vite-grade reload/HMR experience without adopting Vite
**Relates to**: [0017. Framework Package Extraction](./0017-framework-package-extraction.md), [0019. Minimal Runtime and Native Platform Alignment](./0019-minimal-runtime-and-native-platform-alignment.md), [0008.1. Mount-Time Dependency Leak](./0008.1-mount-time-dependency-leak.md)

## Context

The viewer (`@backlog-mcp/viewer`) bundles with esbuild and is served by a Hono
HTTP server. In dev, `node build.mjs --watch` rebuilds in milliseconds, but
there is **no browser-update channel** — a rebuild just rewrites `dist/`. The
operator wants the framework-grade DX of Vite/webpack (fast reload, ideally
state-preserving HMR) but rejected, with reasons, every approach that
compromises their constraints. This ADR records those constraints, the prior
art we surveyed, and a design that fits.

### Hard constraints (operator, this thread)

These are non-negotiable and shaped the decision:

1. **HMR is a dev-server/bundler concern, not a framework feature.** Do not add
   an HMR feature to `@nisli/core`'s runtime.
2. **No component-code change.** Author code (`component('x', setup)`) is
   untouched.
3. **No `@nisli/core` runtime change.** The framework package stays as-is.
4. **Zero production cost.** No added prod bundle bytes; the shipped bundle must
   be byte-identical to today.
5. **Respect prod in dev.** Dev should serve the same bundled artifact as prod
   (rejects Vite's unbundled-ESM dev model — see *Prior Art*).

## The core tension (why this is non-trivial)

Live reload and HMR are different problems with different costs:

- **Live reload** = on rebuild, `location.reload()`. Loses all client state
  (scroll, route, open panels, form inputs). Purely a dev-server concern;
  trivial.
- **HMR** = swap only the changed module/component in the running app, keeping
  state. The *transport* (watch → rebuild → push → protocol) is a
  dev-server/bundler concern, but the **stateful apply** ("swap this component,
  preserve state") is inherently **framework-aware**. This is why every
  framework ships a dedicated dev-only piece — React Fast Refresh, Vue HMR,
  `svelte-hmr`, Lit HMR — rather than getting HMR "for free" from the bundler.

**Resolution of constraint #1 vs the framework-aware reality:** the
framework-aware code can live in a **dev-only esbuild plugin** (a Nisli
"preset"), exactly as React Fast Refresh lives in a Babel transform + dev
runtime, *not* in React itself. So we honor "HMR is a bundler concern" — the
plugin is build tooling beside the framework, never inside it.

## Why this needs no `@nisli/core` change (grounded in the code)

Reading `packages/core/src/component.ts`, the seam already exists on instances:

- **Props survive re-mount for free.** `_propsProxy` is created in the
  **constructor** (`this._propsProxy = createPropsProxy<P>()`, component.ts), not
  in `setup`. The backing prop signals live on the element independent of
  `setup`, so re-running `setup` on the same element preserves props.
- **Lifecycle is re-drivable.** `disconnectedCallback()` sets `_mounted = false`
  and disposes the template + host disposers; `connectedCallback()` is guarded
  only by `_mounted`. So `disconnect() → connect()` on a live element is a clean
  dispose + fresh `setup()` + re-mount on the *same instance*.
- **Only `setup` is captured by closure.** The `FrameworkComponent` class is
  closure-private and not exported, and `customElements.define(tag, …)` is
  guarded by `customElements.get(tag)` — so a module re-eval cannot re-register
  the tag. We therefore must **not** rely on swapping the class; instead we make
  `setup` indirect, which is doable purely at the call site.

This is the decisive finding: HMR can be achieved by wrapping the *call to*
`component()`, with no change to `@nisli/core` and no change to author code.

## Prior Art — steal / adapt / reject

We surveyed five implementations and a spec before designing. Each contributed.

### esbuild native live reload — *adopt the transport, know its ceiling*

esbuild has **no HMR API**; it composes `watch` + `serve` + a one-line client.
From the docs: *"There is no esbuild API for live reloading directly. Instead,
you can construct live reloading by combining watch mode … and serve mode … plus
a small bit of client-side JavaScript."* The client is
`new EventSource('/esbuild').addEventListener('change', () => location.reload())`.
The `change` event carries `{ added, removed, updated }` arrays — esbuild's own
docs use these to **hot-swap CSS** (`<link>` href replace) without a reload, and
state plainly that **JS HMR is "outside of esbuild's scope"** because JS is
stateful. **Steal:** the CSS hot-swap technique and the SSE change channel.
**Reject:** relying on esbuild for JS HMR — it explicitly won't do it.

### `esm-hmr` spec (Snowpack; co-authors Evan You/Vue, Jovi De Croock/Preact) — *steal the contract*

A standard HMR client API for ESM dev: *"live-update individual JavaScript
modules … without triggering a full browser reload or losing the current web
application state."* Client model (`src/client.ts`): a per-module
`HotModuleState` with `accept(deps, cb)`, `dispose(cb)`, `invalidate()`,
`decline()`, and `data` (state carried across updates). `applyUpdate(id)` runs
**dispose callbacks, then re-imports** the module with a `?mtime=` cache-bust and
runs **accept callbacks**; a `reload` message forces full reload as the fallback.
**Steal:** the `accept`/`dispose`/`invalidate` contract and the dispose-then-apply
ordering, and the `data` bag for carrying state across an update. **Reject:**
its reliance on per-module ESM URLs re-`import()`ed individually — that requires
an unbundled-ESM dev server (violates constraint #5). Spec is archived but the
contract is the lingua franca (Vite's `import.meta.hot` mirrors it).

### React Fast Refresh (`react-refresh/ReactFreshRuntime.js`) — *steal the family + signature model*

The runtime keeps **families**: `register(type, id)` groups every version of a
component under a stable `id`; `resolveFamily(type)` returns the latest version
so existing instances forward to new code. `createSignatureFunctionForTransform`
records a component's "signature" (hooks/props shape); `haveEqualSignatures` /
`canPreserveStateBetween` decide whether to **preserve state or remount**;
`performReactRefresh` applies pending updates and remounts when state can't be
preserved. **Steal:** (a) the **registry-by-stable-id** indirection (our `id` =
the custom-element tag), and (b) the **"decide: hot-apply vs remount vs reload"**
escalation based on whether the change is safely applicable. **Adapt:** we don't
need React's fiber integration; nisli's reactivity gives us a simpler apply.

### `@open-wc/dev-server-hmr` — *steal the WC-specific apply; reject the dep coupling*

The only off-the-shelf **Web Components** HMR. *"Keeps track of web component
definitions … updates them at runtime on change … preserves the page's state."*
Mechanism (their "how it works"): replace class references and **instance
prototype chains with proxies** forwarding to the latest class; new elements use
the new class; existing elements get their prototype re-pointed (methods update,
fields/state retained, **constructor not re-run**). Components are detected via
`customElements.define`, `HTMLElement` subclassing, decorators, or **factory
functions** (`functions: [{ name: 'component', import: '@nisli/core' }]` would
match nisli exactly). Author opts in with a `hotReplacedCallback`, or the plugin
**patches it externally** (no source change) via its `patches` config.
**Steal:** the WC-specific apply semantics and the external-patch idea.
**Reject:** it is a `@web/dev-server` plugin built on the esm-hmr/unbundled-ESM
model — adopting it wholesale means a second, unbundled dev pipeline
(violates #5). We reuse the *idea*, not the dependency.

### `leegeunhyeok/esbuild-hmr` (PoC) — *proof + the per-module registration shape*

Proves HMR on esbuild specifically. It transforms each module to a custom module
system and injects, per module,
`var __hmr0 = window.__hot.register("client/sub.ts");` plus
`global.__modules.export(...)`; watches with chokidar; pushes over `ws`.
**Steal:** the **build-time per-unit registration injection** pattern (we inject
a tag→setup registration instead of a full module system) and the watch→push
server shape. **Adapt:** we don't rebuild a module system — nisli components are
the HMR unit, which is coarser and far simpler than general module HMR.

### Synthesis — what we take

- **Transport:** esbuild watch + an SSE `change` channel (esbuild-native, or a
  tiny `node:http` SSE in the watch process). CSS hot-swap from the `change`
  payload.
- **Contract:** esm-hmr's `accept`/`dispose`/`invalidate`, minimized.
- **Indirection:** Fast Refresh's registry-by-stable-id, keyed by **custom-element
  tag** — the natural stable id nisli already has.
- **Apply:** open-wc's WC re-mount semantics, realized through nisli's *existing*
  `connect/disconnect` lifecycle (no proxy gymnastics needed because nisli owns
  re-mount).
- **Escalation:** component change → re-mount that tag's instances; CSS change →
  hot-swap; anything else → full reload.

## Decision

Ship a dev-only esbuild HMR plugin as a **tree-shakeable subpath of
`@nisli/core`** — `@nisli/core/esbuild-hmr` (Node/build-time plugin) and
`@nisli/core/esbuild-hmr/runtime` (browser dev client) — **not** a separate
package and **not** part of the runtime `.` entry. It delivers component-scoped
HMR with a live-reload + CSS-hot-swap fallback, gated to watch builds,
contributing **zero** bytes to production.

### Ruling 1 — A subpath export of `@nisli/core`, isolated from the runtime entry

HMR ships *with* the framework but as a distinct entry point, never via the
runtime `.` export.

- **Why in-package, not a separate package:** the re-mount logic depends on
  `component.ts` lifecycle internals (the `connect/disconnect` semantics,
  constructor-owned `_propsProxy`, the `_mounted` guard). Co-locating and
  **co-versioning** it with the code it couples to prevents the plugin's
  assumptions from silently drifting across `@nisli/core` releases — a real
  ADR 0008.1-class hazard a separately-versioned package would invite.
- **Why a subpath, not the main entry:** `@nisli/core/esbuild-hmr` is a separate
  `exports` entry. The app's runtime bundle imports only `@nisli/core` (`.`); the
  build script imports `@nisli/core/esbuild-hmr` (Node, build-time); the browser
  dev client (`./esbuild-hmr/runtime`) is injected **only** by the plugin on the
  watch path. None of these are reachable from the `.` runtime graph, so prod is
  byte-identical **by construction** — stronger than relying on tree-shaking.
- **Zero-dep posture (ADR 0019) preserved:** `esbuild` is declared an *optional
  `peerDependency`* used only by the subpath; consumers who never import
  `@nisli/core/esbuild-hmr` never need it, and `@nisli/core`'s `.` entry stays
  dependency-free.

This honors "HMR is a bundler concern" — the plugin is build tooling reached
through its own entry point, never wired into the runtime — while keeping it
cohesive with the framework it must track.

### Ruling 2 — Tag-keyed setup registry via call-site indirection

The plugin transforms imports so `component(tag, setup, opts)` becomes a dev
wrapper:

```js
// injected ONLY in watch builds
const __nisliHmr = new Map();              // tag -> current setup
function component(tag, setup, opts) {
  __nisliHmr.set(tag, setup);
  return __realComponent(tag, (props, host) => __nisliHmr.get(tag)(props, host), opts);
}
```

The real `FrameworkComponent` captures a **stable thunk** that always reads the
current setup. On update we `__nisliHmr.set(tag, newSetup)` — no class swap, no
re-`define`, working *with* the `customElements.get` guard rather than against it.

### Ruling 3 — Re-mount through the existing lifecycle

On a component update, for each live element of the changed tag:
`el.disconnectedCallback(); el.replaceChildren(); el.connectedCallback();` —
dispose effects/disposers, clear old DOM (firing nested children's
`disconnectedCallback`), then re-run the new `setup` and re-mount. Props persist
via the constructor-owned `_propsProxy`. Only that tag's subtrees re-render;
the rest of the app — scroll, route, sibling components, global stores — is
untouched.

### Ruling 4 — Fidelity tiers and escalation

| Change | Action | State preserved |
|---|---|---|
| CSS only | hot-swap `<link>` (esbuild `change.updated`) | everything |
| A component's setup | re-mount that tag's instances | props + rest of app; the edited component's local `setup` signals reset |
| Anything else / risky | full `location.reload()` | nothing (correct fallback) |

### Ruling 5 — Gated to `--watch`; prod byte-identical

The transform and the injected runtime/client are applied **only** on the watch
path. `pnpm build` (no `--watch`, the only path CI publishes) emits the
unmodified bundle. This is the React Fast Refresh / `@vite/client` guarantee:
dev client present in dev, absent from prod.

## The hard part (call it out)

Re-mount correctness is the risk, and it lives squarely in **ADR 0008.1**
territory (mount-time dependency leak, reactive-slot teardown). Specifically:

- **Disposal ordering / nested children.** `replaceChildren()` must disconnect
  nested custom elements so their `disconnectedCallback` disposers run before the
  rebuild, or effects/subscriptions leak across reloads.
- **The `_mounted` guard + double-mount.** Re-mount must go through
  disconnect→connect so `_mounted` is reset; a partial re-mount risks duplicate
  DOM or an un-disposed effect (the exact failure class ADR 0008.1 fixed).
- **`activeObserver` isolation.** Re-running `setup` outside the original
  `untrack(...)` mount path could re-introduce the parent-effect dependency leak
  ADR 0008 / 0008.1 closed; the re-mount routine must mirror that isolation.

These demand disposal tests modeled on the 0008.1 scroll-retention probe before
this is trusted. The CSS-hot-swap and full-reload tiers are robust regardless and
ship first.

## Engineering Plan (file-level)

1. **`packages/core/src/esbuild-hmr/`** (new subtree) — `plugin.ts` (esbuild
   plugin: onLoad transform that rewrites the `@nisli/core` `component` import to
   the wrapper + injects the client; onEnd that diffs metafile outputs and
   broadcasts a `change` payload), `runtime.ts` (browser: tag registry,
   `remount()`, `EventSource` client, CSS hot-swap, reload fallback), `server.ts`
   (tiny `node:http` SSE hub, or wire esbuild `serve` `/esbuild`).
2. **`packages/core/package.json`** — add `exports` entries `./esbuild-hmr`
   (Node) and `./esbuild-hmr/runtime` (browser), each with its own
   `types`/`default`; declare `esbuild` as an **optional `peerDependency`**; keep
   the `.` entry dependency-free. Build config (`tsconfig.build.json`) emits the
   subpath alongside the runtime without pulling it into `.`.
3. **`packages/core/src/esbuild-hmr/*.test.ts`** — disposal/re-mount invariants
   (no duplicate DOM, disposers run, scroll retained à la ADR 0008.1), tag-registry
   swap, CSS-only vs component vs reload escalation. Verify the `.` runtime entry's
   built output contains **no** HMR code (prod-isolation assertion).
4. **Consumer (`backlog-mcp` `packages/viewer/build.mjs`)** — import the plugin
   from `@nisli/core/esbuild-hmr` and add it only when `--watch`; prod path
   unchanged. (backlog-mcp side; cross-repo.)

## Consequences

- **Positive:** Vite-grade reload/HMR DX on the existing esbuild+Hono setup; no
  `@nisli/core` change; no author-code change; zero prod bytes; dev keeps serving
  the prod-shaped bundle (constraint #5 honored, unlike Vite). Reuses proven
  ideas instead of inventing them.
- **Cost:** a new dev-only subpath to maintain (co-versioned with `component.ts`,
  which is the point); re-mount correctness is genuinely tricky (ADR 0008.1 risk)
  and needs tests; the edited component's local signal state resets on swap
  (coarser than Fast Refresh).
- **Scope boundary:** component-scoped HMR, not module-graph HMR. Editing
  non-component modules (utils, services) escalates to full reload — acceptable;
  true module HMR would require unbundled ESM (rejected) or a module-registry
  transform (the esbuild-hmr PoC path), out of scope here.
- **Future (deluxe tier):** preserving the *edited* component's own local state
  would need an optional, dev-only, tree-shaken `hotReplacedCallback`-style hook
  re-using existing signals instead of re-running `setup` — the only thing that
  would ever touch `@nisli/core`, and only behind dead-code elimination.

## Cross-References

- **[0017. Framework Package Extraction](./0017-framework-package-extraction.md)** —
  establishes the standalone `@nisli/core` package; this ADR adds *tooling beside*
  it, not *into* it.
- **[0019. Minimal Runtime and Native Platform Alignment](./0019-minimal-runtime-and-native-platform-alignment.md)** —
  the zero-dep, prod-clean ethos that forces HMR into a separate dev package.
- **[0008.1. Mount-Time Dependency Leak](./0008.1-mount-time-dependency-leak.md)**
  and **[0008. Effect Isolation](./0008-effect-scheduling-and-batching-gaps.md)** /
  **[0009. Defense-in-Depth](./0009-framework-defense-in-depth.md)** — the
  re-mount/disposal correctness hazards this design must respect.
- **backlog-mcp ADR 0108 — Content-Hashed Viewer Assets** — the sibling ADR whose
  `--watch` HTML-emit pipeline this plugin plugs into; surfaced the missing
  reload channel.
- **Code:** `packages/core/src/component.ts` (`FrameworkComponent`,
  `connectedCallback`/`disconnectedCallback`, constructor-owned `_propsProxy`,
  guarded `customElements.define`); `packages/core/src/index.ts` (the `component`
  export the plugin wraps).

## Authoritative Sources (distilled)

- **esbuild — Live reload** <https://esbuild.github.io/api/#live-reload>: *"There
  is no esbuild API for live reloading directly … combine watch mode and serve
  mode plus a small bit of client-side JavaScript."* Client:
  `new EventSource('/esbuild').addEventListener('change', () => location.reload())`.
  `change` carries `{ added, removed, updated }`; docs use it for CSS hot-swap;
  **"Hot-reloading for JavaScript is not currently implemented … outside of
  esbuild's scope"** (JS is stateful). → use for transport + CSS; don't expect JS HMR.
- **esm-hmr spec** <https://github.com/FredKSchott/esm-hmr> (Schott/Snowpack,
  De Croock/Preact, You/Vue): the standard client contract —
  `import.meta.hot.accept/dispose/invalidate/decline` + a `data` bag; `applyUpdate`
  runs **dispose → re-import (`?mtime=` bust) → accept**. → copy the minimized
  contract; reject its per-module-ESM reload (needs unbundled dev).
- **React Fast Refresh — `ReactFreshRuntime.js`**
  <https://github.com/facebook/react/blob/main/packages/react-refresh/src/ReactFreshRuntime.js>:
  **families** (`register(type,id)` / `resolveFamily`) give stable-id indirection;
  `haveEqualSignatures`/`canPreserveStateBetween`/`performReactRefresh` decide
  preserve-vs-remount. → steal registry-by-stable-id (id = tag) + the
  hot-apply/remount/reload escalation.
- **`@open-wc/dev-server-hmr`**
  <https://open-wc.org/docs/development/hot-module-replacement/>: generic Web
  Component HMR — *"updates them at runtime on change … preserves the page's
  state"*; proxy/prototype swap, `hotReplacedCallback`, factory-function
  detection, external `patches` (no source change). Limits: constructor not
  re-run, new fields unavailable, `observedAttributes` fixed. → steal WC apply
  semantics; reject the `@web/dev-server`/unbundled coupling.
- **`leegeunhyeok/esbuild-hmr`** <https://github.com/leegeunhyeok/esbuild-hmr>:
  PoC of HMR on esbuild — per-module injected registration
  (`window.__hot.register(...)`), chokidar watch, `ws` push. → proof + the
  build-time registration-injection shape (we inject tag→setup, not a module system).
- **Vite — HMR API** <https://vite.dev/guide/api-hmr> (context): `import.meta.hot`
  mirrors esm-hmr; confirms the contract is the ecosystem standard. Vite buys HMR
  via **unbundled native ESM in dev + Rollup in prod** (dev≠prod) — the model this
  ADR deliberately rejects to honor constraint #5.
