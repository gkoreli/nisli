# Changelog

All notable changes to `@nisli/engine`. Format: keep-a-changelog-lite — one
section per version, human-readable highlights. Unreleased until the first
publish.

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
