# motion and transitions — intent coverage audit

**Date**: 2026-08-25 · **Kind**: coverage audit, measured where marked
**Slice**: whether *appearing, dismissing, reordering, resizing and re-densifying*
can be derived from declared intent and observed lifecycle, such that no author
ever writes a duration, an easing curve, or a keyframe — and what the
prototype's unmeasured "flash of unfit" actually costs in frames and pixels.
**Baseline**: `experiments/c11-appearance` (240/240 clean)

## Coverage in one line

D 9 · T 13 · L 3 · X 1 — of 26 capabilities audited.

**The straight verdict asked for: motion is T, not L.** Motion is *table*, and
the table is one page long. The *kind* of motion is derivable (the engine
observes the lifecycle event: entered, exiting, moved, re-derived), the
*magnitude* is derivable (from the same `--unit` and the measured distance), and
the *duration and easing* are one authored table rule for the whole app —
already present as `--motion` at
`experiments/c11-appearance/src/theme/tokens.css:35`. An author writes nothing.
The irreducible L is **three items wide and it is signature, not mechanism**:
brand choreography, spring parameterisation, and arbitrary scroll-linked
staging. Motion is not "irreducibly art direction"; *one page of it* is, and it
is the same page that already holds the type ramp and the colour table.

The prototype's own claim is not yet true, though. `tokens.css:33-34` says
motion "lives here so that a reduced-motion context becomes a fourth axis
setting one token" — and a grep of `experiments/c11-appearance/src/` for
`prefers-reduced-motion` returns **zero matches**. The axis was designed and
never installed. Measured cost of installing it: one line (§Measured probes,
probe 11).

## The leaks, first

### L1 — Signature motion. The one thing the table cannot derive, only *hold*.

`--motion: 0.12s` and a cubic-bezier are a *choice*, and the same choice is what
makes a product feel like itself. Derivation can produce duration from distance
(`duration ∝ √distance`, Material's own rule) and easing from direction
(decelerate on enter, accelerate on exit), and that is enough to be *correct* —
but "correct" is the thing every framework already achieves and nobody
remembers. What breaks: nothing functional; the app moves consistently and
anonymously.

Why intent cannot reach it: there is no observable that distinguishes "this
product should feel crisp" from "this product should feel soft". It is not a
property of the element, the context, or the measurement.

Cheapest honest option: **table rule, one line, declared as a leak.** Exactly
like `--min-avatar: 20px` at `tokens.css:52` — the prototype already has a
precedent for "the value taste had to overrule the function", and motion
personality belongs in that same block with the same comment. Do **not** add a
per-callsite declaration for it.

### L2 — Spring and physical motion. Expressible, not derivable.

CSS `linear()` easing can encode a spring to arbitrary fidelity, so this is not
an X. But the parameters (mass, stiffness, damping) are a feel decision, and —
measured, probe 10 — an overshooting curve is **not free**: an easing that
overshoots on the density axis made the fit solver's degradation set oscillate
4 → 3 → 2 → 3 hidden candidates inside a single 300ms transition. A candidate
that vanishes, returns, and vanishes again is a visible flicker, and no
screenshot test in the 240-cell matrix could ever catch it.

Cheapest honest option: table rule **plus** a hysteresis policy in the solver
(N712 below). A spring on a *context axis that the measured tier observes* is
categorically more dangerous than a spring on opacity, and the table must be
allowed to say so per-property, not globally.

### L3 — Arbitrary scroll-linked choreography.

`animation-timeline: scroll()` and `view()` both work today (measured: the
scroll-linked bar progressed `scale: 0 1` → `1` under real scrolling). Two uses
are derivable from intent and are counted as D: a progress indicator
(`scroll()` over the nearest scroller) and reveal-on-enter (`view()`). Everything
else — parallax layers, pinned sections, scrub-through storytelling — is a
composition an author invents. What breaks: nothing; the capability is simply
absent from the vocabulary.

Cheapest honest option: **escape hatch**, and let it report itself. The existing
`[data-escaped]` mechanism (`states.css:161-164`, N601) is exactly right here,
and a scroll-driven escape has one extra property worth noting: it is invisible
to the reduced-motion oracle (§N711), because a scroll timeline's computed
duration is not a number. Measured: probe 9's `#bar` reported
`duration: <non-numeric>` and the duration-based oracle **silently excluded it
from the offender list**. An escape hatch that also blinds a check must be
reported at `incomplete`, never at pass.

### X1 — Raw `@keyframes` with hand-authored percentage stops.

A logo animation, a game-like flourish, an illustration. Not expressible as
intent at any grain; it *is* the artefact. Declared escape, N601, unchanged.

## Capability table

| capability | CSS today | verdict | intent declaration | notes |
|---|---|---|---|---|
| state feedback (hover/press/focus/selected) | `transition: background-color …` | **D** | none — `data-appearance`/`data-role` already imply it | already live at `roles.css:89-92`, `roles.css:208-210`; the only two transitions in the prototype |
| duration value | `120ms` | **T** | none | `--motion` token, `tokens.css:35`; one rule, whole app |
| easing curve | `cubic-bezier(…)` | **T** | none | one token beside `--motion`; the prototype has none yet (UA default `ease`) |
| distance-proportional duration | per-callsite maths | **T** | none | `calc(var(--motion) * f(distance))` — distance is already measured by the fit pass |
| entry animation | `@starting-style` | **D** | none — the engine knows the node just entered | measured: opacity 0 → 1 from `display: none`, zero JS |
| exit animation | `transition-behavior: allow-discrete` | **T** | none | one rule per removal attribute: `[data-collapsed]`, `[data-hidden]`, `[data-overflow-menu]` (`states.css:24,39,120`) |
| top-layer exit (popover/dialog) | `overlay … allow-discrete` | **T** | none | measured supported in Chromium 151; Safari lacks `overlay` allow-discrete → instant exit fallback, not breakage |
| revealing skipped content | `content-visibility` + allow-discrete | **T** | none | measured: `hidden → visible` flips at 0% on entry, holds `visible` for the full exit, then flips |
| disclosure to `height: auto` | `interpolate-size: allow-keywords` / `calc-size(auto, size)` | **T** | none | measured animating: 0 → 64.6px mid → 80.6px end. **The classic quirk is gone** — one inherited root rule, no JS measuring, no max-height lie |
| reorder / move within a list | same-doc VT + `view-transition-name: match-element` | **D** | none — identity-keyed by the element | already live at `packages/www/src/styles/view-transitions.css:41-44` |
| page navigation motion | `@view-transition { navigation: auto }` | **T** | build flag | already emitted by `packages/ssg/src/view-transitions.ts:58` |
| direction-aware navigation motion | `:active-view-transition-type()` | **D** | none — the router derives `forward`/`back`/`reorder` | `packages/router/src/router.ts:428-437`, types from a nav predicate |
| view-transition tuning (pseudo durations) | `::view-transition-group/old/new` | **T** | none | `packages/www/src/styles/view-transitions.css:11-15,48-55` |
| indeterminate/loading motion | `@keyframes` + `animation` | **T** | one engine-owned keyframe set | author declares a *state*, not an animation |
| layering engine motion over engine motion | `animation-composition: add` | **T** | none, engine-internal | measured additive: `translate: 10px` + keyframe `20px` → `30px` at end |
| stagger of a list entry | per-item `animation-delay` | **T** | none | derivable from item count and one budget token: `clamp(budget/count, min, max)` |
| scroll-linked progress / reveal-on-enter | `animation-timeline: scroll()` / `view()` | **D** | `data-progress`, `data-reveal` (2 values, enumerated) | measured working; both are *intents*, not choreography |
| arbitrary scroll choreography | `scroll()`/`view()` + hand keyframes | **L** | — | see L3; escape |
| signature/brand motion | authored curves | **L** | — | see L1; one table decision |
| spring / physical motion | `linear()` easing | **L** | — | see L2; interacts with the solver |
| reduced-motion compliance | `@media (prefers-reduced-motion: reduce)` | **D** | none | measured: one token override neutralises every derived transition and creates **no animation object at all**; the escape still reports |
| compositing hints | `will-change` | **D** | none | the engine owns every animation, so it can scope `will-change` to exactly the animation's lifetime. `[INFERENCE]` — not measured here |
| animating the derived unit (density crossfade) | `@property` + `transition: --unit-base` | **D** | none | measured: 36px → 18px control height, monotone, from **one** transition declaration on the token |
| motion of a solver degradation | — | **T** | none | table states "degradations do not animate", plus hysteresis; see L2 and N712 |
| flash of unfit | — | **D** | none | measured; eliminated by scheduling, not by authoring. See §2 |
| raw keyframes | `@keyframes` | **X** | `data-escaped` | N601, unchanged |

## Measured probes

**Probe file**: `experiments/coverage/06-motion.html` (plain HTML + CSS, no npm,
no dependency changes — the mechanism under test *is* plain CSS).
**Browser**: real Chromium 151.0.0.0 headless, macOS arm64 (M5), `file://` URL,
1100×900. Frame cadence measured at **≈8.3ms (≈120Hz)** from rAF timestamps —
every frame count below converts at that rate.
**Entry points**: `window.runFit()`, `probeStartingStyle()`, `probeAutoSize()`,
`probeUnit()`, `probeComposition()`, `probeScroll()`, `probeViewTransition()`,
`probeReducedMotion()`, `probeReduceTable()`, `probeThrash()`, `probeSupport()`.

### Probe 1 — the flash of unfit, quantified (the required measurement)

**Method.** A faithful miniature of the prototype: `structure.css`'s row plus
the no-crush block, `roles.css`'s derived control, and `solveFit()` reduced to
one strategy (priority-ordered `hide`). Eight actions in a 360px container that
needs 673px, so four must be spent. Each cell runs in **its own srcdoc iframe**
— its own first paint, its own rAF clock, its own layout-shift stream — and the
cells differ in **exactly one variable: when the solve is scheduled.** Two
layouts, because they are not the same defect: `row` (nowrap, the prototype's)
overflows *sideways*; `wrap` collapses from three lines to one, so content below
*moves*.

Four independent instruments: (a) the UA's `LayoutShift` stream, (b) rAF-entry
geometry snapshots, (c) post-frame snapshots taken from a `setTimeout(0)` queued
inside the rAF callback — i.e. what the frame actually composited, (d) paint
timing from `performance.getEntriesByType('paint')`. Plus a liveness heartbeat,
for the reason in the defect list below.

**Numbers** (two full 12-cell runs; ranges are the spread across runs):

| regime | when the solve runs | first paint | solve | composited unfit frames | visibly wrong for | worst delta | CLS |
|---|---|---|---|---|---|---|---|
| R1 client-sync | DOM built and solved in one task | after solve | 7–39ms | **0** | **0ms** | 0px | 0 |
| R2 ssg, deferred module | parse → module, no network | 52–68ms | 7–38ms | **0** | **0ms** | 313px / 88px *(unpainted layout only)* | 0 or **0.1438** |
| R3 ssg, +1 frame | solve in a rAF | 52–68ms | 24–40ms | **0–1** | 0–8.3ms | 313px / 88px | 0 or 0.1438 |
| R4 ssg, 100ms hydration | solve after a 100ms budget | 52–60ms | 125–139ms | **9–10** | **69–87ms** | **313px** / 88px | 0 or 0.1438 |
| R5 falsification, 400ms | solve after 400ms | 52–68ms | 426–439ms | **44–46** | **368–387ms** | 313px / 88px | 0 or 0.1438 |
| R6 render-blocking | parser-blocking script after the markup | after solve | 22–36ms | **0** | **0ms** | **0px — never existed in any state** | 0 |

**The answer, plainly.**

1. **For the prototype as it stands, the flash of unfit is zero frames.** It is
   client-rendered: the DOM is created and solved inside one task (R1), so no
   frame boundary exists between insertion and solve. The README's top unproven
   risk (`README.md:220-221`) is, for that architecture, **a relief, not a
   200ms problem.**
2. **For the SSG path this repo actually ships, the flash is real and is exactly
   hydration latency.** At a 100ms budget: **9–10 composited frames, 69–87ms of
   a row overflowing its container by 313px** — four actions painted outside the
   box and clipped away, or in the wrap layout the content below sitting 88px
   too low. At 400ms: 44–46 frames. The relationship is linear in latency; there
   is no fixed cost and no ceiling. Screenshots of the mid-flight and settled
   states were captured for the R5 cells and show the row losing four actions off
   the right edge, and the wrap cell three lines tall instead of one.
3. **R2 is a race, not an invariant.** The deferred-module solve beat first paint
   by ~20ms locally with zero network — but the *unfit layout still existed*
   (worst delta 313px/88px) and, in the busier 12-cell runs, Chromium recorded a
   layout-shift entry for it. R3 (one frame later) composited an unfit frame in
   1 of 2 runs. Under a real network fetch for a hashed JS chunk, R2 becomes R4.
4. **R6 makes it an invariant, and it is one line of scheduling.** A
   parser-blocking classic script placed immediately after the fit container
   solves before the document can paint: zero composited unfit frames, and —
   unlike R2 — the unfit geometry **never existed in any measured state at all**,
   which also removes the phantom CLS entry. The prototype's ~35-line solver is
   small enough to inline; that is the whole fix, and it is a build-time property
   the engine controls, not something an author can get wrong.

**Three instrument defects, all found by the falsification fixture, all of the
exact class the README warns about — and two of them were mine.**

- **CLS is unusable as the flash-of-unfit oracle, in both directions.** It
  reported **0** for the R5 row cell with **46 visibly wrong frames and a 313px
  overflow** — correct, and useless: a nowrap row's unfit state overflows
  sideways and moves nothing, so there is no shift to score. And it reported
  **0.1438 for R2, where nothing was ever painted wrong** — a shift computed
  between two layouts, the first of which never reached the compositor. Worse:
  the score is **identical (0.1438) whether the flash lasted 0ms or 387ms**,
  because CLS measures magnitude and not duration. Three independent reasons the
  platform's own metric cannot express this defect. A new instrument is required,
  and this probe is it.
- **A rAF-entry snapshot is not proof that a frame painted.** My first version
  counted "2 painted unfit frames" for R3 that were never composited: the solver
  ran in a *later rAF callback of the same frame*, so the frame the compositor
  produced was already fit. Corrected by taking the authoritative snapshot from a
  `setTimeout(0)` queued inside the rAF callback — after that frame's render
  steps. Both numbers are still reported side by side (`raf_wrong_frames` is the
  upper bound, `painted_wrong_frames` the tight one) precisely so a reader can
  see the gap.
- **The unexpected one: zero can mean "frame-starved", not "clean".** The first
  hardened run reported *nothing at all* from every cell. Cause: rAF never fired
  inside the srcdoc iframes, so the report chain — which depended on rAF —
  never ran. A document that never produces a frame cannot paint an unfit one,
  and a checker that concludes "clean" from that is lying. The probe now carries
  a liveness heartbeat, `report()` finishes on two frames **or** a 900ms timeout
  whichever comes first, and every row carries `frames_produced` (3 for the
  pre-paint regimes, 52 for the 400ms one). **Any flash-of-unfit diagnostic
  MUST assert frame production as a precondition and return `incomplete`
  otherwise** — this is the same lesson as F4 (measuring unrendered nodes), one
  level up: measuring an unrendered *timeline*.

### Probe 2 — the derived unit animates, and a density change can be a crossfade

`@property --unit-base { syntax: "<length>" }`, `transition: --unit-base 300ms`,
and the prototype's own per-element derivation (`* { --unit: calc(var(--unit-base)
* var(--unit-scale)) }`, `tokens.css:111-121`) left untouched:

| t | `--unit-base` | derived control height |
|---|---|---|
| 0 | 4px | 36px |
| 50ms | 3.607px | 32.45px |
| 100ms | 3.274px | 29.45px |
| 200ms | 2.607px | 23.45px |
| 300ms | 2px | 18px |

Monotone, sub-pixel, and **every derived value in the tree follows** — because
they are all `calc()` of the same token. One transition declaration on one token
turns the whole design system's density into a continuous crossfade, and no
component participates. This is the strongest single result in the slice: it is
the derivation chain paying a dividend it was not designed for.

### Probe 3 — what an animated axis costs the measured tier (`probeThrash`)

| easing | solves per container | degradation-set changes | oscillated |
|---|---|---|---|
| instant (today) | **1** | 1 | no |
| `300ms linear` | **36** | 2 (4 → 3 hidden) | no |
| `400ms cubic-bezier(0.34, 1.56, 0.64, 1)` | **47** | 2 | no |
| `300ms linear(0, 1.35, 1)` | **36** | **4 (4 → 3 → 2 → 3)** | **yes** |

A monotone axis animation produces a monotone degradation sequence — good, and
not obvious. An **overshooting** one does not: the solver hides `Move`, restores
it, and hides it again inside 300ms. That is the flicker no screenshot catches,
and it is the reason L2 is a leak with teeth rather than a taste note.

### Probe 4 — `@starting-style`, `allow-discrete`, `content-visibility`

Entry from `display: none`, zero JS: transitions on `opacity` and `translate`
both created (200ms each), mid-flight opacity **0.0257**, `display` already
`block`. Exit: `display` transition created, `display` **held at `block`** for
the full 200ms, then `none`. `content-visibility: hidden → visible` flips at 0%
on entry (opacity mid-flight 0.495) and holds `visible` through the exit.
Baseline newly available since August 2024 (Chrome 117 / Firefox 129 /
Safari 17.5); `overlay allow-discrete` is the Safari gap.

### Probe 5 — reduced motion is a property of the table, and it is checkable

Two elements, identical intent, different provenance. `#rt-derived` takes its
duration from `var(--motion)`; `#rt-literal` writes `400ms` at the callsite.
One table rule: `@media (prefers-reduced-motion: reduce) { :root { --motion: 0s } }`.
Emulated `prefers-reduced-motion: reduce` via CDP:

| fixture | rule installed | computed duration | animation object created | oracle |
|---|---|---|---|---|
| `#rt-derived` | yes | **0s** | **none** | PASS |
| `#rt-literal` | yes | 0.4s | yes, 400ms | **FAIL(rt-literal)** |
| both | no | 0.12s / 0.4s | yes | **FAIL(rt-derived, rt-literal)** |

No wildcard selector, no `!important`, nothing for a component author to
remember — and the escape is named, not hidden. The oracle fails in two
independent ways, so it is falsifiable twice over.

**Also measured, and it matters**: the platform's default view transition
**ignores reduced motion entirely.** Under emulated `reduce`, a
`startViewTransition()` produced **10 UA-generated animations at 250ms each**
(`-ua-view-transition-group-anim-*`, `-ua-view-transition-fade-in/out`,
`-ua-mix-blend-mode-plus-lighter`, for both `root` and the named element).
Injecting this repo's shipped
`packages/www/src/styles/view-transitions.css` reduced that to **0**. The claim
written at that file's lines 57-65 is now measured, not asserted.

### Probe 6 — support matrix, Chromium 151 (`CSS.supports`, verified by behaviour)

`transition-behavior: allow-discrete` ✓ · `@starting-style` ✓ ·
`interpolate-size: allow-keywords` ✓ · `calc-size(auto, size)` ✓ ·
`animation-composition: add` ✓ · `animation-timeline: scroll()` ✓ · `view()` ✓ ·
`view-transition-class` ✓ · `@view-transition` ✓ · `content-visibility` ✓ ·
`overlay` discrete ✓ · `field-sizing: content` ✓ · `text-wrap: pretty` ✓ ·
`position-try-fallbacks` ✓ · `reading-flow` ✓ · `LayoutShift` ✓.

**One correction to the brief.** `view-transition-name: auto` is **not**
supported (measured: setting it computes to `none`), and that is not a Chromium
gap — it is not in the spec. The current
[css-view-transitions-2](https://drafts.csswg.org/css-view-transitions-2/)
syntax is `none | <custom-ident> | match-element`, and MDN states explicitly
that `<custom-ident>` cannot be `auto`. `match-element` is supported, is
same-document only (identity-keyed names are not transferable across
documents), and is already what this repo uses
(`packages/www/src/styles/view-transitions.css:42`, and
`packages/ssg/src/view-transitions.ts:15-17` documents exactly that constraint).
Any proposal saying "auto names" should say `match-element`.

## Proposed vocabulary

**One new authored attribute. One new token pair. Three engine-written state
attributes that no author may set.** The point of this slice is how little
motion needs to be said out loud.

```
AUTHORED (1 new)
  data-motion="off"          this surface does not move (a grid, a code editor,
                             a live-updating table). One value, not an
                             enumeration: "how" is never an author's decision.

TOKENS (2 new, in the table, never in a component)
  --motion                   already exists (tokens.css:35)
  --motion-ease              the missing half of the pair
  (reduced motion sets --motion: 0s; nothing else changes)

ENGINE-WRITTEN (3 new, in states.css, an author declaring one is a bug)
  data-entering              set for one frame-group after the node is inserted
  data-exiting               set while an exit transition is outstanding
  data-moved                 set when the node's box changed between commits

DERIVED, no declaration at all
  entry/exit                 @starting-style + allow-discrete on the removal
                             attributes the solver already writes
  reorder/move               view-transition-name: match-element
  navigation direction       the router's existing types callback
  density crossfade          transition on --unit-base
  reduced motion             the token override
```

**Explicitly rejected: `data-motion="enter|exit|move|emphasise"`.** It was the
obvious proposal in the brief and it should not be built. All four are
*observable*: the engine sees the insertion, the removal, the box delta, and the
state change. Asking an author to restate them is asking them to keep a second
copy of the truth, and a second copy that can disagree — the F9 failure mode,
one layer up. `emphasise` is the only member with real content, and it is not
motion: it is attention priority, which belongs to another slice.

**What I would delete to pay for this.** `--motion` currently sits in
`tokens.css` with a comment promising a reduced-motion axis that does not exist;
either the axis lands (one line, measured above) or the comment goes. And the
two hand-written `transition:` property lists at `roles.css:89-92` and
`roles.css:208-210` should collapse into one rule keyed on what changed, so
adding an animated property to the table never means editing two roles.
Net vocabulary change: **+1 authored attribute, and the vocabulary stays on one
page.**

## Proposed diagnostics

Codes continue the existing append-only registry (`diagnostics/codes.ts`); N700
is taken by the in-flight competing-primaries rule, so this slice starts at N710.
Every rule below measures the box its claim is about, and every one names the
fixture that proves it can fail.

**N710 — flash of unfit.** For each `[data-fit]`, assert that the first solve
completed before the document's first contentful paint, **and** that no
composited frame carried geometry differing from the settled geometry.
Reports the interval in ms, the frame count, and the worst delta in px.
Precondition: `frames_produced ≥ 2`, else `incomplete` — a frame-starved
timeline cannot clear the check by producing nothing.
*Fixture that proves it can fail*: `06-motion.html` cells `row/r4-ssg-100ms`
(9–10 frames, 69–87ms, 313px) and `row/r5-falsify-400ms` (44–46 frames,
368–387ms). *Fixture that proves it can pass*: `r6-render-blocking` (0 frames,
0px). *Fixture that proves the precondition fires*: any cell whose iframe never
ticks rAF — the failure this probe actually hit.
**Do not implement this on CLS.** Measured: CLS returns 0 for the 46-frame
defect and 0.1438 for the zero-frame one.

**N711 — motion not reduced.** Under `(prefers-reduced-motion: reduce)`, no
element may have a running animation or transition whose computed active
duration exceeds 1ms. A **non-numeric** computed duration (scroll or view
timeline) is `incomplete`, never pass.
*Fixture that proves it can fail*: probe 11's `#rt-literal` — a per-callsite
`400ms` survives the token override and is named in the failure. Second,
independent failure path: run with the table rule absent and both fixtures fail.
*Fixture that proves the `incomplete` branch fires*: probe 9's `#bar`
(`animation-timeline: scroll()`), whose duration is non-numeric and which the
first version of this oracle silently dropped from the offender list.
Reduced-motion scoping would read better against `obs.declared(selector)`
subtree scoping than against a global `document.getAnimations()` sweep plus a
filter — see the note at the end.

**N712 — degradation oscillation.** While a context axis is animating, a fit
container's degradation set must be monotone: a candidate that has been spent
may not be restored and spent again within one transition.
*Fixture that proves it can fail*: `probeThrash(300, 'linear(0, 1.35, 1)')` —
measured sequence `Print,Report,Move,Forward` → `Print,Report,Move` →
`Print,Report` → `Print,Report,Move`. *Fixture that proves it can pass*:
`probeThrash(300, 'linear')`, two monotone changes.

**N713 — authored duration.** Extend the exclusivity invariant to time: no file
outside the resolution table may contain an `ms`/`s` literal, exactly as none
may contain a length or a colour. Today the values guard matches lengths and
colours only, so `transition: opacity 200ms` in a `src/ui/` file would pass
silently — and the whole reduced-motion result above depends on that never
happening, because a literal duration is invisible to the token override.
*Fixture that proves it can fail*: add `transition: opacity 200ms` to any file
in `src/ui/`; the guard must match it and must still match the durations inside
`src/theme/` to prove it is not passing vacuously.

**N714 — view-transition-name collision.** Two rendered elements sharing a
`view-transition-name` reject `ViewTransition.ready` and the transition is
skipped — a silent loss of the exact motion the engine was asked to produce.
Assert uniqueness across rendered elements before the update callback.
*Fixture that proves it can fail*: two siblings both set to the same explicit
name; the transition is skipped and `ready` rejects. Note `match-element` cannot
collide, which is a further argument for preferring it.

## Against Apple

| capability | what Apple does | derivation |
|---|---|---|
| fitting content that does not fit | Auto Layout: a real Cassowary constraint solver, globally optimal, with content-hugging and compression-resistance priorities | **loses on solving.** The fit pass degrades greedily, least-important first, and F11 already concedes that priority orders *when* a strategy is spent, never *whether*. Apple's solver finds a satisfying assignment; ours finds a surviving one |
| when the first frame is correct | UIKit lays out before display: there is no "flash of unfit" on iOS, ever | **loses today on the SSG path — measured, 69–87ms at a 100ms budget — and matches with R6.** A parser-blocking solve is the web's equivalent of laying out before display, and it measured 0 composited unfit frames. This is the single place where Apple's architecture is structurally ahead and the gap is closable by scheduling, not by design |
| motion vocabulary | UIKit/SwiftUI system animations: `.default`, `.easeInOut`, `UISpringTimingParameters`. System-owned, correct by default | **matches.** One `--motion` pair plus derived magnitude is the same bargain: the platform decides, the caller does not |
| spring feel | physically parameterised springs, tuned by humans with eyes, and genuinely better-feeling than a bezier | **loses.** CSS `linear()` can approximate any spring, but Apple's defaults are the product of taste we do not have. And ours has a cost theirs does not: probe 10 shows an overshooting spring can make our *layout solver* flicker |
| Dynamic Type | one system axis; each text style is authored per size class, `UIFontMetrics` scales the rest | **beats.** Density × input compose *multiplicatively* from one unit (`tokens.css:95-121`), which is a strictly larger space than one authored ramp — and, measured here, the axis can **crossfade continuously**, which Dynamic Type cannot: an iOS text-size change is a discrete relayout |
| matched-geometry transitions | SwiftUI `matchedGeometryEffect`, requires an explicit `id` per pair | **beats, slightly.** `view-transition-name: match-element` is identity-keyed by the element itself — no id to invent, no id to get wrong. Measured supported |
| reduce motion | `UIAccessibility.isReduceMotionEnabled`, checked at each animation site, in code | **beats, and this is the honest headline.** Apple's compliance is a convention enforced by review; ours is one token override, measured to create **no animation object at all**, plus N711, which fails on a named element. Where Apple is authored-by-humans-with-eyes and unverifiable, we are derived and machine-checkable — and the platform's own view transitions, measured, ignore reduce entirely, so "the browser handles it" is not a defence either |
| materials, SF Symbols, optical corrections | per-weight, per-size hand corrections across thousands of glyphs | **loses, and it is not close.** The prototype has one shadow rule (`states.css:116-118`) and no symbol set. Derivation produces consistency; §"Nothing about beauty" in the README is still the standing answer |
| motion consistency across an app | HIG plus review discipline | **beats.** Nothing in a component can express a duration, so drift is impossible by construction rather than by discipline — provided N713 lands, without which the guarantee is only a habit |

Net: derivation **beats Apple on verifiability, on axis composition, and on
reduce compliance**; it **matches** on default motion quality; it **loses** on
constraint solving, on first-frame correctness until R6 lands, on spring feel,
and on craft assets. "Transcending Apple" is a defensible claim on exactly the
axis Apple cannot follow: their system cannot be checked by a machine, and every
number above came out of one.

## Open questions for the maintainer

1. **Is the SSG path in scope for the fit pass?** The entire flash-of-unfit
   finding turns on it. If the engine only ever renders client-side, the flash
   is provably zero and this slice's biggest risk evaporates. If SSG is in
   scope, R6 (a parser-blocking solve after each fit container) is the only
   measured way to make "no unfit frame" an invariant rather than a race — and
   it costs a small inline script per page and forbids the solver from arriving
   via a dynamic import.
2. **Should a density change animate?** It is free to build (one transition on
   one token) and measured beautiful. It costs **36 solves per container** per
   change and needs a hysteresis policy. Instant is defensible; if it animates,
   N712 is not optional.
3. **Does `data-motion="off"` earn its place**, or is reduced-motion plus the
   table sufficient? I can defend it (a live-updating grid genuinely should not
   move) but it is the only authored motion declaration in the proposal and the
   vocabulary is stronger at zero.
4. **One signature curve, or none?** L1 says motion personality is a single
   table decision. Someone has to make it, once, and own that it is taste and
   not derivation — the `--min-avatar` precedent.
5. **Is `--motion` allowed to vary by role** (control 0.12s, panel 0.24s,
   navigation 0.3s), or must it stay one global? Per-role is more beautiful and
   is one more table axis to keep self-consistent — and F9's lesson is that two
   derivations from one token can contradict each other.

## Belongs to another slice

- **Overlays / positioning**: `overlay … allow-discrete` is what keeps a popover
  or dialog painted during its exit, and Safari does not support it (exit is
  instant there, not broken). The prototype's overflow menu
  (`states.css:89-122`) is a `position: absolute` panel, not top-layer, so it is
  unaffected today — but a move to `popover` inherits this.
- **Fit / UI**: `[data-collapsed]` and `[data-hidden]` both use
  `display: none !important` (`states.css:24-26,39-41`). Exit motion for a
  degraded candidate requires `transition-behavior: allow-discrete` on those two
  rules and an `[data-exiting]` hold; `!important` does not block a discrete
  transition, but the two rules are the only place it can be declared.
- **Overflow / scroll**: `content-visibility: auto` plus
  `contain-intrinsic-size` is a scroll-performance decision with a motion
  consequence (a skipped subtree that becomes visible mid-scroll cannot animate
  from a state it never had). Measured here only as a *transition* target.
- **Attention / adaptive**: `emphasise` — the one member of the rejected
  `data-motion` enumeration with real content — is attention priority, not
  motion. It belongs wherever attention semantics land.
- **Verification / diagnostics**: N713 (duration literals) is an extension of
  `proof/no-values-guard.mjs`, not a runtime rule. Separately, and worth someone
  confirming: `experiments/c11-appearance/src/theme.css`,
  `src/appearance.ts` and `src/components.ts` appear to be superseded by
  `src/theme/`, `src/appearance/` and `src/ui/` — `src/app/main.ts:19` imports
  `../theme/index.css` and nothing imports `../theme.css`. `src/theme.css:110`
  carries a hard-coded `transition: background-color .12s`, i.e. a duration
  literal in a file **outside** `src/theme/`. Dead or not, it is exactly the
  shape N713 exists to catch.
- **Orchestrator note**: the new `obs.declared(selector)` subtree scoping would
  suit **N711** better than a global `document.getAnimations()` sweep — the
  natural report is "this surface still animates under reduce", scoped to the
  surface that owns the offending element, and the current draft has to
  reconstruct that ownership by filtering. Recording the opportunity only; the
  rule's decision is unchanged.
