# Changelog

All notable changes to `@nisli/core`. Format: keep-a-changelog-lite — one
section per version, human-readable highlights. Releases happen at
checkpoints (ADR 0022); dates are release dates.

## Unreleased

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
