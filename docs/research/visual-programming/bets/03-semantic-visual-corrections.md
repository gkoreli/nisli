# Bet 03 — semantic visual corrections as the authoring primitive

## Claim

The useful unit of a Nisli visual language is not a stored scene tree. It is a
durable correction made against a rendered observation and propagated through
semantic identity.

An author should be able to point at a visible region in one observation,
change it, and state where the correction applies. The runtime resolves the
painted point to identity and carries the change to corresponding regions even
when their coordinates and topology differ.

## Why this is the next bet

Directly executing a retained visual object proved that code generation is
optional. It did not prove that the object is better to author than markup.
The construction fixture still describes every mark, coordinate, and material
textually.

This bet tests a narrower source model:

```text
engine policy + accepted observations + visual corrections + semantic ports
```

The author supplies differences and counterexamples. The Engine supplies
unconstrained layout, native behavior, accessibility, and fit policy. If the
saved program instead requires the author to enumerate the complete visual
tree, `.nvis` has merely become another markup language.

## Required evidence

- a target is selected by a point in the rendered observation, not by a node
  name in author input;
- the selected point resolves to stable identity;
- one edit propagates to a corresponding region with different coordinates;
- observations outside the declared scope remain byte-for-byte equivalent at
  the decoded-program level;
- the edit survives binary save and reload;
- the result records what was selected, what changed, and where it propagated.

## Kill condition

This bet does not establish an agent-native advantage if the author must know
the internal identity, scene-tree structure, coordinates of every variant, or
a style/programming vocabulary equivalent to CSS.

It also does not establish an AI-specific result. Deterministic hit testing and
identity propagation were possible before foundation models. A later bet must
test whether a general multimodal agent can infer the intended target, change,
and propagation scope from visual evidence and ordinary language more reliably
or economically than editing UI code.

## Expected outcome

The mechanical locality claim should pass. The broad claim that visual source
is already a superior UI authoring language should remain unproven.
