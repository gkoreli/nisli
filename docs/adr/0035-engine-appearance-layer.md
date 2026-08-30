# 0035. Engine Appearance Layer — Visual-less Core, Skins, Parts and Axes

**Date**: 2026-08-29
**Status**: Accepted
**Depends on**: [0034-engine-typed-blocks-decided-by-an-engine](./0034-engine-typed-blocks-decided-by-an-engine.md)
**Code**: [`packages/engine/src/skin.ts`](../../packages/engine/src/skin.ts), [`skin/default.ts`](../../packages/engine/src/skin/default.ts), [`style.ts`](../../packages/engine/src/style.ts), [`metrics.ts`](../../packages/engine/src/metrics.ts), [`skin.test.ts`](../../packages/engine/src/skin.test.ts)

## Context

The first engine carried its look inside itself: one `theme.ts` with colours,
fonts and radii, read directly by every block. It worked, and it fixed taste
forever — a designer with a brand had no way in, and the honest assessment of
2026-08-28 named "taste is fixed" as the framework's largest weakness.

Goga's call the same day: **the core engine should be visual-less; it should be
scaffolding, and visuals are added as needed.** This ADR records that split and
the contracts that keep it honest.

## Decision

### The boundary

| structural — engine, from `metrics.ts` | visual — skin, via `look()` |
|---|---|
| display, flex, grid, column count, widths, min-widths | colour, background |
| gap, padding, control height (the numbers `fit()` needs) | font family, size, weight, letter-spacing |
| position sticky/fixed/absolute, z-index, overflow, ellipsis | border, radius, shadow |
| text alignment of figures, tabular numerals | text decoration, transform |
| what is shown, hidden, folded, disabled, busy | what any of that *looks like* |

With no skin installed a block renders **bare**: browser-default text on a
correct layout. The sidebar, grid columns, sticky toolbar, overflow menu,
truncation and numeric alignment are all still right — that is the proof the
layout lives in the engine. Ledger exposes it at `/?bare`.

### Parts are the seam

A `Skin` is `Partial<Record<Part, StyleRecord>>`. `Part` is a closed union
(`skin.ts`) named by *what a piece is*: `surface`, `text.title`, `button.primary`,
`input.invalid`, `card.nested`, `nav.link.active`, `table.header`,
`meter.fill.negative`, `skeleton`, `notice.positive`, `chart.bar`. Blocks ask
`look(...parts)` and spread the answer after their structural styles; several
parts compose (`look('surface', 'bar')`, `look('text.muted', 'tone.negative')`).
Tones and states are parts, so a skin decides once what "negative" means.

### Axes

Skins vary on context the engine detects; the app never asks the platform.
First axis, colour scheme.ts`):

```ts
type Scheme = 'light' | 'dark';
interface SkinAxes { scheme: Scheme }
type Skin = SkinParts | ((axes: SkinAxes) => SkinParts);
useSkin(skin: Skin | null, options?: { scheme?: Scheme | 'system' }): void;
setScheme(scheme: Scheme | 'system'): void;
```

`'system'` (the default) follows `prefers-color-scheme` reactively; the engine
also sets `color-scheme` on the document so native controls, scrollbars and
form widgets agree. A skin written as a function receives the axes; the default
skin ships a dark palette. Density and input modality are the next axes
([0034](./0034-engine-typed-blocks-decided-by-an-engine.md) plan, phase 5).

### Two contracts, both tests

1. **Bare emits no visual property** — `skin.test.ts` mounts every block with
   no skin and asserts no rendered `style` carries colour, background, border,
   radius, shadow, font or text decoration (pure resets such as `border:none`
   on a button are allowed). It caught seven leaks on its first run; it is what
   stops the scaffolding from quietly reacquiring taste.
2. **Completeness** — every part any block asks `look()` for exists in the
   default skin, in every scheme, and the default skin defines every `Part`. A
   misspelt part is a test failure, not a silently unstyled button.

## Rationale — "if you want flat, why is that a big deal?"

Asked when the Accounts page showed a `Stat` card inside a `Section` card.
Three places a "flat" could live: an engine rule derived from nesting
(`SurfaceContext`: a surface inside a surface draws no card), a skin part
(`card.nested`: what a nested surface looks like), or an app prop
(`Section({ flat: true })`). The first two are exactly how visuals are "added
as needed" and cost the app nothing. Only the third erodes the contract — a
per-instance appearance token with no meaning, verifiable only by looking, which
an agent will apply inconsistently. Card-in-card was solved in home 1 with home
2 supplying the look; the app did not change a character. The split in this ADR
is what makes that the cheap path.

## Consequences

- A brand is a file. Swapping `defaultSkin` restyles every block, live.
- The engine has no opinion about beauty and cannot acquire one without
  failing a test.
- Everything mounted outside the `App` (notices, `confirm()` dialogs) must
  carry its own font through its part; `notice` does.
- Skin authors work against a closed `Part` list and two schemes; adding a part
  means adding it to the union, the default skin and the completeness test in
  the same change.

## Amendment 2026-08-30 — contrast held by construction

**Status of this amendment**: Accepted. **Source**: the next-round panel's
completeness critic, [Candidate A `skin-contrast`](../research/engine/next-round-panel-2026-08-30.md).
**Code**: [`skin/contrast.ts`](../../packages/engine/src/skin/contrast.ts),
[`skin/default.ts`](../../packages/engine/src/skin/default.ts),
[`skin.test.ts`](../../packages/engine/src/skin.test.ts).

### What was measured

The two contracts above proved the default skin *exists* for every part; they
said nothing about whether its colours could be read. The critic computed the
WCAG 2.x ratio for every (ink, ground) pair the blocks render and found the
accepted look failing in both schemes:

| scheme | pair | ratio | needs |
|---|---|---|---|
| light | `text.faint` on every ground (raised, card, dialog, menu, bar, surface) | 3.45 | 4.5 |
| light | `text.faint` on `surface.sunken` (the page ground) | 3.20 | 4.5 |
| light | `chart.axis` on card (same ink as `text.faint`) | 3.45 | 4.5 |
| light | `tone.warning` on raised / card (Stat delta, Text tone) | 3.64 | 4.5 |
| light | `tone.warning` on `surface.sunken` | 3.37 | 4.5 |
| light | `notice.warning` white ink on warning | 3.64 | 4.5 |
| light | `input` border vs raised | 1.41 | 3 |
| dark | `text.faint` on raised-ish grounds / on surface and bar | 3.87 / 4.25 | 4.5 |
| dark | `chart.axis` on card | 3.87 | 4.5 |
| dark | `notice.positive` white ink on positive | 2.22 | 4.5 |
| dark | `notice.negative` white ink on negative | 2.78 | 4.5 |
| dark | `notice.warning` white ink on warning | 1.95 | 4.5 |
| dark | `input` border vs raised | 1.18 | 3 |

Fourteen failing pairs in light, twelve in dark. Review of the first fix found
one more ground the table had missed — `table.row.hover` under a cell that
carries `Text({ tone })` or the fold line — on which light `tone.positive`
(4.49), `tone.warning` (4.46) and `text.faint` (4.42) fail today. Ledger's
transactions table draws income in `positive` on every hovered row.

### Third contract, a test

3. **Contrast** — `skin.test.ts` proves that every rendered (ink, ground) pair
   meets its WCAG requirement in every scheme: 4.5:1 for text under 18 px,
   3:1 for large text (`text.display`, 28 px) and for non-text edges and fills
   (input borders, meter fills, chart bars). A failure reads
   `dark: notice.warning text on notice.warning — #ffffff on #e3b341 is 1.95:1, needs 4.5:1`.
   A third-party skin runs the same proof against its own palette.

### The mechanism — `PAIRS`

`skin/contrast.ts` is a pure module: `parseColor`, `composite` (source-over),
`luminance`, `contrastRatio`, and `PAIRS` — every (ink, ground) combination the
blocks actually render, read off their `ctx.part()` calls. A pair is a list of
existing parts for the ink and a list for the ground, **layered exactly as the
block layers them**: the innermost non-transparent `background` wins the ground
(rgba composited outward, so `card.nested` with a transparent background falls
through to its parent `card`), the last `color` / `borderColor` / `background`
wins the ink. No new `Part` is named; `measure(parts)` resolves a pair against
any skin. The table (94 pairs at first landing, plus the hover, link, header,
axis and segmented-read-only pairs the review added) covers seven text roles
and `text.display` on eight grounds, `nav.link` on the bar, the four tones on
Stat deltas, sunken and card, the four button variants, tinted notices, input
text and borders, meter fills, chart bars, link, table header, chart axis and
menu items.

A focus-visible ring is **not** in the table: no focus-ring part exists in the
`Part` union and [0042](./0042-engine-reachability.md) did not add one, so the
ring-vs-raised 3:1 pair waits for a named part.

### Palette changes, before → after

The light palette is the accepted look and moved only where it failed.

| scheme | field | before → after | ratio before → after |
|---|---|---|---|
| light | `textFaint` | `#8a8a8a` → `#707070` | on raised 3.45 → 4.95; on sunken 3.20 → 4.59 |
| light | `warning` | `#b7791f` → `#9a6410` | tone on raised 3.64 → 4.99; on sunken 3.37 → 4.62; notice white ink 3.64 → 4.99 |
| light | `inputBorder` (new) | — → `#8c8c8c` | input edge vs raised 1.41 → 3.36 (`border` / `borderFaint` untouched) |
| light | `hover` | `#f2f2f2` → `#f5f5f5` | positive on hover 4.49 → 4.61; warning 4.46 → 4.58; faint 4.42 → 4.54 (hover vs raised 1.12 → 1.09, still a visible tint) |
| dark | `textFaint` | `#7c7f88` → `#8f929b` | on raised 3.87 → 4.99; on surface 4.25 → 5.47 |
| dark | notice inks (`positiveText` / `negativeText` / `warningText`, new) | `#ffffff` → `#0b1020` | positive 2.22 → 8.55; negative 2.78 → 6.82; warning 1.95 → 9.73 (light keeps white: 5.02 / 5.44 / 4.99) |
| dark | `inputBorder` (new) | — → `#6f727c` | input edge vs raised 1.18 → 3.23 |

Unchanged: `text`, `textMuted`, the three planes, accents, `positive`,
`negative`, dark `warning`, overlay, skeleton, feedback notices, shadows.
`Palette` gained four fields; a third party calling `partsOf(customPalette)`
gets a type error, not a silent gap.

### Rule

**A block that renders a new text-on-ground combination adds a pair.** The
same change that introduces the `ctx.part()` layering adds its `(ink, ground,
requirement, where)` entry to `PAIRS`, in the block's own layering order. The
contrast test then covers it in both schemes; a skin that cannot read it fails
the proof by name. This is the third leg beside the two existing rules: bare
emits no visual property, and every part asked for exists.
