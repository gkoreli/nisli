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

### 1. First-class content projection (children) — FIXED (2026-07-11)

Every one of the ~40 components re-implements the same userland machinery:
a `children` prop (`string | TemplateResult`) plus
`captureChildren()`/`projectChildren()` — including a microtask sweep for
streaming parsers and an ancestor guard whose absence caused the ADR 0023
ghost bug. Factories have no native child-content concept.
**Proposal**: `component()` captures pre-existing host children at upgrade
and exposes them (plus a factory `children` input) as a first-class,
correctly-timed primitive — the registry's subtlest copied code deleted
everywhere at once.

**Resolution (UI-31 prototype + design gate, 2026-07-11)**: core exports
`children(fallback?)` — a setup-context primitive returning a reactive slot
value a template interpolates (`html`<button>${children()}</button>``). It
subsumes `captureChildren`/`projectChildren` + the per-component
conditional-default swap. Priority: factory `children` prop → captured
light-DOM children → fallback. `component()` captures the host's light-DOM
children pre-setup (CAPTURE, second of **SEED → CAPTURE → CONTEXT → setup**;
snapshot-only, gated on `childNodes.length` → zero cost when none). The
streaming microtask sweep + ancestor guard (the ADR 0023 machinery) now live in
core. `children(fallback)` renders the fallback only when no MEANINGFUL children
exist (whitespace-only does not count) and REPLACES it reactively, including
late parser children — natively solving the conditional-default class.

Design-gate finding (the correction that became the architecture): a first
implementation ROUTED the factory `children` prop into the host's light DOM
before connect (one capture path). That detached factory children before their
`connectedCallback`, breaking `closest()`-based parent lookup — `useScroller`
threw, and it generalizes to every context-composed family (tabs/accordion/
select). CORRECTION — **read-and-render**: `children()` READS the host's
`children` prop signal (via internal `element._propSignal(key)`) and renders it
AT the slot position, not by relocating it, so a factory-composed child is a
DOM descendant of its parent when its `connectedCallback` runs, and factory
children stay reactive. Rulings folded in: the `TemplateResult` fallback is
mounted once into a detached holder (its bindings live in the component context
and dispose with it) and exposed as a re-mountable node slot so
empty→filled→empty cannot crash; `_propSignal` stays an internal (underscore)
bridge — no public read API; single default slot only (named/multiple slots are
a later design). Proof: `button` and `message-scroller-button` migrated (full
suites green unchanged), `core/projection.test.ts` (8 cases), and SSG
regressions (factory children + light-DOM projection settling under `tick()`)
in `ssg/build.test.ts`.

GAP-NOTE (2026-07-12, WWW-12 sidebar dogfood): the single-slot v1 shows its
edge when one `children()` slot is placed into one of two branches swapped by a
signal — `registry sidebar`'s mobile `Sheet` vs desktop frame, selected on
`isMobile` via `when()` (the upstream-faithful Option B: only one tree in the
DOM at a time). A breakpoint flip re-mounts the projected subtree, so any
transient DOM state inside it (scroll position, focus, uncommitted input) is
lost across the threshold. Accepted for v1 (resize-across-768px is rare and the
nav content is stateless/derived); it is a concrete motivation for
named/multiple slots — hold for the second consumer per the item-1 ruling.

### 2. Subtree-scoped context / DI — FIXED (2026-07-11)

Parent↔child state uses a hand-rolled convention: parent sets
`host.__uiTabs = {…signals}`, children `closest('ui-tabs')` and throw into
the error boundary if absent. Nine-plus component families repeat it
(tabs, accordion, toggle-group, radio-group, avatar, dropdown/context/
menubar, command, dialog family). It is stringly-typed, invisible to
TypeScript, and each file re-implements the lookup + error.
**Proposal**: subtree-scoped `provide`/`inject` (DOM-walking context with
typed tokens) alongside the existing app-global DI — the Radix-context
equivalent, but standards-consumable.

**Prototype (UI-27, 2026-07-11, eng2 — NOT landed, design gate)**:
`core/src/element-context.ts` exports `createContext<T>(name)` →
`{ name, provide(host, value), inject(host?), inject.optional(host?) }`.

- **Identity-keyed, typed end-to-end.** Each `createContext` mints a private
  `Symbol` as the storage key; userland references the context object, never a
  string. `provide` sets that symbol on the provider host; `inject` walks
  `parentElement` (inclusive) to the nearest host carrying the key. Same-named
  contexts stay distinct. `inject()` returns `T` (throws into the error boundary
  when absent, with a named message); `inject.optional()` returns `T | undefined`.
- **Capture at setup = portal-safe (constraint a).** `inject()` resolves during
  setup, while the injecting host is still a DOM descendant of its provider, and
  returns the value *once*. Provider values carry signals, so reactivity flows
  through them with no further walks (constraint c) — and because the value is
  already held, a subtree later reparented to `<body>` keeps resolving its
  ORIGINAL provider (a fresh walk from the portaled host would find nothing).
  This is the exact analogue of the UI-25 ui-select "dispatch on the captured
  root host" fix. Enforced: `inject()`/`inject.optional()` with no `host` require
  an active setup context (else they throw / return undefined). `parentElement`
  transparently crosses `display: contents` hosts.
- **Zero cost for non-users (constraint b).** Providing sets one symbol property;
  injecting is a bounded ancestor walk. No global registry; components that use
  neither pay nothing (verified: a provide adds exactly one own symbol, non-users
  gain none).

**Proof**: `element-context.test.ts` (13 cases: ancestor/nearest/display-contents
resolution, same-name distinctness, throw + optional, setup-default-host, reactive
pass-through, error boundary, and the reparent/portal-safe-capture case) + `tabs`
migrated as the smallest `__ui` family (`host.__uiTabs`/`closest('ui-tabs')` →
`TabsContext.provide`/`.inject()`; all 15 tabs tests green, full ui suite 744 green).

**Resolution (UI-27 design gate + UI-28 full migration, 2026-07-11)**: the
prototype API was ratified and the convention deleted registry-wide. `createContext`
graduated as core (`element-context.ts`); the one API addition the migration
surfaced — `Context.peek(host)` ("read THIS host only, no walk") — was added to
back the menu families' `resolveParentOpen()` (a bespoke "nearest enclosing
sub-open, else root-menu-open" loop that `inject` can't express and a private
symbol correctly blocks the old direct read). All 33 `host.__uiX`/`closest`
sites migrated across ~30 files in five reviewable batches (Tier-1 flats →
portaled overlays → accordion's 2-context split → menus with peek + menubar
acceptance → combobox), each keeping behavior identical (state objects + their
signals unchanged). A registry-wide grep for `.__ui[A-Z]` now returns zero
provider/consumer sites. Full ui suite 758 green, core 251 green.

Arch's four rulings (all folded in):
1. *Walk = INCLUSIVE* (matches `closest`; no family self-injects a same-context
   ancestor — the menu families provide one context while injecting a different
   one, isolated by symbol). Exclusive-from-parent can become an option if a
   same-context nesting ever appears.
2. *Multi-context providers* are handled by symbol identity — **menubar is the
   acceptance proof** (bar → per-menu → sub + radio-group, four levels resolving
   independently; explicit `Menubar — multi-context resolution` test suite). Three
   SEPARATE radio-group contexts keep the menu families from cross-resolving.
3. *Store the state object* (which holds signals); **swapping the provided value
   mid-life is UNSUPPORTED** — `inject` resolves once and does not re-walk. All
   reactivity lives in signals inside the value.
4. *Naming stands* — `Context.provide`/`.inject` methods vs the app-global
   `provide`/`inject` free functions. The **"two DI systems"** distinction
   (`Context` = DOM-subtree scoped / `injector` = app-singleton) is documented in
   the framework skill (§4) and this ADR.

**Proof**: `element-context.test.ts` (15 cases incl. reparent/portal-safe capture,
nearest-provider, same-name distinctness, reactive pass-through, error boundary,
`peek` + a nearest-of-A-or-B walk demo); `tabs` (first migration) + a
`dialog.test.ts` reactivity-survives-portal assertion + the `menubar.test.ts`
multi-context acceptance suite.

### 3. Opt-in attribute reactivity / reflection — FIXED (2026-07-11)

`attr()`/`boolAttr()`/`forwardedAttr()` are parse-time-only userland
fallbacks; there is no `observedAttributes` path, so plain-HTML consumers
get no live attribute updates (documented v1 limitation in ADR 0022 §5).
The boolean semantics (bare attr = true, literal `"false"` = false,
default-true flags) and id/name forwarding are conventions core knows
nothing about.
**Proposal**: `component()` option declaring observed attributes mapped to
prop signals, with the ui boolean semantics; forwarding hooks for
`id`/`name` so form controls stop hand-rolling it.

**Resolution (UI-29 prototype + design gate, 2026-07-11)**: `component()`
gains an optional `attrs` declaration mapping prop keys to attribute behavior
— `'string' | 'boolean' | { type:'boolean', default } | { type:'string',
default } | 'forward'`. Declared attributes feed `static observedAttributes`,
so `setAttribute()` AFTER mount writes the prop signal live (removing ADR 0022
§5's parse-time-only limit). The ui boolean semantics are core's now
(bare/any → true, literal `"false"` → false, absent → declared default else
false); `'forward'` relocates `id`/`name` off the layout-transparent host onto
the inner control. Attribute name = kebab-case of the prop key (`className` ↔
`class-name`). Prop signals are seeded from attributes pre-setup (SEED, first
of the canonical **SEED → CAPTURE → CONTEXT → setup** order); live changes
arrive via `attributeChangedCallback`. Zero cost when `attrs` is omitted.
Userland `attr()/boolAttr()/forwardedAttr()` keep working during the UI-30
migration.

Design-gate ruling (binding): precedence is **defined-write-pins** — NOT
`attr()`'s nullish-coalesce and NOT unconditional pinning. `_setProp(key, v)`
pins the key only when `v` is defined; an explicit `undefined` (a factory
spreading an unset optional — `{...opts}` fires `_setProp(key, undefined)` per
the `Object.entries` walk) must not pin, and for a declared attribute
re-resolves from the current attribute so declared-default booleans stay
non-undefined. This keeps determinism AND the established coalesce behavior.
Proof: `switch` migrated (boolean + forward + string), all 15 prior tests green
plus live-update + spread-of-undefined regressions; a `signal`-typed
`as boolean` in switch is the stopgap until `ReactiveProps` carries the
declared type (future work). **v1.1** (surfaced by the UI-30 batch-1
migration): the object forms gained an `attr` override for props whose native
attribute is not the kebab derivation (`readOnly: { type:'boolean',
attr:'readonly' }`), and a `'number'` kind (`Number(raw)`; absent → default
else undefined; a non-numeric value behaves as absent → default else undefined,
so garbage never propagates `NaN` into layout math and a declared default still
guarantees non-undefined) — both small, orthogonal extensions to
`resolveAttrValue`/`AttrDecl`. v1.1 also fixes a `'forward'` unpin bug found by
rev's audit: `_applyAttr`'s forward branch early-returned on an absent
attribute, so a defined→undefined unpin (or a spread-of-undefined) left the
stale pinned `id`/`name` on the inner control; the unpinned/absent path now
resolves the value (undefined) through the prop signal.

**Open-state pattern** (attribute-as-truth; ruled during UI-30 batch 3A/batch 2
for every overlay + menu root that owns an `open` state). The `open` ATTRIBUTE
is the uncontrolled state, matching native `<dialog open>`/`<details open>` so
plain-HTML authors get platform semantics: `open`/`defaultOpen` declared
`'boolean'`; `open = computed(() => props.open.value ?? false)` (no `internal`
signal); `setOpen(next)` writes the attribute ONLY when uncontrolled —
`if (!isPinned(host, 'open')) host.toggleAttribute('open', next)` — and always
dispatches the open-change event. Controlled factory usage works via
defined-write-pins (a factory `open` signal pins the prop → the attribute is
ignored → the parent drives); a reflect `effect(() => host.toggleAttribute('open',
open.value))` mirrors the resolved state back to the attribute (CSS `[open]` +
native parity, dedupe-cheap). `defaultOpen` is INIT-SEED-ONLY, seeded once and
guarded twice — skip when pinned (avoids a seed→reflect flicker) and when
`host.hasAttribute('open')` (a SANCTIONED read of a DECLARED attribute that
distinguishes absent from present-`"false"`, so explicit `open="false"` beats
default). The controlled discriminator is core's `_isPinned(key)` (a declared
`'boolean'` is never `undefined`, so pin state is the only controlled signal),
surfaced to the registry as `isPinned(host, key)` in `lib/utils.ts`. Nested/
submenu open states are NOT attribute-backed — only the single root `open`.

**Batch-3B gap log** (candidates, not yet fixed — flag if a second consumer or an
impossible case appears): (a) `children()` + `onMount` ordering — `children()`
consumes the light-DOM capture at call time and registers its own late-parser
sweep as an `onMount`, so a component whose own `onMount` observes projected DOM
must call `children()` first (hoist `const slot = children()`); resolved as a
documentation rule (`comp-children-before-onmount` in the framework skill), not an
API change — upgrades to a design item only if hoisting becomes impossible
(ordering cycle). Found by `form-field`. (b) dual-mode value roots (accordion/
toggle-group/combobox) type their factory `value`/`defaultValue` as
`string | string[]` while the declared attr is `'string'`, forcing a per-branch
cast — a candidate for the `ReactiveProps` declared-type enhancement (already
future work). (c) `'number'` attrs consumed at mount-time registration aren't live
for free — `resizable` had to store the prop signals in the group + reflow via an
effect; a "reactive registration" helper could remove that boilerplate.

**Design sketch — candidate (b): declared-type-aware `ReactiveProps` — FIXED
(UI-35, 2026-07-12).** Today
`ReactiveProps<P>` maps every key to `Signal<P[K] | undefined>` regardless of its
`attrs` declaration, so a declared `'boolean'` (runtime-guaranteed non-`undefined`
via default-resolution) still types as `boolean | undefined` and every migrated
boolean root carries an `as boolean` (switch, dialog `open`, toggle `pressed`, …) or
a `?? false`. The declaration already KNOWS the reconciled runtime type; threading
`opts.attrs` into the `component<P>` signature would narrow `props.K.value` per kind:
`'boolean'`/`{type:'boolean'}` → `Signal<boolean>`; `'number'` with `default` →
`Signal<number>`, without → `Signal<number | undefined>`; `'string'` →
`Signal<string | undefined>` (unchanged); `'forward'`/undeclared → as today. This
retires the `as boolean` stopgap across every migrated boolean in one change — the
single highest-frequency cast in the registry — and is a pure type-level enhancement
(no runtime cost, no behavior change). **The dual-mode value roots are NOT fully
solved by this** and must be called out as a distinct, harder case: accordion/toggle-
group/combobox type their factory `value`/`defaultValue` as `string | string[]` while
the attribute only ever carries a `string`, so even a declaration-narrowed prop type
is `string | string[] | undefined`, and the single-branch `as string` asserts "in
single mode the factory won't hand me an array" — a SEMANTIC narrowing no
representational type can derive. Honest options, in order of preference: (1) keep the
cast — rev accepted it as the sole residual and it is load-bearing on exactly three
components; (2) a `value: 'string' | 'string[]'`-style declaration kind where core
owns the comma normalize/join so the registry never sees the union (removes the cast
but bakes multi-value encoding into core — only worth it at a fourth consumer);
(3) split single vs multiple into distinct prop types behind a mode generic (most type-
honest, most churn). RECOMMENDATION: ship (b)-narrowing for the boolean/number
majority; leave the dual-mode cast as the documented residual until a fourth dual-mode
root appears, then reconsider option (2). **Disposition (2026-07-11, arch)**: accepted
as sketched — graduated to ticket **UI-35** (eng1): ship the boolean/number narrowing,
keep the dual-mode cast as documented residual.

**Resolution (UI-35, 2026-07-12).** Shipped as recommended — (b)-narrowing for the
boolean/number majority, dual-mode cast kept (option 1). `component()` gained a
SECOND type parameter `A extends ComponentAttrs<P> = {}` threaded through
`SetupFunction<P, A>` → `ReactiveProps<P, A>`; the new mapped type narrows each key
via `AttrValueType<P[K], A[K]>`: `'boolean'`/`{type:'boolean'}` (any default) →
`Signal<boolean>`; `{type:'number', default}` → `Signal<number>`; bare `'number'`
(no default) → `Signal<number | undefined>`; `'string'`/`{type:'string'}`/`'forward'`/
undeclared → `Signal<P[K]>` unchanged. New exported type `ComponentAttrs<P>` (the
`attrs`-map shape, extracted from `ComponentOptions`) is what an `attrs` object
`satisfies`. Pure type-level: the props Proxy is runtime-untyped and the sole cast
(`props as ReactiveProps<P, A>` at the setup call) is the compile-time view; zero
runtime change, zero behavior change.

**The inference wall + the opt-in convention (arch-approved).** Threading `attrs`
into a SINGLE `component<P>(…)` call so `A` INFERS from `options.attrs` is impossible:
TypeScript does not do partial type-argument inference — the moment `P` is given
explicitly (as every registry call does — `P` cannot be inferred, it is the factory's
public prop type, not derivable from the setup body), a defaulted `A` takes its DEFAULT
rather than inferring from arguments (verified empirically; not a bug to fight with
overloads or currying — currying would be a runtime change). The resolution is an
explicit second type argument at the opt-in sites: name the attrs map as a `const …Attrs
= { … } satisfies ComponentAttrs<P>` and pass `component<P, typeof …Attrs>(…)`. This is
zero-runtime and FULLY backward compatible: the single-argument `component<P>(…)`
form is untouched (`A` defaults to `{}` → every prop keeps its author type, exactly the
pre-(b) behavior), and `attrs` stays validated for everyone. `satisfies ComponentAttrs<P>`
at the const preserves the literal declaration types (so `typeof` narrows) AND catches
typo keys / bad decls.

**Two type-safety refinements (rev passes 1–2).** The first cut had two holes, both
closed before landing: (1) *the narrowed type must not outrun the runtime.* When the
`A` type argument is a non-empty attrs literal, the options argument carrying `attrs: A`
is now REQUIRED (a conditional rest tuple: `[keyof A] extends [never] ? [options?:
ComponentOptions<P>] : [options: ComponentOptions<P> & { attrs: A }]`), so a
`component<P, typeof attrs>(tag, setup)` that types props as narrowed but never wires the
attrs at runtime no longer compiles; the legacy `A = {}` branch keeps options optional.
(2) *a wrong declaration must never narrow to a lie.* `ComponentAttrs<P>` intentionally
only checks each value is an `AttrDecl` (it does not couple the decl to `P[K]`), so a
mismatch like `'boolean'` on a `string` prop passes `satisfies`; `AttrValueType` applies
the narrowed runtime type ONLY when `NonNullable<P[K]>` is EXACTLY the declared kind —
**mutual assignability, BOTH directions** (`IsExactKind<T, K> = [NonNullable<T>] extends
[K] ? ([K] extends [NonNullable<T>] ? true : false) : false`, tuple-wrapped to compare
`boolean = true | false` whole). A one-way `boolean extends NonNullable<T>` was unsound
(rev pass 2): it still narrowed `boolean | string` to `boolean` (silently dropping
`string`) and the other direction would widen a literal `true`/`1`. Now a partial-overlap
union (`boolean | string` declared `'boolean'`, `number | string` declared numeric), a
literal author type (`true`, `1`), and an outright mismatch (`'boolean'` on a `string`
prop) all fall back to `T` unchanged — a sound refusal, never a false narrow or widen.
The whole registry declares props as exactly `boolean` / `number`, so it narrows as
before (verified: full ui typecheck clean, no cast re-introduced).

**Proof.** Core compile-time proofs in `core/src/component.test-d.ts`: per-kind
narrowing (`boolean`/`number`-with-default/`number`-no-default/`string`/`forward`/
undeclared), a negative block (`@ts-expect-error` that a declared boolean is NOT
`undefined` and a no-default number is NOT a bare `number` — proving no collapse to
`never`), a required-options block (omitting options — or omitting the `attrs` key —
fails when the `A` arg is non-empty; legacy stays optional), a sound-fallback block
(`'boolean'` on a string prop / a numeric decl on a boolean prop refuse to narrow), an
EXACT-KIND block (`boolean | string` / `number | string` unions AND literal `true`/`1`
props all fall back, never narrow/widen — rev pass 2), a backward-compat block (omitting
the type arg keeps `| undefined`), and a validation block (typo key rejected). Runtime
parity in `component.test.ts`: declared defaults make the narrowed types honest
(`checked` → false, `span` → default), a factory-style `_setProp` write sets the narrowed
value, AND the real typed `ComponentFactory` mounts narrowed values end-to-end (present
props land, omitted props fall to their declared defaults). Registry: the `as boolean` / `?? false`
stopgap retired across ~36 files (every migrated boolean/number-with-default root —
switch, the form controls, the overlay `open` roots, the menu families' `disabled`/
`portal`, etc.). The ONLY residual casts are the two genuinely dual-mode value roots —
accordion and toggle-group — whose factory `value`/`defaultValue` are typed
`string | string[]` while the attribute carries a `string`, forcing the single-branch
`as string` (the semantic single-vs-array narrowing no representational type derives).
**combobox is NOT a residual**: its `value`/`defaultValue` are plain `string`
(comma-encoded for multiple), so it is fully migrated with no value cast — the sketch's
three-way framing was narrowed to two at implementation. Full suites green: core 283,
ui 884, plus router/ssg/www; workspace typecheck clean.

**Design sketch — candidate (c): reactive registration helper** (post-checkpoint; NOT
implemented — motivation corpus = `resizable`, currently the SOLE consumer). Pattern: a
child registers a prop-derived value with a context-provided parent collection at mount,
and the registration must stay reactive so a live attr/prop write re-drives the parent's
layout. `resizable` does this by hand — the group stores the panels' prop *signals*
(not their snapshot values) and reflows through a reactive `effect`; the boilerplate is
the per-child `effect(() => parent.set(id, sizeSignal.value))` + `onCleanup(() =>
parent.delete(id))` plus the parent choosing to hold signals. A `reactiveRegistry<T>()`
helper returning `{ register(host, () => T): void; entries: Computed<T[]> }` would run
the effect+cleanup internally and expose `entries` as a reactive computed the parent
reads for reflow, so a child writes `registry.register(host, () => size.value)` and the
parent writes `effect(() => reflow(registry.entries.value))` — the "register a signal-
thunk, not a value" rule enforced by the type instead of by convention. Because
`resizable` is the only consumer today, per the standing second-consumer discipline this
stays a DOCUMENTED PATTERN (the framework skill should gain a `comp-register-signal-not-
value` rule so the next consumer copies it correctly) and graduates to the
`reactiveRegistry` primitive when a second registration-reactive component lands (a
column-sizing grid or a menu typeahead registry are the likely triggers). RECOMMENDATION:
do NOT build the helper pre-checkpoint; document the pattern + the signal-thunk rule now.
**Disposition (2026-07-11, arch)**: accepted as sketched — `comp-register-signal-not-value`
documented in the framework skill (§1); the `reactiveRegistry` primitive stays deferred
until a second registration-reactive consumer lands. **UI-42 closure
(2026-07-12)**: `resizable` now completes the manual pattern: panel cleanup
unregisters mounted membership and bumps the registration version; the parent
tracks both live `defaultSize` and `minSize` signals, with constraint changes
re-clamping the current user layout rather than resetting defaults. This matches
`react-resizable-panels`' mounted-panel membership and live-constraint
conventions while retaining the documented zero-dependency implementation.

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

### 5. SSG microtask settling — FIXED (2026-07-11)

`renderToHtml` snapshotted `innerHTML` synchronously after mount, but ui
relies on microtasks (projection sweeps, command's initial filter pass) —
plain-HTML-authored nested content could be missing from static output.
Factory composition (what demo/www use) was unaffected, which is why it had
not bitten yet.
**Resolution**: `renderToHtml` is now `async` and `await`s `tick()` (§7)
before serializing, so projection sweeps + effects land in the snapshot. Its
sole caller (`build.ts`) already awaited `route.render`; `buildStaticSite`
was already async, so no public-API ripple. Regression:
`build.test.ts > settles microtask work before snapshotting`.

### 6. Portal primitive — FIXED (2026-07-11)

Dialog, sheet, tooltip, popover, and all menus render overlays inline with
`position: fixed` and each documents the same caveat: a transformed/
filtered ancestor becomes the containing block and traps the overlay.
Upstream solves this with portals; the original proposal assumed we could
not reparent cleanly because template disposal ownership is tied to where
nodes were mounted, and asked whether portal had to be a **core** concern.

**Resolution**: that premise proved false — portal did NOT need to be core.
It shipped as a registry **lib** (`lib/portal.ts`):
`portal(ref, {target = document.body, enabled})` moves a subtree on mount
and removes it on teardown. Two facts make lib-level ownership clean:
(a) `TemplateResult.dispose()` only unbinds effects/bindings — it never
removes mounted nodes (those leave with the host on disconnect), so a node
moved out to `<body>` is unreachable by host removal and the portal is its
sole, uncontested owner (captured at mount so a later ref reset can't
strand it); and (b) reactive bindings track their nodes by reference, not
DOM position, so they survive the move. ADR 0023's move-resilience covers
the re-setup hazard — now *verified*, not assumed. Adopted in `dialog`
(portal default on) as the graduation proof, retiring its
transformed-ancestor caveat.
**Proof**: `registry/default/lib/portal.test.ts` — sole-removal ownership,
move-resilience (a moved custom-element subtree's setup stays `1` across
the body move *and* teardown), reactive-binding-inside-portal, multi-portal
stacking with independent removal, teardown removal, outside-setup guard;
`registry/default/ui/dialog.test.ts` — default move-to-body, `portal={false}`
/ `portal="false"` inline, Escape + outside-pointer dismissal and focus
trap/restore intact through the move, no-leak teardown.
Follow-up (adoption): **DONE** (UI-40, 2026-07-12). The original eight
overlay families import `lib/portal.js`: dialog, alert-dialog, sheet,
tooltip, popover, dropdown-menu, context-menu, menubar. The residual audit
diffed every candidate against upstream `new-york-v4`:

- **hover-card — portal adopted**: upstream wraps content in
  `HoverCardPrimitive.Portal`; content now portals by default with the standard
  `portal={false}` / `portal="false"` opt-out.
- **drawer — portal adopted**: upstream Vaul `DrawerPortal` wraps overlay +
  content; the matching wrapper now portals by default with the same opt-out.
- **combobox — portal adopted through PopoverContent**: upstream Base UI uses
  `ComboboxPrimitive.Portal`. The classic Popover + Command composition now
  keeps item identity through captured context + element registration rather
  than querying the combobox host subtree, so filtering, selection events,
  dismissal, and label resolution survive the move. It exposes the same
  inline opt-out.
- **select — intentionally inline/native**: this registry item tracks upstream
  `native-select.tsx`, not Radix `select.tsx`; the browser owns the native popup.
- **toast — intentionally inline**: upstream `sonner.tsx` renders `Toaster`
  directly and declares no portal wrapper; the fixed authored region remains.
- **navigation-menu — intentionally inline**: upstream renders Content and its
  optional Viewport under the root (the viewport's absolute wrapper is not a
  portal). Our documented no-viewport variant remains inline too.

Accessibility follow-up: **UI-43 — FIXED (2026-07-12)**. Upstream cmdk 1.1.1
gives every option a stable ID, tracks the selected item ID, and exposes it
through `aria-activedescendant` on both Input and List (Input also controls the
stable List ID). The zero-dependency `command` now mirrors that contract while
keeping its documented substring filter. Standalone tests cover initial,
keyboard, and empty-filter transitions; combobox proves the references still
resolve when its Command subtree is portaled outside the combobox host.

Known limit: in `@nisli/ssg` static render the
portaled subtree escapes the captured snapshot (client-only, matching
upstream's client-portal behavior); `portal={false}` keeps it in static
output.

### 7. Awaitable flush/tick — FIXED (2026-07-11)

Sequencing after DOM bindings flush required hand-rolled
`queueMicrotask` (focus trap activation after `hidden` flips; test suites'
double-`flushEffects()` idiom for cascades).
**Resolution**: core now exports awaitable `tick()` (drains the effect
cascade AND queued microtask work), and `flush()`/`flushEffects()` loops
until the effect queue is empty so a single call settles a cascade. This
surfaced a latent glitch — a *lazy* computed recompute during an effect's
read re-notified (double-scheduled) that same effect; removed the redundant
`notifyObservers` in `ComputedImpl.update()` (downstream is already scheduled
eagerly by `notify()` propagation on the source change). Proof: the
double-`flushEffects()` idiom retired in `input.test.ts`; new
`signal.test.ts` drain/tick + no-double-run tests. Full sweep of the idiom
across the suite is deferred.

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

### 11. Dynamic tag names in templates — FIXED (2026-07-11)

`html\`<\${tag}>\`` is not expressible — the template parser only handles
static tag names, so registry-driven rendering (www's auto-default previews:
"render the element named by this string") needed an `onMount` +
`document.createElement(tag)` workaround, which bypassed template binding
for that subtree. Found by eng3 building the /ui preview system; flagged by
Goga for tracking.

**Resolution (UI-32 design gate + UI-33 core, 2026-07-11)**: `core` now exports
`el(tagName, props?, children?)` — a runtime element factory returning a
`TemplateResult`, so it composes in an `html` slot
(`` html`${el(tag, { class: cls }, children)}` ``) while the **parser stays
100% static**. `el()` is a separate, programmatic construction path that
**shares `html`'s binding helpers** rather than duplicating them: the
`bindAttribute` setAttribute path was extracted to `bindPlainAttribute` (now
used by both `bindAttribute`'s non-component branch and `el()`), and children
go through the existing `replaceMarkerWithBinding` slot mounter — so `el()`
accepts the full text-slot range (string/number, signals, nested
`TemplateResult`, factory results, arrays) with the same reactivity/disposal.
Props: `class` uses the reactive class binder; every other key is a **plain
HTML attribute** (`setAttribute`, `html`'s boolean/null rules) — NEVER
`_setProp`. `el()` is the "author plain HTML programmatically" primitive: a
framework component tag reached this way receives its values as attributes
and resolves them through its `attr()`/`boolAttr()` fallbacks (typed
composition stays the factories' job). `ref` and `on: { event: handler }` are
supported. v1 is HTML-only — SVG/namespaced tags (`createElementNS`) and a
conditional-class-map DSL are deferred until a real consumer needs them (arch
rulings).
**Proof**: `core/src/el.test.ts` (8 cases: runtime tag, reactive attrs +
boolean/null, ref + events, full text-slot children incl. factory + reactive
signal, `html`-slot composition, the component-tag-uses-ATTRIBUTES contract,
and clean dispose). Consumer: www's `AutoPreview` collapses to
`el(primaryTag(name))` (a follow-up www adoption; the primitive is landed).

### 12. `refetch()` is suppressed by `staleTime` — FIXED (2026-07-11)

`QueryResult.refetch()` incremented the generation and called `doFetch()`,
but `doFetch()` returned fresh cached data first when `staleTime > 0` — so a
manual refetch inside the freshness window never invoked the fetcher. Found
by rev fact-checking www's query docs. Every mainstream data library treats
an explicit refetch as a force; a silent no-op is surprising.
**Resolution** (arch ruling): a manual `refetch()` bypasses `staleTime`'s
fresh-cache suppression (react-query semantics) — but still joins a same-key
in-flight request. Two-stage contract: (1) it skips the fresh-cache
short-circuit, so a refetch inside the freshness window is never a silent
no-op; (2) it does NOT skip in-flight deduplication — if a request for the
same key is already running, refetch joins that promise rather than starting a
second fetch. `doFetch()` takes a `force` flag (set only by the manual
`refetch()` path) that gates only step 1; the in-flight check and the
generation guards are unchanged, so a forced refetch still discards superseded
responses. The automatic (effect-driven) path leaves `force` false and stays
cache-first. Proof: `query.test.ts` — fresh-window manual refetch invokes the
fetcher; a same-key refetch during an in-flight request dedups (fetcher spy
stays at one call) and a superseded response is still discarded; the automatic
path stays cache-first. www's `/docs/query` `staleTime` sentence updated to the
new contract in the same commit.

### 13. Floating-layer transform origin and exit visibility — FIXED (UI-45, 2026-07-12)

The registry copied Radix-derived `origin-(--radix-*-content-transform-origin)`
and closed-state animation classes across tooltip, popover, hover-card,
dropdown-menu, context-menu, and menubar, but `lib/floating.ts` never assigned
the referenced primitive-specific variables. Scale animations therefore used
the element center instead of the anchor-facing edge. Closing also bound
`hidden` directly to `!open`, making the closed state and `animate-out` classes
unobservable for a rendered frame.

**Resolution (UI-45)**: `positionFloating()` now derives the origin from the
post-collision `side` and `align` and assigns the variable selected by the
content's `data-slot`, so root/sub-content and flipped placements share one
mechanism. `floatingHidden()` preserves the existing open signal as the sole
dismissal/focus truth, but keeps a closing element visible when computed CSS
reports a real animation; `animationend` or `animationcancel` then hides it.
No-animation environments hide synchronously, reopening cancels stale close
completion, and disconnect cleanup removes listeners. Menubar's root content
also gains its missing closed-state `animate-out` token.

**Proof**: `lib/floating.test.ts` covers side/alignment origin math, every
primitive/root/sub-content variable mapping, immediate no-animation hiding,
animated end/cancel completion, and stale-close cancellation. The six consumer
suites verify the shared helper integration. A real-browser animation check is
required before the UI-45 landing verdict; happy-dom intentionally exercises
only the no-CSS fallback unless inline animation properties are supplied.

### 14. Registry `aria-invalid` reachability — RESOLVED (UI-44, 2026-07-12)

Tailwind's `aria-invalid:*` variants only activate when `aria-invalid` is on the
same rendered node that carries the class list. Layout-transparent component
hosts therefore cannot own the attribute implicitly. UI-44 inventoried every
registry class owner and applied this disposition:

| Owner | Disposition | Inner class-bearing node | Public invalid-state contract |
| --- | --- | --- | --- |
| `Badge` | **FIX** | `[data-slot="badge"]` span | `BadgeProps.ariaInvalid`; live host `aria-invalid` forwards to the span. |
| `Button` | **FIX** | `[data-slot="button"]` button | `ButtonProps.ariaInvalid`; live host attribute forwards to the button. |
| `Calendar` day and nav button classes | **INTENTIONAL-NONAPPLICABLE** | Individual day buttons and previous/next buttons | Calendar exposes no per-day or per-nav invalid state. Fanning one root value across unrelated controls would assert false ARIA semantics. The tokens come from generic upstream button styling; a future per-day validity API must bind only the affected day button. |
| `Checkbox` | **FIX** | `[data-slot="checkbox"]` native checkbox | `CheckboxProps.ariaInvalid`; live host attribute forwards to the input. |
| `Input` | **FIX** | `[data-slot="input"]` native input | `InputProps.ariaInvalid`; live host attribute forwards to the input. |
| `InputOTPSlot` | **REACHABLE** | `[data-slot="input-otp-slot"]` div | Existing `InputOTPSlotProps.ariaInvalid` reference implementation already forwards factory and live host state. |
| `RadioGroupItem` | **FIX** | `[data-slot="radio-group-item"]` native radio | Item-level `ariaInvalid`; the group root does not mark every option invalid. |
| `Select` | **FIX** | `[data-slot="native-select"]` native select | `SelectProps.ariaInvalid`; live host attribute forwards to the select. |
| `Textarea` | **FIX** | `[data-slot="textarea"]` native textarea | `TextareaProps.ariaInvalid`; live host attribute forwards to the textarea. |
| `Toggle` | **FIX** | `[data-slot="toggle"]` button | `ToggleProps.ariaInvalid`; live host attribute forwards to the button. |
| `ToggleGroupItem` (inherits `toggleVariants`) | **FIX** | `[data-slot="toggle-group-item"]` button | Item-level `ariaInvalid` only. The group root has no invalid-state context and does not fan out or override item state. |

Every fixed prop uses a declared boolean `ariaInvalid` attribute fallback and
binds `aria-invalid="true"` (or omits it when false/absent) on the inner owner.
Factory-prop and post-mount `setAttribute` regressions cover every fixed public
surface, including the item-vs-root toggle-group boundary.

### 15. Tooltip arrow parity — RESOLVED (UI-46, 2026-07-12)

The Nisli tooltip omitted new-york-v4's `TooltipPrimitive.Arrow`, because the
shared zero-dependency floating helper positioned only the content box. That
left a visible parity gap even though tooltip portal, presence, and collision
behavior were otherwise complete.

**Resolution (UI-46)**: tooltip content now appends the upstream arrow SVG DOM
and byte-identical class string after its projected children. `floating.ts`
accepts an optional arrow element and positions it on the anchor-facing edge
chosen after collision handling. Cross-axis placement follows the anchor's
center after content alignment/viewport clamping, then clamps the arrow inside
the content corners. A side-dependent transform counteracts the upstream
class's constant 45-degree rotation before orienting the SVG polygon tip toward
the anchor. Scroll/resize updates and the existing disposer cover content and
arrow together; portal moves and exit-presence remain reference based and
unchanged.

**Proof**: pure math covers all four sides plus align-axis and corner clamps;
DOM wiring covers collision-flip edge updates and listener teardown; tooltip
factory and plain-element tests assert the SVG/class contract and portal
cleanup. The production www browser proof opens the real hydrated tooltip and
checks compiled size/background/rotation plus edge and anchor geometry.

## Process

New friction found while building ui/www lands here first (PR review may
append). Graduation path: item gets its own ADR + implementation when
accepted; this tracker records the disposition either way.
