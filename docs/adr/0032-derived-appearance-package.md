# 0032. Derived Appearance — A Fifth Package for Intent-Declared UI

**Date**: 2026-08-25
**Status**: **Withdrawn** (2026-08-27) — the package it decided was withdrawn from main on 2026-08-27. The code lives on the `intent-archive` branch; the reasoning is in [`docs/research/nextgen/AUDIT-2026-08-27.md`](../research/nextgen/AUDIT-2026-08-27.md). Kept so the number is not reused.
**Depends on**: [0019-minimal-runtime-and-native-platform-alignment](./0019-minimal-runtime-and-native-platform-alignment.md), [0022-nisli-ui-component-library](./0022-nisli-ui-component-library.md), [0029-agent-native-ui-strategy](./0029-agent-native-ui-strategy.md), [0030-agent-native-authoring](./0030-agent-native-authoring.md), [0030.2-agent-native-core-ergonomics](./0030.2-agent-native-core-ergonomics.md)
**Evidence**: [`docs/research/nextgen/`](../research/nextgen/) — 13k lines of
primary-sourced prior art and measured coverage audits; working prototype in
[`experiments/c11-appearance`](../../experiments/c11-appearance/)

## Context

### The thesis

**React made structure a function of state. This proposes making appearance a
function of meaning.** Same shape of move, one layer down — and it is the layer
where an AI is blind.

An agent writing UI code cannot see what it made. Every other class of mistake
it makes is caught by a machine in seconds: a typo, a type error, a failing
test. Appearance mistakes — text clipped, a panel three pixels off the edge, an
invisible button, an under-sized tap target — are caught only by a human looking
at a screen, hours later, if at all. Nothing tells the author anything.

So: take every decision that requires eyes away from the author, and make the
engine derive it. Components declare what a thing **is**
(`data-appearance="action"`, `data-role="primary"`, `data-text="title"`), how it
**composes** (`data-layout="row"`, `data-grow`), and what matters **least**
(`data-priority`, `data-collapse`). A resolution table — plain CSS custom
properties and container queries — derives every value from one inherited
`--unit` plus the context the element sits in. Because appearance is *derived
from a declaration* rather than typed by hand, it is also **checkable**.

### What is measured, not asserted

A working prototype exists (`experiments/c11-appearance`, ~5k lines, nine
commits). Its numbers:

- **240 of 240 context combinations clean** in real Chromium — 4 pages × 3
  densities × 2 input modes × 2 themes × 5 widths — across seven independent
  assertion paths, with a `--self-test` proving every path *can* fail before the
  run is trusted.
- **Zero pixel values, colours, breakpoints, media queries, class names or size
  props** in 51 files, proven mechanically by `proof/no-values-guard.mjs`, which
  also reports that it still matches 120 length and 34 colour literals inside
  `src/theme/` so it cannot pass vacuously.
- **One `--unit` produces every value.** comfortable 4px→36px controls, compact
  3px→27px, dense 2px→18px, touch ×1.25→45px. Axes compose. Same component
  source in every row.
- **One component, four contexts, no breakpoints.** A message row correct in a
  1200px page, a 320px sidebar, a 380px touch phone and a 640px dense list,
  degrading in the exact order declared: timestamp truncated first, secondary
  actions to an overflow menu, Reply never lost.
- **The measured tier is ~35 lines** including lifecycle. Registering it in a
  component is one line.

### How much of CSS this actually covers

Seven coverage audits, each measured in real Chromium against a static probe,
classified **278 capabilities**:

| verdict | meaning | count | share |
|---|---|---|---|
| **D** | derived automatically from declared intent | 133 | 47.8% |
| **T** | authored once in the table, never per callsite | 87 | 31.3% |
| **L** | leaks to a per-callsite decision | 45 | 16.2% |
| **X** | needs raw CSS through the declared escape hatch | 13 | 4.7% |

**79.1% is derived or authored once.** That is the defensible form of "the
layout just works": a count with probes behind it, not a slogan. The 20.9% that
leaks is named, per capability, in the audits.

### The ground is unoccupied, and that is checkable

- **v0's published repair pipeline is entirely syntactic** — import rewriting,
  icon-name snapping, missing dependencies, JSX repair. Zero geometric,
  contrast or overflow checks. Its stated goal is "a working website instead of
  an error or blank screen".
- **shadcn's agent-facing `get_audit_checklist` returns six items** — five
  compile-time, one "use the Playwright MCP if available".
- **The industry's only working appearance oracle is human**: UI-Bench's 4,000+
  expert pairwise judgements with TrueSkill. The organisation with maximum
  incentive to automate "is this UI good" built a human oracle instead.

Nobody checks appearance because nobody *can*. A hand-picked number carries no
claim to check against.

### The counter-evidence, which narrows the claim

Four findings from the prior-art passes that the decision below is shaped
around rather than shaped despite:

1. **Declarative appearance is already shipped by someone else.** Shopify's
   Polaris Web Components (`<s-button>`, 2025-10-01): *"the CSS can't be altered
   or overridden"*, `variant`/`tone` default to `"auto"` meaning
   determined-by-context, heading prominence derives from nesting depth, and
   there is no `size` prop. What it lacks is any way to author a **new** semantic
   role, any fit solver, and any checker. So exclusivity-plus-derivation is
   table stakes with a precedent, and the differentiator narrows to exactly
   three things: **author-defined roles, measured fit, and verification.**
2. **Aesthetic quality is not measurable, and this is settled.** Best published
   predictors ceiling at adj. R²≈.48 (Reinecke, CHI 2013) and 49%/32%
   (Miniukovich, CHI 2015). The canonical "these are good" reference class —
   Webby winners — itself spans means of 4.21–6.57 on a 9-point scale with
   average SD 1.69, so no consistent label exists to train on. Symmetry and
   balance were *pruned* from those models by backward elimination.
3. **Models disobey styling constraints that oppose their training defaults.**
   arXiv 2604.07192, 11 models, 830+ invocations: "use CSS Modules" failed 17/21
   (81%), "no inline style" failed 19/21 (90%), and 36 of 47 total failures were
   CSS default-bias. Encoding form was irrelevant (Δ 0.3pp) — prompting does not
   fix it. Only a *type or gate* constraint does, and even then the failure
   relocates to the escape hatch.
4. **Deriving everything from one unit is not automatically self-consistent.**
   Adobe tried and abandoned it: Spectrum declares
   `--spectrum-global-dimension-scale-factor: 1`/`1.25` and then never
   references it — zero `calc()`, 136 of 169 values hand-typed, two duplicated
   tables. The prototype hit the same wall as finding F9 and answered it with a
   consistency check on the table rather than by giving up.

### And two findings that make the bet stronger than its sketch

- **Contrast becomes structurally impossible, not checked.**
  `contrast-color(var(--surface))` swept over 729 sRGB surfaces holds a minimum
  of **4.585:1 with zero below 4.5**; re-verified at 4,913 surfaces, matching
  the closed form at the L=0.1791 tie point. The defect class is *deleted*. It
  does not depend on that function shipping either: a pure-CSS WCAG-luminance
  expression using `pow()` inside relative colour syntax holds the same floor,
  0 of 4,913 below.
- **The context model has no portal hole.** A popover and a modal dialog reached
  through two `display: contents` hosts inside a dense+touch+dark 600px
  container inherited `--unit`, theme, **and both container size and style
  queries**, with `100cqi` resolving to the container rather than the viewport —
  byte-identical to the in-flow control on seven readings. The inheritance-based
  derivation model survives the top layer, which was its single largest
  unexamined risk.

## Decision

### 1. A fifth public package, and core stays barebones

`@nisli/core` remains the minimal reactive runtime — independently usable, zero
runtime dependencies, no CSS, under the ADR 0030.2 byte ceiling. The new package
is a **permanent peer**, not a staging area: work may stabilise there forever.
Graduating a primitive into core stays possible and is not the package's
purpose.

The dependency is **bidirectional by design**: core may gain seams specifically
so the peer can do more. The prototype hand-rolled `ResizeObserver` wiring and a
host walk; under this decision those are *missing core hooks*, not scaffolding,
and asking for them is legitimate.

### 2. The charter is every decision that requires eyes

One boundary test, which cuts cleanly against core and against ADR 0029:

- **In**: appearance derivation, the fit pass, verification, `explain()`
  provenance, **declared attention**, and **declared state space**.
- **Out**: data fetching and cache policy — core's `query`/`resource` already
  own those, and they require no eyes.
- **Out**: agent protocols, machine-legible manifests, MCP/AG-UI bridging — ADR
  0029 owns those, and answering the same question twice is the mistake this
  repository has explicitly avoided elsewhere.

**Attention is in scope as structure the author declares and the engine
enforces, and out of scope as quality the engine judges.** That split is forced
by finding 2 above. The existence proof that the enforceable half is real: the
GNOME HIG states normatively that *"each view should only ever include a single
button using either the suggested or destructive styles"* — unenforceable
against `class="bg-blue-600"`, because that string names a colour, and a
two-line check the moment `data-role="primary"` is declared. Shipped as N700.

Two rules are **forbidden** on evidence: Hick's law (CHI 2020 shows it argues
for showing *more* items per page) and APCA (licence-blocked — patent pending,
commercial use prohibited without a signed agreement).

### 3. Engine importable, components copy-in

The engine — vocabulary contract, resolution table, fit solver, checker,
`explain()` — ships as a real import. Components reach users as **copy-in
source via a CLI**, matching the ADR 0022 precedent that `@nisli/ui` already
establishes: `registry/` in `files`, only the CLI compiled to `dist`.

Answering "how do components reach users" a second way would create a second
convention beside an accepted one. Exclusivity is therefore enforced by a
**gate over source the author owns**, not by an import boundary — which is what
the prototype actually demonstrated across 51 files.

Note the measured limit: **enforcement leaks about 15%**, on the enforcers.
Primer ships stylelint rules forbidding raw values and carries 502 checked-in
`stylelint-disable` lines across 203 CSS modules, with 572 raw px against 3,257
token references. A zero-escape registry is a marketing number; a *reported*
escape is an engineering one, which is why the escape hatch reports itself
(N601) rather than being forbidden.

### 4. Three tiers, and tier 3 stays small

| tier | who solves it | scope |
|---|---|---|
| static, zero runtime | CSS custom properties + container queries | density, rhythm, type scale, colour, elevation, radius — SSG pre-solvable |
| the browser's own solvers | flex, grid, `clamp()`, `text-wrap`, `field-sizing`, anchor positioning + `position-try` | it is already a solver; stop fighting it |
| measured, bounded | ~35 lines | discrete choices only: what collapses, truncates, moves to a menu |

**This is not a layout solver in JavaScript**, and the graves are marked. Grid
Style Sheets shipped Cassowary in the browser in 2014 and is an archived
repository whose own issues asking *"is this dead?"* were never answered.
Flutter's architecture document rejects constraint solving by name — *"O(N²) or
worse (for example, fixed-point iteration in some constraint domain)"* — and
documents its one speculative-measurement widget as *"avoid using it where
possible"*. Tier 3 stays ~35 lines or it becomes GSS.

Tier 2 is **under-used, not over-used**. `position-try-fallbacks` +
`position-try-order` shipped in all three engines with a richer model than our
`data-collapse`, and rewriting the overflow menu onto `popover` +
`command`/`commandfor` + derived placement is a **net deletion** of ~35 lines of
authored geometry and ~20 lines of TypeScript, with implicit `aria-expanded`,
Escape-plus-focus-restore and light dismiss arriving free.

Everything resolves to native output: `data-*` attributes, custom properties,
`@container`, real custom elements. No virtual DOM, no runtime style injection,
no generated class names. **The static tier needs no JavaScript at all**, so it
is correct with scripting disabled and correct in pre-rendered output.

### 5. A rule earns build authority by proving it can fail

The gate must be on by default and fail the build like a type error, or it
becomes one more optional tool nobody runs. But authority is **per rule, and
earned**: a rule may break a build only once it ships a falsification fixture
demonstrating it catches its own defect. `--self-test` is promoted from a
nicety to the admission criterion.

The reason is measured, not philosophical. The prototype produced **six oracle
bugs against four page bugs**:

| # | the checker's mistake | cost |
|---|---|---|
| F4 | measured unrendered nodes as 0×0 | 10 false failures |
| F8 | a container-only overflow test cannot see a crush | buttons visibly overlapped while it reported `settled` at 318/318 |
| — | N670's first version was anti-correlated with its own defect | fired when children escaped, silent when they collided |
| — | N650 measured the padding box; a hit target is the border box | 710 false findings |
| — | N690 repeated that mistake *inside the rule written to prevent it* | caught by the matrix on its first run |
| — | N700 shipped **dead** — its selector spelled a word the vocabulary does not contain | matched nothing, reported a clean page, and every net agreed |

The last one is a distinct class and it forced a second guard: unit tests passed
because fixtures and selector were invented from the same wrong assumption; the
240-cell matrix passed because a rule matching nothing produces no findings;
`tsc` passed because a selector is a string. **Silence read as success.** So
`AXIS_ATTRS` reifies which attribute declares which axis and a reachability test
asserts every selector addresses an attribute the codebase produces and a value
the axis allows.

The corollary is now a house rule, stated in the code: **a check must measure
the box its claim is about, and a check that cannot measure must say so rather
than pass.** `Box` (padding, containment claims) and `Bounds` (border, origin,
pressability claims) are distinct types so the confusion is a compile error, and
`out.undecidable()` gives every rule one way to admit defeat.

### 6. The table checks itself

"The framework checks the UI" has a second half: **the framework checks the
table.** Two independent lines of evidence:

- **F9** — a resolution table can state an *impossible* constraint. A grid track
  derived its minimum from `--unit` so it shrank with density, while content
  floors declared in the same table did not; at dense/320 the table sized a
  track at 62px of usable space and simultaneously demanded a 76px control
  inside it. Dense, the context whose whole job is fitting more in less, was the
  only one that overflowed.
- **Silent rejection** — a table can state a *rejected* constraint.
  `overflow-clip-margin: calc(var(--unit) / 2)` is silently rejected by
  Chromium and computes to `0px`; `overflow-y: clip` beside `overflow-x: auto`
  computes to `hidden`. The value looks derived, the values guard sees no
  literal, and the declaration does nothing.

Both are success-by-silence one layer below the rules, inside the 40% of the bet
the table represents.

### 7. Diagnostic codes must be allocated against core's registry

Core pre-allocates diagnostic ranges **by owner module**
(`packages/core/src/diagnostics.ts`). The prototype's `N601`–`N690` sit inside
core's reserved `N6xx` async range, `N601` is a number core explicitly retired
with *"The number is not reused"*, and `N7xx` is claimed without an entry in
core's table. **Allocate the peer range in core's registry and renumber before
anything publishes.** The prototype's own registry calls recycling a number
"worse than a gap"; the same standard applies to squatting one.

### 8. The name is `@nisli/intent`

**Decided.** The package lives at `packages/intent/` and is `private: true`
until publishing is a deliberate, sequenced act.

`@nisli/engine` was proposed and then **overturned by its own collision
search**: `engine` is already three unrelated nouns in this repository — the
router's public API (`NavigationEngine`, `EngineSink`, `createEngine`, and the
documented option `defineRouter(catalog, { engine })`), core's own "template
engine", and "engine" meaning *browser* engine, including inside a user-visible
`N107` throw. `@nisli/next` has zero code collisions and was wrong only because
it implies temporary, which the permanent-peer framing makes false.

`@nisli/intent` has one collision, the suffixed `ViewTransitionIntent` type, and
it is the only candidate that covers all three charter items — appearance,
attention and declared state space are each a declaration of intent. It also
names the author's side of the seam rather than the machinery's, which is the
right emphasis for a package whose entire pitch is that you declare meaning and
stop choosing values.

Recorded because it will be asked: the name was free to change until first
publish and is impossible after, since npm cannot rename. `private: true` is
what keeps it free while the API settles, and removing that flag is the
irreversible step — not creating the directory.

## Invariants

1. No `className`, no `size` prop, no value outside the resolution table — and
   the escape hatch reports itself rather than being forbidden.
2. Every value in rendered UI derives from one inherited unit plus the element's
   declared role and its context.
3. No JavaScript participates in the static tier.
4. Tier 3 stays a bounded loop over a declared priority list. Never a
   constraint system.
5. A rule breaks a build only if it ships a fixture proving it can fail.
6. A check measures the box its claim is about; a check that cannot measure
   reports undecidable rather than passing.
7. Diagnostic codes are append-only and allocated against core's registry.

## Consequences

**Positive.** The framework gains the one capability no incumbent offers: it can
tell an author their UI is wrong before a human looks at it. Determinism buys
five things at once — checkable, enumerable, explainable, portable,
pre-solvable — none of which is available over a hand-picked number. Past
investments re-price: 0019's minimalism becomes the reason core can stay
barebones while the peer carries ambition; 0022's copy-in registry becomes the
distribution precedent; 0029's surfaces become where this renders.

**Risks, owned.**

- **The vocabulary may not close.** If the docs nav, a transcript, a data table
  and a marketing hero need more than ~30 attributes, derivation covers only
  the easy 60% and the pitch is dishonest. Measured so far: 79.1% of 278
  capabilities, with the leaks named.
- **The table must be genuinely beautiful.** Derivation produces consistency;
  beauty is authored. The prototype's own first run resolved an avatar to 16px
  — "perfectly consistent, visually wrong" — and needed authored floors.
  Consistency is derivable; taste is not.
- **The checker's truthfulness is the expensive half.** Six oracle bugs to four
  page bugs. Affordable, but only because the checker is debuggable.
- **The training-corpus problem is real** and relocates rather than vanishing: a
  type or gate constraint beats a prompt, but the escape hatch becomes the
  pressure point, and it threatens the *velocity* claim specifically.
- **A fifth package couples releases.** Each matrix job runs repository-wide
  build and test before publishing, so a slow suite in the new package delays
  core's, router's, ssg's and ui's releases.
- **About 40% of the bet can never be core-shaped.** The resolution table is
  CSS and core ships none. Fine under the permanent-peer framing, and recorded
  here as a decided constraint rather than an accident someone rediscovers.

## Open questions

1. **The name** (§8) — a now-decision.
2. **Does the state sweep find defects the context sweep misses?** If zero, the
   third charter item dies. Under measurement.
3. **SSG pre-solve.** Untested, and it is what makes first paint correct rather
   than corrected. The measured flash-of-unfit is **zero composited frames**
   client-rendered but **9–10 frames / 69–87ms** on a 100ms hydration budget.
4. **The byte budget.** `solve()` + `fit()` has never been measured min+gzip
   against core's ceiling, and the ceiling itself is documented as future tense
   with no CI step.
5. **Where the 8 primitives and 5 patterns live** — importable contradicts ADR
   0022; the registry obeys it but puts them where a consumer can delete
   exclusivity on day one.
6. **Cross-engine.** Chromium only so far. Firefox and WebKit unmeasured.

## References

- Evidence: [`docs/research/nextgen/`](../research/nextgen/) —
  [`NORTH-STAR.md`](../research/nextgen/NORTH-STAR.md),
  [`PRIOR-ART/`](../research/nextgen/PRIOR-ART/) (6 slices),
  [`COVERAGE/`](../research/nextgen/COVERAGE/) (7 audits),
  [`NEXTGEN-SCRATCHPAD.md`](../research/nextgen/NEXTGEN-SCRATCHPAD.md)
  (iteration log, candidates C1–C11, kill criteria).
- Prototype: [`experiments/c11-appearance`](../../experiments/c11-appearance/).
- Related: [0029](./0029-agent-native-ui-strategy.md) (where agentic UI runs),
  [0030](./0030-agent-native-authoring.md) (agents as the author),
  [0030.2](./0030.2-agent-native-core-ergonomics.md) (core ergonomics and the
  byte ceiling), [0022](./0022-nisli-ui-component-library.md) (copy-in
  distribution), [0019](./0019-minimal-runtime-and-native-platform-alignment.md)
  (minimal runtime).
