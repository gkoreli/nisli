# text and typography — intent coverage audit

**Date**: 2026-08-25 · **Kind**: coverage audit, measured where marked
**Slice**: whether the way a piece of text sizes, wraps, aligns and *degrades*
can be derived from what the text **is**, rather than authored at the callsite —
across type scale, leading, measure, wrapping, clamping, numerals, rhythm, and
non-Latin script.
**Baseline**: `experiments/c11-appearance` (240/240 clean)
**Probe**: `experiments/coverage/01-text.html`, measured in Chromium
`Chrome/151.0.0.0` via `file://`.

> **Reading of the verdicts, stated up front so the count means something.**
> **D** = the *engine* ships the derivation; the app declares intent and nothing
> else. **T** = one rule the *app's own* resolution table authors once (a
> typeface, a brand ramp, a language limit) — never per callsite. **L** = a
> per-callsite value or an author's eyes-decision survives. **X** = only
> expressible as raw CSS behind the declared `[data-escaped]` hatch (N601).

## Coverage in one line

D 22 · T 7 · L 3 · X 3 — of 35 capabilities audited.

---

## The leaks, first

### L1 — the resolution table declares no typeface, and four derivations depend on one

`src/theme/` contains **no `font-family` declaration at all** (grepped: zero
matches across `tokens.css`, `structure.css`, `roles.css`, `states.css`). The
font in every screenshot in the prototype's visual record comes from
`experiments/c11-appearance/index.html:17` —
`font: 14px/1.45 ui-sans-serif, system-ui, sans-serif` — which is explicitly
labelled "HARNESS CHROME ONLY. …nothing in this block may reach into it"
(`index.html:8-12`). It reaches in. It has to: text has no metrics without a
font.

This is not cosmetic. Four separate derivations resolve against font metrics:

| derivation | depends on | measured consequence |
|---|---|---|
| measure (`66ch`) | the `0` advance | 556.30px in `ui-monospace`, would differ in any other family |
| tabular alignment | the `tnum` feature | **Georgia: 15.468px residual spread** — `tabular-nums` silently does nothing |
| `text-box-trim` | cap height and alphabetic baseline | 7.80px removed on a title, 11px on a body |
| `font-size-adjust` mitigation | x-height per family | inert without a declared stack to normalise *against* |

**Cheapest honest option**: a `--font-ui` token in `tokens.css` (T), plus
`font-size-adjust` on `[data-text]` so a fallback family keeps the x-height the
ramp was tuned for. This does *not* become D — a typeface is a brand decision
and always will be — but it moves from "outside the table" to "one line in the
table", which is the whole point of the exclusivity invariant. **Until it lands,
`proof/no-values-guard.mjs` passes vacuously for typography**: it proves no
component declares a font, while the rendered font comes from a file the guard
does not read.

### L2 — nothing in the system knows how much surviving text is enough

This is the leak that matters most, and it is measured in §1 of the probe.

At 320px the message row wants 562px. The solver degrades until `unfit()` is
false, and `unfit()` is `overflows(container) || crushed(container)`. Neither
predicate has any notion of *readability*. Measured outcome with the shipped,
hand-authored strategy assignment (row B, and identically row D):

```
state: settled          row geometry: 320/320          crush: none
excerpt  "R…"   1 of 64 characters
author   "P…"   1 of 17 characters
```

The row is green on every one of the prototype's seven assertion paths. The
grow region measured **19.11px**. N621 exists to warn about exactly this and
does not fire, because its heuristic
(`textLength * inline / contentInline < 4`, `strategies.ts:54-58`) is a *warning*
a human reads in a log — the author's eyes are still the decision procedure.

**Cheapest honest option**: `--min-measure`, the text-axis sibling of F9's
`--min-track`. F9's rule is "a floor must propagate through every derivation
that BOUNDS it" (`tokens.css:55-69`). `contain: inline-size`
(`structure.css:236-238`) deletes a truncating node's min-content contribution
by design, so the bound above it — the grow region — has nothing to obey.
Restoring a floor in `ch` (so it re-derives per density with no authored px)
turns this from an eyes-decision into geometry. **Measured, row E, same
content, same 320px, same derivation:**

```
--min-measure: 20ch  →  144.492px
state: settled          row geometry: 320/320          grow region: 204.28px
excerpt  "Re: quarterly numbers, I pu…"   27 of 64 characters
author   "Priya Raghunathan"              intact
time/count/month                          absent
actions                                   both moved to the menu, trigger painted
```

The floor did not merely improve the outcome — it made the solver **spend the
right candidate**. Without it the solver stopped at pass 5 with the actions
untouched, because the row already "fit". With it the row overflowed honestly
for two more passes and paid with the two things that have a *reachable*
degradation (`menu`), which is what the priority ladder was for.

### L3 — `field-sizing: content` makes an input's width a function of typing

Measured: the same `<input>` at `field-sizing: fixed` is 146.00px whatever it
contains; at `field-sizing: content` it is **15.58px** holding `"ab"` and
**158.00px** holding `"a much longer value here"`. A control whose inline size
changes on every keystroke invalidates a solve that already settled, and F10's
rule ("a solver must measure the world it creates") has no answer for a world
that keeps changing after the loop exits. There is no intent declaration that
resolves this; it is a per-field decision about whether the field is allowed to
move its neighbours. **Cheapest honest option**: forbid it inside `[data-fit]`
and make that a diagnostic, or accept it and re-solve on `input` — which is a
performance decision, not a typographic one, and belongs to the fit slice.

### X1 — `::first-line` / `::first-letter`

A drop cap or a lead-in line is an editorial gesture about one specific piece of
prose. There is no property of "what this text is" that implies it, and inventing
`data-text="lede"` to carry it would be a size prop wearing a semantic hat.
Escape hatch, reported as N601.

### X2 — `text-emphasis` (CJK emphasis marks)

The CJK analogue of italic, and genuinely semantic — but it marks a *span inside*
a run of text, and the vocabulary has no sub-node granularity at all. Escape
hatch. Worth revisiting only if the vocabulary ever gains inline-level roles.

### X3 — vertical writing (`writing-mode`, `text-orientation`)

`writing-mode: vertical-rl` is supported (measured `CSS.supports` → true) and is
the correct default for some Japanese content. It is not a value, it is a whole
layout mode: it swaps the meaning of every logical property the table depends on,
so `data-layout="row"` and `data-priority` would silently change axis. Expressing
it needs a fourth **context axis**, not a declaration — and that is a bigger
change than this slice should spend its vocabulary budget on. Escape hatch, and
named in the open questions.

---

## Capability table

| capability | CSS today | verdict | intent declaration | notes |
|---|---|---|---|---|
| which type step a node gets | `font-size` | **D** | `data-text` | `roles.css:326-358`; five roles, no size prop anywhere |
| the ramp's own values | `--text-*-base` | **T** | `data-density` | 4 numbers × 3 densities, `tokens.css:127-152`. Type is deliberately *not* unit-proportional (`tokens.css:24-26`) — correct |
| typeface | `font-family` | **L** | — | **L1.** Table declares none |
| weight | `font-weight` | **D** | `data-text` | `roles.css:328/337/355` |
| tracking | `letter-spacing` | **D** | `data-text` | `roles.css:331/357`; negative on display, positive on label |
| leading | `line-height` | **D** | `data-text` | `roles.css:332/338/343` — but `meta` and `label` ship with **no declaration**, see Probe §3 |
| leading decidable by the checker | computed `line-height` | **D** | — | Measured: unitless resolves to px in computed style. `normal` is the *only* undecidable value |
| measure limit | `max-inline-size: 66ch` | **D** | `data-layout=stack` + `data-text` | Measured 556.295px @14px, 476.824px @12px — ratio exactly 14/12 |
| balanced headings | `text-wrap: balance` | **D** | `data-text=display\|title` | |
| pretty prose | `text-wrap: pretty` | **D** | `data-text=body\|meta` | Live in Chrome 151, Safari 26+, Firefox 134+. **Cascade hazard measured**, Probe §1 row C |
| nowrap for atoms | `text-wrap-mode` | **D** | `data-text=value`, `[data-truncate]` | Engine MUST write the longhand, not the `white-space` shorthand |
| intra-word break policy | `overflow-wrap` | **D** | who chose the bound | `roles.css:298-324` is already a derivation, and it is *right*. Measured min-content: `break-word` 227.58px, `anywhere` **8.44px** |
| hyphenation | `hyphens` + `hyphenate-limit-chars` | **T** | `lang` + one limit triple | Measured min-content 59.02px with a readable break. Chrome 128+/Firefox 137+; Safari needs `-webkit-hyphenate-limit-before/after` |
| CJK line breaking | `word-break: auto-phrase`, `line-break` | **D** | `lang` | Measured applied: `auto-phrase` + `strict` for `ja`, `loose` for `th` |
| CJK inter-script spacing | `text-autospace`, `text-spacing-trim` | **D** | `lang` | Measured `normal` / `space-first` resolved. `text-autospace` Baseline since Nov 2025 |
| single-line clamp | `text-overflow: ellipsis` | **D** | engine's `data-truncate` | `states.css:49-54` + `structure.css:198-239`. The three-part licence (`flex: 0 1 auto`, `min-inline-size: 0`, `contain: inline-size`) is load-bearing: omitting `contain` in the probe left the row at 562/320 |
| **how much text survives a clamp** | — | **L** | — | **L2.** Measured `"R…"` 1/64 while `settled` |
| multi-line clamp count | `-webkit-line-clamp` | **D** | measured block budget | Measured: budget 64px / lh 21px → 3 lines → clientHeight 63, scrollHeight 105. **Standard `line-clamp` is `false` in Chrome 151** — the `-webkit-box` trio is required |
| tabular figures | `font-variant-numeric` | **D** | `data-text=value` | Measured `ui-sans-serif`: equal-length spread **15.578px → 0.000px** |
| tabular *guarantee* | font must carry `tnum` | **T** | typeface | Measured Georgia residual **15.468px**. A declaration is a request, not a promise |
| which table column is numeric | — | **T** | `TableColumn.kind` | `data-table.ts:113` hardcodes `data-text="body"` for every cell. One declaration per column, not per cell |
| ligature/zero disambiguation in values | `font-feature-settings`, `slashed-zero` | **D** | `data-text=value` | `0`/`O` and `1`/`l` never trade places in an ID |
| optical sizing | `font-optical-sizing` | **D** | — | Default is already `auto`; inert without a variable font (T) |
| rhythm from font metrics | `text-box-trim` / `text-box-edge` | **D** | `data-text` | **Baseline newly available Aug 2026** (Chrome 133, Safari 18.2, Firefox 154). Measured 7.80px removed on a 15px/1.25 title (41.6%), 11px on a 14px/1.5 body (52.4%) |
| fallback x-height normalisation | `font-size-adjust` | **T** | — | One rule; mitigates L1. My probe measured the line box rather than the x-height and is **inconclusive** — see Probe §8 |
| small caps for labels | `font-variant-caps: all-small-caps` | **T** | `data-text=label` | Would replace `text-transform: uppercase` (`roles.css:356`) with real small caps where the font has them |
| `::first-line` / `::first-letter` | same | **X** | `data-escaped` | **X1** |
| CJK emphasis marks | `text-emphasis` | **X** | `data-escaped` | **X2** |
| logical axes | `padding-inline`, `inset-inline-*`, `min-inline-size` | **D** | — | Already used throughout. Measured: an RTL row flips with **zero** authored values |
| direction | `dir`, `:dir()` | **D** | `dir` on an ancestor | Measured: `direction: rtl` puts the grow region at logical-start 0 and the timestamp at logical-start 298.39 of a 320px row |
| bidi isolation of interpolated values | `unicode-bidi: isolate` | **D** | — | One table rule on `[data-text]`. A runtime string's direction is unknowable statically; unconditional isolation is safe and needs no callsite |
| degeneracy threshold per script | `MIN_VISIBLE_CHARS = 4` | **T** | `lang` | 4 Latin characters carry almost nothing; 4 Han characters can be a sentence. One per-script table |
| line-count derivation for the checker | `Range.getClientRects()` | **D** | — | Replaces `clientHeight / line-height`. Measured trim-independent and decidable at `line-height: normal` |
| vertical writing | `writing-mode`, `text-orientation` | **X** | `data-escaped` | **X3** |
| content-sized fields | `field-sizing: content` | **L** | — | **L3.** Measured 15.58px vs 158.00px for the same control |

---

## Measured probes

**File**: `experiments/coverage/01-text.html`. Plain HTML + CSS, no build, no
dependency change. Sections marked `[BASELINE]` transcribe the shipped rules
verbatim (`tokens.css:14-121`, `structure.css:51-239`, `roles.css:47-358`,
`states.css:39-54`); sections marked `[PROPOSED]` are what is under test. The
solver, the strategy derivation and every measurement run from the driver, not
from the page — the page stays pure CSS, because the mechanism under test *is*
plain CSS.
**Browser**: `Chrome/151.0.0.0` (macOS), headless, `file://`.

### §1 — the crux: can the degradation strategy be derived? (320px, the F5 width)

Five engines, one row, identical content and identical priorities
(excerpt 5, time/count/month 4, author 3, action groups 2 and 1). Each engine
runs the shipped algorithm faithfully (`solver.ts:49-100`): reset, order by
priority descending, apply one candidate per pass, re-measure
`overflows || crushed` each pass, reveal the affordance on the first `menu`.

Row geometry before any degradation, in all five: **562/320**.

| engine | strategy source | applied | verdict | timestamps | prose |
|---|---|---|---|---|---|
| **A** first run | every shortenable node `truncate` | 6 | settled | `"Yeste…"` 5/9 · `"1,…"` 2/5 · `"Ma…"` 2/5 | dropped entirely |
| **B** as shipped | author hand-picked `hide` for atoms | 5 | settled | absent ✓ | `"R…"` 1/64 · `"P…"` 1/17 |
| **C** derived, unlayered | `f(data-text)` | 5 | settled | absent ✓ | **30 lines in a 19px box, no ellipsis** |
| **D** derived, `@layer` | `f(data-text)` | 5 | settled | absent ✓ | `"R…"` 1/64 · `"P…"` 1/17 |
| **E** derived + `--min-measure` | `f(data-text)` | 7 | settled | absent ✓ | `"Re: quarterly numbers, I pu…"` 27/64 · **`"Priya Raghunathan"` intact** |

The derivation rule, which is the whole of the new authoring cost — nothing:

```
display → (not a candidate)   label → (not a candidate)
title   → truncate            body  → truncate       meta → truncate
value   → hide
```

**Row A reproduces F5 exactly** — `"Yeste…"`, `"1,…"`, `"Ma…"` — with the same
strings the prototype's finding records, from an independent implementation.

**Row B is the finding I did not expect.** The shipped, hand-authored fix does
not remove the degeneracy; it *relocates* it. Hiding the three atomic values
freed 122px, the row still did not fit, and the solver continued down the ladder
into the prose — which then absorbed the entire remaining deficit and collapsed
to one character each, at `settled`, with no crush and no finding. The author
picked correctly for the timestamps and the outcome got worse somewhere nobody
was looking. **F5 was never a strategy-assignment bug. It was the fit predicate
having no floor, and `hide` on the timestamps only moved which node paid.**

**Row A vs row E on the same row is the strongest single result in this slice.**
The derived rule alone (B/D) is *not* better than the author. The derived rule
**plus a derived floor** is better than anything the author could express, because
it changes which candidate the solver spends: A and B/D stop with the action
groups still in flow, E pushes both into the menu and paints the trigger. The
reader of row E loses two atomic values that are recoverable from context and two
action groups that are one tap away, and keeps every word of the identity and 27
characters of the excerpt. No callsite declared any of that.

**Row C is a defect in the mechanism, not in the page, and it is the second thing
I did not expect.** `text-wrap` is a shorthand for `text-wrap-mode` +
`text-wrap-style`, and `white-space` is a shorthand for `white-space-collapse` +
**`text-wrap-mode`**
([MDN, `white-space` §shorthand](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/white-space)).
So a role-layer typography rule at specificity (0,3,0) silently cancels the
engine's `[data-truncate] { white-space: nowrap }` at (0,1,0). Measured:

```
row C excerpt:  white-space: normal   text-wrap-mode: wrap     ← engine overridden
row D excerpt:  white-space: nowrap   text-wrap-mode: nowrap   ← engine honoured
```

The result was 64 characters rendered into a 19px column across **30 lines**,
clipped, with no ellipsis, while the row reported `320/320 settled` and the crush
check stayed silent — because `[data-truncate]` nodes are exempt from the crush
check by design (`solver.ts`, `Metrics.crushed`).

`states.css:26-28` claims the four-file order protects exactly this: *"moving
states above roles would let a role's `display` override the solver's decision"*.
**Source order only decides ties, and this is not a tie.** Row D is the fix:
the identical role rules inside `@layer roles`, with the state rules unlayered —
unlayered styles beat layered ones regardless of specificity. Two lines of
change, and it makes the layering claim true instead of approximately true.

### §2 — tabular figures, and whether a numeric column is rectangular

Inner text width of six numeric strings, measured with `Range`, at
`font-size: 12px`. `plain` = `data-text="body"`, which is what
`data-table.ts:113` emits for every cell today. `value` = `data-text="value"`.

| font | two 9-glyph strings, plain | two 9-glyph, `value` | two 4-glyph, plain | two 4-glyph, `value` |
|---|---|---|---|---|
| `ui-sans-serif, system-ui` | 50.922 / 66.500 → **Δ 15.578** | 60.047 / 60.047 → **Δ 0.000** | 25.375 / 34.672 → **Δ 9.297** | 30.234 / 30.234 → **Δ 0.000** |
| `Helvetica, Arial` | 58.156 / 62.297 → Δ 4.141 | 49.859 / 53.391 → **Δ 3.532** | 28.063 / 31.156 → Δ 3.093 | 24.047 / 26.703 → **Δ 2.656** |
| `Georgia, serif` | 49.656 / 67.703 → Δ 18.047 | 42.563 / 58.031 → **Δ 15.468** | 24.063 / 34.375 → Δ 10.312 | 20.625 / 29.469 → **Δ 8.844** |
| inherited `ui-monospace` | Δ 0.000 (already mono) | Δ 0.000 | Δ 0.000 | Δ 0.000 |

Two results, one good and one honest.

**Good**: in a font with `tnum`, `data-text="value"` makes the inline size of a
numeric string a **pure function of its glyph count** — exactly 6.6719px per
glyph at 12px, both rows, both lengths, zero variance. That is not merely
prettier: it means the fit solver can *compute* the width of a numeric value
without measuring it, and a column of them without laying it out. A derivation
that removes a measurement is worth more than one that only removes a decision.

**Honest**: `font-variant-numeric: tabular-nums` is a **request**. Georgia keeps a
15.468px spread with the property applied and computing as
`tabular-nums slashed-zero`. The declaration is not the guarantee, so the
guarantee needs a check (N713 below) — and the check must measure two equal-length
strings, not read the computed style. This is the fourth instance in this project
of *a check must measure the box its claim is about*, and the first where the box
is a glyph.

**Also honest**: the first run of this section measured Δ 0.000 everywhere and
looked like a triumph for the plain case. It was the probe inheriting
`ui-monospace` from its own harness `body`, exactly as the real prototype inherits
`ui-sans-serif` from `index.html:17`. That is how L1 was found.

### §3 — is `line-height` decidable, and does N690's hint give the right advice?

| node | shipped declaration | computed `line-height` | `parseFloat` | decidable |
|---|---|---|---|---|
| `[data-text=meta]` in the harness | **none** | `17.4px` | 17.4 | yes |
| `[data-text=label]` in the harness | **none** | `17.4px` | 17.4 | yes |
| `[data-text=body]` | `1.5` (unitless) | `21px` @14px | 21 | yes |
| `[data-text=body]` at dense | `1.5` (unitless) | `18px` @12px | 18 | yes |
| `[data-text=title]` | `1.25` (unitless) | `18.75px` @15px | 18.75 | yes |
| `[data-text=meta]`, `all: initial` ancestor | **none** | **`normal`** | NaN | **no** |

Three conclusions.

1. **`meta` and `label` are decidable only by accident.** They declare no
   `line-height` (`roles.css:348-358`); in both the prototype and this probe they
   inherit a number from the *harness* `body`. Put those roles in a document that
   declares no root leading and every `meta` and `label` node reports **N680
   `incomplete`** — the prototype's 240/240 clean run is partly a property of
   `index.html`, not of the resolution table. One-line fix, T.
2. **N690's hint is wrong advice.** It says *"declare a length line-height on
   text roles so wrapping stays checkable"* (`shredded.ts:65`). Measured: a
   *unitless* number resolves to px in computed style and is fully decidable, and
   it also tracks `font-size` across the density axis (21px → 18px) which a length
   cannot. `normal` is the only undecidable value. The hint should say **"declare
   any non-`normal` line-height; prefer a unitless number."**
3. **The rule should not need `line-height` at all** — see §5.

### §4 — is a measure limit derivable, and does it starve the solver?

| context | `font-size` | `66ch` resolves to | used width | lines |
|---|---|---|---|---|
| comfortable | 14px | **556.295px** | 556.28 | 3 |
| dense | 12px | **476.824px** | 476.81 | 3 |

`556.295 / 476.824 = 1.16667 = 14/12` exactly. The measure re-derives itself
across the density axis with no breakpoint, no media query and no authored px,
because `ch` is a function of the font the axis already chose. This is the
cleanest D in the slice.

**Does it conflict with the fit solver's freedom to shrink?** No, and the
asymmetry is why: `max-inline-size` is a ceiling and the solver's problem is
always a floor. Measured in a 320px row whose grow region is far narrower than
the cap:

```
row 320/320   grow region 275.88px   cap 556.295px (inert)
timestamp right edge = row right edge, gap 0.00px
```

The cap does not participate, the grow region absorbs normally, and the
end-aligned atom stays flush. The two constraints act on opposite ends of the
same axis and cannot meet. The genuine conflict is the one L2 names — a *floor*
on prose is what fights the solver, and it is supposed to.

### §5 — `text-box-trim` gives rhythm from metrics, and silently breaks N690

`text-box: trim-both cap alphabetic`, Baseline newly available Aug 2026:

| role | `font-size` / `line-height` | untrimmed | trimmed | removed |
|---|---|---|---|---|
| title | 15px / 18.75px | 18.75px | 10.95px | **7.80px (41.6%)** |
| body | 14px / 21px | 21px | 10px | **11.00px (52.4%)** |

This is the honest way to get vertical rhythm without magic numbers: the space
removed is derived from the font's own cap height and alphabetic baseline, so a
stack's gap becomes a real gap instead of a gap plus two half-leadings.

**And it makes N690 a systematic false negative.** N690 derives its line count as
`(clientHeight − padding) / line-height` (`shredded.ts:80-87`). Trim removes
block size from the box without removing lines from it:

| fixture | real lines | `clientHeight / line-height` | `Range.getClientRects()` |
|---|---|---|---|
| body, prose, untrimmed | 5 | 5 | 5 |
| body, prose, **trimmed** | 5 | **4** | 5 |
| body, one 33-char word, untrimmed | 3 | 3 | 3 |
| body, one 33-char word, **trimmed** | 3 | **2** | 3 |
| body, 1 word / 2 lines, **trimmed** | 2 | **1** | 2 |
| title, prose, trimmed | 5 | 5 (41.6% < half a line) | 5 |
| body, `line-height: normal` | 5 | **UNDECIDABLE** | 5 |

Trim on `body` removes 52.4% of the line height — just past the half-line
boundary `Math.round` depends on — so every multi-line body node undercounts by
exactly one line. The most common shred in the wild is **1 word across 2 lines**,
and under trim that derives as 1 word / 1 line, which is `lines <= words`, which
is **clean**. The rule written to make N660's silence unambiguous goes silent
itself, and only for the rhythm property the engine most wants to adopt.

The rects-based derivation is correct in every row above *and* decidable at
`line-height: normal`, which retires N680 for this rule entirely. Cost: one new
`Inspector` member. That is the frozen seam, so it is a real cost — and it buys a
strictly stronger rule, not a workaround.

### §6 — the same vocabulary, five scripts

`lang` drives the script defaults; nothing is declared per callsite. All in a
120px box.

| fixture | lang | glyphs | `split(/\s+/)` words | lines | resolved | N690 verdict |
|---|---|---|---|---|---|---|
| `Internationalization` | en | 20 | 1 | 2 | `break-word` | **FIRES 1w/2l** ✓ true positive |
| 日本語のテキストは単語間に空白がありません | ja | 21 | 1 | 4 | `auto-phrase`, `strict`, `autospace: normal`, `space-first` | DECLINED ✓ correct |
| ภาษาไทยไม่มีการเว้นวรรคระหว่างคำ | th | 32 | 1 | 3 | `line-break: loose` | DECLINED ✓ correct |
| النصوص العربية تكتب من اليمين إلى اليسار | ar | 40 | **7** | 3 | `rtl` | clean ✓ correct |
| **設定のInternationalizationを確認** | ja | 26 | 1 | **3** | `auto-phrase` | **DECLINED ✗ the Latin token really is shredded** |

The word-spaced assumption holds for Arabic — Arabic is word-spaced, so the whole
degradation model transfers unchanged, and 7 words across 3 lines reads clean
because it *is* clean. Declining on Han/Thai is right.

**Declining is not enough.** The last row is the hole: one Japanese string with an
English word inside it. `UNSPACED_SCRIPT.test(text)` (`shredded.ts:41-42,56`)
tests the whole node, so the presence of any Han character silences the rule for
the entire string — including the 20-character Latin token inside it that
genuinely is broken across lines. Mixed script is not an edge case in Japanese UI
copy; product names, API identifiers and settings labels are Latin by default.
The fix is not a different regex, it is **per-script-run segmentation**: split the
string into script runs (or use `Intl.Segmenter` with `granularity: 'word'`, which
handles Japanese and Thai correctly), and apply the words-vs-lines inference to
each spaced run rather than to the node.

RTL, measured, with zero authored values in any component:

```
direction: rtl        row 320/320
grow region   logical-start offset 0.00      width 290.39
timestamp     logical-start offset 298.39    width 21.61   (painted at the visual left)
truncated RTL title: client 60 / scroll 126, clipped
  logical first 3 characters occupy box-relative x 32.97 → 60.00  (the VISUAL RIGHT)
```

Logical properties carry the whole layout, `text-overflow: ellipsis` puts the
ellipsis at the logical end (visual left), and the logical prefix survives. The
vocabulary does survive a bidirectional script — the leak is bidi *isolation* of
interpolated runtime values, which is one unconditional table rule
(`unicode-bidi: isolate`) and therefore D.

### §7 — the shredding matrix, and a better answer than `anywhere`

One 27-character German compound in a 120px box.

| spelling | min-content contribution | lines | geometry | N690 |
|---|---|---|---|---|
| `overflow-wrap: normal` | **227.58px** | 1 | **228/120** | clean (and honestly overflowing) |
| `overflow-wrap: break-word` | **227.58px** | 2 | 120/120 | **FIRES 1w/2l** |
| `overflow-wrap: anywhere` | **8.44px** | 2 | 120/120 | FIRES 1w/2l |
| `hyphens: auto` + `hyphenate-limit-chars: 8 4 4` (`lang=de`) | **59.02px** | 3 | 120/120 | **FIRES 1w/3l — false positive** |

The first three rows confirm `roles.css:298-324` empirically: `break-word` keeps
the box's min-content contribution at the unbreakable token (227.58px identical to
`normal`), so the box still *tells its ancestors* how wide it wants to be and the
honest overflow the solver degrades on survives. `anywhere` collapses it to one
character — **8.44px, a 27× reduction** — which is exactly the "grow region
absorbs without limit by reflowing a sentence into a one-character column" hazard
the comment predicts. That derivation is already correct and needs no change.

The fourth row is new, and it is a better answer for the one place `anywhere` is
used. Inside a grid cell the table itself chose the bound, so the content must
agree to it — but `anywhere` buys agreement by destroying the word, while
hyphenation buys it by breaking the word **legibly, at a dictionary point, with a
visible hyphen**, and releases min-content to 59.02px instead of 8.44px. That is a
bound the table can actually honour and a reader can actually read.
`hyphenate-limit-chars: 8 4 4` is one table rule (T), needs the `lang` the document
already declares, and degrades to `anywhere` where no dictionary exists.

It also breaks N690, and the break is unavoidable in the current derivation: a
hyphenated word is 1 word across 3 lines, which is structurally identical to a
shredded one. Counting *break opportunities* rather than words is the only
inference that separates them.

### §8 — measurements I could not close

`font-size-adjust: ex-height 0.52` computes and applies
(`getComputedStyle → "0.52"`), and changes advance widths — `ui-sans-serif` `x`
7.02px → 8.13px, Georgia 7.08px → 7.66px, Verdana 8.30px → 7.91px. But I measured
the `Range` rect of the glyph, which is the **line box**, not the x-height, so the
numbers do not test the claim that x-height is normalised across fallback
families. **Inconclusive, and I am reporting it as inconclusive** rather than
dressing the advance-width deltas up as an x-height result. This is the fifth
wrong box in this project's short history and the second in this probe; the honest
lesson is that *"a check must measure the box its claim is about"* applies to
one-off probes exactly as hard as to shipped rules, and an agent writing a probe
reaches for `getBoundingClientRect()` reflexively when the claim is about a font
metric.

The first was worse and is worth recording because it produced a *positive*
result: my initial visible-prefix measurement walked `Range` rects character by
character and reported row C's excerpt as **fully intact**. The node was 30 lines
tall in a 19px box; a `Range` over wrapped text returns a bounding rect spanning
every line, whose right edge is trivially inside the box. A visible-prefix claim is
about a **single-line** box, so single-line-ness is now a *precondition* of the
measurement and a non-single-line node returns `UNDECIDABLE: n lines`, which is
what surfaced the cascade defect in the first place. **A checker that reports
"undecidable" found the bug; the one that reported "intact" hid it.**

---

## Proposed vocabulary

**One new enumerated value. Zero new attributes.**

```
data-text = display | title | body | meta | label | value
                                                    ^^^^^ new
```

`value` — **an atomic machine value, not prose**: a timestamp, a count, a
currency amount, a version, an identifier, a status code. Defined by one
property: *a prefix of it is not a shorter version of it, it is a different
value.* Everything below derives from that single declaration with no further
authoring:

| derived | why it follows from "atomic" |
|---|---|
| `hide` as the degradation | there is nothing to shorten; absence is honest, `"1,…"` is not |
| `font-variant-numeric: tabular-nums slashed-zero` | a column of values is rectangular, and `0`/`O` never trade places |
| `font-feature-settings: 'liga' 0` | `1`/`l` never trade places either |
| `hyphens: none`, `overflow-wrap: normal`, `word-break: normal` | a value has no interior break point |
| `white-space: nowrap` | a value has no interior line break |
| predictable width | measured: width is a pure function of glyph count, so the solver can compute it without laying it out |

### What this deletes to pay for it

More than it costs. `data-collapse` on text stops being a required author
decision and becomes an override:

- **`TextStrategy` and the `collapse` prop disappear from `Text`** —
  `src/ui/primitives/text.ts:24,28`. The doc comment there says *"the author has
  to pick, and the two legal answers are the only two offered"*; the measurement
  in §1 says the engine picks better, because the engine knows the role and the
  author was guessing about geometry it cannot see.
- **Four callsites lose their `data-collapse`** — `message-row.ts:81,87,93,96`
  and the equivalents in `components.ts:100,220,223,228`.
- The `collapse` prop survives only on `ActionGroup` (where `menu` is the answer
  and `menu` is not derivable from a text role).

Two new **tokens**, which are table entries and not vocabulary:

```
--min-measure: 20ch     /* L2. The text-axis sibling of --min-track. */
--font-ui: <stack>      /* L1. So the guard stops passing vacuously. */
```

### One rule that is not a declaration at all

Wrap the four theme files in cascade layers:

```css
@layer tokens, structure, roles;   /* states.css stays UNLAYERED */
```

Measured necessity, §1 row C vs row D. `states.css:26-28` believes source order
protects engine decisions from role rules; it does not, because source order only
resolves ties. This makes the claim in that comment true, costs two lines, and
protects every future engine-written attribute — not only `data-truncate`.

---

## Proposed diagnostics

Codes start at **N710**: `N700` is allocated to the orchestrator's
competing-primaries rule and the registry is append-only and never reused
(`codes.ts:4-12`).

### N710 — measure below the readable floor · `fail`

For every rendered `[data-truncate]`: assert the used inline size is at least
`--min-measure`, **and** that the exactly-measured visible prefix reaches the
script-relative minimum. Replaces N621's uniform-advance estimate
(`strategies.ts:54-58`) with a `Range` walk to the content-box logical end edge,
minus the measured ellipsis advance in the node's own font.

**Precondition, and it is the rule's own kill switch**: the node must render on
one line. A non-single-line node returns N680 `incomplete`, never a pass —
because a visible-prefix claim is about a single-line box, and a checker that
answers it for a 30-line box is the bug in §8.

**Fixture that proves it can fail**: probe §1 row B/D. Measured `"R…"` (1 of 64
characters) and `"P…"` (1 of 17) in a row reporting `320/320 settled` with no
crush and no existing finding. Row E, same content, same width, must pass.

**Why it is falsifiable rather than decorative**: the estimate it replaces
disagreed with reality in both directions on the same row — heuristic 6.37
characters where 5 survived, heuristic 3.47 where 2 survived. It also called
`"Yeste…"` (5 real characters) *not* degenerate and `"Ma…"` degenerate at the
same threshold, so the shipped warning could not have distinguished them
reliably.

### N711 — an engine decision was overridden by a role rule · `fail`

For every attribute in `states.css` that the engine writes, assert the
declarations it depends on actually won the cascade. For `[data-truncate]`:
computed `text-wrap-mode === 'nowrap'`, `text-overflow === 'ellipsis'`, and
`overflow-inline` in `hidden | clip`.

This is a **state-layer integrity** rule and it generalises past text: the same
class of defect awaits `[data-hidden]` (a role with `display` and higher
specificity), `[data-collapsed]`, and any future engine attribute. It is the
machine-checkable form of the claim `states.css:26-28` currently makes in prose.

**Fixture that proves it can fail**: probe §1 row C. Measured
`white-space: normal`, `text-wrap-mode: wrap` on a node carrying
`data-truncate`, from one unlayered `text-wrap: pretty` at specificity (0,3,0).
Row D, the identical declarations inside `@layer roles`, must pass with
`nowrap`/`nowrap`.

### N713 — tabular figures requested but not delivered · `warn`

For every `[data-text="value"]`, render two equal-length numeric strings
(`"0000"`, `"1111"`) in the node's resolved font and assert their advances are
equal within a subpixel. Does **not** read `font-variant-numeric` — the whole
point is that the declaration and the outcome differ.

**Fixture that proves it can fail**: `Georgia, serif`. Measured
`font-variant-numeric: tabular-nums slashed-zero` computed and applied, with a
**15.468px** residual spread between two 9-glyph strings. `ui-sans-serif` must
pass at Δ 0.000.

### Two required amendments to N690, not new codes

The defect class is unchanged, so the code stays; the derivation is wrong twice.

1. **Derive the line count from `Range.getClientRects()` distinct line tops, not
   from `clientHeight / line-height`.** Fixture: `data-text="body"` under
   `text-box: trim-both cap alphabetic` — measured 3 real lines deriving as **2**,
   and 1-word/2-lines deriving as 1, which is `lines <= words`, which is a silent
   pass on the commonest shred there is. Side effect: the rule becomes decidable
   at `line-height: normal`, so N680 stops firing for it and `meta`/`label` stop
   depending on the harness. Cost: one new `Inspector` member — the frozen seam,
   and the honest price of the strongest version of the rule.
2. **Segment by script run before applying the words-vs-lines inference.**
   Fixture: `設定のInternationalizationを確認` — measured 1 "word", 3 lines,
   **DECLINED**, while the 20-character Latin token inside it is genuinely broken.
   `Intl.Segmenter` with `granularity: 'word'` handles Japanese and Thai and
   removes the need for the script regex entirely. And **exclude line ends
   carrying a rendered hyphen**: measured `hyphens: auto` on a German compound
   gives 1 word / 3 lines and a *legitimate* break, which the current inference
   reports as a shred.

---

## Against Apple

| capability | what Apple's system does | derivation |
|---|---|---|
| semantic type levels | Dynamic Type: `.body`, `.callout`, `.caption`, 11 styles, scaled by a user setting the app never reads. Genuinely semantic and genuinely automatic. | **matches on mechanism, beats on verifiability.** `data-text` is the same idea with five levels instead of eleven. The difference is that nisli's `--min-text` floor and N640/N710 are *machine-checked*: nothing in UIKit tells you a `.caption2` label became illegible at the largest accessibility size, or that it lost contrast. A human with eyes finds that, or nobody does. |
| degradation when space runs out | Auto Layout content-compression-resistance priority orders **which** view compresses; `UILabel.lineBreakMode` decides **what happens to the text**, per label, chosen by a human. | **beats.** The measured claim is §1: `lineBreakMode` has no notion of "this label holds an atomic value", so Apple's model cannot know that truncating `12:04` produces a wrong number while truncating a sentence produces a shorter sentence. Derivation from the role knows, because the role is the fact. |
| shrinking type to fit | `minimumScaleFactor` + `adjustsFontSizeToFitWidth` — a real solver move nisli has no equivalent for: it degrades the *size* rather than the *content*. | **loses, on expressiveness — and I recommend not copying it.** It buys the fit by making text smaller than the context declared legible, which is `--min-text` violated silently, and it is not checkable. A floor plus a reachable degradation (§1 row E) reaches a better outcome by a route that can be asserted. Naming the gap honestly: there are layouts Apple can fit that nisli must report `unsatisfiable`. |
| numerals in tables | `UIFontDescriptor` feature settings, or `monospacedDigitSystemFont(ofSize:weight:)`, applied per label by a human who remembered. | **beats.** `data-text="value"` derives tabular figures, slashed zero, ligature suppression, no-hyphenation and nowrap from one declaration of what the thing *is* — and §2 shows the payoff is not only visual: the width becomes computable, so the solver stops measuring. Apple's version is five per-callsite decisions and no check that any of them happened. |
| vertical rhythm | No public API for cap-height-to-baseline trimming. Designers use `NSLayoutManager` overrides or fixed insets, i.e. magic numbers. | **beats.** `text-box-trim` is Baseline as of Aug 2026 and derives the trim from the font's own metrics — measured 7.80px on a title, 11.00px on a body. This is the one place the web platform is simply ahead. |
| icon–text optical alignment | SF Symbols: weight, scale and baseline matched to the surrounding text style automatically, with four scales and nine weights, all derived. | **loses outright.** This is genuinely derived, genuinely good, and nisli has nothing: the prototype's only icon is a `●` inside a `meta` span (`message-row.ts:84-90`) with no metric relationship to the text beside it. If "better than Apple" is the bar, this is a real hole and it is not in this slice's vocabulary. |
| vertical Japanese | TextKit 2 treats vertical writing as a first-class layout mode. | **loses.** X3: escape hatch. |
| bidirectional text | `NSWritingDirection` + automatic natural alignment; solid, and the platform default. | **matches.** Measured: logical properties flip an entire row with zero authored values, and the ellipsis lands at the logical end. Neither system is better; both are correct. |
| the checkability of any of it | HIG is a *document*. Compliance is a design review. There is no `xcodebuild` flag that fails a build because a caption lost contrast at an accessibility size or a label truncated to one character. | **beats, and this is the whole thesis.** Apple's system is authored by humans with taste and audited by humans with eyes. Its weakness is not the taste — the taste is better than ours. Its weakness is that it does not *scale to a machine*, and §1 measured the exact shape of that failure inside our own prototype: a hand-authored strategy assignment that a careful engineer got right for timestamps and wrong for prose, in a row that reported green on all seven assertion paths. Apple would have shipped that row too. The difference derivation can make is not that it has better taste; it is that it can be **wrong in a way a check can find**. |

The honest summary: Apple wins on the things a solver cannot reach without a
metric relationship it does not have (SF Symbols, vertical text, size-shrinking as
a strategy). Derivation wins wherever the decision is a *consequence of what the
thing is* — degradation strategy, numerals, rhythm, measure — because there the
human decision was never adding information, only adding a chance to get it wrong.
And derivation wins on the axis Apple structurally cannot enter: every claim above
is a number in a probe file, and every number can fail.

---

## Open questions for the maintainer

1. **`--min-measure` is the second `--min-track`. Is a third coming?** F9's rule
   ("a floor must propagate through every derivation that bounds it") has now
   produced two floors from two independent slices — the grid track from layout,
   the measure from text. Both are container bounds that content floors must
   reach. Is the answer a third floor per slice forever, or does the table need a
   general statement — *every container bound derived from `--unit` is floored by
   the content floors it will hold* — with the static table check F9 already
   asks for enforcing it? I lean hard toward the general statement; §1 row E is
   evidence the specific ones are found only after they hurt.
2. **`Inspector` gains `lineCount`. Is the seam frozen or is it versioned?**
   The strongest N690 needs rendered line rects, and the strongest N710 needs the
   same primitive to assert single-line-ness. Both amendments are strict
   improvements and both require one new member. If the seam is truly frozen, N690
   keeps its `text-box-trim` false negative — which means the engine cannot adopt
   the one property that gives it rhythm without magic numbers.
3. **`data-text="value"` deletes an author decision. Do we want that trade?**
   The measurement says the engine picks better than the author picked. But
   `text.ts:11-17` argues the opposite in writing, deliberately. If you still want
   the author to be able to insist, `data-collapse` remains as an override — but
   then the vocabulary has two ways to answer one question, and N710 will
   sometimes be arguing with a human who was explicit. Which wins?
4. **Does `hyphens: auto` replace `overflow-wrap: anywhere` in grid cells?**
   Measured: min-content 59.02px and a legible hyphenated break, versus 8.44px and
   a destroyed word. It needs `lang`, it needs a dictionary, Safari needs the
   `-webkit-hyphenate-limit-*` spelling, and it forces the N690 amendment. The
   quality difference is large enough that I would take all four costs.
5. **Where does the typeface live?** L1 is a one-line fix with an uncomfortable
   implication: the moment `--font-ui` is in `tokens.css`, `no-values-guard.mjs`
   has a font stack to count, and the honest reading of today's PASS is that
   typography was outside the invariant the whole time. Land it before the next
   proof run, or land it with the run that records why the count changed?
6. **Is `unsatisfiable` an acceptable answer more often than the prototype
   assumes?** With `--min-measure` in place, narrow contexts will legitimately
   run out of degradations and get the dashed danger outline. That is the design
   working. But 240/240 clean was achieved partly by a solver that would settle
   for one readable character, and the honest matrix after this change will have
   red cells that are *correct*. Does the proof's bar become "no unsatisfiable
   cells" or "every unsatisfiable cell is explained"?
7. **`text-wrap: pretty` on `meta` and `body` — does it cost anything measurable
   at scale?** Not measured here. WebKit's implementation notes describe a
   multi-line lookahead; on a list of 200 message rows that is 200 paragraphs
   re-balanced on every resize the fit solver triggers. Worth a number before it
   ships as a default.

---

## Belongs to another slice

- **Cascade layers for the four theme files** (`@layer tokens, structure, roles;`
  with `states.css` unlayered). Measured in §1 rows C/D as a text defect, but it
  is a general layering fix that protects every engine-written attribute. →
  **ThemeDomain**, and **DiagnosticsDomain** for N711, which is a state-layer
  integrity rule and not a typographic one.
- **`--min-measure` as F9's sibling, and the fit predicate's missing readability
  term.** `unfit()` = `overflows || crushed` is a geometry predicate answering a
  meaning question. → **FitDomain** / **LayoutSizing**.
- **`Inspector.lineCount` / rendered-line-rects on the frozen seam.** →
  **VerificationDomain** / **DiagnosticsDomain**.
- **`field-sizing: content` invalidating a settled solve** (measured 15.58px vs
  158.00px for one control). → **ControlsMedia** / **FitDomain**.
- **The table declares no `font-family`, so `no-values-guard.mjs` passes
  vacuously for typography.** → **ThemeDomain** owns the token;
  **VerificationDomain** owns whether the guard should have caught it.
- **`TableColumn` needs a `kind` so a numeric column can declare itself once**
  (`data-table.ts:56-59,113`). → **UiDomain**.
- **SF Symbols has no counterpart**: icon weight/scale/baseline derived from the
  adjacent text role. Real hole against Apple, no vocabulary for it. →
  **UiDomain** / **SemanticVocab**.
- **For `Main`: `obs.declared(selector)` subtree scoping is directly useful
  here.** "This table column is numeric" is a subtree claim, not a node claim —
  the evidence is every cell in one column, and a global selector plus a filter
  reads badly for it. Same for N713, which wants to assert tabular delivery once
  per column rather than once per cell. I have **not** changed any proposed rule
  to use it; noting the fit as instructed.
- **Not my slice, observed while measuring**: `-webkit-line-clamp` requires
  `display: -webkit-box`, which **replaces** the element's display type. Any
  clamped node stops being a flex item or a grid item in the way the structure
  layer assumes. → **LayoutSizing** / **OverflowScroll**.
