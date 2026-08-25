# Changelog

All notable changes to `@nisli/core`. Format: keep-a-changelog-lite — one
section per version, human-readable highlights. Releases happen at
checkpoints (ADR 0022); dates are release dates.

## Unreleased

- `setDevMode()` is exported. The diagnostics gate has always been probed
  automatically, and its own documentation named tests and buildless
  production pages as the cases the probe cannot get right — but the override
  was unreachable from the package's public surface. One barrel export, no
  behaviour change.

## 0.55.0 — 2026-08-25

Agent-native core wave (ADR 0030.2, gate record in
`docs/worklists/agn/AGN-WAVE1-GATE.md`):

- Scheduler: push-pull reactivity completed — an effect re-runs iff a
  value it read changed (equal recomputes no longer re-run downstream);
  deterministic creation-order flush; clock-free loop guard with sited
  diagnostics; `effect(async …)` is rejected at type level and diagnosed
  at runtime (use `resource()`); `untrack()` returns its value; new
  `signal.peek()`.
- Templates: parse-once per callsite (~2.3× faster mounts) with a
  first-parse static audit (undefined dash-tags, unknown events/
  modifiers, undeclared attributes on schema-bearing components);
  `when()` gains an `else` branch, gates on booleans, and evaluates
  branches untracked (no more truthy→truthy rebuilds); `html:inner`
  requires `raw()`-branded trusted HTML; remounting a live bound template
  throws instead of silently corrupting; `title`/`role`/`tabindex`/`name`
  now reach component tags as plain attributes.
- Components: unified setup/onMount error containment — contained
  failures stamp `data-nisli-error` and dispatch a bubbling `nisli-error`
  event, cleared on successful re-setup; duplicate
  `customElements.define` is a coded dev error naming both sites;
  post-mount writes to props setup never read echo a dev diagnostic;
  projection sweep ordering no longer depends on `children()` call
  position.
- Query: rewritten on a per-key logical-request store — invalidation
  revalidates active observers, disabled/key-switch can no longer strand
  `loading`, sync fetcher throws reject, per-run `AbortController` passed
  to fetchers, flat primitive key contract (objects/`undefined`/non-finite
  numbers rejected with N602); `onSuccess`/`onError` removed — read the
  `data`/`error` signals instead.
- New `settle()`: awaitable async quiescence (queries + resources) for
  tests and verify loops; iteration-capped, never wedged by
  abort-ignoring fetchers.
- New `viewTransition(update, { types })`: opt-in native View Transitions
  built on the synchronous flush — `flush()` runs inside the browser's
  update callback, so the frame it captures is the flushed DOM instead of
  the next microtask. `flush()` itself is unchanged and still synchronous.
  Progressive enhancement all the way down: no `startViewTransition` and
  the update applies directly (flushed, unanimated, returns `null`); no
  transition-types support and the plain callback form is used. Core ships
  no stylesheet — the reduced-motion cut is CSS, documented in the README.
- `html:inner` gains a second brand: `sanitized(markup)` routes untrusted
  HTML through the platform sanitizer (`Element.setHTML()`) where the engine
  has one, else through an app-registered `setSanitizerFallback()` hook, and
  throws N107 when neither exists — never a silent `innerHTML` downgrade, and
  no sanitizer is bundled. Native `TrustedHTML` values now pass through the
  `raw()` sink unwrapped ([ADR 0019](../../docs/adr/0019-minimal-runtime-and-native-platform-alignment.md)
  §124–128). The `raw()` path is unchanged.

  The platform sanitizer is identified by **identity**, not by shape: the
  method must be `Element.prototype.setHTML`. A callable merely *named*
  `setHTML` on the element — DOM clobbering, an unsafe polyfill, a library
  shim — is not trusted and falls through to the registered hook or to N107.
  A duck-typed check here was a real bypass, letting an element-local
  `setHTML` preempt the sanitizer an app had explicitly registered.

  **Known limitation, pre-existing and not closed by this work:** the brands
  are structural, so an object forged from untrusted JSON
  (`{"__raw": true, "value": "…"}`) still satisfies `raw()`'s check and
  reaches `innerHTML`. Never pass unvalidated parsed JSON to `html:inner`.
  Closing this needs an unforgeable brand and is a deliberate change to
  `raw()`'s trust model.
- New diagnostics layer: stable coded dev messages (`[nisli N…]`) behind
  a runtime dev gate (`setDevMode`; probes Vite/`NODE_ENV`, loud by
  default in buildless ESM); silent under production builds.
- Keyed `each()` reorders now use `moveBefore()` where the engine has it,
  so a moved row is *atomically* relocated instead of removed and
  re-inserted. Proven in three real browsers: on Chromium and Firefox a
  reorder fires `connectedMoveCallback` and no connect/disconnect pair, and
  it preserves focus, input selection, iframes (no reload), running
  animations including `currentTime`, and open popovers. WebKit has no
  `moveBefore()` yet and takes the `insertBefore()` path, where those are
  lost — but component *setup* still never re-runs on any engine, because
  [ADR 0023](../../docs/adr/0023-move-resilient-component-lifecycle.md)'s
  deferred teardown covers the fallback. Document `Selection` is **not**
  preserved by `moveBefore()`; neither path preserves it. Components gain
  an empty `connectedMoveCallback` so the platform treats an atomic move as
  a move. `portal()` in `@nisli/ui` moves the same way.
- Disposables are now `using`-compatible: `effect()`, `subscribe()`,
  `Emitter` handles, `resource()` and `query()` results carry a
  `Symbol.dispose` alias beside the callable disposer, so
  `using stop = effect(…)` releases at scope exit. Guarded — nothing is
  polyfilled and the callable form is unchanged.

## 0.54.1 — 2026-07-16

- Reactive child slots now preserve child semantics across primitive, empty,
  template, factory, and array transitions regardless of the initial value,
  while primitive-to-primitive updates reuse their existing text node.
- `each()` now rejects duplicate keys before mutating reconciliation state,
  preserves the last valid DOM, and recovers on the next unique array.

## 0.54.0 — 2026-07-16

- Component teardown now clears framework-owned DOM before true reconnect,
  preserves projected light-DOM children, and provides a synchronous in-place
  HMR remount path. Failed setup also disposes partial effects/templates, and
  reactive error fallbacks are owned through disconnect.
- Computed values recover after temporary errors when dependencies change, and
  signal subscriptions now deliver once initially without tracking signals
  read inside subscriber callbacks.
- Reactive child slots now dispose the currently selected nested template and
  factory prop/class subscriptions on replacement and parent teardown, so
  data-driven renderer swaps do not keep detached components reactive.
- Added `resource(source, loader)` for local async derivations with explicit
  source tracking, stale-generation suppression, AbortSignal cancellation,
  readonly data/loading/error signals, refresh, and automatic component
  disposal ([ADR 0028](../../docs/adr/0028-local-async-resource.md)).

## 0.53.0 — 2026-07-12

- Declared-type-aware `ReactiveProps`: `component<P, typeof attrs>` threads the
  `attrs` declaration into prop types, so a declared `'boolean'` reads as
  `Signal<boolean>` and a `'number'` with a default as `Signal<number>` —
  retiring the `as boolean`/`?? false` stopgap across every consumer. Exported
  `ComponentAttrs<P>` types the declaration. Narrowing applies only when the
  declared kind's type and the author's prop type agree exactly (mutual
  assignability): `boolean | string` unions and literal types (`true`, `1`)
  soundly fall back to the author's type. Options are required when the attrs
  type parameter is supplied. Pure type-level — zero runtime change.

## 0.52.0 — 2026-07-11

- Subtree-scoped context: `createContext` with typed `provide`/`inject`/`peek`,
  portal-safe capture-at-setup, and actionable missing-provider errors via
  `providerTag`.
- Opt-in attribute reactivity: the `component()` `attrs` option (string /
  boolean / number / forward kinds, declared defaults, attr-name overrides)
  with live `observedAttributes`-backed updates.
- First-class content projection: `children(fallback?)` replaces userland
  capture/project machinery; factory children render at the slot.
- Dynamic tags: `el(tag, props?, children?)` composes runtime-chosen elements
  in `html` slots while the parser stays static.
- Awaitable `tick()` and cascade-draining `flush()`; typed template events
  (`TypedEventHandler`); event-binding disposal fixed (`html` dispose, `el()`
  dispose, and `@event.once` all remove the installed listener).
- Move-resilient component teardown (deferred disconnect) and `ReactiveProps`
  typing fixes.

## 0.51.0 — 2026-07-11

- Reactive core for Nisli applications: `signal`, `computed`, `effect`,
  `flush`, `tick`, and `flushEffects` for predictable update scheduling and
  test control.
- Typed component authoring with `component()` and `ReactiveProps`, plus the
  `html` template engine and control-flow helpers (`when`, `each`).
- Dependency injection and event primitives: `inject`, `provide`,
  `createToken`, and typed `Emitter` support for framework-level composition.
- Browser/runtime integration for real components: `ref`, `onMount`,
  `onCleanup`, `useHostEvent`, and the `query()` / `QueryClient` data-loading
  surface.
- Earlier history lives in git.
