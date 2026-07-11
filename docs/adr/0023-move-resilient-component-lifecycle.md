# 0023. Move-Resilient Component Lifecycle — Deferred Disconnect Teardown

**Date**: 2026-07-11
**Status**: Accepted
**Depends on**: [0022-nisli-ui-component-library](./0022-nisli-ui-component-library.md)

## Context

Per WHATWG, an append-based DOM move of a connected node is a remove +
insert: it fires `disconnectedCallback` then `connectedCallback`. Only the
new `Element.moveBefore()` API preserves state, and neither the framework
nor happy-dom uses it.

Nisli's `disconnectedCallback` tore the component down synchronously
(dispose template bindings, run disposers, `_mounted = false`), so the
`connectedCallback` that follows a move re-ran setup and mounted a second
copy of the template — without removing the first. Every same-document move
therefore duplicated rendered output and destroyed component state.

Moves are routine inside the framework:

- `each()` keyed reconciliation repositions wrappers with `insertBefore` —
  any custom element inside a reordered row was disposed and re-set-up.
- `@nisli/ui`'s light-DOM projection (`projectChildren`, ADR 0022) moves
  pre-existing host children — nested plain-HTML components (`<ui-tabs>`,
  `<ui-alert>`) re-ran setup and left "ghost" duplicates.

Found by eng2 while validating the `@nisli/ui` parent↔child conventions
(initially misdiagnosed as a happy-dom deviation; it is real browser
behavior).

## Decision

Defer disconnect teardown by one microtask and skip it if the element is
connected again:

```ts
disconnectedCallback() {
  if (this._teardownScheduled) return;
  this._teardownScheduled = true;
  queueMicrotask(() => {
    this._teardownScheduled = false;
    if (this.isConnected) return;   // it was a move — still mounted
    // true removal: dispose template, run disposers, _mounted = false
  });
}
```

`connectedCallback` keeps its existing `if (this._mounted) return` guard, so
a same-tick remove+reinsert becomes a complete no-op: no re-setup, no
duplicate mount, no state loss. A true removal still disposes everything —
one microtask later. A reconnect *after* teardown re-initializes, as before.

## Consequences

- `each()` reorders and light-DOM projection no longer duplicate output or
  reset component state; `@nisli/ui`'s nested plain-HTML tests can assert
  exact element counts instead of tolerating ghosts.
- Disposal after a real removal is observable one microtask later. Tests
  that assert cleanup synchronously after `removeChild` must await a
  microtask (`settleTeardown()` helper in the core test suites).
- A remove+reinsert that spans a microtask boundary still tears down and
  re-initializes; code moving nodes asynchronously must expect that.
- Multi-move chains within a tick are safe: teardown is scheduled once and
  re-checks `isConnected` at flush time.
