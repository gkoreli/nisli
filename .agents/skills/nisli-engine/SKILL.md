---
name: nisli-engine
description: Typed-block authoring guidelines for code that uses `@nisli/engine`. This skill should be used when writing, reviewing, or refactoring screens built from engine blocks (App, Page, Toolbar, Section, Grid, Stat, Table, Form, Dialog, Meter, Bars, Columns, Empty, Text, Link, notify, confirm), Form schemas, skins, or width proofs — and whenever app code is tempted to make a visual decision.
license: MIT
metadata:
  author: nisli-team
  version: "2.1.0"
---

# Nisli Engine — Agent Skill

Guide for building application UI from `@nisli/engine`: app code says **what** things are, the engine decides how they are laid out and what fits at every width, and a skin — installed once — says what the parts look like. There is no CSS file, no `className`, no `style` prop, no `data-*` attribute in the public surface; the types do not offer them. Rules across 8 categories, each traceable to `packages/engine/src/index.ts`, the block prop types, `docs/adr/0034`, `0035`, `0037`, `0043` (the vocabulary contract: one word, one meaning), `0044` (deterministic decisions: a decision is a function of width and intent, never data), and the Ledger app (`packages/ledger`).

## When to Apply

Reference these guidelines when:
- Composing a screen from engine blocks (`Page`, `Section`, `Grid`, `Table`, …)
- Writing a `Form` schema (`Field<T>`: `when`, `options`, `validate`, `group`, `long`)
- Passing async results (`query()` / `resource()`) to blocks as `status`
- Installing or writing a `Skin`, or forwarding a light/dark/system preference
- Choosing `priority` / `kind` / `tone` / `destructive` so the engine degrades correctly
- Proving a block or screen at width with `@nisli/engine/test`, or a running app's routes with `@nisli/engine/verify` / `nisli-verify`
- Reviewing app code for smuggled appearance (pixels, colours, breakpoints, per-instance flags)
- Deciding where a new need belongs: engine rule, skin part, or semantic word

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | The Intent Contract | CRITICAL | `intent-` |
| 2 | Blocks | CRITICAL | `block-` |
| 3 | Form Schema | HIGH | `form-` |
| 4 | Status & Busy | HIGH | `status-` |
| 5 | Skin & Scheme | MEDIUM-HIGH | `skin-` |
| 6 | Decisions & Levers | MEDIUM-HIGH | `decide-` |
| 7 | Proof at Width | MEDIUM | `prove-` |
| 8 | Dogfooding (Ledger) | MEDIUM | `dogfood-` |

## Quick Reference

### 1. The Intent Contract (CRITICAL)

- `intent-say-what-not-how` - Props state what a thing IS (`priority`, `kind`, `tone`, `role`, `destructive`, `required`) and what contains what; never how it looks, how it is captured, or where it sits
- `intent-one-word-one-meaning` - ADR 0043: a term means one thing on every block it applies to and appears on no other — `label` is the name of an item, `title` the heading of a block, `text` a string the app wrote, `hint` secondary text of an item, `id` identity among siblings, `key` identity across renders (`rowKey` per row), `name` the property a field edits, `kind` what a value is (`Kind`), `priority` survival order (`Priority`), `onSelect` an activated Action, `onOpen` an opened row, `order` a sort order. A subset of a type is allowed; a synonym is not (no `header`, `detail`, `message`, `content`, `confirmLabel`)
- `intent-no-appearance-vocabulary` - No `className`, `style`, `data-*`, pixels, rem, colours, fonts, breakpoints, `sticky`, `flex-end` in app code — and no widget or Part words either: no `kind: 'select'`/`'textarea'`/`'checkbox'`, no `role: 'muted'`/`'heading'` — the types reject them (`toolbar.test.ts`, `actions.test.ts` prove they are compile errors)
- `intent-new-need-home` - A new need goes, in order: an engine rule derived from structure, a skin part, a new semantic word on a block. NEVER a per-instance appearance prop (`Section({ flat: true })`)
- `intent-app-imports-blocks-only` - App code imports blocks, `useSkin`/`setScheme`/`defaultSkin`, `notify`, `confirm`; it never uses `metrics`, `look`, `fit` or the kernel for its own layout
- `intent-structure-is-the-decision` - Nesting IS intent: a `Stat` inside a `Section` is a nested surface and draws no second card — the engine knows the tree, the author does not say "flat"

### 2. Blocks (CRITICAL)

- `block-app` - `App({ brand, nav, location, children })` — sidebar or top bar + menu is the engine's call from width; the bar menu is a popover layer (Escape, outside tap, arrows, focus return); pass `location` as a computed of the router
- `block-page` - `Page({ title, actions?, children, status? })` — a pinned toolbar over a centred content column; `status` refreshing appends "· Updating…" to the title
- `block-toolbar` - `Toolbar({ title, actions? })` — actions overflow tertiary → secondary, then the title truncates; a primary never leaves (`FIT_ROW` instead); the More menu is a popover its trigger toggles
- `block-section` - `Section({ title?, children, status? })` — a titled surface; nested inside another surface it draws no card
- `block-grid` - `Grid({ children })` — equal-weight cells; the engine picks the column count (`minColumn` 220)
- `block-stat` - `Stat({ label, value, delta?: Delta { text, tone? }, hint?, status? })` — the tone says whether the change is good news; annotate a computed delta with the exported `Delta`, never `as const`
- `block-table` - `Table<T>({ columns, rows, rowKey, onOpen?, sort?, onSort?, empty?, status? })` — `Column { id, label, cell, kind?, priority?, sortable? }`, `Sort { by, order }`; sortable headers are real buttons, openable rows are named tab stops (Enter/Space); `empty` is a string or `EmptyProps` and renders the `Empty` block; 60 rows then "Show N more"
- `block-form` - `Form<T>({ fields, value | initial+key, onChange?, onSubmit, submitLabel?, onCancel?, actions?, mode?, ref? })` — `actions` sit beside Cancel and the submit (the row's primary; a destructive one first and apart); every control labelled (label/for, aria-labelledby for a segmented group, a boolean's one label beside its box); see `form-*`
- `block-dialog` - `Dialog({ title, open, onClose, children, actions? })` — a centred card, or a full-height sheet below 640; `actions` render after `children` and wrap (never a fieldless Form); scroll lock, Escape, focus restore are the engine's
- `block-meter` - `Meter({ label, value, max, text? })` — tone by ratio: > 1 negative, > 0.85 warning
- `block-bars` - `Bars({ items: { label, value, text }[] })` — the label column takes up to a third of the block
- `block-columns` - `Columns({ labels, series: { label, tone?, values }[], format })` — grouped columns; axis labels thin until they fit
- `block-empty` - `Empty({ title, hint?, actions? })` — the statement, what to do about it, and the actions (the same rule as every row: mark one `priority: 'primary'` to fill it)
- `block-text` - `Text({ text, role?: 'body'|'note'|'code', tone? })` — `note` is WAI-ARIA's word for a free-standing ancillary paragraph (the engine emits `role="note"`); a heading is a container's `title`; the skin decides how a role reads
- `block-link` - `Link({ href, label })` — a navigation link; the skin's `link` part dresses it
- `block-notify` - `notify(text, tone?)` — a timed live-region notice: `negative` is an assertive alert, the rest polite status; a Dismiss button, Escape, timers held on hover/focus, focus returned on dismiss
- `block-confirm` - `confirm({ title, text, action: { label, destructive? } }): Promise<boolean>` — ask before an action that cannot be undone; the answer is the row's primary (filled, or danger)

### 3. Form Schema (HIGH) — ADR 0037

- `form-when-presence` - Presence is `when: (draft) => boolean`, never hint prose; an absent field is not rendered, not validated, not submitted
- `form-options-draft` - Dependent choices are `options: (draft) => Option[]`; a value no longer offered is cleared by the engine
- `form-validate-reason` - `validate: (value, draft) => string | undefined` returns the REASON; `required`/bounds/choice-membership run first, the engine decides timing (blur, then submit) and announcement
- `form-owned-initial-key` - Dialog forms are owned: `initial` + `key`; a new key resets the draft (file inputs included); one key per opening
- `form-controlled-value` - Shared state is controlled: `value` (a writable signal is edited in place) — presence of the `value` key selects the mode; never both
- `form-live-mode` - Filters and settings-as-you-type are `mode: 'live'`: no buttons, `onChange` per change, validation still on blur
- `form-group` - Fields sharing a `group` string become one titled fieldset at the position of the first
- `form-capture-derived` - `Field { name, label, kind?: Kind, … }`: `kind` says what the value is (`'text'` default, `'number'`, `'money'`, `'date'`, `'boolean'`, `'file'`), never how it is captured — `options` make a choice (segmented ≤ 3, else a list), `long` a multi-line control, `'boolean'` a box with its `label` beside it, `'file'` a picker; there is no `'select'`, `'textarea'`, `'checkbox'`
- `form-long` - `long: true` spans the row and gives a multi-line control; there is no `width`/`columns`/`inline`/`segmented` on a field
- `form-bounds-readonly` - `min`/`max`/`step` reach the native control (money steps 0.01; dates take ISO strings); `readOnly` may be `(draft) => boolean`
- `form-submit-async` - A promise-returning `onSubmit` (or an `actions[].onSelect`) goes busy on its own; a rejection becomes a notice

### 4. Status & Busy (HIGH)

- `status-pass-result` - Pass a core `QueryResult`/`ResourceResult` straight in as `status` on `Page`/`Section`/`Table`/`Stat`; the engine renders skeleton, failure + Retry, "Updating…"
- `status-async-actions-busy` - An `Action.onSelect` that returns a promise sets `aria-busy`, disables, and notifies on rejection, in every host (Toolbar, Empty, Form, Dialog) — return the promise, do not track it
- `status-no-loading-flags` - Never hand-roll `loading`/`saving` signals to swap content; that is the engine's waiting rule
- `status-stale-stays` - On failure the previous content stays and the failure line is added; on refresh the content stays and the title says "Updating…"

### 5. Skin & Scheme (MEDIUM-HIGH) — ADR 0035

- `skin-use-once-root` - `useSkin(defaultSkin, { scheme })` exactly once, before the App mounts; it is the one visual decision an app makes
- `skin-scheme-preference` - Scheme is `'system' | 'light' | 'dark'`; forward the user's preference with `setScheme()`; the engine follows the platform live and sets `color-scheme`
- `skin-write-parts` - A `Skin` is `Partial<Record<Part, StyleRecord>>` or `(axes: { scheme }) => that`; parts are the closed `PARTS` list; a complete skin defines every part in both schemes
- `skin-no-layout` - A skin never sets `display`, `width`, `gap`, `position`, columns — only colour, font, border, radius, shadow, decoration
- `skin-bare-proves` - `useSkin(null)` (Ledger: `/?bare`) renders correct, plain layout; if bare looks broken the bug is in the engine, not the skin

### 6. Decisions & Levers (MEDIUM-HIGH)

- `decide-priority-lever` - `Priority = 'primary' | 'secondary' | 'tertiary'` is survival order on actions and columns; primaries never leave, tertiaries go first. That the primary is the filled button, and the fold target, are engine rules — not second meanings
- `decide-kind-lever` - `Kind` says what a value is: on a column (`'text' | 'number' | 'money' | 'date'`) figures and dates align right, use tabular numerals, and never truncate; on a field the same word, plus `'boolean'` and `'file'`
- `decide-tone-lever` - `tone` names meaning (good news, bad news, warning); the skin decides the colour once
- `decide-one-action-rule` - One `Action`, one renderer (`blocks/actions.ts`), one rule everywhere: `destructive` → danger; `priority: 'primary'` → filled; else plain — per action, never counted (one primary per row is the convention; a Form's submit is its row's primary). Only the Toolbar overflows; Empty, Form and Dialog rows wrap
- `decide-destructive-lever` - `destructive: true` is rendered as danger (it wins over `primary`) and, in a footer, first and apart; pair it with `confirm()` for the irreversible
- `decide-text-truncates` - Text (titles, text columns) shrinks to a minimum before anything leaves; figures do not
- `decide-columns-fold` - A dropped table column folds under the primary text cell as a muted line — nothing is lost; do not duplicate it in another column
- `decide-grids-choose-columns` - `Grid` and `Form` pick their column counts from width; `App` picks sidebar vs bar; `Dialog` picks card vs sheet — do not try to control these
- `decide-dont-control` - No app knob exists for widths, breakpoints, column counts, sticky, overflow order, segmented-vs-select, skeleton shape, focus, roles or live-region politeness; if you need one, see `intent-new-need-home`
- `decide-data-never-reshapes` - ADR 0044: a layout decision is a function of width and declared intent, never of the data shown — column widths are budgets from `kind`/label/`metrics.layout`, and sorting, filtering, paging or "Show N more" never move a column, fold, section or action; data truncates, folds or wraps inside the decided structure; a too-wide figure files `FIGURE_TRUNCATED` (fix the format, or one metric, once) — the column never widens. Declare one structure and keep data out of `title`: a data-bearing title is measured as intent and can evict secondary actions into the overflow menu before it truncates
- `decide-floats-are-layers` - Anything that floats (Dialog, confirm, the Toolbar menu, the App bar menu, notices) is a layer on the one overlay stack: Escape, outside pointer, focus in/return and z-order are the engine's; a tap on an open layer's anchor toggles it, never dismiss-then-reopen — never hand-roll a sheet or a focus trap
- `decide-reachable-by-keyboard` - Every decision the engine draws is reachable by keyboard and named for AT with no app line: sortable headers are buttons, `onOpen` rows are named tab stops, notices have a Dismiss in the tab order, labels target labelable controls; a keyboard dismiss never drops focus to `<body>`
- `decide-tone-is-urgency` - `notify(text, 'negative')` is an assertive `alert` (interrupts, 8 s); every other tone a polite `status` (4 s); the spoken name is Error/Success/Warning/Note — pick the tone for its meaning, never for loudness

### 7. Proof at Width (MEDIUM)

- `prove-screens-with-prove` - `prove(() => Screen({}), { widths, scheme: 'light', turns? })` from `@nisli/engine/test` mounts a screen at each width under the calibrated estimator, turns to a fixed point, `settle()`s the data in, and returns `{ claims, reports, byWidth[{ width, claims, reports, turns }] }`; empty `claims` is the proof — one `it` per screen (Ledger: `screens.proof.test.ts`, nine screens, zero claims)
- `prove-claims-are-failures` - A `Claim` (`FIT_*`, `OVERFLOW_TEXT`, `FIGURE_TRUNCATED`, `DECISION_UNSTABLE`, `UNSETTLED`, `NAME_MISSING`, `ID_DUPLICATE`, `LABEL_MISSING`, `DIALOG_ARIA`, `MENU_ITEM_ROLE`, `BLOCK_ERROR`, `UNREACHABLE`, `SORT_UNREACHABLE`, `POPUP_ARIA`, `LIVE_TONE`) is a failing test: fix the intent or the engine, never filter codes or drop widths; a finding that stays is recorded in `KNOWN` by exact text and asserted still present
- `prove-reports-are-failures` - A `LayoutReport` (`FIT_ROW`, `FIT_COLUMNS`, `FIT_CELL`) is a plan the engine could not satisfy; it stamps `data-nisli-report` and the `window.__nisli.reports` ring in dev, `prove()` keeps the ones still standing after settle, `verify()` files `LAYOUT_REPORT` — in a block test `onReport()` and expect `[]`
- `prove-decision-unstable` - the determinism tenet is checked as `DECISION_UNSTABLE`: in dev every decided block stamps its plan as `data-nisli-plan`; `prove()` advances each table's page once and mounts every `ProveOptions.variants` factory — same intent over perturbed data (a sorted copy of the rows, a reversed series; the caller owns the perturbation) — and diffs the stamps; any structural difference is an `error` claim naming the block and both plans, and a variant whose blocks differ in count or tag is named as changed intent, a misuse of `variants`
- `prove-real-content` - Prove over real data: stub `fetch` for every `/api/*` shape, import store and screens after the stub, `await store.ready`, and assert the fixture reached the DOM (rows, `$12,345.67` at 360) before trusting the proof
- `prove-mount-at-width` - Prove a block with `mount(tag | factory, props, { width, viewport?, scheme?, text?, measure? })` → `{ el, frame, styleOf(), resize(), unmount() }`; assert on inline styles and DOM, then `unmount()`
- `prove-text-measurer` - `textMeasurer(charWidth)` makes a block plan arithmetic; `estimator(frame)` (calibrated to Chromium per glyph, style, `tabular-nums`, uppercase/letter-spacing, monospace; `glyphs.test.ts` within 3%) answers a screen — never the other way round
- `prove-five-widths` - 1280/1024/768/480/360 for screens (or a block's own thresholds); the app's bar is zero claims at five widths and zero `nisli-verify` findings across every route
- `prove-verify-routes` - `verify({ baseUrl, routes, widths, ignore?, open? })` / `nisli-verify --base … --routes … --widths … [--open route=selector]` loads the running app in Chromium and files `NO_EVIDENCE`, `STILL_LOADING`, `LOAD_FAILED`, `CONSOLE_ERROR`, `PAGE_ERROR`, `BLOCK_ERROR`, `LAYOUT_REPORT`, `HORIZONTAL_SCROLL`, `NAME_MISSING`, `TAB_UNREACHABLE`, `TAB_ESCAPED_DIALOG`; exit 0 only with no findings — the browser half of proof, not a replacement for `prove()`
- `prove-keyboard-path` - A reachability proof drives the path a person takes — `focus()`, a `keydown` with `key`, a `pointerdown` then `click()` for a real tap — and asserts `document.activeElement`, `__layers`, `aria-expanded`/`aria-sort`, `defaultPrevented` and the callback; an "element exists" or "has role" assertion proves nothing and is not a proof
- `prove-screenshots-not-proof` - Screenshots and sweeps are for looking; `prove().claims === []` and `verify().ok` are the sources of truth, and neither is retired by something looking right

### 8. Dogfooding — Ledger (MEDIUM)

- `dogfood-issue-then-engine` - When the engine cannot express something, record `docs/issues/NNNN-*.md` and solve it in the engine — never app-side styling or a remount hack
- `dogfood-no-fake-intent` - Do not say "a form" to mean "some actions" (issue 0023, resolved by `Dialog.actions`); an ill-fitting block is a gap to file, not a shape to bend
- `dogfood-keep-tenets` - `packages/ledger/TENETS.md` is measured against every change; tenets 9, 10 and 12 are this skill's contract in app terms

## Block cheat-sheet

| Block | Intent props | Engine decisions |
|---|---|---|
| `App` | `brand`, `nav[{label,href}]`, `location`, `children` | sidebar vs top bar + popover menu (Escape, outside tap, arrows, focus return); active nav item; sticky bar |
| `Page` | `title`, `actions?`, `children`, `status?` | pinned toolbar; centred column ≤ 1120; skeleton/failure/updating |
| `Toolbar` | `title`, `actions?` | overflow by priority, primaries never; title truncates last; busy actions; menu keyboard model |
| `Section` | `title?`, `children`, `status?` | card, or no card when nested; waiting states |
| `Grid` | `children` | column count from width (min cell 220); `FIT_CELL` |
| `Stat` | `label`, `value`, `delta?`, `hint?`, `status?` | nested-surface card; tone of delta; skeleton |
| `Table` | `columns[{id,label,cell,kind?,priority?,sortable?}]`, `rows`, `rowKey`, `onOpen?`, `sort?{by,order}`, `onSort?`, `empty?` (string or `EmptyProps`), `status?` | drop/truncate/fold by priority & kind; numeric alignment; sortable header buttons; named openable rows; the `Empty` block when there are no rows; 60-row pages; `FIT_COLUMNS` |
| `Form` | `fields[{name,label,kind?,…}]`, `value` or `initial`+`key`, `onSubmit`, `onChange?`, `submitLabel?`, `onCancel?`, `actions?`, `mode?`, `ref?` | presence, dependent options, capture (choice / long / boolean / file), validation timing, ≤3 options segmented, columns, groups, dirty/confirm, busy, one action rule, every control labelled |
| `Dialog` | `title`, `open`, `onClose`, `children`, `actions?` | card vs sheet (< 640); scroll lock; Escape; focus; the action row after the content |
| `Meter` | `label`, `value`, `max`, `text?` | tone by ratio |
| `Bars` | `items[{label,value,text}]` | label column width; bar scale |
| `Columns` | `labels`, `series[{label,tone?,values}]`, `format` | bar widths; axis label thinning |
| `Empty` | `title`, `hint?`, `actions?` | centred; one action rule; busy |
| `Text` | `text`, `role?: body/note/code`, `tone?` | part per role/tone; `role="note"`/`"code"` to AT; wraps anywhere |
| `Link` | `href`, `label` | `link` part |
| `notify()` | `text`, `tone?` | placement, timing, alert vs status by tone, Dismiss/Escape, focus return |
| `confirm()` | `title`, `text`, `action{label,destructive?}` | a dialog with Cancel and the answer as its primary; resolves the answer |

## Common mistakes (from this repo's history)

- **Mixing imperative and reactive style writes.** A computed style string that does not change will not re-apply over a later imperative write; blocks own styles reactively end to end (`engine/use-fit.ts`, `blocks/kernel.ts`). App code never writes styles at all.
- **Selecting through `each()` wrappers.** `each()` wraps every item in a `display: contents` `<each-item>`; grid/list children are its `firstElementChild` (`form.test.ts` rule 6, `extras.test.ts`).
- **Expecting a `<select>` for a 2–3 option field.** A field with `options` is a choice; the engine renders a segmented `role="radiogroup"` for 2–3, a native select for 4+. Query `#f-<name>` and branch on `role` (`form.test.ts` rule 4).
- **Writing the old words.** `header`, `key` on a field, `kind: 'select'`, `role: 'muted'`, `destructive: {…}` on a Form, `confirmLabel`, `detail`, `content`, `dir`, `onSelect` on a Table, `as const` on a tone — each is a compile error since 0.8.0 (ADR 0043); the fix is the vocabulary, not a cast.
- **Reading `children` lazily.** A prop read only inside a lazy computed is diagnosed unread (N202); `Page` reads `props.children.value` eagerly for this reason.
- **Vite config in TS workspaces.** Ledger and www run `vite --configLoader runner`; a plain `vite` may fail to load the TS config that imports the router.

## How to Use

Read the full compiled document for detailed explanations and code examples: `AGENTS.md`

Each section contains:
- The invariant or rule explained
- Why it matters (the bug it prevents)
- Incorrect code example with explanation
- Correct code example, lifted from Ledger where one exists
- References to engine source files and ADRs
