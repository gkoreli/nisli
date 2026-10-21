# Bundle-contract experiments

## Verdict

The issue is reproduced against the exact published package. Runtime detection
repair alone does not remove the auditor. Publisher-owned bundler/native profiles
pass the tested removal, behavior, package-resolution and safety contracts.
Conditional exports alone and mixed full-runtime entrypoints fail their proposed
contracts; those negative results are deliverables.

## Reproduction prerequisites

Run from repository root after pnpm install. The scripts use the installed pinned
esbuild 0.28.1 and Vite 7.3.6 paths and require Node VM modules, happy-dom and
Playwright browsers (Chromium, Firefox, WebKit). Native/browser checks require
local listening and browser-launch permission. First run run.mjs to create
generated profiles. Download the published baseline with:

```sh
npm pack @nisli/core@0.56.0 --ignore-scripts --pack-destination docs/research/2026-10-production-diagnostics/experiments/bundle-contract/generated --json
```

The tarball SHA-256 and emitted-bundle hashes are preserved in
[integration-results.json](integration-results.json). The exact upstream counter
and entry files are copied in upstream/ from commit
4e7bc14ff9bc52bb06c706d71ca4b635e2effbfa of gkoreli/blog.

Follow with integration.mjs, optimizer.mjs, and regression.mjs. All scripts write
only their research outputs and generated fixtures; they do not edit package source.
Integration resets its own candidate-package and installed-consumer directories,
then runs pnpm pack and an offline npm install. Generated artifacts are ignored.

## Scope limits

See [the report](../../REPORT.md) for compatibility decisions and outstanding
release gates. Full root gates, source/declaration typechecking of a shipping
implementation, HMR/SSG/CDN integration and remote CI were not run or claimed.
The source was commit 4afde49c728a330e10ce887a38b8013d63b58498. The final emitted
prototype is a disposable architecture experiment, not accepted framework source.

## Core baseline

Command: `pnpm --filter @nisli/core test`

PASS: 21 files / 465 tests.

Full output ([standalone log](core-baseline-tests.txt)):

```text

> @nisli/core@0.56.0 test /Users/goga/Documents/goga/nisli/packages/core
> vitest run


 RUN  v2.1.9 /Users/goga/Documents/goga/nisli/packages/core

 ✓ src/view-transition.test.ts (13 tests) 13ms
stderr | src/element-context.test.ts > createContext — through the component model > a reader with no provider renders the error boundary
[nisli N401] <rc-reader> setup failed: Context "Rc" not found: <rc-reader> must be rendered inside a provider that calls RcContext.provide(host, …). {
  tag: 'rc-reader',
  phase: 'setup',
  error: Error: Context "Rc" not found: <rc-reader> must be rendered inside a provider that calls RcContext.provide(host, …).
      at Object.inject (/Users/goga/Documents/goga/nisli/packages/core/src/element-context.ts:137:13)
      at /Users/goga/Documents/goga/nisli/packages/core/src/element-context.test.ts:218:24
      at /Users/goga/Documents/goga/nisli/packages/core/src/component.ts:507:36
      at Module.runWithContext (/Users/goga/Documents/goga/nisli/packages/core/src/context.ts:44:5)
      at /Users/goga/Documents/goga/nisli/packages/core/src/component.ts:504:11
      at Module.untrack (/Users/goga/Documents/goga/nisli/packages/core/src/signal.ts:714:12)
      at FrameworkComponent.connectedCallback (/Users/goga/Documents/goga/nisli/packages/core/src/component.ts:476:7)
      at CustomElementReactionStack.enqueueReaction (file:///Users/goga/Documents/goga/nisli/node_modules/.pnpm/happy-dom@20.8.9/node_modules/happy-dom/src/custom-element/CustomElementReactionStack.ts:52:80)
      at FrameworkComponent.[connectedToDocument] (file:///Users/goga/Documents/goga/nisli/node_modules/.pnpm/happy-dom@20.8.9/node_modules/happy-dom/src/nodes/element/Element.ts:1534:74)
      at FrameworkComponent.[connectedToDocument] (file:///Users/goga/Documents/goga/nisli/node_modules/.pnpm/happy-dom@20.8.9/node_modules/happy-dom/src/nodes/html-element/HTMLElement.ts:1008:44)
}

 ✓ src/element-context.test.ts (18 tests) 43ms
 ✓ src/component.test.ts (41 tests) 97ms
 ✓ src/signal.test.ts (65 tests) 144ms
 ✓ src/query.test.ts (29 tests) 104ms
 ✓ src/template.test.ts (75 tests) 113ms
 ✓ src/each.test.ts (23 tests) 129ms
 ✓ src/projection.test.ts (12 tests) 49ms
 ✓ src/invariants.test.ts (63 tests) 156ms
 ✓ src/injector.test.ts (21 tests) 11ms
 ✓ src/context.test.ts (8 tests) 3ms
 ✓ src/emitter.test.ts (15 tests) 11ms
 ✓ src/el.test.ts (12 tests) 36ms
 ✓ src/lifecycle.test.ts (9 tests) 20ms
 ✓ src/hmr/registry.test.ts (3 tests) 20ms
 ✓ src/template-audit.test.ts (16 tests) 148ms
 ✓ src/settle.test.ts (10 tests) 190ms
 ✓ src/vite-hmr/plugin.test.ts (6 tests) 2ms
 ✓ src/diagnostics.test.ts (8 tests) 3ms
 ✓ src/ref.test.ts (6 tests) 12ms
 ✓ src/resource.test.ts (12 tests) 535ms

 Test Files  21 passed (21)
      Tests  465 passed (465)
   Start at  23:11:22
   Duration  2.35s (transform 765ms, setup 0ms, collect 2.06s, tests 1.84s, environment 8.29s, prepare 2.12s)

```

## Full bundle matrix

Command: `node --experimental-vm-modules docs/research/2026-10-production-diagnostics/experiments/bundle-contract/run.mjs`

PASS: 14 VM and Chromium cases; zero audit bytes in static production; four safety profiles.

Full output ([standalone log](output.txt)):

```text
(node:65993) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
ENVIRONMENT {"node":"v22.23.2","esbuild":"0.28.1","happyDom":"20.8.9","commit":"4afde49c728a330e10ce887a38b8013d63b58498"}
┌─────────┬───────────────────────────────┬───────┬───────┬────────────┬──────────┬────────┐
│ (index) │ name                          │ bytes │ gzip  │ auditBytes │ n102Text │ codes  │
├─────────┼───────────────────────────────┼───────┼───────┼────────────┼──────────┼────────┤
│ 0       │ 'current-minify'              │ 23516 │ 8334  │ 2806       │ true     │ 'N102' │
│ 1       │ 'current-node-env'            │ 23516 │ 8334  │ 2806       │ true     │ 'N102' │
│ 2       │ 'current-meta'                │ 23529 │ 8337  │ 2810       │ true     │ '-'    │
│ 3       │ 'current-runtime-off'         │ 23516 │ 8334  │ 2806       │ true     │ '-'    │
│ 4       │ 'probe-only-minify'           │ 23515 │ 8318  │ 2806       │ true     │ '-'    │
│ 5       │ 'helper-false'                │ 23511 │ 8335  │ 2806       │ true     │ '-'    │
│ 6       │ 'static-auto-prod'            │ 18698 │ 6378  │ 0          │ false    │ '-'    │
│ 7       │ 'static-explicit-prod'        │ 18698 │ 6378  │ 0          │ false    │ '-'    │
│ 8       │ 'static-prod-override-on'     │ 18698 │ 6378  │ 0          │ false    │ '-'    │
│ 9       │ 'static-dev-minified'         │ 23298 │ 8243  │ 2806       │ true     │ 'N102' │
│ 10      │ 'static-auto-dev'             │ 49190 │ 12687 │ 5011       │ true     │ 'N102' │
│ 11      │ 'static-dev-off'              │ 23298 │ 8243  │ 2806       │ true     │ '-'    │
│ 12      │ 'native-dev-bundled-neutral'  │ 23298 │ 8243  │ 2806       │ true     │ 'N102' │
│ 13      │ 'native-prod-bundled-neutral' │ 18698 │ 6376  │ 0          │ false    │ '-'    │
└─────────┴───────────────────────────────┴───────┴───────┴────────────┴──────────┴────────┘
SAFETY [{"profile":"current","codes":["N401","N402","N302","N301","N310"],"result":{"errors":{"doubleMount":"N105","unbranded":"N106","invalidQueryKey":"N602","noSanitizer":"N107"},"lifecycle":{"setup":"N401","mount":"N402"},"loop":{"settled":true,"disposed":true},"di":{"first":1,"error":"N501"},"duplicate":{"error":"N201"}},"asyncRejectionReported":true},{"profile":"static-bundler","codes":["N401","N402"],"result":{"errors":{"doubleMount":"N105","unbranded":"N106","invalidQueryKey":"N602","noSanitizer":"N107"},"lifecycle":{"setup":"N401","mount":"N402"},"loop":{"settled":true,"disposed":true},"di":{"first":1,"next":2},"duplicate":{"error":null}},"asyncRejectionReported":true},{"profile":"static-dev","codes":["N401","N402","N302","N301","N310"],"result":{"errors":{"doubleMount":"N105","unbranded":"N106","invalidQueryKey":"N602","noSanitizer":"N107"},"lifecycle":{"setup":"N401","mount":"N402"},"loop":{"settled":true,"disposed":true},"di":{"first":1,"error":"N501"},"duplicate":{"error":"N201"}},"asyncRejectionReported":true},{"profile":"static-prod","codes":["N401","N402"],"result":{"errors":{"doubleMount":"N105","unbranded":"N106","invalidQueryKey":"N602","noSanitizer":"N107"},"lifecycle":{"setup":"N401","mount":"N402"},"loop":{"settled":true,"disposed":true},"di":{"first":1,"next":2},"duplicate":{"error":null}},"asyncRejectionReported":true}]
BROWSER {"version":"149.0.7827.55","rows":[{"name":"current-minify","codes":["N102"],"counter":"Count: 1","process":"undefined"},{"name":"current-node-env","codes":["N102"],"counter":"Count: 1","process":"undefined"},{"name":"current-meta","codes":[],"counter":"Count: 1","process":"undefined"},{"name":"current-runtime-off","codes":[],"counter":"Count: 1","process":"undefined"},{"name":"probe-only-minify","codes":[],"counter":"Count: 1","process":"undefined"},{"name":"helper-false","codes":[],"counter":"Count: 1","process":"undefined"},{"name":"static-auto-prod","codes":[],"counter":"Count: 1","process":"undefined"},{"name":"static-explicit-prod","codes":[],"counter":"Count: 1","process":"undefined"},{"name":"static-prod-override-on","codes":[],"counter":"Count: 1","process":"undefined"},{"name":"static-dev-minified","codes":["N102"],"counter":"Count: 1","process":"undefined"},{"name":"static-auto-dev","codes":["N102"],"counter":"Count: 1","process":"undefined"},{"name":"static-dev-off","codes":[],"counter":"Count: 1","process":"undefined"},{"name":"native-dev-bundled-neutral","codes":["N102"],"counter":"Count: 1","process":"undefined"},{"name":"native-prod-bundled-neutral","codes":[],"counter":"Count: 1","process":"undefined"}]}
PASS: full counter matrix, emitted audit removal, safety behavior, and real Chromium interaction.
```

## Packed/native integration

Command: `node --experimental-vm-modules docs/research/2026-10-production-diagnostics/experiments/bundle-contract/integration.mjs`

PASS: exact published hashes, same-fixture prototype, packed esbuild/Vite, three browsers, native safety, shared canonical runtime. Conditional exports and mixed-runtime hypotheses fail their desired contracts, as asserted.

Full output ([standalone log](integration-output.txt)):

```text
(node:67817) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
PUBLISHED REPRODUCTION [{"name":"published-minify","profile":"published","bytes":23654,"gzip":8379,"auditBytes":2806,"n102Text":true,"stackCapture":true,"sha256":"75125cf5dbf4de7a75643e3f2a3c897d118156eb702bf1f74d7c8849e6bbebb1","codes":["N102"],"counter":"Count: 1","expectedN102":true},{"name":"published-node-env","profile":"published","bytes":23654,"gzip":8379,"auditBytes":2806,"n102Text":true,"stackCapture":true,"sha256":"75125cf5dbf4de7a75643e3f2a3c897d118156eb702bf1f74d7c8849e6bbebb1","codes":["N102"],"counter":"Count: 1","expectedN102":true},{"name":"published-meta","profile":"published","bytes":23667,"gzip":8384,"auditBytes":2810,"n102Text":true,"stackCapture":true,"sha256":"128f201d69bc634f935efebf8734d917cb510fb10bbb185195cf653ef00928a0","codes":[],"counter":"Count: 1","expectedN102":false},{"name":"published-runtime-off","profile":"published","bytes":23683,"gzip":8389,"auditBytes":2810,"n102Text":true,"stackCapture":true,"sha256":"93e0baaa4087e87f8dfcb60625a36017550cc8dbc2ad8598d7f47bb4b637a4b5","codes":[],"counter":"Count: 1","expectedN102":false}]
SAME FIXTURE PROTOTYPE {"name":"prototype-upstream-fixture","profile":"static-bundler","bytes":18620,"gzip":6349,"auditBytes":0,"n102Text":false,"stackCapture":false,"sha256":"814e95bf2f4a0ed5501924d81f7e40c7415090ce4e9b0aff07687e359f9bcd25"}
PACKED CONSUMER {"exports":{".":"./dist/bundler/index.js","./browser/development":"./dist/browser/dev.js","./browser/production":"./dist/browser/prod.js"},"bytes":18698,"gzip":6378,"diagnostics":false,"auditBytes":0}
VITE PRODUCTION {"version":"7.3.6","bytes":18895,"gzip":6372,"diagnostics":false}
CONDITIONAL EXPORT FALSIFICATION [{"name":"esbuild-nonminified","selected":"production"},{"name":"esbuild-node-env-development","selected":"production"},{"name":"esbuild-development-condition","selected":"development"}]
REAL BROWSER {"engine":"chromium","version":"149.0.7827.55","cases":[{"name":"native-dev","codes":["N102"],"passed":true},{"name":"native-prod","codes":[],"passed":true},{"name":"native-prod-safety","codes":["N401","N402"],"passed":true},{"name":"packed-esbuild","codes":[],"passed":true},{"name":"packed-vite","codes":[],"passed":true},{"name":"published-minify","codes":["N102"],"passed":true},{"name":"published-node-env","codes":["N102"],"passed":true},{"name":"published-meta","codes":[],"passed":true},{"name":"published-runtime-off","codes":[],"passed":true}],"mixedProfilesLoseDIOverride":true,"canonicalImportMapSharesRuntime":true}
REAL BROWSER {"engine":"firefox","version":"151.0","cases":[{"name":"native-dev","codes":["N102"],"passed":true},{"name":"native-prod","codes":[],"passed":true},{"name":"native-prod-safety","codes":["N401","N402"],"passed":true},{"name":"packed-esbuild","codes":[],"passed":true},{"name":"packed-vite","codes":[],"passed":true},{"name":"published-minify","codes":["N102"],"passed":true},{"name":"published-node-env","codes":["N102"],"passed":true},{"name":"published-meta","codes":[],"passed":true},{"name":"published-runtime-off","codes":[],"passed":true}],"mixedProfilesLoseDIOverride":true,"canonicalImportMapSharesRuntime":true}
REAL BROWSER {"engine":"webkit","version":"26.5","cases":[{"name":"native-dev","codes":["N102"],"passed":true},{"name":"native-prod","codes":[],"passed":true},{"name":"native-prod-safety","codes":["N401","N402"],"passed":true},{"name":"packed-esbuild","codes":[],"passed":true},{"name":"packed-vite","codes":[],"passed":true},{"name":"published-minify","codes":["N102"],"passed":true},{"name":"published-node-env","codes":["N102"],"passed":true},{"name":"published-meta","codes":[],"passed":true},{"name":"published-runtime-off","codes":[],"passed":true}],"mixedProfilesLoseDIOverride":true,"canonicalImportMapSharesRuntime":true}
PASS: published reproduction, pnpm pack/install, two bundlers, native ESM and safety in three browsers; two alternatives falsified.
```

## Optimizer falsification

Command: `node --experimental-vm-modules docs/research/2026-10-production-diagnostics/experiments/bundle-contract/optimizer.mjs`

PASS: two successful local-static controls and two preserved negative removal results.

Full output ([standalone log](optimizer-output.txt)):

```text
[
  {
    "name": "local-literal",
    "source": {
      "entry": "const DEV=false; function audit(){console.log(\"audit sentinel\")} if(DEV) audit();"
    },
    "output": "(()=>{})();\n",
    "auditRetained": false
  },
  {
    "name": "local-node-env",
    "source": {
      "entry": "const DEV=process.env.NODE_ENV!==\"production\"; function audit(){console.log(\"audit sentinel\")} if(DEV) audit();"
    },
    "output": "(()=>{})();\n",
    "auditRetained": false
  },
  {
    "name": "safe-runtime-fallback",
    "source": {
      "entry": "const DEV=typeof process===\"undefined\" || process.env.NODE_ENV!==\"production\"; function audit(){console.log(\"audit sentinel\")} if(DEV) audit();"
    },
    "output": "(()=>{var n=typeof process>\"u\"||!1;function o(){console.log(\"audit sentinel\")}n&&o();})();\n",
    "auditRetained": true
  },
  {
    "name": "imported-constant",
    "source": {
      "entry": "import { DEV } from \"env\"; function audit(){console.log(\"audit sentinel\")} if(DEV) audit();",
      "env": "export const DEV=false;"
    },
    "output": "(()=>{function t(){console.log(\"audit sentinel\")}!1;})();\n",
    "auditRetained": true
  }
]
PASS: local static guards remove the sentinel; safe runtime fallback and imported constants fail this removal contract in esbuild 0.28.1.
```

## Unchanged development regression suite

Command: `node --experimental-vm-modules docs/research/2026-10-production-diagnostics/experiments/bundle-contract/regression.mjs`

PASS: 21 files / 465 tests for each of two prototype profiles.

Full output ([standalone log](regression-output.txt)):

```text
stderr | element-context.test.ts > createContext — through the component model > a reader with no provider renders the error boundary
[nisli N401] <rc-reader> setup failed: Context "Rc" not found: <rc-reader> must be rendered inside a provider that calls RcContext.provide(host, …). {
  tag: 'rc-reader',
  phase: 'setup',
  error: Error: Context "Rc" not found: <rc-reader> must be rendered inside a provider that calls RcContext.provide(host, …).
      at Object.inject (/Users/goga/Documents/goga/nisli/docs/research/2026-10-production-diagnostics/experiments/bundle-contract/generated/regression/static-dev/element-context.js:22:13)
      at /Users/goga/Documents/goga/nisli/docs/research/2026-10-production-diagnostics/experiments/bundle-contract/generated/regression/static-dev/element-context.test.ts:218:24
      at /Users/goga/Documents/goga/nisli/docs/research/2026-10-production-diagnostics/experiments/bundle-contract/generated/regression/static-dev/component.js:138:36
      at Module.runWithContext (/Users/goga/Documents/goga/nisli/docs/research/2026-10-production-diagnostics/experiments/bundle-contract/generated/regression/static-dev/context.js:6:5)
      at /Users/goga/Documents/goga/nisli/docs/research/2026-10-production-diagnostics/experiments/bundle-contract/generated/regression/static-dev/component.js:137:11
      at Module.untrack (/Users/goga/Documents/goga/nisli/docs/research/2026-10-production-diagnostics/experiments/bundle-contract/generated/regression/static-dev/signal.js:261:12)
      at FrameworkComponent.connectedCallback (/Users/goga/Documents/goga/nisli/docs/research/2026-10-production-diagnostics/experiments/bundle-contract/generated/regression/static-dev/component.js:132:45)
      at CustomElementReactionStack.enqueueReaction (file:///Users/goga/Documents/goga/nisli/node_modules/.pnpm/happy-dom@20.8.9/node_modules/happy-dom/src/custom-element/CustomElementReactionStack.ts:52:80)
      at FrameworkComponent.[connectedToDocument] (file:///Users/goga/Documents/goga/nisli/node_modules/.pnpm/happy-dom@20.8.9/node_modules/happy-dom/src/nodes/element/Element.ts:1534:74)
      at FrameworkComponent.[connectedToDocument] (file:///Users/goga/Documents/goga/nisli/node_modules/.pnpm/happy-dom@20.8.9/node_modules/happy-dom/src/nodes/html-element/HTMLElement.ts:1008:44)
}

static-dev  Test Files  21 passed (21)
      Tests  465 passed (465)
   Start at  23:14:40
   Duration  2.05s (transform 639ms, setup 0ms, collect 1.41s, tests 2.18s, environment 5.98s, prepare 1.78s)


stderr | element-context.test.ts > createContext — through the component model > a reader with no provider renders the error boundary
[nisli N401] <rc-reader> setup failed: Context "Rc" not found: <rc-reader> must be rendered inside a provider that calls RcContext.provide(host, …). {
  tag: 'rc-reader',
  phase: 'setup',
  error: Error: Context "Rc" not found: <rc-reader> must be rendered inside a provider that calls RcContext.provide(host, …).
      at Object.inject (/Users/goga/Documents/goga/nisli/docs/research/2026-10-production-diagnostics/experiments/bundle-contract/generated/regression/static-bundler/element-context.js:22:13)
      at /Users/goga/Documents/goga/nisli/docs/research/2026-10-production-diagnostics/experiments/bundle-contract/generated/regression/static-bundler/element-context.test.ts:218:24
      at /Users/goga/Documents/goga/nisli/docs/research/2026-10-production-diagnostics/experiments/bundle-contract/generated/regression/static-bundler/component.js:138:36
      at Module.runWithContext (/Users/goga/Documents/goga/nisli/docs/research/2026-10-production-diagnostics/experiments/bundle-contract/generated/regression/static-bundler/context.js:6:5)
      at /Users/goga/Documents/goga/nisli/docs/research/2026-10-production-diagnostics/experiments/bundle-contract/generated/regression/static-bundler/component.js:137:11
      at Module.untrack (/Users/goga/Documents/goga/nisli/docs/research/2026-10-production-diagnostics/experiments/bundle-contract/generated/regression/static-bundler/signal.js:261:12)
      at FrameworkComponent.connectedCallback (/Users/goga/Documents/goga/nisli/docs/research/2026-10-production-diagnostics/experiments/bundle-contract/generated/regression/static-bundler/component.js:132:45)
      at CustomElementReactionStack.enqueueReaction (file:///Users/goga/Documents/goga/nisli/node_modules/.pnpm/happy-dom@20.8.9/node_modules/happy-dom/src/custom-element/CustomElementReactionStack.ts:52:80)
      at FrameworkComponent.[connectedToDocument] (file:///Users/goga/Documents/goga/nisli/node_modules/.pnpm/happy-dom@20.8.9/node_modules/happy-dom/src/nodes/element/Element.ts:1534:74)
      at FrameworkComponent.[connectedToDocument] (file:///Users/goga/Documents/goga/nisli/node_modules/.pnpm/happy-dom@20.8.9/node_modules/happy-dom/src/nodes/html-element/HTMLElement.ts:1008:44)
}

static-bundler  Test Files  21 passed (21)
      Tests  465 passed (465)
   Start at  23:14:42
   Duration  1.66s (transform 499ms, setup 0ms, collect 1.25s, tests 1.97s, environment 5.50s, prepare 1.46s)


```

## pnpm pack (invoked by integration.mjs)

Command: `pnpm pack --pack-destination <generated/packed> (cwd: generated/package-candidate)`

PASS: publishConfig root points to bundler JS. This is a research package, not a published release.

Full output ([standalone log](pack-output.txt)):

```text
📦  @nisli/core@0.56.0-research
Tarball Contents
dist/browser/dev.js
dist/browser/prod.js
dist/bundler/component.js
dist/bundler/context.js
dist/bundler/diagnostics.js
dist/bundler/disposable.js
dist/bundler/element-context.js
dist/bundler/emitter.js
dist/bundler/hmr/registry.js
dist/bundler/hmr/transform.js
dist/bundler/index.js
dist/bundler/injector.js
dist/bundler/lifecycle.js
dist/bundler/package.json
dist/bundler/projection.js
dist/bundler/query.js
dist/bundler/ref.js
dist/bundler/resource.js
dist/bundler/settle.js
dist/bundler/signal.js
dist/bundler/template-audit.js
dist/bundler/template.js
dist/bundler/view-transition.js
dist/bundler/vite-hmr/plugin.js
dist/bundler/vite-hmr/runtime.js
package.json
Tarball Details
/Users/goga/Documents/goga/nisli/docs/research/2026-10-production-diagnostics/experiments/bundle-contract/generated/packed/nisli-core-0.56.0-research.tgz
```

## Offline consumer install (invoked by integration.mjs)

Command: `npm install --offline --ignore-scripts --no-audit --no-fund <generated/packed/nisli-core-0.56.0-research.tgz>`

PASS: separate consumer installs the newly packed archive.

Full output ([standalone log](install-output.txt)):

```text

added 1 package in 199ms
```

## Harness failures retained

The following failed attempts were not architectural verdicts. Browser globals,
repeat-run path resolution, execution permissions and console observation were
repaired without weakening the required behaviors. The passing output above is
from the final scripts.

### initial-harness-failure.txt

Command: `node --experimental-vm-modules docs/research/2026-10-production-diagnostics/experiments/bundle-contract/run.mjs`

Verdict: harness failure. VM browser model omitted CustomEvent; added that actual browser global.

```text
(node:61121) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
ENVIRONMENT {"node":"v22.23.2","esbuild":"0.28.1","happyDom":"20.8.9","commit":"4afde49c728a330e10ce887a38b8013d63b58498"}
┌─────────┬───────────────────────────────┬───────┬───────┬────────────┬──────────┬────────┐
│ (index) │ name                          │ bytes │ gzip  │ auditBytes │ n102Text │ codes  │
├─────────┼───────────────────────────────┼───────┼───────┼────────────┼──────────┼────────┤
│ 0       │ 'current-minify'              │ 23516 │ 8334  │ 2806       │ true     │ 'N102' │
│ 1       │ 'current-node-env'            │ 23516 │ 8334  │ 2806       │ true     │ 'N102' │
│ 2       │ 'current-meta'                │ 23529 │ 8337  │ 2810       │ true     │ '-'    │
│ 3       │ 'current-runtime-off'         │ 23516 │ 8334  │ 2806       │ true     │ '-'    │
│ 4       │ 'probe-only-minify'           │ 23515 │ 8318  │ 2806       │ true     │ '-'    │
│ 5       │ 'helper-false'                │ 23511 │ 8335  │ 2806       │ true     │ '-'    │
│ 6       │ 'static-auto-prod'            │ 18698 │ 6378  │ 0          │ false    │ '-'    │
│ 7       │ 'static-explicit-prod'        │ 18698 │ 6378  │ 0          │ false    │ '-'    │
│ 8       │ 'static-prod-override-on'     │ 18698 │ 6378  │ 0          │ false    │ '-'    │
│ 9       │ 'static-dev-minified'         │ 23298 │ 8243  │ 2806       │ true     │ 'N102' │
│ 10      │ 'static-auto-dev'             │ 49190 │ 12687 │ 5011       │ true     │ 'N102' │
│ 11      │ 'static-dev-off'              │ 23298 │ 8243  │ 2806       │ true     │ '-'    │
│ 12      │ 'native-dev-bundled-neutral'  │ 23298 │ 8243  │ 2806       │ true     │ 'N102' │
│ 13      │ 'native-prod-bundled-neutral' │ 18698 │ 6376  │ 0          │ false    │ '-'    │
└─────────┴───────────────────────────────┴───────┴───────┴────────────┴──────────┴────────┘
safety-current:2
`);for(let n=1;n<t.length;n++){let r=t[n].trim();if(r&&!(r.includes("captureDefineSite")||/[/\\]component\.(?:ts|js)\b/.test(r)))return r}return"(site unavailable)"}function B(e,t,...[n]){let r=new Map,i=new Map;if(n?.attrs)for(let c of Object.keys(n.attrs)){let o=n.attrs[c],l=st(c,o),u={key:c,attrName:l,decl:o};r.set(l,u),i.set(c,u)}let a=Array.from(r.keys());class s extends HTMLElement{_host=null;_propsProxy=null;_mounted=!1;_templateResult=null;_errorTemplateResult=null;_teardownScheduled=!1;_setupDone=!1;_echoed=null;_pinned=new Set;_relocating=!1;static get observedAttributes(){return a}constructor(){super(),this._propsProxy=it()}_applyAttr(o,l){if(le(o.decl)==="forward"){l!==null&&(this._pinned.has(o.key)||this._propsProxy.setProperty(o.key,l),this._relocating=!0,this.removeAttribute(o.attrName),this._relocating=!1);return}this._pinned.has(o.key)||this._propsProxy.setProperty(o.key,De(o.decl,l))}_seedAttrs(){for(let o of r.values())this._applyAttr(o,this.getAttribute(o.attrName))}attributeChangedCallback(o,l,u){if(this._relocating)return;let p=r.get(o);p&&this._applyAttr(p,u)}connectedCallback(){this._mounted||(this._mounted=!0,E(()=>{let o=new ue(this);this._host=o,r.size&&this._seedAttrs(),this.childNodes.length&&(this.__capturedChildren=Array.from(this.childNodes));let l="setup";try{oe(o,()=>{this._templateResult=t(this._propsProxy.props,this)}),this._templateResult&&$e(this,this._templateResult,o);let u=this;if(u.__nisliProjectionSweep){let p=u.__nisliProjectionSweep;u.__nisliProjectionSweep=void 0,p()}l="mount",Me(o),this._setupDone=!0,this.removeAttribute("data-nisli-error")}catch(u){let p=u instanceof Error?u:new Error(String(u)),w=l==="setup"?"N401":"N402";if(T(w,`<${e}> ${l} failed: ${p.message}`,{tag:e,phase:l,error:p}),this.__nisliProjectionSweep=void 0,this._templateResult?.dispose&&this._templateResult.dispose(),this._templateResult=null,o.dispose(),this._host=null,this.replaceChildren(),this.setAttribute("data-nisli-error",w),n?.onError)try{let d=n.onError(p,this);typeof d=="string"?this.innerHTML=d:(this._errorTemplateResult=d,$e(this,d))}catch{this._errorTemplateResult?.dispose&&this._errorTemplateResult.dispose(),this._errorTemplateResult=null,this.innerHTML=`<div style="color:red;padding:4px">Error in &lt;${e}&gt;</div>`}else this.innerHTML=`<div style="color:red;padding:4px">Error in &lt;${e}&gt;</div>`;this.dispatchEvent(new CustomEvent("nisli-error",{bubbles:!0,composed:!0,detail:{code:w,tag:e,phase:l,message:p.message}}))}}))}disconnectedCallback(){this._teardownScheduled||(this._teardownScheduled=!0,queueMicrotask(()=>{this._teardownScheduled=!1,!this.isConnected&&this._teardownNow()}))}connectedMoveCallback(){}_teardownNow(){this._mounted=!1,this._setupDone=!1,this._templateResult?.dispose&&this._templateResult.dispose(),this._templateResult=null,this._errorTemplateResult?.dispose&&this._errorTemplateResult.dispose(),this._errorTemplateResult=null,this._host&&(this._host.dispose(),this._host=null);let o=this.__capturedChildren??[];this.replaceChildren(...o)}_remount(){this._teardownScheduled=!1,this._teardownNow(),this.connectedCallback()}_setProp(o,l){if(this._setupDone&&l!==void 0&&g()&&!i.has(o)&&!this._propsProxy.readKeys.has(o)&&!(this._echoed??=new Set).has(o)&&(this._echoed.add(o),T("N202",`<${e}> prop '${o}' was set but setup() never read it \u2014 misspelled or unsupported prop?`,{tag:e,key:o})),l===void 0){this._pinned.delete(o);let u=i.get(o);if(u){let p=this.getAttribute(u.attrName);p===null&&le(u.decl)==="forward"?this._propsProxy?.setProperty(o,De(u.decl,null)):this._applyAttr(u,p);return}}else this._pinned.add(o);this._propsProxy?.setProperty(o,l)}_propSignal(o){return this._propsProxy.props[o]}_isPinned(o){return this._pinned.has(o)}}if(!customElements.get(e))customElements.define(e,s),g()&&je.set(e,at());else if(g()&&!t.__nisliHmr){let c=je.get(e)??"(unknown site \u2014 defined outside component(), or before dev mode was enabled)";throw new Error(A("N201",`duplicate define for <${e}>. First defined ${c}; the second definition site is this error's own stack. The first definition stays live (first-wins) \u2014 rename one of the components.`))}return(c,o)=>({__type:"factory",tagName:e,props:c,hostAttrs:o})}function Pe(e){return y(e)?e:v(e)}function $e(e,t,n){if(t&&typeof t=="object"&&"mount"in t&&typeof t.mount=="function")t.mount(e);else if(t&&typeof t=="object"&&"__type"in t){let r=t,i=document.createElement(r.tagName);for(let[a,s]of Object.entries(r.props)){let c=Pe(s);i._setProp(a,c.value);let o=c.subscribe(l=>{i._setProp(a,l)});n&&n.addDisposer(o)}if(r.hostAttrs?.class!=null){let a=Pe(r.hostAttrs.class);Oe(i,"",a.value);let s=a.value,c=a.subscribe(o=>{Oe(i,s,o),s=o});n&&n.addDisposer(c)}e.appendChild(i)}}function Oe(e,t,n){let r=t?t.split(/\s+/).filter(Boolean):[],i=n?n.split(/\s+/).filter(Boolean):[];for(let a of r)i.includes(a)||e.classList.remove(a);for(let a of i)r.includes(a)||e.classList.add(a)}var ct=Symbol.for("backlog.ref");function de(e){return e!==null&&typeof e=="object"&&ct in e}var lt=null;function X(){return lt??g()}function W(e,t,n){X()&&T(e,t,n===void 0?void 0:{detail:n})}var fe=new WeakMap;function Be(e){if(!X()||fe.has(e))return;let t=(new Error().stack??"").split(`


ReferenceError: CustomEvent is not defined
    at safety-current:2:2394
    at E (safety-current:1:4934)
    at s.connectedCallback (safety-current:2:1153)
    at CustomElementReactionStack.enqueueReaction (file:///Users/goga/Documents/goga/nisli/node_modules/.pnpm/happy-dom@20.8.9/node_modules/happy-dom/lib/custom-element/CustomElementReactionStack.js:43:90)
    at [connectedToDocument] (file:///Users/goga/Documents/goga/nisli/node_modules/.pnpm/happy-dom@20.8.9/node_modules/happy-dom/lib/nodes/element/Element.js:1140:80)
    at [connectedToDocument] (file:///Users/goga/Documents/goga/nisli/node_modules/.pnpm/happy-dom@20.8.9/node_modules/happy-dom/lib/nodes/html-element/HTMLElement.js:812:50)
    at [connectedToNode] (file:///Users/goga/Documents/goga/nisli/node_modules/.pnpm/happy-dom@20.8.9/node_modules/happy-dom/lib/nodes/node/Node.js:794:53)
    at [appendChild] (file:///Users/goga/Documents/goga/nisli/node_modules/.pnpm/happy-dom@20.8.9/node_modules/happy-dom/lib/nodes/node/Node.js:413:45)
    at [appendChild] (file:///Users/goga/Documents/goga/nisli/node_modules/.pnpm/happy-dom@20.8.9/node_modules/happy-dom/lib/nodes/element/Element.js:1028:62)
    at HTMLDivElement.appendChild (file:///Users/goga/Documents/goga/nisli/node_modules/.pnpm/happy-dom@20.8.9/node_modules/happy-dom/lib/nodes/node/Node.js:306:48)

Node.js v22.23.2
```

### rerun-resolution-failure.txt

Command: `node --experimental-vm-modules docs/research/2026-10-production-diagnostics/experiments/bundle-contract/run.mjs`

Verdict: harness failure. Directory alias collided with a generated JS consumer file on repeat execution; selected index.js explicitly.

```text
(node:61199) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
helper-false:3
`).slice(1).find(r=>r.includes("at ")&&!/template(-audit)?\.(ts|js|mjs|cjs)/.test(r));z.set(e,t?t.trim():"(unknown callsite)")}var ee=new WeakSet,te=new Set(["stop","prevent","once","enter","escape","space","tab"]),re=["ui-","nisli-"],qe=new Set(["focusin","focusout"]),Ve=new Set(["id","class","style","slot","title","role","tabindex","name","part","hidden","dir","lang","is"]);function Fe(e){let t={off:!1,allowUndefined:new Set};for(let r of e.childNodes){if(r.nodeType===Node.TEXT_NODE){if((r.textContent??"").trim()==="")continue;break}if(r.nodeType===Node.COMMENT_NODE){let n=(r.textContent??"").trim();if(!n.startsWith("nisli-audit"))break;let o=n.slice(11).trim();if(o==="off")t.off=!0;else if(o.startsWith("allow-undefined")){let l=o.slice(15).replace(/^[:\s]+/,"").split(/[\s,]+/).filter(Boolean);for(let i of l)t.allowUndefined.add(i.toLowerCase())}}break}return t}function Ue(e,t){let r;try{r=customElements}catch{return}if(!r||r.get(e))return;let n=!1;try{r.whenDefined(e).then(()=>{n=!0},()=>{})}catch{A("N101",`<${e}> is not a valid custom element name \u2014 at ${t}`);return}queueMicrotask(()=>{n||setTimeout(()=>{try{if(!R()||n||r.get(e))return;A("N101",`<${e}> is used in a template but never defined (customElements.get returned undefined after grace) \u2014 at ${t}. If this tag is a lazily-loaded island, suppress with a leading <!-- nisli-audit allow-undefined: ${e} --> comment.`)}catch{}},0)})}function Ie(e,t,r){let n=t.slice(1).split("."),o=n[0]??"",l=n.slice(1),i=`on${o}`in e||qe.has(o),a=re.some(s=>o.startsWith(s));o&&!i&&!a&&A("N102",`@${o} on <${e.tagName.toLowerCase()}> is not a known native event (and not an allowlisted ${re.join("/")} component event) \u2014 at ${r}`);for(let s of l)te.has(s)||A("N103",`unknown event modifier ".${s}" in "${t}" \u2014 known: ${[...te].join(", ")} \u2014 at ${r}`)}function Ke(e,t,r,n){t.startsWith("data-")||t.startsWith("aria-")||Ve.has(t)||r.includes(t)||A("N104",`<${e}> declares attributes [${r.join(", ")}] but the template sets unknown "${t}" \u2014 at ${n}. Undeclared names route through _setProp and are silently dead as attributes.`)}function Je(e,t){if(!R()||ee.has(e))return;ee.add(e);let r=z.get(e)??"(unknown callsite)",n=t.content,o=Fe(n);if(!o.off)for(let l of n.querySelectorAll("*")){let i=l.tagName.toLowerCase(),a=i.includes("-");a&&!o.allowUndefined.has(i)&&Ue(i,r);let s;if(a){let u=customElements.get(i)?.observedAttributes;Array.isArray(u)&&u.length>0&&(s=u)}for(let u of[...l.attributes]){let c=u.name;if(c.startsWith("@")){Ie(l,c,r);continue}c.startsWith("class:")||c==="ref"||c==="html:inner"||s&&Ke(i,c,s,r)}}}function Xe(e){let t;return S(()=>{t=e()}),t}function Ze(e){return typeof e=="object"&&e!==null&&"__raw"in e&&e.__raw===!0&&typeof e.value=="string"}function D(e){return typeof e=="object"&&e!==null&&"__sanitize"in e&&e.__sanitize===!0&&typeof e.value=="string"}var Ge=null,Qe=(e,t)=>{e.setHTML(t)};function se(e){let t=typeof Element=="function"?Element.prototype.setHTML:void 0;return typeof t=="function"&&e.setHTML===t?Qe:Ge}function Ye(e){let t=globalThis.trustedTypes;return t!==void 0&&t.isHTML(e)}function P(e,t){return new Error(`[nisli] ${e}: ${t}`)}var ne=new WeakMap,et=0;function tt(e,t){let r=ne.get(e);if(r)return r;let n="",o=!1,l=null;for(let i=0;i<e.length;i++){let a=e[i]??"";for(let s=0;s<a.length;s++){let u=a.charAt(s);l?u===l&&(l=null):o?u===">"?o=!1:(u==='"'||u==="'")&&(l=u):u==="<"&&(o=!0)}if(n+=a,i<t){let s=o&&!l&&/=\s*$/.test(a);n+=s?`"${ie(i)}"`:ie(i)}}return et++,r=document.createElement("template"),r.innerHTML=n,ne.set(e,r),Je(e,r),r}var q="<!--bk-",rt="-->";function ie(e){return`${q}${e}${rt}`}function ce(e,...t){let r=[],n=[];ze(e);let o=!1;return{__templateResult:!0,mount(l){if(o&&t.length>0)throw P("N105",`mount() on an already-mounted TemplateResult with ${t.length} value binding(s) \u2014 dispose() it first or create a fresh template per mount. Template starts: ${JSON.stringify((e[0]??"").slice(0,60))}`);o=!0;let i=tt(e,t.length).content.cloneNode(!0);de(i,t,r,n),l.appendChild(i)},dispose(){for(let l of n)try{l()}catch{}n.length=0;for(let l of r)if("dispose"in l&&l.dispose)try{l.dispose()}catch{}r.length=0,o=!1}}}function de(e,t,r,n){if(e.nodeType===Node.ELEMENT_NODE&&st(e,t,r,n),e.nodeType===Node.COMMENT_NODE){let l=e,i=l.textContent||"";if(i.startsWith("bk-")&&!isNaN(Number(i.slice(3)))){let a=Number(i.slice(3)),s=t[a];nt(l,s,r,n);return}}let o=[...e.childNodes];for(let l of o)de(l,t,r,n)}function st(e,t,r,n){let o=[];for(let l of[...e.attributes]){let i=l.name,a=l.value;if(i.startsWith("@")){let s=i.slice(1).split("."),u=s[0]??"",c=s.slice(1),p=a.match(/<!--bk-(\d+)-->/);if(p){let b=Number(p[1]),d=t[b];typeof d=="function"&&ut(e,u,d,c,r)}o.push(i);continue}if(i.startsWith("class:")){let s=i.slice(6),u=a.match(/<!--bk-(\d+)-->/);if(u){let c=Number(u[1]),p=t[c];lt(e,s,p,r,n)}o.push(i);continue}if(i==="html:inner"){let s=a.match(/<!--bk-(\d+)-->/);if(s){let u=Number(s[1]),c=t[u];at(e,c,r,n)}o.push(i);continue}if(i==="ref"&&a.includes(q)){let s=a.match(/<!--bk-(\d+)-->/);if(s){let u=Number(s[1]),c=t[u];Oe(c)&&(c.current=e,n.push(()=>{c.current=null}))}o.push(i);continue}if(a.includes(q)){let s=[...a.matchAll(/<!--bk-(\d+)-->/g)];if(s.length){let u=s[0];if(s.length===1&&u&&a===u[0])oe(e,i,t[Number(u[1])],r,n);else{let c=()=>a.replace(/<!--bk-(\d+)-->/g,(b,d)=>{let y=t[Number(d)],k=_(y)?y.value:y;return k==null||k===!1?"":String(k)}),p=s.some(b=>_(t[Number(b[1])]));oe(e,i,p?Ce(c):c(),r,n)}}continue}}for(let l of o)e.removeAttribute(l)}function j(e){let t=document.createElement(e.tagName),r=[];for(let[n,o]of Object.entries(e.props))if(_(o)){let l=o.subscribe(i=>{t._setProp?.(n,i)});r.push(l)}else t._setProp?.(n,o);if(e.hostAttrs?.class!=null){let n=e.hostAttrs.class;if(_(n)){let o=n,l=[],i=s=>{let u=s?s.split(/\s+/).filter(Boolean):[];for(let c of l)u.includes(c)||t.classList.remove(c);for(let c of u)l.includes(c)||t.classList.add(c);l=u},a=o.subscribe(i);r.push(a)}else if(typeof n=="string"&&n)for(let o of n.split(/\s+/).filter(Boolean))t.classList.add(o)}return{element:t,dispose(){for(let n of r.splice(0))try{n()}catch{}}}}function nt(e,t,r,n){let o=e.parentNode;if(o)if(_(t)){let l=document.createComment("slot-start"),i=document.createComment("slot-end");o.replaceChild(i,e),o.insertBefore(l,i);let a=[],s=[],u=[],c=null,p=Symbol("not-rendered"),b=w(()=>{let d=t.value,y=i.parentNode;if(!y||d===p)return;p=d;let k=!!(d&&typeof d=="object"&&"__templateResult"in d),U=!!(d&&typeof d=="object"&&"__type"in d&&d.__type==="factory");if(d!=null&&d!==!1&&!Array.isArray(d)&&!k&&!U&&c){c.data=String(d);return}for(let f of a)try{f.dispose()}catch{}for(let f of u)try{f()}catch{}for(let f of s)f.parentNode?.removeChild(f);if(s=[],a=[],u=[],c=null,d!=null)if(Array.isArray(d)){for(let f of d)if(f&&typeof f=="object"&&"__templateResult"in f){let m=f,L=document.createDocumentFragment();m.mount(L);let fe=[...L.childNodes];s.push(...fe),a.push(m),y.insertBefore(L,i)}else if(f&&typeof f=="object"&&"__type"in f&&f.__type==="factory"){let m=j(f);s.push(m.element),u.push(m.dispose),y.insertBefore(m.element,i)}else if(f!=null&&f!==!1){let m=document.createTextNode(String(f));s.push(m),y.insertBefore(m,i)}}else if(k){let f=d,m=document.createDocumentFragment();f.mount(m),s=[...m.childNodes],a.push(f),y.insertBefore(m,i)}else if(U){let f=j(d);s.push(f.element),u.push(f.dispose),y.insertBefore(f.element,i)}else d!==!1&&(c=document.createTextNode(String(d)),s.push(c),y.insertBefore(c,i))});n.push(b),n.push(()=>{for(let d of a.splice(0))try{d.dispose()}catch{}for(let d of u.splice(0))try{d()}catch{}s=[],c=null})}else if(t&&typeof t=="object"&&"__templateResult"in t){let l=t,i=document.createComment("tpl-start"),a=document.createComment("tpl-end");o.replaceChild(a,e),o.insertBefore(i,a);let s=document.createDocumentFragment();l.mount(s),o.insertBefore(s,a),n.push(()=>l.dispose())}else if(t&&typeof t=="object"&&"__type"in t&&t.__type==="factory"){let l=j(t);o.replaceChild(l.element,e),n.push(l.dispose)}else if(Array.isArray(t)){let l=document.createComment("list-start"),i=document.createComment("list-end");o.replaceChild(i,e),o.insertBefore(l,i);for(let a of t)if(a&&typeof a=="object"&&"__templateResult"in a){let s=document.createDocumentFragment();a.mount(s),o.insertBefore(s,i),n.push(()=>a.dispose())}else if(a&&typeof a=="object"&&"__type"in a&&a.__type==="factory"){let s=j(a);o.insertBefore(s.element,i),n.push(s.dispose)}else{let s=document.createTextNode(String(a));o.insertBefore(s,i)}}else if(t==null||t===!1)o.removeChild(e);else{let l=document.createTextNode(String(t));o.replaceChild(l,e)}}function oe(e,t,r,n,o){if(t==="class"){ot(e,r,n,o);return}if(!(t==="id"||t==="style"||t==="slot"||t==="title"||t==="role"||t==="tabindex"||t==="name"||t.startsWith("data-")||t.startsWith("aria-"))&&typeof e._setProp=="function"){if(_(r)){let l={type:"attribute",element:e,name:t};n.push(l);let i=w(()=>{e._setProp(t,r.value)});l.dispose=i,o.push(i)}else e._setProp(t,r);return}it(e,t,r,n,o)}function it(e,t,r,n,o){if(_(r)){let l={type:"attribute",element:e,name:t};n.push(l);let i=w(()=>{let a=r.value;a==null||a===!1?e.removeAttribute(t):a===!0?e.setAttribute(t,""):e.setAttribute(t,String(a))});l.dispose=i,o.push(i)}else r==null||r===!1?e.removeAttribute(t):r===!0?e.setAttribute(t,""):e.setAttribute(t,String(r))}function ot(e,t,r,n){let o=!1,l=[],i=a=>{o||(e.setAttribute("class",""),o=!0);let s=(a==null||a===!1?"":String(a)).split(/\s+/).filter(Boolean);for(let u of l)s.includes(u)||e.classList.remove(u);for(let u of s)l.includes(u)||e.classList.add(u);l=s};if(_(t)){let a={type:"attribute",element:e,name:"class"};r.push(a);let s=w(()=>{i(t.value)});a.dispose=s,n.push(s)}else i(t)}function lt(e,t,r,n,o){if(_(r)){let l={type:"class",element:e,className:t};n.push(l);let i=w(()=>{let a=r.value;e.classList.toggle(t,!!a)});l.dispose=i,o.push(i)}else e.classList.toggle(t,!!r)}function at(e,t,r,n){let o=i=>{if(i==null)return"";if(Ze(i)){if(D(i))throw P("N106","html:inner rejects a value branded both raw() and sanitized() \u2014 the trust decision is ambiguous. Pick one brand.");return i.value}if(D(i)){if(se(e)===null)throw P("N107","html:inner cannot render sanitized() markup: this engine has no native Element.setHTML() and no fallback is registered. Wire one at startup \u2014 setSanitizerFallback((el, html) => { el.innerHTML = DOMPurify.sanitize(html) }) \u2014 nisli ships no sanitizer and will not fall back to innerHTML.");return i}if(Ye(i))return i;throw P("N106",`html:inner rejects unbranded values (got ${typeof i}). Wrap trusted markup in raw(html), untrusted markup in sanitized(html) \u2014 and never wrap user-generated input in raw().`)},l=i=>{let a=o(i);if(D(a)){se(e)?.(e,a.value);return}e.innerHTML=a};if(_(t)){Xe(()=>o(t.value));let i={type:"innerHtml",element:e};r.push(i);let a=w(()=>{l(t.value)});i.dispose=a,n.push(a)}else l(t)}function ut(e,t,r,n,o){let l,i=r;if(n.includes("stop")){let a=i;i=s=>{s.stopPropagation(),a(s)}}if(n.includes("prevent")){let a=i;i=s=>{s.preventDefault(),a(s)}}if(n.includes("once")){let a=i;i=s=>{e.removeEventListener(t,l),a(s)}}for(let a of n)if(["enter","escape","space","tab"].includes(a)){let s={enter:"Enter",escape:"Escape",space:" ",tab:"Tab"},u=i;i=c=>{c.key===s[a]&&u(c)}}l=a=>{try{S(()=>i(a))}catch(s){console.error(`Event handler error for '${t}':`,s)}},e.addEventListener(t,l),o.push({type:"event",element:e,eventName:t,handler:l,modifiers:n,dispose:()=>e.removeEventListener(t,l)})}var ct=new Set;function dt(){ct.clear()}je(dt);globalThis.overrideMode!==void 0&&me(globalThis.overrideMode);var ft=We("repro-counter",()=>{let e=F(0),t=()=>{e.value+=1};return ce`<button id="counter" @click=${t} @clik=${t}>Count: ${e}</button>`});ce`${ft({})}`.mount(document.querySelector("#app"));globalThis.overrideMode!==void 0&&(void 0)(globalThis.overrideMode);var pt=(void 0)("repro-counter",()=>{let e=(void 0)(0),t=()=>{e.value+=1};return(void 0)`<button id="counter" @click=${t} @clik=${t}>Count: ${e}</button>`});(void 0)`${pt({})}`.mount(document.querySelector("#app"));


TypeError: (void 0) is not a function
    at helper-false:3:11855
    at SourceTextModule.evaluate (node:internal/vm/module:219:26)
    at vmRun (file:///Users/goga/Documents/goga/nisli/docs/research/2026-10-production-diagnostics/experiments/bundle-contract/run.mjs:142:16)
    at async file:///Users/goga/Documents/goga/nisli/docs/research/2026-10-production-diagnostics/experiments/bundle-contract/run.mjs:177:22

Node.js v22.23.2
```

### browser-sandbox-failure.txt

Command: `node --experimental-vm-modules docs/research/2026-10-production-diagnostics/experiments/bundle-contract/run.mjs`

Verdict: harness failure. Chromium launch was denied by the sandbox; approved unsandboxed execution passed.

```text
(node:61237) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
ENVIRONMENT {"node":"v22.23.2","esbuild":"0.28.1","happyDom":"20.8.9","commit":"4afde49c728a330e10ce887a38b8013d63b58498"}
┌─────────┬───────────────────────────────┬───────┬───────┬────────────┬──────────┬────────┐
│ (index) │ name                          │ bytes │ gzip  │ auditBytes │ n102Text │ codes  │
├─────────┼───────────────────────────────┼───────┼───────┼────────────┼──────────┼────────┤
│ 0       │ 'current-minify'              │ 23516 │ 8334  │ 2806       │ true     │ 'N102' │
│ 1       │ 'current-node-env'            │ 23516 │ 8334  │ 2806       │ true     │ 'N102' │
│ 2       │ 'current-meta'                │ 23529 │ 8337  │ 2810       │ true     │ '-'    │
│ 3       │ 'current-runtime-off'         │ 23516 │ 8334  │ 2806       │ true     │ '-'    │
│ 4       │ 'probe-only-minify'           │ 23515 │ 8318  │ 2806       │ true     │ '-'    │
│ 5       │ 'helper-false'                │ 23511 │ 8335  │ 2806       │ true     │ '-'    │
│ 6       │ 'static-auto-prod'            │ 18698 │ 6378  │ 0          │ false    │ '-'    │
│ 7       │ 'static-explicit-prod'        │ 18698 │ 6378  │ 0          │ false    │ '-'    │
│ 8       │ 'static-prod-override-on'     │ 18698 │ 6378  │ 0          │ false    │ '-'    │
│ 9       │ 'static-dev-minified'         │ 23298 │ 8243  │ 2806       │ true     │ 'N102' │
│ 10      │ 'static-auto-dev'             │ 49190 │ 12687 │ 5011       │ true     │ 'N102' │
│ 11      │ 'static-dev-off'              │ 23298 │ 8243  │ 2806       │ true     │ '-'    │
│ 12      │ 'native-dev-bundled-neutral'  │ 23298 │ 8243  │ 2806       │ true     │ 'N102' │
│ 13      │ 'native-prod-bundled-neutral' │ 18698 │ 6376  │ 0          │ false    │ '-'    │
└─────────┴───────────────────────────────┴───────┴───────┴────────────┴──────────┴────────┘
SAFETY [{"profile":"current","codes":["N401","N402","N302","N301"],"result":{"errors":{"doubleMount":"N105","unbranded":"N106","noSanitizer":"N107"},"lifecycle":{"setup":"N401","mount":"N402"},"loop":{"settled":true,"disposed":true},"di":{"first":1,"error":"N501"},"duplicate":{"error":"N201"}}},{"profile":"static-bundler","codes":["N401","N402"],"result":{"errors":{"doubleMount":"N105","unbranded":"N106","noSanitizer":"N107"},"lifecycle":{"setup":"N401","mount":"N402"},"loop":{"settled":true,"disposed":true},"di":{"first":1,"next":2},"duplicate":{"error":null}}},{"profile":"static-dev","codes":["N401","N402","N302","N301"],"result":{"errors":{"doubleMount":"N105","unbranded":"N106","noSanitizer":"N107"},"lifecycle":{"setup":"N401","mount":"N402"},"loop":{"settled":true,"disposed":true},"di":{"first":1,"error":"N501"},"duplicate":{"error":"N201"}}},{"profile":"static-prod","codes":["N401","N402"],"result":{"errors":{"doubleMount":"N105","unbranded":"N106","noSanitizer":"N107"},"lifecycle":{"setup":"N401","mount":"N402"},"loop":{"settled":true,"disposed":true},"di":{"first":1,"next":2},"duplicate":{"error":null}}}]
node:internal/modules/run_main:123
    triggerUncaughtException(
    ^

browserType.launch: Target page, context or browser has been closed
Browser logs:

<launching> /Users/goga/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/var/folders/1m/77x7hnqs7_v2kqkcdk0s_v2m0000gn/T/playwright_chromiumdev_profile-tnrql3 --remote-debugging-pipe --no-startup-window
<launched> pid=61259
[pid=61259][err] [1020/230901.326279:ERROR:base/power_monitor/thermal_state_observer_mac.mm:140] ThermalStateObserverMac unable to register to power notifications. Result: 9
[pid=61259][err] [1020/230901.328031:ERROR:net/dns/dns_config_service_posix.cc:138] DNS config watch failed to start.
[pid=61259][err] [1020/230901.328510:WARNING:net/dns/dns_config_service_posix.cc:197] Failed to read DnsConfig.
[pid=61259][err] [1020/230901.328479:FATAL:base/apple/mach_port_rendezvous_mac.cc:159] Check failed: kr == KERN_SUCCESS. bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer.61259: Permission denied (1100)
Call log:
[2m  - <launching> /Users/goga/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/var/folders/1m/77x7hnqs7_v2kqkcdk0s_v2m0000gn/T/playwright_chromiumdev_profile-tnrql3 --remote-debugging-pipe --no-startup-window[22m
[2m  - <launched> pid=61259[22m
[2m  - [pid=61259][err] [1020/230901.326279:ERROR:base/power_monitor/thermal_state_observer_mac.mm:140] ThermalStateObserverMac unable to register to power notifications. Result: 9[22m
[2m  - [pid=61259][err] [1020/230901.328031:ERROR:net/dns/dns_config_service_posix.cc:138] DNS config watch failed to start.[22m
[2m  - [pid=61259][err] [1020/230901.328510:WARNING:net/dns/dns_config_service_posix.cc:197] Failed to read DnsConfig.[22m
[2m  - [pid=61259][err] [1020/230901.328479:FATAL:base/apple/mach_port_rendezvous_mac.cc:159] Check failed: kr == KERN_SUCCESS. bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer.61259: Permission denied (1100)[22m
[2m  - [pid=61259] <gracefully close start>[22m
[2m  - [pid=61259] <kill>[22m
[2m  - [pid=61259] <will force kill>[22m
[2m  - [pid=61259] exception while trying to kill process: Error: kill EPERM[22m
[2m  - [pid=61259] <process did exit: exitCode=null, signal=SIGTRAP>[22m
[2m  - [pid=61259] starting temporary directories cleanup[22m
[2m  - [pid=61259] finished temporary directories cleanup[22m
[2m  - [pid=61259] <gracefully close end>[22m

    at /Users/goga/Documents/goga/nisli/docs/research/2026-10-production-diagnostics/experiments/bundle-contract/run.mjs:210:32 {
  log: [
    '  - <launching> /Users/goga/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/var/folders/1m/77x7hnqs7_v2kqkcdk0s_v2m0000gn/T/playwright_chromiumdev_profile-tnrql3 --remote-debugging-pipe --no-startup-window',
    '  - <launched> pid=61259',
    '  - [pid=61259][err] [1020/230901.326279:ERROR:base/power_monitor/thermal_state_observer_mac.mm:140] ThermalStateObserverMac unable to register to power notifications. Result: 9',
    '  - [pid=61259][err] [1020/230901.328031:ERROR:net/dns/dns_config_service_posix.cc:138] DNS config watch failed to start.',
    '  - [pid=61259][err] [1020/230901.328510:WARNING:net/dns/dns_config_service_posix.cc:197] Failed to read DnsConfig.',
    '  - [pid=61259][err] [1020/230901.328479:FATAL:base/apple/mach_port_rendezvous_mac.cc:159] Check failed: kr == KERN_SUCCESS. bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer.61259: Permission denied (1100)',
    '  - [pid=61259] <gracefully close start>',
    '  - [pid=61259] <kill>',
    '  - [pid=61259] <will force kill>',
    '  - [pid=61259] exception while trying to kill process: Error: kill EPERM',
    '  - [pid=61259] <process did exit: exitCode=null, signal=SIGTRAP>',
    '  - [pid=61259] starting temporary directories cleanup',
    '  - [pid=61259] finished temporary directories cleanup',
    '  - [pid=61259] <gracefully close end>'
  ]
}

Node.js v22.23.2
```

### firefox-console-format-failure.txt

Command: `node --experimental-vm-modules docs/research/2026-10-production-diagnostics/experiments/bundle-contract/integration.mjs`

Verdict: harness failure. Protocol-level console observation did not prove the async-error message in Firefox. Synchronous recording of original console arguments in the page preserves the same assertion and passes.

```text
(node:66162) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
PUBLISHED REPRODUCTION [{"name":"published-minify","profile":"published","bytes":23654,"gzip":8379,"auditBytes":2806,"n102Text":true,"stackCapture":true,"sha256":"75125cf5dbf4de7a75643e3f2a3c897d118156eb702bf1f74d7c8849e6bbebb1","codes":["N102"],"counter":"Count: 1","expectedN102":true},{"name":"published-node-env","profile":"published","bytes":23654,"gzip":8379,"auditBytes":2806,"n102Text":true,"stackCapture":true,"sha256":"75125cf5dbf4de7a75643e3f2a3c897d118156eb702bf1f74d7c8849e6bbebb1","codes":["N102"],"counter":"Count: 1","expectedN102":true},{"name":"published-meta","profile":"published","bytes":23667,"gzip":8384,"auditBytes":2810,"n102Text":true,"stackCapture":true,"sha256":"128f201d69bc634f935efebf8734d917cb510fb10bbb185195cf653ef00928a0","codes":[],"counter":"Count: 1","expectedN102":false},{"name":"published-runtime-off","profile":"published","bytes":23683,"gzip":8389,"auditBytes":2810,"n102Text":true,"stackCapture":true,"sha256":"93e0baaa4087e87f8dfcb60625a36017550cc8dbc2ad8598d7f47bb4b637a4b5","codes":[],"counter":"Count: 1","expectedN102":false}]
SAME FIXTURE PROTOTYPE {"name":"prototype-upstream-fixture","profile":"static-bundler","bytes":18620,"gzip":6349,"auditBytes":0,"n102Text":false,"stackCapture":false,"sha256":"814e95bf2f4a0ed5501924d81f7e40c7415090ce4e9b0aff07687e359f9bcd25"}
PACKED CONSUMER {"exports":{".":"./dist/bundler/index.js","./browser/development":"./dist/browser/dev.js","./browser/production":"./dist/browser/prod.js"},"bytes":18698,"gzip":6378,"diagnostics":false,"auditBytes":0}
VITE PRODUCTION {"version":"7.3.6","bytes":18895,"gzip":6372,"diagnostics":false}
CONDITIONAL EXPORT FALSIFICATION [{"name":"esbuild-nonminified","selected":"production"},{"name":"esbuild-node-env-development","selected":"production"},{"name":"esbuild-development-condition","selected":"development"}]
REAL BROWSER {"engine":"chromium","version":"149.0.7827.55","cases":[{"name":"native-dev","codes":["N102"],"passed":true},{"name":"native-prod","codes":[],"passed":true},{"name":"native-prod-safety","codes":["N401","N402"],"passed":true},{"name":"packed-esbuild","codes":[],"passed":true},{"name":"packed-vite","codes":[],"passed":true},{"name":"published-minify","codes":["N102"],"passed":true},{"name":"published-node-env","codes":["N102"],"passed":true},{"name":"published-meta","codes":[],"passed":true},{"name":"published-runtime-off","codes":[],"passed":true}],"mixedProfilesLoseDIOverride":true,"canonicalImportMapSharesRuntime":true}
node:internal/modules/run_main:123
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:

  assert(messages.some(m=>m.includes('Effect error:')&&m.includes('async rejection sentinel')))

    at file:///Users/goga/Documents/goga/nisli/docs/research/2026-10-production-diagnostics/experiments/bundle-contract/integration.mjs:167:11 {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: false,
  expected: true,
  operator: '==',
  diff: 'simple'
}

Node.js v22.23.2
```
