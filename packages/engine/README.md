# @nisli/engine

Typed UI blocks decided by an engine.

App code says **what** things are. The engine decides how they are laid out
and what fits, at every width — and has no visuals of its own. A **skin**,
installed once with `useSkin(defaultSkin)`, says what the parts look like. There
is no CSS file, no `className`, no `style` prop, no `data-*` attribute anywhere
in the public surface — the types do not offer them. If it typechecks, it is
laid out right; if it is skinned, it looks right.

```ts
import { Toolbar } from '@nisli/engine';

Toolbar({
  title: 'Grandmother’s lasagne al forno',
  actions: [
    { id: 'share',  label: 'Share',       priority: 'tertiary' },
    { id: 'export', label: 'Export',      priority: 'tertiary' },
    { id: 'edit',   label: 'Edit' },
    { id: 'save',   label: 'Save recipe', priority: 'primary', onSelect: save },
  ],
});
```

That is everything an author can say about a toolbar. At 1024px all four
actions sit in the row. At 600px `Export` moves into an overflow menu. At 480px
only `Save recipe` remains beside the title. At 360px the title truncates
rather than lose the primary action. None of that is in the app; all of it is
proven by `toolbar.test.ts` at each of those widths, with no screenshot.

## What is banned, and what is not

Banned: the *spelling* of appearance — pixels, colours, `flex-end`, `sticky`,
breakpoints. Not banned: *intent*. "These are the actions" is intent, and the
engine places them trailing. "This bar stays reachable while scrolling" will be
a typed boolean on the block that owns the page, not `position: sticky` in app
code. Intent is vocabulary the types offer; appearance is the engine's.

## Two layers

- **Engine (scaffolding, visual-less).** Structure and decisions: what is shown,
  hidden, truncated; columns; widths; sticky; numeric alignment; menus and
  dialogs; focus and ARIA; spacing *metrics* (`metrics.ts` — the numbers fit
  needs). `skin.test.ts` proves that with no skin installed, no block emits a
  colour, font, border, radius or shadow.
- **Skin (visuals, optional).** A `Skin` maps named parts — `button.primary`,
  `card`, `table.header`, `meter.fill.negative`, … — to style records, or is a
  function of the *context axes* (`{ scheme: 'light' | 'dark' }`) returning
  that map. The engine places parts; the skin dresses them. The engine owns
  the scheme: `useSkin(defaultSkin)` follows the platform preference live and
  sets `color-scheme` on the document; `setScheme('dark' | 'light' | 'system')`
  is the one preference an app forwards. A skin never contains layout, and a
  complete skin defines every part in `PARTS` — `skin.test.ts` proves both for
  the default skin, and that every part a block asks for exists in both
  schemes.

Where a new need goes: a new *semantic* word on a block (`priority`, `tone`,
`kind`), a new *engine rule* derived from structure (a surface inside a surface
draws no second card), or a new *skin part*. Never a per-instance appearance
prop in app code — that is the one place the contract erodes.

## How a block is built

1. `fit()` (`src/engine/fit.ts`) is pure: width + items → plan. One rule —
   items give ground from lowest priority up, and each pays in order:
   **shrink** (truncate to a minimum), **stack** (fold into another item and
   stay visible — a table column becomes a muted line under the primary
   cell), **overflow** (leave into a menu). Nothing is lost that can be kept.
   `useFit()` (`src/engine/use-fit.ts`) is the one reactive measure→decide→
   apply loop every fit-driven block uses; blocks never write a style they
   also compute.
2. A block ranks its parts (a Toolbar ranks `primary` above the title, the
   title above `secondary`). That ranking *is* the block's taste.
3. The block measures once, decides once, writes once. The measurer is a seam
   (`setMeasurer`) so the block is proven in a unit test at any width.
4. Every visual value comes from the installed skin. No stylesheet exists.

## Blocks

`App`, `Page`, `Toolbar`, `Section`, `Grid`, `Stat`, `Table`, `Form`,
`Dialog`, `Meter`, `Bars`, `Columns`, `Empty`, `Text`, `Link`; plus
`notify()` and `confirm()`.

- **Form** — a schema of fields (`when`, dependent `options`, `readOnly`,
  `validate`, bounds, `group`, `long`); the engine decides presence, columns
  at width, segmented group vs. select, validation timing and announcement,
  and — when given `initial`/`key` instead of `value` — owns the draft,
  its dirtiness and its reset. Domain in `src/blocks/form/`.

## Status

Blocks are added only after the previous ones have been used in an app. See `docs/research/nextgen/AUDIT-2026-08-27.md` for why breadth-first
was the mistake this package exists to not repeat.
