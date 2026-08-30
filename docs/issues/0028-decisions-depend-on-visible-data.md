# 0028 — Layout decisions depend on which data is visible: sorting a table changes its columns

**Status**: resolved 2026-08-30 — by [ADR 0044](../adr/0044-engine-deterministic-decisions.md) (Accepted): column budgets from kind + label, `measures: false`, `DECISION_UNSTABLE`; the tenet test below now passes as a plain `it`
**Priority**: P0 — the owner called the behaviour "very harmful UI/UX"
**Area**: `@nisli/engine` — `blocks/table.ts` (the defect), `blocks/bars.ts`, `blocks/columns.ts` (the same class, bounded), `engine/use-fit.ts`
**Found**: 2026-08-30, by Goga using Ledger's Transactions screen; the perf
side was already noted by the next-round panel
([research](../research/engine/next-round-panel-2026-08-30.md) §Performance)
without the correctness consequence. Line numbers below are from
`main @ da3c66d` (engine 0.8.x).

## Summary

Goga sorted the Transactions table by **Amount**. The sort brought a row with
a long payee onto the visible page. The Payee column widened to fit it, and to
pay for that the engine folded **two** columns (Category, Account) under the
primary cell. Sorting back brought them back. His words:

> this kinda random undeterministic behavior is very harmful UI/UX, this needs
> to be one of the tenets — even if the engine is smart, the UI must be
> deterministic and behave as it is supposed to.

The engine's own record says a **decision** is "a choice the engine makes from
intent, structure and width" ([0034](../adr/0034-engine-typed-blocks-decided-by-an-engine.md)
§Ubiquitous language). Table's column plan is made from a fourth input the
record never names: the text of the rows currently on the page. At a fixed
viewport with the same declared columns, the structure of the table is a
function of the sort order, the filter, the page, and whatever the last sync
inserted.

## Reproduction

Proven in
[`table.test.ts`](../../packages/engine/src/blocks/table.test.ts) under
`Table column decisions are a function of width and intent, never of the rows
shown (tenet)`, marked `it.fails` until 0044 lands:

- Six transactions-like columns (Date, Payee, Category, Account, Note,
  Amount) at width 768, 70 rows, page = `metrics.layout.tablePage` (60).
  Row 65 carries a ~90-character payee and amount −9999.
- Measured with `estimator(768)`, not `textMeasurer`: the text measurer sizes
  a `th` by its header label alone and cannot see the defect;
  `estimator.columnWidth` sizes a `th` over the visible cells during the
  `auto`/`max-content` pass, as the browser does.
- Before the sort: Payee 85 px, all six headers shown.
  After sorting by Amount: Payee 623 px; Category, Account, Note
  `display: none`. Sorting back restores them.
- Expected: `['Date','Payee','Category','Account','Note','Amount']` both
  times. Actual after sort: `['Date','Payee','Amount']`.

A rows change re-solves on a microtask (`use-fit.ts:60`
`queueMicrotask(solve)`), so the test settles with
`flushEffects(); await; await; flushEffects()`.

In the browser: Ledger → Transactions at 768 or 1280 px, click the Amount
header, watch the header row lose columns; click again, watch them return.

## Mechanism

[`blocks/table.ts`](../../packages/engine/src/blocks/table.ts):

- L87-103: `items()` measures each `thead th` while `measuring` is true.
  During that pass the table is `width: max-content; table-layout: auto`
  (L211) and non-primary cells are capped `maxWidth: 320` while the primary
  is uncapped (L128). A `th` laid out `auto` is as wide as the widest cell in
  its column — so a column's **natural** is the widest cell of the visible
  page, rows `0..limit`. The primary text column has no cap at all: the worst
  case is unbounded.
- L105: `deps: () => { columns.value; rows.value; }` — every rows change
  re-solves the plan, so a sort, a filter keystroke, "Show 60 more" or a
  sync can each produce a different plan at the same width.
- `fit()` then does exactly what it is told: the priority walk sheds
  secondaries and tertiaries to pay for the primary's new natural. The engine
  is not wrong about the numbers; the numbers are the wrong input.
- L95: `minWidth: Math.min(width, minTextColumn)` — when the visible page is
  short, a text column's floor is its (data-derived) natural, so the floor
  itself moves with data.

The same measuring phase is the panel's perf item: two `flush()`es per solve
(`use-fit.ts:43,48`), a `max-content`/`auto` flip and ~2×(rows×cols)
`cellStyle` recomputes per rows change.

## Inventory — every place a decision reads data rather than intent + width

| site | reads data? | how it flips at a fixed width | disposition |
|---|---|---|---|
| **Table column naturals** — `table.ts:87-103`, `:128`, `:211` | **yes — the defect** | one long cell on the page widens a column; secondaries/tertiaries fold to pay for it; a shorter page brings them back | budget from kind + label, never from cells ([0044](../adr/0044-engine-deterministic-decisions.md) §Table) |
| **Table `minWidth`** — `table.ts:95` | indirectly (natural is measured) | a column narrower than 96 at its natural is rigid there; later data widens it | `min(budget, minTextColumn)` — data-free |
| **Bars label column** — `bars.ts:25-26` → `space.ts:58` `labelColumn` | **yes** — labels are the data (category names) | a new long category name widens the label column up to `width/3`; bars shorten. Bounded (cap `width/3`, floor `minLabel`), cannot fold anything, but still moves with data | column from a metric share; labels truncate ([0044](../adr/0044-engine-deterministic-decisions.md) §Bars and Columns) |
| **Columns `labelEvery`** — `columns.ts:40-41` → `space.ts:66` | **yes** — axis labels are data (periods) | "September" vs "May" changes which labels are shown at the same width | `labelEvery` from the count of labels and a format budget, not their text |
| **Toolbar** — `toolbar.ts:47-53` | no — title and action labels are declared props | only if an app feeds data into `title` (Ledger's Page titles are static) | keep; labels are intent (see 0044 §Toolbar) |
| **Grid** — `grid.ts` `columnsFor(width, children.length, minColumn)` | count of children = structure | Overview maps one Stat per account: a new account can add a column, bounded by `minColumn` | keep — structure is intent |
| **Form** — `form.ts` `columnsFor(width, visible.length, minField)` | field count = intent; `when` is state | a conditional field appearing changes the column count — declared in 0037 | keep |
| **App / Dialog** — `shellMode(width)`, `dialogMode(viewport)` | width only | cannot flip | keep |
| **Stat value** — `stat.ts` `truncate` inside a Grid cell | no — truncates within a width-decided cell; a truncated figure files `FIGURE_TRUNCATED` | — | keep |
| **Fold line** — `table.ts:116` `stackedInto` | contents are data but sit **inside** the decided primary cell and truncate; empty while measuring | — | keep |

Exactly one site decides from data in a way that reshapes structure: Table
column naturals. Bars and Columns read data for a bounded numeric decision;
they do not fold anything, but they are the same class and should move to a
budget so the rule has no exceptions.

## Why it matters

1. **The contract is broken, not incomplete.** 0034 defines a decision as a
   function of intent, structure and width. The table's structure is a
   function of a sort. An agent that reads the contract cannot predict what a
   screen will look like from what it declared.
2. **It is user-felt on the most-used screen.** Transactions is the screen
   Goga sorts, filters and pages through daily. Every one of those actions
   can reshape the header row.
3. **The proof cannot see it.** `prove()` ([0041](../adr/0041-engine-proof-domain.md))
   mounts each screen once per width with one dataset. No claim compares the
   plan across two orderings of the same rows, so a screen that reshapes on
   sort passes. That is the class of defect the claim catalogue must grow to
   catch, or it recurs.
4. **It is also the perf item.** Removing the data input removes the
   measuring phase, which is the double `flush()` and the `max-content` flip
   the panel flagged.

## Options

1. **Make the decision a function of width and intent only** — per-column
   budgets from `kind`, `metrics` and the header label; `fit()` unchanged over
   the budgets; `table-layout: fixed` always; cells truncate inside their
   decided column; Bars and Columns move to format budgets; a
   `DECISION_UNSTABLE` claim in `prove()` that mounts each screen twice with
   reordered rows and compares the hidden/folded set. Zero Ledger edits
   beyond one tenet line. This is [ADR 0044](../adr/0044-engine-deterministic-decisions.md).
2. Cap the primary's natural at 320 like the others. Narrows the blast radius
   but the plan still moves with data below the cap. Not an option: the rule
   would still have an exception on the most-used column.
3. Measure over the whole dataset instead of the page. Deterministic per
   dataset, not per width — a sync would still reshape the table. Not an
   option.

## Notes

- The tenet, in the form Goga asked for, is tenet 13 of
  [`packages/ledger/TENETS.md`](../../packages/ledger/TENETS.md) and contract
  rule 1 of 0034 §The contract, pointing at 0044.
- Related: the panel's Performance note
  ([research](../research/engine/next-round-panel-2026-08-30.md) §Synthesis)
  is resolved by the same change, not by a separate round.
