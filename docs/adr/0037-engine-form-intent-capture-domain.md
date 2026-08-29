# 0037. `Form` — The Intent-Capture Domain

**Date**: 2026-08-29
**Status**: Accepted
**Depends on**: [0034-engine-typed-blocks-decided-by-an-engine](./0034-engine-typed-blocks-decided-by-an-engine.md), [0035-engine-appearance-layer](./0035-engine-appearance-layer.md)
**Resolves**: [issue 0022 — `Form` has no conditional fields and cannot reset a file input](../issues/0022-form-conditional-fields-and-reset.md)
**Code**: [`packages/engine/src/blocks/form.ts`](../../packages/engine/src/blocks/form.ts), [`form/schema.ts`](../../packages/engine/src/blocks/form/schema.ts), [`form/draft.ts`](../../packages/engine/src/blocks/form/draft.ts); tests [`form.test.ts`](../../packages/engine/src/blocks/form.test.ts), [`form/schema.test.ts`](../../packages/engine/src/blocks/form/schema.test.ts), [`form/draft.test.ts`](../../packages/engine/src/blocks/form/draft.test.ts)

## Context

0034 named `Form` as one of fifteen blocks and gave it one decision rule
("columns from width … a textarea spans all"). Everything else about a form —
which fields apply, when a rule is checked, how a choice is offered, who owns
the draft — was left to app code. Ledger's screens showed what that costs. The
old `Form` was exposed three ways:

1. **Presence as prose.** The CSV import mapping
   (`packages/ledger/src/screens/import.ts`) offers one signed amount column
   *or* separate money-out / money-in columns. With no way to say when a field
   exists, the rule lived in hint text ("One signed column / Or separate …") and
   was validated after the fact. Issue 0022, item 1.
2. **Reset as remount.** A file input cannot take a `value`, so after an import
   the screen bumped a key inside the `Page` `children` computed to rebuild the
   whole step list — imperative choreography of exactly the kind the engine
   exists to delete. Issue 0022, item 2.
3. **Draft ownership as boilerplate.** Every dialog form — transactions,
   budgets, rules, accounts — kept its own `draft` signal, reseeded it by hand
   on open (`transaction-dialog.ts` used a `computed(...).value` +
   `reseed.subscribe` pair), and wired `onChange: (v) => { draft.value = v }`
   back into it. A form whose draft did not yet exist cast
   `Signal<T | undefined>` to `Signal<T>`.

Ledger's tenet 12, *Intent is captured visually*
([`packages/ledger/TENETS.md`](../../packages/ledger/TENETS.md)): "Every intent
has a visual control and a visible result; text fields exist for data (a payee,
a note, an amount), not for instructions." A rule an author has to state as
hint text is an instruction to the user, not a control; a rule the engine
enforces is a control. Forms are where agents author most UI, so this is where
the 0034 contract — intent in, decisions out — is tested hardest.

## The domain model

`Form` is now a small domain of its own inside the 0034 Intent → Decision →
Appearance split. Three sub-contexts, three files:

| sub-context | responsibility | file | 0034 context |
|---|---|---|---|
| **Schema** | The closed vocabulary of a field and the pure rules over it: `visibleFields`, `optionsOf`, `isReadOnly`, `validateField`, `stepOf`, `spansRow`, `isEmpty`. No signals, no DOM. | `blocks/form/schema.ts` | Intent (+ pure Decision) |
| **Draft lifecycle** | The engine's ownership of a form's state over signals: `createDraft` → `draft`, `visible`, `errors`, `touched`, `dirty`, `generation`, `set`, `blur`, `submit`, `commit`, `reset`. No DOM. | `blocks/form/draft.ts` | Decision |
| **Rendering** | Controls per kind, the grid and groups from `metrics` and `columnsFor`, announcement, buttons, `look()` for every visual. | `blocks/form.ts` | Decision → Appearance |

Dependency direction is Schema ← Draft ← Rendering; the test files mirror it.
`Form<T>()` is a thin wrapper that selects the draft mode
(`owned = !('value' in props)`) and hands a `FormHandle` to `ref`.

### Ubiquitous language (additions to the 0034 table)

| term | meaning | where it lives |
|---|---|---|
| **Field** | One intent-typed entry of a schema: `key`, `label`, `kind`, and optional meaning (`required`, `when`, `options`, `readOnly`, `validate`, `min`/`max`/`step`, `group`, `long`, `hint`, `placeholder`, `accept`). | `form/schema.ts` `Field<T>` |
| **Option** | A `{ value, label }` choice of a `select` field. | `form/schema.ts` `Option` |
| **Draft** | The object being edited: `Partial<T>`, owned by the engine (`initial` + `key`) or by the app (`value`). | `form/draft.ts` `Draft<T>`, `createDraft` |
| **Dirty** | The draft differs, shallowly and empties-alike, from the last loaded or committed base. | `form/draft.ts` `differs`, `dirty` |
| **Touched** | A field whose control has blurred once; errors show for touched fields, or for all after a submit attempt. | `form/draft.ts` `touched`, `blur` |
| **Presence** | Whether a field exists for the current draft — `when(draft)`. Absent fields are not rendered, not validated and not submitted. | `form/schema.ts` `visibleFields` |
| **Dependent options** | Choices computed from the draft — `options(draft)`; a value no longer offered is cleared to a fixpoint. | `form/schema.ts` `optionsOf`, `form/draft.ts` `settle` |
| **Group** | Fields sharing a `group` string gather into one titled `fieldset` at the position of the first. | `form.ts` `arrange` |
| **Long** | A field holding long content; the engine gives it the full row (as it does a textarea). | `form/schema.ts` `spansRow` |
| **Generation** | A counter bumped on every reset; controls that cannot take a value (file) remount on it. | `form/draft.ts` `generation` |

### The exported intent

```ts
type FieldKind = 'text' | 'number' | 'money' | 'date' | 'select' | 'textarea' | 'file' | 'checkbox';
interface Field<T> {
  key; label; kind; required?; placeholder?; hint?; accept?;
  options?: readonly Option[] | ((draft: Partial<T>) => readonly Option[]);
  when?: (draft: Partial<T>) => boolean;
  readOnly?: boolean | ((draft: Partial<T>) => boolean);
  validate?: (value: unknown, draft: Partial<T>) => string | undefined;
  min?; max?; step?; group?; long?;
}
interface FormProps<T> {
  fields; value?; initial?; key?; onChange?; onSubmit; submitLabel?; onCancel?;
  destructive?: Action; mode?: 'submit' | 'live'; ref?: (h: FormHandle) => void;
}
interface FormHandle { reset(): void; submit(): void }
```

(`packages/engine/src/index.ts` exports `Field`, `Option`, `FieldKind`,
`FormProps`, `FormHandle`; the pure helpers stay internal to the domain.)

## The ten decision rules

Each is one place in code and one named test. Tests run in happy-dom through
the `setMeasurer` seam where width matters.

| # | rule | code | test |
|---|---|---|---|
| 1 | **Presence.** A field whose `when(draft)` is false is not rendered, carries no error and leaves the submitted object. | `schema.ts` `visibleFields`; `draft.ts` `pick`, `errors` | `form.test.ts` › rule 1 — presence › *a field whose when() is false is not rendered, is omitted on submit, and its error is cleared*; `draft.test.ts` › rule 1 — presence; `schema.test.ts` › visibleFields |
| 2 | **Dependent options.** `options(draft)` is re-evaluated on every change; a value no longer offered is cleared, to a fixpoint. | `schema.ts` `optionsOf`; `draft.ts` `settle` | `form.test.ts` › rule 2 › *re-evaluates options(draft) on every change and clears a value no longer offered*; `draft.test.ts` › rule 2; `schema.test.ts` › optionsOf |
| 3 | **Validation timing and announcement.** Never on a first keystroke; on blur for that field; on a submit attempt for every visible field. Marked with `aria-invalid` + `aria-describedby`; 2+ errors add a `role="alert"` "N fields need attention." and focus moves to the first invalid control. `required`, bounds, choice membership, then the domain `validate` last. | `draft.ts` `errors`, `submit`; `schema.ts` `validateField`; `form.ts` `summary`, `focusField` | `form.test.ts` › rule 3 › *an untouched field shows no error while typing; blur shows it; typing again clears it* and *on submit with 2+ errors: an alert summary, every field marked, focus on the first invalid*; `draft.test.ts` › rule 3; `schema.test.ts` › validateField (5 cases) |
| 4 | **Choice rendering.** A `select` with 2–3 options is a segmented `role="radiogroup"` of `role="radio"` buttons (arrow keys move, the checked one is primary-styled); 4+ is a native `<select>` with a leading "Choose…". Intent stays `kind: 'select'`. | `form.ts` `SEGMENTED_MAX`, `segmented`, `select` | `form.test.ts` › rule 4 › *2–3 options: a segmented radio group; 4+: a native select; intent stays kind:select* and *clicking a segment selects it and the draft changes* |
| 5 | **Draft lifecycle.** Owned mode: draft = `initial` on mount and whenever `key` changes; a file input remounts on `generation`; cancelling a dirty draft asks "Discard changes?" first; a successful submit commits (no longer dirty); `reset` returns to the last committed base. Controlled mode: the app's `value` (a writable signal is edited in place; `undefined` reads as `{}`), same rules, no confirm. | `draft.ts` `createDraft`, `load`, `commit`, `reset`; `form.ts` `cancel`, `Form()` | `form.test.ts` › rule 5 › *draft = initial on mount and whenever key changes; a file input remounts*, *cancelling a dirty form asks first…*, *after a successful submit the form is no longer dirty*, *a FormHandle via ref resets and submits*; `draft.test.ts` › rule 5 (3 cases) and › controlled mode; `form.test.ts` › controlled draft |
| 6 | **Layout.** Columns from `columnsFor(width, visibleCount, metrics.layout.minField = 240, gap)` — the *visible* count only; `long` and `textarea` span the row; a group is one `fieldset` with a `legend`, spanning the row, laying out its own fields by the same rule, in declaration order. `FIT_CELL` reported below `minField`. | `form.ts` `cols`, `fieldEl`, `groupEl`, `arrange`; `schema.ts` `spansRow` | `form.test.ts` › rule 6 › *columns from the visible count only; long and textarea fields span the row* and *a group is one fieldset with a legend…*; `layout.test.ts` › Form |
| 7 | **Bounds.** `min`/`max`/`step` reach the native control; money steps 0.01 and number `any` unless the schema says; a date's bounds are ISO strings; `inputmode="decimal"` for money/number. | `schema.ts` `stepOf`; `form.ts` `control` | `form.test.ts` › rule 7 › *min/max/step reach the native control; money steps 0.01; a date takes ISO strings*; `schema.test.ts` › *money steps by 0.01, number by any…* |
| 8 | **Read-only.** `readOnly` (boolean or `(draft) => boolean`) renders `readonly` on input/textarea, `disabled` on select/checkbox/file/radio buttons, plus the `input.readonly` skin part — reactive to the draft. | `schema.ts` `isReadOnly`; `form.ts` `control`; `skin.ts` `input.readonly` | `form.test.ts` › rule 8 › *renders the control read-only (input readonly / select disabled), reactive to the draft* |
| 9 | **Live mode.** `mode: 'live'`: no button row, no submit; `onChange` fires per change; validation still runs on blur. | `form.ts` `submit`, the button row's `display` | `form.test.ts` › rule 9 › *no buttons, no submit; onChange fires per change; validation still runs on blur* |
| 10 | **Busy.** A promise-returning `onSubmit` (or `destructive.onSelect`) keeps its button `aria-busy` and disabled; a rejection notifies (0034 "Busy actions", `createBusy`). | `form.ts` `run`; `status.ts` `createBusy` | `form.test.ts` › rule 10 › *a promise-returning onSubmit keeps the button busy and disabled; a rejection notifies* |

## What stays intent, what the engine decides

The 0034 test — *is this a decision verifiable by eye alone?* — sorts every
candidate prop:

- **Intent (an app may say):** what a field is (`kind`), what it means
  (`label`, `hint`, `required`), when it exists (`when`), what it may hold
  (`options`, `min`/`max`/`step`, `validate`), whether it may be edited now
  (`readOnly`), that it belongs with others (`group`), that its content is
  long (`long`), and who owns the draft (`value` vs `initial` + `key`). Each of
  these is a fact about the domain the author knows and the engine cannot.
- **Decision (the engine's call):** that ≤ 3 choices are a segmented group and
  4+ a list; that a long field takes the row; how many columns 240 px fields
  make at this width; that an error appears on blur, not on the first
  keystroke; that two errors earn a summary; that a dirty draft asks before
  discarding; that a file control resets by remount. None of these is a fact
  about the domain — they are what a careful person would do by eye for every
  form, so they are rules, once, in the engine.

Why "segmented if ≤ 3" is not a prop: an author who could write
`segmented: true` would write it inconsistently across forms (0034, *Where a
new need goes*), and the choice depends on a count the schema already carries.
`SEGMENTED_MAX` is one constant in `form.ts`; if a skin or a future axis wants
a different threshold it moves there, not into app code. The same argument
retired `disabled`-as-a-prop in favour of `readOnly(draft)`, and kept
`amountShape` in Ledger's import a plain 2-option `select` — the engine makes
it a segmented control, the app never said so.

Rendering keeps the 0034/0035 rules: structure from `metrics` (`space`,
`control.height`, `layout.minField`), visuals only through `look()` (`text.muted`
labels, `tone.negative` errors, `input.readonly`); control values reach the
element property from inside the attribute's computed (`sync`), so no
imperative style write touches an element whose style is reactive.

### What Ledger deleted

All five owned screens were migrated on the same day (`import.ts`,
`transaction-dialog.ts`, `budgets.ts`, `rules.ts`, `accounts.ts`): the
`fileKey` remount hack became `key: fileKey.value` on an owned live form and
"reset after import" is `fileKey.value++`; the mapping hint prose became
`amountShape` + `when:` on `amount`/`debit`/`credit`/`invert` with `validate`
keeping date ≠ payee and debit ≠ credit; every dialog's hand-seeded `draft`
signal and its `onChange` wiring became `initial` + a per-open `key`; the
`Signal<T | undefined>` cast is gone. Confirm-before-delete and notify-on-save
are unchanged.

## Consequences

- **A DOM shape change.** A field is a `div` (label `for`, control, note
  `span`), not a wrapping `label`; grid children are `each-item`
  (`display: contents`) wrappers. `layout.test.ts` adjusted one selector.
- **Owned drafts are the default for dialogs; controlled for shared state.**
  Presence of the `value` key selects controlled mode. The confirm-on-cancel
  applies only to an owned draft: a controlled base can be replaced externally,
  so a confirm there would be spurious.
- **A new skin part**, `input.readonly`, in both schemes
  (`skin.ts`, `skin/default.ts`; the completeness test covers it).
- **The pure helpers are testable without a DOM** and are not exported from
  `index.ts` — the domain's internals stay the engine's.
- **Recorded in** `packages/engine/CHANGELOG.md` (Unreleased) and the Blocks
  section of `packages/engine/README.md`.

### Non-goals (deliberately not in this ADR)

- **No wizard / multi-step block.** Ledger's import is three `Section`s with
  two live forms; the step structure is app composition, not a block.
- **No async validation.** `validate` is synchronous; a rule that needs a
  server answer is not yet a word.
- **File fields have no preview.** A `file` control offers `accept` and resets
  by remount; it does not show what was chosen beyond the native control.
- **No per-field appearance.** No `width`, `inline`, `segmented`, or `columns`
  on a `Field` — by the 0034 rule above.

## Long-term plan

1. **Actions block** ([issue 0023](../issues/0023-actions-block-for-dialogs.md)).
   Dialogs whose purpose is a decision still fake an action row with a
   fieldless `Form`. `Form`'s button row (submit / cancel / destructive, busy
   handling) is the seed of that block; extracting it lets both share one rule.
2. **Wizard / stepper as a composition of Forms.** When a second screen needs
   steps, the shape is `Form`s sharing a draft key with the engine deciding
   step chrome — not step intent on `Field`.
3. **Density and input axes** (0034 phase 5, 0035 "the next axes").
   `metrics.control.height` (32) and `layout.minField` (240) are the numbers a
   density axis would vary, and the segmented-vs-list threshold is what an
   input axis (touch vs pointer) may move. Both stay engine-side; the schema
   does not change.
4. **Async validation and `prove()`** follow once the vocabulary settles
   ([issue 0024](../issues/0024-prove-harness-parked.md)): a form's presence and
   layout rules are already pure, so a screen proof can assert them without a
   browser.
