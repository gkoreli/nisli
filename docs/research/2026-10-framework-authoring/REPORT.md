# Make framework correctness less dependent on author choreography

Latest continuation: [native runtime findings](./NATIVE-FINDINGS.md), with
executable adapters, preserved negative results and three-browser evidence.
The earlier results below retain their original scope.

**Scope correction after maintainer review:** the compiled-expression direction
below is withdrawn. Its alternate source semantics violate the explicit
browser-native authoring [tenet](../../TENETS.md#browser-native-authoring).
The experiments remain
historical evidence, not an implementation plan. See
[native template semantics](./briefs/native-template-semantics.md) for the
replacement investigation; no new runtime API has been implemented or approved.

The relevant target is Nisli's general component programming model: which facts
an author must track to obtain reactive, stable and correctly disposed UI.
Two framework-level obligations are worth isolating: **where a reactive
expression subscribes**, and **which lifetime owns work created by a computation**.
Neither depends on an application being a finance app or CRUD system.

## 1. Reactive expressions: the author currently chooses the tracking boundary

In current core:

```ts
html`<p>${count}</p>`                       // live binding
html`<p>${count.value + 1}</p>`             // a value evaluated before html()
html`<p>${computed(() => count.value + 1)}</p>` // explicitly live derivation
```

This is ordinary JavaScript evaluation, not a missing runtime heuristic.
`html()` receives values after expressions execute. It cannot recover a lost
dependency or computation from the resulting number. Core recognizes signal
objects in `template.ts:622`; it cannot tell whether a primitive came from a
signal, a constant or a deliberately captured snapshot.

There is another consequence. Inside a computed view, an eager `.value` read in
template construction subscribes the outer view. Changing that leaf rebuilds
the returned template and can replace unrelated inputs. The framework skill
explicitly warns about it, and ADR 0008.1 distinguishes this authoring hazard
from mount-time dependency leaks that core already fixed. Do not reopen that
fixed runtime bug or claim automatic tracking is absent.

**Withdrawn candidate:** an explicit opt-in authoring mode in which expressions inside a
template are live bindings. A compiler lowers them into current signal/computed
bindings, keeping structural reads outside the template under normal JavaScript
semantics. Explicit snapshots remain available. Existing buildless `html()` and
its current semantics remain available unchanged.

For example, the prototype lowers `count.value + 1` into
`computed(() => count.value + 1)`, and a direct `count.value` into `count`.
It changes source authoring semantics deliberately; it is **not** a transparent
optimization that can be enabled on existing code without review.

### What was actually proven

[Seven checks](./experiments/reactive-expressions/RESULT.md) pass against current
core. The same expression remains a snapshot when uncompiled and becomes a live
leaf when explicitly lowered. A computed-view fixture compares raw, lowered
and manually correct versions:

| On leaf update | Raw eager read | Lowered | Explicit computed reference |
| --- | --- | --- | --- |
| Input node retained | no | yes | yes |
| Unsaved input value retained | no | yes | yes |
| Label updated | yes | yes | yes |

A variant of the **actual registry Progress source** authors `.value` at existing
binding sites and lowers back to signals. Its rendered progressbar matches the
original across indeterminate, zero, intermediate, complete and changed-max
values, including class changes, while retaining indicator identity.

Further checks retain typed factory composition, event callbacks, explicit
`untrack` snapshots and disposal. Unsupported recognized expressions such as
eager factory props, mutations and calls around known signal reads are rejected
rather than wrapped blindly. The test environment is happy-dom: this proves
node identity and input values, not real-browser focus/selection or paint.

The prototype has a fixture-provided list of signal names. It has **no** robust
binding/symbol resolution, HTML parser, import insertion, source map, type-aware
factory lowering or purity analysis. Opaque helper calls that hide reads are
not solved. Those are production compiler requirements, not implementation
details to wave away. It also does not fix `.map()` list identity or remove the
need for explicit keys.

### Why this belongs to the framework

It moves a reactivity boundary decision from each component author into an
explicit language contract and lowering. It applies equally to custom controls,
editors, visualizations and registry components. It can reuse the current DOM,
signals, native events and lifecycle implementation instead of replacing them.

[Solid's official buildless template documentation](https://github.com/solidjs/solid/blob/main/packages/solid/html/README.md)
explicitly describes manual expression wrapping and limitations without compiler
analysis; its [compiled example](https://github.com/solidjs/solid/blob/main/README.md)
shows fine-grained DOM output over the same reactive primitives. This is an
established architectural tradeoff, not a novel compiler claim.
[Lit's optional compiler](https://github.com/lit/lit/blob/main/packages/labs/compiler/README.md)
is another optional-build precedent, although its preparation optimization does
not supply this reactive semantic change.

An eventual typed template frontend could also check native binding names and
event types; [lit-analyzer](https://github.com/runem/lit-analyzer/blob/master/packages/lit-analyzer/README.md)
demonstrates that tooling surface. No such checker was implemented in this probe.
The thesis is fewer author obligations, not merely additional diagnostics.

## 2. Ownership: dependencies and lifetimes are separate questions

Current core automatically disposes effects created during component setup via
`signal.ts:678` and `component.ts:20`. Outside that context an effect returns an
explicit disposer. `signal.ts:512` runs a callback's returned cleanup on rerun;
it does not automatically collect separately created nested effect handles.
This is a current contract, not a newly discovered violation of promised behavior.

That means a general helper creating nested work must manage its handles. For
example, if an effect creates another effect on each run, stopping or rerunning
the outer one does not inherently dispose the inner ones. A standalone probe
records two children still observing after the parent stops, then explicitly
cleans both up.

**Candidate:** explicit lifetime scopes independent of reactive dependency
tracking. Work created under an owner can be disposed as a group; a replaced
computation can dispose the work belonging to its previous execution. An explicit
detached lifetime remains possible. `untrack()` should affect subscriptions,
not silently change who owns the created work.

The [research wrapper](./experiments/ownership/owned-effect.ts) opts into that
behavior while calling existing core `effect()`. Five checks pass: current
explicit-cleanup baseline, child replacement/disposal, ownership under untrack,
intentional detachment, and authored cleanup preservation. No production
effect, scheduling order or component context was changed.

This prototype owns only other calls to the wrapper. It does not automatically
own existing resources, query observers, emitters, DOM listeners or work created
after await. A production owner primitive would need integration and explicit
late-callback/live-owner behavior. Simply replacing the global setup context
with a longer-lived global variable would be unsound under interleaved work.

[Vue's effect-scope RFC](https://github.com/vuejs/rfcs/blob/master/active-rfcs/0041-reactivity-effect-scope.md)
states this precise framework motivation: generalize component effect collection
for reusable reactive code, including nested and detached scopes. Its
[current implementation](https://github.com/vuejs/core/blob/main/packages/reactivity/src/effectScope.ts)
keeps a separate active lifetime scope. This supports the distinction between
tracking a value and owning a resource; it does not prove Nisli needs to adopt
Vue's entire API or alter existing default lifetimes.

## 3. Decision bar

These experiments correctly target framework semantics, but neither proves a
major agent productivity leap. Before choosing a public design:

1. Measure which recurring framework rules cause defects in bespoke controls,
   editors and component-family code, beyond one application corpus.
2. For compilation, specify exact live-expression and snapshot semantics; resolve
   real TypeScript symbols; cover factory props, callbacks, mixed attributes,
   branches, keys, SVG, raw HTML trust, error boundaries, HMR and SSR. Reject
   ambiguous transforms. Keep current buildless behavior and no mandatory build.
3. For ownership, decide compatibility and explicit detachment; prove cleanup and
   error containment across resources/query/emitter/listeners, moves, reconnect,
   synchronous reentrancy and async completion. Preserve scheduler invariants and
   distinguish computed errors from lifetime disposal.
4. Compare complete custom-component tasks with matched docs/tool access and
   independent behavior assertions. Count repairs and author decisions, plus
   emitted bytes, allocations and runtime costs. No speedup follows from these
   probes alone.

The practical deliverable here is a pair of executable framework experiments
with preservation gates. Core's unchanged baseline passes 465 tests; the two
prototypes pass 7 and 5 checks and typecheck. Production APIs and source remain
unchanged. See [self-review](./reviews/self-review.md) before extending either.
