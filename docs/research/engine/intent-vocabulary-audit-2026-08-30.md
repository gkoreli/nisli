# Ubiquitous-language audit — the `@nisli/engine` public intent surface

**Date**: 2026-08-30 · **Status**: findings only — **no rename has landed** ·
**Owner**: engine round "Proof domain" (ADR
[0041](../../adr/0041-engine-proof-domain.md)) · **Scope**:
`packages/engine/src/index.ts` exports, every exported block prop type,
`blocks/types.ts`, `blocks/form/schema.ts`, the `Part` vocabulary in `skin.ts`
· **Method**: read only; no code changed · **Yardstick**: ADR
[0034](../../adr/0034-engine-typed-blocks-decided-by-an-engine.md)'s
ubiquitous language (Block, Intent, Decision, Part, Status, Report, Proof) and
its contract that app code says *what*, never *how*.

## Status header

- **What this is**: a list of places where the intent vocabulary collides,
  spells one concept several ways, or lets a *how* word in. Each finding names
  the file and line, the proposed term, and the Ledger files that would move.
- **Why nothing landed**: every rename touches `packages/ledger/src/screens`,
  and a second session was editing Ledger concurrently during this round. The
  rule for the round was "never modify an existing Ledger file", so the
  vocabulary contract is deferred to a later round (see
  [`next-round-panel-2026-08-30.md`](./next-round-panel-2026-08-30.md), where
  it was also deferred with reasons, and 0041 §Long-term plan).
- **Proposed contract** (the one-paragraph version): `priority` = survival
  order only; `kind` = what a value *is* (`text | number | money | date |
  boolean | file`) on Column and Field alike, capture derived from `options` /
  `long` / `boolean`; `destructive` = a boolean on an Action and nothing else
  (Form takes `actions`); Field `key` → `name`, Table `key` → `rowKey`, Table
  `onSelect` → `onOpen`; `Sort.dir` → `order`; a boolean field shows its
  `label` beside the box (no `placeholder`); `LayerKind`, `PlaceOptions` and
  other Decision-internal types leave the intent index.
- **Migration list** (Ledger files, union of all findings):
  `accounts.ts`, `account.ts`, `overview.ts`, `transactions.ts`,
  `budgets.ts`, `import.ts`, `rules.ts`, `connections.ts`, `settings.ts`,
  `transaction-dialog.ts`, and `main.ts` where `LayerKind`/`PlaceOptions`
  imports exist. Suggested order: Field `key`→`name` first (removes the
  `kind`/`key`/`label` triple on every field line), then `kind` narrowing,
  then Form `actions`, then Table renames.
- **Carried into this record**: the summary and findings A1–A8 verbatim from
  the audit as it was returned. The audit's later families (B: one concept
  spelled several ways — the human-readable name of a thing, the formatted
  reading of a number, secondary text, a thing a person activates; C:
  layout/widget words inside intent — `Grid`, `Columns`, `kind: 'textarea'`;
  D: Parts named by look — `bar`, `danger`, `muted`, `notice`; F1: Decision
  types exported from the intent index) were truncated in transit and are
  summarised only in the paragraph below. They must be re-derived before the
  rename round; the method and yardstick are the same.

## Summary

The vocabulary is small and mostly honest, but an agent authoring against it
trips on **five word-collisions** (`priority`, `kind`, `key`, `onSelect`,
`destructive`), **four concepts each spelled several ways** (the
human-readable name of a thing; the formatted reading of a number; secondary
text; a thing a person activates), **three layout/widget words inside intent**
(`Grid`, `Columns`, `kind: 'textarea'`), and **a Part vocabulary whose
families are named by look (`bar`, `danger`, `muted`, `notice`) rather than by
the block or intent word they dress**. The strongest evidence that something
is missing is in Ledger itself: `'primary' as const` and `'positive' as const`
appear 14 times across the screens because there is no exported
`Priority`/`Delta` type to annotate against, and `destructive: { …,
destructive: true }` appears in four files — the same word, nested, with two
types.

Findings are ranked by how often an agent would meet them, then by migration
cost. "Ledger files" lists every file under `packages/ledger/src/screens`
(plus `main.ts` where relevant) that would change. Screens are being edited
concurrently; nothing here was touched.

---

## A. Same word, different meanings

### A1. `destructive` is a boolean on Action and confirm, and an *Action* on Form — **HIGH**

- **Where**: `blocks/types.ts:14` (`destructive?: boolean`), `blocks/confirm.ts:10` (`destructive?: boolean`), `blocks/form.ts:36` (`destructive?: Action`).
- **Why incoherent**: the same prop name carries two types. The Form prop is really "an extra action placed apart from Save/Cancel"; the engine then *ignores* the nested `Action.destructive` and `Action.priority` and always renders `button.danger` (`form.ts:329-336`). Ledger writes `destructive: { id: 'delete', …, destructive: true, … }` in four files — the flag is redundant but an agent cannot know that.
- **Proposed term**: Form gains `actions?: readonly Action[]` (same shape as Page/Toolbar/Empty); the engine places a destructive one leading, others trailing, and `Action.destructive` is the single source of the danger look. `destructive` then means one thing everywhere: a boolean on an Action.
- **Ledger files**: `budgets.ts`, `rules.ts`, `connections.ts`, `transaction-dialog.ts`.

### A2. `priority` is survival order on Column but survival *and* emphasis on Action — **HIGH**

- **Where**: `blocks/types.ts:12` vs `blocks/table.ts:18`; `blocks/toolbar.ts:18` (`variantOf`: `priority === 'primary'` → `button.primary`); `blocks/empty.ts:25` (always `button.primary`, priority ignored); `blocks/form.ts:329` (priority ignored).
- **Why incoherent**: on a Column, `primary` means "never leaves, is the stack target". On a Toolbar Action it also means "the filled button". On Empty and Form the field is accepted by the type and silently ignored. ADR 0034 defines priority as *survival order* only. The README's "destructive … never as primary" shows the two axes already fighting inside one word.
- **Proposed term**: keep `priority` = survival only, everywhere it is accepted. The emphasis decision becomes an engine rule derived from structure (the highest-priority non-destructive action in a row is the filled one — GNOME's "one suggested button per view" rule from the north star, now checkable). Blocks that take one Action (`Empty.action`) document that priority is meaningless there or take `Pick<Action, 'id'|'label'|'onSelect'>`.
- **Ledger files**: none for the rename (word unchanged); `connections.ts:161` (a tertiary destructive Page action) is the case whose look would change — verify only.

### A3. `kind` means "what a value holds" on Column, "value type + widget" on Field, and "layer policy" on LayerKind — **HIGH**

- **Where**: `blocks/table.ts:16` (`'text'|'number'|'money'|'date'`), `blocks/form/schema.ts:6` (`FieldKind` adds `'select'|'textarea'|'file'|'checkbox'`), `engine/overlay.ts` via `index.ts:36` (`LayerKind`), and internally `form.ts:65` (`Item.kind: 'field'|'group'`).
- **Why incoherent**: `Column.kind` is a data type; `Field.kind` mixes data types (`money`, `date`) with capture widgets (`textarea`, `select`, `checkbox`, `file`). `'textarea'` is a *widget*, i.e. a how; the same intent already exists as `long: true` (`schema.ts:33`, `spansRow` at `:58` treats them as one). `'select'` is not even a widget in practice — ≤3 options render a radiogroup. Ledger compounds it: `{ key: 'kind', label: 'Type', kind: 'select' }` (`accounts.ts:19`, `transaction-dialog.ts:48`) and `AccountKind`/`Draft.kind` — three `kind`s on one line.
- **Proposed term**: `kind` = **what the value is**, on both Column and Field: `'text' | 'number' | 'money' | 'date' | 'boolean' | 'file'`. How it is captured is derived: `options` present → a choice (segmented or list, the engine's call); `long: true` → multi-line; `boolean` → a checkbox. `'select'`, `'textarea'`, `'checkbox'` leave the vocabulary. `LayerKind` is not intent and should not be exported from the intent index (see F1).
- **Ledger files**: `accounts.ts`, `transactions.ts`, `budgets.ts`, `import.ts`, `rules.ts`, `settings.ts`, `transaction-dialog.ts` (every `kind: 'select'|'checkbox'|'textarea'` literal).

### A4. `key` is a row-identity function on Table, a reset token on Form, and a property name on Field — **MEDIUM**

- **Where**: `blocks/table.ts:30` (`key: (row) => string`), `blocks/form.ts:30` (`key?: string | number`), `blocks/form/schema.ts:11` (`key: keyof T & string`).
- **Why incoherent**: three types under one word inside one screen (`budgets.ts:26,54,62` has all three within 40 lines). Field's `key` is written to the control's HTML `name` attribute (`form.ts:166`), so the platform already has the word.
- **Proposed term**: Field `key` → `name` (HTML's word, and `keyof T` still types it); Form `key` stays (a reset identity is a well-known idiom); Table `key` → `rowKey` so the identity function is not confused with a Form key when both sit in one screen.
- **Ledger files**: Field rename — `accounts.ts`, `transactions.ts`, `budgets.ts`, `import.ts`, `rules.ts`, `settings.ts`, `transaction-dialog.ts`; Table rename — `overview.ts`, `account.ts`, `transactions.ts`, `budgets.ts`, `import.ts`, `rules.ts`, `connections.ts`, `settings.ts`. (High cost; do Field→`name` first, it is the one that also removes a `kind`/`key`/`label` triple on every field line.)

### A5. `onSelect` is "activated" on Action and "a row was chosen" on Table — **MEDIUM**

- **Where**: `blocks/types.ts:16` vs `blocks/table.ts:31`.
- **Why incoherent**: `Action.onSelect` follows WAI-ARIA menu vocabulary (an item is *selected*); `Table.onSelect` is "open this row" in every Ledger use (it opens a dialog). A generic agent will expect Table selection to be multi-select state, not an open event.
- **Proposed term**: Table `onSelect` → `onOpen` (what Ledger means by it); Action keeps `onSelect`.
- **Ledger files**: `account.ts`, `transactions.ts`, `budgets.ts`, `rules.ts`, `connections.ts`, `settings.ts`.

### A6. `placeholder` is ghost text on inputs and the *label beside the box* on checkboxes — **MEDIUM**

- **Where**: `blocks/form/schema.ts:16`; `blocks/form.ts:206` (`f.placeholder ?? ''` rendered as the checkbox's text); Ledger `transactions.ts:20`, `import.ts:74-75`, `rules.ts:47`.
- **Why incoherent**: a checkbox has no placeholder; the engine repurposes the word. An agent writing `placeholder` on a boolean field expects nothing to show.
- **Proposed term**: `label` is the question ("Filed") and is rendered beside the box; the second string is dropped. (`text` and `hint` were considered and rejected — both already carry other meanings.)
- **Ledger files**: `transactions.ts`, `import.ts`, `rules.ts`.

### A7. `dir` is a sort direction on `Sort` and a writing direction on `PlaceOptions` — **LOW**

- **Where**: `blocks/table.ts:24` (`'asc'|'desc'`), `engine/overlay.ts` `PlaceOptions.dir` (`'ltr'|'rtl'`), both exported from `index.ts:17,36`.
- **Proposed term**: `Sort.dir` → `order: 'asc' | 'desc'`; `PlaceOptions` leaves the intent index (F1).
- **Ledger files**: `transactions.ts` (only screen that builds a `Sort`).

### A8. `status` is an async result on blocks and a domain column in the app — **LOW**

- **Where**: `blocks/status.ts:10` (`Status`), `blocks/page.ts:11` etc.; Ledger `import.ts:15,110` and `connections.ts:141` use `status` as a domain column/field name.
- **Why incoherent**: the block word and the app word share a screen; a reader of `status: …` inside a Table's props cannot tell which without the type.
- **Proposed term**: leave the block word (it is 0034's ubiquitous term); the collision is the app's to avoid by naming its column `state` or `outcome`. No engine change.
- **Ledger files**: `import.ts`, `connections.ts` (optional, app-side).

## B–F. Not carried (see status header)

Families B (several spellings per concept), C (`Grid`, `Columns`,
`kind: 'textarea'` — layout and widget words inside intent), D (Parts named
by look), and F1 (`LayerKind`, `PlaceOptions` and other Decision-internal
types exported from `index.ts`) were part of the audit as run but their text
did not survive into this record. Their headline findings are in the Summary;
their per-line evidence has to be re-read from the same files before the
rename round. Nothing in A1–A8 depends on them.
