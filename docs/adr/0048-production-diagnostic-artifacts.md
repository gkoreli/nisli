# 0048. Production diagnostics belong to the artifact

**Status:** Accepted; implemented for core 0.57.0.
**Date:** 2026-10-20
**Issue:** [#3](https://github.com/gkoreli/nisli/issues/3)
**Evidence:** [Research report](../research/2026-10-production-diagnostics/REPORT.md)

## Problem and evidence

Core 0.56.0 probes `globalThis.process?.env?.NODE_ENV`. Browser optimizers do not
recognize this as the conventional production constant. The reported esbuild
bundle emits N102, and replacing only the runtime probe or suppressing diagnostics
retains the template audit. The exact published-package reproduction retains
2,806 audit bytes; the runtime-off variant retains 2,810. These are attributed
uncompressed module bytes, not total bundle or gzip savings.

The research falsified relying on a shared helper returning false, an imported
constant alone, or a `development` export condition alone. The tested esbuild
optimizer retains audit code through the helper; esbuild does not automatically
select a development export merely because minification is disabled or NODE_ENV
is development. Requiring consumers to define a Nisli-specific flag would make
this a configuration obligation in every application.

## Decision

One TypeScript source produces three distribution artifacts. Authoring APIs,
reactivity, lifecycle behavior, and root imports stay the same.

| Consumer | Artifact | Mode selection |
| --- | --- | --- |
| Bundlers / Node | `dist/bundler/index.js`, unbundled ESM | Standard `process.env.NODE_ENV` |
| Native browser development | `dist/index.js`, standalone ESM | Fixed at publication; loud by default |
| Native browser production | `dist/index.production.js`, standalone ESM | Fixed at publication; optional code removed |

The package's published exports point at the bundler module tree; workspace
exports keep pointing at source. HMR subpaths live in that same tree. Declarations
live under `dist/types`. Core keeps zero runtime dependencies. Esbuild is a
publication/test dependency, and TypeScript emits declarations only. The
publication build uses a neutral platform for bundler ESM, preserving the
consumer's mode guards. Browser builds specialize those guards at publication.
Development source maps embed sources; production maps omit source contents.
One private `src/env.d.ts` supplies the publisher's process type; it is not
emitted into public declarations and does not add Node globals to consumers.

Native browser consumers map `@nisli/core` to exactly one artifact URL for their
whole application. No new full-runtime profile subpaths are exported. Mixing
standalone builds with each other or the bundler entry duplicates DI/reactive
state; the research reproduced a lost DI override from that mixture. Neither a
global singleton nor a runtime profile loader is introduced to conceal it.

## Static capability and runtime preference

Optional work has a literal `process.env.NODE_ENV !== 'production'` guard at
its callsite. A shared helper is insufficient for the optimizer contract.
Payload construction, stack capture, diagnostic-only allocations, and state
writes are inside those boundaries too. Component read/echo/setup tracking uses
development-only weak collections rather than properties on production objects.
The template audit's top-level collections are conditionally allocated, allowing
the entire module to disappear in production consumer bundles.

`setDevMode(false | true | null)` remains the runtime preference inside the
artifact's capability. Production cannot resurrect removed diagnostics. This
semantic change ships in 0.57.0 and is documented in the changelog.
Tests asserting development diagnostics must select development mode.
Runtime suppression is not a size optimization. Unbundled Node evaluation can
disable development work with NODE_ENV; only an optimizing build removes bytes.
Set Node's mode before loading core and keep it fixed for that module graph.

Unconditional safety remains unconditional: N105/N106/N107 template contracts,
N602 query keys, effect-loop disposal, lifecycle N401/N402 logging/stamps/events,
async-effect rejection handling, and event-handler containment. N201 duplicate
registration and N501 late provider checks retain their existing development-only
policy; production still keeps the first definition and permits provider override.
The leaf emitter itself remains ungated.

## Regression contract

`pnpm --filter @nisli/core test:package`, after `pnpm build`, packs the real
packages and resolves their published exports from a disposable consumer. It
checks automatic and explicit esbuild production, nonminified and explicit
minified development, Vite production, byte attribution, full native production
sentinels, declarations without Node ambient types, packed SSG, and the actual
Vite file-watch HMR path. Chromium, Firefox, and WebKit execute native/bundled
consumers, runtime overrides, safety failures, and canonical module identity.
Missing browsers are failures, never silent skips. CI runs this proof after
build/typecheck and installs all three engines.

This contract must grow with new diagnostics: put optional allocations and work
behind direct guards and extend the proof's removal sentinels and behavioral
fixtures. Do not erase an emitter or a safety path to satisfy a byte assertion.

## Limits and rollout

The release target is core 0.57.0. Release requires the repository gates,
publication of the packed artifact through the existing workflow, observation
of remote CI/publishing, and verification of npm metadata. The proof establishes
the tested esbuild/Vite behavior; arbitrary
bundlers still need conventional NODE_ENV replacement and dead-code elimination.
The full native production module includes all public APIs; consumer bundles can
additionally tree-shake unused APIs. Their sizes are not interchangeable.
