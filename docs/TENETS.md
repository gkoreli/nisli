# Framework tenets

This is the canonical source for Nisli's framework design tenets. ADRs record
rationale and decisions; contributor guidance and research reference this
document rather than restating its rules.

## Browser-native authoring

Browser-native authoring is non-negotiable. Plain JavaScript Nisli components
must run directly as browser ES modules with their documented behavior, without
a framework compiler, source transform, code generation, or mandatory build
step. TypeScript and build tooling remain optional.

Optional tooling may check or optimize code, but must preserve its runtime
semantics: the same JavaScript must not acquire different reactivity or lifecycle
behavior when compiled. New authoring features must have a fully supported
runtime path; retaining a less capable buildless mode does not satisfy this
tenet. Runtime template parsing and caching are compatible with it;
framework-specific source rewriting is not required for correctness.

## Context economics

The public API stays one small barrel; components stay one file importing only
`@nisli/core`; there is no hidden build or configuration to hold in context.
A new primitive pays for its tokens: it must remove more explanation than it
adds. This is the agent-era
restatement of [ADR 0019's minimalism](./adr/0019-minimal-runtime-and-native-platform-alignment.md)
— a small surface is an economic property, not only an aesthetic one.

## Document-as-truth

What the author wrote ≈ what is in the DOM ≈ what the accessibility tree exposes.
Anything that inserts a representation between them (virtual DOM, synthetic
events, hydration protocol) fails this lens by construction.

## Failure containment

Failure containment is a shipping requirement. Agent-written code ships before
it is 100% right; boundaries and isolation are why it can. Resilience is part
of the authoring model, not an optional addition.

## Human developer experience

A small API, fast verification, contained failures, and an inspectable runtime
are defensible engineering for human authors too. The bet degrades gracefully
if the author mix shifts slower than expected.

## Background

These tenets consolidate the design lens from
[ADR 0030](./adr/0030-agent-native-authoring.md#1-design-tenets-the-lens) and the
maintainer's explicit browser-native authoring requirement. ADR 0030 retains
the authoring, verification, and debugging rationale and proposals.
