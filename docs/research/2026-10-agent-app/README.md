# Agent application leap — October 2026

Research dated 2026-10-20, America/Los_Angeles, at
`4afde49c728a330e10ce887a38b8013d63b58498`.

Question: which optional additions could eliminate whole categories of app work
for agents while retaining Nisli's current capabilities? This continues the
[risk/value reassessment](../2026-10-core-frontier/reviews/risk-value-reassessment.md).

**Current conclusion:** the strongest bet is an operation-centered application
layer above existing core/engine. Its value would come from projecting one domain
capability into input UI, programmatic invocation, lifecycle handling and data
reconciliation. A plain action wrapper or more metadata alone would not be a leap.
Agent productivity improvement remains unmeasured.

Read [REPORT.md](./REPORT.md), the [source ledger](./sources.json), then the
[adversarial review](./reviews/self-review.md). This is research, not a ratified
architecture, production implementation, or dependency recommendation.

| Bet | Status | Evidence and next decision |
| --- | --- | --- |
| [01 Shared operations and task sessions](./briefs/01-operation-tasks.md) | Strongest research candidate; not implemented as a product | 56-line coordinator preserves two actual handlers' dependency-call traces in 12 success/failure cases; 15 checks pass overall. UI/schema/RPC integration remains unbuilt |
| [02 Views backed by shared read models](./briefs/02-data-views.md) | Supporting candidate, weaker local coverage | One substantial filtered/sorted Transactions screen; repeated refresh orchestration in Connections. No data-layer replacement justified |
| [03 Source-bound steps and explicit handoffs](./briefs/03-flow-lifetimes.md) | Supporting candidate; broader durable flow runtime deferred | Actual import loader race reproduced; existing `resource` fixes the isolated stale-result commit. File/OAuth resumption cannot be inferred automatically |

## Experiment ledger

| Experiment | Verdict |
| --- | --- |
| [Screen census](./experiments/corpus/RESULT.md) | PASS: 10 files, 1,397 lines, exact syntax counts and callsites; not a savings estimate |
| [Form fields as trusted operation contracts](./experiments/form-as-operation/RESULT.md) | FALSIFIED: 3/4 strict checks fail; 1 control passes. Existing Form rules are not a general machine-input or authorization boundary |
| [Operation coordinator](./experiments/operation-coordinator/RESULT.md) | PASS: 15/15 checks, including effect-trace preservation, local/remote distinction and shared-session exclusion; no real-server or UI proof |
| [Import lifetime](./experiments/import-lifetime/RESULT.md) | NEGATIVE/POSITIVE: actual loader loses latest-wins; existing resource keeps it. 1 failed / 1 passed; command intentionally exits 1 |
| [Baseline Ledger suite](./validation/ledger-tests.md) | PASS: 190 tests, 17 files, no type errors; includes existing screen proofs. This is unchanged-baseline evidence |
| [Research TypeScript](./validation/research-typecheck.md) | PASS: prototype and experiment sources typecheck; JavaScript census syntax checked |

The falsification commands deliberately remain nonzero. No source, dependency,
package export, version, server or screen was changed. No new workspace package
was created. No remote CI, external provider call or agent-performance win is
claimed.
