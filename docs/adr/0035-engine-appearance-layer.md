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
