# A distribution contract for development diagnostics

Implementation follow-through: the user approved engineering after this report.
The contract is now implemented and released as core 0.57.0; see
[ADR 0048](../../adr/0048-production-diagnostic-artifacts.md) and the
[engineering evidence](../../worklists/core/ISSUE-3-PRODUCTION-DIAGNOSTICS.md).
The measurements below remain the original research/prototype results, not
measurements of the final implementation. The engineering evidence records the
successful release CI, publishing run, and downloaded npm artifact verification.

## Recommendation

Make diagnostic availability a property of the **library artifact**, with runtime
controls limited to diagnostics that artifact contains. Publish, from one source:

1. **Bundler ESM**: development instrumentation sits behind direct, statically
   replaceable `process.env.NODE_ENV !== 'production'` guards. Normal esbuild and
   Vite production builds remove it without Nisli-specific consumer flags.
2. **Native-browser development ESM**: guards are resolved to development when
   Nisli publishes it. Works directly in browsers, loud by default, with runtime
   suppression and restoration.
3. **Native-browser production ESM**: guards are resolved and development code
   removed when Nisli publishes it. No environment probe, process shim, application
   compiler, or framework plugin is required by the browser application.

Keep component, signal, template, lifecycle, and error-containment implementations
shared. These are delivery profiles of one runtime, not different authoring modes.
Application JavaScript remains identical across the native profiles; an import-map
target selects the artifact. This follows the
[framework design tenets](../../adr/0030-agent-native-authoring.md#1-design-tenets-the-lens), including browser-native authoring, the small
root import surface, and failure containment.

This supersedes the earlier suggestion to add a consumer `__NISLI_DEV__` define.
The package should own the boundary and support normal toolchain conventions.

## Reproduction and measured evidence

Downloaded the actual `@nisli/core@0.56.0` tarball with `npm pack`, rather than
assuming workspace source represented the published artifact. Used the exact
counter and entry files from the issue's pinned upstream fixture. Ran emitted ESM
in fresh VM contexts with happy-dom and no `process`, then repeated the behavior
in Chromium, Firefox, and WebKit.

| Published-package configuration | N102 | Bytes | Gzip level 9 | Audit module bytes |
| --- | --- | ---: | ---: | ---: |
| esbuild browser + minify | Yes | 23,654 | 8,379 | 2,806 |
| Explicit NODE_ENV production | Yes | 23,654 | 8,379 | 2,806 |
| Explicit import.meta.env production object | No | 23,667 | 8,384 | 2,810 |
| setDevMode(false) | No | 23,683 | 8,389 | 2,810 |

All four emitted SHA-256 hashes match the issue's recorded results exactly, despite
using local Node 22.23.2, esbuild 0.28.1 and happy-dom 20.8.9 instead of the original
Node 24 / esbuild 0.27.3 or 0.28.2 / happy-dom 20.14.6. This is an independent
reproduction on the available toolchain, not a claim to have rerun its entire
original lockfile or its obsolete-core baseline.

The prototype's **same upstream counter fixture** emits **18,620 bytes / 6,349
gzip bytes**, with **zero attributed template-audit bytes**, no N102 string, and no
effect-creation stack string. Relative to the published counter, that is 5,034
fewer bytes and 2,030 fewer gzip bytes (~24.2% gzip reduction). These are complete
counter-bundle measurements, not standalone core sizes or browser-speed results.
The audit attribution is uncompressed module output and is not additive gzip
savings. Some savings come from removing other diagnostic instrumentation.

A separate common consumer that deliberately retains a configurable runtime
override produces 18,698 / 6,378 bytes through the **packed** prototype with
esbuild, and 18,895 / 6,372 with Vite 7.3.6. Both are silent and free of the audit
code. Do not compare those figures directly to the upstream counter as if their
entry code were identical.

Full measurements, hashes and versions:
[integration-results.json](experiments/bundle-contract/integration-results.json)
and [results.json](experiments/bundle-contract/results.json).

## Root cause: three decisions currently share one switch

`diagnostics.ts:75–98` currently combines environment discovery and runtime
override. Its `globalThis.process?.env?.NODE_ENV` expression is not the expression
esbuild replaces. The implementation then defaults to development in a browser.

But fixing that expression does not solve reachability. `template.ts` calls both
`captureCallsite()` and `auditTemplate()` unconditionally; those functions consult
mutable state inside `template-audit.ts`. The audit also has a separate mutable
override which can enable it regardless of `isDev()`. Its maps and sets initialize
at module evaluation.

The costs extend beyond that module:

- `component.ts` allocates and updates prop `readKeys` for every props proxy even
  when N202 reporting is disabled, and maintains definition-site data for N201.
- `signal.ts` tracks the running effect and tests its source membership before
  calling a helper that suppresses N302 reporting. Development mode captures
  effect creation stacks; async-warning bookkeeping is separate from rejection
  containment.
- Other sites prepare diagnostic messages/payloads before entering a gated helper.

The long-term model separates:

1. **Artifact capability** — can this build contain development instrumentation?
2. **Runtime preference** — should available diagnostics currently report?
3. **Runtime correctness** — checks, containment, errors and lifecycle behavior
   that remain independently of development instrumentation.

## Why the simpler alternatives did not survive testing

| Candidate | Evidence | Disposition |
| --- | --- | --- |
| Direct NODE_ENV read inside the current probe | Correct silence; retains 2,806 audit bytes | A detection repair, not a complete architecture |
| Replace isDev() with literal false | The full audit still appears in the emitted consumer | Function/helper gating is not a reliable removal boundary |
| Import a shared immutable DEV constant | Tiny two-module esbuild probe retains the audit sentinel function | Do not assume cross-module constant folding finishes dead-code elimination |
| Safe browser fallback around NODE_ENV | `typeof process === 'undefined'` remains a runtime condition in emitted browser JS | Cannot prove the development branch dead |
| Require a custom Nisli define | Can drive static guards | Avoid making every consumer supply a library-specific production option |
| development/default conditional exports | Nonminified esbuild and explicit NODE_ENV development both choose default | Good optional packaging convention; insufficient as the sole automatic mode mechanism |
| Late-loaded diagnostics add-on | Requires integration hooks and timing policy for first-parse/creation attribution | Not prototyped; deferred rather than presented as disproven |

These are results for the tested tools and expressions, not claims about every
optimizer. See [optimizer-results.json](experiments/bundle-contract/optimizer-results.json).

## Proposed implementation contract

### Static guards at the work site

Use the standard environment expression directly at the boundary of optional
work. A local constant that survives publishing as a statically visible expression
is acceptable only when the packed-consumer proof still passes. Avoid exporting a
shared `DEV` value and assuming every consumer optimizer will propagate it.

```ts
if (process.env.NODE_ENV !== 'production' && isDev()) {
  captureCallsite(strings);
}
```

Place such guards around audit traversal, captures, attribution bookkeeping,
diagnostic-only allocations, and payload construction. For template audit, retain
the existing audit-specific suppression semantics in development; the static guard
limits capability and must dominate its runtime override. Guard allocation as well
as invocation so importing a module does not retain its tables as side effects.

The prototype uses an internal marker solely to generate comparable variants; its
bundler output already contains ordinary NODE_ENV expressions. The proposed
shipping source can use those expressions directly, with a small internal ambient
type declaration. Vitest and Vite already understand NODE_ENV, so workspace source
exports do not need a new consumer define. The native profiles are resolved by
Nisli's own release build, not by an application-source transform.

Keep the diagnostic emitter independent. Do not solve removal through `drop:
['console']`, global purity declarations, or blanket `sideEffects: false`: those
can hide production reporting or suppress real initialization.

### Runtime override semantics

In development-capable artifacts, `setDevMode(false)` suppresses diagnostics,
`true` enables them, and `null` restores the artifact default. The same applies to
the internal template-audit override within its existing scope.

In a production artifact, `setDevMode(true)` is a no-op: removed code cannot be
restored. Keep the public function's signature for source compatibility; guard its
implementation so the production setter itself has no state to maintain. Users
who want diagnostics in a minified build select development NODE_ENV explicitly
or load the native development artifact.

This is an observable change from 0.56.0 and deserves a deliberate pre-1.0 minor
release and migration note, not a silent patch. Runtime suppression remains useful
for existing buildless pages, but it is explicitly not a size optimization.

### Production checks and error reporting

| Keep in production | Remove only the development part |
| --- | --- |
| N105 live bound-template remount protection | N101–N104 static template audit, tables and callsite capture |
| N106 branded HTML requirement; N107 fail-closed sanitizer requirement | N201 duplicate-definition attribution; N202 prop-read attribution |
| N602 query-key validity | N302 write-attribution tracking and stacks |
| N401/N402 lifecycle error logs, failure stamps, error containment | N301/N303/N310 development messages; retain loop caps, disposal, Promise rejection containment |
| Existing ordinary thrown errors and event/effect error reporting | N603 advisory report; preserve settle's cap behavior |

N201 and N501 are already development-only **throws** in current core. Production
currently keeps first-wins component registration and permits replacing an
instantiated DI override. The prototype explicitly tests and preserves those
existing differences. This proposal does not silently redesign DI or registration
policy under the label of diagnostic cleanup. If the repository wants N501 to be
an unconditional correctness invariant, decide and release that separately.

### Package layout and one runtime identity

Use the normal `@nisli/core` package root for the bundler artifact and one shared
declaration surface. Keep development exports pointing at source as repository
policy requires; use `publishConfig.exports` to select built files in the tarball.
Generate native dev/prod artifacts under documented browser URLs. Preserve the
existing raw `dist/index.js` buildless development entry as a development artifact
or a wrapper to the canonical development graph; do not redirect that raw browser
entry to a process-dependent bundler artifact.

For native apps, map **the same** `@nisli/core` specifier to one dev or production
URL and require dependent modules to use that specifier too. Selecting a different
URL must not require changing application component code. Avoid teaching imports
of a native profile subpath inside an otherwise bundled graph.

The proof package exposes native subpaths to exercise selection and deliberately
test a mixed graph. Mixing root and a separately bundled native profile loses a DI
override in all three browsers. Conversely, two native modules importing the same
mapped root share function identity and the registered override in all three.
The final package should expose the narrowest browser URL surface needed, document
one profile per graph, and test package consumers against that contract. Do not
paper over duplicates with global singleton state.

### Build and verification ownership

Nisli's build gains profile generation, with development tooling only and zero
runtime npm dependencies. Source maps, declarations, existing Vite-HMR subpaths,
and external `@nisli/core` imports in sibling packages remain part of the packaging
contract. Do not bundle independent copies of core into router, SSG, UI or their
development entries.

The buildless production artifact must be finalized by the publisher's bundler.
Merely transpiling modules leaves side-effect import statements and unnecessary
module delivery even when its branch is false; the proof explicitly performs the
publisher-side bundle for the native artifacts.

## Validation completed

- Exact published-package reproduction: four hashes match upstream; counters
  mount and increment without a process global.
- Fourteen development/production/override variants pass isolated VM and Chromium
  checks, including explicit production override attempts and minified dev.
- Packed prototype installed into a separate consumer using pnpm pack followed by
  offline npm install. `publishConfig.exports` was applied; no runtime dependencies.
- esbuild 0.28.1 and Vite 7.3.6 production consumers remove the audit implementation.
- Chromium 149.0.7827.55, Firefox 151.0 and WebKit 26.5 pass native dev/prod counter
  tests, packed esbuild/Vite counter tests, and published reproduction cases.
- Production safety probes pass in VM and all three browsers: N105/N106/N107/N602,
  N401/N402 reporting/stamps, loop termination/disposal, and rejected async-effect
  reporting. `setDevMode(true)` runs first in these production safety probes.
- Existing core suite: 21 files / 465 tests pass unchanged against baseline source,
  emitted native-development modules, and emitted bundler-development modules.
- Conditional-export and mixed-profile negative results are preserved, not
  weakened to produce a green architectural claim.

## Implementation and release gates still required

This is a validated design prototype, not merge-ready production code. Land one
coherent change comprising explicit diagnostic classification, source guards,
profile generation, package exports, migration docs, and permanent consumer tests.
Keep a reproducer and deletion assertions in CI; source-level unit tests alone did
not catch this issue.

Before release:

1. Replace the research rewrites with reviewed source changes. Remove remaining
   scaffolding such as `readKeys: null`, `_echoed` fields, async-warning flags and
   production override storage where those no longer serve any runtime purpose.
   The prototype proves removal of heavy work, not a literal zero-byte public API.
2. Run declarations/typecheck against the final source and all public entrypoints.
   Research transformations were transpiled, not typechecked as shipping source.
3. Verify the preserved raw buildless development URL, browser production URL,
   source-export workspace consumption, npm/CDN resolution actually documented,
   HMR registration/remount identity, SSG silence, and sibling-package graphs.
   Native import-map behavior is proven here; CDN rewriting and all workspace
   integrations are not.
4. Extend production-specific invariant coverage beyond these probes, including
   event errors and scheduler/settle cap behavior. Run the full root build/test/
   typecheck gates and packed-package tests, then remote CI after the eventual push.
5. Update both READMEs, diagnostics docs and changelog. Correct N107 being used as
   an example of a development-only diagnostic. Record the distribution and
   runtime-override contract in an accepted ADR rather than retroactively treating
   ADR-0030's proposed zero-weight intent as a shipped guarantee.

No changes were pushed, released, or posted to the issue.

## Primary sources and precedents

- [Issue #3](https://github.com/gkoreli/nisli/issues/3) and its
  [pinned fixture](https://github.com/gkoreli/blog/tree/4e7bc14ff9bc52bb06c706d71ca4b635e2effbfa/docs/worklist/blog-design-and-nisli-ssg/nisli-production-diagnostics-repro).
- [esbuild platform behavior](https://esbuild.github.io/api/#platform) documents
  browser NODE_ENV substitution; [define](https://esbuild.github.io/api/#define)
  documents inline constant replacement. The measurements above test the emitted
  artifact rather than assuming these guarantees imply complete removal.
- [Vite environment documentation](https://vite.dev/guide/env-and-mode) describes
  static replacement and NODE_ENV/mode distinctions. Tests used installed Vite
  7.3.6; the live docs may describe a newer release.
- [Vue's distribution guide](https://github.com/vuejs/core/blob/main/packages/vue/README.md)
  uses separate native-browser and bundler distributions with standard NODE_ENV
  guards. This is a precedent for delivery profiles, not a proposal to adopt Vue's
  compiler or runtime architecture.
- [Lit package exports](https://github.com/lit/lit/blob/main/packages/lit-html/package.json)
  use development/default conditions; [Node conditional-export documentation](https://nodejs.org/api/packages.html#conditional-exports)
  explains condition selection. Nisli's esbuild experiment shows why this alone
  does not preserve automatic development diagnostics in its ordinary consumer.
