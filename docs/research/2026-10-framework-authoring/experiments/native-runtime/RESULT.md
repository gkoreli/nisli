# Native-runtime experiment results

Frozen source: `1d055cabdffbea8ff8d82cbfd88a6081882ca8b2`. Run from the repository root. Preparation writes generated library files only to a temporary directory. Research source and tests remain here.

No production runtime was modified. Browser launching requires local process permissions. Full raw command outputs follow, including any ANSI diagnostics.

## Prepare frozen library snapshot

Command:

```sh
node docs/research/2026-10-framework-authoring/experiments/native-runtime/prepare.mjs
```

Exit code: `0`. **PASS: immutable snapshot created; source hashes recorded.**

Full output:

```text
{"commit":"1d055cabdffbea8ff8d82cbfd88a6081882ca8b2","files":26,"snapshotRoot":"/var/folders/1m/77x7hnqs7_v2kqkcdk0s_v2m0000gn/T/nisli-native-runtime-1d055cabdffb"}
```

## Behavior probes

Command:

```sh
pnpm exec vitest run --config docs/research/2026-10-framework-authoring/experiments/native-runtime/vitest.config.ts probe.test.ts
```

Exit code: `0`. **PASS: 11 checks; includes observed Slider defect and work counts, not 11 new features.**

Full output:

```text
[33mThe CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.[39m

 RUN  v2.1.9 /Users/goga/Documents/goga/nisli

stdout | docs/research/2026-10-framework-authoring/experiments/native-runtime/probe.test.ts > compares existing computed view with runtime retention, including unfinished input
{"case":"same template","baselineRetainsInput":false,"prototypeRetainsInput":true}

stdout | docs/research/2026-10-framework-authoring/experiments/native-runtime/probe.test.ts > actual Progress and render variant agree over value, max, class and plain-HTML updates
{"case":"actual Progress variant","originalComputedDeclarations":5,"variantComputedDeclarations":0,"controlledStates":5,"attributeStates":2}

stdout | docs/research/2026-10-framework-authoring/experiments/native-runtime/probe.test.ts > current typed factory callbacks remain data, so blanket auto-invocation is unsound
{"case":"function-valued props","blanketInvocationWouldExecuteAction":true}

stdout | docs/research/2026-10-framework-authoring/experiments/native-runtime/probe.test.ts > records actual Slider setup snapshots: live declared min/max inputs do not reach the native control
{"case":"actual Slider snapshots","requested":[20,200,5],"native":["0","100","1"]}

stdout | docs/research/2026-10-framework-authoring/experiments/native-runtime/probe.test.ts > render retention can still rerun unrelated expensive calculations
{"case":"calculation counts","region":[2,2],"local":[2,1]}

 ✓ docs/research/2026-10-framework-authoring/experiments/native-runtime/probe.test.ts (11 tests) 29ms

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  23:36:00
   Duration  304ms (transform 50ms, setup 0ms, collect 74ms, tests 29ms, environment 76ms, prepare 26ms)

```

## Falsification of simple retention

Command:

```sh
pnpm exec vitest run --config docs/research/2026-10-framework-authoring/experiments/native-runtime/vitest.config.ts falsify.test.ts
```

Exit code: `1`. **FAIL (intentional deliverable): both required assertions fail. The original adapter is insufficient; no assertions were weakened.**

Full output:

```text
[33mThe CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.[39m

 RUN  v2.1.9 /Users/goga/Documents/goga/nisli

stdout | docs/research/2026-10-framework-authoring/experiments/native-runtime/falsify.test.ts > REQUIRED: child factory state survives an unrelated parent-render update
{"case":"nested factory","setups":2,"retainsInput":false,"value":"seed"}

stdout | docs/research/2026-10-framework-authoring/experiments/native-runtime/falsify.test.ts > REQUIRED: the blanket same-template policy distinguishes different document identities without a supplied key
{"case":"document identity","selected":"B","draft":"draft belonging to A"}

 ❯ docs/research/2026-10-framework-authoring/experiments/native-runtime/falsify.test.ts (2 tests | 2 failed) 20ms
   × REQUIRED: child factory state survives an unrelated parent-render update 17ms
     → retaining the outer template must not recreate its child factory: expected <input value="seed"></input> to be <input value="seed"></input> // Object.is equality

If it should pass with deep equality, replace "toBe" with "toStrictEqual"

Expected: <input value="seed"></input>
Received: serializes to the same string

   × REQUIRED: the blanket same-template policy distinguishes different document identities without a supplied key 2ms
     → the new document must not inherit the previous document draft: expected 'draft belonging to A' to be 'seed' // Object.is equality

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  docs/research/2026-10-framework-authoring/experiments/native-runtime/falsify.test.ts > REQUIRED: child factory state survives an unrelated parent-render update
AssertionError: retaining the outer template must not recreate its child factory: expected <input value="seed"></input> to be <input value="seed"></input> // Object.is equality

If it should pass with deep equality, replace "toBe" with "toStrictEqual"

Expected: <input value="seed"></input>
Received: serializes to the same string


Compared values have no visual difference.

 ❯ docs/research/2026-10-framework-authoring/experiments/native-runtime/falsify.test.ts:16:107
     14|   const input = host.querySelector('input')!; input.value = 'unfinishe…
     15|   console.log(JSON.stringify({case:'nested factory',setups,retainsInpu…
     16|   expect(host.querySelector('input'), 'retaining the outer template mu…
       |                                                                                                           ^
     17|   expect(setups).toBe(1);
     18| });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  docs/research/2026-10-framework-authoring/experiments/native-runtime/falsify.test.ts > REQUIRED: the blanket same-template policy distinguishes different document identities without a supplied key
AssertionError: the new document must not inherit the previous document draft: expected 'draft belonging to A' to be 'seed' // Object.is equality

Expected: "seed"
Received: "draft belonging to A"

 ❯ docs/research/2026-10-framework-authoring/experiments/native-runtime/falsify.test.ts:27:111
     25|   host.querySelector('input')!.value = 'draft belonging to A'; selecte…
     26|   console.log(JSON.stringify({case:'document identity',selected:host.q…
     27|   expect(host.querySelector('input')!.value, 'the new document must no…
       |                                                                                                               ^
     28| });
     29| 

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

 Test Files  1 failed (1)
      Tests  2 failed (2)
   Start at  23:36:08
   Duration  341ms (transform 60ms, setup 0ms, collect 89ms, tests 20ms, environment 90ms, prepare 24ms)

```

## Factory-retention refinement

Command:

```sh
pnpm exec vitest run --config docs/research/2026-10-framework-authoring/experiments/native-runtime/vitest.config.ts refined.test.ts
```

Exit code: `0`. **PASS: 5 checks. N202 warning remains visible; not a diagnostic-free integration.**

Full output:

```text
[33mThe CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.[39m

 RUN  v2.1.9 /Users/goga/Documents/goga/nisli

stdout | docs/research/2026-10-framework-authoring/experiments/native-runtime/refined.test.ts > retains a stateful factory and forwards new plain props and captured callbacks
{"case":"refined child factory","setups":1,"preservesDraft":true,"freshCallback":true}

stderr | docs/research/2026-10-framework-authoring/experiments/native-runtime/refined.test.ts > retains a stateful factory and forwards new plain props and captured callbacks
[nisli N202] <research-refined-child> prop 'onSave' was set but setup() never read it — misspelled or unsupported prop? { tag: 'research-refined-child', key: 'onSave' }

 ✓ docs/research/2026-10-framework-authoring/experiments/native-runtime/refined.test.ts (5 tests) 22ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  23:38:21
   Duration  347ms (transform 51ms, setup 0ms, collect 66ms, tests 22ms, environment 119ms, prepare 29ms)

```

## Native browser execution

Command:

```sh
node docs/research/2026-10-framework-authoring/experiments/native-runtime/run-browser.mjs
```

Exit code: `0`. **PASS: 19 checks in each of Chromium, Firefox and WebKit; application/prototype modules served unchanged. Core library separately bundled for browser use.**

Full output:

```text
{"commit":"1d055cabdffbea8ff8d82cbfd88a6081882ca8b2","libraryArtifact":"bundled frozen core with production define","applicationModules":[{"name":"browser.mjs","servedUnmodified":true,"sha256":"4697d4c13c6f325fc100f5c42296115260979de5ebb99dffc284993f43e14f0c"},{"name":"prototype.mjs","servedUnmodified":true,"sha256":"6129420eb5cb1c1a0d1d2168731f985e80a128c58be38d44bd7fb91bdc040a0f"},{"name":"factory-retention.mjs","servedUnmodified":true,"sha256":"a9da090b0c056ace7d18b39690896164bdfa5d68b88de22a4e57bb39791c0c8d"}]}
{"browser":"chromium","version":"149.0.7827.55","checks":[{"name":"region retains node","actual":true,"expected":true,"pass":true},{"name":"region retains focus","actual":true,"expected":true,"pass":true},{"name":"region retains selection","actual":"2:5","expected":"2:5","pass":true},{"name":"region retains draft","actual":"unfinished","expected":"unfinished","pass":true},{"name":"region updates calculation","actual":"6","expected":"6","pass":true},{"name":"disposed region stops updating","actual":"6","expected":"6","pass":true},{"name":"local callback tracks in native ESM","actual":"9","expected":"9","pass":true},{"name":"actual Input writes current value","actual":"server","expected":"server","pass":true},{"name":"actual Input retains initial default","actual":"initial","expected":"initial","pass":true},{"name":"actual Input native reset","actual":"initial","expected":"initial","pass":true},{"name":"attribute update preserves dirty current value","actual":"typed","expected":"typed","pass":true},{"name":"attribute update changes reset default","actual":"server","expected":"server","pass":true},{"name":"native reset follows new attribute","actual":"server","expected":"server","pass":true},{"name":"actual Slider snapshot reproduced","actual":"0:100:1","expected":"0:100:1","pass":true},{"name":"refined factory retains native input","actual":true,"expected":true,"pass":true},{"name":"refined factory retains focus","actual":true,"expected":true,"pass":true},{"name":"refined factory retains selection","actual":"1:4","expected":"1:4","pass":true},{"name":"refined factory runs setup once","actual":1,"expected":1,"pass":true},{"name":"refined factory uses latest callback","actual":"B","expected":"B","pass":true}],"errors":[]}
{"browser":"firefox","version":"151.0","checks":[{"name":"region retains node","actual":true,"expected":true,"pass":true},{"name":"region retains focus","actual":true,"expected":true,"pass":true},{"name":"region retains selection","actual":"2:5","expected":"2:5","pass":true},{"name":"region retains draft","actual":"unfinished","expected":"unfinished","pass":true},{"name":"region updates calculation","actual":"6","expected":"6","pass":true},{"name":"disposed region stops updating","actual":"6","expected":"6","pass":true},{"name":"local callback tracks in native ESM","actual":"9","expected":"9","pass":true},{"name":"actual Input writes current value","actual":"server","expected":"server","pass":true},{"name":"actual Input retains initial default","actual":"initial","expected":"initial","pass":true},{"name":"actual Input native reset","actual":"initial","expected":"initial","pass":true},{"name":"attribute update preserves dirty current value","actual":"typed","expected":"typed","pass":true},{"name":"attribute update changes reset default","actual":"server","expected":"server","pass":true},{"name":"native reset follows new attribute","actual":"server","expected":"server","pass":true},{"name":"actual Slider snapshot reproduced","actual":"0:100:1","expected":"0:100:1","pass":true},{"name":"refined factory retains native input","actual":true,"expected":true,"pass":true},{"name":"refined factory retains focus","actual":true,"expected":true,"pass":true},{"name":"refined factory retains selection","actual":"1:4","expected":"1:4","pass":true},{"name":"refined factory runs setup once","actual":1,"expected":1,"pass":true},{"name":"refined factory uses latest callback","actual":"B","expected":"B","pass":true}],"errors":[]}
{"browser":"webkit","version":"26.5","checks":[{"name":"region retains node","actual":true,"expected":true,"pass":true},{"name":"region retains focus","actual":true,"expected":true,"pass":true},{"name":"region retains selection","actual":"2:5","expected":"2:5","pass":true},{"name":"region retains draft","actual":"unfinished","expected":"unfinished","pass":true},{"name":"region updates calculation","actual":"6","expected":"6","pass":true},{"name":"disposed region stops updating","actual":"6","expected":"6","pass":true},{"name":"local callback tracks in native ESM","actual":"9","expected":"9","pass":true},{"name":"actual Input writes current value","actual":"server","expected":"server","pass":true},{"name":"actual Input retains initial default","actual":"initial","expected":"initial","pass":true},{"name":"actual Input native reset","actual":"initial","expected":"initial","pass":true},{"name":"attribute update preserves dirty current value","actual":"typed","expected":"typed","pass":true},{"name":"attribute update changes reset default","actual":"server","expected":"server","pass":true},{"name":"native reset follows new attribute","actual":"server","expected":"server","pass":true},{"name":"actual Slider snapshot reproduced","actual":"0:100:1","expected":"0:100:1","pass":true},{"name":"refined factory retains native input","actual":true,"expected":true,"pass":true},{"name":"refined factory retains focus","actual":true,"expected":true,"pass":true},{"name":"refined factory retains selection","actual":"1:4","expected":"1:4","pass":true},{"name":"refined factory runs setup once","actual":1,"expected":1,"pass":true},{"name":"refined factory uses latest callback","actual":"B","expected":"B","pass":true}],"errors":[]}
{"failures":0,"verdict":"PASS"}
```
