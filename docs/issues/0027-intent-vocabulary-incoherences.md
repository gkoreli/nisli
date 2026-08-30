# 0027 — The intent vocabulary says one word for several meanings and several words for one meaning

**Status**: resolved (2026-08-30) by [ADR 0043](../adr/0043-engine-intent-vocabulary-contract.md) — option 1: eleven prop words renamed, five literals and `FieldKind` removed, one `Action` renderer, `Field` a union on `kind`; Ledger migrated (eleven files, 178 sites), skill 2.0.0; the grep proof and typechecks are in 0043 §Acceptance as read
**Priority**: P1
**Area**: `@nisli/engine` — the public intent surface: `src/index.ts`, `blocks/types.ts`, `blocks/form/schema.ts`, every exported prop interface in `blocks/*.ts`; the consumer `packages/ledger/src/screens/*.ts`
**Found**: 2026-08-30, by the ubiquitous-language audit
([research](../research/engine/intent-vocabulary-audit-2026-08-30.md)),
deferred by the next-round panel
([research](../research/engine/next-round-panel-2026-08-30.md) §Deferred),
re-verified against `main @ 351b2b5` (engine 0.7.0) while filing this issue.
Line numbers below are from that tree. Ledger counts are over the ten screen
files plus `main.ts`; `screens.proof.test.ts` is excluded.

## Summary

ADR 0034 draws one line: app code says *what*, the engine decides *how*, and
the words an app may use are a closed, typed vocabulary. The vocabulary is
small and mostly honest, but it is not one language. Five words carry two or
three meanings each (`key`, `kind`, `destructive`, `onSelect`, `dir`); four
concepts are each spelled several ways (the name of a thing, a string the app
formatted, a formatter, an empty state); two *how* words sit inside intent
(`'textarea'`, `role: 'muted'`); and the one type that appears in five blocks
— `Action` — is honoured differently by each. Nothing here is a missing
feature. Every finding is the engine accepting a word and either ignoring it
or meaning something else by it, and the tell is in the consumer: Ledger
writes `'primary' as const` thirteen times because there is no exported type
to annotate against, and `destructive: { …, destructive: true }` in four
files because the same word is nested with two types.

0042 (reachability) fixed the one finding that was a behaviour (the Toolbar
let a primary overflow) and explicitly kept its hands off the words ("no new
prop"). This issue is the words.

## Findings

### A. One word, several meanings

**(a) `key` — three types under one word.**
[`blocks/form/schema.ts:11`](../../packages/engine/src/blocks/form/schema.ts)
`Field.key: keyof T & string` is *the property a field edits* (it is written
to the control's HTML `name`, `form.ts:169`);
[`blocks/table.ts:30`](../../packages/engine/src/blocks/table.ts)
`TableProps.key: (row) => string` is *row identity for `each()`*;
[`blocks/form.ts:30`](../../packages/engine/src/blocks/form.ts)
`FormProps.key?: string | number` is *draft identity; a change resets to
`initial`*. `budgets.ts:26,54,62` has all three inside forty lines. Ledger:
36 Field sites in 7 files, 11 Table sites in 8 files, 6 Form sites.

**(b) `kind` — a datum on Column, a datum-or-widget on Field, a layer policy
on `LayerKind`.** `table.ts:16` `Column.kind: 'text'|'number'|'money'|'date'`
says what a cell holds. `schema.ts:6` `FieldKind` adds `'select' | 'textarea'
| 'checkbox' | 'file'` — capture widgets, i.e. *how*. `'textarea'` already has
an intent spelling: `long: true` (`schema.ts:58` `spansRow` treats them as
one; Ledger's one `'textarea'` site, `transaction-dialog.ts:57`, also says
`long: true`). `'select'` is not even a widget in practice: two or three
options render a `radiogroup` (`form.ts:184`, `SEGMENTED_MAX`). Ledger
compounds it — `{ key: 'kind', label: 'Type', kind: 'select' }`
(`accounts.ts:19`) is three `kind`s on one line. `index.ts:37` exports
`LayerKind` (a Decision type, 0040's "Kind") from the same index as the
intent. Ledger: 20 `'select'`, 1 `'textarea'`, 4 `'checkbox'` sites; 0
imports of `LayerKind`/`PlaceOptions`.

**(c) `destructive` — a boolean on Action and confirm, an `Action` on Form.**
[`blocks/types.ts:14`](../../packages/engine/src/blocks/types.ts)
`Action.destructive?: boolean`; `confirm.ts:10` `destructive?: boolean`;
`form.ts:36` `FormProps.destructive?: Action`. The Form prop is really "an
extra action placed apart from Save/Cancel": the engine always renders it
`button.danger` (`form.ts:364`) and ignores the nested `priority` and
`destructive`. Ledger writes `destructive: { id: 'delete', …, destructive:
true }` in `budgets.ts:65`, `rules.ts:111`, `connections.ts:221`,
`transaction-dialog.ts:92` — the flag is dead, and an agent cannot know it.

**(d) `onSelect` — activate on Action, open a row on Table.**
`types.ts:16` follows WAI-ARIA menu vocabulary (an item is selected).
`table.ts:31` `TableProps.onSelect` is "open this row" in all seven Ledger
uses (each opens a dialog). 0042 deepened it — the row is a tab stop named
by `aria-labelledby`, Enter/Space "select" it — but the row has no
`aria-selected` state: it is an *open* event under a *selection* word.
Ledger: `account.ts:39`, `budgets.ts:54`, `connections.ts:186`,
`rules.ts:89,93`, `settings.ts:109`, `transactions.ts:59`.

**(e) `dir` — sort direction on `Sort`, writing direction on `PlaceOptions`.**
`table.ts:24` `Sort.dir: 'asc'|'desc'`; `engine/overlay.ts` `PlaceOptions.dir:
'ltr'|'rtl'`; both exported from `index.ts` (lines 17 and 37). Ledger:
`transactions.ts:12`.

**(f) `placeholder` — ghost text on an input, the empty choice on a select,
the caption beside a checkbox.** `schema.ts:16`; `form.ts:213` renders
`f.placeholder` as the checkbox's `<label for>`. A checkbox has no
placeholder; the engine repurposes the word, and 0042 §(d) recorded the
repurposing as the rule rather than change a word. The two strings on a
boolean field ("Filed" / "Only uncategorized", `transactions.ts:20`) are one
question spelled twice. Ledger: `transactions.ts:20`, `import.ts:74-75`,
`rules.ts:47`.

### B. One meaning, several words

**(g) The human name of an item.** `label` on Stat, Meter, Field, Option,
BarItem, NavItem, Link and Action; but `Column.header` (`table.ts:13`) and
`Series.name` (`columns.ts:8`). Ledger: 48 `header:` sites in 8 files, 2
`name:` sites (`overview.ts:47-48`).

**(h) A string the app formatted.** `text` on Text, `Stat.delta`, `BarItem`
and `notify()`; but `Meter.detail` (`meter.ts:10`, "€420 of €500") and
`ConfirmOptions.message` (`confirm.ts:8`). Ledger: `budgets.ts:53`,
`overview.ts:95`; the six `confirm` sites.

**(i) A formatter.** `ColumnsProps.text: (value: number) => string`
(`columns.ts:18`) — the same word as (h) for a function. Ledger:
`overview.ts:88`.

**(j) The children of a container.** `children: Children` on Page, Section,
Grid, Dialog; `AppProps.content: Content` (`app.ts:17`). Ledger:
`main.ts:18`.

**(k) An empty state.** `TableProps.empty?: string` (`table.ts:35`) renders a
muted `<div>` (`table.ts:195-197`); the `Empty` block renders a title, hint
and action. Two spellings of "there is nothing here". Ledger: 9 string
sites; `connections.ts:182` mounts `Empty` beside a Table for the same case.

### C. *How* words inside intent

**(l) `Text.role: 'muted'`.** `text.ts:9` offers `'body' | 'muted' |
'heading' | 'code'`; `'muted'` maps 1:1 to the Part `text.muted` — a look, in
the one prop 0034 reserved for "what the text is". Ledger: 9 sites in 4
files. `'heading'` renders a `<span>` (`text.ts:22`) with no outline level;
Ledger uses it 0 times. The README no longer lists Text roles (verified),
but the skill still teaches `role` as "what a run of text is"
(`AGENTS.md:19`).

**(m) `kind: 'textarea'`, `'select'`, `'checkbox'`.** See (b). Widgets, not
data.

### D. `Action` is not honoured the same way twice

**(n)** `Toolbar` honours `priority` (survival, and `primary` → the filled
button via `variantOf`, `toolbar.ts:18`) and `destructive`; 0042 made a
primary un-overflowable (`toolbar.ts:53`). `Empty.action` (`empty.ts:9`,
singular) always renders `button.primary` and ignores both fields
(`empty.ts:23-26`). `Form.destructive` ignores both (`form.ts:364`).
`confirm` takes `confirmLabel` + `destructive` — an Action with a synonym
for `label`. `Dialog` has no action row at all
([issue 0023](./0023-actions-block-for-dialogs.md)); `connections.ts:208`
mounts `Form({ fields: [] })` to fake one. Five blocks render an Action;
there is no shared rule and no shared renderer.

### E. Missing exports that force the consumer to lie

**(o)** No exported `Priority` or `Delta` type, and `Stat.delta.tone` is
required while `Text.tone` and `Series.tone` are optional. Ledger writes
`as const` at 13 vocabulary sites (`account.ts:34`, `budgets.ts:49-50`,
`import.ts:139,161`, `connections.ts:146,153,155`, `overview.ts:24,47,48,82,85`)
to satisfy literal types it cannot name. (`settings.ts:25` and
`transaction-dialog.ts:69-72` are domain consts and are not this finding.)

### Not a finding

`Status` (the async-result prop), the kernel's `status:` spec and the
`role="status"` notice region share a word across three bounded contexts
(Intent, Blocks, DOM). Ledger's own `status` columns (`import.ts:15,110`,
`connections.ts:135`) collide with the intent word on screen, but that is the
app's naming to fix; no engine change. Mutedness derived from structure —
the Stat delta, the Table fold line, the Empty and Form hints — is the
engine's decision and is correctly never said by the app.

## Why it matters

1. **An agent learns the vocabulary from the types.** Every collision above
   is a place where the type accepts a word and the engine either ignores it
   (`Empty.action.priority`, `Form.destructive.destructive`) or means
   something else by it (`Table.onSelect`, checkbox `placeholder`). The
   skill cannot teach "`priority` is survival order" while three blocks
   disagree.
2. **The consumer is already compensating.** Thirteen `as const`, four
   redundant `destructive: true`, one fieldless Form, two strings for one
   checkbox question. Each is a line an agent has to be taught to write and
   a reviewer has to know to accept.
3. **The proof cannot see it.** `prove()` checks the DOM. A word that means
   the wrong thing produces a correct DOM and an incorrect model in the
   author's head; no claim goes red.
4. **It only gets more expensive.** Every new screen adds sites. 0037's
   long-term plan and 0041's deferred the contract until Ledger's screens
   were not under concurrent edit and until 0023 had forced `Action` into a
   fourth block; both conditions now hold.

## Options

1. **One contract, one round** — decide each term once
   (term → meaning → the interfaces it applies to), rename in the engine,
   migrate the eleven Ledger files, regenerate the skill, and prove the old
   words are gone by grep and typecheck. No new capability: every change is a
   word, a subset, or a slot the engine already renders. This is
   [ADR 0043](../adr/0043-engine-intent-vocabulary-contract.md).
2. Document the collisions in the skill and leave the types. Not an option:
   the skill would then teach that `kind` means two things and that
   `placeholder` on a boolean is a caption.
3. Rename piecemeal as screens are touched. Not an option: the whole point of
   a ubiquitous language is that it is decided once, and a half-migrated
   vocabulary is worse than either end.

## Notes

- The audit's families B–F (several spellings, layout words, Parts named by
  look, Decision exports) were truncated in transit; (g)–(o) above re-derive
  them from the 0.7.0 tree. Parts named by look (`bar`, `danger`, `muted`)
  are the *skin's* vocabulary, not intent, and are out of scope here — a
  Part may be named by look because a skin is the one place a look is said.
- Related: [0023](./0023-actions-block-for-dialogs.md) (Dialog action row)
  is the fourth placement that decides what `Action` must mean; 0043 resolves
  it as pure reuse if its last phase lands.
