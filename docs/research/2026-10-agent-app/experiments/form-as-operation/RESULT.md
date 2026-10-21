# form-as-operation

Date: 2026-10-20, America/Los_Angeles. Source: `4afde49c728a330e10ce887a38b8013d63b58498`. Node v22.23.2; pnpm 10.17.1; Vitest 2.1.9 where used.

## Command

Run from repository root:

```sh
pnpm exec vitest run --config docs/research/2026-10-agent-app/experiments/form-as-operation/vitest.config.ts
```

## Verdict

FALSIFIED: 3/4 strict checks fail and the missing-required-fields control passes. Actual Ledger field declarations are extracted with TypeScript AST and executed with minimal contextual data; actual engine createDraft is used. This bypasses DOM controls and never calls the server. It disproves a universal trusted-operation interpretation of UI fields; it does not establish a server exploit or that these guarantees were part of the internal draft contract. No assertion was weakened.

Exit status: **1**.

## Full output

```text
[33mThe CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.[39m

 RUN  v2.1.9 /Users/goga/Documents/goga/nisli

stdout | docs/research/2026-10-agent-app/experiments/form-as-operation/probe.test.ts > falsification: existing Form fields alone define a trusted machine operation > bank-owned amount cannot be changed through the headless draft
{"probe":"readOnly boundary","ok":true,"amount":999}

stdout | docs/research/2026-10-agent-app/experiments/form-as-operation/probe.test.ts > falsification: existing Form fields alone define a trusted machine operation > a successful money field submission is a normalized finite number
{"probe":"normalization boundary","ok":true,"limit":"25.50","type":"string"}

stdout | docs/research/2026-10-agent-app/experiments/form-as-operation/probe.test.ts > falsification: existing Form fields alone define a trusted machine operation > an unbounded money field rejects Infinity
{"probe":"finite boundary","ok":true,"finite":false}

 ❯ docs/research/2026-10-agent-app/experiments/form-as-operation/probe.test.ts (4 tests | 3 failed) 53ms
   × falsification: existing Form fields alone define a trusted machine operation > bank-owned amount cannot be changed through the headless draft 33ms
     → expected true to be false // Object.is equality
   × falsification: existing Form fields alone define a trusted machine operation > a successful money field submission is a normalized finite number 8ms
     → expected false to be true // Object.is equality
   × falsification: existing Form fields alone define a trusted machine operation > an unbounded money field rejects Infinity 7ms
     → expected true to be false // Object.is equality

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  docs/research/2026-10-agent-app/experiments/form-as-operation/probe.test.ts > falsification: existing Form fields alone define a trusted machine operation > bank-owned amount cannot be changed through the headless draft
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ docs/research/2026-10-agent-app/experiments/form-as-operation/probe.test.ts:38:58
     36|       const result = draft.submit();
     37|       console.log(JSON.stringify({ probe: 'readOnly boundary', ok: res…
     38|       expect(result.ok && result.value.amount !== 12.34).toBe(false);
       |                                                          ^
     39|     } finally { draft.dispose(); }
     40|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  docs/research/2026-10-agent-app/experiments/form-as-operation/probe.test.ts > falsification: existing Form fields alone define a trusted machine operation > a successful money field submission is a normalized finite number
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ docs/research/2026-10-agent-app/experiments/form-as-operation/probe.test.ts:48:106
     46|       const result = draft.submit();
     47|       console.log(JSON.stringify({ probe: 'normalization boundary', ok…
     48|       expect(result.ok && typeof result.value.limit === 'number' && Nu…
       |                                                                                                          ^
     49|     } finally { draft.dispose(); }
     50|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  docs/research/2026-10-agent-app/experiments/form-as-operation/probe.test.ts > falsification: existing Form fields alone define a trusted machine operation > an unbounded money field rejects Infinity
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ docs/research/2026-10-agent-app/experiments/form-as-operation/probe.test.ts:58:25
     56|       const result = draft.submit();
     57|       console.log(JSON.stringify({ probe: 'finite boundary', ok: resul…
     58|       expect(result.ok).toBe(false);
       |                         ^
     59|     } finally { draft.dispose(); }
     60|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯

 Test Files  1 failed (1)
      Tests  3 failed | 1 passed (4)
   Start at  22:44:04
   Duration  797ms (transform 107ms, setup 0ms, collect 372ms, tests 53ms, environment 166ms, prepare 38ms)


```
