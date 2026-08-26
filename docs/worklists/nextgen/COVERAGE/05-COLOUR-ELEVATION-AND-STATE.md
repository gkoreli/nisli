# Colour, elevation and interaction state — intent coverage audit

**Date**: 2026-08-25 · **Kind**: coverage audit, measured where marked
**Slice**: whether a role's colour, its elevation and its interaction states can
be **computed** from a declared surface instead of authored — and what survives
`forced-colors`.
**Baseline**: `experiments/c11-appearance` (240/240 clean)

## Coverage in one line

D 19 · T 13 · L 7 · X 2 — of 41 capabilities audited.

The one-sentence version: **the primary foreground is the only colour in the
system that derivation makes provably correct, and it is the one that matters
most.** Everything softer than maximum contrast is a measured budget, not a
guarantee, and the budget's exact numbers are below.

---

## The leaks, first

### L1 — A sub-maximal foreground cannot be given a guaranteed ratio. This is a proof, not a gap.

`contrast-color(var(--surface))` returns black or white, whichever contrasts
more ([MDN][mdn-cc]: "A `<named-color>` of either `white` or `black`"). Swept
over 729 sRGB surfaces (`#gamut`, 9 levels per channel), the **minimum** WCAG 2.x
ratio it achieves is **4.585:1**, and **0 of 729** fall below 4.5. That matches
the closed form: the worst surface is the one where black and white tie,
`(L+0.05)² = 0.0525 → L = 0.1791 → 1.05/0.2291 = 4.583:1`.

That number is also a ceiling. **4.585:1 is the most contrast available on the
worst surface**, so *any* de-emphasis toward that surface — muted text, a
secondary label, a placeholder — necessarily lands below 4.5:1. A guaranteed
sub-maximal foreground does not exist for an unconstrained surface range.

Measured consequence, `--fg-muted: color-mix(in oklab, var(--fg) 62%, var(--surface))`:

| theme | ratio at elev 0 | dies at | last-ok surface |
|---|---|---|---|
| light | 10.05:1 | **38.6 %** ink mixed in (9.7 steps at 4 %/level) | `#868686` |
| dark | 6.67:1 | **24.7 %** ink mixed in (6.2 steps at 4 %/level) | `#454549` |

Cheapest honest option — and it is a *better* answer than a bigger table:
**stop expressing de-emphasis as lightness.** `data-text="meta"` and
`data-text="label"` already declare low importance; the table can resolve that
importance to size, weight, letter-spacing and position while keeping
`color: var(--fg)`. Measured: at the deepest surface of the clamped ramp,
full-contrast metadata is 9.79:1 (light) / 9.54:1 (dark) versus 6.60 / 4.61 for
the muted variant, and the leak closes entirely. Where a soft grey is genuinely
wanted, it survives as a **table rule with a declared surface-range constraint**
(see N721) — never as a per-callsite colour.

### L2 — A branded (hued) foreground cannot be made contrast-safe by mixing. Measured failure.

I built the fix and it did not work, which is the most useful thing in this
report. `derived` v1 corrected brand hues against the **base** surface; that
decays with depth by construction. `derived2` corrects them against the
**current** surface (`color-mix(in oklab, var(--brand-link) 62%, var(--fg))`,
where `--fg` is `contrast-color(var(--surface))`) and clamps the ramp at 24 %.
It still fails:

| mode | theme | link WCAG at elev 0 / 2 / 3 / cap |
|---|---|---|
| `derived` | dark | 5.84 → 4.94 → **4.44 ✗** → 2.33 ✗ |
| `derived2` | dark | 5.84 → 4.94 → **4.44 ✗** → 3.09 ✗ |
| `derived2` | light | 14.65 → 11.53 → 10.18 → 6.83 ✓ |

Unclamped ramp: dark `--link` crosses 4.5:1 at **11.5 %** ink — 2.9 steps at
4 %/level. The reason is structural: hue and chroma are identity, lightness is
what carries contrast, and hitting a *target* ratio requires solving for
lightness. P2b shows CSS can do more arithmetic than one expects — `pow()`,
`sign()`, `abs()`, `clamp()` and the channel keywords of relative colour syntax
are all live in Chrome 151, and together they compute a full WCAG luminance
inline. What they cannot do is the two things this needs: **anchor one
expression on two colours at once** (a relative colour function has exactly one
`from`, so the brand's hue and the surface's luminance can never meet in one
expression) and **iterate**. Contrast is monotone in lightness, so a solver
would need only a bisection; CSS has no loop, so it cannot run one.

Cheapest honest options, in order of preference:
1. **Move the hue off the text.** A link's identity becomes its underline
   (`text-decoration-color: var(--brand-link)`) while its text is
   `contrast-color(var(--surface))`. Non-text decoration has no 4.5:1 duty, so
   the guarantee holds and the brand survives. Zero new vocabulary.
2. **Build-time solve.** The static tier the README already wants
   (`README.md:217`, "No SSG pre-solve") can bisect lightness once per
   theme × depth and emit resolved colours. This turns L2 into D at the cost of
   a build step.
3. Table rule with a declared depth cap per hue, checked by N721.

### L3 — The elevation *step size* is a taste decision. Numbers, not intuition.

Adjacent surfaces in the shipped table differ by ΔL\* 3.09 and 3.46 (light),
3.56 and 4.42 (dark). Perceptually that is 3–4× the large-area JND, so the steps
*are* visible — but in WCAG terms the maximum adjacent-surface ratio measured
anywhere in this probe, across all three modes and both themes, is **1.162:1**.
A surface step can therefore never on its own satisfy WCAG 1.4.11's 3:1 bar for
a meaningful boundary. What actually separates nested cards is the 1 px border:
1.34/1.24:1 authored, 2.24:1 derived.

So the *ratio* between steps is derived from one `--elev-step`, but the value of
`--elev-step` itself is an eyes-decision. It is a single number for the whole
app, so this is the cheapest possible leak — but it is a leak, and pretending
ΔL\* 1 (the JND) is the right answer would produce a ramp nobody can see.

### L4 — The checker cannot see `opacity`, and the shipped table hides a 3.03:1 control behind it.

`roles.css:130-133` dims a disabled action with `opacity: 0.45`. `contrast.ts`
reads `inspector.style(node, 'color')` and `inspector.backdrop(node)` and never
looks at `opacity`, so it computes **18.85:1** for a control that actually
composites to `#949495` on white — **3.03:1** (dark: `#7a7a7d` on `#16161a`,
**4.22:1**). WCAG 1.4.3 exempts inactive components, so this is not a
conformance failure; it is a **silent confidence failure**, the sixth member of
the family the README calls out at `README.md:198-202` — *a check must measure
the box its claim is about*, and here it must measure the *composite* its claim
is about.

Worse in the mode meant to help: under `forced-colors: active` the 54 disabled
cells are the **only** cells in 1188 that fall below floor (3.35:1), because
`opacity` is not in the forced property list ([css-color-adjust-1 §3.1][fca31]).
Every other colour is replaced by a guaranteed system pair; the one thing the
author dimmed stays dim.

Fix is derived, not authored: replace `opacity` with `color: var(--fg-muted)`.
Measured on the real states fixture — `#424242` on `#ffffff` = **10.05:1**
(Lc 93), `#9d9d9f` on `#16161a` = **6.67:1** (Lc 48). The general L remains:
`filter`, `mix-blend-mode` and `backdrop-filter` make the painted colour
unknowable from computed style, and a checker must refuse rather than guess.

### L5 — Text over an image, gradient or video backdrop is outside the mechanism.

`contrast.ts` gets its backdrop from `inspector.backdrop(node)`, which is a
*background-color* walk. An ancestor carrying `background-image` contributes no
colour to that walk, so the rule silently measures the colour *behind* the
image and reports a ratio that has nothing to do with what is on screen. This is
not hypothetical — it is the same class as N670 and N650, a rule measuring the
wrong box. `contrast-color()` cannot help: there is no single input colour.

Cheapest honest option: a declared `data-scrim` on any surface that paints a
non-colour background, from which the table derives an opaque-enough scrim, plus
N741 to make the undeclared case an error rather than a wrong number. Not
probed — reasoned from `contrast.ts:58-59` and the `backdrop()` contract.
`[REASONED, NOT MEASURED]`

### L6 — The brand hues themselves.

Three authored colours (`--brand-accent`, `--brand-danger`, `--brand-link`).
Identity is not derivable and should not be. Listed as a leak only so the count
is honest: it is the one place in this slice where an authored value is
*correct*.

### L7 — `--surface` must be maintained alongside `background`, and CSS cannot enforce it.

This is the generalisation the ticket asked for, and it is sharper than the
original rule. The recorded F3 rule — *"a context axis that touches `--fg` must
own its `--s1`"* — is a special case of:

> **Every colour is derived from `--surface`, so `--surface` must always equal
> the colour actually painted behind the text. CSS cannot read a used
> `background-color`, therefore the equality is a discipline, not a mechanism —
> and the whole system's correctness reduces to it.**

That is a strictly better position than F3's. F3 gave you one rule per
colour-changing axis and no way to check it. This gives you **one invariant for
the entire system**, and — measured — it *is* checkable. Registering
`@property --surface { syntax: '<color>'; inherits: true }` makes
`getComputedStyle` return a *resolved* colour instead of the raw token stream:

| declaration | `getComputedStyle(el).getPropertyValue('--surface')` |
|---|---|
| registered `<color>` | `oklab(0.879995 0.0000400996 0.0000176764)` ✅ resolved |
| unregistered | `color-mix(in oklab, #ffffff 88%, black)` ❌ raw tokens |
| registered, desynced from `background: red` | var `oklab(0.879995 …)` vs `background-color: rgb(255, 0, 0)` — **detected** |

So L7 is a leak in CSS and a **D** for the checker: N640's N-pair contrast sweep
collapses into one structural comparison (N711).

### X1 — `:autofill` background. Not expressible as intent, at all.

Chromium's UA stylesheet applies its autofill background with `!important`
([MDN `:autofill`][mdn-af]: "you cannot override the default
`background-color`"). The only working technique is
`-webkit-box-shadow: 0 0 0 1000px <colour> inset !important` plus
`-webkit-text-fill-color`, optionally with the `transition: background-color
9999s` trick to stop Chrome reverting it. That is three prefixed properties, an
`!important`, and a 9999-second animation used as a lock. It belongs behind
`[data-escaped]` reporting N601, and the theme should own the escape once rather
than letting components discover it. Could not be triggered headlessly.
`[UNVERIFIED at runtime; cited]`

### X2 — `forced-color-adjust: none`.

By definition an opt-out from a stated user preference. The spec's own guidance
([css-color-adjust-1 §3.2][fca32]): "Authors should only use this value when they
are themselves adjusting the colors." It must be reportable exactly like
`[data-escaped]` — possible, explicit, and visibly unverified.

---

## Capability table

| capability | CSS today | verdict | intent declaration | notes |
|---|---|---|---|---|
| primary foreground on a surface | authored pair per theme | **D** | `data-appearance` on a `--surface` | `contrast-color(var(--surface))`; min 4.585:1 over 729 surfaces, 0 failures |
| focus ring colour | authored `--accent` | **D** | `:focus-visible`, no declaration | `contrast-color()` of the ringed box's own fill; ≥4.585:1 against *any* backdrop |
| `outline-offset` | authored px | **D** | none | already `max(calc(var(--unit) * 0.5), 1px)`, `roles.css:371` |
| focus ring on a **filled** role | authored | **D** | none | needs the fill in a custom property — see probe P4; ring==fill measured 1.00:1 |
| border / hairline colour | authored `--line` | **D** | none | `color-mix(in oklab, var(--fg) 22%, var(--surface))`; 2.24:1 vs 1.34:1 authored |
| hover wash | authored `--s3` | **D** | `:hover` | one elevation step from `--surface`; measured `#dedede` |
| pressed wash | authored | **D** | `:active` | two steps; measured `#bebebe` |
| `:checked` | authored | **D** | `:checked` | `accent-color: var(--accent)`; resolved `rgb(0,0,0)` |
| `accent-color` | authored | **D** | none | = derived accent |
| `caret-color` | UA default | **D** | none | `currentColor` is already `--fg` |
| `::selection` | authored pair | **D** | none | `--accent` / `contrast-color(--accent)` |
| `::placeholder` colour | authored | **D** | none | = `--fg-muted` |
| `:placeholder-shown` | authored | **D** | `:placeholder-shown` | carried structurally (`border-style: dashed`), not by colour |
| `:invalid` vs `:user-invalid` | authored | **D** | `:user-invalid` | measured: `:invalid` matched at rest, `:user-invalid` only after blur |
| `:user-invalid` paint | authored | **D** | `:user-invalid` | `--danger` derived; measured border `#711a17`, 11.28:1 |
| `:disabled` paint | `opacity: 0.45` | **D** | `:disabled` / `aria-disabled` | derived `--fg-muted` gives 10.05:1 vs 3.03:1 for opacity |
| elevation *values* from one step | 3 authored shades | **D** | nesting depth | `color-mix(in oklab, base calc(100% − n·step), ink)` |
| elevation *direction* (light vs dark) | second authored table | **D** | none | mix toward `contrast-color(base)` — no direction token in either theme |
| out-of-gamut `oklch()` clamping | n/a | **D** | none | UA clamps; the *checker* must read the painted value (canvas/compositor) |
| `light-dark()` | media query duplication | **T** | `color-scheme` | verified live; colour-valued only — cannot carry a numeric direction |
| `color-scheme` | 1 line per theme | **T** | `data-theme` | already `tokens.css:195,213`; forced to `light dark` under forced-colors |
| `prefers-color-scheme` | media query per rule | **T** | `data-theme` default | `--surface-base: light-dark(#fff, #16161a)` — one declaration, no `@media` |
| `scrollbar-color` | authored | **T** | none | derivable from `--surface`/`--fg`; forced to `auto` under forced-colors |
| `prefers-contrast: more` | second palette | **T** | new `data-contrast` axis | one block raising `--muted-mix`/`--line-mix` to 100 % |
| `forced-colors` role distinction | per-component | **T** | existing `data-role` | one `@media (forced-colors: active)` block covers every role, incl. unwritten |
| `<system-color>` keywords | n/a | **T** | none | used *inside* that block; `GrayText` is the correct disabled ink |
| wide-gamut `color(display-p3 …)` | authored | **T** | none | one token per theme if P3 brand is wanted |
| `@supports` fallback for `contrast-color()` | per feature | **T** | none | one block; and the fallback need not lose the floor — pure-CSS luminance expression measured 0/4913 below 4.5 (P2b) |
| elevation depth cap | 3-level selector chain | **T** | engine-written `data-elev` | one `--elev-cap` per app + mandatory table check (N721) |
| shadow as elevation | one authored expression | **T** | none | already unit-derived (`states.css:118`); becomes `none` under forced-colors |
| WCAG floor value | `--min-contrast: 4.5` | **T** | none | already a token (`tokens.css:74`) |
| APCA adoption | n/a | **T** | none | one algorithm swap; cost measured below — 98 new findings |
| sub-maximal foreground at a target ratio | authored per theme | **L1** | — | 4.585:1 is the ceiling on the worst surface; proof above |
| branded (hued) foreground at a target ratio | authored per theme | **L2** | — | measured: dark link fails at elev 3, 4.44:1 |
| elevation step *size* | authored | **L3** | — | ΔL\* 3.1–4.9 measured; JND is ~1; taste decides |
| effective contrast under `opacity`/`filter`/blend | invisible to checker | **L4** | — | 18.85:1 claimed vs 3.03:1 painted |
| text over image/gradient/video | authored scrim | **L5** | `data-scrim` | `backdrop()` is a background-*colour* walk |
| brand hues | authored | **L6** | — | 3 colours; correctly authored |
| `--surface` ≡ painted background | not expressible | **L7** | — | but **checkable**: `@property` registration, N711 |
| `:autofill` background | UA `!important` | **X1** | `[data-escaped]` | `-webkit-box-shadow` inset hack is the only route |
| `forced-color-adjust: none` | opt-out | **X2** | `[data-escaped]` | must report like N601 |

---

## Measured probes

Fixture: **`experiments/coverage/05-colour.html`** — 199 KB, pure HTML + CSS,
**zero script**. Six role panes (`{authored, derived, derived2} × {light, dark}`),
9 nesting levels each, 26 measured cells per level; a 41-step 1 %-granularity
elevation ramp per theme; a 729-swatch sRGB gamut sweep.
State fixture: **`experiments/coverage/05-colour-states.html`** — split out only
because the gamut sweep makes a full style recalc per hover too slow to drive.
Harness: **`experiments/coverage/05-colour.measure.js`**, injected with
`page.evaluate`, so the fixture cannot lie about what it painted.
Browser: **Chromium 151.0.7922.174**, headless, `file://`.
Visual record: `05-colour-panes.png`, `05-colour-forced.png`, `05-colour-ramp.png`.

Every colour is resolved to sRGB by painting it on a 1×1 canvas and reading the
pixel. That is deliberate: a derived table's computed values come back as
`oklab(…)`, and the only honest answer to "what did the user see" is what the
compositor produced.

### Feature gates — measured, not assumed

All eight pass in Chrome 151: `contrast-color()`, relative colour syntax
(`oklch(from red l c h)`), `sign()`, `color-mix()` with a `calc()` percentage,
`light-dark()`, `color(display-p3 …)`, `field-sizing`, `<system-color>`.
`contrast-color()` reached Baseline newly-available **2026-04-10** (Chrome 147,
Firefox 146, Safari 26; Widely Available projected 2028-10-10), so the
`@supports` fallback is not optional yet.

### P1 — Full contrast matrix, before and after (1188 text cells)

WCAG 2.x, every role × 9 surfaces × 2 themes × 3 modes. Abridged to elev 0 / 2 / 8;
the full table is reproducible from the fixture.

| role | floor | authored L | authored D | derived L | derived D | derived2 L | derived2 D |
|---|---|---|---|---|---|---|---|
| title / body | 4.5 | 18.85 / 15.98 / 15.98 | 16.42 / 13.69 / 13.69 | 21.00 / 16.52 / 7.28 | 18.04 / 15.27 / 7.20 | 21.00 / 16.52 / **9.79** | 18.04 / 15.27 / **9.54** |
| meta / label / quiet | 4.5 | 6.32 / 5.36 / 5.36 | 6.97 / 5.81 / 5.81 | 10.05 / 8.95 / 5.38 | 6.67 / 6.20 / **3.76 ✗** | 10.05 / 8.95 / 6.60 | 6.67 / 6.20 / **4.61** |
| link | 4.5 | 7.44 / 6.31 / 6.31 | 8.64 / 7.20 / 7.20 | 14.65 / 11.53 / 5.08 | 5.84 / **4.94** / **2.33 ✗** | 14.65 / 11.53 / 6.83 | 5.84 / **4.94** / **3.09 ✗** |
| primary | 4.5 | 18.85 (flat) | 16.42 (flat) | 21.00 (flat) | 21.00 (flat) | 21.00 (flat) | 21.00 (flat) |
| brand fill | 4.5 | 5.67 (flat) | 7.51 (flat) | 12.75 (flat) | 7.95 (flat) | 12.75 (flat) | 7.95 (flat) |
| danger fill | 4.5 | 6.56 (flat) | 6.48 (flat) | 11.28 (flat) | 8.84 (flat) | 11.28 (flat) | 8.84 (flat) |
| disabled (`opacity: .45`) | 4.5 | **3.03 / 2.94 ✗** | **4.21 / 3.97 ✗** | 3.35 / 2.64 ✗ | 4.51 / 2.85 ✗ | 3.35 / 2.87 ✗ | 4.51 / 3.34 ✗ |

Totals, excluding the synthetic P3/out-of-gamut probes and the opacity case:

| mode | text cells | WCAG failures | APCA-RC failures | WCAG-pass-but-APCA-fail |
|---|---|---|---|---|
| authored (shipped table) | 342 | **0** | **98** | **98** |
| derived (naive) | 342 | 14 | 140 | 126 |
| derived2 (surface-relative + 24 % cap) | 342 | **6** | 138 | 132 |

The 6 remaining `derived2` WCAG failures are all `dark/link` at elev ≥ 3 — L2.
The **authored** table is 0/342 on WCAG and 98/342 on APCA, which is the whole
APCA question in one line.

### P2 — Does `contrast-color()` have a floor? (729 sRGB surfaces)

| metric | value |
|---|---|
| surfaces swept | 729 (9 levels per channel) |
| **min WCAG ratio** | **4.585:1** |
| surfaces below 4.5:1 | **0** |
| min APCA Lc | **32.5** |
| surfaces below Lc 60 | **239 (32.8 %)** |
| surfaces below Lc 75 (APCA-RC body minimum) | **330 (45.3 %)** |
| picked black / white | 476 / 253 |
| worst surface | `#608000` → black, 4.59:1, Lc 32.5 |

**The failure I did not expect.** I went in assuming the answer to question 1
would be "partly, with caveats". It is stronger and weaker than that at once.
Under WCAG 2.x the guarantee is *absolute* — not "we checked and found none",
but "no such surface exists". Under APCA the same colour pair is Lc 32.5 on an
olive background: WCAG says pass, APCA says badly unreadable, and nearly half
of all surfaces are below the APCA body-text bar even with the *best possible*
foreground. So "contrast failures become structurally impossible" is a true
statement about a metric that is a weak proxy for readability, and a false
statement about readability.

**Verified again at 4913 surfaces** (17 levels per channel) while testing the
fallback below: `contrast-color()` min **4.584:1**, 0 below 4.5. The floor is not
an artefact of the coarse grid.

### P2b — The pre-Chrome-147 fallback. I got this wrong first, and the wrong version is the interesting one.

`contrast-color()` reached Baseline only on 2026-04-10, so a fallback is
mandatory today. My first choice was the well-known OKLCH lightness flip. **It
does not preserve the guarantee**, measured over the 729-surface sweep:

| mechanism | min WCAG | surfaces below 4.5 | disagreements with `contrast-color()` |
|---|---|---|---|
| `contrast-color(var(--s))` | **4.585:1** | **0 / 729** | — |
| `oklch(from var(--s) clamp(0, calc((0.62 - l) * 1000), 1) 0 h)` | **3.939:1** | **20 / 729** | 28 |
| same with a corrected threshold of `0.564` | **3.939:1** | **20 / 729** | 28 |

Worked example: on `#808080` the flip picks **white at 3.95:1** where
`contrast-color()` picks black at 5.32:1. The flip is a *polarity* heuristic, and
OKLCH lightness is not a monotone function of WCAG relative luminance across
hues, so no threshold makes it exact. Moving the threshold to the achromatic tie
point (0.564) changes which surfaces fail without reducing how many.

What does work is computing WCAG luminance in CSS directly. `pow()` is available
alongside `sign()`/`abs()`, and the channel keywords of relative colour syntax
give the sRGB components, so the whole tie-point test fits in one expression —
applied to all three output channels so the result is black or white:

```css
/* Y = the sRGB relative luminance of --s; 0.1791 is the WCAG tie point,
   where contrast-to-white equals contrast-to-black. */
--fg: rgb(from var(--s)
  calc(255 * clamp(0, (0.1791 - (
      0.2126 * pow((r/255 + 0.055) / 1.055, 2.4) +
      0.7152 * pow((g/255 + 0.055) / 1.055, 2.4) +
      0.0722 * pow((b/255 + 0.055) / 1.055, 2.4))) * 100000, 1))
  /* …the same expression again for g, and again for b… */ );
```

Measured over **4913** surfaces:

| mechanism | min WCAG | surfaces below 4.5 | disagreements with `contrast-color()` |
|---|---|---|---|
| `contrast-color()` | 4.584:1 | **0 / 4913** | — |
| the expression above | **4.572:1** | **0 / 4913** | **1 / 4913** (`#e00090`, a boundary tie; both picks clear 4.5) |

**So the 4.5:1 guarantee does not depend on `contrast-color()` shipping.** It is
expressible in CSS that has been Baseline for longer, at the cost of one
verbose-but-write-once table rule. My first attempt at the fallback silently
dropped the guarantee on 20 of 729 surfaces, and only a sweep caught it — the
same lesson as the five oracle bugs, arriving in the derivation instead of the
checker.

### P3 — How deep does nesting-derived elevation stay legible? (41 × 1 % ramp)

Unclamped ramp, `--surface: color-mix(in oklab, base calc(100% − k%), ink)`.
Steps-at-4 % is the practical nesting depth.

| theme | metric | floor | at elev 0 | dies at | = steps @4 % | last-ok surface |
|---|---|---|---|---|---|---|
| light | `--fg` WCAG | 4.5 | 21.0 | **never** | ∞ | — |
| light | ring WCAG (non-text) | 3.0 | 21.0 | **never** | ∞ | — |
| light | `--fg-muted` WCAG | 4.5 | 10.1 | 38.6 % | **9.7** | `#868686` |
| light | `--link` WCAG | 4.5 | 14.7 | 35.2 % | **8.8** | `#8f8f8f` |
| light | `--fg` APCA | Lc 75 | 106.0 | 16.2 % | **4.0** | `#cacaca` |
| light | `--fg-muted` APCA | Lc 75 | 93.4 | 11.6 % | **2.9** | `#dbdbdb` |
| light | `--fg-muted` APCA | Lc 60 | 93.4 | 21.5 % | **5.4** | `#bababa` |
| dark | `--fg` WCAG | 4.5 | 18.0 | **never** | ∞ | — |
| dark | `--fg` APCA | Lc 75 | 106.9 | **never** | ∞ | — |
| dark | `--fg-muted` WCAG | 4.5 | 6.7 | 24.7 % | **6.2** | `#454549` |
| dark | `--link` WCAG | 4.5 | 5.8 | 11.5 % | **2.9** | `#2b2b2f` |
| dark | `--fg-muted` APCA | Lc 60 | **48.4** | — | **0** | already below at depth 0 |
| dark | `--link` APCA | Lc 60 | **43.1** | — | **0** | already below at depth 0 |

**Answer to question 3, in numbers.** The floor is **6 levels** at 4 %/level
(24 % total ink, ΔL\* 22.0), set by dark-mode muted text at 4.61:1 — or **2 levels**
if a coloured link must survive, set by dark `--link` at 11.5 %. Under APCA it is
**2 levels** in light mode and **zero** in dark mode, because grey-on-dark
muted text is below Lc 60 before any elevation is applied at all.

And the sharpest result: **the prototype's authored "three steps then flatten"
floor is derivable.** `roles.css:234-243` calls a fourth nesting level "a
structural problem" and flattens to `--s3` on taste. The contrast budget says
the cap is 6 steps for monochrome roles and 2-3 for hued ones; the shipped ramp
uses cumulative ΔL\* of only 6.55 (light) and 7.98 (dark), i.e. roughly a third
of the monochrome budget. The taste call and the derived bound agree in
direction and the taste call is the conservative one — which is the best
possible outcome for the thesis: **the floor F9 said had to be authored turns
out to have a computable justification, and computing it would have produced the
same design.**

Per-step visibility, measured: ΔL\* 1.04 per 1 % (light), 1.01 (dark); the
authored `s1→s2` step is ΔL\* 3.09 (light) / 3.56 (dark). The maximum
adjacent-surface WCAG ratio anywhere in the probe is **1.162:1** — so elevation
by shade can never be the sole carrier of a meaningful boundary. That is a
derivable table rule, not an opinion.

### P4 — The focus ring, driven by real keyboard focus

Programmatic `.focus()` does **not** match `:focus-visible` in Chromium; these
were captured by real `Tab` presses.

| case | fill | ring colour | offset | ring vs fill | visible? |
|---|---|---|---|---|---|
| primary, `outline-offset: 2px` | `#000000` | `#000000` | 2 px | **1.00:1** | only through the 2 px surface gap |
| primary, `outline-offset: 0` | `#000000` | `#000000` | 0 | **1.00:1** | **no — the ring vanishes** |
| primary, `contrast-color(var(--accent))`, offset 0 | `#000000` | `#ffffff` | 0 | **21:1** | yes |
| dark, all three | `#ffffff` | mirror image | — | mirror image | mirror image |

So the answer to "is a ring derivable against ANY backdrop" is **yes, with a
correction**: `contrast-color(var(--surface))` gives a proven ≥4.585:1 ring
against any *surface*, but the shipped rule (`roles.css:370`,
`outline: 2px solid var(--accent)`) is 1.00:1 against the `primary` role's own
fill and survives only because `outline-offset` happens to be non-zero. The
robust derivation is `contrast-color(<the box's own fill>)` — which again
requires the fill to exist as a custom property, i.e. L7.

### P5 — Interaction states, driven for real

Real hover, real `mousedown`, real `Tab`, real type-and-blur. Every value below
is derived from `--surface`; no component is named anywhere in the fixture.

| state | selector | measured result |
|---|---|---|
| rest | — | bg `#ffffff`, fg `#000000`, border `#b7b7b7` |
| hover | `:hover` | bg `#dedede` (1.35:1 vs rest — a transient affordance, not a 1.4.11 boundary) |
| pressed | `:active` | bg `#bebebe` (1.86:1 vs rest) |
| focused | `:focus-visible` | outline 2 px `#000000`, offset 2 px, 21:1 |
| disabled | `:disabled` | fg+border `#424242` light / `#9d9d9f` dark — 10.05:1 / 6.67:1 |
| placeholder shown | `:placeholder-shown` | `border-style: dashed` — carried structurally |
| checked | `:checked` | `accent-color: rgb(0, 0, 0)` = derived accent |
| invalid at rest | `:invalid` | matched, **no paint** — correct |
| after bad input + blur | `:user-invalid` | border `#711a17`, 3 px inline-start — 11.28:1 |

**How many states must a role enumerate?** Nine, and none of them needs a
component to be told. Every one is `role × state → derived value`, written once
in the table. The count is bounded by the pseudo-class vocabulary, not by the
component count — which is the actual claim under test, and it holds.

### P6 — Forced colors. Question 2, answered with a measurement and a screenshot.

Emulated via CDP `Emulation.setEmulatedMedia` with `forced-colors: active`
(the standardised automation hook, [css-color-adjust-1 §5.1][fca51]), then the
same harness re-run over the same 1404 cells.

| what | before | after |
|---|---|---|
| distinct (fg, bg, border) triples per pane — authored | **13** | **1** |
| distinct triples per pane — derived / derived2 | **12** | **1** |
| roles rendered identically | 0 | **all 26** |
| 9 nesting levels of surface | `#16161a` … `#454549`, 9 distinct | `#ffffff` × 9, identical borders |
| `box-shadow` | `rgba(0,0,0,.14) 0 2px 12px` | **`none`** |
| `accent-color` | `rgb(0,0,0)` | **`auto`** |
| `color-scheme` (author declared `dark`) | `dark` | **`light dark`** — author declaration voided |
| `::selection` | derived accent pair | UA palette (`#ffffff` on `#050049`) |
| `::placeholder` | derived muted | `GrayText` → `#600000`, 14.02:1 |
| text cells below floor | 0 (WCAG) | **54**, all `disabled` at 3.35:1 |
| light pane vs dark pane | different | **pixel-identical** |

**Verdict: the thesis survives, and the resolution table is not the thing at
risk.**

- **Safety: passes, absolutely.** Every text cell except the opacity-dimmed ones
  measures 21:1. The F3 defect class — light text on a background that moved —
  becomes *impossible*, because the UA paints both sides of every pair. Per spec,
  "Authors may still use features such as `color-mix()` in forced colors mode…
  the used value will be overridden with an appropriate system color"
  ([§3.1 note][fca31]) — exactly what I measured: computed values stayed
  `oklab(…)`/`color-mix(…)` while painted values became Canvas/CanvasText.
- **Meaning: fails, totally.** 13 → 1. `primary`, `brand`, `danger`, `quiet`,
  `link` and `default` buttons are pixel-identical white boxes with black
  borders. Nine levels of elevation are one level. The only role still
  distinguishable is `disabled`, and only because `opacity` is not forced — i.e.
  the sole surviving distinction is the one that is also the sole accessibility
  failure.
- **This is not a derivation problem.** `authored` collapsed 13 → 1 and
  `derived` collapsed 12 → 1. Forced colors is orthogonal to the thesis. But it
  is the mode that *proves* the table encodes role semantics only in colour,
  and no other mode can prove that.
- **And derivation makes the fix cheaper, not harder.** Because roles are
  declared as attributes (`data-role="primary|danger|quiet|link"`), one
  `@media (forced-colors: active)` block restores distinction for every role
  including ones not written yet, using properties forced colors does not
  touch — `border-width`, `outline-style`, `text-decoration`, `font-weight`,
  `padding` — plus `<system-color>` keywords where a colour is genuinely
  wanted. An authored-CSS codebase has to revisit every component. **T, not L.**

### P7 — The cost nobody budgeted: derivation blinds the existing checker

`contrast.ts:23-36` parses colours with a regex that accepts `rgb…` and
`color(srgb …)` and returns `null` for everything else, producing N680
"undecidable". A derived table's computed values are `oklab(…)`.

| mode / theme | text cells | undecidable to `channels()` | sample |
|---|---|---|---|
| authored / light | 198 | 18 (9.1 %) | `color(display-p3 0.1 0.55 0.35)` — my synthetic probes only |
| authored / dark | 198 | 18 (9.1 %) | as above |
| derived / light | 198 | **63 (31.8 %)** | `oklab(0.379998 0.0000173157 0.00000763297)` |
| derived / dark | 198 | **63 (31.8 %)** | `oklab(0.696745 0.000843457 -0.00287951)` |
| derived2 / both | 396 | **126 (31.8 %)** | as above |

288 of 1188 text cells overall. This is not a hypothetical: adopting derivation
without touching the checker converts roughly a third of the contrast surface
from *checked* to *undecidable*, which is precisely how a checker gets muted —
the failure mode `contrast.ts:12-13` was written to avoid. The fix is small
(resolve via the compositor, as this harness does, or register `@property`) but
it must land in the same change.

### P8 — `@property` makes the invariant checkable

| declaration | `getPropertyValue('--surface')` | `backgroundColor` | detectable? |
|---|---|---|---|
| registered `syntax: '<color>'` | `oklab(0.879995 …)` | `oklab(0.879995 …)` | in sync |
| unregistered | `color-mix(in oklab, #ffffff 88%, black)` | `oklab(0.879995 …)` | no — raw tokens |
| registered, `background: red` | `oklab(0.879995 …)` | `rgb(255, 0, 0)` | **yes** |

One registration turns L7 from an unenforceable discipline into a one-comparison
diagnostic.

---

## Proposed vocabulary

**Three new declarations, and nine authored tokens per theme deleted to pay for
them.** The whole colour vocabulary fits in the box below.

```
CONTEXT AXES (attributes, inherit and nest like density/input/theme)
  data-theme     = light | dark                     (existing)
  data-contrast  = standard | high                  (NEW — defaults from prefers-contrast)

ENGINE-WRITTEN (like data-fit / data-truncate / data-collapsed)
  data-elev      = 0..N                             (NEW — measured surface nesting depth)

AUTHORED ON A SURFACE
  data-scrim                                        (NEW — this surface paints a
                                                     non-colour background)

AUTHORED COLOUR INPUTS — the whole theme
  --surface-base   one per theme                    (2 values)
  --brand-accent   --brand-danger   --brand-link    (3 values, theme-independent)
  color-scheme     one per theme                    (2 values)

DERIVED, NOTHING DECLARES THEM
  --ink       = contrast-color(var(--surface-base))
  --surface   = color-mix(in oklab, var(--surface-base)
                  calc(100% - min(var(--elev) * var(--elev-step), var(--elev-cap))),
                  var(--ink))                       @property syntax '<color>'
  --fg        = contrast-color(var(--surface))
  --line      = color-mix(in oklab, var(--fg) var(--line-mix), var(--surface))
  --wash      = one elevation step   --press = two
  --accent    = var(--fg)     --accent-fg = contrast-color(var(--accent))
  --danger    = color-mix(in oklab, var(--brand-danger) var(--brand-lift), var(--fg))
  --danger-fg = contrast-color(var(--danger))
  ring colour = contrast-color(<the box's own fill>)

TUNING NUMBERS — one set for the app, checked by N721
  --elev-step 4%   --elev-cap 24%   --line-mix 22%   --brand-lift 62%
  --wash-mix 90%   --min-contrast 4.5
```

**Deleted:** `--s2`, `--s3`, `--fg-muted`, `--line`, `--accent`, `--accent-fg`,
`--danger-fg`, `--link`, `--wash` as *authored* tokens, in both theme blocks and
the `:root` default. Counted from `tokens.css:82-92`, `196-209`, `214-227`:
**33 authored colour literals → 5**. Twenty-eight values that could previously
disagree with each other no longer exist. `--fg-muted` survives as a derived
value but stops being the primary carrier of de-emphasis (L1).

Why `data-contrast` is an axis and not a media query: `tokens.css:9-11` already
argues the case — "an axis is the intent itself". `prefers-contrast` sets the
default; a subtree can still raise it.

Why `data-elev` is engine-written and not a selector chain: `roles.css:238-243`
costs one CSS rule per level and hard-caps at 3. The fit pass already walks the
DOM and already stamps `data-fit`/`data-truncate`/`data-collapsed`
(`states.css:1-15`); stamping the measured surface depth is the same one-line
registration and removes the O(N) selector chain entirely.

---

## Proposed diagnostics

Each is stated with the fixture that proves it can fail — the house rule from
`README.md:198-202`, and the reason the checker's own truthfulness is the
expensive half.

**N711 — SURFACE-DESYNC.** For every element that paints, the resolved
`--surface` must equal its used `background-color`; for every element that does
not paint, `--surface` must equal the nearest painted ancestor's
`background-color`. Requires `@property --surface { syntax: '<color>' }`.
*Fixture that fails it:* `<div data-appearance="surface" style="background: red">`
— measured in P8: var `oklab(0.879995 …)` vs `rgb(255, 0, 0)`.
*This rule replaces N640's per-pair sweep with one structural invariant.* It is
naturally **subtree-scoped** — "each surface owns its own colour context" — so
the `obs.declared(selector)` scoping added for N700 fits it exactly; noting the
opportunity per instruction, not changing any existing rule's decision.

**N721 — ELEVATION-BUDGET (static, checks the table not the DOM).** Given
`--elev-step`, `--elev-cap`, `--line-mix`, `--brand-lift` and the brand hues,
every reachable surface must satisfy `--min-contrast` for every role that can
land on it. This is the second half of F9 — "the framework checks the table".
*Fixture that fails it:* `--elev-cap: 40%` → dark `--fg-muted` 3.11:1,
dark `--link` 1.77:1. *Fixture that must pass:* `--elev-cap: 24%` → worst case
dark `--fg-muted` 4.61:1. Both measured in P3.

**N731 — CONTRAST-COMPOSITE.** N640 must composite every ancestor `opacity`
before reporting a ratio, and must refuse (N680) when an ancestor carries
`filter`, `mix-blend-mode` or `backdrop-filter`.
*Fixture that fails it:* the shipped `[data-appearance="action"][aria-disabled="true"]`
— currently reported as 18.85:1, actually 3.03:1 (measured, L4). *This is the
sixth oracle bug, found the same way as the other five.*

**N741 — OPAQUE-BACKDROP-REQUIRED.** If the nearest painted ancestor has
`background-image` other than `none`, or is `<video>`/`<canvas>`, contrast is
undecidable unless `data-scrim` is declared on that surface.
*Fixture that fails it:* `<div style="background: linear-gradient(#fff, #000)"><span data-text="body">x</span></div>`
— today `backdrop()` reports the colour *behind* the gradient and N640 emits a
confident, wrong number.

**N751 — FORCED-COLOR-COLLAPSE (static, checks the table).** Any two roles whose
computed paint differs only in `<color>`-valued properties must also differ in
at least one property outside the forced list
([css-color-adjust-1 §3.1][fca31]).
*Fixture that fails it:* the table as it stands today — measured 13 distinct
signatures → 1 under `forced-colors: active`. *Fixture that must pass:* the same
table plus one `@media (forced-colors: active)` block giving `primary` a 2 px
border and `danger` an underline.

**N761 — RING-INDISTINCT.** A `:focus-visible` outline whose colour equals the
fill of the box it rings, with `outline-offset` resolving to 0.
*Fixture that fails it:* `.sprim.nogap` in `05-colour-states.html` — measured
ring `#000000` on fill `#000000`, offset `0px`, 1.00:1 (P4).

**N640, amended rather than replaced.** Keep it, add an sRGB resolution step so
it can read `oklab()`/`color-mix()`/`oklch()` (P7: 288/1188 cells currently
undecidable), and add an **advisory** APCA Lc alongside the WCAG ratio. Do
**not** make APCA a failure condition — see below.

**On adopting APCA.** Measured cost: the shipped table is **0/342 WCAG failures
and 98/342 APCA-RC failures**, all of them WCAG-pass-but-APCA-fail, across 12
role/theme classes (dark `meta`/`label`/`quiet` at Lc 48-50, dark `link` at
Lc 58, dark `brand` Lc 56, dark `danger` Lc 50, light `meta` at Lc 70 on `--s3`).
Every one of those is a real "grey text on dark is hard to read" complaint, so
APCA is telling the truth. But as of 2026 APCA was **pulled from the July 2023
WCAG 3 working draft and remains exploratory**; WCAG 3 is still a Working Draft
with its contrast algorithm undetermined, and every procurement standard
references WCAG 2.x AA. Recommendation: **WCAG 2.x is the gate, APCA Lc is
reported as an advisory second number.** Turning 240/240 into 240/240-plus-98
advisories is informative; turning it into 98 failures against an exploratory
algorithm is how a checker gets ignored.

---

## Against Apple

| capability | what Apple does | derivation vs Apple |
|---|---|---|
| semantic colour roles | `UIColor.label` / `.secondaryLabel` / `.tertiaryLabel` / `.quaternaryLabel`, resolved against `UITraitCollection` | **matches** on structure — a context-axis system with dynamic providers is exactly the right shape — and **beats** on verifiability. Apple's four label tiers are hand-picked; there is no compile-time or runtime assertion that `secondaryLabel` on `tertiarySystemBackground` clears any ratio. `tokens.css:200-203` records the c11 equivalent narrowly missing at 4.22:1 and being fixed by hand — the same hazard, but written down. |
| elevation | `systemBackground` / `secondarySystemBackground` / `tertiarySystemBackground`, plus a separate `systemGroupedBackground` family, plus `elevated` variants on macOS | **beats.** Apple's ramp is authored, three deep, and duplicated across two families and two appearances — roughly 12 authored colours where derivation needs one plus a step. And Apple's depth cap is undocumented taste; mine is 6 levels with the arithmetic to justify it (P3). |
| Auto Layout content priorities | a genuine simplex solver over constraints, with priorities `1…1000` | **loses, and this is not my slice's fight** — but the colour analogue is instructive: Apple's *layout* is solved and its *colour* is not. Nobody has an iterative colour solver, which is exactly why L2 (a hued colour at a target ratio) is open. |
| Dynamic Type | text styles scale by user setting; colours do not participate | **matches.** `--unit` and the type ramp do the same job. Apple's advantage is a system-wide user setting the app inherits for free; the web's `prefers-contrast` is the nearest equivalent and it is coarser (`more`/`less`/`custom`). |
| materials / vibrancy | `.regularMaterial`, `.thinMaterial` — real-time blur and blend, tuned by eye per appearance | **loses.** `backdrop-filter` exists but the resulting painted colour is not computable from computed style, so both the derivation *and* the checker go blind (L4). Apple does not check either, but Apple's materials were tuned across an entire OS by people with eyes, and an unverifiable derived blur is worse than an unverified hand-tuned one. |
| SF Symbols hierarchical rendering | one tint, layers at authored opacity tiers | **matches** the mechanism (`color-mix` does the same) and **beats** on checkability — but note that Apple's opacity tiers are precisely the L4 failure mode: an opacity-dimmed glyph has no contrast number anyone computes. |
| contrast verification | no `UIColor` contrast API; Xcode Accessibility Inspector reports WCAG 2 ratios post-hoc on a running app, per screen, on demand | **beats, decisively.** This probe computed 1188 role × surface × theme ratios headlessly in one pass, and for the primary foreground the answer is not "we measured and found none" but "no such surface exists" (P2). That is the difference between an inspection and a proof. |
| increase-contrast mode | `accessibilityContrast` trait selects a second authored palette | **beats.** `--muted-mix: 100%; --line-mix: 100%` is one declaration; Apple ships a parallel palette. |
| forced high-contrast palette | nothing equivalent — iOS/macOS never flatten an app's palette to two colours; Smart Invert is the closest and it is an inversion, not a palette | **neither.** Different platform contract. But the web's forced-colors is a *forcing function* Apple's system lacks: it proves in one measurement that role semantics carried only in colour are a bug (P6, 13 → 1). Apple's HIG asks designers not to rely on colour alone; the web *checks*. |

The pattern across the row set: Apple's system is a very good authored table
with a genuinely superior *layout* solver and no *colour* solver at all. Its
weakness is exactly the one the maintainer named — it is authored by humans with
eyes and it is not machine-checkable. Where derivation wins it wins on proof
(P2, P8) and on the size of the authored surface (33 colours → 5). Where it
loses it loses on materials, and on the fact that Apple's designers can see
things a contrast ratio cannot.

---

## Open questions for the maintainer

1. **Is a 4.585:1 guarantee worth losing chosen contrast?** `contrast-color()`
   only ever returns black or white. Adopting it means the primary foreground
   can never fail and can also never be a soft charcoal. Is maximum contrast an
   acceptable default for body text, with softness available only through the
   size/weight route (L1)?
2. **APCA: advisory or gate?** The shipped table is 0/342 on WCAG and 98/342 on
   APCA-RC. Reporting both is cheap. Gating on APCA against an exploratory,
   non-normative algorithm changes 240/240 into a red run tomorrow. My
   recommendation is advisory; this is a values call, not a technical one.
3. **`--elev-cap`: 6 levels or 2?** 6 keeps every monochrome role above 4.5:1.
   2 is what a coloured link survives (dark, 11.5 % ink). Do hued foregrounds
   exist in the vocabulary at all, or does L2's option 1 — hue moves to the
   underline, text stays `contrast-color()` — become the rule?
4. **Does `data-scrim` earn its place, or is "a surface may not paint an image"
   the better rule?** Forbidding image backdrops under text removes L5 and one
   declaration at once. It also forbids a hero.
5. **`opacity` for disabled: delete outright?** Replacing it with derived muted
   ink takes the measured ratio from 3.03:1 to 10.05:1 and makes the state
   visible under forced colors. The cost is that `opacity` also dims borders and
   icons for free, and a derived version has to name each.
6. **`contrast-color()` is Baseline *newly* available (2026-04-10, Chrome 147),
   Widely Available projected 2028-10-10 — but the guarantee does not depend on
   it (P2b).** The pure-CSS luminance expression holds the same 4.5:1 floor
   (0 / 4913 failures) at the cost of one long, ugly, write-once rule. Which is
   the primary path: `contrast-color()` with the expression as the `@supports`
   fallback, or the expression unconditionally so there is exactly one code path
   to reason about and to check? I lean to the second — a resolution table with
   two branches is a table that can disagree with itself, which is F9's whole
   lesson.
7. **Firefox and WebKit.** Everything here is Chromium 151. The mechanism is
   `contrast-color()` + `color-mix()` + `@property`, all three engines, all
   passing WPT per the Baseline data — but tie-breaking at the black/white
   boundary and the exact `oklab` serialisation are not verified outside
   Chromium, and P7's parser fix depends on that serialisation.

---

## Belongs to another slice

- **`field-sizing: content`** is live in Chrome 151 (gate `fs` passed). It
  changes how a field's intrinsic inline size is computed, which interacts
  directly with `roles.css:178-187`'s deliberate `min-inline-size: 0` exemption
  from crush detection. → **layout/sizing slice.**
- **`box-shadow` computes to `none` under forced colors**
  ([css-color-adjust-1 §3.1][fca31]), and `states.css:116-118` calls that shadow
  "the only shadow in the system… the signal that this layer floats above the one
  the solver measured". Under forced colors that signal is gone and the overflow
  menu is bounded only by its border. → **overlays/positioning slice.**
- **`transition: background-color var(--motion)`** on actions
  (`roles.css:89-92`) animates a `color-mix()` result. Interpolating between two
  `color-mix(in oklab, …)` values is well-defined but the intermediate frames
  have no contrast guarantee. → **motion/transitions slice.**
- **`text-wrap: pretty` and `::selection`** interact: a selection highlight
  spanning a rebalanced last line is the only place `::selection`'s derived pair
  is visibly bounded by line-breaking. → **text/typography slice.**
- **`reading-flow`** does not affect colour, but the `:focus-visible` ring is
  the only visible evidence of focus order, and P4 shows the ring's visibility
  depends on `outline-offset`. → **verification slice**, if focus-order proof
  paths are being added.

[mdn-cc]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/contrast-color
[mdn-af]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:autofill
[fca31]: https://drafts.csswg.org/css-color-adjust-1/#forced-colors-properties
[fca32]: https://drafts.csswg.org/css-color-adjust-1/#propdef-forced-color-adjust
[fca51]: https://drafts.csswg.org/css-color-adjust-1/#emulate-forced-colors-mode
