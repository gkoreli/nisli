# Changelog

All notable changes to `@nisli/engine`. Format: keep-a-changelog-lite — one
section per version, human-readable highlights. Unreleased until the first
publish.

## 0.10.1 — 2026-09-01

- Table action columns can declare `kind: 'action'`: the engine gives them a
  rigid control/header budget, centres them, and excludes them from text slack.
  Only the first primary text column is the lead expanding column, so
  `priority` remains survival order for later primary columns. All table cells
  now align vertically in the middle.

## 0.10.0 — 2026-08-31

- **Density and input axes (ADR 0046; issue 0029).** The last capability the
  north star measured: one intent, sized by context the engine detects.
  - `engine/axes.ts` owns `scheme`, `density` and `input` as one signal.
    `scheme` moves there unchanged; `input` follows `(pointer: coarse)`
    live; `density` is a preference (`'system'` is `comfortable`). Setters:
    `setScheme`, `setDensity`, `setInput`; `useSkin(skin, { scheme, density,
    input })`. A skin function receives all three (`SkinAxes` = `Axes`).
  - `metrics` is a **live door**: the same object, its groups getters over
    `metricsFor({ density, input })` (pure, exported). Comfortable + pointer
    is the 0.9.0 constant number for number, plus `control.hit`. Compact:
    `space` 4 6 8 12 16 24, `control.height` 28, `padX` 8. Touch:
    `control.height` at least 44, `check` 24, `hit` 44. `layout`, `layer`
    and `charWidth` never move (F9: floors are explicit; an axis moves
    rhythm, never a floor). `Metrics` widens to numbers; `Layout`/`LayoutKey`
    live in `metrics.ts`.
  - Every block follows the door: every `ctx.part` structure is a thunk
    (kernel scan rule 5), the chart budgets and form gap are read live, and
    every `fitRow` re-solves on a sizing change (`FitSpec.gap` may be a
    thunk). A scheme flip re-decides nothing structural.
  - Hit floors: `height: hit` on table rows and header cells, `minHeight:
    hit` on nav links and menu items, `height` + `minWidth: hit` on the
    notice dismiss (it was 24 × 23). Row hover listens to `pointerenter`/
    `pointerleave`.
  - Proof: `mount({ density, input })`; `prove({ axes })` runs widths ×
    contexts and tags every claim with its axes; `TARGET_SMALL` (touch: any
    interactive target under `hit` on either side, inline text exempt; a
    zero `min-width` is not a width, a growing flex item is its share, a
    sort button is judged by its pinned `th`, a check by its row);
    `AXIS_STALE` (a live axis flip must equal a fresh mount, element for
    element, checked before the page advance); `axisStale()` standalone.
  - At the default, in inline styles only: every `th` and `tr` carries
    `height: 24px`, every button `min-width: 24px` (WCAG 2.5.8's floor by
    construction), the nav link is a flex row with `min-height: 24px`, the
    boolean field's label is the row; the sort click lives on the `th`.
    Nothing moves a pixel in Chromium.
  - **Proof semantics:** a screen with a standing report now settles —
    movement is a *new* report, never the same one re-filed on the next
    solve (every turn re-measures). `estimateText` honours `min-width`.
  - **`layout.minColumn` is gone; the grid floor is derived.** Under
    compact the axis exposed that the declared 220 did not cover a card's
    padding plus the narrowest two-primary table (238.4 px at the
    default) — two floors that had to agree by hand. `cellFloor()`
    (`engine/space.ts`, exported) is now the narrowest cell a Grid decides:
    a card around one figure column beside one primary text column at
    `minTextColumn`, from the same metrics the table uses — 238.4 at the
    default, 222.4 at compact. A floor that must be consistent with
    another floor is derived, never declared. Grid decisions move only
    where a cell would have been too narrow for that table.

## 0.9.0 — 2026-08-30

- **Deterministic decisions (ADR 0044; issue 0028; ledger TENETS §13).** A
  layout decision is a function of viewport width and declared intent, never
  of which data is currently shown; data truncates, folds or wraps inside
  the decided structure and never reshapes it — sorting Ledger's
  Transactions by Amount can no longer widen Payee and fold two columns.
  - Table column widths are budgets, pure functions of `kind`, the header
    label and `metrics.layout` (`columnBudgets`, `spreadSlack`,
    `textWeights` in `engine/space.ts`): `figureChars` (12) / `dateChars`
    (8) × `charWidth` for figure and date columns, weighted shares floored
    at `minTextColumn` for text columns, the sort mark reserved on every
    `sortable` column whether or not it is sorted (`columnBudgets` takes no
    sort input), leftover width spread back over the surviving text columns.
  - The table is always `table-layout: fixed`: the measuring pass — the
    `max-content` flip, two `flush()`es, the `thead th` measurement over the
    visible page — is gone (`measures: false` on Table's `fitRow`), and a
    rows change causes zero solves (`deps` no longer reads `rows`).
  - Bars' label column (`labelChars` 20) and Columns' axis skipping
    (`axisChars` 8) are char budgets too, never the longest label; labels
    truncate inside them.
  - In dev every decided block stamps its structural plan on its host as
    `data-nisli-plan` (`PLAN_ATTR`); `prove()` advances every table's page
    once and mounts each `ProveOptions.variants` factory (same intent over
    perturbed data), diffs the stamps, and files the new
    `DECISION_UNSTABLE` claim (error) naming the block and both plans.
  - A figure wider than its budget truncates and files `FIGURE_TRUNCATED` —
    the fix is a shorter format or one metric raised once, never a wider
    column.

## 0.8.0 — 2026-08-30

- **The intent vocabulary contract (ADR 0043; issue 0027, 0023).** One
  word, one meaning, across the whole surface; no look words in intent;
  every `Action` honoured identically. A clean break — no aliases, no
  deprecations; the compiler rejects the old words. Every rename:

  | old | new | where |
  |---|---|---|
  | `Field.key` | `name` | `form/schema.ts` |
  | `Field.kind: FieldKind` (`'select'`, `'textarea'`, `'checkbox'`) | `kind?: Kind` (`'text'` default, `'number'`, `'money'`, `'date'`, `'boolean'`, `'file'`); capture derived from `options`, `long`, the kind | `form/schema.ts`, `form.ts` |
  | `FieldKind` | removed; `Kind`, `DatumField`, `BooleanField`, `FileField` exported | `types.ts`, `index.ts` |
  | `Field.placeholder` as a checkbox caption | a `boolean` field's one string is its `label`, the `<label for>` beside the box; `placeholder` is a type error on `boolean` and `file` | `form.ts` |
  | `Column.header` | `label` | `table.ts` |
  | `Column.kind` (own union) | `Extract<Kind, 'text' \| 'number' \| 'money' \| 'date'>` | `table.ts` |
  | `TableProps.key` | `rowKey` | `table.ts` |
  | `TableProps.onSelect` | `onOpen` | `table.ts` |
  | `Sort.dir` | `order` | `table.ts` |
  | `TableProps.empty: string` (a muted line) | `string \| EmptyProps`, rendered as the `Empty` block | `table.ts` |
  | `Series.name` | `label` | `columns.ts` |
  | `ColumnsProps.text` | `format` | `columns.ts` |
  | `MeterProps.detail` | `text` | `meter.ts` |
  | `AppProps.content: Content` | `children: Children` | `app.ts` |
  | `TextProps.role: 'muted'` | `'note'` (WAI-ARIA note; the engine emits `role="note"`, and `role="code"` for `'code'`) | `text.ts` |
  | `TextProps.role: 'heading'` | removed — a heading is a container's `title` | `text.ts` |
  | `EmptyProps.action: Action` | `actions: readonly Action[]` | `empty.ts` |
  | `FormProps.destructive: Action` | `actions: readonly Action[]` (a destructive one first and apart; the submit is the row's primary) | `form.ts` |
  | `confirm({ title, message, confirmLabel?, destructive? })` | `confirm({ title, text, action: Pick<Action, 'label' \| 'destructive'> })`; the answer is the row's primary | `confirm.ts` |
  | — | `DialogProps.actions?: readonly Action[]`, after `children` (resolves issue 0023) | `dialog.ts` |
  | `StatProps.delta: { text; tone }` | `Delta { text; tone? }`, exported; `Priority` exported | `stat.ts`, `types.ts` |

- One renderer for every action: `blocks/actions.ts` (`actionButton`,
  `menuItem`, `actionRow`, `variantOf`) draws Toolbar, Empty, Form (its
  Cancel and submit included), Dialog and confirm with one rule per action —
  `destructive` → `button.danger`; `priority: 'primary'` → `button.primary`;
  else `button.plain`; busy under the action's id. Empty no longer assumes
  its action is primary; Form no longer assumes its extra action is danger.
  `kernel.test.ts` scans for it: `button.danger` nowhere else, `button.primary`
  only there and on Form's chosen segmented option.
- `index.ts` is split: the intent vocabulary first, then the skin, then the
  Decision and block-author words (`LayerKind` stays, under that heading).
- 0042 §(d) is superseded: a boolean field has one `<label for>`; the
  accessible name is the label alone (`LABEL_MISSING` unchanged).
- Tests: `blocks/actions.test.ts` (the contract as behaviour, and the old
  words as `@ts-expect-error`s); every suite renamed to the new words.

## 0.7.0 — 2026-08-30

- Skin contrast is a contract (ADR 0035 appearance layer, panel 2026-08-30):
  `skin/contrast.ts` names every (ink, ground) pair the blocks render — text
  roles on every plane, hovered table rows, toned cells, links, headers and
  axes wherever a data block sits, read-only segmented options, buttons,
  notices, inputs, meter and chart fills — and `measure()` proves the default
  skin meets WCAG 2.x in both schemes (`skin.test.ts`). Exported: `PAIRS`,
  `measure`, `contrastRatio`, `luminance`, `parseColor`.
- Default skin, light: `textFaint` #8a8a8a → #707070, `warning` #b7791f →
  #9a6410, `hover` #f2f2f2 → #f5f5f5 (toned/faint text on a hovered row read
  4.42–4.49), new `inputBorder` #8c8c8c; dark: `textFaint` #7c7f88 → #8f929b,
  new `inputBorder` #6f727c, tinted notices take a dark per-tone ink instead
  of white. `text.heading` (20px/600) is measured as large text (3:1).

## 0.6.0 — 2026-08-30

- Table: a row's Enter is `preventDefault`ed so the keystroke that opens the
  edit dialog cannot also submit it (found by the real-keyboard proof: the
  keypress landed on the dialog's first input and saved the transaction).

- **Reachability (ADR 0042).** Every decision the engine draws is reachable
  by keyboard and AT, with no line changing in an app:
  - `App`: the bar-mode menu is a `popover` layer through `ctx.overlay`
    (disclosure navigation: `aria-expanded`/`aria-controls`, first/last-link
    focus, arrows with wrap, Home/End, Escape and outside pointer with focus
    return to the toggle, Tab leaves past the toggle, navigation closes
    without moving focus). The sticky sheet and its second `<nav>` are gone.
    Focus is not returned to the toggle when the sidebar has replaced it.
  - Overlay manager: a pointer on a layer's anchor counts as inside, so a
    real tap on an open menu's trigger (pointerdown, then click) closes it
    once instead of dismissing and reopening — fixed once for the Toolbar
    menu and the App menu.
  - `Table`: a `sortable` header is a real `<button>` in the `<th>`
    (Enter/Space sort; `aria-sort` on the `th`; sort mark `aria-hidden`);
    an `onSelect` row is named by its primary `<td>` via `aria-labelledby`,
    Enter and Space select (Space without scrolling), and a control inside a
    cell keeps its own keys (the row handles only keys aimed at itself); a
    focused row lights as a hovered one.
  - `notify()`: a polite `status` and an assertive `alert` container both
    mounted before the first notice; `negative` → alert. Each notice is a
    `group` named Error / Success / Warning / Note (human words; the
    `data-nisli-tone` stamp remains the checker's evidence), with a Dismiss
    `<button>` in the tab order, Escape dismiss (never reaching a dialog
    below), a resumable countdown held on hover/focus, and focus return on
    a keyboard dismiss to where focus came from (else the open dialog, else
    `main`) — never `<body>`.
  - `Form`: `<label for>` only targets a labelable control; a segmented
    group is named by `aria-labelledby` and its heading click focuses the
    checked option; a checkbox's caption is its `<label for>`.
  - `Toolbar`: a `primary` action is never overflowed (`FIT_ROW` instead);
    `fit()` snaps float noise so an exact fit is a fit.
  - Claims: `SORT_UNREACHABLE`, `POPUP_ARIA`, `LIVE_TONE` (a negative
    notice not in an assertive container, or any notice in none).
  - Ledger-visible, with no edit there: at phone widths a selectable row's
    name is its primary cell *including folded values* ("Aug 1 REI ·
    Groceries…" at 360, "Aug 1" at 1280); a checkbox field's heading is a
    `<span>`, so only the caption toggles the box.

## 0.5.0 — 2026-08-30

- **Proof context re-founded** (issue 0024 un-parked at the engine level).
  `prove(make, { widths, viewport?, scheme? })` is rebuilt over `mount()`
  and returns `{ claims, reports, byWidth }`; it runs the claim checkers
  at every width, flushes, turns (each ending in a `remeasure()` — the
  ResizeObserver pass), `settle()`s, and keeps only the layout reports
  still standing. `test/claims.ts`: `Claim { code, block, detail, severity,
  width? }`, checkers `OVERFLOW_TEXT`, `NAME_MISSING`, `ID_DUPLICATE`,
  `LABEL_MISSING`, `DIALOG_ARIA`, `MENU_ITEM_ROLE`, `BLOCK_ERROR`,
  `UNREACHABLE` plus the fit reports, each with a positive and negative
  fixture test. `mount()` gains `measure` (fallback measurer) and `frame`.
- **Estimator calibrated to Chromium.** `scripts/calibrate-glyphs.mjs`
  (`pnpm calibrate`) measures per-glyph advances and laid-out string widths
  for the default skin's font stack at six text styles and writes
  `test/glyphs.ts`; `estimate.ts` sums advances at the inline
  `font-size`/`font-weight` the skin wrote (`textWidth`, `textStyleOf`,
  `tableFor`); `glyphs.test.ts` holds 44 strings × 6 styles within 3%.
- **Runtime evidence.** `reportIf(plan, report, host?)`: in dev the host
  is stamped `data-nisli-report="CODE"` while unsatisfied and cleared when
  satisfied; `report()` feeds a `window.__nisli.reports` ring buffer
  (`RING` 200); listeners receive `(report, host)`. `engine/dev.ts` is the
  dev probe (core does not export `isDev`).
- **Browser runner.** `@nisli/engine/verify` — `verify({ baseUrl, routes,
  widths, ignore?, height?, timeout?, settle? })` → `{ ok, findings,
  checked, table }` over Playwright (optional peer, dynamic import); CLI
  `bin/nisli-verify.mjs` (`nisli-verify --base … --routes … --widths …`).
- **A passing proof means what it claims.** `prove()` turns to a fixed
  point — a turn that changes neither the tree nor the reports ends the
  loop, before and after `settle()` — and claims `UNSETTLED` when the cap
  (`turns`, default 12) is hit; `ProofAtWidth.turns` says how many it
  took. `FIGURE_TRUNCATED`: a `tabular-nums` figure under an ellipsis
  narrower than it (a table's money/date cell, a Stat's value) is a claim,
  where a text truncating is a decision; a one-line `div` (`nowrap`) is
  inspected as text. The estimator reads `font-family` (monospace →
  calibrated `code` table), `text-transform`, `letter-spacing` and
  `font-variant-numeric` up the inline chain; a measuring table's header
  is as wide as its widest cell (`columnWidth`), and a cell's own line
  excludes folded values (`ownText`). `glyphs.ts` gains `display` and
  `code` styles, `tabularDigit`, and tabular/label string sets held to 3%.
- **`verify` cannot pass vacuously.** `window.__nisli = { reports, dev:
  true }` exists from engine load in dev; a page without it is
  `NO_EVIDENCE`. The runner waits for every loading state to clear
  (`STILL_LOADING` otherwise), files console/page errors raised during
  the keyboard pass too, reads the latest ring entry per stamped block,
  and takes `open: [{ route, selector }]` (CLI `--open route=selector`)
  to click a dialog open before the snapshot; the dialog claim is
  documented as "open at load or by `open`". The CLI prefers the source
  in a checkout over a stale `dist/`.
- **Issue 0024 un-parked at the app level.** Every Ledger screen is proven
  in `packages/ledger/src/screens/screens.proof.test.ts` — nine screens ×
  1280/1024/768/480/360 over a store booted from a stubbed `fetch`, with a
  `KNOWN` findings map that is empty; `nisli-verify` over eight live routes
  × three widths reports no findings. The `nisli-engine` skill's `prove-`
  rules now describe `prove()`, claims, the calibrated estimator, `verify()`
  and the CLI (`prove-claims-are-failures`, `prove-real-content`,
  `prove-verify-routes` added).
- **Table:** values folded under a cell are never tabular figures
  (`font-variant-numeric: normal`), whatever cell they sit under — found
  by `FIGURE_TRUNCATED` on the Ledger's settings backups at 360.
- **Form ids are per instance** (`f<n>-<key>`, the `<form>` carries
  `f<n>`): two forms sharing field keys on one page (a quick-add beside an
  edit dialog) no longer collide — found by the `ID_DUPLICATE` claim on the
  first screen `prove()` ran. Tests query by the form's own prefix.

## 0.4.0 — 2026-08-29

- **Overlay stack.** `engine/overlay.ts` (pure): `Layer` of kind `modal` |
  `popover` | `passive`, `push`/`pop`/`top`, `reach()` (the topmost
  non-passive layer), `escapeTarget`, `pointerTarget`, `locks`, `zIndexOf`
  over `metrics.layer` (`sticky`/`bar`/`modal`/`popover`/`passive` — paint
  order is stack order; App and Page take their z from it), and `placeMenu()`
  with `PlaceOptions.dir` for RTL. The kernel owns the only document
  listeners: `ctx.overlay(spec)` → `{ z, placement }`.
- **Kernel guarantees.** Inert set recomputed from the stack on every
  open/close (a sibling modal is never inert; a notice's subtree never is);
  ref-counted scroll lock shared by `lockScroll()` and the manager;
  `focusables()` skips disabled, `[inert]`, hidden and zero-size controls;
  a pointer on any layer above the reached one counts as inside; anchored
  layers re-place on resize and scroll and are `visibility: hidden` until
  placed (first size from `metrics.layout.menuWidth`); `restoreFocus` falls
  back to the `main` landmark when the opener is gone.
- **Blocks.** Dialog: initial focus via `focusables`, `aria-label` dropped
  (`aria-labelledby` only). Toolbar menu: ArrowUp opens on the last item,
  Tab/Shift+Tab leave to the tabbable after/before the trigger,
  `menuItemBox()` gets a `minHeight`. `notify()` is a passive layer;
  `confirm()` is a modal layer through Dialog. `kernel.test.ts` scan gains
  rules 6 (no `document.addEventListener` in a block) and 7 (no `zIndex:`
  literal). `mount()` no longer writes `<body>`.
- **Removed.** `Overlay.layer`/`Overlay.isTop`, `layerDefaults`, the `Rect`
  export, and `isTop()` from `engine/overlay.ts` (only its test used it).

## 0.3.0 — 2026-08-29

- **Block kernel.** `block(tag, spec)` (`blocks/kernel.ts`): a block is a
  composition of behaviours — `measure`, `surface`, `status` shape, a reactive
  structural `host` style (replacing its previous run) with `hostParts`, and
  `render(props, ctx)`. `Ctx` is the one way a block styles anything:
  `ctx.part(parts, structure)`; plus `props`, `metrics`, `width`, `nested`,
  `busy`, `fitRow` (useFit + `reportIf`), the status slots `failure`,
  `updating`, `waiting()`, the `pending` flag, and `bone()`/`skeleton()`
  for a block's own waiting shape. The engine-drawn status (skeleton,
  failure line, "Updating…") is drawn by the kernel through `ctx.part()`;
  `blocks/status.ts` holds only `Status`/`viewOf` and `createBusy`.
  `kernel.test.ts` proves each behaviour on a throwaway block and scans every
  file under `blocks/` for a hand-written style (no `css`/`look`/`apply`
  import, no `element.style`, no string `style:`, no module `metrics`, no
  second `display: contents` root) — every block must be on the kernel.
- **Space domain.** `engine/space.ts` gathers every width decision as pure
  data: `fit`, `columnsFor`, `shellMode`, `dialogMode`, `labelColumn`,
  `labelEvery`, `labelWidth`, `pageSize` (`metrics.layout.tablePage`,
  `minLabel`). `reportIf(plan, …)` is the one way a block files a report.
- **Test kernel.** `mount(tag | factory, props, { width, viewport, scheme, text })`
  → `{ el, styleOf(selector), resize(width, viewport), unmount }` and
  `textMeasurer(charWidth)` from `@nisli/engine/test`; `remeasure()` in
  `engine/measure.ts` is the seam `resize()` pulls (every observed element
  re-measures, as a `ResizeObserver` would tell it).
- **Every block migrated onto the kernel.** Section and Toolbar first, then
  App, Page, Grid, Stat, Table, Form, Dialog, Meter, Bars, Columns, Empty,
  Text/Link, notify, confirm. Public props, DOM shape, roles and ARIA are
  unchanged; the Ledger app needed no edit. Per block: App's shell mode from
  `shellMode()`, sidebar as the new `nav.side` part; Page's status via the
  slots; Grid's column count decided in `host` over `ctx.props`; Stat's
  one-bone skeleton via `ctx.skeleton`; Table's columns via `ctx.fitRow`,
  paging via `pageSize`, row hover via a `table.row.hover` parts thunk,
  its own skeleton rows behind `ctx.pending`; Form's inputs via
  `inputBox()` + `['input', 'input.invalid', 'input.readonly']` thunks,
  checkbox side from `metrics.control.check`.
- **Removed.** `buttonStyle`, `inputStyle`, `cardStyle`, `ButtonVariant`
  (`style.ts`) and `bone`, `skeleton`, `blockSkeleton`, `failure`,
  `updating` (`blocks/status.ts`) — the look-baked helpers the kernel made
  redundant. `style.ts` no longer imports the skin. Added structural
  `inputBox()`.
- **LOC.** `src/blocks/*.ts` (non-test), before → after this round:

  | file | before | after |
  |---|---:|---:|
  | app.ts | 125 | 117 |
  | bars.ts | 38 | 39 |
  | columns.ts | 63 | 76 |
  | confirm.ts | 44 | 62 |
  | dialog.ts | 78 | 80 |
  | empty.ts | 28 | 32 |
  | form.ts | 358 | 370 |
  | grid.ts | 28 | 31 |
  | kernel.ts | — | 224 |
  | meter.ts | 35 | 45 |
  | notice.ts | 55 | 66 |
  | page.ts | 42 | 48 |
  | section.ts | 34 | 28 |
  | stat.ts | 36 | 33 |
  | status.ts | 82 | 57 |
  | surface.ts | 11 | 11 |
  | table.ts | 215 | 224 |
  | text.ts | 34 | 33 |
  | toolbar.ts | 148 | 127 |
  | types.ts | 22 | 22 |
  | **total** | **1476** | **1725** |

  Plus `style.ts` 71 → 78 and, new: `engine/space.ts` 68, `engine/paging.ts`
  14, `test/mount.ts` 104. Net +249 over the blocks: the kernel is 224 of it
  and holds everything the blocks used to repeat; every visual path now runs
  through one function.

## 0.2.0 — 2026-08-29

- **Form domain.** `Form` is rebuilt as a small domain — `blocks/form/schema.ts`
  (intent: `Field`, `Option`, `FieldKind`; pure `visibleFields`, `optionsOf`,
  `validateField`) and `blocks/form/draft.ts` (`createDraft`: dirty, touched,
  errors over signals, no DOM) under the rendering block. New intent on
  `Field`: `when` (presence), dependent `options(draft)`, `readOnly`,
  `validate`, `min`/`max`/`step`, `group`, `long`. New engine rules, each a
  test: a hidden field leaves the submitted object and its errors; a choice no
  longer offered is cleared; validation runs on blur and submit, never on a
  first keystroke, with `aria-invalid`/`aria-describedby` and a
  `role="alert"` "N fields need attention." summary; 2–3 options render as a
  segmented `radiogroup`, 4+ as a native select; groups become a `fieldset`
  with a legend spanning the row; bounds reach the native control (money
  steps 0.01). Draft ownership: controlled (`value`, as before) or owned by
  the engine (`initial` + `key`; a new key resets, a file input remounts,
  cancelling a dirty draft asks "Discard changes?" first, a successful submit
  clears dirty). `FormHandle` (`reset`/`submit`) via `ref`. Skin part
  `input.readonly`. DOM shape: a field is a `div` (label, control, note),
  not a wrapping `label`. Closes issue 0022.

## 0.1.0 — 2026-08-29

In order of landing, 2026-08-27 → 2026-08-29:

- **Engine, `fit()`, `Toolbar`.** A pure width solver (`fit()`: items give
  ground from lowest priority up) and the first typed block. Proven at five
  widths with a measurer seam instead of a browser.
- **Blocks.** `App`, `Page`, `Section`, `Grid`, `Stat`, `Table`, `Form`,
  `Dialog`, `Meter`, `Bars`, `Empty`, `Text`, `Link`, then `Columns`,
  `notify()`, `confirm()`. Engine rules found by building an app: a surface
  inside a surface draws no second card; a table pins its columns and never
  re-widens them; children are reactive.
- **Skin split — the engine is visual-less.** `theme.ts` → structural
  `metrics.ts` plus an optional `Skin` of named parts installed once with
  `useSkin()`; `skin.test.ts` proves that with no skin no block emits a colour,
  font, border, radius or shadow.
- **Status — the engine owns waiting.** `status` on `Page`, `Section`,
  `Table`, `Stat` (a core `QueryResult`/`ResourceResult` passed straight in):
  skeleton, error with Retry, "Updating…". Actions and form submits that
  return a promise go busy on their own; rejections become notices.
- **Layout reports.** Blocks report an unsatisfiable plan (`FIT_ROW`,
  `FIT_COLUMNS`, `FIT_CELL`); `@nisli/engine/test` `prove()` collects them at
  any set of widths with an estimating measurer.
- **fit vocabulary: shrink → stack → overflow; `useFit()`.** An item may fold
  into another (`stackInto`) instead of leaving; a table folds dropped columns
  under the primary cell so nothing is lost on a phone. `useFit()` is the one
  reactive measure→decide→apply loop for every fit-driven block.
- **Context axes and scheme.** A `Skin` may be a function of `SkinAxes`
  (`{ scheme }`); the engine resolves `'system'` from `prefers-color-scheme`
  live, exposes `scheme`/`setScheme()`, and sets `color-scheme` on the
  document. The default skin gains a dark palette. Completeness contract:
  every part a block asks for exists in both schemes, the default skin defines
  exactly `PARTS`, and a skin never contains layout.
