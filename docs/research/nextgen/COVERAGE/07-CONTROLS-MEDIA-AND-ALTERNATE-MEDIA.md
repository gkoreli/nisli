# controls, media and alternate media — intent coverage audit

**Date**: 2026-08-25 · **Kind**: coverage audit, measured where marked
**Slice**: native form controls and their UA-imposed limits, replaced media and
responsive-image source selection, and the three media types nobody tests —
print, page zoom, and the user's own font size.
**Baseline**: `experiments/c11-appearance` (240/240 clean)

**Probe**: [`experiments/coverage/07-controls.html`](../../../../experiments/coverage/07-controls.html)
**Browser**: Chromium 151.0.0.0, headless, macOS arm64, dpr 1.25 unless stated.
Reproduce: open the file over `file://`, call `window.measure()`.

---

## Coverage in one line

**D 17 · T 16 · L 15 · X 3 — of 51 capabilities audited.**

Two thirds of this slice is reachable from intent. The remaining third is
concentrated in two places, and they are not the places the thesis expected:
**controls the user agent refuses to let the table size** (7 leaks), and **the
user's own font size** (1 leak that invalidates every derived value in the
system).

---

## The leaks, first

### L1 — WCAG 1.4.4 is failed by construction. Every derived value ignores the user's font size.

`--unit-base: 4px` and `--text-base: 14px`
([`tokens.css:21,27`](../../../../experiments/c11-appearance/src/theme/tokens.css)) are
absolute lengths. Every value in the system is a multiple of them. Therefore
nothing in the system responds to the browser's default-font-size setting, which
is the only text-resize mechanism on Chrome and the mechanism behind Firefox's
text-only zoom.

Measured, same page, three root font sizes:

| root font-size | button height | button padding-inline | body text | grid gap |
|---|---|---|---|---|
| 16px | 36px | 16px | 14px | 8px |
| 32px | **36px** | **16px** | **14px** | **8px** |
| 64px | **36px** | **16px** | **14px** | **8px** |

A user who doubles their default font size gets **zero pixels of change**. This
is silent: no check in the prototype can see it, because every assertion is
relative to the same frozen unit. It is the one leak in this slice that is not a
gap in coverage but a hole in the foundation.

The same page with `--unit-base: 0.25rem` and the type ramp in `rem`, nothing
else changed:

| root font-size | button height | padding-inline | body text | grid gap | document |
|---|---|---|---|---|---|
| 16px | 36px | 16px | 14px | 8px | 1080 / 1080 fits |
| 32px | 72px | 32px | 28px | 16px | 1080 / 1080 fits |
| 64px | 144px | 64px | 56px | 32px | **1807 / 1080 overflows** |

**Cheapest honest option**: change the four token bases to `rem` — a five-line
edit in one file. But it is **not** "one table rule and done", which is why this
is an L and not a T: at 4× it converts a silent accessibility failure into a
live fit problem, and the measured pass has never been run against a 4× root
font. It also makes a print constraint unsatisfiable (see L2). The honest
statement is that `rem` is correct and it hands the solver a load it has not
been proven to carry.

### L2 — `break-inside: avoid` becomes unsatisfiable under the fix for L1. F9's class, in the print axis.

Print, A4, `@page { margin: 12mm }` → 1032px of page content height. Tallest box
carrying a computed `break-inside: avoid`:

| context | tallest avoid-box | unsatisfiable boxes |
|---|---|---|
| comfortable / pointer | 103px | 0 |
| comfortable / touch | 134px | 0 |
| compact / pointer | 97px | 0 |
| compact / touch | 106px | 0 |
| dense / pointer | 91px | 0 |
| dense / touch | 100px | 0 |
| **rem unit @ 64px root** | **2678px** | **3** (2678, 2180, 1586px) |

This is
[F9](../../../../experiments/c11-appearance/README.md) again — *the resolution
table stating an impossible constraint* — arriving through an axis nobody
audited. The table says "do not break a card"; the context makes a card 2.6
pages tall. **Cheapest honest option**: a diagnostic (N713 below), and the
invariant that a print `break-inside: avoid` must be conditional on the box
fitting the page area, not asserted unconditionally.

### L3 — Seven native controls the table cannot size. Measured at `data-input="touch"`, floor 44px.

| control | own border box | label union | clears 44px? |
|---|---|---|---|
| `input[type=checkbox]` | **9.55 × 9.55** | 79.97 × **17.8** | **no, on both** |
| `input[type=radio]` | **9.55 × 9.55** | 53.86 × **17.8** | **no, on both** |
| `input[type=color]` | **50 × 27** | — | no |
| `input[type=file]` | **253 × 21** | — | no |
| `input[type=range]` | 1040 × **16** | — | no |
| `<progress>` | 140 × **14** | — | no |
| `input[data-appearance=field]` with `field-sizing: content`, empty | **33** × 45 | — | no (inline) |

`[data-appearance='action']` and `[data-appearance='field']` both carry
`block-size: max(calc(var(--unit) * 9), var(--min-target))`
([`roles.css:66,169`](../../../../experiments/c11-appearance/src/theme/roles.css)) and both
measure correctly. **None of the seven above respond to that expression at all**,
because their box is the UA's shadow widget and `block-size` on the host does not
reach it. `appearance: base` — the property that would open them — is
**not supported** (`CSS.supports('appearance','base')` → `false` in Chromium
151); only `base-select` shipped.

Note the second row of the checkbox result, because it kills the obvious
defence: wrapping the control in a `<label>` does grow the *clickable* area to
79.97 × 17.8, and **17.8 still fails the 44px floor**. "Click the label" is not
a fix; it is a smaller failure.

**Cheapest honest option**: `[data-appearance='choice']` painted at `1cap` (the
glyph) with the floor moved to the *label row* it lives in, which is a real table
rule; and an explicit `data-escaped` on `color`, `file`, `progress` and `range`,
so the prototype's own N601 counts them instead of the table pretending to own
them. Four declared escapes are more honest than four rules that half-work.

### L4 — `forced-colors: active` erases the invalid signal, and the accent, and preserves the one thing it should not.

Measured under emulated `forced-colors: active`:

| | normal | forced-colors |
|---|---|---|
| field border | `rgb(222,222,223)` | `rgb(0,0,0)` |
| button border | `rgb(222,222,223)` | `rgb(0,0,0)` |
| `accent-color` (checkbox, range) | `rgb(26,79,180)` | **`auto`** |
| scrim (`color-mix(… 40%, transparent)`) | `srgb .066 .066 .078 / .4` | **`rgba(255,255,255,0.4)`** |

Two distinct defects. First, `[aria-invalid='true'] { border-color: var(--danger) }`
([`roles.css:189`](../../../../experiments/c11-appearance/src/theme/roles.css)) is the *only*
painted difference between a valid and an invalid field, so under forced colours
an invalid field and a valid button have byte-identical borders. A state whose
whole signal is a colour does not survive the loss of colour. Second, forced
colours **keeps alpha**: a scrim intended as a 40%-black veil becomes a
40%-*white* veil, i.e. it still obscures, in the one mode where obscuring is
least wanted.

**Cheapest honest option**: a table rule pairing every colour-carried state with
a non-colour channel (`outline`, weight, an icon) plus system colours
(`Mark`/`MarkText`) — and the diagnostic N716 that makes "colour-only signal"
detectable rather than a matter of review.

### L5 — A runtime-derived `sizes` cannot correct an image that has already loaded.

Measured: an image with `srcset` and no `sizes` in a 120px box fetched the
**w1600** candidate. Setting `sizes="120px"` afterwards left `currentSrc`
unchanged — `{ beforeLateSizes: 1600, afterLateSizes: 1600, corrected: false }`.

So the engine's genuine knowledge advantage (it laid the box out; it knows the
width the author does not) is **unusable at runtime for the initial fetch**. The
derivation has to happen before the request, which means the static/SSG tier —
the tier the README lists under *What this does NOT prove*. For eager
above-the-fold images this is the whole game, because that is the LCP image.

### L6 — `sizes` cannot be expressed in container units.

`sizes="100cqw"` fetched the **same w1600** as `sizes="100vw"` and as no `sizes`
at all, in a 120px container. The intuitive "just use container units, the
engine already uses container queries everywhere else" does not exist: a source
size is resolved with no element and therefore no container. **X**, below.

### L7 — 400% zoom's block axis is 256px and nothing has ever been measured against it.

`@media` page zoom at 400% of a 1280×1024 screen is a 320×256 CSS-px viewport.
Measured at 320×256 versus 320×1024, every inline-axis number is **identical**
(document 658/320, 1 grid column, toolbar 339/286, same seven crush findings), so
the prototype's existing 320px column already covers 1.4.10's inline
requirement. The block axis is new:

| context | label + field + button | % of a 256px viewport | screens of vertical scroll |
|---|---|---|---|
| comfortable / pointer | 88.8px | 34.7% | 19.9 |
| comfortable / touch | **107.8px** | **42.1%** | 21.9 |
| dense / pointer | 66.78px | 26.1% | 17.5 |
| dense / touch | 104.31px | 40.7% | 19.9 |

**One labelled field with a submit button consumes 42% of everything the user can
see.** Two fields and a button do not fit. Nothing in the vocabulary expresses
"this group must be reachable without losing its label", and no assertion path
measures the block axis.

### L8 — `<iframe>` content is unknowable and the declared ratio is a guess.

Measured: `[data-media='embed']` with `aspect-ratio: 16/9` produced a
520 × 292.5 box around content 2000px wide. The host derived a box; the content
ignored it. There is no measurement the engine can take and no intent the author
can declare that makes these agree. Irreducible.

### L9 — `1cap` sizes the icon's box; nothing derives the ink inside it.

`1cap` is exact (§C below, ±0.01px over 15 cells). But the checkmark path in the
probe occupies roughly the middle 60% of its 16×16 viewBox, so the *painted*
glyph reads visibly smaller than the caps beside it even though the box is
exactly cap height. Optical size is a property of the icon set's viewBox
discipline. CSS cannot reach it. This is the one place in the slice where Apple's
approach is structurally better (§Against Apple).

### L10 — An icon-only touch target's icon follows the text scale, not the target scale.

Measured at `data-input="touch"`: `--text-scale` 1.06, `--unit-scale` 1.25. A
`1cap` icon grew to 10.45px (text ×1.06) inside a control that grew to 45px
(space ×1.25). For an icon *beside a label* that is right. For an icon that **is**
the label — the overflow-menu trigger, the only icon-only control in the
prototype — the glyph should follow the target. Derivable with
`:not(:has(> :not(svg)))`, but nothing does it today.

### L11 — `fieldset` must never be the transparent host, and only a measurement says so.

Measured, four arrangements (`legendStraddlesBorder` is the observable: a
rendered legend straddles the fieldset's block-start border edge; a demoted one
sits inside the padding box):

| arrangement | fieldset display | legend parent | straddles border | legend top − fieldset top |
|---|---|---|---|---|
| plain | `block` | `fieldset` | **true** | 0 |
| legend inside a `display:contents` host | `block` | **`app-host`** | **true** | 0 |
| fieldset inside a host | `block` | `fieldset` | **true** | 0 |
| **fieldset itself `display: contents`** | `contents` | `fieldset` | **false** | **994.19** |

**`AGENTS.md:113-119`'s warning is refuted as stated, and true one level over.**
A `display: contents` host *between* fieldset and legend does not break the
rendered legend in Chromium 151 — the notch renders, the geometry is byte-identical
to the plain case, and the screenshot confirms it visually. What breaks it is
making the **fieldset** transparent: box 0×0, no frame, legend demoted to an
ordinary block 994px away. Since `structure.css:32-51` makes every `app-*` host
transparent by enumeration, a future `app-fieldset` primitive would land exactly
on the broken arrangement.

### L12 — `el.disabled` and `:disabled` disagree through a fieldset, and the JS answer is the wrong one.

Measured on an input inside `<fieldset disabled>` behind a `display: contents`
host: `{ disabled: false, matchesDisabled: true }`. The IDL property reflects
only the element's own attribute; the pseudo-class reflects the inherited form
state. **A component that derives appearance from a prop gets the wrong answer;
a table that derives it from `:disabled` gets the right one.** This is a leak
only for code that reads props — which is the strongest argument in this slice
for the resolution table existing at all.

### L13 — A scroll region is silent loss on paper.

`[data-scroll-region] { overflow-x: auto }`
([`structure.css:154`](../../../../experiments/c11-appearance/src/theme/structure.css)) is
legitimate on screen precisely because scrolling *promises the rest is
reachable*. On paper there is no scrolling. The promise is void and the clipped
columns simply do not exist, with no ellipsis, no affordance and no finding.
Measured in print at 794px the probe's 720px table happened to fit (720 in
770px of content box), so this leak is currently invisible rather than fixed.

### L14 — A missing intrinsic ratio is a CLS hole the table cannot see.

Measured: `<img width="800" height="450">` resolved `aspect-ratio: auto 800 / 450`
and reserved its box before load. The identical image with no attributes resolved
`aspect-ratio: auto` — same final 318 × 178.88 box, **zero reserved space before
the bytes arrive**. Whether the box is known ahead of the resource is decided by
the asset pipeline, not by any declaration a component can make.

### L15 — `ch`-derived bounds are non-monotonic at the margin.

Unexpected, and measured because a number looked wrong. Same string, same
`max-inline-size: 30ch`, `data-density="dense"`:

| input axis | label font | container | longest line needed | lines |
|---|---|---|---|---|
| pointer | 11px | 226.75px | 226.55px (scaled) | **2** |
| touch | 11.66px | 240.36px | 240.14px | **1** |

The **tighter** context wrapped and the more generous one did not, both within
0.25px of their bound. `ch` is one `0` glyph advance; a label is a sum of
different advances, and the two do not scale identically across font sizes. A
wrap decision that turns on sub-pixel slack is a coin flip in any derived system.
Consequence: `Nch` is safe as a **floor** (§B) and unsafe as a **wrap bound**.

### X1 — `input[type=range]` track and thumb geometry.

`::slider-thumb`, `::slider-track` and `::slider-fill` are **not supported**
(measured `false`); `::-webkit-slider-thumb` is (measured `true`). The only way
to derive a slider's geometry from `--unit` today is a vendor-prefixed
pseudo-element, which is by definition outside the table. `data-escaped`.

### X2 — Autofill presentation.

`:autofill` matches, but the UA paints the autofill background in its own
non-overridable colour in every engine, and `!important` does not reach it.
Nothing the table declares survives. `data-escaped`. **[UNVERIFIED]** — not
measured in this probe; no autofill store exists in headless Chromium.

### X3 — `sizes` in container units.

Per L6: measured to behave exactly as `100vw`. There is no CSS-expressible way
to state "as wide as my container" in a source size. Not even an escape hatch
helps; the capability does not exist.

---

## Capability table

`D` derived · `T` one table rule, app-wide · `L` leak · `X` raw-CSS escape

| capability | CSS today | verdict | intent declaration | notes |
|---|---|---|---|---|
| **CONTROLS** | | | | |
| control height / padding / radius | authored px per component | **D** | `data-appearance="action\|field"` | already shipped; measured 36/27/18/45px |
| text field intrinsic width | authored `width` or `size` | **D** | `field-sizing: content` in the table | §B; UA default is a flat 180px for every purpose |
| text field minimum width | authored px | **T** | keyed on existing `type` / `inputmode` | `14ch`/`24ch`/`8ch`; **zero new vocabulary** |
| text field maximum width | authored px or `%` | **D** | `max-inline-size: 100%` | measured: 200px container bounds a 369px value, clips as declared |
| `<textarea>` block size | JS auto-grow or authored rows | **D** | `field-sizing: content` + unit floor/ceiling | 36 / 120 / 160px for 1 / 6 / 40 lines |
| `<select>` closed box | `appearance: none` + custom arrow | **D** | `data-appearance="field"` | measured 73 × 36 |
| `<select>` picker, options, checkmark, icon | JS listbox reimplementation | **T** | one `::picker(select)` block | §E; Chromium/Safari only, Firefox unshipped |
| checkbox / radio glyph | `appearance: none` + hand-drawn | **T** | `data-appearance="choice"` + `1cap` | measured 9.55px, correct as a glyph |
| checkbox / radio hit target | authored padding on the label | **L** | — | union 79.97 × **17.8** vs 44 floor |
| `accent-color` | authored per control | **D** | `accent-color: var(--accent)` | measured `rgb(26,79,180)`; `auto` under forced colours |
| slider track / thumb | `-webkit-` pseudos | **X** | `data-escaped` | `::slider-*` unsupported |
| `type=color` box | unstyleable | **L** | `data-escaped` | 50 × 27, ignores the table |
| `type=file` box | unstyleable | **L** | `data-escaped` | 253 × 21 |
| `<progress>` / `<meter>` | `-webkit-` pseudos | **L** | `data-escaped` | 140 × 14 |
| date/time field internals | `::-webkit-datetime-edit-*` | **L** | `data-escaped` | outer box derives (151 × 36); internals do not |
| validation presentation | authored error colour + JS toggle | **D** | `:user-invalid` + `data-text="meta"` | §G; measured border and text both `rgb(180,35,31)` |
| validation message text | authored per rule | **D** | `validityState` / `validationMessage` | UA-localised for free |
| label association | ad-hoc | **D** | generated `for`/`id` + `aria-describedby` | already shipped, `field.ts:47-66` |
| target expansion via label | authored padding | **T** | the label row carries `--min-target` | insufficient alone — see L3 |
| `inputmode` / `enterkeyhint` | authored per input | **D** | they already *are* intent declarations | the table should read them, not duplicate them |
| `fieldset` under a transparent host | — | **D** | ordinary `<fieldset>` + `<legend>` | measured identical to plain; L11 refutes the AGENTS.md warning |
| `fieldset` as the transparent host | — | **L** | forbid it | frame and legend destroyed |
| disabled state | `el.disabled` prop | **L** | `:disabled` in the table | prop says false, pseudo says true |
| focus ring | authored per component | **D** | `:focus-visible` in the table | already shipped, `roles.css:366-372` |
| native chrome colour scheme | authored | **D** | `color-scheme` on the theme axis | already shipped, `tokens.css:189-192` |
| **MEDIA** | | | | |
| intrinsic ratio / CLS | `width`+`height` attrs, remembered | **D** | intrinsic attributes | measured `auto 800 / 450` |
| missing intrinsic ratio | nothing warns | **L** | — | measured `aspect-ratio: auto`, no reserved box |
| `object-fit` / `object-position` | authored per image | **T** | `data-media="cover\|contain\|fill"` | 3 values, one attribute |
| `srcset` candidate set | asset pipeline | **T** | build-time | not a component decision |
| `sizes` for lazy images | hand-written media list | **D** | `sizes="auto"` + `loading="lazy"` | §F; Baseline 2026-04 |
| `sizes` for eager / LCP images | hand-written media list | **T** | emitted by the SSG tier | 8× narrower candidate measured; **L at runtime** (L5) |
| `sizes` in container units | — | **X** | — | `100cqw` ≡ `100vw`, measured |
| `<video>` sizing | authored | **T** | same `data-media` roles + poster ratio | inherits the image answer |
| `<iframe>` content size | authored ratio, guessed | **L** | — | 520 × 292.5 box around 2000px content |
| SVG icon size | authored px per icon | **D** | `1cap` from the inherited font | §C; ±0.01px over 15 cells |
| SVG icon ink | designed per icon | **L** | viewBox discipline | outside CSS entirely |
| `currentColor` | authored | **D** | inherited `color` | measured accent propagated into SVG fill |
| icon in an icon-only target | authored | **L** | `:not(:has(> :not(svg)))` | follows text 1.06 where it should follow target 1.25 |
| **ALTERNATE MEDIA** | | | | |
| print re-derivation | a second stylesheet | **D** | `@media print` sets one axis | measured `--unit` 4px → 3px, everything followed |
| print: drop affordances | authored `display: none` list | **T** | derived from the role | a control is meaningless on paper by definition |
| print: `break-inside` | authored per component | **T** | `data-appearance="surface"` / grid cell | measured `avoid`; **unsatisfiable at 4× root** (L2) |
| `@page` margins | authored | **T** | one rule | measured honoured, 5 A4 pages |
| print: scroll regions | nobody checks | **L** | — | silent loss with no affordance |
| 400% page zoom, inline axis | authored breakpoints | **D** | container queries + the fit pass | 320×256 ≡ 320×1024, measured identical |
| 400% page zoom, block axis | nobody checks | **L** | — | one field group = 42.1% of the viewport |
| user font-size / text-only zoom | `rem`, remembered | **L** | `rem` token bases | **zero response measured**; L1 |
| `prefers-reduced-transparency` | authored | **T** | a context axis, not a media query | measured: the media query lost the cascade |
| `inverted-colors` | authored | **T** | `filter: invert(1)` on `data-media` | media feature present in Chromium 151 |
| `forced-colors` on controls | authored system colours | **T** | one `@media (forced-colors)` block | measured: all colour collapses, accent → `auto` |
| forced colours erasing a state | nobody checks | **L** | needs a non-colour channel | invalid field ≡ valid button, measured |
| forced colours and a scrim | nobody checks | **L** | needs an opaque backdrop | alpha preserved: `rgba(255,255,255,0.4)` |
| autofill | UA-controlled | **X** | `data-escaped` | **[UNVERIFIED]** |

---

## Measured probes

Single file, plain HTML + CSS + measurement JS, no build:
[`experiments/coverage/07-controls.html`](../../../../experiments/coverage/07-controls.html).
It re-declares the prototype's token layer verbatim (px bases included, because
§F is the test of whether px is survivable) and its `action`/`field`/`text` roles,
then measures rects — never declarations.

### B — REQUIRED: does `field-sizing: content` remove author numbers for inputs?

**Yes for three of the four decisions, and the fourth becomes one table number
per declared purpose rather than one per callsite.**

Support: **Baseline newly available 2026-06-16** — Chrome 123, Safari 26.2,
Firefox 152 ([web-features](https://web-platform-dx.github.io/web-features-explorer/features/field-sizing/)).
Degrades to a fixed box, so no fallback is needed.

Inline axis, border box, comfortable:

| case | width | note |
|---|---|---|
| no `field-sizing` (UA default) | **180px** | `size=20`, identical for every purpose — the number the author would otherwise pick |
| `field-sizing: content`, empty | **27px** | padding + border only; unusable, and **fails the 44px touch floor at 33px** |
| `field-sizing: content`, `"abc"` | 49.72px | |
| `field-sizing: content`, 12 chars | 104.53px | |
| `field-sizing: content`, 60 chars | 469.31px | grows to available |
| `field-sizing: content`, placeholder only | 139.81px | placeholder counts as content |
| `min-inline-size: 14ch` (`type=tel`), empty | 123.45px | floor holds |
| `min-inline-size: 14ch` (`type=tel`), full | 138.55px | content wins over the floor |
| `min-inline-size: 24ch` (`type=email`), empty | 211.64px | |
| `min-inline-size: 8ch` (`inputmode=numeric`) | 70.55px | |
| `20ch` floor, `100%` ceiling, 91-char value, in a 202px box | **200px** | `escapes: false`; scrollW 369 vs clientW 198 — clips as the field role already licenses |

The `ch` floor is density-responsive **for free**, because `ch` follows the type
ramp:

| density | `--unit` | 14ch floor | 8ch floor | UA default (`size=20`) |
|---|---|---|---|---|
| comfortable | 4px | 123.45px | 70.55px | 180px |
| compact | 3px | 114.63px | — | 166px |
| dense | 2px | 105.81px | — | 146px |

Block axis, `<textarea>`, floor `--unit * 9`, ceiling `--unit * 40`:

| content | comfortable | compact | dense |
|---|---|---|---|
| 1 line | 36px | 30px | 25px |
| 6 lines | 120px | 110px | 80px |
| 40 lines | **160px** (ceiling; scrollH 696) | 120px | 80px |

`<select field-sizing: content>` measured 81.23px — sized to the **selected**
option, not the longest. That is the win and the hazard in one number: changing
the selection changes the layout.

**Verdict**: `field-sizing` is a genuine D win. The ceiling is derived
(`100%` of a box the engine laid out), the block axis is fully derived
(unit floor and ceiling), and the inline floor is a **T** keyed on `type` /
`inputmode` — declarations the author already writes for the keyboard. **Zero new
vocabulary.** The one thing it must not be is naked: an empty content-sized field
is 27px wide and fails the touch floor, which is diagnostic N710.

### C — REQUIRED: can an icon be sized purely from text context?

**Yes, exactly, and it tracks the font family as well as the size.**

`1cap` versus the cap height measured independently from canvas
`actualBoundingBoxAscent('H')` on the element's own resolved font. 15 cells,
3 densities × 5 text contexts:

| context | font-size | measured cap height | `1cap` box | error | box-centre offset |
|---|---|---|---|---|---|
| comfortable / title | 15px | 10.57px | 10.56px | **−0.01** | 0 |
| comfortable / body | 14px | 9.86px | 9.86px | **0** | −0.01 |
| comfortable / meta | 12px | 8.46px | 8.45px | **−0.01** | 0 |
| comfortable / inside a button | 14px | 9.86px | 9.86px | **0** | −0.01 |
| comfortable / **Georgia serif** | 14px | **9.70px** | **9.69px** | **−0.01** | 0 |
| compact / title | 14px | 9.86px | 9.86px | 0 | −0.01 |
| compact / body | 13px | 9.16px | 9.16px | 0 | 0 |
| compact / meta | 11px | 7.75px | 7.75px | 0 | −0.01 |
| compact / button | 13px | 9.16px | 9.16px | 0 | 0 |
| compact / serif | 13px | 9.01px | 9.00px | −0.01 | 0 |
| dense / title | 13px | 9.16px | 9.16px | 0 | −0.01 |
| dense / body | 12px | 8.46px | 8.45px | −0.01 | −0.01 |
| dense / meta | 11px | 7.75px | 7.75px | 0 | −0.01 |
| dense / button | 12px | 8.46px | 8.45px | −0.01 | −0.01 |
| dense / serif | 12px | 8.31px | 8.31px | 0 | 0 |
| touch / body | 14.84px | 10.46px | 10.45px | −0.01 | — |

Maximum error across every cell: **0.01px**. The serif row is the one that
matters: at the *same* 14px font size, system-ui's cap height is 9.86px and
Georgia's is 9.70px, and `1cap` returned the right one both times. **`1cap` is
font-metric-aware, not just size-aware.** No author number, no per-icon-set
constant, no `--icon-size` token.

The alternatives, same cells, for the record: `1em` returns the font size exactly
(15 / 14 / 12px — visibly too large, it is the em box not the letters), `1lh`
returns the line height (19.5 / 21 / 16.8px — much too large), `1ex` returns the
x-height (≈0.526em — too small). Only `cap` corresponds to what a reader
perceives as "the same size as the letters".

Support: `cap` **Baseline newly available since 2024**, Safari 17.2 (Dec 2023)
last in ([kizu.dev](https://blog.kizu.dev/cap-height-align/)); `lh`/`rlh` shipped
everywhere in 2023 ([WebKit](https://webkit.org/blog/16831/line-height-units/)).

Two honest caveats, and the first one is smaller than it looks. The
centre-offset column is 0 in every cell, which means the icon box's centre
coincides with the **line box** centre rather than sitting on the baseline. I
expected that to be visibly wrong, so I measured the residual against the
baseline computed from the font's own ascent and descent:

| context | font-size | line-height | icon bottom − baseline |
|---|---|---|---|
| title | 15px | 19.5px | **−0.72px** |
| body | 14px | 21px | **−0.58px** |
| meta | 12px | 16.8px | **−0.27px** |
| inside a button | 14px | 14px | **−0.58px** |
| Georgia serif | 14px | 21px | **−0.16px** |

The icon's bottom edge sits between 0.16px and 0.72px **above** the baseline in
every context — i.e. `align-items: center` on a `1cap` box is effectively
baseline-correct, sub-pixel, without anyone declaring a baseline. That is a
stronger result than the D verdict needs and it removes the caveat I came in
expecting. The second caveat stands, and it is L9: this sizes the box, not the
ink.

### F — REQUIRED: does the derived layout survive 400% zoom and print?

**Zoom: the inline axis is already covered and the block axis has never been
looked at. Print: yes, and better than an authored layout would.**

Page zoom, four viewports, same page:

| viewport | doc scrollW / clientW | grid columns | toolbar scrollW / clientW | crush findings |
|---|---|---|---|---|
| 1080 × 900 | 1080 / 1080 | 5 | 1046 / 1046 | 1 |
| 640 × 512 (200%) | 658 / 640 | 3 | 606 / 606 | 2 |
| **320 × 256 (400%)** | **658 / 320** | **1** | **339 / 286** | **7** |
| 320 × 1024 | **658 / 320** | **1** | **339 / 286** | **7** |

The last two rows are identical in **every** number. **400% page zoom is not a
distinct failure mode from a 320px viewport in the inline axis** — page zoom
scales px, so a px-derived layout scales with it and lands in exactly the
geometry the prototype's 320px column already tests. What is distinct is (a) the
256px block axis (L7) and (b) *text-only* zoom, which is a different mechanism
and fails completely (L1).

The 658px document width is the **probe's** own construction, not a prototype
result: this file deliberately contains a fixed 640px cell and a 720px table and
has no fit solver. The prototype-relevant number is the toolbar's **339 / 286** —
an *honest* overflow, which is exactly what `structure.css`'s no-crush block is
for and exactly the signal the solver degrades on.

Print, `@media print` emulated, 794 × 1123 (A4 at 96dpi):

| observable | value |
|---|---|
| `matchMedia('print')` | `print` |
| `--unit` resolved | **`calc(3px * 1)`** (axis re-set by the print block) |
| document scrollW / clientW | **794 / 794**, no horizontal scroll |
| toolbar `flex-flow` | **`row wrap`** (was `row nowrap`) |
| grid columns | 4 |
| `[data-print="drop"]` | `display: none` |
| `.card` `break-inside` | **`avoid`** |
| `[data-text=title]` `break-after` | `avoid` |
| html background | `rgb(255,255,255)` |
| 720px table in a 770px content box | fits |
| PDF, `preferCSSPageSize` | **5 A4 pages**, `@page { margin: 12mm }` honoured |
| hit-target failures | 0 |

Visual record confirms it: the Compose button is gone, the toolbar wrapped, the
three derived cards laid out in the print grid, the table rendered, everything at
the tighter 3px unit.

**This is the least contested win in the slice.** A derived layout prints because
print is just another context: the print block changes *one axis* and every value
in the document re-derives. An authored layout needs a second stylesheet that
nobody maintains. The failure mode is not layout, it is L2 — an unconditional
`break-inside: avoid` the context can make impossible.

### G — REQUIRED verdict: can the engine derive `sizes`?

**Yes, and it is worth shipping — but the credit mostly belongs to the platform,
and the part that is genuinely ours only works at build time.**

This took **three probe defects before one browser fact**, which is the §Findings
pattern repeating, so all three are recorded in the file:

1. One 1×1 GIF distinguished by `#w100`…`#w1600` **fragments**: every image
   reported the last candidate at every width. Read as "sizes is ignored", was
   really "the candidate list collapsed".
2. Distinct **`data:` URLs**, one real SVG per descriptor: still always the
   largest candidate, even in an isolated `new Image()` with `sizes: 150px`. A
   `data:` URL is already available to the loader, so the biggest decoded
   candidate wins and the selection algorithm is never exercised. **`data:` is
   not a fair proxy for a fetch.**
3. A **shared** candidate list across ten images: the first to resolve took w1600
   (default `sizes` is `100vw`), and every later image reported w1600 too —
   including `sizes="122px"`, which had just been proved to pick w200 in
   isolation. **Chromium reuses an already-decoded larger candidate rather than
   fetching a smaller one.** Real behaviour, load-order dependent.

With `blob:` candidates, one private set per image, cold (dpr 1.25):

| container | `sizes` | candidate fetched | ideal width (box × dpr) | waste |
|---|---|---|---|---|
| 120px | none | **w1600** | 150px | **10.5× wide, ~110× the pixels** |
| 120px | `100vw` | **w1600** | 150px | 10.5× |
| 120px | `100cqw` | **w1600** | 150px | 10.5× — container units do nothing |
| 120px | **`auto`** + `loading=lazy` | **w200** | 150px | 1.33× |
| 120px | **`120px`, derived from the image's own box** | **w200** | 150px | 1.33× |
| 640px | none / `100vw` / `100cqw` | w1600 | 800px | 2.0× |
| 640px | **`auto`** + `loading=lazy` | **w800** | 800px | **1.0×** |
| 640px | **`640px`, derived** | **w800** | 800px | **1.0×** |

**At a 120px box the derived source is 8× narrower than the default and carries
roughly 1/64 of the pixels.** That is a real, shippable, measured win.

**The failure I did not expect, and it is the house rule biting again.** The
first version of the derived case wrote the **cell's** border-box width — 642px
for a 640px image inside a 1px dashed frame. 642 × 1.25 = 802.5, which is just
past the w800 candidate, so the derived version fetched **w1600** while native
`sizes="auto"` fetched **w800**. *A 2px error in the derived length doubled the
bytes.* Measuring the image's own box instead made the derived result identical
to `auto` in both cells. **A check must measure the box its claim is about — and
so must a derivation.** This is the fifth instance of that principle in this
repository and the first one that costs bandwidth instead of a false finding.

So the honest verdict, split three ways:

- **Below the fold: D, and not ours.** `sizes="auto"` + `loading="lazy"` is
  **Baseline newly available since 2026-04-21** (Chrome/Edge 126 in 2024,
  Firefox 150, Safari) — [web-features](https://web-platform-dx.github.io/web-features-explorer/features/sizes-auto/).
  It measures the real layout box and picks optimally, with **zero** engine
  involvement. The engine's only job is to not fight it.
- **Above the fold, build time: T, and genuinely ours.** For the LCP image the
  engine knows the used width and `auto` is unavailable (measured: `sizes="auto"`
  without `loading="lazy"` is invalid and falls back to `100vw` → w1600). An SSG
  pre-solve can emit the exact `sizes` length. Measured 8× narrower at 120px.
- **Above the fold, runtime: L.** Late `sizes` does not re-fetch (L5). There is
  no runtime path to this win.

**Do not make "the engine derives `sizes`" a headline capability.** The headline
version is already a browser feature that ships in every engine. What is left is
narrower and still worth having: **the SSG tier knows the LCP image's used width
and can emit it, and it must measure the image's box, not its container's.**

### E — bonus: `appearance: base-select` closes the oldest hole in "no CSS needed"

Chromium 151 (measured `CSS.supports('appearance','base-select')` → `true`;
`::picker(select)`, `option::checkmark`, `::picker-icon` all parse). With the
table's own expressions applied and the picker **open**:

| part | measured | derived from |
|---|---|---|
| closed control | 69.39 × **36px**, radius **8px**, font 14px | `max(unit*9, --min-target)`, `unit*2`, `--text` |
| `option` in the open picker | 68.39 × **36px**, font 14px | the same expression, **inside the top layer** |
| `option::checkmark` | `rgb(26,79,180)`, **9.86px** | `var(--accent)`, `1cap` |
| `select::picker-icon` | `rgb(95,95,104)`, **9.86px** | `var(--fg-muted)`, `1cap` |

**Custom properties inherit into the top-layer picker.** The closed control, the
popup, the options, the checkmark and the disclosure icon all resolve from one
inherited `--unit` and one colour table, with no pixel value and no JS listbox.
The `<select>` has been the standing counter-example to "appearance can be
derived" for fifteen years, and in Chromium it no longer is.

Availability is the catch: **limited, not Baseline.** Chrome 135 stable, Safari 27
/ STP 238, Firefox not shipped
([bugzilla 1958445](https://bugzilla.mozilla.org/show_bug.cgi?id=1958445)). The
fallback is a real native `<select>`, so this is a safe progressive enhancement —
one table block, `T`.

### Validation, measured end to end

Before interaction: `:invalid` true, **`:user-invalid` false**, error
`display: none`, border `rgb(222,222,223)`. After a real submit click:

```
userInvalid: true · invalid: true
border:       rgb(180, 35, 31)   = var(--danger)
errorDisplay: block
errorColor:   rgb(180, 35, 31)   = var(--danger)
msg: "Please include an '@' in the email address. 'not-an-email' is missing an '@'."
```

Role + state derived the border colour, the message's visibility, the message's
colour, **and the message's localised text**. Zero author colours, zero author
strings, zero JS. This is the cleanest D in the slice.

### The `--unit` readability defect — a prerequisite for two of the diagnostics below

Measured on `document.body`:

```
getPropertyValue('--unit')  ->  "calc(4px * 1)"   parses to a number: false
after CSS.registerProperty({name:'--unit', syntax:'<length>'})
getPropertyValue('--unit')  ->  "4px"             parses to a number: true
getPropertyValue('--min-target') -> "0px"         parses to a number: true
```

`--unit` is an unregistered custom property, so computed style hands back the
token stream and **every numeric read of it is `NaN`**. This is exactly the
hazard `hit-target.ts:56-58` guards against ("a single NaN would poison the sum
and silence the rule entirely") — and it is why N650 reads `--min-target`, a plain
length, and works. Any rule that wants the unit needs one line in the table:

```css
@property --unit { syntax: "<length>"; inherits: true; initial-value: 4px; }
```

Registration also makes the derivation itself more robust — a registered
`<length>` computes to a used value at each element instead of re-substituting a
token stream — while preserving the per-element recomputation `tokens.css:95-121`
depends on. It is a theme-slice change; I have not made it.

---

## Proposed vocabulary

**Added: 1 attribute and 2 enum values. Deleted to pay for them: 1 attribute.**

The discipline that kept this small: three capabilities that looked like they
needed vocabulary do not, because the intent is **already declared** in HTML or
derivable with `:has()`.

### New

```
data-appearance="choice"            checkbox / radio / switch — a boolean control
data-appearance="range"             a continuous control
                                    (2 new values on the EXISTING closed axis;
                                     both still fail N610 today)

data-media="cover" | "contain" | "fill"
                                    how a replaced element fills its box.
                                    Carries object-fit AND the declared
                                    aspect-ratio, because choosing one without
                                    the other is how L14 happens.
```

### Deleted to pay for them

```
data-flush                          DERIVABLE, and its clip is a known bug.
```

`[data-appearance='surface'][data-flush]` exists so a surface holding
edge-to-edge content does not double its child's padding
([`roles.css:245-251`](../../../../experiments/c11-appearance/src/theme/roles.css)). That is a
fact about what the surface **contains**, which is exactly what `:has()` reads:

```css
[data-appearance='surface']:has(> :is([data-appearance='table'], [data-scroll-region])) {
  padding: 0;
}
```

Deleting it also retires the prototype's one declared open item — `data-flush`'s
`overflow: hidden` is what silently ate table columns — because a derived rule
can pair the padding removal with `overflow: clip` **only** where a
`[data-scroll-region]` is present to keep the promise.

### Not added, and why — this is the more useful half

| looked like it needed | already declared as | evidence |
|---|---|---|
| `data-fits="tel\|email\|code\|prose"` for the field-sizing floor | **`type` / `inputmode`**, which the author writes anyway for the keyboard | §B: `input[type=tel] { min-inline-size: 14ch }` measured 123.45px |
| `data-print="drop"` | **the role**. An `action` or `nav-item` is meaningless on paper by definition | print measured: dropping by role needs no attribute |
| `data-icon` / `--icon-size` | **the element**: `svg`, plus `1cap` from the inherited font | §C: ±0.01px, no token |
| "this control has no visible label" | `:not(:has(> :not(svg)))` | L10's fix needs no declaration |

Running total for the whole vocabulary after this slice: `data-appearance`
**8** values, `data-role` 4, `data-text` 5, `data-layout` 4, `data-align` 4,
plus `data-grow` / `data-priority` / `data-collapse` / `data-scroll-region` /
`data-escaped` / `data-media`. Still one page.

---

## Proposed diagnostics

Codes start at **N710**: `N700` is taken by the orchestrator's competing-primaries
rule, and `codes.ts` is append-only and never reused. Every fixture below is a
real, measured configuration from this probe, not a hypothetical.

| code | severity | asserts | fixture that proves it can fail |
|---|---|---|---|
| **N710** | fail | An element with `field-sizing: content` whose used **inline** size is below `--min-target`, or below the floor the table declares for its `type`/`inputmode`. | `<input data-appearance="field">` with `field-sizing: content`, empty, at `data-input="touch"` — **measured 33 × 45 against a 44px floor**. Passes once the `Nch` floor is added. Needs `@property --unit`. |
| **N711** | fail | For a control with an associated `<label>`, the **union** of the control's border box and the label's border box is below `--min-target`. Measures the union, because clicking the label activates the control — that union *is* the target. | `<label data-layout="row"><input type="checkbox"> Checkbox</label>` at touch — **measured union 79.97 × 17.8 vs 44**. The control alone measures 9.55 × 9.55, so a rule that measured only the control would report the *wrong magnitude* while happening to fail. |
| **N712** | warn | An interactive element whose used block size differs from `max(--unit * 9, --min-target)` by more than 1px **and** which carries no `data-escaped`. This is the honest inventory of "the table does not reach this control". | `input[type=color]` — **measured 50 × 27 where the table demands 36**. Also fires on `type=file` (21px), `<progress>` (14px), `type=range` (16px). Silenced only by a declared escape, which N601 then counts. |
| **N713** | fail | **Print media only.** An element whose computed `break-inside` is `avoid` and whose border-box block size exceeds the `@page` content height. | The derived card at `--unit-base: 0.25rem` and root font-size 64px — **measured 2678px against a 1032px A4 content box**, three boxes over. Silent in all six density × input contexts (tallest 134px), so the fixture must set the root font size or the rule looks untestable. |
| **N714** | warn | An `<img srcset>` with `w` descriptors that has neither (`sizes="auto"` **and** `loading="lazy"`) nor a `sizes` length within 5% of its own used inline size × dpr. | The no-`sizes` image in a 120px box — **measured w1600 fetched against a 152.5px ideal, waste 10.5×**. A companion negative fixture matters as much: `sizes="642px"` for a 640px image passes a naive ±10% check and still **doubled the bytes**, so the tolerance must be tight and measured against the *image's* box. |
| **N715** | warn | A replaced element (`img`, `video`, `iframe`) with neither intrinsic `width`+`height` attributes nor a resolved CSS `aspect-ratio` — a box whose block size is unknown before the resource arrives. | The attribute-less image — **measured `aspect-ratio: auto`** while its sibling reported `auto 800 / 450`. Both render at 318 × 178.88, so the rule must read the resolved ratio, not the final rect: measuring the rect cannot fail. |
| **N716** | fail | A state whose only painted difference from its base state is a **colour**, and which therefore does not survive `forced-colors: active`. Evaluated under emulated forced colours. | `[data-appearance="field"][aria-invalid="true"]` — **measured border `rgb(0,0,0)` under forced colours, byte-identical to the valid button's border**. Sibling of N640: N640 asks whether a colour has enough contrast, N716 asks whether the signal survives losing colour altogether. |

Two notes on falsifiability, both learned from this repo's five oracle bugs.

**N711 and N712 both measure the border box**, per `hit-target.ts:9-15`. N711
additionally must resolve the label through `el.labels` *and* `closest('label')`,
because the probe's implicit-wrapping form only answers to the second — a rule
that used one accessor would silently skip half the corpus.

**N713 must not approximate pagination.** The tempting version — compare each
box's `floor(top / pageHeight)` against `floor(bottom / pageHeight)` — reports
false positives, because `break-inside: avoid` *pushes* a box to the next page
and shifts everything after it, so the naive arithmetic describes a layout the
UA never produced. The sound claim is narrower and cannot lie: a box taller than
the page area is unbreakable **and** unplaceable, whatever the pagination does.

---

## Against Apple

| capability | what Apple does | verdict |
|---|---|---|
| **Field intrinsic size** | Auto Layout intrinsic content size plus content-hugging / compression-resistance priorities (250 / 750 / 1000), authored per constraint per view. | **Beats.** `field-sizing: content` plus one `Nch` floor keyed on `type` is strictly fewer decisions, and it is *machine-checkable* (N710). Apple's priorities are numbers a human picks and no tool audits. |
| **Icon sizing** | SF Symbols: per-text-style variants, three weights matched to font weights, designed optical alignment, `.imageScale()`. | **Split. Matches on geometry, loses on ink.** `1cap` hit the measured cap height to ±0.01px across 15 cells and 2 font families — Apple needs a shipped symbol set to do that, we need one CSS unit, and ours works with *any* icon and *any* font. But Apple's symbols are optically designed inside their box and ours are not (L9), and optical design is most of what SF Symbols is actually selling. |
| **User text size** | Dynamic Type. One OS setting, honoured by every stock control, every list row and every font metric, with `UIFontMetrics` scaling custom fonts too. The strongest single thing in their system. | **Loses, badly.** Measured: root 16 → 32 → 64px changed **nothing** — button 36px, text 14px, gap 8px throughout. Apple's users get a system-wide text-size control that works; ours get a page that ignores them. `rem` bases close the gap (measured 36 → 72 → 144px) and hand the solver a 4× load it has never carried. Until that lands, this row alone means "better than Apple" is not yet true. |
| **HIG role semantics** | `.destructive`, `.cancel`, `.borderedProminent`, `UIListContentConfiguration` — a closed vocabulary of meanings, resolved by the OS. | **Matches on expressiveness, beats on verifiability.** Same idea, and `data-appearance` / `data-role` is enforced by a static guard (`no-values-guard.mjs`, 45 files, 0 length or colour literals) plus N610. Apple's vocabulary is a convention a reviewer with eyes upholds; nothing fails a build when a team hand-rolls a red button. |
| **Materials & reduced transparency** | `UIBlurEffect` / `.thinMaterial`, with `accessibilityReduceTransparency` collapsing every material to opaque, OS-wide, automatically. | **Loses on reliability.** Measured: our `@media (prefers-reduced-transparency: reduce)` rule **lost a cascade fight** to a later equal-specificity `:root` declaration and the scrim never changed. Nothing in CSS enforces the ordering. The fix — express it as a context **attribute** axis, where the selector outranks `:root` regardless of order — beats Apple on composability (it nests, it multiplies with density) and is the single best argument in this slice for `tokens.css`'s "an axis is the intent itself". |
| **Forced / high contrast** | Increase Contrast is a system trait; every stock control adapts, custom drawing does not. | **Matches, with one thing Apple has and we do not: nobody checks either.** Measured that forced colours discards `accent-color` entirely (`auto`) and flattens every border to black, so our invalid field became indistinguishable from a valid button (L4). Apple's stock controls survive because Apple drew them; our controls need N716. |
| **Customisable `<select>`** | `UIMenu` / `UIPickerView` — fully native, fully themed by the OS, and **not restyleable**. You get Apple's picker or you build a fake one. | **Beats on control, loses on availability.** Measured: closed control 36px, option 36px, `::checkmark` at `var(--accent)` and `1cap`, `::picker-icon` at `var(--fg-muted)` — the entire popup, in the top layer, derived from one inherited unit. Apple cannot do this at all. Firefox has not shipped it, so it is a progressive enhancement, not a floor. |
| **Print** | No story. UIKit/SwiftUI printing is a separate render path an author writes by hand; there is no "print variant of the design system". | **Beats, decisively, and this is the cleanest win in the slice.** Measured: the print block re-set **one axis** (`--unit` 4 → 3px) and the whole document re-derived — row → wrap, controls dropped by role, `break-inside: avoid`, 5 A4 pages, `@page` margins honoured, no horizontal overflow, 0 hit-target failures. A derived layout prints because print is just another context. |
| **Reflow / 400% zoom** | Size classes plus Dynamic Type, authored adaptivity per screen. | **Matches on the inline axis, and neither side tests the block axis.** Measured 320×256 ≡ 320×1024 in every inline number, so the existing 320px column already covers 1.4.10's inline requirement — derived, no breakpoints, where Apple authors two layouts. But one labelled field plus a button is 42.1% of a 400%-zoom viewport (L7), and no assertion in either system looks at that. |
| **Validation** | `UITextField` delegates plus hand-written error views and hand-picked colours; the message text is the app's. | **Beats.** Measured: `:user-invalid` derived the border colour, the error's visibility, the error's colour and the **UA-localised message text**, from role plus state, with no author colour and no author string. |

**The summary Apple would not like, and the one they would.** Apple's system is
authored by humans with eyes and is not machine-checkable: there is no
`no-values-guard` for a HIG violation, no diagnostic that fails a build when a
target is 17.8px tall, no assertion that a state survives Increase Contrast.
Everywhere this slice measured something, the measurement itself is the advantage
— seven falsifiable checks came out of one afternoon's probing, and Apple has
none of them. **But Dynamic Type is not a checking problem, it is a foundation
problem, and on that one row we are not close.** A system that ignores the user's
chosen text size is not transcending Apple; it is failing the thing Apple did
first and best.

---

## Open questions for the maintainer

1. **Does `--unit-base` become `rem` now, or after graduation?** It is a
   five-line edit and it is the difference between failing and passing WCAG
   1.4.4. It also hands the fit solver a 4× load it has never carried (measured
   1807/1080 overflow at a 64px root) and makes a print `break-inside`
   unsatisfiable (measured 2678px vs 1032px). My read: `rem` is not optional and
   the honest sequencing is `rem` **plus** N713 **plus** a 4×-root column in the
   matrix, as one change. Three of your existing axes would then be tested
   against a fourth you have never varied.
2. **`--min-target: 0px` at `data-input="pointer"` — deliberate?**
   `tokens.css:51` sets no floor for pointer, so N650 is silent in every pointer
   cell of the matrix. WCAG **2.5.8** (Target Size Minimum, 24px) applies to
   pointers too. Measured consequence: the 9.55px checkbox is a finding at touch
   and invisible at pointer, in the same document.
3. **Should the table own controls the UA will not let it size?** `color`,
   `file`, `progress` and `range` all ignore `block-size` and all fail the touch
   floor (measured 27 / 21 / 14 / 16px). A declared `data-escaped` on four
   controls — counted by N601, visible in the report — is more honest than four
   rules that half-work and an N712 nobody can silence. But it means the escape
   count stops being "rare" and becomes "the native-control tax".
4. **Is a `[data-scroll-region]` acceptable on paper?** On screen `overflow-x:
   auto` is legitimate *because* scrolling promises the rest is reachable
   (`structure.css:145-148` argues exactly this). On paper there is no scrolling
   and the clipped columns are gone with no ellipsis and no finding. Either print
   un-scrolls the region and accepts the overflow, or the region is a declared
   silent loss in one medium — the same defect `data-flush` was retired for.
5. **How much of the `sizes` win do you want to buy?** `sizes="auto"` +
   `loading="lazy"` is Baseline and free and needs the engine to do *nothing*.
   The remaining, genuinely-ours part is the LCP image at build time: measured 8×
   narrower candidate, ~1/64 the pixels, and it only works in the SSG tier the
   README lists as unproven. Is one authored `sizes` on the hero image an
   acceptable leak, or is this the thing that finally forces the static
   pre-solve?
6. **Is the sub-pixel baseline residual worth any vocabulary at all?** Measured
   at −0.16px to −0.72px across five contexts, `align-items: center` on a `1cap`
   box is baseline-correct to well under a pixel, so my honest answer is no — but
   it is the only place in the slice where I would have added a declaration on
   intuition and the measurement said not to. Worth knowing you agree before
   somebody else adds it.

---

## Belongs to another slice

- **Diagnostics slice / N700's subtree scoping.** Two of my rules would read
  better with `obs.declared(selector)` than with a global selector plus a filter:
  **N711** wants "the label owned by this control's group" (it currently unions
  through `el.labels` *and* `closest('label')` to catch both association forms),
  and **N716** wants "the painted descendants of this state's subtree" to decide
  whether *any* non-colour channel differs. Per your instruction I have not
  changed either rule's decision — noting the opportunity only.
- **Theme slice.** `@property --unit { syntax: "<length>"; inherits: true;
  initial-value: 4px }` is a prerequisite for N710 and N712. Measured:
  `getPropertyValue('--unit')` returns `"calc(4px * 1)"` and parses to `NaN`
  today; after registration it returns `"4px"`. Also the L1 `rem` conversion of
  the four token bases lives here.
- **Typography slice.** L15: `Nch` bounds are non-monotonic at sub-pixel margins
  (identical string wrapped at 11px, did not wrap at 11.66px, both within 0.25px
  of a 30ch bound). Safe as a floor, unsafe as a wrap bound. Also
  `text-wrap: pretty` is supported in Chromium 151 (measured) and interacts with
  N690's shredded-word check.
- **Motion slice.** `interpolate-size: allow-keywords` is supported (measured),
  which makes `field-sizing: content` growth and `height: auto` transitions
  animatable — and therefore makes an animating field a moving target for any
  geometric assertion. The measured pass and the transition need an ordering
  rule.
- **Overflow / scroll slice.** `content-visibility: auto` is supported (measured)
  and is a hazard for print and for any full-document oracle: an unrendered
  subtree measures 0×0, which is F4's class arriving through an optimisation
  rather than through `display: none`.
- **Overlays slice.** Forced colours preserves alpha, so a
  `color-mix(… , transparent)` scrim becomes `rgba(255,255,255,0.4)` under
  `forced-colors: active` (measured) — it still obscures, in the mode where
  obscuring is least wanted. A scrim needs an opaque forced-colors fallback.
- **Verification slice.** The 400%-zoom block axis (256px) and a 4×-root-font
  column are two matrix dimensions that do not exist today, and L1/L2/L7 are all
  invisible without them.
