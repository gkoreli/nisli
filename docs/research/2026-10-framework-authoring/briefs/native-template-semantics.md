# Native template semantics

**Status:** the design sketch below now has bounded research adapters and
[native runtime findings](../NATIVE-FINDINGS.md). No production change, new
public API, performance result or complete capability-preservation claim.
Proposed expression-callback behavior is not supported by production Nisli;
the computed-view example below runs on the frozen baseline but replaces its subtree.

## Constraint

Follow the [browser-native authoring tenet](../../../TENETS.md#browser-native-authoring).

## 1. Expression callbacks: a modest ergonomic possibility

Proposed child-value syntax:

```js
html`<p>${() => price.value * quantity.value}</p>`
```

JavaScript passes a function, so the runtime can evaluate it under dependency
tracking. Unlike a computed number, the function preserves the calculation.
This needs no source analysis or transform. Current Nisli does not implement
this child-function behavior: template.ts's fallback stringifies such values.
The existing equivalent is an explicit computed() in that slot.

Solid's official buildless HTML documentation explicitly uses function-wrapped
reactive expressions. It also documents ambiguity for function-valued component
props and a workaround involving function parameters. That is evidence to
avoid copying the ambiguity: event handlers, refs and function-valued props
must keep their meaning. Callback binding support would need explicit rules by
binding context, with an explicit wrapper wherever intent is ambiguous.

This removes local wrapping ceremony, not a category of application work.
It is not the principal bet and is not a new language feature from 2026.

## 2. Preserve the live DOM when a view returns the same template again

The earlier illustration introduced view(), but a new public wrapper is not
inherently necessary. Existing computed() supplies the reevaluation boundary:

```js
const panel = computed(() => html`
  <section>
    <input placeholder="Your unfinished note">
    <p>Total: ${price.value * quantity.value}</p>
  </section>
`);
```

The callback supplies the tracking boundary. Rerunning it supplies new values.
The proposed change belongs in html's mounted-template handling: for the same
literal site in the same mounted region, update the existing bindings so the
input node remains in place. This is not current behavior. There is no attempt
to recover a calculation from a primitive or alter normal JavaScript evaluation.
A standalone html call with eager scalar expressions still cannot rerun those
expressions; it needs a computation callback or explicit reactive slot values.

Current core caches parsed HTML by TemplateStringsArray identity at
packages/core/src/template.ts:226, but its TemplateResult exposes mount/dispose
without a binding-update operation. The reactive child path at line 622 checks
result identity; a fresh TemplateResult replaces the old live subtree. The
existing expression experiment reproduces the lost input/edit with an outer
computed view. Parse caching and live-instance reuse solve different problems.

The JavaScript template-object identity contract supplies the stable literal
identity at runtime. Lit's _commitTemplateResult in lit-html.ts compares the
prepared template against the current instance: equality calls _update(values),
otherwise it creates/clones the new instance. This is implementation evidence
that a runtime can do this without a framework source compiler.

The potential gain is removing the need to extract every changing expression
into a separate computed merely to protect surrounding DOM. Existing direct
signal bindings still provide finer-grained work. A callback for a large view
may recompute many values; retaining DOM does not make that computation free.

### Compatibility questions that decide the bet

- Reuse must be per mounted region plus literal identity, never one global
  instance per literal. Different list items must remain distinct and keyed.
- Existing code may intentionally remount. Establish an explicit identity/reset
  mechanism and migration contract before changing computed-template behavior.
  A new view primitive is not intrinsically required, though explicit opt-in may
  prove necessary for compatibility. Setup lifetimes must remain unchanged.
- Same-tag child factory results need a defined prop-update and identity rule.
  New handler closures must replace old closures without stale subscriptions.
- Signal-to-signal and signal-to-plain-value changes must dispose the old
  binding and preserve supported attribute, class, ref and trusted-HTML behavior.
- Setup remains once per component instance. Effects, resources and lifecycle
  hooks must not be recreated indiscriminately inside a rendering callback.
- Prove native focus/selection and input composition in real browsers, alongside
  disposal, thrown renders, conditional branches, custom elements, each() and
  portals. Current happy-dom input evidence is insufficient for these claims.
- Compare real component authoring repairs, allocated objects, executed
  computations and DOM work with current idiomatic Nisli. No speedup is assumed.

## Primary sources checked

- [Solid's buildless HTML contract](https://github.com/solidjs/solid/blob/main/packages/solid/html/README.md):
  function-wrapped expressions and documented function-prop ambiguity.
- [Lit runtime](https://github.com/lit/lit/blob/main/packages/lit-html/src/lit-html.ts#L1613):
  _commitTemplateResult, TemplateInstance._update and template cache.
- [ECMAScript GetTemplateObject](https://tc39.es/ecma262/multipage/ecmascript-language-expressions.html#sec-gettemplateobject):
  template objects reused for the same parse node within a realm. GitHub's
  connector could not fetch the oversized spec.html; the official rendered
  specification was the fallback.
- [TC39 current stage-one ledger](https://github.com/tc39/proposals/blob/main/stage-1-proposals.md):
  Signals remains listed at Stage 1 at this review. Do not claim it is a
  deployed cross-browser mechanism that makes eager expressions reactive.

These are current source inspections, not claims that the techniques were
invented in 2026. The useful advance for Nisli would be a simpler supported
programming model within its existing native-browser constraints.
