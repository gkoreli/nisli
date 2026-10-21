# Making Nisli more native, fast and agent-usable

**Revised recommendation after maintainer feedback:** retain core's current
architecture. The investigation found compatibility problems and plausible
optimization mechanisms, but did not demonstrate application benefit sufficient
to justify the proposed refactors. The original recommendation to prioritize
rendering regions is withdrawn. Profile real workloads before runtime changes;
evaluate additive authoring capabilities against the existing engine before
proposing schema or state migrations. See the
[risk/value reassessment](./reviews/risk-value-reassessment.md). The individual
sections below retain technical findings and candidate mechanisms, not an approved
implementation order.

Research date: 2026-10-20, America/Los_Angeles. Local source is commit
`4afde49c728a330e10ce887a38b8013d63b58498`, `@nisli/core` 0.56.0.
Authoritative upstream docs and source were fetched from GitHub; the
[source ledger](./sources.json) records URLs and file-content blob IDs.

## 1. What already exists

The August sweep and ADRs 0014, 0019, 0025, 0029, 0030–0030.2 and 0031 cover much
of this territory. Repeating their proposals as new discoveries would obscure the
actual frontier.

| Capability | Current evidence | Consequence |
| --- | --- | --- |
| Fine-grained push/pull signals, equality suppression, automatic microtask coalescing | `packages/core/src/signal.ts:1`, `:117`, `:321` | A new scheduler must preserve existing correctness, not merely win a toy loop |
| Parsed template cache | `packages/core/src/template.ts:226`, `:397` | Repeated HTML parsing is already fixed; repeated discovery of binding locations remains |
| Native atomic moves | `packages/core/src/template.ts:1342`, ADR 0031; new probe sees support in Chromium/Firefox, fallback in WebKit | Optimize move selection without discarding the state-preserving move path |
| Coded diagnostics, containment, explicit HTML trust, disposal, async settling | `diagnostics.ts:42`, `template.ts:983`, `disposable.ts`, `settle.ts` | Extend these surfaces; do not invent a separate agent runtime |
| Typed intent blocks and layout evidence | `packages/engine/src/blocks/kernel.ts:149`, `packages/engine/src/test/prove.ts`, `packages/engine/src/verify/index.ts:1` | The app-authoring layer already exists and already has machine-readable findings |

Engine is currently a private workspace package. Its verifier is a Chromium
browser runner, not a general cross-browser verifier for every core/registry
contract. The registry manifest (`packages/ui/registry/registry.json`) describes
copyable items and their dependencies; it is not a full props/events/semantics
manifest. Those distinctions matter when describing what is missing.

## 2. Measured compatibility limits, not a case for architectural replacement

`each()` creates an `<each-item style="display:contents">` for every item
(`template.ts:1317`). This removes a CSS box, not a DOM ancestor. The wrapper
makes reconciliation robust when an item's inner reactive view changes, but it
also changes the native relationships an author wrote.

The [new probe](./experiments/native-semantics/RESULT.md) mounts actual current
core code and compares it with native controls. It produced:

| Probe | Native control | Chromium 149 | Firefox 151 | WebKit 26.5 |
| --- | --- | --- | --- | --- |
| `ul > li`, one item | 1 | 0 | 0 | 0 |
| `table.rows.length`, one row | 1 | 0 | 0 | 0 |
| Input in disabled fieldset's first legend matches `:disabled` | false | true | true | true |
| `select.options.length`, one option | 1 | 1 | 0 | 1 |
| Selected value | `one` | `one` | empty | `one` |

The list row proves a direct-child contract difference; it does **not** establish
that every accessibility tree loses list semantics. The table and fieldset rows
prove native API/behavior differences. The HTML standard defines the
[fieldset's first-legend exception](https://html.spec.whatwg.org/multipage/form-elements.html#the-fieldset-element)
and [table row collection](https://html.spec.whatwg.org/multipage/tables.html#dom-table-rows).
ARIA naming alone cannot repair disabled-state or native collection behavior.

**Proposed direction:** introduce an internal rendering region with insertion
boundaries and explicit ownership, allowing native roots such as `tr`, `li`,
`option`, and `legend` to stay directly under their intended native parent.
Use a single rendered root as the move unit when possible, and explicit node
boundaries for multiple or changing roots. Keep comment anchors where they solve
ownership. A fragment extraction shortcut would disconnect live children and
undermine the atomic-move guarantee.

This does not make an arbitrary custom-element host legal inside every table or
select. Factory composition still creates real custom elements. Supporting native
templates through `each()` and designing hostless component composition are
separate design questions; the first can improve without promising the second.

**A separate, smaller optimization has a measured synthetic opportunity.** For keys
`[0,…,99] → [1,…,99,0]`, current reconciliation performs **99 DOM moves** in all
three browsers. The inverse rotation performs one. Both preserve displayed order.
The forward cursor in `template.ts:1337` explains the asymmetry.

Neither result establishes frequency or cost in a representative application.
The 14 failed assertions are correlated observations across a few scenarios,
not 14 independent product failures. Stable wrappers deliberately protect
changing item contents; a replacement must earn its additional ownership and
lifecycle complexity against actual consumer needs.

[Lit's repeat implementation](https://github.com/lit/lit/blob/main/packages/lit-html/src/directives/repeat.ts)
uses head/tail matching and creates maps only when needed. Prototype that smaller
strategy before adopting a more elaborate LIS algorithm. The target for either
rotation is one move. **99 moves versus one is an operation count, not evidence
of a 99× elapsed-time speedup.** This optimization can be evaluated independently
of the larger rendering-region refactor.

## 3. The strongest unmeasured runtime bet: prepare bindings once

At each mount, core clones a cached template and calls `processNode()`
(`template.ts:397`). The recursive walk copies `childNodes` (`:451`), and
`processAttributes()` copies attributes and looks for dynamic markers (`:458`).
Even static nodes and attributes pay discovery costs on every instance.

[Lit's contributor design document](https://github.com/lit/lit/blob/main/dev-docs/design/how-lit-html-works.md)
describes cached metadata for dynamic parts. Its
[current clone implementation](https://github.com/lit/lit/blob/main/packages/lit-html/src/lit-html.ts#L1217)
still uses a TreeWalker: it is evidence for preparing metadata once, **not**
evidence that Lit has eliminated all per-clone traversal. Its
[optional compiler](https://github.com/lit/lit/blob/main/packages/labs/compiler/README.md)
shows that buildless authoring and an optional preparation optimization can coexist.

The first Nisli prototype should cache binding kinds, names and locations from
the **browser-parsed DOM**, then avoid rescanning static attributes. A later
variant can resolve direct paths to dynamic nodes. Resolve targets before
binding mutates sibling positions. Do not extend Nisli's small string scanner
into an independent HTML parser: implied table nodes, raw-text elements and SVG
make authored string positions an unreliable DOM model.

The claim is reduced repeated discovery. There is no measured Nisli speedup yet,
and no transferred Lit percentage. Clone, binding allocation, custom-element
upgrade, layout or paint may dominate real screens. Keep both first-mount and
warm-mount numbers, small and static-heavy templates, heap/allocation evidence,
and compressed output size. ADR 0014 should be revised with these constraints,
especially its stronger aspiration to eliminate markers.

## 4. Agent-native authoring: one contract, an executable repair loop

An agent needs a small correct vocabulary, feedback it can act on, and a reliable
way to know the repair worked. The existing engine's intent types and proof tools
already provide part of this. Expand that foundation in four steps:

1. **Single component contract.** Resume ADR 0030.2 T3: runtime declarations
   drive inferred TypeScript props, attribute behavior and supported metadata.
   Consolidate owned/controlled state seeding and reflection so registry roots
   stop repeating `defaultOpen`, pinning, reflection and event choreography
   (`packages/ui/registry/default/ui/dialog.ts:87`). Preserve existing overloads
   while migrating; exact schema syntax still needs design review.
2. **Interoperable output.** Generate a
   [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest)
   for public attributes/events/slots and a namespaced Nisli extension for
   semantics and interactions. The standard manifest is a tooling interchange,
   not an action execution or accessibility proof format. A factory-aware
   extractor is needed; a class-only analyzer will miss Nisli declarations.
3. **Layered check/repair tooling.** Expose versioned docs lookup, static checks,
   coded diagnostic records, and existing engine verification through a small
   CLI; MCP can wrap the same implementation. Svelte's
   [official agent tools](https://github.com/sveltejs/ai-tools/blob/main/tools/skills/svelte-code-writer/SKILL.md)
   provide a direct precedent for targeted documentation retrieval and a code
   fixer. Useful Nisli checks include async setup/effects, undeclared props,
   destructive array rendering, and invalid native parent/child composition.
   Distinguish definite errors from heuristic suggestions and intentional
   snapshots. Offer fixes only where the rewrite preserves behavior.
4. **Repairable findings and an eval.** Records should carry code, component,
   source location when known, expected/actual, suggested action and docs version.
   Keep missing instrumentation a failure, as engine verify already does. Seed
   known defects, prove each checker rejects them, and measure agent task success,
   repair attempts, tokens and elapsed time on held-out tasks.

This is an extension of ADRs 0030–0030.2, not a discovery that Nisli lacks agent
tooling. A concrete drift example is already in core: `template.ts:53` says
`untrack` returns void and keeps a wrapper, while `signal.ts:710` already returns
`T`. Versioned, executable examples are more trustworthy than independently
maintained descriptions. Extra documentation volume is not itself a success
metric.

Do not mechanically equate all metadata. TS declarations can describe value
types; custom validators, dynamic `when` and dependent `options` encode behavior
that JSON Schema cannot completely express. Keep the actual validation and
action closure authoritative. Engine's existing Form schema is the right place
to describe form intent, rather than adding a competing per-app schema.

## 5. More native UI: browser-owned overlay mechanics

The registry still implements focus trapping and placement in
`lib/focus.ts` and `lib/floating.ts`; engine has its own layer orchestration in
`blocks/kernel.ts:246` and `:454`. The latter listens for scroll/resize to
remeasure placement. This is August bet 02 with another current consumer.

Evaluate native modal `<dialog>`, popover top-layer behavior and CSS anchor
positioning behind the current semantic APIs. The
[CSSWG source](https://github.com/w3c/csswg-drafts/blob/main/css-anchor-position-1/Overview.bs)
defines anchor-relative positioning; the
[HTML standard](https://html.spec.whatwg.org/multipage/form-elements.html#the-button-element)
defines native command and popover invocation attributes. These are capabilities
to test against a browser matrix, not a blanket compatibility guarantee.

Keep menu semantics, roving focus, typeahead, controlled-state event behavior,
exit transitions and cross-layer coordination where the browser does not supply
the complete component contract. A popover is not a modal dialog. Prototype one
engine dialog and one anchored menu; test nested layers, transformed ancestors,
scroll, RTL, Escape, outside pointer, focus return and animation behavior across
three engines. Count listeners, layout reads and removed code after parity.

## 6. Agent operation: WebMCP fits as an optional adapter

The current [upstream explainer](https://github.com/webmachinelearning/webmcp)
uses `document.modelContext.registerTool()`, rather than the older
`navigator.modelContext` sketch. The
[implementation ledger](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md)
records Chrome/Edge origin trials and links to Firefox/Safari work. Treat
deployment as experimental and feature-detected; a proposal is not a cross-browser
baseline.

The [declarative form explainer](https://github.com/webmachinelearning/webmcp/blob/main/declarative-api-explainer.md)
maps forms and native controls toward tool schemas, but explicitly leaves schema
synthesis and response details unfinished. That makes Form a promising adapter
target, not a reason to freeze its current proposal attributes into core today.

Design domain actions once, then invoke the same validation, busy, authorization
and completion paths from a button, a form submission or a registered tool.
Describe capabilities such as filtering transactions, not individual click
targets. Register within component lifetime, remove on actual cleanup, and keep
an ordinary interface working without WebMCP. A schema is not authorization;
dynamic fields and choices must be checked at invocation time. User-interaction
requirements for destructive actions belong to the same shared action contract.

## 7. Attractive ideas to hold or reject for now

- **Signal graph rewrite:** core deletes/re-adds dependency Set membership during
  recomputation (`signal.ts:341`, `:524`) and sorts pending effects (`:131`).
  [Preact's source](https://github.com/preactjs/signals/blob/main/packages/core/src/index.ts)
  uses reusable linked dependency edges and versions. That suggests a controlled
  prototype if allocation profiles identify this cost. Preserve conditional
  tracking, error transitions, deterministic order, coalescing and loop guards.
  Nothing measured here establishes that graph changes improve an app.
- **Native TC39 Signals now:** the
  [official proposal](https://github.com/tc39/proposal-signals) still says Stage 1;
  scheduling/disposal for effects remain framework responsibilities. Keep interop
  optional. Do not add a mandatory polyfill to zero-dependency core.
- **Automatic DOM adoption/resumability:** the existing August
  [adopt probe](../2026-08-platform-sweep/experiments/bet-05-adopt-probe/RESULT.md)
  fails 16/24 assertions. A serialization/adoption ownership contract must precede
  another attempt. Light DOM alone does not prove hydration/adoption correctness.
- **Virtualize everything:** this trades DOM size for native search, focus and
  accessibility concerns; the
  [WICG virtual-scroller record](https://github.com/WICG/virtual-scroller)
  explains those tradeoffs. Bound data/rendering at the semantic block layer
  before a universal runtime policy.
- **Custom boolean parsing is native HTML:** core intentionally treats the
  literal attribute value `"false"` as false (`component.ts:146`). Native boolean
  attributes use presence, as the
  [HTML standard](https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#boolean-attributes)
  specifies. Document this dialect and consider an explicit presence-kind in a
  schema migration; do not silently change deployed behavior for a slogan.

## 8. Sequence and proof required

No runtime rewrite is recommended from this evidence alone. First identify a
representative application task whose latency, resource cost or authoring burden
matters, and measure the current implementation. Record compatibility limits
without making supported behavior worse. A runtime proposal needs a meaningful
end-to-end benefit and an explicit inventory of capabilities it preserves. An
authoring proposal needs better completion/repair outcomes than current engine
blocks and tools. Prefer optional paths that share existing semantics; importing
a new platform primitive or deleting code is not itself the acceptance criterion.

For performance claims, follow the
[js-framework-benchmark methodology](https://github.com/krausest/js-framework-benchmark):
preserve keyed identity and include browser rendering rather than timing only
signal writes. Add route startup, input-to-paint latency, realistic tables/forms,
memory after repeated teardown, and bundle bytes; record browser versions and
both cold/warm conditions. Report distributions and regressions. No comparison
with another framework was run here, so there is no evidence that Nisli is the
fastest framework or for a particular percentage gain.

Baseline core tests pass **465/465**. The deliberately strict browser probe exits
1 with **14/27 failed assertions**. No production source was changed and no
implementation, release, remote CI, screen-reader test or independent review is
claimed. See the [self-review](./reviews/self-review.md) before turning a brief
into an ADR.
