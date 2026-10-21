# operation-coordinator

Date: 2026-10-20, America/Los_Angeles. Source: `4afde49c728a330e10ce887a38b8013d63b58498`. Node v22.23.2; pnpm 10.17.1; Vitest 2.1.9 where used.

## Command

Run from repository root:

```sh
pnpm exec vitest run --config docs/research/2026-10-agent-app/experiments/operation-coordinator/vitest.config.ts
```

## Verdict

PASS: 15/15 checks. Actual Ledger syncOne/syncAll closures are extracted and evaluated with traced dependencies; coordinator bindings preserve those dependency-call traces in 12 success/failure cases. Three further checks cover local acknowledgement, same-session exclusion and acknowledged-write/read-back failure. No real provider, persistence server, UI interaction or timing equivalence was tested. The final receipt distinguishes not-started, unconfirmed and acknowledged execution; completion is a handler contract. Prototype is 56 source lines, not a production API or an agent-productivity proof. Initial Boolean outcome was corrected to avoid claiming that a thrown execution proved no remote effect.

Exit status: **0**.

## Full output

```text
[33mThe CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.[39m

 RUN  v2.1.9 /Users/goga/Documents/goga/nisli

stdout | docs/research/2026-10-agent-app/experiments/operation-coordinator/probe.test.ts > operation coordinator over actual Ledger connection closures > preserves syncOne effect trace when nothing fails
{"original":"syncOne","fail":null,"trace":["flush","sync","reload","connections","composition"],"effect":"acknowledged","phase":"confirmed-remotely"}

stdout | docs/research/2026-10-agent-app/experiments/operation-coordinator/probe.test.ts > operation coordinator over actual Ledger connection closures > preserves syncOne effect trace when flush fails
{"original":"syncOne","fail":"flush","trace":["flush","connections","composition"],"effect":"not-started","phase":"failed"}

stdout | docs/research/2026-10-agent-app/experiments/operation-coordinator/probe.test.ts > operation coordinator over actual Ledger connection closures > preserves syncOne effect trace when sync fails
{"original":"syncOne","fail":"sync","trace":["flush","sync","connections","composition"],"effect":"unconfirmed","phase":"outcome-unknown"}

stdout | docs/research/2026-10-agent-app/experiments/operation-coordinator/probe.test.ts > operation coordinator over actual Ledger connection closures > preserves syncOne effect trace when reload fails
{"original":"syncOne","fail":"reload","trace":["flush","sync","reload","connections","composition"],"effect":"acknowledged","phase":"acknowledged-needs-attention"}

stdout | docs/research/2026-10-agent-app/experiments/operation-coordinator/probe.test.ts > operation coordinator over actual Ledger connection closures > preserves syncOne effect trace when connections fails
{"original":"syncOne","fail":"connections","trace":["flush","sync","reload","connections","composition"],"effect":"acknowledged","phase":"acknowledged-needs-attention"}

stdout | docs/research/2026-10-agent-app/experiments/operation-coordinator/probe.test.ts > operation coordinator over actual Ledger connection closures > preserves syncOne effect trace when composition fails
{"original":"syncOne","fail":"composition","trace":["flush","sync","reload","connections","composition"],"effect":"acknowledged","phase":"acknowledged-needs-attention"}

 ✓ docs/research/2026-10-agent-app/experiments/operation-coordinator/probe.test.ts (15 tests) 62ms

 Test Files  1 passed (1)
      Tests  15 passed (15)
   Start at  22:49:34
   Duration  573ms (transform 37ms, setup 0ms, collect 241ms, tests 62ms, environment 123ms, prepare 31ms)


```
