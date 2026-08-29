# 0034. `@nisli/engine` — Typed Blocks Decided by an Engine

**Date**: 2026-08-29
**Status**: Accepted
**Depends on**: [0029-agent-native-ui-strategy](./0029-agent-native-ui-strategy.md), [0030-agent-native-authoring](./0030-agent-native-authoring.md)
**Replaces the direction of**: [0032](./0032-derived-appearance-package.md) and [0033](./0033-oracle-soundness.md), both withdrawn on 2026-08-27 — see [`AUDIT-2026-08-27.md`](../research/nextgen/AUDIT-2026-08-27.md). Their numbers stay burned; this ADR does not supersede their text, it records what was built instead.
**Companion**: [0035-engine-appearance-layer](./0035-engine-appearance-layer.md) (the visual layer this ADR only names)
**Code**: [`packages/engine`](../../packages/engine), [`packages/ledger`](../../packages/ledger)

## Context

On 2026-08-27 `main` was rewound to the commit before the nextgen programme
opened. The programme had set out to build *a higher-level engineering language
and engine so agents can build UI without looking* and had built `@nisli/intent`
instead: `data-*` attributes as a styling vocabulary, a CSS resolution table,
a 35-line fit loop and a 3,400-line checker. The audit found the method — measure
what is measurable tonight, "not GSS", core's 10 KB ceiling applied to the
framework, a 5 % weighting on the fit solver — had selected a stylesheet and a
linter over an engine every round. Goga's judgement was that the idea had been
missed entirely: the author was still making the visual decisions, in a new
syntax.

The north star ([`NORTH-STAR.md`](../research/nextgen/NORTH-STAR.md)) states the
idea in one sentence: **React made structure a function of state; this makes
appearance a function of meaning.** Its measured example is the bar this ADR
holds itself to — *"degraded in the exact order declared — timestamp truncated
first, Star/Archive to an overflow menu, Reply never left."* Nothing lost;
everything moved.

The rebuild started from zero with one typed block and an engine under it, and
grew only as a real application (Ledger, a personal-finance SPA) demanded. This
ADR records the architecture that emerged, in the language its code uses.

## Ubiquitous language

| term | meaning | where it lives |
|---|---|---|
| **Block** | A typed factory an application composes: `Toolbar({ title, actions })`. A custom element under the hood; app code never sees the element. | `packages/engine/src/blocks/*.ts` |
| **Intent** | What a block's props may say: what a thing *is* and is *for*. Never how it looks. | the public prop types in `blocks/*.ts`, `blocks/types.ts` |
| **Decision** | A choice the engine makes from intent, structure and width that a human would otherwise make by eye. | `engine/*.ts`, the rules inside each block |
| **Plan** | The pure output of `fit()`: per-item `keep` / `shrink` / `stack` / `overflow`, widths, slack. | `engine/fit.ts` `FitPlan` |
| **Degrade vocabulary** | The order an item gives ground: **shrink** (to `minWidth`), **stack** (fold into `stackInto`, stay visible), **overflow** (leave into a menu). | `engine/fit.ts` |
| **Metrics** | Structural numbers the engine needs to decide — spacing, control height, layout thresholds. Not visual. | `metrics.ts` |
| **Skin** | The optional visual layer: a map from **Parts** to style records. | `skin.ts`, `skin/default.ts` |
| **Part** | A named piece of a block a skin may dress: `button.primary`, `card.nested`, `table.header`. | `skin.ts` `Part` |
| **Axes / Scheme** | Context the skin varies on. First axis: colour `scheme` (`light`/`dark`/`system`). | `skin.ts` (contract in 0035) |
| **Status** | An async result a block may hold — structurally a core `QueryResult`/`ResourceResult`. | `blocks/status.ts` |
| **Layout report** | The engine saying, in data, that a plan could not be satisfied. | `engine/report.ts` |
| **Proof** | A screen mounted at widths with no browser, returning its layout reports. | `test/prove.ts`, `test/estimate.ts` |

## Bounded contexts

| context | responsibility | files | may depend on |
|---|---|---|---|
| **Intent** | The closed vocabulary an app may use | `blocks/types.ts`; the exported prop types of every block | — |
| **Decision** | Pure decisions and the one measure→decide→apply loop | `engine/fit.ts`, `engine/columns.ts`, `engine/use-fit.ts`, `engine/measure.ts` | Metrics |
| **Appearance** | Dressing decided structure | `skin.ts`, `skin/default.ts`, `style.ts` (`look()`) | — (the engine calls it; it calls nothing) |
| **Proof** | Observing decisions the engine could not satisfy | `engine/report.ts`, `test/prove.ts`, `test/estimate.ts` | Decision |
| **Application** | A real product built only from Intent | `packages/ledger` | Intent, `useSkin` |

Dependency direction: **Intent → Decision → Appearance**. Blocks translate
intent into `FitItem`s and `Status` views (Decision), then render structure with
`metrics` and ask `look()` for the dressing (Appearance). Proof only *observes*
Decision through `onReport`. Application imports blocks and installs a skin; it
never imports `engine/*`, `style.ts` or `metrics` for its own layout.

## The contract

App code **cannot** say: a class name, a `style`, a `data-*` attribute, a pixel
or rem, a breakpoint, a colour, a font, what collapses at 360 px. The types do
not offer any of it; [`toolbar.test.ts`](../../packages/engine/src/blocks/toolbar.test.ts)
proves `className`, `style` and `align` are compile errors.

App code **can** say, and only say, meaning: `priority: 'primary' | 'secondary'
| 'tertiary'` (survival order), `kind: 'text' | 'number' | 'money' | 'date'`
(what a cell holds), `tone: 'positive' | 'negative' | 'warning' | 'neutral'`
(whether a number is good news), `role: 'body' | 'muted' | 'heading' | 'code'`,
`destructive: true`, `sortable`, `required`, and structure — what contains what.
"These are the actions" is intent; *where* they sit is the engine's.

## Decision rules that exist today

Each is one line in code; each is provable at width with `setMeasurer`.

- **Priority walk** — items give ground from lowest priority up; equal priority
  from the end; each pays shrink → stack → overflow. `engine/fit.ts` `fit()`.
- **Text columns truncate, figures never do** — `minWidth = min(natural,
  metrics.layout.minTextColumn)` for text; none for `number`/`money`/`date`.
  `blocks/table.ts` items.
- **Primaries never leave** — `overflowable: c.priority !== 'primary'`.
  `blocks/table.ts`.
- **Dropped columns fold under the primary text cell** — `stackInto` the first
  primary text column; empty values earn no slot; numeric ones fold as
  "Header value". `blocks/table.ts` `stackTarget`, `stackedInto`.
- **Toolbar taste** — `RANK = { tertiary: 1, secondary: 2, title: 10, primary:
  20 }`: the title truncates (to `minTitle`) before a primary action leaves.
  `blocks/toolbar.ts`.
- **Columns from width** — `columnsFor(width, count, minColumn, gap)` for Grid
  (`minColumn` 220) and Form (`minField` 240); a textarea spans all.
  `engine/columns.ts`, `blocks/grid.ts`, `blocks/form.ts`.
- **Shell shape** — sidebar iff `width ≥ sidebarWidth + contentMin`
  (232 + 560); otherwise a top bar with a menu sheet. `blocks/app.ts`.
- **Dialog shape** — a full-height sheet below `dialogMin` (640), else a
  centred card of `dialogWidth`. `blocks/dialog.ts`.
- **A long list is a decision, not a scroll** — 60 rows, then "Show N more".
  `blocks/table.ts` `PAGE`.
- **A surface inside a surface is not a card** — `SurfaceContext` depth;
  `cardStyle(nested)`. `blocks/surface.ts`, `section.ts`, `stat.ts`.
- **Meter tone by ratio** — `> 1` negative, `> 0.85` warning. `blocks/meter.ts`.
- **The engine owns waiting** — `status` pending → skeleton; failed → message +
  Retry when a retry exists (stale content stays); refreshing → "Updating…".
  `blocks/status.ts` `viewOf`, used by Section/Table/Stat/Page.
- **Busy actions** — an `onSelect`/`onSubmit` that returns a promise sets
  `aria-busy`, disables, and notifies on rejection. `blocks/status.ts`
  `createBusy`.
- **Re-solve on inline size only** — a block's own decisions change its height;
  reacting to that would solve forever. `engine/measure.ts` `observeWidth`.
- **Reports** — `FIT_ROW` (Toolbar), `FIT_COLUMNS` (Table), `FIT_CELL`
  (Grid/Form) when a plan's slack is negative. `engine/report.ts`.

## Where a new need goes

Three homes, in order of preference:

1. **An engine rule derived from structure.** The engine knows the tree; the
   author does not. Card-in-card was solved here — no app word exists for it.
2. **A skin part.** How a nested card, a busy button or a warning meter looks.
3. **A new semantic word on a block.** `priority`, `tone`, `kind` — closed,
   typed, engine-interpreted.

Never a per-instance appearance prop (`Section({ flat: true })`). Goga asked,
reasonably, why "flat" composed later would be a big deal; the answer is that it
is not — *in homes 1 and 2*. Only the app-prop home erodes the contract, because
it is a decision verifiable by eye alone, and an agent will sprinkle it
inconsistently. This ADR records that rule so the question need not be re-argued.

## Consequences

- **Taste lives in skins**, not app code. A brand is a `Skin`; a designer who
  wants to style one instance is not this framework's user ([0035](./0035-engine-appearance-layer.md)).
- **The vocabulary is small** — fifteen blocks: `App`, `Page`, `Toolbar`,
  `Section`, `Grid`, `Stat`, `Table`, `Form`, `Dialog`, `Meter`, `Bars`,
  `Columns`, `Empty`, `Text`, `Link`; plus `notify()` and `confirm()`. It grows
  only when a Ledger screen needs a block, and every block ships with a width
  test before a screenshot.
- **Verification is by test, not eye.** Blocks are proven in happy-dom at
  1280/1024/768/480/360 through the `setMeasurer` seam
  (`toolbar.test.ts`, `table.test.ts`, `layout.test.ts`, `status.test.ts`).
  Screenshots are looked at because one wants to, not because correctness
  depends on it.
- **Known gaps**, tracked as issues: Form has no conditional fields or file
  reset ([0022](../issues/0022-form-conditional-fields-and-reset.md)); dialogs
  have no action row ([0023](../issues/0023-actions-block-for-dialogs.md));
  `prove()` is parked ([0024](../issues/0024-prove-harness-parked.md)); a Vite
  proxy hang is unexplained ([0025](../issues/0025-vite-proxy-accept-header-hang.md)).
- **What Ledger has shown** (`packages/ledger`): nine screens — overview,
  accounts, account, transactions, budgets, import, rules, connections,
  settings — in app code that contains no visual vocabulary, correct at five
  widths on the first sweep after each engine fix, including a CSV import
  wizard and a Plaid-backed bank connection with a mock mode.

## Long-term plan

Intent, not commitment; each phase is entered only when the previous one has
produced evidence.

1. **Ledger drives the vocabulary** (now). Blocks and rules are added only when
   a screen Goga uses needs them.
2. **A second application of a different shape** — content-heavy or a
   workflow tool — to test whether composition holds where the blocks were not
   designed against it.
3. **Un-park `prove()`** once the vocabulary stops moving weekly, so a screen's
   correctness at width is a unit test in the app, not a sweep in a browser.
4. **Subtree-split Ledger** into its own repository consuming the published
   `@nisli/engine` — the honest consumer test.
5. **Further axes** — density and input after colour scheme — so one block is
   36 px in one context and 18 px in another from the same intent, as the
   north star measured.
