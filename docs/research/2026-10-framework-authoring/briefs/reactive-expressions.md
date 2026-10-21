# Reactive template expressions

**Status: withdrawn.** A compiled mode that changes the semantics of the same
JavaScript conflicts with the
[browser-native authoring tenet](../../../TENETS.md#browser-native-authoring).
Seven passing bounded checks do not change that conclusion. Preserve
the experiment as evidence; do not continue it as the product direction.

**Scope:** framework component authoring, independent of app domain.

**Candidate:** an opt-in compiled template mode lowers live scalar expressions
into existing signal/computed bindings. Current buildless HTML retains its
snapshot semantics. A direct signal read lowers to the signal; a supported
derived expression lowers to computed. Structural JavaScript remains explicit.

**Evidence:** the skill's eager-read warning and actual template implementation;
seven passing probe checks, including input identity/edit-value preservation and
equivalence to a variant of the registry's Progress component. Solid's buildless
and compiled docs are the relevant primary precedent.

**Category targeted:** manually choosing leaf tracking boundaries and wrapping
ordinary derived template expressions. It does not solve keyed identity or all
JavaScript control flow.

**Limits:** prototype supplied signal names by fixture; no production symbol
resolver, purity analysis or HTML/context parser. Known unsupported eager factory
expressions are rejected, while reads hidden behind opaque helpers remain an
unsolved case. The semantic change requires explicit opt-in; never silently
compile existing snapshot bindings as live.

**Historical unresolved work (not a next step):** a real typed frontend, source maps, custom component props/events,
snapshot/error semantics, lists/keys, native attributes, trusted HTML, SVG, HMR
and SSR, plus existing core tests and real-browser interaction. Compare author
repairs and emitted/runtime cost. No production or package API is selected.
