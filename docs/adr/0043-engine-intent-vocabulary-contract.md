# 0043. Engine Intent Vocabulary Contract — One Term, One Meaning, Across the Whole Surface

**Date**: 2026-08-30
**Status**: Accepted (2026-08-30) — gated, reviewed, engine and Ledger migrated on local main; see §Gate and review and §Acceptance as read
**Depends on**: [0034-engine-typed-blocks-decided-by-an-engine](./0034-engine-typed-blocks-decided-by-an-engine.md) (the ubiquitous language this record extends; "app code says what, never how"), [0037-engine-form-intent-capture-domain](./0037-engine-form-intent-capture-domain.md) (the Form domain words: Field, Option, Long, Presence), [0042-engine-reachability](./0042-engine-reachability.md) (which fixed the one behavioural finding and left the words; its §(d) checkbox rule is amended here)
**Resolves**: [issue 0027 — the intent vocabulary says one word for several meanings](../issues/0027-intent-vocabulary-incoherences.md); [issue 0023 — dialogs have no action row](../issues/0023-actions-block-for-dialogs.md) (E5 landed: `Dialog.actions`, its option 1)
**Code** (as shipped — engine `Unreleased — 0.8.0` in its CHANGELOG, the version bump belongs to the release commit): [`packages/engine/src/index.ts`](../../packages/engine/src/index.ts), [`blocks/types.ts`](../../packages/engine/src/blocks/types.ts), [`blocks/form/schema.ts`](../../packages/engine/src/blocks/form/schema.ts), [`blocks/form.ts`](../../packages/engine/src/blocks/form.ts), [`blocks/table.ts`](../../packages/engine/src/blocks/table.ts), [`blocks/text.ts`](../../packages/engine/src/blocks/text.ts), [`blocks/empty.ts`](../../packages/engine/src/blocks/empty.ts), [`blocks/confirm.ts`](../../packages/engine/src/blocks/confirm.ts), [`blocks/dialog.ts`](../../packages/engine/src/blocks/dialog.ts), [`blocks/toolbar.ts`](../../packages/engine/src/blocks/toolbar.ts), [`blocks/app.ts`](../../packages/engine/src/blocks/app.ts), [`blocks/meter.ts`](../../packages/engine/src/blocks/meter.ts), [`blocks/columns.ts`](../../packages/engine/src/blocks/columns.ts), [`blocks/stat.ts`](../../packages/engine/src/blocks/stat.ts), a new internal `blocks/actions.ts`; the consumer [`packages/ledger/src/screens/*.ts`](../../packages/ledger/src/screens) and [`main.ts`](../../packages/ledger/src/main.ts); the skill [`.agents/skills/nisli-engine`](../../.agents/skills/nisli-engine/SKILL.md)
**Research**: [`intent-vocabulary-audit-2026-08-30.md`](../research/engine/intent-vocabulary-audit-2026-08-30.md) (findings A1–A8), [`next-round-panel-2026-08-30.md`](../research/engine/next-round-panel-2026-08-30.md) §Deferred (why it waited)

## Context

**The audit.** On 2026-08-30 the engine's public intent surface —
`index.ts`, `blocks/types.ts`, `blocks/form/schema.ts`, every exported prop
interface — was read against 0034's yardstick: the words an app may use are a
closed vocabulary of *what*, and the engine decides *how*. The vocabulary is
small (fifteen blocks, about forty prop words) and mostly honest, but it is
not one language. Issue 0027 records fifteen findings in five families: one
word carrying several meanings (`key` ×3, `kind` ×3, `destructive` ×2,
`onSelect` ×2, `dir` ×2, `placeholder` ×3); one meaning carrying several
words (the name of a thing: `label`/`header`/`name`; a formatted string:
`text`/`detail`/`message`; a container's children: `children`/`content`; an
empty state: a string or a block); *how* words inside intent (`'textarea'`,
`'select'`, `'checkbox'`, `role: 'muted'`); the one type five blocks share —
`Action` — honoured differently by each; and missing exports (`Priority`,
`Delta`) that make the consumer write `as const` fourteen times.

**Why it was deferred.** The next-round panel ranked the contract third
behind reachability (0042) and contrast (the 0035 amendment) for two reasons
that were conditions, not objections: every rename touches
`packages/ledger/src/screens`, which a second session was editing under a
"never modify an existing Ledger file" rule; and issue 0023 (a Dialog action
row) was the fourth placement of `Action` that would decide, by evidence,
what `Action` has to mean. 0037's and 0041's long-term plans both say "the
vocabulary contract lands once the vocabulary settles".

**Why now.** 0042 has landed (engine 0.6.0) and the contrast amendment after
it (0.7.0); both worked under "no new prop, no new word" and left every
collision in place — 0042 §(d) went as far as to record the checkbox
`placeholder` repurposing *as the rule*. The Ledger session's screen edits
are committed (`351b2b5`); its remaining dirty files are `server/*` and
`src/data/*`, which this record never touches. The 0023 evidence is in:
`connections.ts:208` fakes a Dialog action row with `Form({ fields: [] })`,
and the fake shows exactly which `Action` fields a fourth placement needs
(`id`, `label`, `destructive`, `onSelect`; `priority` still has its
rendering rule — it decides the filled button — only overflow is absent). The vocabulary has settled; what is left is to decide it
once.

**Rules this round works under.** *No new capability* — the round changes
words and makes the engine honour, identically, intent it already accepts;
where a slot is added (`Dialog.actions`, `Table.empty` as a block) it is the
engine rendering a block it already has in a place it already draws. *DDD* —
one term, one meaning, across the whole surface; a subset of a type is
allowed, a synonym is not. *App code states intent only* — no word the app
may say names a widget, a Part, or a look. *Ledger is the consumer* — it is
migrated in one explicitly-owned phase and otherwise untouched.

## Ubiquitous language

This table is the canonical intent vocabulary; 0034 and 0037 point here.
Verified against `index.ts` and `blocks/types.ts` as shipped (§Acceptance as
read). Additions and amendments to the 0034 and 0037 tables. A term's "applies to"
is the closed list of exported interfaces that may use it; the same word on
any other interface is a defect.

| term | meaning | applies to |
|---|---|---|
| **`id`** | Identity among siblings — the sort key, the busy key, the DOM id. | `Column`, `Action` |
| **`key`** | Identity across renders: the thing under which the engine decides what is the same thing. A change is a new thing (a Form resets to `initial`). | `FormProps` |
| **`rowKey`** | `key`, for each row of a Table — `(row) => string`, handed to `each()`. | `TableProps` |
| **`name`** | The property of `T` a field edits (`keyof T & string`); written to the control's HTML `name`. | `Field` |
| **`kind`** | What a value *is*: `Kind = 'text' \| 'number' \| 'money' \| 'date' \| 'boolean' \| 'file'`. Never how it is captured or shown. A Column takes the `Extract<Kind, 'text' \| 'number' \| 'money' \| 'date'>` subset. | `Column`, `Field` |
| **capture** (not a word) | How a `Field` is edited is *derived*: `options` present → a choice (segmented at ≤ `SEGMENTED_MAX`, else a list — the engine's call); `long: true` → multi-line; `kind: 'boolean'` → a box with the `label` beside it; `kind: 'file'` → a file picker. There is no `control`, `input` or `widget` word. | — |
| **`label`** | The human name of an item or datum. | `Stat`, `Meter`, `Field`, `Option`, `BarItem`, `NavItem`, `Link`, `Action`, `Column`, `Series` |
| **`title`** | The heading of a block, at a level the block knows: a container's name, a dialog's question, a toolbar's subject, an empty state's statement ("No banks connected"). The only way an app says a heading. | `Page`, `Section`, `Dialog`, `Empty`, `Toolbar`, `confirm` |
| **`text`** | A human-readable string the app wrote: prose, or the reading of a number in the app's units. | `Text`, `Delta`, `BarItem`, `Meter`, `confirm`, `notify` |
| **`format`** | A function from a number to its `text`. | `ColumnsProps` |
| **`hint`** | Secondary text *of* an item — a footnote, an explanation under a Stat, a Field, an Empty. `hint` and `role: 'note'` are the two hosts of one concept, "secondary text": `hint` when it belongs to an item, `note` when it is a free-standing block. Not synonyms: one attaches, the other stands. | `Empty`, `Stat`, `Field` |
| **`placeholder`** | What an empty control shows: ghost text, or the empty choice ("All accounts"). Allowed on every `kind` except `boolean` (a box has no empty state to caption) and `file` (a file control shows no ghost text); a type error on both. | `Field` (narrowed by `kind`) |
| **`empty`** | What to say when there is nothing: a string (shorthand for `{ title }`) or `EmptyProps`. The engine renders the `Empty` block, unchanged, in the row where the muted sentence sat. | `TableProps` |
| **`children`** | What a container holds. `Content` is the *type* of one child; `children` is the only *prop word*. | `App`, `Page`, `Section`, `Grid`, `Dialog` |
| **`Action`** | `{ id; label; priority?; destructive?; onSelect? }` — a thing a person may activate. One type, one rendering rule, one renderer. `confirm` takes `Pick<Action, 'label' \| 'destructive'>` and the engine supplies `priority: 'primary'` to that affirmative answer (the person came for the answer) — an engine rule, like the filled button. | `Toolbar`, `Page`, `Empty`, `Form`, `Dialog`; `confirm` (the subset) |
| **`actions`** | The Actions a block offers, in the author's order. The engine places them. | `Toolbar`, `Page`, `Empty`, `Form`, `Dialog` |
| **`action`** | The one Action a `confirm` offers as its answer: `Pick<Action, 'label' \| 'destructive'>`. The engine supplies `priority: 'primary'`. | `confirm` |
| **`action`** | The one Action a confirm offers as its answer: `Pick<Action, 'label' \| 'destructive'>`. | `confirm` |
| **`Priority`** | Survival order only: `'primary' \| 'secondary' \| 'tertiary'`, default `'secondary'` everywhere. A primary never leaves; a tertiary leaves first. That the filled button is the primary is an *engine rule*, not a second meaning; so is the Column fold rule (0034 §Decision rules: dropped columns fold under the first primary text column — the fold target is derived from `priority`, never said). | `Action`, `Column` |
| **`destructive`** | A boolean on an Action and nowhere else: the action cannot be undone. The engine renders it as danger and asks nothing further. | `Action` |
| **`onSelect`** | An Action was activated (the WAI-ARIA menu word). | `Action` |
| **`onOpen`** | A row was opened. Not a selection: the row carries no `aria-selected`. | `TableProps` |
| **`order`** | Sort order, `'asc' \| 'desc'`. `dir` keeps HTML's meaning (writing direction) and lives on the Decision type `PlaceOptions` only. | `Sort` |
| **`role`** (Text) | What a run of prose *is*: `'body'` (default), `'note'` (WAI-ARIA `note`: "content that is parenthetic or ancillary to the main content" — a free-standing secondary paragraph the reader may skip; the engine emits `role="note"`), `'code'` (WAI-ARIA `code`: a literal). Two of the three are ARIA roles, which is why the prop is named `role`; `'body'` is the absence of one. Never a Part: that `note` renders as `text.muted` is the skin's rule for ancillary prose, not the word. A heading is a container's `title`. | `TextProps` |
| **`tone`** | Whether a number is good news: `Tone`, optional everywhere, default `'neutral'`. | `Text`, `Delta`, `Series` |
| **`Delta`** | `{ text; tone? }` — a change relative to something. Exported. | `StatProps.delta` |
| **`Kind`** (layer) | 0040's `LayerKind` is Decision vocabulary and stays exported under that name — from the kernel/block-author section of `index.ts`, not the intent section. | block authors |

Unchanged and reaffirmed: `sortable`, `required`, `long`, `when`, `readOnly`,
`group`, `options`, `Option { value; label }`, `accept`, `min`/`max`/`step`,
`validate`, `mode`, `initial`/`value`, `submitLabel`/`onSubmit`/`onCancel`
(submission is the form's own verb, not an Action), `Status` (0034's term for
an async result; the kernel `status:` spec and the ARIA `status` role are
Blocks and DOM vocabulary and never intent — an app should name its own
columns `state` or `outcome`), `brand`, `nav`, `location`, `href`, `open`,
`onClose`, `labels`, `series`, `values`, `items`, `max`, `value`.

## Decision

### The contract rules

1. **One word, one meaning.** A term in the table above means the same thing
   on every interface it applies to, and appears on no other. A *subset* of
   a type is allowed (`confirm` takes two fields of `Action`; `Column.kind`
   takes four of the six `Kind`s); a *synonym* is not (`confirmLabel`,
   `header`, `detail`, `message`, `content` leave).
2. **No look words in intent.** A word an app may say never names a widget
   (`'textarea'`, `'select'`, `'checkbox'`), a Part (`'muted'`), or a
   placement. What a thing *is* is said; how it is captured, dressed or
   placed is derived. `text.muted`, `text.faint`, segmented-vs-list,
   "destructive apart from the others" — all engine rules, none of them a
   prop.
3. **Every Action is honoured identically.** One internal renderer,
   `actionRow()` in `blocks/actions.ts`, draws every action row (Toolbar,
   Page via Toolbar, Empty, Form, Dialog) and the confirm buttons with one
   rule: `destructive` → `button.danger` (wins); else `priority ===
   'primary'` → `button.primary`; else `button.plain`; busy on a returned
   promise through `createBusy()`; menu items `menu.item.danger` when
   destructive. `priority` keeps its 0034 meaning (survival) as a *word*;
   "the primary is the filled one" is the engine's rule, applied the same
   everywhere and *per action* — the renderer never counts: two primaries in
   a row are two filled buttons; one primary per row is a convention the
   skill teaches, not a rule the engine enforces. Empty stops assuming its
   action is primary, Form stops assuming its extra action is danger. In a
   Form the submit button is the row's primary, so a Form or Dialog
   `actions` entry is normally secondary, tertiary or destructive. Whether a
   row may overflow to a menu is the placement's decision (Toolbar: yes,
   with `FIT_ROW` below the minimum; Empty, Dialog and Form: never — they
   wrap; a dialog is already the focused layer).
4. **Datum, not control.** `kind` says what a value is on Column and Field
   alike. A Field's capture is derived from `options`, `long`, and the
   `boolean`/`file` kinds (table above). A `boolean` field has one string —
   its `label`, rendered beside the box as the `<label for>` — and
   `placeholder` is a type error on it (`Field` becomes a union discriminated
   on `kind`). 0042 §(d)'s "the engine renders `placeholder` as the caption"
   is superseded: the accessible name collapses to the one label, and the
   `aria-labelledby` pair becomes a single `<label for>`.
5. **Slots reuse blocks.** Where the engine already renders a thing, it
   renders the block for it: `Table.empty` renders the `Empty` block,
   unchanged, in the empty row where the muted sentence sat (a string is
   `{ title }`, so the nine Ledger sentences change look — `text.muted`
   becomes `text.title` — and Ledger may split any of them into
   `{ title, hint }` in L1); `Dialog.actions` renders `actionRow()` in the
   body's flow after `children`, exactly where the fieldless Form's row sits
   today (`connections.ts:208` is the evidence the placement is already
   drawn) — no sticky footer, no new sheet-mode decision. Each is reuse of a
   placement the engine already draws; both
   remove a way for the app to say the same thing twice
   (`Empty` beside a Table; `Form({ fields: [] })` inside a Dialog).
6. **The consumer can name every type it needs.** `Kind`, `Priority`,
   `Delta`, `Action`, `Tone`, `Sort` are exported; every `tone` is optional;
   a computed value that feeds a block prop is annotated with the exported
   type (`Action[]`, `Delta`) instead of `as const` on each literal.

### The contract, term by term

| # | today (word · where · meaning) | contract | engine change | Ledger sites |
|---|---|---|---|---|
| 1a | `key` · `Field` · the property a field edits (`schema.ts:11`, → HTML `name` at `form.ts:169`) | **`name`** | `form/schema.ts`, `form.ts` (12 `f.key` reads), `form/draft.ts`, `form.test.ts`, `schema.test.ts`, `draft.test.ts` | 36 in 7 files (accounts 3, budgets 2, import 12, rules 4, settings 5, transaction-dialog 6, transactions 4) |
| 1b | `key` · `TableProps` · row identity for `each()` (`table.ts:30`) | **`rowKey`** | `table.ts`, `table.test.ts`, `layout.test.ts` | 11 in 8 files (account, budgets, connections ×2, import, overview ×2, rules ×2, settings, transactions) |
| 1c | `key` · `FormProps` · draft identity (`form.ts:30`) | **`key`** (unchanged) | none | 0 (6 sites stay) |
| 1d | `id` · `Column`, `Action` | **`id`** (unchanged) | none | 0 |
| 2a | `kind` · `Column` · what a cell holds (`table.ts:16`) | **`kind?: Extract<Kind, 'text'\|'number'\|'money'\|'date'>`**; `Kind` exported | `types.ts` (new `Kind`), `table.ts`, `index.ts` | 0 |
| 2b | `kind: FieldKind` · `Field` · datum + widget (`schema.ts:6`) | **`kind?: Kind`**, default `'text'`; `'select'`, `'textarea'`, `'checkbox'`, `FieldKind` leave; capture derived | `form/schema.ts` (`spansRow` → `long` only; `validateField` `'select'` branch → "has options"; `stepOf` unchanged), `form.ts` `control()` (5 `f.kind ===` checks → `optionsOf(f).length > 0` / `f.long` / `'boolean'` / `'file'`), `segmentedOf`, `form.test.ts` rule 4/6/8 titles, `index.ts` | 25 in 7 files: drop `'select'` (20: accounts 1, budgets 1, import 9, rules 1, settings 3, transaction-dialog 3, transactions 2); drop `'textarea'` (1, `transaction-dialog.ts:57`, already `long: true`); `'checkbox'` → `'boolean'` (4: `transactions.ts:20`, `import.ts:74-75`, `rules.ts:47`); `'file'` unchanged (2) |
| 2c | `LayerKind` · `index.ts:37` · layer policy | stays, moved to the block-author section of `index.ts` with a comment; no rename | `index.ts` | 0 |
| 3a | `role: 'body'\|'muted'\|'heading'\|'code'` · `Text` (`text.ts:9`) | **`role?: 'body' \| 'note' \| 'code'`** | `text.ts` (`ROLE_PART`: `note → 'text.muted'`, `heading` removed), `extras.test.ts` | 10 in 4 files: `'muted'` → `'note'` (8: overview 1, settings 3, transaction-dialog 1, connections 3 — `:195,196,204`); `connections.ts:205` (an error line, `code: message`, not ancillary prose) → `tone: 'negative'` body text; `'body'` → drop (1, `connections.ts:194`) |
| 3b | `role: 'heading'` → `<span>` (`text.ts:22`) | **removed**; a heading is a container's `title` | `text.ts` | 0 |
| 3c | mutedness derived in Stat, Table fold, Empty, Form hint, segmented heading | unchanged — derived, never said | none | 0 |
| 4a | `Action` honoured five ways | **one `Action`, one rule, one renderer** (`blocks/actions.ts`, `variantOf` moves there from `toolbar.ts:18`) | `types.ts`, new `actions.ts`, `toolbar.ts`, `empty.ts`, `form.ts:356-372`, `confirm.ts`, `dialog.ts`, each block's test | see 4b–4e |
| 4b | `Empty.action?: Action` (`empty.ts:9`) | **`actions?: readonly Action[]`** | `empty.ts`, `extras.test.ts` | 1 (`connections.ts:182`) |
| 4c | `Form.destructive?: Action` (`form.ts:36`) | **`actions?: readonly Action[]`** beside Save/Cancel; destructive ones placed apart (`marginRight: auto`) — derived | `form.ts`, `form.test.ts` | 4 (`budgets.ts:65`, `rules.ts:111`, `connections.ts:221`, `transaction-dialog.ts:92`); the nested `destructive: true` stays and now means something |
| 4d | `confirm({ title, message, confirmLabel?, destructive? })` (`confirm.ts:6-11`) | **`confirm({ title, text, action: Pick<Action, 'label' \| 'destructive'> })`**; the engine gives the answer `priority: 'primary'` so it is the filled (or danger) button | `confirm.ts`, `form.ts:153` (discard prompt), `overlay.test.ts` | 6 (`budgets.ts:67`, `rules.ts:116`, `transaction-dialog.ts:95`, `settings.ts:110`, `connections.ts:114`, `connections.ts:227`) |
| 4e | Dialog has no action row (issue 0023); `Form({ fields: [] })` fakes one | **`Dialog.actions?: readonly Action[]`** by `actionRow()` in the body's flow after `children`; wraps, never overflows — **last engine phase, droppable** | `dialog.ts`, `overlay.test.ts` | 1 (`connections.ts:208-230`: fieldless Form deleted) |
| 5 | `AppProps.content: Content` (`app.ts:17`) | **`children: Children`** | `app.ts`, `layout.test.ts`, README | 1 (`main.ts:18`) |
| 6 | `Status` / `status:` spec / `role="status"` / app columns | no engine change; ADR note only | none | 0 required (`import.ts:15,110`, `connections.ts:135` may rename app-side) |
| 7a | `title` on Page, Section, Dialog, Empty, Toolbar, confirm | unchanged | none | 0 |
| 7b | `Column.header` (`table.ts:13`), `Series.name` (`columns.ts:8`) | **`label`** | `table.ts` (+ the fold line `table.ts:178`), `columns.ts`, tests | 50 in 9 files: `header` → `label` 48 (account 5, budgets 4, connections 10, import 5, overview 9, rules 6, settings 3, transactions 6); `name` → `label` 2 (`overview.ts:47-48`) |
| 7c | `Meter.detail` (`meter.ts:10`), `confirm.message` (`confirm.ts:8`) | **`text`** | `meter.ts`, `confirm.ts`, tests | 8: `detail` 2 (`budgets.ts:53`, `overview.ts:95`); `message` 6 (the confirm sites) |
| 7d | `ColumnsProps.text: (n) => string` (`columns.ts:18`) | **`format`** | `columns.ts`, tests | 1 (`overview.ts:88`) |
| 7e | `hint` on Empty, Stat, Field | unchanged | none | 0 |
| 7f | `Field.placeholder` as a checkbox caption (`form.ts:213`) | **`placeholder`** on text-like and choice fields only; a `boolean` shows its **`label`**; type error otherwise | `form/schema.ts` (discriminated `Field`), `form.ts` checkbox branch, `form.test.ts`, 0042 §(d) amended | 4 in 3 files (`transactions.ts:20`, `import.ts:74-75`, `rules.ts:47`): the caption becomes the `label`; the old label is dropped or moved to `hint`. The 6 `placeholder: 'All …' / 'None'` choice sites stay |
| 7g | `Table.empty?: string` → muted div (`table.ts:195-197`) vs the `Empty` block | **`empty?: string \| EmptyProps`**; the engine renders `Empty` unchanged in the empty row — **second droppable phase** | `table.ts`, `table.test.ts` | 0 required (9 string sites stay and change look: the sentence becomes `text.title`); Ledger may split long ones into `{ title, hint }` (`rules.ts:89`, `overview.ts:103`, `settings.ts:118`); `account.ts:39`, `budgets.ts:54`, `rules.ts:89` may gain an action |
| 8a | `Sort.dir` (`table.ts:24`) vs `PlaceOptions.dir` | **`Sort.order`** | `table.ts`, `table.test.ts` | 1 (`transactions.ts:12`; `onSort` passes through) |
| 8b | `Table.onSelect` (`table.ts:31`) vs `Action.onSelect` | **`Table.onOpen`**; `Action.onSelect` unchanged | `table.ts` (12 reads), `table.test.ts`, 0042 rows text | 7 in 6 files (`account.ts:39`, `budgets.ts:54`, `connections.ts:186`, `rules.ts:89,93`, `settings.ts:109`, `transactions.ts:59`) |
| 8c | no `Priority`/`Delta` export; `Stat.delta.tone` required (`stat.ts:11`) | **`Priority`, `Delta`, `Kind` exported; every `tone?` optional** | `types.ts`, `stat.ts`, `index.ts` | 14 in 5 files lose `as const` (account 1, budgets 2, import 3 — `:139,161×2`, connections 3, overview 5): `Delta` sites annotate the `computed<Delta \| undefined>`; `import.ts:139` and `connections.ts:146,153,155` annotate with `Action`/`Action[]`, exported since 0034; `settings.ts:25` and `transaction-dialog.ts:69,71,72` are domain consts and stay |

### Decisions the audit left open, and the strongest argument against each

- **`key` scheme: Field → `name`, Table → `rowKey`, Form keeps `key`.**
  `key` in `@nisli/core` and in Form already means identity across renders;
  Field's is the odd one — a property name, which the platform already calls
  `name`. *Against:* `name` collides with app domain properties
  (`{ name: 'name', label: 'Name' }` in `accounts.ts`), and `rowKey` is a
  compound where every other word is simple. Accepted because the collision
  is the app's word beside the engine's, which is the (a-8) `status` case and
  not a defect; and because `rowKey` reads as "`key`, per row" — the same
  meaning qualified, not a new one.
- **`'note'`, not `'muted'` or `'secondary'`.** `muted` is a Part; `secondary`
  is a `Priority`. `note` is WAI-ARIA's word for ancillary content and says
  what the prose is for; it maps to `text.muted` exactly as `muted` did, and
  is not a look renamed because the engine now also emits `role="note"` —
  the word carries meaning to AT, not only to the skin. *Against:* "note" is
  also a domain word in Ledger (a transaction's note); and the panel asked
  whether an unmet need hides behind `muted` (a structural `hint` on
  Section?). Accepted: the Text role is a closed literal on one prop and
  cannot be confused with a `Field` named `note`; and every Ledger `muted`
  site is a free-standing explanatory paragraph under a Section or Dialog,
  which `note` covers — no structural `hint` on Section is needed.
- **The heading role is removed, not fixed.** A free heading has no outline
  level the engine can decide; every heading the engine draws is a
  container's `title` at a level the container knows. Ledger uses it zero
  times. *Against:* an app may want a heading between blocks. If it does,
  that is a Section without a card — a structure question, not a Text role.
- **`priority` stays one word; "filled" is a rule.** The alternative — a
  second axis such as `emphasis` — is a new intent word and a new decision
  dimension, and 0034 already says a primary is the one the person came for.
  *Against:* an author may want two filled buttons or none. The engine's
  answer is per action: two primaries are two filled buttons, none is none;
  it never counts. One primary per row is the convention the skill teaches.
- **`confirm` takes an `action`, not `confirmLabel`.** A subset of `Action`
  with the same words and the same variant rule. *Against:* `confirm` is a
  function, not a block, and a flat option bag reads shorter. Accepted: a
  synonym in one place is the whole disease this record treats.
- **`Dialog.actions` and `Table.empty` as a block land last and are
  droppable.** Both are pure reuse, but both are *slots* and the round's rule
  is no new capability. They are ordered last so the rest of the contract
  can land without them; if the review judges either a capability, it is
  dropped and 0023 stays open. *Against:* leaving `Form({ fields: [] })` in
  Ledger means the migration ships one known wrong-intent site. Accepted as
  the lesser cost.
- **`Field` becomes a discriminated union on `kind`.** It is the only way
  `placeholder` on a `boolean` can be a type error rather than a runtime
  rule. *Against:* a union makes `Field<T>` harder to build generically
  (the `import.ts` mapping fields are computed). Accepted: every Ledger site
  is a literal, and the union has two narrowings — `boolean`: no
  `placeholder`, `min`, `max`, `step`; `file`: no `placeholder`, gains
  `accept` — which is what 0037 already documents in prose.

## Gate and review

The record was proposed, gated (fifteen edits before any code) and reviewed
(six edits after all of it landed). Every edit is a clarification of what was
already decided; none added a word or a capability.

**The gate** (before E1). *Why:* each was a place where the text could be read
two ways, and a rule read two ways is a second meaning. (1, 12) "the filled
button is the primary" is applied *per action* — the renderer never counts,
two primaries are two filled buttons; (2) a "Why now" paragraph, because
the panel had deferred the round on conditions and the record must show they
are met; (3) the confirm answer is `priority: 'primary'` — an engine rule,
so `action` stays `Pick<Action, 'label' | 'destructive'>`; (4) acceptance 5
reworded so the kernel scan is the instrument; (5) the Ledger grep scoped to
the screen files plus `main.ts`, with `grep -a`, because `import.ts` carries
a line grep calls binary and counts 0 silently; (6) the `as const` count is
14, and the fix is "annotate with `Delta`/`Action[]`", not a cast; (7) a
`title` row, since "the only way to say a heading" was a rule with no row;
(8) `note` grounded in WAI-ARIA, `connections.ts:205` sent to
`tone: 'negative'` (an error line is not ancillary prose), and the
`hint`/`note` relation stated as one concept in two hosts; (9) the
`placeholder` rule closed — allowed on every `kind` except `boolean` and
`file`, a type error on both; (10) the Dialog row drawn in the body's flow
after `children` (no sticky footer, no new sheet decision), and `Table.empty`
renders `Empty` *unchanged*, so the nine Ledger string sites change look and
nothing else; (11) the Column fold rule filed under `Priority` as an engine
rule, not a second meaning; (13) the upstream sentences that still say the
old words listed by ADR and section; (14) the red window named — Ledger
resolves the engine from source, so its typecheck is red from E2 to L1 and
the two are integrated together; (15) the counts fixed: eleven renames, five
literals.

**The review** (after E5, S and L1; verdict CHANGES, then applied). The
engine, Ledger and screen proofs were green; no intent was lost in migration
(every dropped checkbox caption became the boolean's `label`, every `empty`
sentence survives as `title` or `{ title, hint }`, the three empty-state
actions added are the sites §7g permits). Six edits, all in what agents are
taught plus one test gap: (1, 2) two ❌ examples in `AGENTS.md`
(`intent-one-word-one-meaning`, `form-capture-derived`) were identical to
their ✅ lines and taught nothing — they now say `header:` and
`kind: 'select'`; (3) the `block-stat` signature said `delta?: { text; tone }`
where the contract exports `Delta { text; tone? }`; (4) `confirm.action`
(singular) was a surface word with no row in the table — the row above is
that edit, here and in the skill; (5) `actions.test.ts` proved "one renderer"
for buttons but not for an action overflowed into the Toolbar menu — the one
destructive-in-toolbar case Ledger ships (`connections.ts`, tertiary +
destructive, in the menu at phone width) — a case now asserts
`menu.item.danger` and `aria-busy` there; (6) `main.ts:18`
`content → children`, the one site outside the screens session's ownership,
which held `pnpm -F ledger typecheck` red until it was made. Two notes needed
no edit: the fieldless Form in `connections.ts` had a Cancel button and the
Dialog closes by ✕/Escape/outside pointer only — consistent with 0023 and the
`Dialog.actions` contract, an affordance change to be aware of; and
`Empty.hint` renders `text.muted` while `Stat.hint`/`Field.hint` render
`text.faint` — a skin rule per host, not a vocabulary question.

## Migration (as done)

Engine phases are commits in order; each leaves the engine green and the
skill's examples typechecking. Ledger is migrated in one phase by the session
that owns `packages/ledger`, in path-scoped commits; nothing in E1–E5 touches
it. The red window is accepted and named: in the workspace Ledger resolves
`@nisli/engine` from source, so `pnpm -F ledger typecheck` goes red at E2 and
stays red until L1 lands; E1–E5 and L1 are integrated together on local main
before any push, and acceptance 1 is read at the end of that integration, not
commit by commit.

**E1 — exports and optionality (no rename).** `types.ts` gains `Kind`,
`Priority`, `Delta`; `Stat.delta.tone` optional; `index.ts` splits into an
intent section and a block-author section (`LayerKind`, `PlaceOptions`,
`fit`, `block`, … move below a comment). Additive; 0.7.x.

**E2 — the datum contract.** `Field.kind?: Kind` with derived capture;
`FieldKind` removed; `Field` discriminated on `kind` (`boolean` loses
`placeholder`); `Column.kind` narrowed from `Kind`; `Field.key → name`;
`Column.header → label`; `Series.name → label`. Tests: `schema.test.ts`,
`draft.test.ts`, `form.test.ts` (rules 4, 6, 8 retitled — "a field with
options", "a long field", "a boolean field"), `table.test.ts`.

**E3 — the Action contract.** New `blocks/actions.ts` (`actionRow()`,
`variantOf`); Toolbar, Empty (`actions`), Form (`actions` replaces
`destructive`), confirm (`{ title, text, action }`) render through it; the
Form discard prompt at `form.ts:153` follows. Tests: `toolbar.test.ts`,
`extras.test.ts`, `form.test.ts`, `overlay.test.ts`. The kernel scan
(`kernel.test.ts`) must see `actions.ts` as a non-block helper, like
`surface.ts`.

**E4 — the remaining words.** `TableProps.key → rowKey`, `onSelect → onOpen`,
`Sort.dir → order`; `Meter.detail → text`; `ColumnsProps.text → format`;
`AppProps.content → children`; `Text.role` `'muted' → 'note'`, `'heading'`
removed. Tests: `table.test.ts`, `layout.test.ts`, `extras.test.ts`.

**E5 — slots (droppable).** `Dialog.actions` (footer, wraps); `Table.empty:
string | EmptyProps` rendered as `Empty`. Tests: `overlay.test.ts`,
`table.test.ts`. Engine → 0.8.0; CHANGELOG lists every rename as a table
(old → new → file).

**S — the skill.** `AGENTS.md` (853 lines) and `SKILL.md` regenerated from
the 0.8.0 types: the `Field`, `Column`, `TableProps`, `FormProps`,
`ConfirmOptions` signatures at `AGENTS.md:191,317`; every example that says
`header:`, `key:` on a field, `kind: 'select'`, `role: 'muted'`,
`destructive: {`, `confirmLabel`, `detail:`, `content:`, `action: {` (84 grep hits across
the two files); a new "Vocabulary" section that *is* the table above; README
§Blocks (Text, Table, Form, Dialog, Empty, confirm) and the Text role line.
Skill version 1.1.0 → 2.0.0.

**L1 — Ledger (done by the Ledger session, path-scoped, on local main).**
Eleven files, 178 sites, 177 insertions / 178 deletions against baseline
`95abbd9`; `screens.proof.test.ts` needed no change; nothing under `data/`
or `server/` touched. The plan said 174 sites; the difference is the
`Dialog.actions` rewrite in `connections.ts` and the `computed<…>` annotations
counted per line.

| file | sites | what |
|---|---|---|
| `account.ts` | 8 | `header→label` 5; `rowKey`, `onOpen`; `as const`→`computed<Delta>`; `empty` → `{ title, actions: [Add transaction] }` |
| `accounts.ts` | 4 | `key→name` 3; drop `'select'` 1 |
| `budgets.ts` | 14 | `key→name` 2; drop `'select'`; `header→label` 4; `rowKey`, `onOpen`; Meter `detail→text`; `destructive→actions`; confirm `text`+`action`; `as const`×2 → `computed<Delta>`; `empty` → `{ title, actions: [Add budget] }` |
| `connections.ts` | 47 | `header→label` 10; `rowKey`×2, `onOpen`; `Empty.action→actions`; Table `empty` → `{ title, actions: [connect] }`; confirm ×2; `role: 'muted'→'note'` ×4; `:205` → `tone: 'negative'`; `:194` `role: 'body'` dropped; `Action`/`computed<Action[]>`/`satisfies Action` (3 `as const` gone); fieldless `Form({ fields: [] })` → `Dialog.actions` (Reconnect/Sync `priority: 'primary'`, Disconnect destructive); `Form` import dropped |
| `import.ts` | 22 | `key→name` 12; drop `'select'` 9; two checkboxes → `kind: 'boolean'` with the caption as `label`; `header→label` 5; `rowKey`; `computed<Action[]>` + `computed<Delta>` (3 `as const` gone) |
| `overview.ts` | 22 | `header→label` 9; `Series.name→label` ×2 via `computed<Series[]>`; Columns `text→format`; Meter `detail→text`; `rowKey`×2; `role: 'muted'→'note'`; 5 `as const` gone via `computed<Delta \| undefined>`/`<Delta>`; recurring `empty` split into `{ title, hint }` |
| `rules.ts` | 17 | `key→name` 4; drop `'select'`; checkbox → `label: 'This is income', kind: 'boolean'`; `header→label` 6; `rowKey`×2, `onOpen`×2; `destructive→actions`; confirm; rules `empty` → `{ title, hint, actions: [Add rule] }` |
| `settings.ts` | 17 | `key→name` 5; drop `'select'` 3; `header→label` 3; `rowKey`, `onOpen`; confirm; `role: 'muted'→'note'` ×3; backups `empty` split into `{ title, hint }` |
| `transaction-dialog.ts` | 13 | `key→name` 7; drop `'select'` 3; drop `'textarea'` (keeps `long: true`); `role: 'muted'→'note'`; `destructive→actions`; confirm. `:69,71,72` `as const` kept (domain consts) |
| `transactions.ts` | 13 | Sort `dir→order` (×2); `key→name` 4; drop `'select'` 2; checkbox → `label: 'Only uncategorized', kind: 'boolean'`; `header→label` 6; `rowKey`, `onOpen` |
| `main.ts` | 1 | `content→children` (review edit 6) |

The order followed inside L1: `key→name` first (it removes the
`kind`/`key`/`label` triple on every field line), then `kind` narrowing, then
`header→label`, then the Action sites, then the Table words. One typecheck
run finds every remaining site; there is no runtime path that survives a
missed one except `role: 'muted'` (a string literal the type rejects) and the
checkbox captions (a type error under the union).

## Consequences

- **Breaking, for one consumer.** `@nisli/engine` is a private 0.x package
  with one app on it. 0.8.0 renames eleven prop words (`Field.key`,
  `Table.key`, `Table.onSelect`, `Sort.dir`, `Column.header`, `Series.name`,
  `Meter.detail`, `confirm.message`, `confirm.confirmLabel`,
  `ColumnsProps.text`, `App.content`), removes five literal values
  (`'select'`, `'textarea'`, `'checkbox'`, `'muted'`, `'heading'`) and one
  type (`FieldKind`), and changes two prop shapes (`Empty.action`,
  `Form.destructive`). No shim, no deprecation period: a
  deprecated synonym is a second word for the same thing, which is the defect.
- **What agents unlearn.** That `kind: 'select'` is how a choice is asked
  for (it is `options`); that `placeholder` names a checkbox; that
  `destructive` can hold an action; that `priority: 'primary'` on an Empty
  action does nothing; that a Table `onSelect` selects; that `'muted'` is
  something an app may say; that `as const` is part of writing a Stat.
- **What the engine gains.** One action renderer where there were five;
  five fewer `f.kind ===` branches; a `Field` type that rejects the wrong
  string at the wrong kind; an `index.ts` whose first thirty lines are the
  whole intent vocabulary.
- **What stays the engine's.** Every decision this record moves out of the
  vocabulary lands as a rule: segmented-vs-list, the filled button, danger
  apart from the others, a boolean's label beside the box, mutedness from
  structure. None of them is new; each was already made — inconsistently.
- **0042 §(d) is amended**: the checkbox rule "the engine renders
  `placeholder` as the caption label" becomes "a boolean field's `label` is
  the `<label for>` beside the box; the accessible name is the label alone".
  The `LABEL_MISSING` claim is unchanged.
- **0037's table is amended**: Field's `key` → `name`, Option is "a choice
  of a field with `options`", Long is the only way to say multi-line.
- **Upstream text that still says the old words**, to be amended by
  reference to this record (each is a sentence, not a decision): 0034
  §The contract lists `role: 'body' | 'muted' | 'heading' | 'code'` and
  `kind: 'text' | 'number' | 'money' | 'date'` verbatim → the `role` union
  is `'body' | 'note' | 'code'`, `kind` is `Kind`; 0037 rule 4 ("Intent stays
  `kind: 'select'`") and its Option row ("a choice of a `select` field") →
  a choice is `options` on any kind; 0037 §Long-term plan item 1 (an
  Actions block) → resolved by `actionRow()`; 0040's ubiquitous-language
  row named **Kind** → renamed **Layer kind**, so `Kind` has one meaning in
  the language (a datum's kind).
- **Issue 0023** is resolved by E5 as its option 1; option 2 (a
  standalone `Actions` block) is not needed — `actionRow()` is internal and
  every placement is a block that already exists.

## Acceptance

1. **Typecheck.** `pnpm -F @nisli/engine typecheck` green after E5;
   `pnpm -F ledger typecheck` green after L1 with the engine at 0.8.0.
2. **The old words are gone.** Over `packages/engine/src/index.ts`,
   `blocks/types.ts`, `blocks/form/schema.ts`, every exported prop
   interface, the README and both skill files, this returns nothing:
   `grep -anE "header:|confirmLabel|\bdetail:|\bmessage:|content:|kind: '(select|textarea|checkbox)'|role: '(muted|heading)'|FieldKind|destructive: \{|action: \{|\bdir: '(asc|desc)'" …`;
   over Ledger the same pattern minus `\bdetail:|\bmessage:` (domain and
   claim words in `data/bank.ts`, `store.test.ts`, `bank.test.ts`,
   `screens.proof.test.ts`) is run on `packages/ledger/src/screens/*.ts`
   excluding `screens.proof.test.ts`, plus `main.ts` — with `grep -a`,
   because `import.ts` carries a line long enough for grep to call it
   binary and count 0 silently; and, on those files, `grep -ac "as const"`
   sums to the domain-const count (4: `settings.ts:25`,
   `transaction-dialog.ts:69,71,72`), and `grep -ac "fields: \[\]"` is 0
   if E5 landed.
3. **The skill is regenerated** from the 0.8.0 types: its signatures for
   `Field`, `Column`, `TableProps`, `FormProps`, `EmptyProps`, `DialogProps`,
   `confirm` match `index.ts` verbatim, and every example typechecks against
   the package (the skill's own gate).
4. **Screens still prove.** `screens.proof.test.ts` green at every width it
   proves today with no claim removed; `LABEL_MISSING` still passes on every
   boolean field (the name is now the label alone); `FIT_ROW` still fires at
   the Toolbar width 0042 proves.
5. **Every Action row is one renderer.** `kernel.test.ts`'s scan finds
   `button.danger` nowhere outside `blocks/actions.ts`, and `button.primary`
   only there and in Form's segmented option (a chosen option, not an
   action); `button.plain` on non-action controls (the App menu toggle, the
   kernel's Retry, the Toolbar's More, the Table's Show-more and sort
   button) is unchanged. Form's submit and Cancel go through
   `blocks/actions.ts`.
6. **A person on the phone** opens the transaction filters and Rules: the
   "Only uncategorized" and "This is income" boxes have one label each, and
   tapping it toggles the box.

### Acceptance as read

Read on 2026-08-30 at the end of the E1–E5 + S + L1 integration on local
main, after the review edits.

1. **Typecheck.** `pnpm -F @nisli/engine typecheck` and
   `pnpm -F @nisli/ledger typecheck` both clean; engine tests 20 files /
   235 tests, Ledger 9 files / 115 tests, green.
2. **The old words are gone — the grep proof.** The pattern in item 2 was
   run as written and then tightened, because two of its terms match the
   *new* surface: `action: \{` is now the confirm answer (six Ledger sites,
   `form.ts:154`), and `\bdetail:` is the kernel's `LayoutReport.detail`
   (`kernel.ts:89,176`, `form.ts:122`, `grid.ts:25`, `toolbar.ts:57`,
   `table.ts:108`) — Proof vocabulary, never intent. With those two removed:

   ```
   grep -anE "header:|confirmLabel|\bmessage:|content:|kind: '(select|textarea|checkbox)'|role: '(muted|heading)'|FieldKind|destructive: \{|\bdir: '(asc|desc)'"
   ```

   over `packages/engine/src/index.ts`, `blocks/types.ts`,
   `blocks/form/schema.ts`, every `blocks/*.ts` (tests excluded), the engine
   README and `SKILL.md` returns two lines, both `SKILL.md` prose naming the
   forbidden words as forbidden (`intent-one-word-one-meaning`, "Writing the
   old words"); over `AGENTS.md` it returns the ❌ examples of two rules
   (lines 70–73, 384–386) and the "old words" reminder at 926 — each a
   teaching of what not to write, none a signature. Over
   `packages/ledger/src/screens/*.ts` (excluding `screens.proof.test.ts`)
   plus `main.ts` it returns nothing. `grep -ac "as const"` over the same
   Ledger files sums to 4 (`settings.ts` 1, `transaction-dialog.ts` 3 — the
   domain consts); `grep -ac "fields: \[\]"` is 0. `index.ts` exports `Kind`,
   `Priority`, `Delta`, `DatumField`, `BooleanField`, `FileField` and no
   `FieldKind`; `types.ts` carries `Kind`, `Priority`, `Action`, `Tone`,
   `Delta` exactly as the table says.
3. **The skill is regenerated** — 2.0.0, three new rules
   (`intent-one-word-one-meaning`, `form-capture-derived`,
   `decide-one-action-rule`), signatures on the new words; review edits 1–4
   applied.
4. **Screens still prove** — every claim holds at the five widths with no
   claim removed; `LABEL_MISSING` passes on every boolean field.
5. **Every Action row is one renderer** — `kernel.test.ts` carries the scan;
   `actions.test.ts` covers Toolbar, Empty, Form, Dialog and confirm for
   filled / plain / danger and busy, and (review edit 5) a destructive
   tertiary overflowed into the Toolbar menu.
6. **A person on the phone** — "Only uncategorized" and "This is income" are
   one `<label for>` each.

## Non-goals

- **Parts named by look** (`bar`, `danger`, `muted`, `notice` in `skin.ts`).
  A Part is the skin's word and a skin is where a look is said; renaming
  Parts is a 0035 question and would break every skin for no intent gain.
- **`Grid` and `Columns` as block names.** The audit flagged them as layout
  words; they are block *names* (what the thing is), not prop words, and
  0038's long-term plan freezes the block list at fifteen.
- **The app's own `status` columns.** Noted; the app's to rename.
- **Async validation, density/input axes, a second skin.** Deferred by 0037,
  0034 and 0038 respectively; unchanged here.
- **Any new intent word.** `emphasis`, `control`, `input`, `widget`,
  `variant` were each considered and each is a look or a how.
- **A deprecation shim.** See Consequences.

## Long-term plan

1. **The vocabulary is frozen at this table** until a second consumer exists;
   a new word needs an ADR that adds a row here.
2. **The skill's vocabulary section becomes the generated source** — the
   table above emitted from `index.ts` types by a script alongside
   `calibrate-glyphs.mjs`, so the skill cannot drift from the surface.
3. **A claim for the vocabulary**: `prove()` cannot see words, but the
   kernel scan can — acceptance item 5 becomes a permanent scan rule.
