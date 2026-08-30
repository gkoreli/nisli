---
name: nisli-engine
description: Typed-block authoring guidelines for code that uses `@nisli/engine`. This skill should be used when writing, reviewing, or refactoring screens built from engine blocks (App, Page, Toolbar, Section, Grid, Stat, Table, Form, Dialog, Meter, Bars, Columns, Empty, Text, Link, notify, confirm), Form schemas, skins, or width proofs — and whenever app code is tempted to make a visual decision.
license: MIT
metadata:
  author: nisli-team
  version: "1.0.0"
---

# Nisli Engine — Agent Skill

Guide for building application UI from `@nisli/engine`: app code says **what** things are, the engine decides how they are laid out and what fits at every width, and a skin — installed once — says what the parts look like. There is no CSS file, no `className`, no `style` prop, no `data-*` attribute in the public surface; the types do not offer them. Rules across 8 categories, each traceable to `packages/engine/src/index.ts`, the block prop types, `docs/adr/0034`, `0035`, `0037`, and the Ledger app (`packages/ledger`).

## When to Apply

Reference these guidelines when:
- Composing a screen from engine blocks (`Page`, `Section`, `Grid`, `Table`, …)
- Writing a `Form` schema (`Field<T>`: `when`, `options`, `validate`, `group`, `long`)
- Passing async results (`query()` / `resource()`) to blocks as `status`
- Installing or writing a `Skin`, or forwarding a light/dark/system preference
- Choosing `priority` / `kind` / `tone` / `destructive` so the engine degrades correctly
- Proving a block or screen at width with `@nisli/engine/test`
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

- `intent-say-what-not-how` - Props state what a thing IS (`priority`, `kind`, `tone`, `role`, `destructive`, `required`) and what contains what; never how it looks or where it sits
- `intent-no-appearance-vocabulary` - No `className`, `style`, `data-*`, pixels, rem, colours, fonts, breakpoints, `sticky`, `flex-end` in app code — the types reject them (`toolbar.test.ts` proves `className`/`style`/`align` are compile errors)
- `intent-new-need-home` - A new need goes, in order: an engine rule derived from structure, a skin part, a new semantic word on a block. NEVER a per-instance appearance prop (`Section({ flat: true })`)
- `intent-app-imports-blocks-only` - App code imports blocks, `useSkin`/`setScheme`/`defaultSkin`, `notify`, `confirm`; it never uses `metrics`, `look`, `fit` or the kernel for its own layout
- `intent-structure-is-the-decision` - Nesting IS intent: a `Stat` inside a `Section` is a nested surface and draws no second card — the engine knows the tree, the author does not say "flat"

### 2. Blocks (CRITICAL)

- `block-app` - `App({ brand, nav, location, content })` — sidebar or top bar + menu sheet is the engine's call from width; pass `location` as a computed of the router
- `block-page` - `Page({ title, actions?, children, status? })` — a pinned toolbar over a centred content column; `status` refreshing appends "· Updating…" to the title
- `block-toolbar` - `Toolbar({ title, actions? })` — actions overflow tertiary → secondary, then the title truncates; a primary never leaves
- `block-section` - `Section({ title?, children, status? })` — a titled surface; nested inside another surface it draws no card
- `block-grid` - `Grid({ children })` — equal-weight cells; the engine picks the column count (`minColumn` 220)
- `block-stat` - `Stat({ label, value, delta?: { text, tone }, hint?, status? })` — the tone says whether the change is good news
- `block-table` - `Table<T>({ columns, rows, key, onSelect?, sort?, onSort?, empty?, status? })` — `Column` carries `kind`, `priority`, `sortable`; 60 rows then "Show N more"
- `block-form` - `Form<T>({ fields, value | initial+key, onChange?, onSubmit, submitLabel?, onCancel?, destructive?, mode?, ref? })` — see `form-*`
- `block-dialog` - `Dialog({ title, open, onClose, children })` — a centred card, or a full-height sheet below 640; scroll lock, Escape, focus restore are the engine's
- `block-meter` - `Meter({ label, value, max, detail? })` — tone by ratio: > 1 negative, > 0.85 warning
- `block-bars` - `Bars({ items: { label, value, text }[] })` — the label column takes up to a third of the block
- `block-columns` - `Columns({ labels, series: { name, tone?, values }[], text })` — grouped columns; axis labels thin until they fit
- `block-empty` - `Empty({ title, hint?, action? })` — the one place a call-to-action lives when there is nothing
- `block-text` - `Text({ text, role?: 'body'|'muted'|'heading'|'code', tone? })` — role and tone are words, the skin decides how they read
- `block-link` - `Link({ href, label })` — a navigation link; the skin's `link` part dresses it
- `block-notify` - `notify(text, tone?)` — a timed, polite live-region notice; negative stays longer
- `block-confirm` - `confirm({ title, message, confirmLabel?, destructive? }): Promise<boolean>` — ask before an action that cannot be undone

### 3. Form Schema (HIGH) — ADR 0037

- `form-when-presence` - Presence is `when: (draft) => boolean`, never hint prose; an absent field is not rendered, not validated, not submitted
- `form-options-draft` - Dependent choices are `options: (draft) => Option[]`; a value no longer offered is cleared by the engine
- `form-validate-reason` - `validate: (value, draft) => string | undefined` returns the REASON; `required`/bounds/choice-membership run first, the engine decides timing (blur, then submit) and announcement
- `form-owned-initial-key` - Dialog forms are owned: `initial` + `key`; a new key resets the draft (file inputs included); one key per opening
- `form-controlled-value` - Shared state is controlled: `value` (a writable signal is edited in place) — presence of the `value` key selects the mode; never both
- `form-live-mode` - Filters and settings-as-you-type are `mode: 'live'`: no buttons, `onChange` per change, validation still on blur
- `form-group` - Fields sharing a `group` string become one titled fieldset at the position of the first
- `form-long` - `long: true` (or `kind: 'textarea'`) spans the row; there is no `width`/`columns`/`inline`/`segmented` on a field
- `form-bounds-readonly` - `min`/`max`/`step` reach the native control (money steps 0.01; dates take ISO strings); `readOnly` may be `(draft) => boolean`
- `form-submit-async` - A promise-returning `onSubmit` (or `destructive.onSelect`) goes busy on its own; a rejection becomes a notice

### 4. Status & Busy (HIGH)

- `status-pass-result` - Pass a core `QueryResult`/`ResourceResult` straight in as `status` on `Page`/`Section`/`Table`/`Stat`; the engine renders skeleton, failure + Retry, "Updating…"
- `status-async-actions-busy` - An `Action.onSelect` that returns a promise sets `aria-busy`, disables, and notifies on rejection — return the promise, do not track it
- `status-no-loading-flags` - Never hand-roll `loading`/`saving` signals to swap content; that is the engine's waiting rule
- `status-stale-stays` - On failure the previous content stays and the failure line is added; on refresh the content stays and the title says "Updating…"

### 5. Skin & Scheme (MEDIUM-HIGH) — ADR 0035

- `skin-use-once-root` - `useSkin(defaultSkin, { scheme })` exactly once, before the App mounts; it is the one visual decision an app makes
- `skin-scheme-preference` - Scheme is `'system' | 'light' | 'dark'`; forward the user's preference with `setScheme()`; the engine follows the platform live and sets `color-scheme`
- `skin-write-parts` - A `Skin` is `Partial<Record<Part, StyleRecord>>` or `(axes: { scheme }) => that`; parts are the closed `PARTS` list; a complete skin defines every part in both schemes
- `skin-no-layout` - A skin never sets `display`, `width`, `gap`, `position`, columns — only colour, font, border, radius, shadow, decoration
- `skin-bare-proves` - `useSkin(null)` (Ledger: `/?bare`) renders correct, plain layout; if bare looks broken the bug is in the engine, not the skin

### 6. Decisions & Levers (MEDIUM-HIGH)

- `decide-priority-lever` - `priority: 'primary' | 'secondary' | 'tertiary'` is survival order on actions and columns; primaries never leave, tertiaries go first
- `decide-kind-lever` - `kind: 'text' | 'number' | 'money' | 'date'` on a column: figures and dates align right, use tabular numerals, and never truncate
- `decide-tone-lever` - `tone` names meaning (good news, bad news, warning); the skin decides the colour once
- `decide-destructive-lever` - `destructive: true` is rendered as danger and never as primary; pair it with `confirm()` for the irreversible
- `decide-text-truncates` - Text (titles, text columns) shrinks to a minimum before anything leaves; figures do not
- `decide-columns-fold` - A dropped table column folds under the primary text cell as a muted line — nothing is lost; do not duplicate it in another column
- `decide-grids-choose-columns` - `Grid` and `Form` pick their column counts from width; `App` picks sidebar vs bar; `Dialog` picks card vs sheet — do not try to control these
- `decide-dont-control` - No app knob exists for widths, breakpoints, column counts, sticky, overflow order, segmented-vs-select, or skeleton shape; if you need one, see `intent-new-need-home`

### 7. Proof at Width (MEDIUM)

- `prove-mount-at-width` - Prove a block with `mount(tag | factory, props, { width, viewport?, scheme?, text? })` from `@nisli/engine/test`; assert on inline styles and DOM, then `unmount()`
- `prove-text-measurer` - Use `textMeasurer(charWidth)` so text-shaped elements have deterministic widths and a plan is arithmetic
- `prove-five-widths` - Prove at 1280/1024/768/480/360 (or the block's own thresholds); zero console errors across every route at those widths is the app's bar
- `prove-reports-are-failures` - A `LayoutReport` (`FIT_ROW`, `FIT_COLUMNS`, `FIT_CELL`) means the engine could not satisfy a plan — treat one as a failing test, never as noise
- `prove-screens-with-prove` - `prove(() => Screen({}), { widths })` mounts a screen with the estimating measurer and returns its reports; `[]` is the proof (parked for Ledger per issue 0024, still the shape)
- `prove-screenshots-not-proof` - Screenshots are for looking, not correctness; a sweep is never the source of truth over a width test

### 8. Dogfooding — Ledger (MEDIUM)

- `dogfood-issue-then-engine` - When the engine cannot express something, record `docs/issues/NNNN-*.md` and solve it in the engine — never app-side styling or a remount hack
- `dogfood-no-fake-intent` - Do not say "a form" to mean "some actions" (issue 0023); an ill-fitting block is a gap to file, not a shape to bend
- `dogfood-keep-tenets` - `packages/ledger/TENETS.md` is measured against every change; tenets 9, 10 and 12 are this skill's contract in app terms

## Block cheat-sheet

| Block | Intent props | Engine decisions |
|---|---|---|
| `App` | `brand`, `nav[{label,href}]`, `location`, `content` | sidebar vs top bar + menu; active nav item; sticky bar |
| `Page` | `title`, `actions?`, `children`, `status?` | pinned toolbar; centred column ≤ 1120; skeleton/failure/updating |
| `Toolbar` | `title`, `actions?` | overflow by priority; title truncates last; busy actions |
| `Section` | `title?`, `children`, `status?` | card, or no card when nested; waiting states |
| `Grid` | `children` | column count from width (min cell 220); `FIT_CELL` |
| `Stat` | `label`, `value`, `delta?`, `hint?`, `status?` | nested-surface card; tone of delta; skeleton |
| `Table` | `columns[{id,header,cell,kind?,priority?,sortable?}]`, `rows`, `key`, `onSelect?`, `sort?`, `onSort?`, `empty?`, `status?` | drop/truncate/fold by priority & kind; numeric alignment; 60-row pages; `FIT_COLUMNS` |
| `Form` | `fields`, `value` or `initial`+`key`, `onSubmit`, `onChange?`, `submitLabel?`, `onCancel?`, `destructive?`, `mode?`, `ref?` | presence, dependent options, validation timing, ≤3 options segmented, columns, groups, dirty/confirm, busy |
| `Dialog` | `title`, `open`, `onClose`, `children` | card vs sheet (< 640); scroll lock; Escape; focus |
| `Meter` | `label`, `value`, `max`, `detail?` | tone by ratio |
| `Bars` | `items[{label,value,text}]` | label column width; bar scale |
| `Columns` | `labels`, `series[{name,tone?,values}]`, `text` | bar widths; axis label thinning |
| `Empty` | `title`, `hint?`, `action?` | centred; busy action |
| `Text` | `text`, `role?`, `tone?` | part per role/tone; wraps anywhere |
| `Link` | `href`, `label` | `link` part |
| `notify()` | `text`, `tone?` | placement, timing, live region |
| `confirm()` | `title`, `message`, `confirmLabel?`, `destructive?` | a dialog with Cancel/Confirm; resolves the answer |

## Common mistakes (from this repo's history)

- **Mixing imperative and reactive style writes.** A computed style string that does not change will not re-apply over a later imperative write; blocks own styles reactively end to end (`engine/use-fit.ts`, `blocks/kernel.ts`). App code never writes styles at all.
- **Selecting through `each()` wrappers.** `each()` wraps every item in a `display: contents` `<each-item>`; grid/list children are its `firstElementChild` (`form.test.ts` rule 6, `extras.test.ts`).
- **Expecting a `<select>` for a 2–3 option field.** The engine renders a segmented `role="radiogroup"`; 4+ options is a native select. Query `#f-<key>` and branch on `role` (`form.test.ts` rule 4).
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
