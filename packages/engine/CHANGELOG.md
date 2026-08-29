# Changelog

All notable changes to `@nisli/engine`. Format: keep-a-changelog-lite — one
section per version, human-readable highlights. Unreleased until the first
publish.

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
