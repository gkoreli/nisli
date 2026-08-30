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

Every block is `block(tag, spec)` (`src/blocks/kernel.ts`): a composition of
behaviours it opts into, each a function over the same small `Ctx`. There is
no class hierarchy and no base block. Section, the smallest real one:

```ts
import { el, computed } from '@nisli/core';
import { cardBox } from '../style.js';
import { block } from './kernel.js';
import { toList, type Children } from './types.js';
import type { Status } from './status.js';

export interface SectionProps {
  title?: string;
  children: Children;
  /** An async result; the engine renders its waiting, failure and refresh. */
  status?: Status;
}

/** A titled surface. Inside another surface it draws no second card (engine rule). */
export const Section = block<SectionProps>('nisli-section', {
  surface: true,
  status: true,
  host: (ctx) => ({ display: 'flex', flexDirection: 'column', gap: ctx.metrics.space[3], ...cardBox(ctx.nested) }),
  hostParts: (ctx) => (ctx.nested ? 'card.nested' : 'card'),
  render: (props, ctx) => [
    el('h3', { style: ctx.part('text.title', () => ({ display: props.title.value ? 'block' : 'none', margin: 0, font: 'inherit' })) }, [
      computed(() => props.title.value ?? ''),
      ctx.updating,
    ]),
    ctx.failure,
    ctx.waiting(() => toList(props.children.value)),
  ],
});
```

Read it top to bottom:

1. **The props are the intent.** `SectionProps` is the closed set of things
   an app may say. Nothing in it is a look.
2. **Behaviours are declared, not inherited.** `surface: true` provides
   surface depth to the subtree, and `ctx.nested` reads it — a Section inside
   a Section is not a card. `status: true` means the block holds a `status`
   prop and the engine draws its waiting, failure and refresh; `ctx.failure`,
   `ctx.updating` and `ctx.waiting(body)` are the slots the block places, and
   each re-runs only when its own flag flips. A block with its own waiting
   shape gives `status: { skeleton: (ctx) => ctx.skeleton([ctx.bone(…)]) }`;
   one that waits in place (Table) reads `ctx.pending`. `measure: 'width'`
   (or `'viewport'`) gives `ctx.width`, the measured size — 0 before mount,
   and every decision then takes its roomiest form.
3. **Structure comes from `ctx.metrics`; every decision is a pure function
   in `src/engine/space.ts`.** `columnsFor`, `shellMode`, `dialogMode`,
   `labelColumn`, `labelEvery`, `labelWidth`, `pageSize` and `fit()` take a
   width and numbers and return data — no DOM, no signals. A block feeds them
   `ctx.width.value` and renders the answer. `spec.host(ctx)` is the host's
   structural style as one reactive effect that *replaces* its previous run
   (a property absent this run is blanked), and `hostParts` names the parts
   it is dressed as; both may decide over `ctx.width`, `ctx.nested` and
   `ctx.props`.
4. **`ctx.part(parts, structure)` is the one way to style an element.** It
   returns a computed style string: the structure (metrics, decisions) with
   the skin's look for `parts` layered after it, live with the skin. Either
   argument may be a thunk that reads signals; a parts thunk may return `[]`
   to switch a look off, and the property is cleared. Nothing writes
   `element.style`; the one sanctioned imperative write is `lockScroll()`
   on `<body>`. `kernel.test.ts` scans every file under `src/blocks/` for a
   violation: no `css`/`look`/`apply` import, no `element.style`, no string
   `style:`, no module `metrics`, no second `display: contents` root.
5. **Fitting is a behaviour too.** A row-fitting block (Toolbar, Table) calls
   `ctx.fitRow({ available, items, gap, deps, report })`: one reactive
   measure → `fit()` → plan loop, and when the plan has negative slack the
   kernel files the report through `reportIf` with the block's tag. `fit()`
   has one rule — items give ground from lowest priority up, and each pays
   in order: **shrink** (truncate to a minimum), **stack** (fold into another
   item and stay visible), **overflow** (leave into a menu). Nothing is lost
   that can be kept. A block's ranking of its parts *is* its taste.
6. **Async is owned.** `ctx.busy.run(id, handler)` marks an action busy while
   its promise settles and tells the person about a rejection; `ctx.busy.is`
   reads it.

Where a new need goes: a new *semantic* word on a block (`priority`, `tone`,
`kind`), a new decision in `space.ts`, a new engine rule read from the tree,
or a new *skin part*. Never a per-instance appearance prop in app code — that
is the one place the contract erodes.

## Testing

Every decision is provable at a width with no browser. `mount()` from
`@nisli/engine/test` (`src/test/mount.ts`) mounts one block into a document
and answers every `measure()` from its options:

```ts
import { mount, textMeasurer } from '@nisli/engine/test';

const t = mount(Section, { title: 'S', children }, { width: 800, scheme: 'dark' });
t.styleOf().padding          // '16px' — the host's inline style
t.styleOf('h3').display      // 'block' — any descendant's
t.resize(320);               // the frame changes; every block re-decides
t.unmount();                 // disposes, restores the measurer, skin and document
```

- `width` is the block's inline size (default 800), `viewport` the document's
  (default `width`), `scheme` installs the default skin at that scheme (bare
  when omitted), and `text` sizes text-shaped elements (titles, cells,
  buttons); anything unanswered is the frame.
- `textMeasurer(charWidth)` is the deterministic `text`: `labelWidth`, the
  engine's own estimate — characters × glyph width, plus a button's
  horizontal padding — so a plan is arithmetic (`toolbar.test.ts` proves the
  degrade order at five widths this way).
- `resize(width, viewport?)` is the frame changing: the measurer answers the
  new numbers and every observed block re-measures, as a `ResizeObserver`
  would tell it.
- `prove(make, { widths })` mounts a whole screen at each width with the
  estimating measurer and returns every `LayoutReport` the engine filed —
  an empty result is the proof.

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
