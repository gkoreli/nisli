# 0025. Core Proposals Surfaced by `@nisli/ui` — Gap & Ergonomics Tracker

**Date**: 2026-07-11
**Status**: Open (tracker — items graduate to their own ADRs when accepted)
**Depends on**: [0022-nisli-ui-component-library](./0022-nisli-ui-component-library.md)

## Context

Building 46 registry items (and the www site) made `@nisli/ui` the most
demanding consumer `@nisli/core` has ever had. This ADR is the standing
record of what that pressure revealed: bugs, missing primitives, and
ergonomics that today live as userland conventions in the registry's
`lib/utils.ts` but arguably belong in the framework. Tracker genre, like
ADR 0003/0004.

## Already fixed in core during this project

- **`ReactiveProps` optionality** — optional props typed as
  `Signal<T> | undefined` instead of `Signal<T | undefined>`; fixed with a
  `-?` mapped-type modifier the day ui ports began.
- **Move-resilient lifecycle (ADR 0023)** — append-based DOM moves re-ran
  setup and duplicated output (hit `each()` reorders and light-DOM
  projection); fixed with deferred disconnect teardown. Found by eng2
  validating nested `<ui-tabs>` projection.

## Open proposals

### 1. First-class content projection (children) — HIGH

Every one of the ~40 components re-implements the same userland machinery:
a `children` prop (`string | TemplateResult`) plus
`captureChildren()`/`projectChildren()` — including a microtask sweep for
streaming parsers and an ancestor guard whose absence caused the ADR 0023
ghost bug. Factories have no native child-content concept.
**Proposal**: `component()` captures pre-existing host children at upgrade
and exposes them (plus a factory `children` input) as a first-class,
correctly-timed primitive — the registry's subtlest copied code deleted
everywhere at once.

### 2. Subtree-scoped context / DI — HIGH

Parent↔child state uses a hand-rolled convention: parent sets
`host.__uiTabs = {…signals}`, children `closest('ui-tabs')` and throw into
the error boundary if absent. Nine-plus component families repeat it
(tabs, accordion, toggle-group, radio-group, avatar, dropdown/context/
menubar, command, dialog family). It is stringly-typed, invisible to
TypeScript, and each file re-implements the lookup + error.
**Proposal**: subtree-scoped `provide`/`inject` (DOM-walking context with
typed tokens) alongside the existing app-global DI — the Radix-context
equivalent, but standards-consumable.

### 3. Opt-in attribute reactivity / reflection — MEDIUM

`attr()`/`boolAttr()`/`forwardedAttr()` are parse-time-only userland
fallbacks; there is no `observedAttributes` path, so plain-HTML consumers
get no live attribute updates (documented v1 limitation in ADR 0022 §5).
The boolean semantics (bare attr = true, literal `"false"` = false,
default-true flags) and id/name forwarding are conventions core knows
nothing about.
**Proposal**: `component()` option declaring observed attributes mapped to
prop signals, with the ui boolean semantics; forwarding hooks for
`id`/`name` so form controls stop hand-rolling it.

### 4. Reactive-slot primitive transition gap — FIXED (2026-07-11)

`template.ts`: a slot whose signal is initially `null`/`undefined` becomes
a reactive slot; if the signal later holds a **primitive** (string/number),
the slot effect mounts nothing (it only handles templates, factories,
arrays). Avoided in ui by convention (children set before mount), noted
during Button design.
**Proposal**: handle primitives in the reactive-slot effect (text node),
plus a regression test.

**Resolution**: fixed by the `fix(core)` commit graduating tracker items 4
and 10; an initially `undefined` reactive slot now mounts later primitive text.

### 5. SSG microtask settling — MEDIUM (in `@nisli/ssg`)

`renderToHtml` snapshots `innerHTML` synchronously after mount, but ui
relies on microtasks (projection sweeps, command's initial filter pass) —
plain-HTML-authored nested content can be missing from static output.
Factory composition (what demo/www use) is unaffected, which is why it has
not bitten yet.
**Proposal**: `await` a microtask drain (or an exported settle hook) before
serializing.

### 6. Portal primitive — MEDIUM

Dialog, sheet, tooltip, popover, and all menus render overlays inline with
`position: fixed` and each documents the same caveat: a transformed/
filtered ancestor becomes the containing block and traps the overlay.
Upstream solves this with portals; we cannot reparent cleanly because
template disposal ownership is tied to where nodes were mounted.
**Proposal**: a core-sanctioned portal (mount-to-body with preserved
dispose/reactivity ownership) — the deferred `portal-lite` from ADR 0022,
promoted to a framework concern. ADR 0023's move-resilience already
removes the re-setup hazard for the move itself.

### 7. Awaitable flush/tick — LOW

Sequencing after DOM bindings flush requires hand-rolled
`queueMicrotask` (focus trap activation after `hidden` flips; test suites'
double-`flushEffects()` idiom for cascades).
**Proposal**: export an awaitable `tick()`/`settled()` from core and teach
`flushEffects()` to drain cascades, retiring the double-call idiom.

### 8. Typed template events — FIXED (2026-07-11)

`@keydown=${(e: KeyboardEvent) => …}` needs a manual cast in every
handler; the template engine could map event names to types.
**Proposal**: typed event helper or template type map (compile-time only,
no runtime change).

**Resolution**: fixed by the `fix(core)` commit graduating tracker item 8.
Core exports `TypedEventHandler<K>`, keyed by `HTMLElementEventMap`, so
component handlers can opt into event-name inference without a runtime wrapper
or parser changes. `ui-tabs` uses it for its keydown handler as the registry
proof; compile-time tests cover inference and invalid event/type rejection.

### 9. `component<P>` rejects interfaces — FIXED (2026-07-11)

`P extends Record<string, unknown>` means props must be type aliases
(interfaces lack implicit index signatures) — a recurring papercut when
porting.
**Proposal**: relax the constraint (e.g. `object`) or document the alias
requirement in the framework skill.

**Resolution**: fixed by the `fix(core)` commit graduating tracker item 9;
`component<P>` now constrains props to `object`, with compile-time proofs for
interface props, required properties, optional properties, and value types.

### 10. Static factory arrays don't mount in slots — FIXED (2026-07-11)

`html\`${[Item(...), Item(...)]}\`` (a plain array of factory results in a
slot) renders nothing/text under happy-dom: `template.ts`'s static-array
branch handles TemplateResults and primitives but not factory results,
while the *reactive*-slot array path handles all three — an asymmetric
gap. Found by eng2 writing carousel tests; components avoid it via nested
templates or `each()`.
**Proposal**: handle `__type: 'factory'` items in the static-array branch
(mirror the reactive path), plus a regression test.

**Resolution**: fixed by the `fix(core)` commit graduating tracker items 4
and 10; static factory arrays now use the same factory mounting helper as the
reactive array path.

### 11. Dynamic tag names in templates — MEDIUM

`html\`<\${tag}>\`` is not expressible — the template parser only handles
static tag names, so registry-driven rendering (www's auto-default previews:
"render the element named by this string") needs an `onMount` +
`document.createElement(tag)` workaround, which bypasses template binding
for that subtree. Found by eng3 building the /ui preview system; flagged by
Goga for tracking.
**Proposal**: either a dynamic-element primitive (e.g.
`el(tagName, props?, children?)` returning a mountable TemplateResult) or
first-class documentation of the createElement-in-onMount pattern with a
helper. Design work — the parser itself should stay static.

## Process

New friction found while building ui/www lands here first (PR review may
append). Graduation path: item gets its own ADR + implementation when
accepted; this tracker records the disposition either way.
