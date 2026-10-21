# reactive-expressions

Date: 2026-10-20, America/Los_Angeles. Source `4afde49c728a330e10ce887a38b8013d63b58498`. Node 22.23.2, pnpm 10.17.1, Vitest 2.1.9.

## Command

From repository root:

```sh
pnpm exec vitest run --config docs/research/2026-10-framework-authoring/experiments/reactive-expressions/vitest.config.ts
```

## Verdict

7/7 PASS. Explicit opt-in lowering into existing primitives preserves scalar leaf updates, input identity and edit value, handler timing, snapshots, typed factories, actual Progress variant output and disposal. Known unsupported reactive expressions are rejected. Fixture-supplied binding names and happy-dom only; no full compiler, browser-focus, speed or agent-efficiency claim.

Exit status: **0**.

## Full output

```text
[33mThe CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.[39m

 RUN  v2.1.9 /Users/goga/Documents/goga/nisli

stdout | docs/research/2026-10-framework-authoring/experiments/reactive-expressions/probe.test.ts > opt-in lowering into existing Nisli primitives > matches the explicit computed reference and preserves input identity and edit value
{"experiment":"leaf update under computed view","snapshots":[{"name":"raw","same":false,"value":"initial","text":"after"},{"name":"lowered","same":true,"value":"unsaved edit","text":"after"},{"name":"manual","same":true,"value":"unsaved edit","text":"after"}]}

 ✓ docs/research/2026-10-framework-authoring/experiments/reactive-expressions/probe.test.ts (7 tests) 50ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  23:00:00
   Duration  780ms (transform 100ms, setup 0ms, collect 340ms, tests 50ms, environment 182ms, prepare 43ms)


```
