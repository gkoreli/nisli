# Bet 06 — Reuse reactive graph edges only if profiles justify it

**Verdict:** hold pending application and allocation profiles.

**Evidence:** `signal.ts:341`, `:524` delete/re-add dependency membership during
retracking; `:131` copies and sorts pending effects. Current
[Preact Signals source](https://github.com/preactjs/signals/blob/main/packages/core/src/index.ts)
uses linked dependency edges with stored versions and recyclable nodes. This is
an alternative implementation, not evidence of Nisli's relative performance.

**Experiment:** reproduce static and conditional graphs with equal-value
computeds, wide fan-out, deep chains and effect-to-effect writes; then measure
real tables/forms and repeated mount/dispose. If edge churn is material, prototype
reusing edges while leaving Nisli's public API and scheduler contract intact.

**Acceptance:** 465 existing baseline tests plus targeted conditional tracking,
diamond consistency, error entry/equal-value recovery, deterministic creation
order, coalescing, disposal, loop guards, quiescence and async boundaries.
Measure CPU, allocations, retained heap and actual browser interaction latency.
Use matching semantics for peer comparisons: Preact's batching behavior is not
Nisli's microtask contract.

**Kill condition:** complexity rises without application benefit, or changing
effect order manufactures a benchmark win. The
[TC39 proposal](https://github.com/tc39/proposal-signals) is still Stage 1 and does
not standardize framework effect scheduling/disposal; it is not a native runtime
replacement available to deploy today.
