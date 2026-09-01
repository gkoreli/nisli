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

## Determinism

A layout decision is a function of viewport width and declared intent, never
of which data is currently shown; data fits into the decided structure — it
truncates, folds, or wraps — and never reshapes it (ADR 0044; the tenet is
also 0034 §The contract rule 1 and `packages/ledger/TENETS.md` §13).
Invariant under data at a width: a table's column set, each column's pinned
width and which columns fold; a toolbar's overflowed action set; a grid's or
form's column count; the sections and actions on screen. Free to vary: the
row count; a row's height (a fold line with an empty value earns no line);
the fold line's text and where any ellipsis falls; the `Empty` block; a
chart's item count (one item is one slot — the count is the chart's
structure, its text is not). Sorting, filtering, paging or "Show N more" can
never move a column. A figure wider than its budget truncates and files
`FIGURE_TRUNCATED` — evidence that a format or one metric is wrong, fixed
once, never a re-plan. `prove()` checks the property as `DECISION_UNSTABLE`
by diffing every block's stamped plan across a page advance and each
data-perturbed variant (§Proof).

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
- **Contrast is a contract, checked like completeness.** `skin/contrast.ts`
  holds `PAIRS`: every (ink, ground) combination the blocks actually render,
  read off their `ctx.part()` calls and written as the parts layered exactly
  as the block layers them — `['text', 'tone.positive']` on
  `['surface', 'card', 'table.row.hover']` is a toned cell in a hovered row.
  `measure(parts)` composites the ground (innermost opaque background, alpha
  layers over it), picks the ink (last part that sets `color`, or the border
  or fill for non-text), and checks the WCAG 2.x ratio: 4.5 for text, 3 for
  large text and edges/fills. `skin.test.ts` proves the default skin in both
  schemes; a third-party skin runs the same proof. When a block starts
  rendering a combination PAIRS does not list, add the pair (with the
  `file:line` it came from) — no new part is needed, and the palette moves
  only where the proof fails.

## Axes

Context the engine detects or is told — never authored per block — and that
every number is a function of (ADR 0046). Three axes, one signal:

| axis | values | resolved from |
|---|---|---|
| `scheme` | `light` / `dark` | `prefers-color-scheme`, live; `setScheme()` |
| `density` | `comfortable` / `compact` | a preference; `setDensity()`; `'system'` is `comfortable` |
| `input` | `pointer` / `touch` | `(pointer: coarse)`, live; `setInput()` |

`metrics` is the door every structural number comes through, and it is
**live**: the same object at every read, its groups getters over the table
`metricsFor({ density, input })` decides. A read inside a reactive scope — a
`host`, a `ctx.part()` thunk, a `computed` — follows an axis change; a read
outside one holds the table of that moment, which is why every `ctx.part`
structure is a thunk (the kernel scan enforces it) and why `prove()` files
`AXIS_STALE` for any block whose live flip differs from a fresh mount.

What moves, and what does not: density scales rhythm and controls
(`space` 4 8 12 16 24 32 → 4 6 8 12 16 24; `control.height` 32 → 28,
`padX` 12 → 8) and nothing else; input floors (`control.height` to at least
44, `check` 24, `hit` 44) through `max`, so compact + touch is 44 px
controls with compact spacing. `layout` — every threshold and char budget —
is one column for every context: a compact context that lowered its floors
would be the one that overflows. Type does not scale; `charWidth` stays
calibrated to the skin's 14 px body. `control.hit` (24 at pointer, WCAG
2.5.8; 44 at touch) is the floor blocks give targets that are not controls:
a table row and header cell, a nav link, a menu item, the notice dismiss.
`prove({ axes: [{}, { density: 'compact' }, { input: 'touch' }] })` proves
a screen at widths × contexts and files `TARGET_SMALL` for any target under
`hit` on touch.

An app forwards a person's preference and nothing more: `useSkin(defaultSkin,
{ scheme, density })` once, `setDensity(settings.density)` when it changes.
No block, screen or prop says `compact`; a "dense table on a comfortable
page" is the first step back to `className`.

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
   `style:`, no module `metrics`, no second `display: contents` root, no
   `document.addEventListener`, no `zIndex:` literal.
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
7. **Floating is a behaviour.** `ctx.overlay({ kind, open, onDismiss, within,
   anchor, initialFocus })` puts a layer on the document's one overlay stack
   while `open` is true. The stack (`src/engine/overlay.ts`, pure) decides who
   an Escape or an outside pointer reaches — the topmost non-passive layer
   only, so one Escape closes one thing and a notice is never in the way —
   what a `modal` does (trap focus over its visible controls, lock scroll
   through the one ref-counted body write, restore focus) against a
   `popover` (a menu: dismiss, restore focus to its anchor) and a `passive`
   layer (a notice: never focused, never inert, top of the z-order), where
   an anchored layer goes (`placeMenu`, kept inside the viewport, `ltr` and
   `rtl`, re-placed on resize and scroll) and its z-index
   (`ctx.metrics.layer` base plus stack position, which is the paint order).
   Dialog, the Toolbar menu, `confirm()` and `notify()` render `z` and
   `placement`; the kernel owns the only document listeners in the engine.

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
  when omitted), `density` and `input` set the sizing axes (reset to
  `'system'` on `unmount()`), and `text` sizes text-shaped elements (titles,
  cells, buttons); anything unanswered is the frame.
- `textMeasurer(charWidth)` is the deterministic `text`: `labelWidth`, the
  engine's own estimate — characters × glyph width, plus a button's
  horizontal padding — so a plan is arithmetic (`toolbar.test.ts` proves the
  degrade order at five widths this way).
- `resize(width, viewport?)` is the frame changing: the measurer answers the
  new numbers and every observed block re-measures, as a `ResizeObserver`
  would tell it.
- `measure` answers every element `text` did not (the estimator, in
  `prove()`); `frame` is the root the claim checkers walk.
- `prove(make, { widths, axes?, viewport?, scheme?, turns? })` mounts a whole
  screen at each width (× each `axes` context) over `mount()` with the estimating measurer, turns to
  a fixed point, `settle()`s the data in, and returns `{ claims, reports,
  byWidth[{ width, claims, reports, turns }] }` — every claim that does not
  hold. An empty `claims` is the proof. Every Ledger screen is proven this
  way (`packages/ledger/src/screens/screens.proof.test.ts`: nine screens ×
  1280/1024/768/480/360, a store booted from a stubbed `fetch`, zero
  claims).

## Proof

The Proof context observes Decision (ADR 0034): a screen is proven when
every claim about it holds at every width, with no browser and no eyes.

```ts
import { prove } from '@nisli/engine/test';

const proof = await prove(() => TransactionsScreen({}), { widths: [1280, 1024, 768, 480, 360], scheme: 'light' });
expect(proof.claims).toEqual([]);
```

A screen's data must be in: stub the server (`fetch`) with the shapes the
data layer reads, import the store and screens after the stub, `await` the
store's boot, and assert the fixture reached the DOM before trusting the
proof — an empty table never truncates a figure. A claim a screen makes
today is recorded by exact text and asserted still present, so a fix is
noticed; the proof itself is never loosened.

A **Claim** is `{ code, block, detail, severity, width? }`. The checkers
(`src/test/claims.ts`, each unit-tested on a positive and a negative
fixture) run over the mounted tree:

| code | claim |
|---|---|
| `FIT_ROW` / `FIT_COLUMNS` / `FIT_CELL` | every fit plan is satisfied (a `LayoutReport` still standing after the screen settled) |
| `OVERFLOW_TEXT` | no one-line text is wider than its box without an ellipsis (a text's box is its own pinned width, else its container's — sharing a row is the fit reports' job) |
| `FIGURE_TRUNCATED` | no figure (`tabular-nums` digits: money and date cells, a Stat's value, a meter) sits under an ellipsis narrower than it — a text may truncate, a number may not |
| `DECISION_UNSTABLE` | the same width and intent produce the same structural plan for any data — `prove()` diffs each decided block's dev `data-nisli-plan` stamp across a page advance and every `variants` factory (ADR 0044) |
| `UNSETTLED` | the screen reached a fixed point: turns run until a turn changes nothing (tree and reports alike), before and after `settle()`; still moving at `turns` (default 12) is not proven |
| `NAME_MISSING` | every button, link and input has an accessible name |
| `ID_DUPLICATE` | no id is on two elements |
| `LABEL_MISSING` | every input inside a form has a label |
| `DIALOG_ARIA` | every dialog is `aria-modal` and `aria-labelledby` an element with text |
| `MENU_ITEM_ROLE` | everything reachable inside a `[role=menu]` is a menu item |
| `BLOCK_ERROR` | no block failed (`data-nisli-error`) |
| `UNREACHABLE` | every interactive element is reachable — not `[inert]` unless a modal is open above it |

**The estimator is calibrated.** `src/test/estimate.ts` sizes text by
summing per-glyph advance widths measured in real Chromium for the default
skin's fonts at every text style the skin uses (14/400 body, 14/500
control, 12/400 small, 12/500 header, 16/600 title, 20/600 heading, 28/600
display, and 14/400 monospace for `text.code`), reading the `font-size`,
`font-weight`, `font-family`, `text-transform`, `letter-spacing` and
`font-variant-numeric` written inline: uppercase labels are summed as
uppercase plus their spacing, and under `tabular-nums` every digit takes
the measured tabular advance (a proportional `1` is 2.3px narrower). A
header cell in a table's measuring pass is as wide as its widest cell, as
the browser sizes the column. The table is `src/test/glyphs.ts`, generated
by `pnpm calibrate` (`scripts/calibrate-glyphs.mjs`, Playwright resolved
from `packages/www`); `glyphs.test.ts` holds every string the engine's own
tests put on screen — plain, tabular and as labels — to within 3% of the
browser's laid-out width. `textMeasurer(charWidth)` stays the deterministic
flat measurer for block tests where a plan is arithmetic.

**Runtime evidence.** In dev, an unsatisfied plan stamps the block's host
`data-nisli-report="CODE"` (cleared when the plan is satisfied again) and
lands in the `window.__nisli.reports` ring buffer — engine-internal
diagnostics like core's `data-nisli-error`, so a browser can be read
without a listener. `window.__nisli` (`{ reports, dev: true }`) is created
the moment the engine loads in dev, so its absence is itself evidence: the
build has none. `prove()` reads the stamp to keep only the reports still
standing once a screen has settled. Dev is the same probe core uses —
Vite/vitest `import.meta.env`, then `NODE_ENV`, then loud by default — so
the stamp and ring are free in production only under a build that defines
one of those (`vite build`, `NODE_ENV=production`); a bundle built with
neither keeps them.

**The browser half.** `@nisli/engine/verify` loads a running app in
Chromium (Playwright, an optional dev peer, loaded on demand) at every route
× width and checks: the evidence exists at all (`window.__nisli`, else
`NO_EVIDENCE` — a production build cannot pass by having nothing to say),
the screen finished loading (no `[role=status][aria-label="Loading"]` or
`[aria-busy]` within `timeout`, else `STILL_LOADING`), zero console/page
errors through the keyboard pass (minus `ignore`), zero
`[data-nisli-error]`, zero `[data-nisli-report]` (with the latest ring
entry's detail), no horizontal scroll, every visible control has an
accessible name, Tab from the body reaches a control, and while a dialog
is open Tab never leaves it — checked when a dialog is open at load, or
opened by `open: [{ route, selector }]` (a control clicked before the
snapshot). `verify({ baseUrl, routes, widths, ignore?, open? })` returns
`{ ok, findings, checked, table }`; the CLI:

```sh
nisli-verify --base http://localhost:5200 --routes / /transactions --widths 1280 360 --open '/transactions=[data-nisli-action=add]'
```

Exit 0 with no findings, 1 with findings, 2 on usage. Screenshots are for
looking; none of this is one.

## Overlays

Anything that floats is a *layer* on the document's one overlay stack
(`src/engine/overlay.ts`, pure data; `blocks/kernel.ts` is the only code that
touches the document for it). A block asks for one with `ctx.overlay({ kind,
open, … })` and gets back `{ z, placement }` — the only two things it renders.
There are three kinds:

| kind | who | dismiss | focus | background |
|---|---|---|---|---|
| `modal` | `Dialog`, `confirm()` | Escape, outside pointer | trapped over its visible controls; restored on close | inert; scroll locked |
| `popover` | the Toolbar overflow menu, the App bar-mode menu | Escape, outside pointer (a tap on the anchor is the anchor's own toggle) | moves into the menu; restored to its anchor | untouched |
| `passive` | `notify()` | never (transparent) | never focused | never inert |

**Keyboard model.** Escape reaches the *topmost non-passive* layer only, and
closes exactly that one — a notice over a dialog is never in the way, and a
menu open inside a dialog closes before the dialog does. Inside a modal, Tab
and Shift+Tab cycle over the controls a person can actually see (disabled,
`hidden`, `display: none`, `visibility: hidden` and zero-size controls are
skipped). A menu opens on the first item (ArrowDown / Enter / Space) or the
last (ArrowUp); ArrowUp/ArrowDown wrap, Home/End jump, Tab and Shift+Tab
leave the menu to the tabbable after or before its trigger. Focus returns to
the opener on close; if the opener is gone, to the nearest `main` landmark
(given `tabindex="-1"`), never to `<body>`.

**What the engine guarantees**, each a test in `src/blocks/overlay.test.ts`
or `src/engine/overlay.test.ts`, with no browser:

- Escape and an outside pointer go to the top non-passive layer, one at a time.
- A modal traps focus and restores it; a second modal opened beside the first
  (a DOM sibling) is never inert itself, and the inert set is recomputed from
  the stack on every open and close — everything beside the topmost trap's
  ancestor chain, except a subtree holding a notice.
- Scroll is locked while any modal is open, through one ref-counted body
  write shared with `lockScroll()`; closing the last modal releases it.
- Paint order is stack order: `metrics.layer` gives each kind its base
  (`sticky` < `bar` < `modal` < `popover` < `passive`) and the stack position
  its offset, so a notice is always above every modal and a menu above the
  dialog it opened from. No block spells a `zIndex`.
- An anchored layer is placed by `placeMenu()` inside the viewport, `ltr` or
  `rtl` from the anchor's computed direction, hidden until placed, and
  re-placed on resize and on any scroll.
- A pointer on a layer's *anchor* is inside that layer: a real tap on the
  trigger of an open menu (pointerdown, then click) closes it once and leaves
  focus on the trigger — it is never dismissed by the pointerdown and reopened
  by the click.

## Accessibility

What the engine guarantees for a keyboard or an assistive-technology user,
with no line in app code (ADR 0042). Each item is a test that drives the
keyboard or pointer path — never an "element exists" assertion — in
`src/blocks/{overlay,table,extras,form}.test.ts` and `src/test/claims.test.ts`.

- **Layers.** Anything that floats is on the one overlay stack, so it has
  Escape, outside-pointer dismiss, focus in and focus return. The App's
  bar-mode menu (every viewport under 792, so every phone) is a `popover`
  layer with the APG disclosure-navigation model: the toggle is
  `aria-expanded` + `aria-controls`; open focuses the first link (ArrowUp on
  the toggle: the last); arrows wrap, Home/End jump; Escape and an outside
  pointer close and return focus to the toggle; Tab leaves to the tabbable
  after the toggle; navigation closes without moving focus (the router owns
  it). The sheet never pushes content and never adds a second `<nav>`.
- **Sortable headers.** A `sortable` column's header holds a real `<button>`
  (no button look), so Tab reaches it and Enter/Space sort natively;
  `aria-sort` stays on the `<th>` and the sort mark is `aria-hidden`.
- **Selectable rows.** An `onSelect` row is a tab stop named by its primary
  `<td>` (`aria-labelledby`), so a reader hears what it is; Enter and Space
  select, Space without scrolling. A control rendered inside a cell keeps its
  own keys — the row only answers keys aimed at the row itself.
- **Live regions.** `notify()` keeps a polite `status` and an assertive
  `alert` container mounted before any notice arrives; `negative` goes to the
  alert, every other tone to the status (`LIVE_TONE` claims a notice in the
  wrong container, or in none). Each notice is a `group` named with a human
  word — Error, Success, Warning, Note — with a Dismiss `<button>` in the tab
  order; Escape on a focused notice dismisses it and never reaches a dialog
  below. Its timer is a resumable countdown, held while hovered or focused.
  A keyboard dismiss returns focus to where it came from (the control Tab
  left, or the dialog field that was focused); when that is gone, to the open
  dialog, else the `main` landmark — never to `<body>`.
- **Labels.** A field's `<label for>` targets only a labelable control. A
  segmented group is named through `aria-labelledby` and clicking its heading
  focuses the checked option; a boolean field has one string — its `label`
  — as the `<label for>` beside the box (clicking toggles), and that label
  alone is its name.
- **Focus ring and hover.** A focused row lights the same `table.row.hover`
  part as a hovered one; focus is the skin's `focus` part, never removed by
  a block. Focus is only ever moved by the overlay manager or by a block
  answering a key — never on render.
- **Primary actions.** A `primary` Toolbar action never leaves the row: below
  the minimum the plan reports `FIT_ROW` rather than hide the verb in a menu.

## Blocks

`App`, `Page`, `Toolbar`, `Section`, `Grid`, `Stat`, `Table`, `Form`,
`Dialog`, `Meter`, `Bars`, `Columns`, `Empty`, `Text`, `Link`; plus
`notify()` and `confirm()`.

- **App** — the shell: sidebar at ≥ 792, else a top bar whose menu is a
  `popover` layer (disclosure navigation: `aria-expanded`/`aria-controls`,
  arrows, Home/End, Escape, outside pointer, focus return to the toggle,
  closes on navigation); the active link is `aria-current="page"`.
- **Toolbar** — a title and typed actions; `fit()` decides the row at width
  (shrink → stack → overflow) and the overflowed actions become a `popover`
  layer: a `menu` of `menuitem`s, `menuWidth` from metrics, full arrow-key
  model, closes on Escape, outside pointer, a tap on its trigger, or
  selection. A `primary` action is never overflowed (`FIT_ROW` instead).
- **Table** — columns (`label`, `kind`, `priority`) drop, truncate and fold
  by `priority` and `kind`, and every column width is a *budget* — a pure
  function of `kind`, the header label and `metrics.layout` at the measured
  width (`columnBudgets`), never of the rows (ADR 0044): figure and date
  columns get `figureChars`/`dateChars` × `charWidth`, text columns get
  weighted shares floored at `minTextColumn` and by their own label, every
  `sortable` header reserves its sort mark whether or not it is sorted,
  leftover width goes back to the text columns (`spreadSlack`), and the
  table is always `table-layout: fixed` — no measuring pass, and a rows
  change causes zero solves. A `sortable` header is a real `<button>` inside
  the `<th>` (`aria-sort` on the `th`, `Sort { by, order }`); an `onOpen` row
  is a tab stop named by its primary cell, opened by Enter/Space, lit while
  focused as while hovered; `empty` (a string, or `EmptyProps`) renders the
  `Empty` block where the rows would be.
- **Bars** — items (`label`, `value`, `text`); the label column is a fixed
  budget (`labelChars` × `charWidth`, capped at a third of the block), never
  the longest item's label — a long label truncates inside it.
- **Columns** — grouped columns over an ordered axis; which axis positions
  carry a label (`every`) is a function of the width and the label *count*
  only (the `axisChars` budget) — one label is one slot, so the count is the
  chart's structure and the labels' text never decides.
- **Actions** — one type, `Action { id, label, priority?, destructive?,
  onSelect? }`, one renderer (`blocks/actions.ts`), one rule wherever it is
  placed (Toolbar, Page, Empty, Form, Dialog, confirm): `destructive` →
  danger; `priority: 'primary'` → the filled button; else plain; busy on a
  returned promise. Per action — the engine never counts primaries. Only the
  Toolbar overflows; every other row wraps.
- **Dialog** — a `modal` layer: `role="dialog"`, `aria-modal`,
  `aria-labelledby` its title; `dialogMode()` chooses sheet or centred at
  width; initial focus on its first visible control that is not Close;
  `actions` render after `children`, a destructive one first and apart.
- **Empty** — a `title` (the statement), a `hint`, and `actions` through the
  one renderer.
- **Text** — `role: 'body' | 'note' | 'code'`: `note` is WAI-ARIA's word for
  ancillary prose (the engine emits `role="note"` and the skin's muted look);
  a heading is a container's `title`, never a Text.
- **confirm({ title, text, action })** — a Dialog mounted at the body, so a
  modal layer above whatever is open; `action` is `Pick<Action, 'label' |
  'destructive'>` and the engine makes it the row's primary; resolves to the
  answer, one Escape answers `false`.
- **notify()** — two live regions, a polite `status` and an assertive
  `alert`, mounted before the first notice; `negative` is an alert, every
  other tone a status. A `passive` layer while it shows anything, above every
  modal. Each notice is a `group` (Error / Success / Warning / Note) with a
  Dismiss button in the tab order; Escape dismisses; the countdown (4 s,
  8 s for negative) pauses on hover and focus; a keyboard dismiss returns
  focus to where it came from, never to `<body>`.

- **Form** — a schema of fields (`name`, `label`, `kind: Kind`, `when`,
  dependent `options`, `readOnly`, `validate`, bounds, `group`, `long`);
  capture is derived, never said — `options` make a choice (segmented at ≤ 3,
  else a list), `long` a multi-line control, `kind: 'boolean'` a box with its
  `label` beside it, `kind: 'file'` a picker; the engine decides presence,
  columns at width, validation timing and announcement, and — when given
  `initial`/`key` instead of `value` — owns the draft, its dirtiness and its
  reset. `actions` sit beside Cancel and the submit (the row's primary).
  Every control is labelled: `<label for>` for a labelable control,
  `aria-labelledby` for a segmented group (its heading click focuses the
  checked option), and a boolean's one label is the `<label for>` that
  toggles it. Domain in `src/blocks/form/`.

## Status

Blocks are added only after the previous ones have been used in an app. See `docs/research/nextgen/AUDIT-2026-08-27.md` for why breadth-first
was the mistake this package exists to not repeat.
