# Changelog

All notable changes to `@nisli/engine`. Format: keep-a-changelog-lite — one
section per version, human-readable highlights. Unreleased until the first
publish.

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
