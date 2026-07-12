# Changelog

All notable changes to `@nisli/core`. Format: keep-a-changelog-lite — one
section per version, human-readable highlights. Releases happen at
checkpoints (ADR 0022); dates are release dates.

## Unreleased

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
