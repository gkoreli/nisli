# Visual programming research report — what is actually new?

**Date**: 2026-08-31

## Verdict

The current `.nvis` prototype is an executable retained-mode scene graph. That
is useful infrastructure, but it is not yet a new programming paradigm and it
is not evidence that agents are better at `.nvis` than TypeScript.

The research survives in a narrower and more interesting form:

> A Nisli visual program should be a persistent causal model of accepted
> observations and visual corrections, not a complete hand-authored visual
> tree.

Engine supplies the defaults and invariants. The author or agent supplies
counterexamples: “this region, in these situations, should look or behave like
this.” Stable identity turns a correction made on one rendered observation
into a change over the relevant state/width family. The rendered result is
both the execution surface and the address space for revision.

This changes the unit of UI authoring from **construction** to **correction**.
That is the part worth testing.

## What prior art removes from the novelty claim

None of these is new on its own:

- visual scene graphs and binary visual document formats;
- direct manipulation of rendered objects;
- programming by demonstration or examples;
- updating a program by manipulating its output;
- binding visible controls to application behavior;
- responsive variants and component identity;
- agents generating screenshots or frontend code.

[Sketch-n-Sketch (2015)](https://arxiv.org/abs/1507.02988) already updated an
SVG-producing functional program from direct manipulation of its output using
execution traces and program synthesis. Its later
[output-directed programming work](https://arxiv.org/abs/1907.10699) made
mouse manipulation correspond to writing code. If Nisli merely copies marks or
rewrites hidden records, it is a descendant of this work, not a break from it.

Figma's current [code layers](https://www.figma.com/blog/code-on-the-figma-canvas/)
also put working software on a shared canvas, allow visual extraction and
refinement, and synchronize edits back to code. The industry is already
closing the design/code loop. Nisli is only different if it can remove the
second textual UI representation rather than hide or regenerate it.

## What became newly plausible

Earlier direct-manipulation systems needed a known source program, execution
trace, constrained grammar, or developer metadata to resolve an output edit.
The inverse problem is ambiguous: the same pixels can be produced by many
programs, and a drag does not say whether it applies here, at every width, or
to every instance.

General multimodal models introduce three capabilities that were not available
as an economical general-purpose substrate:

1. **Open-vocabulary visual grounding.** A model can map “the preview summary”
   to a region from appearance, language, and context without a DOM selector.
   Google's [visual UI grounding research](https://research.google/pubs/visual-grounding-for-user-interfaces/)
   explicitly studies language-to-region grounding when DOM and accessibility
   metadata are unavailable or incomplete.
2. **Semantic correspondence.** A model can propose that a desktop table, a
   mobile card list, and an empty placeholder are different manifestations of
   one product concept even when their visual structures do not match. The
   runtime can then make that correspondence durable as identity.
3. **Open-ended correction.** Pointing, painting, demonstration, and ordinary
   language can jointly specify a change that is not limited to a fixed toolbar
   command. Interactive program synthesis research already showed that asking
   for missing information can reduce ambiguity; a multimodal agent can now
   conduct that dialogue over the visible result rather than only symbolic
   examples ([Interactive Program Synthesis, 2017](https://arxiv.org/abs/1703.03539)).

The novelty candidate is therefore not “AI writes a visual file.” It is:

```text
perceive rendered counterexample
  → infer semantic target and likely scope
  → ask only about unresolved ambiguity
  → record a durable visual correction
  → evaluate every affected observation
  → keep the correction as executable source
```

Before foundation models, every domain needed bespoke recognition, a small
closed editing grammar, or exposed program structure. Today a general agent
can plausibly supply the semantic inference layer. The deterministic visual
runtime should still own identity, propagation, verification, and execution.

## Why this could be materially better

| Existing workflow | Correction-native visual workflow |
| --- | --- |
| Describe desired pixels indirectly through components, layout primitives, and CSS | Point to the actual discrepancy and demonstrate the desired result |
| Render after authoring to discover whether the description worked | The thing being edited is already the evaluated result |
| A screenshot is disposable evidence | An accepted observation becomes durable program evidence |
| Responsive/state regressions are rediscovered visually | Identity and scope enumerate which observations a correction may affect |
| Agents translate vision → text code → DOM → pixels, then compare again | Agents perceive and revise in one visual coordinate system |
| Source complexity approximates the entire UI construction | Source complexity can approximate the exceptions to Engine policy |

The last row is the largest possible win. If Engine can already produce the
ordinary accessible form, table, overlay, focus behavior, and width decisions,
then `.nvis` need only retain where the desired product differs from those
defaults. A sparse correction program could be smaller, more local, and more
aligned with visual review than either raw CSS or a complete visual scene tree.

This also gives visual feedback memory. Today an agent can fix a screenshot and
later reintroduce the same defect because the screenshot was not source. In the
proposed model, “accepted at populated@narrow” and the correction that made it
acceptable remain executable constraints. The visual review does not evaporate
after the pull request.

## Evidence obtained

The [semantic visual correction probe](./experiments/semantic-visual-correction/RESULT.md)
now demonstrates one mechanical slice:

- the authoring target is a rendered point, not an internal node name;
- appearance is sampled from another rendered point, not named as a style;
- the runtime resolves both points and persists the resulting operation;
- one edit changes the same semantic Preview region at wide and narrow
  coordinates;
- empty observations remain unchanged;
- the edit survives binary encode/decode;
- a visual region without stable identity is rejected rather than silently
  changed.

This proves a useful property of the runtime, not the AI thesis. The operation
still receives an explicit `phase` propagation choice from the test harness.
No agent inferred it, and there is no evidence yet that this workflow beats
editing an Engine screen.

## Why “no-brainer” is premature

Current multimodal agents are not reliable enough to make raw visual inference
the only correctness boundary. Microsoft's
[VideoGUI benchmark](https://www.microsoft.com/en-us/research/publication/videogui-a-benchmark-for-gui-automation-from-instructional-videos/)
reported poor performance from a then-frontier multimodal model on visual-centric
GUI tasks, especially high-level planning. Current work on GUI grounding still
adds cropping, OCR, element detection, histories, or specialized training.

The immediate no-brainer is narrower:

> Every agent-authored UI should retain named rendered observations and visual
> corrections as first-class, executable evidence.

Replacing textual UI source entirely remains a bet. Treating the output as a
durable part of the programming loop is already justified.

## Decisive next experiment

Run the same set of twelve UI revisions in two isolated conditions:

1. an agent edits the existing typed Engine screen from the task description
   and screenshots;
2. an agent receives only the running visual editor, domain-port contract, and
   the same task description.

The tasks must mix appearance, hierarchy, state locality, responsive
correspondence, repeated data, and one deliberately ambiguous request. Both
conditions are scored on:

- successful observations out of the full state/width matrix;
- unintended observation drift;
- domain-contract, keyboard, focus, naming, and native-control violations;
- elapsed time, model turns, input/output tokens, and human clarifications;
- size and intelligibility of the resulting diff;
- whether the same correction is preserved after a later conflicting edit.

The visual thesis earns further investment only if it reduces authoring cost
or regression rate without weakening Engine's semantic and accessibility
guarantees. A beautiful demo is not a pass. A full scene graph that requires
the agent to manipulate hidden records is not a pass. If the visual condition
cannot win this comparison, Nisli should keep Engine code as source and adopt
only the observation/correction layer.
