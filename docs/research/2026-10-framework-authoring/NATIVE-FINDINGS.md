# Native authoring: findings after executable probes

Follow [the framework tenets](../../TENETS.md). This is research, not a selected
public API or a production renderer patch. The current working tree was changing
in another lane, so every follow-up probe uses source frozen at
`1d055cabdffbea8ff8d82cbfd88a6081882ca8b2`, with
[per-file hashes](./experiments/native-runtime/snapshot.json). Findings about
registry components refer to that snapshot, not later releases.

## Recommendation

Investigate **updatable template instances and child-factory identity** as one
runtime contract. It would allow ordinary reactive rendering without requiring
the author to extract every expression into a separate computed merely to
protect neighboring state. Keep direct signal bindings available for narrow
updates. Public syntax comes after the identity and update contract; a new
view() name is not intrinsically needed.

The potential authoring shape is a setup function returning a render callback.
That callback is ordinary JavaScript. Setup still creates state/resources once;
rendering describes the current UI. The experiments use a private record()/region()
adapter to isolate the mechanism, not as an API recommendation. It works through
current core primitives; a proper integration needs internal template metadata
and update operations instead of this adapter.

Do not replace the state API with proxies as the main bet. Property syntax can
be shorter, but losing the connection through destructuring and function
arguments adds exceptions. Likewise, automatically invoking every function prop
would execute legitimate callbacks. These do not satisfy the fewer-rules goal.

## What the experiments establish

### Basic renderer and actual Progress

The first adapter retains native input nodes while rerunning a render function
that produces the same literal at the same mounted region. It updates primitive
bindings, replaces event closures, switches source signals and disposes work.

A handwritten variant of the actual registry Progress replaces five computed
declarations with ordinary local calculations inside its renderer. Its rendered
attributes match the original across five controlled states and two plain-HTML
attribute updates. The indicator retains identity. This is a bounded component
comparison, not a token/productivity benchmark or a migration of production code.

### Two counterexamples rule out the simplistic policy

The original [falsification run](./experiments/native-runtime/falsify-output.txt)
intentionally remains red: two requirements fail.

1. Returning a fresh child factory from the next render creates a second child
   instance. The outer section survives, but the child's unfinished input is
   lost. Outer-template reuse alone is insufficient.
2. A new document with the same markup inherits the old document's uncontrolled
   draft when no identity key is supplied. This falsifies the promise that a
   framework can infer domain identity from markup alone, not the feasibility
   of retaining a deliberately identified view. Two apps can require opposite
   reset behavior for the same markup.

### Child retention refinement

A separate adapter retains a direct factory child by mounted position and tag,
updates its props, forwards replacement callbacks without invoking them, handles
optional prop removal and switches reactive prop sources. It uses the existing
INTERNAL factory descriptor and _setProp contract, so it is not a public helper
ready to ship. It also preserves an existing each() result created once.

Five assertions pass for this refinement. A parent identity key deliberately
recreates its child and runs old-instance cleanup. The original failing adapter
and its assertions are preserved; no assertion was weakened to make it pass.

The refinement's unit output includes an N202 warning for an onSave prop read
only by its later event callback. The callback works, but diagnostic compatibility
is not clean. Do not present passing assertions as a diagnostic-free integration.

### Native browser execution

Chromium 149.0.7827.55, Firefox 151.0 and WebKit 26.5 each pass 19 checks, with
no page errors. These cover node identity, focus, selection, draft values,
disposal, fresh child callbacks, local expression tracking, actual Input reset
behavior and the Slider observation below. Some checks confirm existing behavior
or reproduce a defect; 57 checks are not 57 new capabilities.

Application and prototype .mjs modules are served unchanged through browser ES
modules and an import map. The frozen core library is bundled separately with
its production environment define. This is library preparation, not a Nisli
application compiler. Served application module hashes are in the full output.

## Rules removed, rules retained, and new costs

| Author concern | Finding |
| --- | --- |
| Wrap every changing render expression in computed to avoid remounting siblings | Potentially removable for supported stable templates and direct child factories |
| Use separate computed declarations merely to describe Progress markup | Removed in the handwritten variant; equivalent rendered attributes tested |
| A new callback on the next render must not leave the old closure installed | Runtime responsibility; fresh captured callbacks tested |
| Distinguish two different entities that share markup | Identity must be explicit when reset behavior differs; markup cannot infer it |
| Preserve reordered item identity | Existing each() still needed; ordinary map() reconciliation is not implemented |
| Separate setup work from repeated rendering | Still necessary; children(), hooks and resource creation are not arbitrary render operations |
| Avoid eager snapshots in setup helpers | Still necessary; demonstrated in real Slider |
| Keep expensive independent calculations from rerunning | Whole render functions can do extra work; local bindings remain useful |
| Distinguish a function value from a live computation | Still necessary at generic prop boundaries; blanket invocation is unsafe |

In the work-count fixture, changing A evaluates both A and B expressions in a
render region, while local callbacks evaluate only A again (counts 2/2 versus
2/1). This is an executed-computation count, not a wall-clock benchmark. The
research adapter also turns static slots into signals; that overhead would need
to be removed before making performance claims.

## Native control semantics deserve a separate, narrower investigation

The actual Input implementation owns a ref, an effect and an onMount callback
to distinguish the live value from the initial form-reset target. All three
browsers confirm why: setting a value attribute on a dirty input changes its
default/reset value without changing its edited current value. The component
updates the property and retains its initial reset target.

An explicit DOM-property binding could remove imperative plumbing without
changing native semantics. Ordinary attributes must keep their meaning; silently
turning value= into a property assignment would break reset behavior. Property
binding is an established Lit feature, not a newly invented Nisli control model.
No property-binding prototype or component migration was implemented here.

The real Slider snapshots min, max and step during setup. Changing its supplied
signals from 0/100/1 to 20/200/5 leaves native attributes at 0/100/1 in all three
browsers. The source documents live declared bounds, making this a concrete
authoring hazard. A render callback alone does not fix locals captured outside
it. This investigation did not edit Slider or its derived www copy.

## Evidence and further falsification

- [Commands, full output and verdicts](./experiments/native-runtime/RESULT.md).
- [Sources](./sources-native-runtime.json): Lit design/runtime and explicit keyed
  resets; Vue's documented proxy limitations; current DOM templating explainer.
- The DOM templating explainer proposes both template reuse and fine-grained
  observable updates using standard JavaScript, with child/attribute/property/
  event surfaces. It is a proposal, not a shipped browser API or a dependency
  Nisli can require. Its convergence is design evidence, not compatibility proof.

Before selecting an API, falsify nested templates, changing template kinds,
arrays and key collisions, controlled/uncontrolled transitions, refs and projection,
async work, portal/context behavior, thrown partial renders, and hydration/SSG
contracts. Compare a substantial keyed editor against idiomatic existing Nisli
for rule count, repairs, executed computations and allocation cost. The current
probes do not establish a major agent-productivity gain or full capability parity.
