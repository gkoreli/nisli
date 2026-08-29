# 0024 — `prove()` exists but is parked: screen-level proof is not yet a test

**Status**: open (parked by decision, 2026-08-28)
**Priority**: P2
**Area**: `@nisli/engine` — `test/prove.ts`, `test/estimate.ts`, `engine/report.ts`

## Summary

The Proof context of [ADR 0034](../adr/0034-engine-typed-blocks-decided-by-an-engine.md)
is half-built. Blocks emit `LayoutReport`s (`FIT_ROW`, `FIT_COLUMNS`,
`FIT_CELL`) when a plan is unsatisfiable, and in dev those reach the console —
the transactions table's 7 px deficit at 294 px was caught this way on the
day it landed. `prove(make, { widths })` mounts a screen in happy-dom under an
estimating measurer (`test/estimate.ts`: widths from the engine's own inline
styles and text length × `metrics.charWidth`) and collects the reports.

What is missing:

- No screen in `packages/ledger` calls `prove()`; correctness at width is
  still established by a Playwright sweep and a person looking.
- The estimator is untested against the browser: nobody has shown that its
  reports agree with real Chromium on the Ledger screens.
- It is exported from `@nisli/engine/test` but undocumented.

Parked because Goga judged (2026-08-28) that expressiveness and velocity come
before proving: a harness for a vocabulary that changes weekly proves the
wrong thing.

## Un-parking requires

1. The block vocabulary stable for a few weeks of Ledger use.
2. One Ledger screen test per route: `expect(await prove(Screen, { widths }))
   .toEqual([])`, red on any layout report.
3. A calibration test that runs the estimator and Chromium over the same
   screens and diffs their reports.
4. Retiring the sweep as the source of truth.
