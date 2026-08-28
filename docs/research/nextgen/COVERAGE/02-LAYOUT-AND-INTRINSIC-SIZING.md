# layout and intrinsic sizing — intent coverage audit

**Date**: 2026-08-25 · **Kind**: coverage audit, measured where marked
**Slice**: whether flexbox, grid, intrinsic sizing, fragmentation, container
context and reading order can be reached from declared intent — and whether a
resolution table derived from one unit can be made internally consistent.
**Baseline**: `experiments/c11-appearance` (240/240 clean)

> **Code allocation note.** `N700` is allocated to the competing-primary-actions
> rule landing in parallel. Every code proposed here is therefore in the
> `N710`–`N715` block. Nothing in this audit edits `codes.ts`,
> `rules/index.ts`, `runner.ts` or any test.

## Coverage in one line

D 28 · T 10 · L 6 · X 1 — of 45 capabilities audited.

The headline is not the ratio. It is that **the F9 class is not merely
checkable, it is eliminable at its most important site**: replacing the grid's
unit-derived track minimum with a measured column count is clean across 72
measured combinations (3 label lengths × 3 densities × 2 inputs × 4 widths),
zero crushes, zero overflow, and it puts **no length in the table at all**.

---

## The leaks, first

### L1 — Layout topology. Named areas and explicit track lists are authored.

`grid-template-areas: "nav main aside"` is a design decision, and no
declaration of *meaning* implies it. A sidebar on the left rather than the right
is not derivable from "this is navigation"; it is derivable from a *convention*,
and a convention is an authored table entry, not a derivation.

Be precise about what is and is not lost, because the honest split is not 50/50:

| topology kind | share of real UI | verdict |
|---|---|---|
| repeated cells of one kind ("cards", tiles, a settings list) | most of it | **D** — measured column count, proven below |
| key/value records aligned across independent components | common | **D** — `subgrid`, proven below |
| the app shell (nav / main / aside / header) | one per app, maybe three | **T** — a closed enumerated set |
| a bespoke designed grid (a marketing page, a dashboard with spanning tiles) | rare, and load-bearing | **L** |

So the leak is real but narrow: it is the *bespoke* grid, and the cheapest
honest option is to stop pretending otherwise. Add `data-shell` with a closed
set of four values (`stack | sidebar | split | shell`) so the recurring shells
become one table rule each, and let a genuinely designed grid be an `L` that
declares itself — an authored `grid-template-areas` on an element that also
carries `data-escaped`, so it reports as N601 and is visibly outside the
guarantee. **"A dashboard's grid is a design decision" is a legitimate L, and
trying to derive it would be the dishonest move.**

`subgrid` does **not** rescue this. Subgrid *consumes* a topology; it never
produces one. It is a major D win for alignment and contributes nothing to
placement.

### L2 — `order` and `flex-direction: row-reverse` desynchronise three orders, silently.

Measured, Chrome 151, `reading-flow: normal` (the default):

| | order |
|---|---|
| DOM | `f1, f2, f3` |
| visual (measured `left`) | `f1, f3, f2` |
| focus (real Tab presses) | `f1, f2, f3` |

Three different orders from one declaration, with no error anywhere. This is
not a derivation gap — it is a *capability that must be removed from the
vocabulary*, because the only intent it can express is "put this somewhere else
visually", which is exactly the per-callsite eyes-decision the thesis rejects.
With logical properties, RTL never needs `row-reverse`. Cheapest honest option:
forbid both, with N712 asserting visual order equals focus order.

### L3 — Asymmetric proportional splits (`flex-basis: 60%`, `flex-grow: 2`).

"This pane is 60% and that one 40%" is a per-callsite number. It has a partial
rescue: growth proportional to declared importance,
`flex-grow: calc(6 - var(--priority))`, is one table rule using vocabulary that
already exists, and it covers "the main region matters more than the sidebar".
It does **not** cover a designed 62/38. That residue is L.

### L4 — A span is a topology statement.

`grid-column: span 2` on a tile is the same class as L1: intent does not imply
extent. `span all` for a full-row record **is** derivable (it means "this record
occupies the row"), so the honest split is: `span all` → D, arbitrary `span N`
→ L, and N714 should assert that a declared span never exceeds the parent's
resolved track count.

### L5 — `justify-content` distribution style is a taste axis, not a semantic one.

`space-between` is in the vocabulary (`data-align="between"`, structure.css:133)
and reads as intent ("these two groups are at opposite ends").
`space-around` / `space-evenly` do not — they differ only in the size of the
end gaps, which is a look. T if the table picks one for the whole app; L if a
callsite wants to choose. Pick one; do not add the choice.

### L6 — `contain-intrinsic-size` is a placeholder for content that has not
been laid out, so its number cannot come from the content.

`content-visibility: auto` needs a size estimate before the subtree exists.
`contain-intrinsic-size: auto <length>` lets the browser remember the last real
size, which makes the *steady state* derived — but the first paint still needs a
number, and a number per role is a table rule, hence T. It becomes an L only if
different instances of the same role need different estimates.

### X1 — `fit-content(<length>)` is not expressible on a box.

Measured, Chrome 151: `CSS.supports('inline-size', 'fit-content(12ch)')` →
`false`; `CSS.supports('width', 'fit-content(12ch)')` → `false`;
`CSS.supports('grid-template-columns', 'fit-content(20ch)')` → `true`.

`fit-content()` is a **grid track function only**. The intent "as wide as the
content wants, but never wider than about twelve characters" — which is a
perfectly good, purely semantic intent about *reading*, not about pixels — has
no box-level spelling. The workaround is `inline-size: fit-content` plus
`max-inline-size: 12ch`, and that reintroduces an F9 site (an explicit `max-*`
has no automatic minimum; see the measurement below, where the same shape
escapes by 19px at dense). So the intent is expressible, and expressing it
costs a new contradiction site plus an N710 registry entry. That is an escape,
not a derivation.

---

## Capability table

| capability | CSS today | verdict | intent declaration | notes |
|---|---|---|---|---|
| **Flexbox** | | | | |
| main-axis direction | `flex-direction: row/column` | D | `data-layout="row" \| "stack"` | structure.css:65,72 |
| wrapping | `flex-wrap: wrap` | D | `data-layout="wrap"` | candidate for deletion, see vocabulary |
| absorb slack | `flex-grow: 1` | D | `data-grow` | structure.css:195 |
| proportional growth | `flex-grow: 2` | T | `flex-grow: calc(6 - var(--priority))` | one rule; reuses `data-priority` |
| shrink licence | `flex-shrink` | D | none — table forbids it | structure.css:189; F8 |
| explicit basis / asymmetric split | `flex-basis: 60%` | **L** | — | L3 |
| automatic minimum | `min-width: auto` | D | granted per node to `[data-truncate]` only | structure.css:218 |
| cross-axis alignment | `align-items` | D | `data-align="start\|center\|end"` | structure.css:124 |
| end-to-end distribution | `justify-content: space-between` | D | `data-align="between"` | structure.css:133 |
| other distributions | `space-around/evenly` | T | — | L5 |
| baseline alignment | `align-items: baseline` | D | `data-align="baseline"` (new value) | "these are text on one line" is semantic |
| visual reordering | `order` | **L** | — | L2; forbid |
| axis reversal | `row-reverse` | **L** | — | L2; forbid |
| gutters | `gap` | D | derived: `--unit * 2` row, `* 1.5` stack | structure.css:59,75 |
| **Grid** | | | | |
| explicit track list | `grid-template-columns: 200px 1fr` | **L** | — | L1 |
| breakpoint-free columns | `repeat(auto-fit, minmax(N, 1fr))` | D | `data-layout="grid"` + measured `--columns` | 72/72 clean, measured; CSS-only spelling is T |
| `minmax()` | `minmax(a, b)` | T | — | one spelling in the table |
| flexible tracks | `1fr` | D | — | |
| named areas | `grid-template-areas` | **L** | `data-shell` for the closed set | L1 |
| **subgrid** | `grid-template-columns: subgrid` | **D** | `data-layout="subgrid"` | proven below; the biggest win in this slice |
| implicit tracks | `grid-auto-rows/columns`, `grid-auto-flow` | D | — | |
| item placement | `place-items`, `place-self` | D | `data-align` | |
| spanning | `grid-column: span N` | **L** | `span all` is D | L4 |
| dense packing | `grid-auto-flow: dense` | T | — | must be paired with `reading-flow: grid-rows` |
| **Intrinsic sizing** | | | | |
| `min-content` | `width: min-content` | D | never authored; it is the crush floor | contracts.ts:84 `contentInline` |
| `max-content` | `width: max-content` | D | the engine's measurement input | measured 326.77 vs 300 available |
| `fit-content` keyword | `width: fit-content` | D | — | measured == `stretch` == 300 in 300px |
| `fit-content(<len>)` on a box | — | **X** | — | X1; unsupported, measured |
| `stretch` | `inline-size: stretch` | D | — | measured supported, both axes |
| `contain-intrinsic-size` | `auto 200px` | T | per role | L6 |
| **Ratio and fragmentation** | | | | |
| `aspect-ratio` | `16 / 9` | D | `data-media` role | **self-consistent by construction**; measured |
| multicol | `columns: <width>` | T | `data-layout="columns"` | F9 site + a checker hole; measured |
| `column-span: all` | | T | — | |
| `break-inside: avoid` | | D | per role — a card never breaks | |
| `column-fill` | | T | — | |
| **Context** | | | | |
| container size query, content-unit threshold | `@container (inline-size < 24em)` | **D** | — | measured: flips with density at a fixed width |
| container size query, px threshold | `@container (inline-size < 400px)` | T | — | a number, but one, in the table |
| style query, equality | `@container style(--density-name: dense)` | D | — | states.css:195 |
| style query, **range** | `@container style(--unit > 3px)` | **D** | — | measured working AND falsifiable; new |
| container units | `cqi`, `cqb` | D | — | measured `100cqi` == 300 |
| `:has()` as derivation input | `:not(:has(...))` | D | — | states.css:85; limits N710, see blind spots |
| **Ordering** | | | | |
| focus order follows visual order | `reading-flow: flex-visual` | **D** | one table rule, forever | measured: tab == visual exactly |
| declared attention order | `reading-order: <int>` | **D** | **`data-priority`, no new vocabulary** | measured via typed `attr()` |
| DOM order as reading order | default | D | — | |
| **The unit** | | | | |
| spacing derived from `--unit` | | D | — | tokens.css:111 |
| a **container bound** derived from `--unit` | | T | must carry a floor | **this is F9's home**; see below |

---

## Measured probes

Probe: `experiments/coverage/02-layout.html` — plain HTML + CSS + measuring JS,
no build, no dependency. Browser: **headless Chromium 151.0.0.0** on darwin
arm64, driven over `file://`. The stylesheet is a faithful restatement of
`experiments/c11-appearance/src/theme/` reduced to the parts under test, so
every number below is about *that* table.

### Probe 1 — The F9 class, reproduced

36 cells: 3 label lengths × 3 densities × 2 inputs × 2 track spellings, each in
320px, the width the original F9 was recorded at. The label length is a fixture
parameter because **the thing that does not shrink with density is the intrinsic
width of text**: the unit goes 4px → 2px (×0.50) while the type ramp goes
14px → 12px (×0.857), so a unit-proportional track loses space twice as fast as
its contents give it back.

`raw` = the pre-fix spelling `minmax(calc(var(--unit) * 44), 1fr)`.
`floored` = the shipped spelling, `structure.css:120`.

| label | density | input | track | declared min | cols | used track | cell wants | crushed | grid |
|---|---|---|---|---|---|---|---|---|---|
| long | comfortable | pointer | raw | 176px | 1 | 320px | 155.38px | 0 | 320/320 |
| long | compact | pointer | raw | 132px | 2 | 157px | 140.05px | 0 | 320/320 |
| **long** | **dense** | **pointer** | **raw** | **88px** | **3** | **104px** | **124.75px** | **3** | **321/320** |
| long | dense | pointer | floored | 176px | 1 | 320px | 124.75px | 0 | 320/320 |

**Exactly one of the 36 cells fails, and it is dense** — the context whose whole
job is fitting more in less. Every one of the 18 `floored` cells is clean. This
is the recorded F9, reproduced from first principles at a different label and a
different measurement rig.

**The failure I did not expect, and it matters more than the reproduction: the
container-level signal is 1 pixel.** `gridScroll 321` against
`gridClient 320`, while three individual controls are each crushed by ~20px
(`inline 104`, `contentInline 124.75` at max-content). A container-only overflow
test would have read 321/320 as a rounding artefact and moved on — which is F8's
lesson arriving a second time by a different route, and it is the strongest
available argument for the prototype's node-local `crushed()` predicate
(`contracts.ts:93`) existing at all.

### Probe 2 — The table consistency check (N710), implemented and shown failing

30 assertions: 5 registered container bounds × 3 densities × 2 inputs. Each side
is resolved in an **unconstrained off-flow probe** — no available space, no
layout pressure — so the number measured is the table's *assertion*, not the
outcome of a fight between the assertion and the space.

Failures, all four of them:

| bound | density | input | bound | floor | deficit |
|---|---|---|---|---|---|
| `grid-track/raw` | dense | pointer | 88px | 106.70px | **18.70px** |
| `grid-track/raw` | dense | touch | 110px | 117.95px | **7.95px** |
| `multicol-column-width` | dense | pointer | 88px | 106.70px | **18.70px** |
| `multicol-column-width` | dense | touch | 110px | 117.95px | **7.95px** |

`grid-track/floored` passes at all six contexts (176px against floors of
106.70–154.28px). **The check fires on the pre-fix spelling and is silent on the
shipped one, so its fixture is the repository's own history.**

It also fired on `column-width`, which nobody had audited — the second F9 site,
found by a check written for the first.

### Probe 3 — The construction rule, and its falsifying fixture

The claim: **a container bound cannot state an F9 contradiction while it retains
its automatic content-based minimum, because the automatic minimum *is* floor
propagation, implemented by the UA.**

`aspect-ratio` is the clean case. A 64px-wide `16/9` box, `data-input="touch"`
so the control floors at 44px:

| site | minimum | density | ratio would give | bound measured | control | escapes |
|---|---|---|---|---|---|---|
| `aspect-ratio` | automatic (`min-block-size: auto`) | comfortable | 36px | **45px** | 45px | no |
| `aspect-ratio` | automatic | compact | 36px | **44px** | 44px | no |
| `aspect-ratio` | automatic | dense | 36px | **44px** | 44px | no |
| `aspect-ratio` | **suppressed** (`min-block-size: 0`) | comfortable | 36px | 36px | 45px | **yes, by 9px** |
| `aspect-ratio` | suppressed | compact | 36px | 36px | 44px | **yes, by 8px** |
| `aspect-ratio` | suppressed | dense | 36px | 36px | 44px | **yes, by 8px** |
| `max-block-size: calc(--unit * 10)` | **none available** | comfortable | 50px declared | 45px | 45px | no |
| `max-block-size` | none available | compact | 37.5px declared | 37.5px | 44px | **yes, by 6px** |
| `max-block-size` | none available | dense | 25px declared | 25px | 44px | **yes, by 19px** |

The ratio *wanted* to give 36px at every density and the content floor overrode
it in all three — with no author intervention and no table entry. Suppress the
automatic minimum and the same box contradicts itself. An explicit `max-*`,
which has no automatic minimum to keep, contradicts itself at two of three
densities.

**Second unexpected failure, this one in the measurement:** with
`min-block-size: 0`, `scrollHeight === clientHeight === 36` even though a 45px
control was sitting outside the box. The control is pinned by
`align-content: end`, so it overflows towards **block-start**, and
`scrollHeight` cannot see start-side overflow. `Metrics.overflows()`
(`contracts.ts:91`) therefore has a directional blind spot, and the escape had
to be measured as *rect against rect*. Another instance of "a check must measure
the box its claim is about" — here, in the direction the claim is about.

### Probe 4 — The measured alternative: topology as a count, not a length

`css-grid-2` §7.2 forbids an intrinsic minimum inside an auto-repeat, so CSS
cannot ask "how many of these fit". The engine can: measure the cell's
max-content extent once per context, divide, publish `--columns`, and write the
track as `repeat(var(--columns), minmax(0, 1fr))` — **no length in the table at
all, so no bound left to contradict a floor.**

72 combinations (3 labels × 3 densities × 2 inputs × 4 widths of
320/480/720/1080): **0 crushes, 0 overflows.** A sample of the range:

| label | density | input | width | cell wants | columns | used track |
|---|---|---|---|---|---|---|
| short | dense | pointer | 1080 | 86.05px | **12** | 86.33px |
| short | comfortable | touch | 320 | 99.14px | 3 | 100px |
| long | comfortable | touch | 320 | 171.39px | **1** | 320px |
| long | dense | pointer | 1080 | 124.75px | 8 | 131.50px |

The count moves with density (12 vs 9 at 1080px), with input mode, with content
length, and with available width — four inputs, one measurement, zero authored
numbers.

The control that proves this needed a measured count rather than merely an
intrinsic minimum: `repeat(3, minmax(min-content, 1fr))`, which is the only way
to get a content-derived track minimum past the grammar, **overflows in the
comfortable direction** — 534/320 at long/comfortable, 476/320 at long/compact,
417/320 at long/dense. Intrinsic minimums with a fixed count trade a dense-side
contradiction for a comfortable-side overflow. The count is the decision.

### Probe 5 — `subgrid` aligns components that cannot see each other

Three independent "components", each a `display: contents` host — the exact
shape `structure.css:32-51` gives every nisli host — wrapping a
`grid-template-columns: subgrid` child. No component names a track, a width, or
the other components' content.

```
parent tracks (authored once):  [label] 104.781px [value] 303.219px
child tracks:                   subgrid [] [] []
host display:                   contents
key lefts:                      [8, 8, 8]                 → aligned
value lefts:                    [124.78, 124.78, 124.78]  → aligned
```

The 104.781px label track is the max-content of the **widest key across all
three components**. Component 1 (`"Shortname"`) is indented to the width
demanded by component 2 (`"A much longer key"`), and neither knows the other
exists. **`display: contents` does not break subgrid** — the host has no box, so
the inner div is the parent's grid item, and the derivation channel (inherited
custom properties) passes straight through.

The honest caveat, also measured: with an `auto-fit` parent the shared tracks
are `206px 206px` — the records still align, but on an arbitrary track width
rather than a content-negotiated one. **Subgrid's win is conditional on the
parent's topology being authored.** It makes an authored topology reusable
without exposing numbers; it does not make topology derivable.

### Probe 6 — Multicol, and a checker hole with no box to measure

`columns: calc(var(--unit) * 44)`, 320px, long label:

| density | input | column-width | columns used | used width | control (used/content) | crushed | container |
|---|---|---|---|---|---|---|---|
| comfortable | pointer | 176px | 1 | 320px | 320/318 | 0 | 320/320 |
| compact | pointer | 132px | 2 | 154px | 154/152 | 0 | 320/320 |
| **dense** | **pointer** | **88px** | **3** | **101.33px** | **101.33/103** | **6** | **323/320** |
| dense | touch | 110px | 2 | 155px | 155/153 | 0 | 320/320 |

Dense again, and only dense. But the structural finding is worse than the
number: **a column box is not an element.** The per-node crush predicate saw
this case only because `[data-layout="stack"]` stretches its children to the
column width. Make the item shrink-to-fit and it sits at its own content width,
`scrollWidth === clientWidth`, nothing crushed, nothing reported — and the
content is outside a box that has no DOM node and can never be measured. The
only honest assertion is *item rects against the container's padding box*.

**A third measurement bug in my own checker, caught the same way the README's
five were:** the first version of the overlap test compared inline extents only
and reported **3 overlaps for a single-column layout**, where three items are
stacked vertically and share the whole inline axis by design. An overlap claim
is about area; it has to be measured as area. Fixed to a 2D intersection, the
count is 0 everywhere.

### Probe 7 — F8, quantified

160px row, nowrap grow text (335px of content), `flex: none` button:

| licence | row | grow region used/content | crushed |
|---|---|---|---|
| automatic minimum kept | 413/160 (honest overflow) | 334.66 / 335 | 0 |
| `min-inline-size: 0` | 335/160 | **82.13 / 335** | 1 |

The licence buys 78px of container relief at the price of a **253px crush**.
This is `structure.css:202-220`'s argument, measured: the grow region must keep
its automatic minimum so the container overflows *honestly*, because an honest
overflow is the signal the solver can act on.

### Probe 8 — Is a container-query threshold authored, or derived?

At one fixed container width (320px), thresholds in four units:

| density | container font-size | `< 24em` | `< 45ch` | `< 24rem` | `< 320px` |
|---|---|---|---|---|---|
| comfortable | 14px | **true** | true | true | false |
| compact | 13px | **false** | true | true | false |
| dense | 12px | **false** | true | true | false |

`24em` flips between comfortable and compact **at a constant container width**,
because font-relative units in a container condition resolve against the query
container's own font — which the density axis already sets. `rem` is the control:
root-relative, matches everywhere, density-blind.

So `@container (inline-size < 24em)` is **not a breakpoint**. It is "narrower
than about 24 characters of the text it contains", which is a statement about
reading, and it moves with the context for free. That is a D, and it is the
answer to "no media queries, but container queries still have numbers".

[UNVERIFIED] I could not locate the normative sentence in `css-conditional-5`;
the behaviour is measured in Chrome 151 and covered by WPT
`css/css-conditional/container-queries/font-relative-units.html`.

### Probe 9 — Style queries can compare magnitudes, and the comparison can fail

| condition | `--u: 4px` | `--u: 2px` |
|---|---|---|
| `style(--u > 3px)` (registered `<length>`) | matches | **does not match** |
| `style(--n > 3)` (registered `<number>`) | matches | **does not match** |
| `style(--unreg > 3px)` (**not** registered) | matches | **does not match** |
| `style(--u >= 2px)` | matches | matches |

Range style queries work, discriminate correctly, and — measured — work on
**unregistered** custom properties in Chrome 151. The prototype uses only
equality (`states.css:195`). Ranges mean the table can branch on the
*magnitude* of a derived value, which is how a topology switch ("below three
units, stop deriving a track and take the floor") can be stated in CSS rather
than in a `max()` whose intent is invisible.

[UNVERIFIED] cross-browser. Unregistered-property comparison in particular looks
like a Chrome liberty and should not be relied on.

### Probe 10 — Order, and `data-priority` as focus order with zero new vocabulary

`reading-flow`, measured with real `page.keyboard.press('Tab')`:

| `reading-flow` | DOM | visual | focus |
|---|---|---|---|
| `normal` | f1,f2,f3 | f1,f3,f2 | f1,f2,f3 |
| `flex-visual` | f1,f2,f3 | f1,f3,f2 | **f1,f3,f2** = visual |
| `flex-flow` | f1,f2,f3 | f1,f3,f2 | f2,f3,f1 |
| `source-order` | f1,f2,f3 | f1,f3,f2 | f1,f2,f3 |

Then the result this slice is proudest of. One table rule:

```css
[data-priority] { reading-order: attr(data-priority type(<integer>), 0); }
```

| element | DOM position | `data-priority` | computed `reading-order` |
|---|---|---|---|
| p1 | 1 | 4 | 4 |
| p2 | 2 | 1 | 1 |
| p3 | 3 | 3 | 3 |

Measured focus order, real Tab presses: **`p2, p3, p1`.**

`data-priority` already exists to order *when* a degradation strategy is spent
(README F11). The same declaration now orders *attention*, in the table, with no
JavaScript, no second vocabulary and no `tabindex`. `CSS.supports` for the typed
`attr()` form: `true`.

### Probe 11 — Feature surface, measured rather than assumed

Chrome 151, `CSS.supports`:

**true**: `subgrid`, `reading-flow`, `reading-order`, `field-sizing: content`,
`contain-intrinsic-size: auto 200px`, `content-visibility: auto`,
`aspect-ratio`, `inline-size: stretch`, `block-size: stretch`,
`inline-size: fit-content`, `grid-template-columns: fit-content(20ch)`,
`text-wrap: pretty`, `anchor-name`, `position-area`,
`container-type: scroll-state`, `interpolate-size: allow-keywords`,
`calc-size(auto, size)`, `cqi`, `cqb`,
`attr(data-priority type(<integer>), 0)`.

**false**: `grid-template-rows: masonry`, `item-flow: row masonry`,
`inline-size: fit-content(12ch)`, `width: fit-content(12ch)`,
and the three that matter most here —
`repeat(auto-fit, minmax(min-content, 1fr))`,
`repeat(auto-fit, minmax(auto, 1fr))`,
`repeat(auto-fit, fit-content(176px))`,
against `repeat(auto-fit, minmax(176px, 1fr))` → **true**.

---

## The three questions, answered directly

### 1. Is the table internally consistent by construction, or is a check the only answer?

**Both, and the split is exact and small.** There *is* a general rule, and it is
already in CSS:

> **A container bound cannot state an F9 contradiction while it retains an
> automatic content-based minimum.** The automatic minimum *is* floor
> propagation, implemented by the user agent.

Probe 3 proves it in both directions: `aspect-ratio` overrode its own derived
36px in favour of a 44–45px content floor at all three densities with no table
entry, and suppressing `min-block-size` broke it by 8–9px. Flexbox is the same
rule seen from the other side — F8 is what happens when the table *removes* the
automatic minimum, and Probe 7 prices that removal at a 253px crush.

The exception set — sites where CSS **forbids** an automatic minimum — is
enumerable, and three of the four are grammar-level, not stylistic:

1. **`repeat(auto-fill | auto-fit, <fixed-size>)`.** `css-grid-2` §7.2:
   `<fixed-size>` admits only `<fixed-breadth>`, and `<fixed-breadth> =
   <length-percentage>`. §7.2.3.1 states it plainly: *"Automatic repetitions
   cannot be combined with fully intrinsic or flexible sizes (see grammar)."*
   §7.2.3.2 requires *definite* track sizes so the repetition count can be
   computed. Measured: all three intrinsic spellings are rejected. **The
   breakpoint-free grid is obliged by the grammar to name a number.** That is
   not a design mistake in the prototype; it is the price of `auto-fit`, and F9
   was the invoice.
2. **`column-width`** (multicol). No intrinsic form exists. Probe 6.
3. **Any explicit `max-*`.** Probe 3, escaping by 19px at dense.
4. **Any explicit `inline-size`/`block-size` that is not `auto`/`fit-content`/
   `stretch`.**

So the rule for the table is *construction by restriction*: **the table may only
write a container bound at a site that keeps its automatic minimum. At the four
sites where CSS forbids one, the bound must carry an explicit floor, and a check
enumerates exactly those four sites.** That is a bounded exception list, not an
open-ended audit — which is a much better position than "we need a check over
everything".

And at the most important of the four, the site can be **deleted rather than
checked**: Probe 4's measured `--columns` removes the length entirely, 72/72
clean. The engine already has a measured tier (README F2, ~35 lines); this is
one more measurement in it, and it converts the central L/T into a D.

**The check, specified.** `N710 — table bound below its own floor.`

- **Reads**: (a) a registry of container bounds — every declaration at one of the
  four no-automatic-minimum sites whose value mentions `var(--unit)`, recorded as
  `{ id, expression, holds: [floor-key] }`; (b) a registry of content floors per
  role, each a *nominal* extent expression; (c) the full context cross-product
  (density × input, and any future axis).
- **Asserts**: for every (bound, floor, context), `bound_used >= floor_used`,
  where both sides are resolved in an **unconstrained off-flow probe** so the
  number is the table's assertion rather than a layout outcome.
- **Reports**: bound id, context, both pixel values, and the deficit.
- **Fixture that proves it can fail**: `minmax(calc(var(--unit) * 44), 1fr)` —
  the repository's own pre-F9 spelling of `structure.css:120`. Measured to fire
  at dense/pointer (deficit 18.70px) and dense/touch (7.95px) and to be silent
  at all six contexts on the shipped spelling. The fixture is not synthetic; it
  is a `git revert`.

**N710's blind spots, declared up front, because a check that hides its own
limits is the sixth oracle bug:**

- It resolves bounds in an **empty** probe, so it cannot see a bound that only
  applies in the presence of a sibling — i.e. any bound behind `:has()`
  (`states.css:85`) or behind a `@container` branch. Those need a fixture per
  branch, enumerated from the stylesheet.
- Its floor side is a **nominal** content extent (`12ch` of the role's own
  font), because real content width is app data. So N710 is **necessary and not
  sufficient**: at compact the raw track passed (132px ≥ 122.25px) while a long
  enough label would still crush there, and at dense/touch N710 predicted a
  7.95px deficit that the runtime sweep did not exercise. N710 asserts *the
  table keeps its own promise*; the runtime crush predicate asserts *this page's
  content fits*. Neither subsumes the other and both are required.
- Who owns the nominal extent is a genuine open question (below).

### 2. Can named grid areas / templates be expressed as intent?

**No for the bespoke case — that is L1, and it is honest.** But the L is much
narrower than "grid is authored", and the breakdown is in L1's table: repeated
cells are D by measured count (Probe 4), key/value records are D by subgrid
(Probe 5), app shells are T as a closed enumerated set, and only a genuinely
designed grid is L. A dashboard's grid *is* a design decision, and the right
response is to let it declare itself as one — `data-escaped` + N601 — rather
than to invent a vocabulary that pretends to derive it.

### 3. Does `subgrid` enable cross-component rhythm without shared numbers?

**Yes, measured, and it survives nisli's boxless host.** Three components,
independently written, aligned on a 104.781px label track that the widest of
them determined; all three keys at x=8, all three values at x=124.78; the
components contain no numbers and no knowledge of each other. This is a **major
D win** and it is the one capability in this slice with no equivalent in Apple's
system at all.

The win is conditional: it consumes an authored parent topology. With an
`auto-fit` parent the shared tracks are arbitrary (`206px 206px`) rather than
content-negotiated, so subgrid does not compose with the derived-count grid.
Records and cards are two different layout kinds, and the vocabulary should say
so.

---

## Proposed vocabulary

**Net: +1 attribute, +3 values, −1 value. The whole layout vocabulary stays on
one page.**

| change | declaration | why |
|---|---|---|
| **new value** | `data-layout="subgrid"` | 5th value of an existing closed axis (`contracts.ts:25`). Inherits the parent's tracks; the cross-component rhythm primitive. Probe 5. |
| **new value** | `data-align="baseline"` | "These are text on one line" is a semantic fact, not a look. Currently unreachable. |
| **new attribute** | `data-shell="stack \| sidebar \| split \| shell"` | Closed set of app-shell topologies. Converts the recurring half of L1 from L to T. Four values, one per shape that actually recurs; a fifth means the enum is wrong and the case is an escape. |
| **new value** | `data-track="cards \| records"` on `data-layout="grid"` | Cards take the measured count (Probe 4); records take subgrid (Probe 5). They cannot compose, so the vocabulary must distinguish them rather than let the table guess. |
| **DELETE** | `data-layout="wrap"` | Pays for the additions. A wrap row is a one-row cards grid whose count is measured, and it is strictly worse: a lone item on the last line is a layout outcome no author can express intent about, and nothing in the vocabulary can ask for it or forbid it. Deleting it removes a layout kind, a table rule, and a failure mode. |

**Zero new vocabulary for ordering**, which is the point of Probe 10: focus
order is one table rule (`reading-flow: flex-visual` on `[data-layout]`) and
attention order is one more
(`reading-order: attr(data-priority type(<integer>), 0)`) driven entirely by a
declaration that already exists.

**Explicitly not added**: any `flex-basis`, any `order`, any span count, any
`space-around`/`space-evenly` choice, any track list. Those are L1–L5 and adding
vocabulary for them would be adding vocabulary for per-callsite numbers, which
is the thing the exclusivity invariant exists to prevent.

---

## Proposed diagnostics

`N700` is allocated elsewhere (competing primary actions), so this slice claims
`N710`–`N715`.

| code | asserts | fixture that proves it can fail |
|---|---|---|
| **N710** | Every registered container bound is ≥ every content floor it may hold, at every context in the cross-product. Both sides measured in an unconstrained off-flow probe. | `git revert` `structure.css:120` to `minmax(calc(var(--unit) * 44), 1fr)`. **Measured**: fires at dense/pointer (18.70px) and dense/touch (7.95px); silent on the shipped spelling at all six contexts. Also fires on `column-width`, a site the check was not written for. |
| **N711** | No declaration at one of the four no-automatic-minimum sites mentions `var(--unit)` without also mentioning a floor token. Syntactic, over the stylesheet, so it catches a *new* bound before it is ever rendered. | Delete `max(…, var(--min-track))` from `structure.css:120`; N711 fires on the source even if no context exercises it. Conversely, a bound written as a bare `max-inline-size: calc(var(--unit) * 60)` — the pre-fix `states.css:110` — fires. |
| **N712** | For every layout container, visual order == focus order == DOM order, unless `reading-flow` is declared. Focus order read by real sequential navigation, never by reading `tabindex` back. | **Measured**: the `order: 1` + `row-reverse` box, DOM `f1,f2,f3` / visual `f1,f3,f2` / focus `f1,f2,f3` — three orders, one declaration, no error. Removing `order` silences it. |
| **N713** | Every item rect inside a fragmented container (multicol) lies within the container's padding box. **Rect-based, because a column box has no element** and no per-node predicate can ever see this. | **Measured**: dense/pointer multicol, 6 crushed nodes and 323/320. And the shrink-to-fit variant, where zero nodes are crushed and the content is still outside its column — the case that proves a node-local check is not enough here. |
| **N714** | A declared `grid-column: span N` never exceeds the parent's resolved track count. | A `span 3` record inside a `repeat(auto-fit, …)` parent that resolved to 2 tracks at 420px — measured resolvable, since Probe 5's auto-fit parent resolved to exactly `206px 206px`. |
| **N715** | `Metrics.overflows()` is evaluated in **both** directions on both axes. | **Measured**: the `align-content: end` + `min-block-size: 0` box reported `scrollHeight 36 === clientHeight 36` with a 45px control outside it. Start-side overflow is invisible to `scrollHeight`, so `contracts.ts:91` under-reports today. |

The three self-inflicted defects this probe produced, recorded because the
README's own tally of five-oracle-bugs-to-four-page-bugs is the cost signal that
matters: (1) `[data-layout='columns']` was shadowed by the shared
`display: flex`, so the first "multicol" measurement was a flex row; (2) the
overlap test compared inline extents only and reported 3 overlaps for a
single-column layout; (3) the aspect-ratio escape was invisible to
`scrollHeight` because it overflowed towards block-start. Three measurements,
three wrong claims, all three caught by measuring the box — and the direction —
the claim was actually about.

**On the new `obs.declared(selector)` subtree scoping** (flagged by the
orchestrator): two of the six codes above would read better with it, and neither
changes its decision because of it. **N713** is inherently subtree-scoped — "the
items *owned by this fragmented container*, excluding items belonging to a
nested one" is exactly the shape N700 needed for surfaces, and expressing it as
a global `[data-layout="columns"] *` selector plus an ancestor filter is the
version I would otherwise have to write. **N710** wants the inverse and cannot
use it: it evaluates the table in an empty off-flow probe where no subtree
exists, which is precisely the blind spot recorded above. Noting the
opportunity, changing nothing.

---

## Against Apple

| capability | what Apple's system does | derivation |
|---|---|---|
| Priorities under overflow | `UILayoutPriority` 1–1000 on each constraint, fed to a real Cassowary solver that finds the globally least-bad assignment across all axes simultaneously. | **Falls short.** `data-priority` 1–5 drives a greedy degradation loop, not a solver; README F11 says so explicitly. For a genuinely 2D constraint system Apple is stronger, and pretending otherwise would be dishonest. What derivation buys back: Apple's 1000-point priorities are numbers a human types per constraint per view, unverifiable by anything but eyes, whereas a 5-value enum over 240 contexts is machine-checkable. **Weaker solver, stronger proof.** |
| Intrinsic content size | `intrinsicContentSize` + content-hugging / compression-resistance priorities, set per view, per axis. | **Beats it.** This is CSS's automatic minimum, and CSS makes it the *default* rather than something you configure. Probe 7 prices what happens when you switch it off: 253px of crush. Apple's default compression resistance has the identical hazard with no checker to catch it. |
| Cross-component alignment | No equivalent. Aligning two independently written views requires a shared container, an `NSLayoutGuide`, or explicit anchor constraints between views that must know about each other. | **Beats it outright, and this is the sharpest point in the slice.** Probe 5: three components aligned on a track one of them determined, through a boxless host, with no shared numbers and no mutual knowledge. `subgrid` has no Auto Layout counterpart. |
| Dynamic Type | The best-shipped version of the density axis: user-controlled, system-wide, per-text-style ramps tuned by Apple's typographers, `UIFontMetrics` to scale custom fonts. | **Matches on shape, falls short on content.** `--text-*-base` per density (`tokens.css:127-152`) is the same mechanism. Apple is ahead in two ways this table cannot close by derivation: the ramps are professionally tuned, and the axis is set by the *user*, not the app. The table should take a user-set axis input; the tuning is the "beauty is not derivable" admission the prototype already makes. |
| Adaptive layout thresholds | Size classes: two values per axis (compact/regular), chosen by the OS, plus `UITraitCollection`. | **Beats it.** Probe 8: `@container (inline-size < 24em)` is a threshold in *content units* that flips with density at a constant container width. Apple's size classes are coarse (two buckets), viewport-scoped rather than container-scoped, and blind to the text size inside the view. A container-relative, font-relative threshold is finer-grained *and* has no authored pixel. |
| Reading / focus order | `accessibilityElements` — an array a human orders by hand, imperatively, in code, per view. | **Beats it, and verifiably.** Probe 10: focus order derived from `data-priority`, which was declared for a different purpose, with no JavaScript — and N712 can assert visual == focus order over the whole context matrix. Apple's array is unverifiable by construction and drifts the moment the layout changes. |
| Named layout topology | `UIStackView` nesting and Auto Layout constraints, authored by a human with eyes. | **Matches — i.e. both leak.** L1 is not a place derivation loses to Apple; it is a place neither system derives, and Apple has never claimed to. The difference is that an authored `data-shell` value is enumerable and checkable, and a nib is not. |
| Materials / vibrancy / SF Symbols | Symbol weights and optical sizes that track the enclosing text style automatically. | **Falls short** — no equivalent here. Not this slice; see below. |

The pattern across the row: Apple's solver is stronger and Apple's tuning is
better, but **every Apple mechanism in this table is authored by a human with
eyes and none of it is machine-checkable.** Where derivation wins it wins twice,
because it wins on the capability *and* on the proof. Where it loses — the
constraint solver, the type ramps — it loses to human judgement that the table
can simply absorb as a floor, which is what `--min-target`, `--min-avatar`,
`--min-text` and `--min-track` already are.

---

## Open questions for the maintainer

1. **Does `--columns` fit the measured-tier budget?** Probe 4 needs one
   max-content probe per (context × cell kind) plus a resize observation per
   grid. The README prices the whole measured tier at ~35 lines and ~5% of the
   idea. Is one cached measurement per `(density, input, cell-kind)` key
   acceptable, or does the grid have to stay CSS-only and therefore T?
2. **Off-flow measurement vs F10.** `--columns` and N710 both resolve values in
   an off-flow sandbox with no available space. F10's rule is that a solver must
   measure the world it creates. Is an off-flow probe a legitimate exception —
   it measures an *intrinsic* extent, which by definition does not depend on the
   world — or is it the same class of mistake in a new costume?
3. **Who owns the nominal content extent?** N710's floor side needs a promise
   like "a cell holds at least 12 characters of its own text". That is the one
   number in this proposal that is a judgement call, and it belongs either to
   the table (one value, applies everywhere) or to the role (one per role, more
   accurate, more numbers). It is the same kind of decision as `--min-avatar`,
   so my instinct is the table — but it is a promise about *content*, which no
   other floor is.
4. **`order` and `row-reverse`: forbid outright, or allow with `reading-flow`
   declared?** N712 can be satisfied either way. Forbidding is simpler and
   closes L2 completely; allowing keeps an escape for a case I could not
   construct.
5. **Is `data-shell` the moment the vocabulary starts growing per product?** Four
   values cover the shells I can name. If the fifth product needs a fifth value,
   the enum was the wrong shape and app-shell topology should have been an
   escape from the start. Worth deciding before the first value is added rather
   than after the fourth.
6. **`repeat(auto-fit, …)` is obliged by the grammar to name a number.** If
   `--columns` is rejected (Q1), the table keeps a magic number forever and
   N710/N711 become permanent rather than transitional. Is that acceptable, or
   is it worth filing a `csswg-drafts` issue asking for an intrinsic auto-repeat
   minimum — `repeat(auto-fit, minmax(min-content, 1fr))` — given the layout
   cycle is exactly the one `fit-content()` already resolves for a single track?

---

## Belongs to another slice

- **`field-sizing: content` is supported** in Chrome 151 (measured). A text
  input's intrinsic width is currently defeated with `min-inline-size: 0`
  (`roles.css:187`) precisely because its natural width comes from the `size`
  attribute; `field-sizing: content` makes it derivable instead. → controls slice.
- **`text-wrap: pretty` is supported** (measured). And the README's own
  "single word cannot wrap" mis-story came from missing that
  `overflow-wrap: anywhere` releases min-content — the min-content contribution
  of a text node is the hinge on which every crush in this slice turns.
  → text/typography slice.
- **`content-visibility: auto` + `contain-intrinsic-size`** interact with
  `checkVisibility({ contentVisibilityAuto: true })` in
  `diagnostics/dom.ts:67`. Whatever code covers skipped subtrees needs to know
  that a skipped subtree has a *placeholder* size, so every geometric assertion
  against it is measuring a guess. → verification slice.
- **`Metrics.overflows()` has a directional blind spot** (measured, Probe 3):
  `scrollHeight`/`scrollWidth` cannot see block-start or inline-start overflow.
  Proposed as N715 here, but the fix is in `contracts.ts:91` and its DOM
  adapter. → diagnostics slice.
- **Range style queries work on unregistered custom properties** in Chrome 151
  (measured, Probe 9). If the theme starts branching on magnitudes, whether to
  require `@property` registration is a theme-layer decision with cross-browser
  risk. → theme slice.
- **`grid-template-rows: masonry` and `item-flow` are both unsupported** in
  Chrome 151 (measured `false`). Anyone proposing masonry should know it is not
  available on this baseline.
- **`container-type: scroll-state` is supported** (measured). Relevant to the
  README's one deliberate open item — the flush surface that clips a wide table
  rather than scrolling it. → overflow/scroll slice.
- **`interpolate-size: allow-keywords` and `calc-size()` are supported**
  (measured). These animate *to and from intrinsic sizes*, which is the one
  thing that used to force a pixel value into a transition. → motion slice.
