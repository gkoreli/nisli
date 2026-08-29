# 0022 — `Form` has no conditional fields and cannot reset a file input

**Status**: open
**Priority**: P1
**Area**: `@nisli/engine` — `blocks/form.ts`
**Found**: 2026-08-28, building the Ledger CSV import wizard (`packages/ledger/src/screens/import.ts`)

## Summary

`Field<T>` (`packages/engine/src/blocks/form.ts`) can say `required`, `hint`,
`placeholder`, `options`, `accept`. It cannot say *when a field applies*. Two
consequences hit the first real form:

1. **"Amount, or debit and credit"** — the import mapping offers one signed
   column *or* two unsigned ones. The engine cannot hide the alternative once
   one is chosen, so the wizard expresses the rule as hint text and validates
   after the fact. The right shape is a typed condition the engine evaluates,
   e.g. `when: (draft) => boolean`, with the engine owning the hide/disable
   rendering — an engine rule from structure, not an app prop.
2. **A file input cannot be reset.** `value` does not apply to
   `<input type="file">`, so after an import the wizard remounts the whole
   step-1 `Form` by bumping a key inside a `children` computed. A `reset`
   intent (or the engine clearing file inputs when the draft's value for that
   key becomes `undefined`) removes the workaround.

Related, noted by the same screen: `Form` accepts `T | Signal<T>` for `value`,
but a form whose draft does not exist until earlier input arrives needs
`Signal<T | undefined>` and currently casts.

## Why it matters

Forms are where agents author most UI. Every rule an agent has to express as
prose ("choose one of these") is a rule the engine is not enforcing, and a
remount-by-key is exactly the kind of imperative choreography the engine exists
to delete.

## Options

1. `when?: (draft: T) => boolean` on `Field<T>`; hidden fields are skipped by
   validation and omitted from the grid (the column count re-solves).
2. `disabled?: (draft: T) => boolean` for the softer case.
3. Clear file inputs when their draft value is set to `undefined`.
