# 0044. Engine Deterministic Decisions — A Layout Decision Is a Function of Width and Intent, Never of Data

**Date**: 2026-08-30
**Status**: Accepted (2026-08-30, after the gate's eight edits and the implementation review — §What the gate and the review changed)
**Depends on**: [0034-engine-typed-blocks-decided-by-an-engine](./0034-engine-typed-blocks-decided-by-an-engine.md) (the contract this ADR adds a rule to), [0038-engine-block-kernel-and-space-domain](./0038-engine-block-kernel-and-space-domain.md) (`fitRow`, `measure`, the Space domain the budgets join), [0041-engine-proof-domain](./0041-engine-proof-domain.md) (the claim catalogue this ADR grows)
**Resolves**: [issue 0028](../issues/0028-decisions-depend-on-visible-data.md)
**Code**: `packages/engine/src/blocks/table.ts`, `blocks/bars.ts`, `blocks/columns.ts`, `engine/space.ts` (`columnBudgets`, `spreadSlack`, `textWeights`), `engine/use-fit.ts` (`measures`), `engine/report.ts` (`PLAN_ATTR`), `metrics.ts`, `test/claims.ts`, `test/prove.ts`; one line in `packages/ledger/TENETS.md`

## Context

On 2026-08-30 Goga sorted Ledger's Transactions table by Amount. His report:

> sorting the Amount column in Ledger transactions brings a row with a long
> payee onto the page; the payee column widens; two columns fold away; sorting
> back brings them back.
>
> this kinda random undeterministic behavior is very harmful UI/UX, this needs
> to be one of the tenets — even if the engine is smart, the UI must be
> deterministic and behave as it is supposed to.

The mechanism ([issue 0028](../issues/0028-decisions-depend-on-visible-data.md)
§Mechanism): Table sized each column by measuring its `thead th` during a
measuring pass in which the table was `width: max-content; table-layout: auto`
— so a header was as wide as the widest cell on the **visible page** of rows,
and the primary text column was uncapped. The plan re-solved on every rows
change (`deps` read `rows`). `fit()` then correctly shed the secondaries to
pay for the primary's new natural. The engine's arithmetic was right; its
input was wrong. 0034 defines a decision as "a choice the engine makes from
intent, structure and width". The rows are none of those.

The same measuring pass was the panel's perf finding
([research](../research/engine/next-round-panel-2026-08-30.md) §Performance):
two `flush()`es, a `max-content` flip, and ~2×(rows×cols) `cellStyle`
recomputes per rows change. One cause, two symptoms.

## The tenet

Added to 0034 §The contract as a numbered rule:

> **A layout decision is a function of viewport width and declared intent,
> never of which data is currently shown. Data fits into the decided structure
> — it truncates, folds, or wraps — and never reshapes it.**

**Structure** — invariant under data at a fixed width and fixed props:

- Table: the visible header set, each surviving column's pinned width, the
  fold target, which columns fold, a standing `FIT_COLUMNS`.
- Toolbar: the overflowed action set and the title's width.
- Grid, Form: the column count.
- App, Dialog: the mode (sidebar/bar, card/sheet).
- Bars: the label column's width.
- Columns: `every` (which axis positions carry a label).

**May vary with data** — the data living inside the structure:

- The row count, and a row's height (a fold line adds a line; an empty fold
  value earns none).
- The fold line's text, and where any ellipsis falls.
- The `Empty` block replacing a table's body; the "Show N more" button's
  presence and its N.
- A Bars item count or a Columns label count — in a chart, one item **is**
  one slot: the count is the chart's structure (like a column is a table's),
  so it may decide; the *text* of an item or label may not. "September" and
  "May" produce the same skip. (`DECISION_UNSTABLE` perturbs order and page,
  never count — consistent with this carve-out.)

Consequences of stating it as a contract rule rather than a preference:

- The inputs to any `fit()` — `available` and every `FitItem.width` /
  `minWidth` — must be derivable from `(width, props-that-are-intent,
  metrics)` alone. A block that reads a row, a cell, a label value or a series
  value to produce a `FitItem` is in breach.
- A count of declared things (children, columns, fields, actions) is
  structure, hence intent. A count of data rows is not. A chart's item/label
  count is the one carve-out above: it is the chart's spatial structure.
- "Deterministic" here means: same width, same declared props ⇒ same plan,
  regardless of the rows, their order, the page, or the filter. It is a
  property `prove()` checks (§Proof).
- Data that does not fit its decided slot is a **report or a truncation**,
  never a re-plan. A figure wider than its budget is `FIGURE_TRUNCATED`
  (already a claim) — evidence that a metric is too small for this app, fixed
  once in `metrics`, not per render.

## Decision

### Table — budgets, not measurements

`columnBudgets(columns, available, layout, charWidth, padding)` in
`engine/space.ts`: each column's natural width as a pure function of `kind`,
`metrics` and its header label. Never of `rows`. In order:

1. **Rigid budgets.** `date` gets `layout.dateChars × charWidth + padding`
   (padding is the cell's `2 × space[3]`); `money` and `number` get
   `layout.figureChars × charWidth + padding`. `figureChars` is 12 and counts
   **everything the string holds** — sign, currency symbol, separators,
   decimals: `-$123,456.78` is 12 characters. (Not 10: Ledger's
   `money(…, { sign: true })` emits `-$12,345.67` — 11 — for its seven-digit
   fixtures.) `dateChars` is 8: a *short* date ("Sep 30" and a breath) — not
   the 12 of "Sep 30, 2026", deliberately, so the three-primary floor of a
   Ledger-shaped table (≈288px, below) still fits a 360 phone inside a padded
   page and card. An app whose date format is wider truncates and files
   `FIGURE_TRUNCATED`; the fix is a shorter format or a raised `dateChars`,
   once.
2. **The header floor.** Every column's natural is floored at
   `labelWidth(label, padding) + (sortable ? SORT_MARK_CHARS × charWidth : 0)`.
   A label is intent, so it may set a floor — and the sort mark (" ↑"/" ↓",
   `SORT_MARK_CHARS = 2`) is reserved on **every sortable column whether or
   not it is the sorted one**. `columnBudgets` takes no sort input at all:
   otherwise the sorted column's natural would change with `sort` (state) and
   clicking a header would re-plan — the same symptom from a second input.
3. **Text shares.** `textNatural = clamp(remainder × weight / Σweights,
   minTextColumn, textColumnCap)` where `remainder = available − Σ rigid
   budgets`, weight is 2 for a primary text column and 1 otherwise, computed
   over **all** text columns before `fit()` runs, then floored by the
   column's own header floor. `minWidth = minTextColumn` — a constant, so the
   truncation floor cannot move with data either. Below the floor (a narrow
   phone) every text share pins at `minTextColumn`, identically at any such
   width. Figures and dates get no `minWidth` (they never truncate — 0034).
   `available = 0` (unmeasured) is roomy: every text column at its cap.
4. **`fit()` runs unchanged** over the budgets: survival by `RANK`, folds by
   rank (in Ledger's Transactions: Note, then Account, then Category fold
   into Payee; Payee never goes below 96), non-primaries `overflow`-capable,
   `FIT_COLUMNS` only when `Σ primary budgets > available`. For Ledger's
   Transactions that sum is `81.6 (date) + 96 (payee floor) + 110.4 (amount)
   = 288`: at a 360 phone the table has ≈296 inside the page and card
   padding, so the plan holds with 8px to spare — `FIT_COLUMNS` does not
   stand at any proof width.
5. **The slack rule.** After folding, the leftover width goes to the
   surviving text columns by the same weights (`spreadSlack(plan,
   textWeights(columns))` — one more pure pass), so the decided widths sum to
   `available` and the browser's `table-layout: fixed` has **nothing of its
   own to distribute**. Without this the browser would stretch every column —
   figure columns included — and the estimator's `boxWidth` (which reads the
   pinned `width`) would check `FIGURE_TRUNCATED` against a narrower box than
   rendered.

Rendering: `table-layout: fixed; width: 100%` always — no
`max-content`/`auto` flip, no measuring phase (`fitRow` runs with
`measures: false`: the items are data, `items()` touches no DOM).
`available` (`measure(host)`) is the only measured input, and it already
reacts to inline size only (0034 "Re-solve on inline size only"). `deps`
drops `rows`; only `columns` remains. Cells truncate **within** their column;
folded columns keep their information on the fold line (`stackedInto`),
inside the decided primary cell, truncating too — folding stays lossless.

**Content cells in figure columns.** Ledger's Amount cell is a `Text` block,
which mounts as a `display: block` host inside the `td`. The td's
`text-overflow: ellipsis` does not reach a nested block element, so in a
browser an over-budget money `Text` **clips without an ellipsis**, while the
checker (`ellipsed` walks ancestors; `textStyleOf` inherits `tabular-nums`
from the td) files `FIGURE_TRUNCATED` anyway. A Content cell is budgeted by
its column's `kind` exactly like a string cell; the proof surface is
`FIGURE_TRUNCATED`; and the clip-not-ellipsis rendering is a known blind spot
to record in 0041's catalogue (or to close later by giving the cell's block
host its own `overflow: hidden; text-overflow: ellipsis` — a kernel
appearance change, not a prop).

**Budgets are font-dependent, and the estimator cannot see a skin's face.**
The char budgets become px through `metrics.charWidth`, which this ADR
promotes from "used only for estimates" to a decision input (its doc comment
now says so; Bars' label estimate already used it at runtime). A skin with a
wider face could make figures truncate in Chromium while `prove()` — which
estimates with the same `charWidth` — passes vacuously: `verify()` (Chromium)
is the honest check, and this earns a `FIGURE_TRUNCATED` blind-spot row in
0041's catalogue. The budgets stay in `metrics.layout` — the structural home,
reachable through `ctx.metrics` and passed as the trailing `Layout` parameter
every Space decision takes, so a density axis can retune them; `Layout` is
`number`-valued, so char counts and the px cap both fit it.

What becomes independent of rows: the visible header set, every column
width, which columns fold, the fold target, and the `FIT_COLUMNS` report —
all a pure function of `(available, columns, metrics)`. Sorting, filtering,
paging, "Show 60 more", a sync: none can change the structure.

What stays data-dependent: nothing structural. A text wider than its column
truncates with an ellipsis (a decision, permitted by the tenet). A figure
wider than its budget does **not** widen the column; it files
`FIGURE_TRUNCATED` via the existing `overflowText` checker.

### Bars and Columns — a budget from intent

Both blocks read their labels' text to size a decision. Neither can fold
anything, but the rule has no exceptions for text — only the count carve-out
(§The tenet).

- **Bars**: the label column is `labelColumn(width, budget)` where
  `budget = layout.labelChars × charWidth + space[2]` (`labelChars` 20 — a
  fixed budget, not the longest category name). Labels truncate inside it.
  The `longest = max(labelWidth(item.label))` computation is gone.
- **Columns**: `labelEvery(slot, budget)` where
  `budget = layout.axisChars × charWidth + space[2]` (`axisChars` 8) — never
  `max(labelWidth(label))`. Which labels show is a function of `width` and
  the **count** of labels only. `slot = width / labels.length` stays: one
  label is one slot, the count is chart structure.

### Toolbar — measured, and still deterministic

Toolbar measures its title and action buttons. This is allowed and stays:
`title` and each action's `label` are declared props — intent — and measuring
intent is still a function of intent. Two mounts with the same props at the
same width produce the same widths, whatever the screen's data. But note what
a data-bearing `title` costs: `fit()` pays lowest priority first
(`engine/fit.ts`, `RANK` puts title at 10 above secondary's 2), so a longer
title evicts tertiary and then secondary actions into the overflow menu
*before* it shrinks toward `minTitle`. The tenet is formally satisfied — the
title is a declared prop, same props ⇒ same plan — but data in a `title`
makes that data intent, and it can reshape the overflowed action set. Apps
should keep data out of `title`.

The line the tenet draws is not *measured vs computed*; it is *what is
measured*. A declared label: yes. A row's cell: no.

### Proof — `DECISION_UNSTABLE`

`prove()` receives a factory and cannot see the screen's props or data — the
rows arrive through store signals inside it. So the tenet is checked through
the engine's own evidence channel, decisions as data:

- **The plan stamp.** In dev, every decided block stamps its structural
  decisions on its host as `data-nisli-plan` (`PLAN_ATTR`, the same channel
  as `data-nisli-report`): `fitRow` stamps the canonical plan
  (`id:action:width`, `>target` for folds — Table and Toolbar get this for
  free from the kernel), Bars stamps `label:W`, Columns `every:N`, Grid and
  Form `columns:N`.
- **The harness diffs stamps between mounts.** After the base mount reaches
  its fixed point, `prove()` (a) advances every table's page once — clicks
  each "Show N more" button, the one data perturbation it can make with no
  knowledge of the screen — and re-diffs; and (b) mounts each factory in
  `options.variants` to its own fixed point and diffs its stamps against the
  base, in document order. A `variants` factory must present the **same
  intent over perturbed data** (a sorted copy of the rows, a reversed
  series); the Ledger screen proofs will pass a sorted-Transactions variant.
  No `BlockSpec` field names data props — the caller owns the perturbation —
  so the block-author surface grows nothing.
- **The claim.** `DECISION_UNSTABLE` (severity `error`): "decided *plan A*
  with the data as given and *plan B* with the page advanced / with the data
  perturbed (variant N)", naming the block and tagged with the width. A
  variant whose stamped blocks differ in count or tag is named too — that is
  a changed intent, a misuse of `variants`.

The claim makes the tenet checkable with no browser, and catches every future
block that grows a data input, not only Table.

### Perf consequence

The measuring phase is gone for Table (`measures: false` on its `fitRow`):
no `max-content`/`auto` flip, no `maxWidth` toggle, no `thead th`
measurement, no measuring `flush()` — one `fit()` over pure data per width
or columns change, and **zero solves per rows change** (`deps` no longer
reads `rows`; cell styles no longer depend on `measuring`, so a rows change
re-renders rows only). `estimator.columnWidth`'s auto-layout branch is dead
for Table (its table is always `fixed`); it remains for any future
auto-layout measurement.

Measured, not asserted: the acceptance test *a rows change causes zero
solves* wraps the measurer in a spy — across a rows change it records **zero
`measure(host)` calls** and byte-identical `thead` styles. `measures: false`
(the new `FitSpec` flag in `engine/use-fit.ts:solve`) skips the measuring
render and its `flush()` entirely, so a rows change forces no layout at all.
This closes the panel's perf finding
([research](../research/engine/next-round-panel-2026-08-30.md)
§Completeness — Performance) as a side effect of the correctness fix.

## What the gate and the review changed

The proposal went through a gate (eight edits) and an adversarial
implementation review (ten questions, three findings). The body above already
reads as-amended; the deltas, so the record shows what scrutiny bought:

**The gate's eight edits** (all incorporated): explicit structure /
may-vary-with-data lists (§The tenet); the chart-count carve-out — an item is
a slot, so a Bars/Columns *count* may decide while its *text* may not; the
share order-of-operations pinned (rigid budgets → header floor → text shares
→ `fit()` → slack) and the slack rule added so decided widths sum to
`available` and `table-layout: fixed` distributes nothing; the sort mark
reserved on every sortable column always, with `columnBudgets` taking no sort
input; the Content-cell clip-without-ellipsis blind spot recorded honestly;
the worked numbers corrected, including the `dateChars` 8-not-12 divergence
(288 ≤ ≈296 at a 360 phone) recorded with its reason; char-budget /
`charWidth` honesty — `charWidth` promoted to a decision input, with the
skin-face blind spot noted for 0041's catalogue; and `DECISION_UNSTABLE` made
implementable as a stamp diff (`PLAN_ATTR` + `variants`) rather than a wish.

**The review's three findings** (all resolved in this text): (1) the Toolbar
section overclaimed — a data-bearing title evicts secondaries into the
overflow menu *before* truncating; §Toolbar now says so and warns apps off
data in `title`. (2) The in-browser acceptance bullet was recorded as held
without a browser having run; it is now marked pending (§Acceptance). (3) The
Ledger landing-order hazard — the SettingsScreen finding cannot sit in
`KNOWN` because its detail text embeds a run-time timestamp — is recorded in
§Consequences with the required landing order.

The review also confirmed adversarially: no block reads content in a decision
path (only `measure(host)` width and declared labels); the 360 plan is
stable and at least as good as before; every over-budget figure files
(no silent path); `DECISION_UNSTABLE` genuinely fails on a planted
data-reading block and stays quiet on the control; and the measure-spy shows
zero forced layout on rows change.

## Acceptance

All hold as of this ADR's implementation (engine 251/251, `tsc` clean, root
typecheck clean), except the last bullet, which is explicitly pending:

- `table.test.ts` — *768: sorting by Amount brings a long payee onto the
  page; the visible header set must not change* — passes as a plain `it`
  (it was `it.fails` while the defect stood).
- *at every width, the header set and the pinned widths are the same for any
  rows: sorted, paged, one row, none* — five widths, four datasets.
- *a figure wider than its budget truncates and files FIGURE_TRUNCATED — the
  column does not widen*.
- *a rows change causes zero solves: the engine never re-measures, and the
  styles stand*.
- *a sortable header reserves its sort mark, so the sorted column is exactly
  as wide as the unsorted one*.
- *280: the primaries alone exceed the width — FIT_COLUMNS is filed and they
  stay* — the honest-report regime below the three-primary floor.
- `space.test.ts` — `columnBudgets` at boundary widths, `spreadSlack`,
  `textWeights`, the sort-mark reservation, the unmeasured (0) roomy form,
  the density-axis override; all pure, no DOM.
- `prove.test.ts` — *DECISION_UNSTABLE: a data-perturbed variant must decide
  the same structural plans; a changed intent is caught and named*.
- `prove()` over every Ledger screen at 1280/1024/768/480/360
  (`screens.proof.test.ts`, 129/130): no `DECISION_UNSTABLE`, no
  `FIT_COLUMNS`; the one standing finding — SettingsScreen files
  `FIGURE_TRUNCATED` at all five widths — is the intended proof surface
  (§Consequences).
- **Pending browser confirmation**: on Ledger Transactions at 1280, 768 and
  360, sorting any column, typing in the filter, and "Show 60 more" never
  change the header set or any column's width. The implementation round ran
  no browser; the jsdom-side equivalents above all pass, but this bullet is
  recorded as *pending*, not held, until someone runs the app in Chromium.

## Consequences

- **Figures wider than their budget truncate** and file `FIGURE_TRUNCATED`.
  That is the intended proof surface, and it fired immediately: Ledger's
  Settings screen formats backup dates with `toLocaleString()` and files
  `FIGURE_TRUNCATED <td> "8/29/2026, 12:21:12 PM" … needs 185px in 82px`
  at every width — a 21-character datetime in a `date` column budgeted for a
  short date. The fix is Ledger's (a short format at
  `screens/settings.ts` `backupDate`, or a raised `dateChars`) — not a
  reason to widen the engine's date budget for every table. It cannot even
  wait in `KNOWN` as-is: the KNOWN mechanism matches exact detail text, and
  this detail embeds a run-time `toLocaleString()` timestamp that changes
  every run. So `packages/ledger` runs 129/130 until the ledger-owning
  session lands the short format (or a non-verbatim KNOWN key) — that landing
  belongs in the same integration window as this ADR's engine changes, or
  shared main carries a failing suite.
- **Visual differences vs today**: columns no longer hug their content; a
  short-content column can be wider than it "needs" (a date column is always
  81.6px + slack-free); long payees truncate where they used to widen the
  column. Both are the point.
- **Bars/Columns**: a category label longer than `labelChars` (20ch ≈ 152px
  column, capped at a third of the block) truncates; axis-label skipping is
  the same for any set of labels of the same count.
- **The estimator** keeps the `fixed` branch of `columnWidth` and loses a
  seam the tenet test relied on to reproduce the defect (`estimator` sizing
  a th over the visible cells now only ever sees a `fixed` table).
- **The tenet is in three places** and they must agree: 0034 §The contract
  (rule 1), this ADR, `packages/ledger/TENETS.md` §13.

## Non-goals

- No new block and no new prop. `kind`, `priority`, `label`, `sortable`
  already carry everything the budgets need; `variants` is a proof-harness
  option, not intent.
- No per-column width from the app (`width: 200`) — that is a visual decision
  and 0034 forbids it.
- No measurement of the whole dataset instead of the page: deterministic per
  dataset is not deterministic per width.
- No change to paging (60 rows, "Show N more") or to the degrade vocabulary.
- Toolbar's measuring pass is not removed here; it is already deterministic.
