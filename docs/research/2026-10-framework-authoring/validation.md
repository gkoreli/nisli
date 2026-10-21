# Validation

## Core baseline

```sh
pnpm --filter @nisli/core test
```

Exit 0; 465 tests in 21 files. Unchanged production baseline, not full integration validation of these prototypes.

### Full output

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

 ✓ src/element-context.test.ts (18 tests) 17ms
 ✓ src/each.test.ts (23 tests) 73ms
 ✓ src/component.test.ts (41 tests) 77ms
 ✓ src/projection.test.ts (12 tests) 37ms
 ✓ src/template.test.ts (75 tests) 77ms
 ✓ src/signal.test.ts (65 tests) 115ms
 ✓ src/query.test.ts (29 tests) 104ms
 ✓ src/invariants.test.ts (63 tests) 148ms
 ✓ src/injector.test.ts (21 tests) 11ms
 ✓ src/el.test.ts (12 tests) 46ms
 ✓ src/context.test.ts (8 tests) 4ms
 ✓ src/emitter.test.ts (15 tests) 14ms
 ✓ src/lifecycle.test.ts (9 tests) 28ms
 ✓ src/hmr/registry.test.ts (3 tests) 16ms
 ✓ src/vite-hmr/plugin.test.ts (6 tests) 2ms
 ✓ src/settle.test.ts (10 tests) 177ms
 ✓ src/template-audit.test.ts (16 tests) 161ms
 ✓ src/diagnostics.test.ts (8 tests) 3ms
 ✓ src/ref.test.ts (6 tests) 9ms
 ✓ src/resource.test.ts (12 tests) 528ms

 Test Files  21 passed (21)
      Tests  465 passed (465)
   Start at  23:00:15
   Duration  1.68s (transform 467ms, setup 0ms, collect 1.19s, tests 1.66s, environment 5.08s, prepare 1.25s)


```

## Prototype TypeScript

```sh
pnpm exec tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --allowImportingTsExtensions --skipLibCheck --lib esnext,dom,dom.iterable docs/research/2026-10-framework-authoring/experiments/reactive-expressions/lower.ts docs/research/2026-10-framework-authoring/experiments/reactive-expressions/probe.test.ts docs/research/2026-10-framework-authoring/experiments/ownership/owned-effect.ts docs/research/2026-10-framework-authoring/experiments/ownership/probe.test.ts
```

Exit 0. Full output: empty; no diagnostics.
