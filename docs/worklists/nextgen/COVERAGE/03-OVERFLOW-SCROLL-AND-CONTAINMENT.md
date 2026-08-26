# overflow, scrolling and containment — intent coverage audit

**Date**: 2026-08-25 · **Kind**: coverage audit, measured where marked
**Slice**: whether "this content must never be lost" versus "this decoration may
be trimmed" is a *derivable* distinction, and what clipping, scrolling and
containment cost the engine and the checker.
**Baseline**: `experiments/c11-appearance` (240/240 clean), which carries the one
declared open defect in this area: *"the flush surface clips a wide table rather
than scrolling it (silent loss); the scroll-region fix was specified and is not
fully landed."*

**Probe**: `experiments/coverage/03-overflow.html` — plain HTML+CSS+JS, no build,
no dependency. Measured in headless Chrome **151.0.0.0** (macOS arm64), spawned
with `--disable-features=OverlayScrollbar`, and cross-checked in the harness's
own headless Chromium.

## Coverage in one line

**D 16 · T 14 · L 7 · X 2 — of 39 capabilities audited.**

Net new author vocabulary: **+1 attribute, −1 attribute = 0.** The declaration
that today spells the defect (`data-scroll-region`, authored per callsite in
`ui/patterns/data-table.ts:85`) is *deleted* and replaced by a derived
promotion; the only thing an author still declares is the rarer, unsafe
direction: `data-clip="trim"`.

---

## The leaks, first

### L1 — `content-visibility: auto` makes the checker report PASS on content it cannot see. **Measured yes.**

This is the answer to question 2, and it is the most damaging finding in the
slice, because it is a *false PASS in the oracle*, which is the failure mode the
c11 README names as the kill criterion.

Measured on a `content-visibility: auto` box 6000px below the fold (probe §G,
`C.contentVisibility_auto_offscreen_SKIPPED`):

| measurement | value | consequence |
|---|---|---|
| clipper `scrollWidth` / `clientWidth` | `200 / 200` | `domMetrics.overflows()` (`fit/dom.ts:50`) → **false** |
| clipper `clientHeight` / `scrollHeight` | `40 / 40` | the `contain-intrinsic-size` placeholder, **not** real content (real content is 17px tall) |
| clipper `rendered()` per `fit/dom.ts:117` | **true** | the checker measures it and believes the numbers |
| skipped child `getBoundingClientRect()` | **0 × 0** | |
| skipped child `offsetWidth` | **471** | two layout APIs disagree about the same node in the same frame |
| skipped child `checkVisibility()` | **true** | the `display: contents` false-PASS shape, again |
| skipped child `checkVisibility({contentVisibilityAuto: true})` | **false** | so `rendered()` says "not rendered" and every rule does `continue` |

The kill: **N680 is only ever emitted when a rule throws.** `runner.ts:67` wraps
each rule in `try/catch` and converts a throw into `incomplete`. Nothing else
produces N680. A skipped subtree does not throw — every measuring rule reaches
its `if (!inspector.rendered(node)) continue;` line (e.g.
`rules/fit-state.ts:27`) and returns *no findings*. The report says PASS. The
prototype's own principle — "a checker that cannot measure must say so rather
than pass" — is implemented for one cause (a throwing rule) and silently
violated for another (an unmeasurable subtree).

Spec corroboration, beyond the measurement: css-contain-2 states that for
skipped contents *"the skipped contents of an element never change their size.
If these elements become non-skipped later, the resize observation will be
delivered"* — so a `[data-fit]` container inside a skipped subtree receives **no
ResizeObserver callback at all**, and `fit/observe.ts:35` never re-solves it.
The engine is blind on the same axis as the checker.

The honest nuance, which matters: `content-visibility: auto` does **not** destroy
content for the *reader*. The same spec requires that skipped contents of `auto`
*"must still be available as normal to user-agent features such as find-in-page,
tab order navigation, etc., and must be focusable and selectable as normal"*.
So this is not an N710 loss. It is purely an **unverifiability** leak: the page
is fine and the proof is worthless.

Cheapest honest option, in order of preference:
1. **Forbid it in the table** and require `data-escaped` for any subtree that
   wants it (reports itself as N601). One table rule; the 10KB core keeps its
   ability to prove things.
2. If it is wanted for long lists, **make undecidability loud**: the `Inspector`
   grows one member, `skipped(node)`, and the *runner* — not each rule — emits
   N680 for every clipper or fit container with a skipped subtree. Rules must
   never convert "cannot measure" into `continue`.

`contain: size` — the other half of question 2 — **does not blind the checker**:
measured `scrollWidth 516` against `clientWidth 200`, `c11_overflows: true`, and
it is not a clipper (`clipKind: null`), so the overflow is real and correctly
reported as a crush. `contain: size` is a leak for a different reason (L5).

### L2 — `position: sticky` and a derived horizontal scroll region are mutually exclusive. **Measured.**

Probe §D, with a control that proves the measurement can pass:

| fixture | ancestor | header offset after 2586px of page scroll | stuck |
|---|---|---|---|
| D3 **control** | plain surface, no clip, no scroll | **59.25px** | **yes** |
| D1 | inside `[data-scroll-region]` (`overflow-x: auto`) | 0px | **no** |
| D2 | inside `[data-appearance=surface][data-flush]` (`overflow: hidden`) | 0px | **no** |

Two things follow. First, sticky is *already* dead inside a flush surface today
— `overflow: hidden` establishes a scrollport that cannot scroll, so a sticky
header inside it has a zero-length sticky range. The scroll fix does not cause
this regression; it inherits it. Second, it cannot be fixed by declaring
anything, because css-overflow-3 forces it: *"if the other axis specifies a
scrollable value, a specified value of `visible` computes to `auto`"* — measured,
`overflow-y` computed **`auto`** on a region that only ever asked for
`overflow-x: auto`. A horizontally scrolling region is a *two-axis* scrollport
whether it wants to be or not, and page-relative sticky inside it is inert.

The only spelling that escapes is `overflow-x: clip; overflow-y: visible` (clip
does not force the other axis — same spec paragraph, *"if only one axis computes
to a scrollable value (i.e. the other axis is clip), the box is a single-axis
scroll container"*), and clip does not scroll, so it is not available to us.

Cheapest honest option: accept the trade and make it *visible* — a new
diagnostic (N711) that reports a sticky element whose nearest scrollport cannot
scroll on the sticky axis, so the no-op is never silent. Sticky *inline*-axis (a
frozen identity column) is unaffected and works inside the derived region.

### L3 — the accessible name of a derived scroll region is not derivable.

The engine can derive that a region scrolls, that it must be keyboard-reachable
(`tabindex="0"`, measured written by the derivation), and `role="region"`. It
cannot derive the *name*. `data-table.ts:87` makes `role="region"` conditional on
a caption existing precisely because an unnamed landmark is worse than none —
that reasoning is correct and it is a leak: a table with no caption gets a
reachable, unnamed scroll region. No measurement can invent a name.

Cheapest honest option: no new declaration. Treat the missing caption as the
defect and report it. The name already exists in the component's own props on
every real callsite; a captionless data table is a content bug.

### L4 — `contain-intrinsic-size` is a per-callsite pixel estimate.

`content-visibility: auto` is useless without it, and its value is a guess about
content nobody has laid out yet. Measured: the skipped box reported
`clientHeight 40` — exactly the declared placeholder — while its real content was
17px tall. `auto <length>` remembers the last real size after first render, which
narrows the leak to the first paint but does not close it. If L1 is resolved by
forbidding `content-visibility: auto`, this leak disappears with it.

### L5 — `contain: size` makes a box's size an authored fiction.

Legitimate uses exist (c11 already uses `contain: inline-size` for truncators,
`structure.css:238`, where the intent *is* "this box's inline size is imposed on
it, never derived from it" — a derived use, verdict **D**). But `contain: size`
in the block axis has no intent to derive from: something must supply the size,
and that something is a number at a callsite. Cheapest honest option: leave it
out of the vocabulary; it is available through `data-escaped`.

### L6 — a scroll region nested inside a fit container blinds the solver. **Measured.**

`data-table.ts:45-51` already states this as a rule ("the scroll region is never
nested inside one"), and the measurement shows what happens when the rule is
broken (probe §E):

| fixture | row `scrollWidth/clientWidth` | c11 `overflows()` | c11 `crushed()` | unreachable inside the region |
|---|---|---|---|---|
| E1, `flex: none` (the c11 no-crush block) | 598 / 358 | **true** | false | 0px |
| E2, same region declared `data-grow` | **358 / 358** | **false** | **false** | **248px** |

E2 is a settled row with a quarter of its content off-screen and no finding of
any kind. Both predicates miss it: `overflows()` because css-flexbox-1 §4.5 says
*"for main-axis scroll containers the automatic minimum size is zero, as usual"*,
so the region absorbs without limit; `crushed()` because
`fit/dom.ts:99` exempts any descendant whose `overflow-x` is scrollable — which
is the right exemption for a *top-level* scroller and exactly wrong for one
nested inside the container being solved.

Good news for the current prototype: E1 shows the existing no-crush block
(`structure.css:189`, `[data-layout] * { flex: none }`) accidentally protects the
solver — the region refuses to shrink, so the row overflows honestly. The leak is
one `data-grow` away, and `data-grow` is a legal declaration.

Cheapest honest option: a structural rule, not new vocabulary — the derivation
refuses to promote inside a `[data-fit]` subtree, and N712 fails if a scrollport
is ever found there.

### L7 — scroll *snap* has nothing to derive from.

`scroll-snap-type` is correct for a paged carousel and actively harmful on a
data table. The difference is not measurable: both are "a scroll container with
children". It needs a role that the closed `appearance` axis does not have
(`VOCABULARY.appearance` in `contracts.ts:62`), and adding one is a real
vocabulary cost paid for a capability none of the four demo pages needs.

### X1 — custom scrollbars (`::-webkit-scrollbar`)

Non-standard, and worse: styling them **changes layout behaviour**, because a
custom scrollbar is never an overlay scrollbar. Measured in the harness's
Chromium: a plain `overflow-y: scroll` box consumed **0px**; the same box with
`::-webkit-scrollbar { width: 15px }` consumed **15px**. A design system that
themes its scrollbars silently opts every scroll container into the classic
15px-swing world (see the B probe). Escape hatch only, and it must be loud.

### X2 — scroll-driven animations for decoration

`animation-timeline: scroll()` / `view()` are supported (measured) and are motion
design, not layout intent — they belong to the motion slice. The *engine* uses
the same primitive internally for a derived edge affordance (D8), which is not
the same capability.

---

## Capability table

Verdicts: **D** derived · **T** one table rule, app-wide · **L** leak · **X** escape.

| capability | CSS today | verdict | intent declaration | notes |
|---|---|---|---|---|
| clip-vs-scroll as *intent* | author picks `overflow` per box | **D** | *nothing* — absence of `data-clip` means loss is forbidden | measured: 414px / 39 nodes recovered with zero declarations (§A) |
| "this decoration may be trimmed" | `overflow: hidden` | **T** | `data-clip="trim"` | the one new attribute; the table resolves it to `clip`, never `hidden` |
| `overflow: hidden` | authored | **T** | — | engine never emits it: it is programmatically scrollable, which is defect D6 |
| `overflow: clip` | authored | **T** | — | what `data-clip="trim"` resolves to; measured non-scrollable |
| `overflow-clip-margin` | per-callsite length | **D** | — | `calc(var(--unit) / 2)`; measured to extend paint **and hit testing** by exactly 4px (§D7) |
| `overflow: auto` | authored per callsite | **D** | — | derived promotion; today `data-scroll-region` at `data-table.ts:85` |
| `overflow: scroll` | authored | **T** | — | never emitted: `auto` plus a derived affordance (D8) is strictly better |
| `overflow: overlay` | legacy | **T** | — | spec: *"legacy value alias of auto"*; measured computed value `auto` → the `overlay: true` entries at `fit/dom.ts:38` and `crushed.ts:65` are **dead code** |
| single-axis overflow | `overflow-x` alone | **T** | — | measured: `overflow-x: auto` forces computed `overflow-y: auto` (spec §3.1) — the table must spell both axes deliberately |
| which box becomes the scrollport | authored wrapper | **D** | — | the clipper's single in-flow child, wrapped if absent; measured that promoting the *overflowing* box is a no-op (§probe bug 1) |
| `overflow` on `<table>` | authored | **T** | — | never a promotion target: measured 414px still lost after promoting the `<table>` |
| keyboard reachability of a scrollport | `tabindex="0"` authored | **D** | — | engine writes it with the promotion; measured present on both derived ports |
| accessible name of the region | `role`+`aria-labelledby` authored | **L** | — | see L3 |
| `scrollbar-gutter` | authored | **D** | — | `stable` on every derived scrollport; measured to remove **79 of 79** bistable widths (§B) |
| `scrollbar-width` | authored | **T** | — | one rule; `thin` is a density decision, not a callsite one |
| `scrollbar-color` | authored | **T** | — | derived from theme tokens; `color-scheme` (`tokens.css:189`) already does most of it |
| `::-webkit-scrollbar` | non-standard | **X** | `data-escaped` | X1: changes layout, not just paint |
| `position: sticky`, block axis | authored | **L** | — | L2, measured with a passing control |
| sticky inside a clipping ancestor | authored | **T** | — | never possible; the table must not offer it, and N711 reports it |
| sticky, inline axis (frozen identity column) | authored | **T** | — | works inside the derived region; one rule keyed on the table's first column |
| `scroll-snap-type` / `-align` | authored | **L** | — | L7: needs an `appearance` value that does not exist |
| `overscroll-behavior` | authored | **D** | — | `contain` on every derived scrollport; scroll-chaining out of a nested scroller is never the intent |
| `@container scroll-state()` | new | **D** | — | **measured working** (§D8): a derived "there is more this way" edge with zero JS and zero authored values |
| scroll-driven animation for decoration | `animation-timeline` | **X** | motion slice | X2 |
| `contain: paint` | authored | **T** | — | never emitted; measured to clip while `overflow-x` computes to **`visible`** (D5) |
| `contain: content` | authored | **T** | — | same, worse (implies size-independence too) |
| `contain: size` | authored | **L** | — | L5; measured **not** to blind the checker |
| `contain: inline-size` | authored | **D** | — | already derived at `structure.css:238`; measured still measurable (`362/120`), correcting the note at `crushed.ts:28` |
| `contain: layout` / `style` | authored | **D** | — | pure isolation, no visible semantics; the engine may add it to every fit container |
| `content-visibility: auto` | authored | **L** | `data-escaped` | **L1 — the false PASS** |
| `content-visibility: hidden` | authored | **T** | — | a real intent ("not rendered, keeps state"); spec removes it from the a11y tree, so it is not a loss |
| `contain-intrinsic-size` | per-callsite px | **L** | — | L4 |
| `overflow-anchor` | authored | **D** | — | UA default `auto` is already right; the engine's job is not to break it. Not measured — **[UNVERIFIED]** |
| `scroll-margin` / `scroll-padding` | per-callsite px | **D** | — | measured: `scroll-padding-block-start` = the sticky header's own measured height (33.89px) fixes WCAG 2.4.11 (§D6) |
| focus scrolled into view, WCAG 2.4.11 | eyes | **D** | — | measured both ways with `elementFromPoint` (§D6) |
| a focused descendant scrolling its own clipper | silent | **D** | — | derived away by never emitting `hidden`; measured **414px** of permanent displacement (§D4) |
| block-axis clipping (a fixed-height clipper eating rows) | silent | **D** | — | same rule, all four edges measured |
| declared truncation as a clip | `data-collapse="truncate"` | **D** | existing | measured exempt: the A6 fixture is `clip-safe`, not a loss |
| a scrollport nested in a fit container | silent | **L** | — | L6, measured 248px unreachable in a "settled" row |

Counts: **D 16 · T 14 · L 7 · X 2 = 39** (recounted from the rows above, not
asserted).

---

## Measured probes

`experiments/coverage/03-overflow.html`, Chrome 151.0.0.0 headless, macOS arm64,
viewport 1100×800, fixture width 360px. Fixtures marked `data-fixture` are never
mutated, so the defect and its fix are measured **in the same run**.

### A · the open defect, and the derived fix

| fixture | markup | surface `scrollWidth/clientWidth` | meaningful nodes destroyed | wholly destroyed | worst overhang |
|---|---|---|---|---|---|
| **A1 defect** | table directly in a flush surface | **772 / 358** | **39** | **30** | **414.11px** |
| A2 authored | `data-scroll-region` at the callsite | 358 / 358 | 0 | 0 | 0 |
| **A3 derived** | A1 + one wrapper, no declaration | **358 / 358** | **0** | **0** | **0** |
| **A4 derived** | A1 *exactly*, engine generates the wrapper | **358 / 358** | **0** | **0** | **0** |
| A5 control | 900px decorative gradient, `aria-hidden` | 900 / 358 | 0 | 0 | 0 → **not promoted** |
| A6 control | `data-truncate` prose, 172px clipped | 530 / 358 | 0 | 0 | 0 → **not promoted** |

The table's intrinsic width is 772px in a 358px surface: **414px, three and a
half columns — `Latency p99`, `Error rate`, `Deploy`, `Runtime version` — were
being deleted with no scrollbar, no affordance and no finding.**

Reachability after the derived promotion, both A3 and A4:
`scrollLeft` reached **414 / 414 max**, the last column's right edge lands at
375.11 inside a clip edge of 376 (`lastColumnInsideClip: true`), and the loss
recount at full scroll is **0**. Visually confirmed by screenshot: the derived
region scrolled to its end shows `ERROR RATE / DEPLOY / RUNTIME VERSION` with a
scrollbar, *inside* the surface's rounded corners — the clip that the flush
surface exists for is still doing its job.

The derived rule needs **no new attribute**: a box that clips, plus measured
loss of content that carries text or focus, plus no declared degradation
covering it. A5 and A6 prove it is not a blanket promotion.

### B · a scrollbar appearing makes the fit solver bistable

The platform tries to hide this question. Measured scrollbar consumption:

| scrollbar | width consumed |
|---|---|
| default `overflow-y: scroll` (macOS overlay) | **0px** |
| `scrollbar-width: thin` | 0px |
| `scrollbar-width: none` | 0px |
| custom `::-webkit-scrollbar { width: 15px }` | **15px** |

With classic (custom) scrollbars, a panel's `clientWidth` swings **343 ↔ 358**
as its vertical scrollbar comes and goes — a 15px change in the inline space the
fit solver measured.

Then the c11 solve loop (`appearance.ts:59-66`, reproduced verbatim) was run
against a row inside that panel, sweeping the row's required width across the
15px window in 2px steps, 8 passes each:

```
label width 84px → 281/1 → 296/0 → 281/1 → 296/0 → 281/1 → 296/0 → 281/1 → 296/0
```

**79 of 91 swept widths are bistable — a permanent oscillation of the solver,
flickering a timestamp on and off forever.** The same sweep with
`scrollbar-gutter: stable` on the panel: **0 of 91.**

This is a *solver termination* defect surfaced by an overflow property, and the
remedy is one line in the table. It is invisible on macOS with default
scrollbars, which means the 240-cell matrix — macOS, default scrollbars — is
structurally incapable of finding it.

### C · containment, measured against the c11 predicates

| feature | `overflow-x` computed | clipper's `scrollWidth/clientWidth` | c11 `overflows()` | child measurable | verdict |
|---|---|---|---|---|---|
| `contain: paint` | **`visible`** | 523 / 200 | true | rect 522.88 | clips silently; misattributed |
| `contain: content` | **`visible`** | 540 / 200 | true | rect 540.09 | same |
| `contain: size` | `visible` | 516 / 200 | true | rect 516.17 | **does not blind** |
| `contain: inline-size` (truncator) | `hidden` | 362 / 120 | true | — | **does not blind** |
| `overflow: clip` | `clip` | 400 / 200 | true | rect 400 | **still reports scrollable overflow** |
| `overflow: hidden` | `hidden` | 400 / 200 | true | rect 400 | reports |
| `content-visibility: hidden` | `visible` | 200 / 200 | false | rect 0×0, `checkVisibility()` **false** | detectable |
| **`content-visibility: auto`, skipped** | `visible` | **200 / 200** | **false** | **rect 0×0, `checkVisibility()` true, `offsetWidth` 471** | **blinds — L1** |

Two results I did not expect:

1. **`overflow: clip` still reports `scrollWidth 400` against `clientWidth 200`.**
   A clip box is not a scroll container, so I expected `scrollWidth` to collapse
   to the client width and take `overflows()` blind with it. It does not. This is
   what makes "always `clip`, never `hidden`" affordable: the safer value keeps
   the measurement.
2. **`contain: paint` clips while `overflow-x` computes to `visible`.** Every
   clip-detection in the prototype keys on the computed `overflow` value
   (`fit/dom.ts:33`, `crushed.ts:65`), so paint containment is a clipper that
   both tables classify as "content paints outside its box and lands on a
   neighbour" — the right location with the wrong claim, and the solver will try
   to relieve it by degrading siblings, which can never work.

`overflow: overlay` computes to **`auto`** (spec: legacy alias), so no computed
value can ever equal `"overlay"` and both `overlay: true` table entries are
provably unreachable.

### D · sticky, focus, clip margin, WCAG 2.4.11

**D4 — the focus-scroll trap, and why `hidden` must never be emitted.**
`overflow: hidden` is a scroll container that merely hides its scrollbar, so a
clipped descendant receiving focus scrolls it. Measured on the A1 fixture: focus
the last `<th>` → `scrollLeft` **0 → 414**, the first column displaced **414px**
and now entirely outside the clip, with no scrollbar and no wheel to bring it
back. `overflow: clip` measured `programmaticallyScrollable: false`; `hidden`
measured `true`.

This is also where **my own checker was wrong**: the loss pass reported 39 nodes
before focus and 40 after — but the *edges* moved from `end: +414` to
`start: +414`. Version 1 of the probe measured only the inline-end edge and
reported **zero loss after focus**, i.e. a false PASS produced by the fix for a
false PASS. The rule now measures all four edges.

**D6 — WCAG 2.4.11, falsifiably.** Focus a row from the bottom of a scrollport
with a sticky header:

| state | region `scrollTop` | focused row top | in scrollport | element painted at the row's top-left | obscured |
|---|---|---|---|---|---|
| no scroll padding | 8 | 215.52 | true | **`th`** | **yes — violation** |
| derived `scroll-padding-block-start: 33.89px` | 0 | 223.52 | true | `td` | **no** |

33.89px is the sticky header's own measured height. Nothing is authored: the
header measures itself, and the scrollport derives its padding from it.

**D7 — the clip margin extends hit testing, not just paint.**

| point | `overflow: hidden` | `overflow: clip` + `overflow-clip-margin: 4px` |
|---|---|---|
| inside the box | child | child |
| 2px past the edge | `body` | **child** |
| 6px past the edge | `body` | `body` |

So a derived clip margin of `--unit / 2` is enough to keep a focus ring, a
box-shadow or a 1px border on the outermost row from being eaten — and it is
measurable to the pixel, which means it is checkable.

**D8 — the derived affordance.** `@container scroll-state()` works in Chrome 151:
an edge element inside a `container-type: scroll-state` scrollport measured
`background: rgb(0,128,0)` while `scrollable: right` held and `rgb(204,204,204)`
with a red outline (`scrollable: left`) at the end of the scroll. So "there is
more content this way" is derivable with zero JavaScript and zero authored
values — which matters because with overlay scrollbars the derived scroll region
otherwise makes an **invisible** promise.

### The probe's own defect log — five oracle bugs to two page bugs

Kept because it is the cost signal the c11 README says to watch:

1. **Promoted the wrong box.** The first derivation descended to the deepest
   overflowing element and made the `<table>` the scrollport. Measured result:
   414px still lost. A scroll container whose own inline size is content-derived
   scrolls nothing; the scrollport must be the box that inherits the *clipper's*
   constrained width.
2. **Measured one edge.** See D4: silent the moment the loss moved to the
   inline-start side.
3. **Ignored intervening scrollers.** The loss pass compared descendant rects
   against the clipper and reported **16 lost columns inside a working scroll
   region** (A2, and both sticky fixtures). A node is only lost if no scroll
   container sits between it and the clipper.
4. **Asked the wrong box whether it could be measured.** The guard called
   `checkVisibility()` on the *clipper*, which is not skipped — only its contents
   are. It returned `true`, the pass found nothing, and reported clean. Fixed by
   asking every descendant.
5. **`focus()` on an already-focused element is a no-op** and performs no
   scroll-into-view, so the WCAG remedy measured a stale scroll position and
   reported "not obscured" when the row was simply off-scrollport.

Plus two environment defects worth recording: `requestAnimationFrame` never
fires in a headless tab with `visibilityState: hidden` (the probe hung, silently,
with no error — every settle step is now a macrotask plus a forced reflow), and
`elementFromPoint` returns `null` outside the viewport, which produced five nulls
that read exactly like "the clip swallows hit testing".

Five of seven were in the checker. That ratio is now measured twice,
independently, on the same idea.

---

## Proposed vocabulary

**One new author attribute. One deleted. Net zero.**

```
data-clip="trim"        this box may trim what overflows it, because what
                        overflows is decoration. The table resolves it to
                        `overflow: clip` plus a derived `overflow-clip-margin`.
                        ABSENT (the default) means loss is forbidden.

data-scroll-region      DELETED from structure.css:154 and data-table.ts:85.
                        Replaced by derivation.
```

The direction of the default is the whole proposal. Today `data-flush` *silently
implies* `overflow: hidden`, so the destructive behaviour is the default and the
safe behaviour is the thing an author must remember. Inverting it means the
failure mode of forgetting is a scrollbar, not deleted data.

Engine-written state, not author vocabulary (the same status as `data-truncate`,
which the mutator writes at `fit/dom.ts:130`):

```
data-scrolls            written on the promoted scrollport
data-scrollport         written on a wrapper the engine had to generate
```

The resolution-table rules these two state attributes carry:

```css
[data-scrolls] {
  overflow-x: auto;              /* auto, never scroll: no permanent furniture */
  min-inline-size: 0;            /* survive a flex or grid parent */
  scrollbar-gutter: stable;      /* the 79/91 bistability fix */
  overscroll-behavior-inline: contain;
  container-type: scroll-state;  /* the derived edge affordance */
}
[data-clip='trim'] {
  overflow: clip;                /* never hidden: not programmatically scrollable */
  overflow-clip-margin: calc(var(--unit) / 2);
}
```

What I would delete to pay for it, beyond `data-scroll-region`: the `overlay:
true` entries in `fit/dom.ts:38` and `crushed.ts:65` (provably dead), and the
`overflow: hidden` in `roles.css:250` — the flush surface's clip becomes
`data-clip="trim"` resolved by the table, which is the same paint with a
declared reason and a checkable one.

---

## Proposed diagnostics

Numbering starts at **N710**: N700 is taken by the orchestrator's
competing-primary-actions rule.

### N710 — clipped content lost (`fail`)

*A box clips, and what it clips carries meaning: text, or something focusable.
No scroll affordance exists and no declared degradation covers it.*

This is the third member of the family: N621 covers the *solver* destroying a
value, N690 covers the *table* destroying a word, N710 covers the *box*
destroying content outright. It is the only one of the three that is currently
silent.

Detection must not key on the computed `overflow` value: measured, `contain:
paint` and `contain: content` clip while `overflow-x` computes to `visible`.
Comparison is against all four edges of the clipper's padding box, and a
descendant with a scroll container between it and the clipper is reachable, not
lost.

**Fixture that proves it can fail**: probe §A1 — a `DataTable` directly inside
`Surface({flush: true})` at 360px. Measured finding:
`overflow:hidden/hidden destroys 39 meaningful node(s) (30 entirely, worst
overhang 414.11px)`. The same page, in the same run, reports **nothing** for A3
and A4 after the derivation — so the rule is proven to both fail and pass on the
same geometry.

### N711 — sticky is inert (`warn`)

*An element declares `position: sticky` on an axis whose nearest scrollport
cannot scroll, so the declaration does nothing.*

**Fixture**: probe §D1 and §D2 — a sticky `<th>` inside `overflow-x: auto` and
inside `overflow: hidden`, both measured `stuck: false` after 2586px of page
scroll, against the §D3 control measured `stuck: true` at 59.25px. The control is
the falsifiability proof: without it, a rule that always fires and a page that
never sticks are indistinguishable.

### N712 — scrollport inside a fit container (`fail`)

*A scroll container was found inside a `[data-fit]` subtree, so the solver's
overflow signal is meaningless: the region absorbs any amount of content.*

**Fixture**: probe §E2 — the region declared `data-grow`, measured row `358/358`
with `overflows() === false`, `crushed() === false`, and **248px** unreachable
inside the region. §E1 is the negative control: same markup without `data-grow`,
row `598/358`, honestly overflowing.

### N713 — scrollport unreachable by keyboard (`fail`)

*A scroll container holds content that can only be reached by scrolling, and it
is neither focusable nor does it contain a focusable descendant.*

**Fixture**: delete the `tabindex` line from the derivation and re-run A4. Today
the engine writes it (measured `tabindex: "0"` on both derived ports), so this
rule exists to prove the engine kept doing so.

### And one change that is not a new code

**N680 must be emitted by the runner, not only by a `catch`.** Measured: a
skipped `content-visibility: auto` subtree produces zero findings and a PASS
(`runner.ts:67` is the only N680 path; every rule turns undecidability into
`continue`). The `Inspector` needs one new member — `skipped(node)` — and the
runner needs to raise N680 for any clipper or fit container whose subtree is
skipped. **Fixture**: probe §G — measured `N680 incomplete` for three
`content-visibility: auto` nodes once the pass asks the right box.

---

## Against Apple

| capability | what Apple does | derivation |
|---|---|---|
| clip vs. scroll | `clipsToBounds` / `.clipped()` — a boolean an engineer sets, with no notion that clipping might destroy data and no checker of any kind | **beats.** The distinction is measured (414px, 39 nodes) and machine-checkable. Apple has no equivalent of N710 and could not have one: nothing declares which clips are safe. |
| deciding a region scrolls | authored: you place a `UIScrollView` / `ScrollView`. Auto Layout then derives its *content size* from constraints, which is genuinely strong | **beats on the decision, matches on the arithmetic.** Apple derives how big the content is; a human still decides that it scrolls. |
| everything-scrolls as a default | UIKit's culture puts nearly every screen in a scroll view, which is why Dynamic Type at AX5 degrades gracefully rather than clipping | **loses.** This is the honest one: Apple's *default* is better than the web's, and our derivation is how we reach the same default without an author decision. We are catching up to their default, then adding a proof they do not have. |
| pinned section headers | `UITableView` section headers pin automatically, derived from *structure* (sections), inside the scroll view, in both axes, with no scrollport trap | **loses.** Measured: our derived horizontal region kills page-relative sticky (L2). Apple's scroll view is the scrollport in both axes, so pinning and horizontal scrolling coexist. We cannot match this in CSS today. |
| "there is more content" | `flashScrollIndicators()` on appearance — the system *tells* the reader, once, unprompted | **matches, and becomes checkable.** `@container scroll-state()` (measured working) makes a derived edge affordance possible with no JS. Apple's is a nicer gesture; ours can be asserted by a rule. |
| focus not obscured | `scrollRectToVisible`, `keyboardLayoutGuide`, and for the header case a `contentInset` a human tunes | **beats.** Measured: the sticky header's own height derives `scroll-padding-block-start`, and `elementFromPoint` turns WCAG 2.4.11 into a falsifiable assertion. Apple's answer is an authored inset with no checker. |
| Auto Layout priorities vs. our `data-priority` | a true simplex solver: it can trade constraints globally and find the least-bad answer | **loses as a solver, wins as a contract.** c11's F11 states it plainly — priority orders *when* a strategy is spent, never *whether*. Apple's solver is stronger and its result is not machine-checkable; ours is weaker and every outcome is asserted. For "content must never be lost", checkable beats optimal. |
| scroll containment / rubber-banding | `bounces`, `alwaysBounceHorizontal` — per-view booleans | **beats.** `overscroll-behavior: contain` on every derived scrollport is not a decision anyone should make per callsite. |

Apple's real weakness holds up under measurement: their system is authored by
humans with eyes, and there is no `flashScrollIndicators()` equivalent of "prove
that no view on this screen clips data". Their real strength also holds up: for
*pinned structure* and for *constraint solving*, they are ahead, and in the
sticky-vs-horizontal-scroll case the platform, not the philosophy, is what stops
us.

---

## Belongs to another slice

- **FitDomain / LayoutSizing** — the 79/91 bistability (§B) is a **solver
  termination** defect, not an overflow defect. `solveFit` has no fixed-point
  guarantee: any degradation that changes an ancestor's inline size can flip the
  measurement it was based on. `scrollbar-gutter: stable` closes the scrollbar
  cause; the general property is unproven.
- **DiagnosticsDomain** — N680 is emitted only from `runner.ts:67`'s `catch`.
  Every rule converts "cannot measure" into `continue`, so *any* future cause of
  undecidability is a silent pass. This is a structural issue with the runner
  contract, not with any single rule, and it is bigger than my slice.
- **VerificationDomain** — the 240-cell matrix runs on macOS with overlay
  scrollbars and can never observe a 15px scrollbar swing. A second pass with
  `--disable-features=OverlayScrollbar` (or a `::-webkit-scrollbar` fixture)
  costs one flag and covers a class of defects that is currently unprovable.
- **ThemeDomain** — two provably dead table entries (`overlay: true` at
  `fit/dom.ts:38` and `crushed.ts:65`), and the note at `crushed.ts:28` ("a
  `contain: inline-size` truncator reports zero intrinsic width") is contradicted
  by measurement: `362 / 120`.
- **OverlaysPosition** — `contain: paint` and `contain: content` create a
  containing block for `position: fixed` *and* clip, so they break anchor
  positioning and clip popovers while `overflow` reads `visible`. Also: the
  derived promotion changes *which* ancestors clip, which changes which popovers
  escape. The top layer is the only reliable answer.
- **AttentionAdaptive** — `@container scroll-state()` is live (measured) and is a
  general "derive an affordance from a runtime state without JS" primitive, not
  just a scroll-edge trick.
- **Orchestrator note (as requested, no decision changed)** — N710 is squarely a
  subtree rule: it asks "what is inside this clipper, and is any of it reachable
  by a scroller in between". It would read better against `obs.declared(selector)`
  scoping than against a global selector plus a `closest()` filter. Same for
  N712, which asks "is any scrollport inside this fit container".

---

## Open questions for the maintainer

1. **Is inverting the default acceptable?** `data-clip="trim"` makes "loss
   forbidden" the default and requires a declaration for the destructive
   direction. It is one attribute and it deletes `data-scroll-region`, so the
   vocabulary does not grow — but it does mean `Surface({flush: true})` changes
   behaviour for every existing callsite.
2. **May the engine insert an element?** The derivation needs a scrollport that
   inherits the clipper's width. Measured: promoting the clipper releases the
   rounded-corner clip, and promoting the overflowing child is a no-op — so with
   bare markup (A4) the engine must generate a wrapper. Today's mutator only
   sets attributes (`fit/dom.ts:129`). The alternative is requiring every flush
   surface to ship a wrapper element, which is a component-author obligation the
   checker would have to police.
3. **Sticky or horizontal scroll?** They are mutually exclusive inside one box
   (L2, measured, spec-forced). For a data table, which one wins — and is a
   sticky *inline* identity column enough compensation?
4. **Do we accept `content-visibility: auto` at all?** It costs us the ability to
   prove anything about the subtree (L1) while costing the reader nothing. My
   recommendation is to forbid it outside `data-escaped` until the runner can
   report N680 for skipped subtrees.
5. **Should the proof matrix gain a classic-scrollbar axis?** It would be a sixth
   axis on a 240-cell matrix, or a single extra run. Without it, §B's defect
   class stays invisible to CI.
