# import-lifetime

Date: 2026-10-20, America/Los_Angeles. Source: `4afde49c728a330e10ce887a38b8013d63b58498`. Node v22.23.2; pnpm 10.17.1; Vitest 2.1.9 where used.

## Command

Run from repository root:

```sh
pnpm exec vitest run --config docs/research/2026-10-agent-app/experiments/import-lifetime/vitest.config.ts
```

## Verdict

NEGATIVE/POSITIVE: 1 failed / 1 passed. Extracted actual loadFile, guess and guessMapping closures use the real Ledger parser. A slow earlier File-like read overwrites a newer selection in the current imperative closure. Same parser/mapping under existing core resource preserves the newer result. Controlled promises model deterministic out-of-order file reads; no real browser/File chooser or full screen integration was tested. The failing expectation remains strict; the baseline loader was not edited.

Exit status: **1**.

## Full output

```text
[33mThe CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.[39m

 RUN  v2.1.9 /Users/goga/Documents/goga/nisli

stdout | docs/research/2026-10-agent-app/experiments/import-lifetime/probe.test.ts > source lifetime in the actual CSV import loader > the current imperative loader keeps the newest file after out-of-order reads
{"loader":"actual loadFile","finalPayee":"Stale A"}

stdout | docs/research/2026-10-agent-app/experiments/import-lifetime/probe.test.ts > source lifetime in the actual CSV import loader > the existing resource primitive preserves the newest result with the same parser and mapping
{"loader":"existing resource","finalPayee":"Newest B"}

 ❯ docs/research/2026-10-agent-app/experiments/import-lifetime/probe.test.ts (2 tests | 1 failed) 59ms
   × source lifetime in the actual CSV import loader > the current imperative loader keeps the newest file after out-of-order reads 6ms
     → expected 'Stale A' to be 'Newest B' // Object.is equality

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  docs/research/2026-10-agent-app/experiments/import-lifetime/probe.test.ts > source lifetime in the actual CSV import loader > the current imperative loader keeps the newest file after out-of-order reads
AssertionError: expected 'Stale A' to be 'Newest B' // Object.is equality

Expected: "Newest B"
Received: "Stale A"

 ❯ docs/research/2026-10-agent-app/experiments/import-lifetime/probe.test.ts:39:32
     37|     await oldRead;
     38|     console.log(JSON.stringify({ loader: 'actual loadFile', finalPayee…
     39|     expect(rows.value[1]?.[1]).toBe('Newest B');
       |                                ^
     40|   });
     41| 

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
   Start at  22:46:23
   Duration  666ms (transform 63ms, setup 0ms, collect 291ms, tests 59ms, environment 135ms, prepare 36ms)


```
