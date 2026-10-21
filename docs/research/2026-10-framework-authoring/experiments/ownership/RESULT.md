# ownership

Date: 2026-10-20, America/Los_Angeles. Source `4afde49c728a330e10ce887a38b8013d63b58498`. Node 22.23.2, pnpm 10.17.1, Vitest 2.1.9.

## Command

From repository root:

```sh
pnpm exec vitest run --config docs/research/2026-10-framework-authoring/experiments/ownership/vitest.config.ts
```

## Verdict

5/5 PASS. Records current explicit standalone cleanup behavior, then demonstrates opt-in nested child replacement/disposal, ownership independent of untrack, explicit detachment and authored cleanup. Wrapper only; no production effect/context semantics changed, no automatic integration for other framework resources or await.

Exit status: **0**.

## Full output

```text
[33mThe CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.[39m

 RUN  v2.1.9 /Users/goga/Documents/goga/nisli

stdout | docs/research/2026-10-framework-authoring/experiments/ownership/probe.test.ts > optional lifetime ownership separate from dependency tracking > records the current explicit-cleanup contract for standalone nested effects
{"current":"standalone nested effects require explicit child cleanup","activeChildrenAfterParentStop":2}

 ✓ docs/research/2026-10-framework-authoring/experiments/ownership/probe.test.ts (5 tests) 4ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  23:01:13
   Duration  244ms (transform 30ms, setup 0ms, collect 33ms, tests 4ms, environment 74ms, prepare 21ms)


```
