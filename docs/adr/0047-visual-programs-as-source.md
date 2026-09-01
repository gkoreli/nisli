# 0047. Visual Programs — A Generative Visual Source Above Typed Engine Code

**Date**: 2026-08-31
**Status**: Superseded by [0047.1](./0047.1-live-visual-programming.md)
**Depends on**: [0034](./0034-engine-typed-blocks-decided-by-an-engine.md), [0035](./0035-engine-appearance-layer.md), [0041](./0041-engine-proof-domain.md), [0044](./0044-engine-deterministic-decisions.md)
**Evidence**: [visual-programming research programme](../research/visual-programming/README.md)

## Context

> Historical note: this ADR tested a visual source that compiled to Engine
> TypeScript. The stronger direct-execution model was selected in ADR 0047.1;
> this record remains as the path that exposed why the compiler is unnecessary.

`@nisli/engine` removes appearance decisions from application code, but the
application author still writes a nested TypeScript construction:

```ts
Page({
  children: computed(() => [
    Section({ children: [Form({ ... })] }),
    Section({ children: [Grid({ ... }), Table({ ... })] }),
  ]),
});
```

This is substantially safer than HTML plus application-local CSS, but it is
still a textual description of a rendered hierarchy. Making the syntax more
compact would improve notation without changing the authoring medium. A fluent
builder, tagged template, object schema, or JSX replacement would remain a DSL
for describing a tree.

The proposed author is an agent with native visual generation and perception.
For that author, the highest-level program need not be a textual tree. The
agent should be able to create and revise the desired observations directly,
while a compiler recovers the typed semantic implementation.

One screenshot is insufficient. A UI is a related family of observations over
viewport, application state, representative data, input mode, density, and
time. A bitmap records one sample and has neither continuity nor an editing
model. A scene graph merely moves the textual layout DSL into another encoding.

The unresolved research question is therefore not how to emit TypeScript. It
is whether a model can own a persistent, directly manipulable **visual
program** whose observations remain one coherent product across those axes.

## Decision

Open a research track for a visual source layer above `@nisli/engine`. Do not
add a visual DSL, image format, model runtime, or compiler API to a public
package until the source representation passes the gates in this ADR.

The conceptual contract is:

```text
visual program + observation context -> rendered observation
visual program + typed behavior contract -> @nisli/engine TypeScript
```

This notation describes required operations; it does not prescribe a serialized
tree. The visual program may ultimately be a learned latent, a visual-token
field, model state plus edit history, or another representation that does not
yet exist. Its human- and agent-facing projection is the visual result itself.

### 1. The visual program is canonical at authoring time

Generated TypeScript is an inspectable, typechecked build artifact. An author
changes the visual program or the behavior contract and recompiles; they do not
repair layout by editing emitted code. Emitted code may be verbose because it
is no longer the primary authoring surface.

### 2. Behavior remains typed and non-visual

Visual generation must not guess domain behavior. The input contract owns:

- data types and representative fixtures;
- application states and transitions;
- actions, validation, permissions, and destructive effects;
- semantic names and required content;
- accessibility obligations that cannot be inferred from appearance.

The visual program owns appearance, hierarchy as perceived, visual rhythm, and
coherence across observations. The compiler reconciles the two. A visual that
contradicts the behavior contract is a compiler diagnostic, not permission to
invent behavior.

### 3. The Engine remains the deterministic runtime

The compiler targets the existing typed blocks and their rules. CSS, pixels,
breakpoints, focus policy, and overflow mechanics remain absent from app code.
`prove()` and `verify()` remain the correctness oracles for the emitted screen.
The visual model is a build-time author; it does not enter the browser runtime.

When the visual requests a behavior or structure the Engine cannot express,
the compiler reports a vocabulary gap. It must not smuggle appearance through
`style`, `className`, dimensions, or a new per-instance visual prop.

### 4. A screenshot is a probe carrier, not the proposed source format

The first experiment may use a raster observation sheet because current hosted
image generators expose rendered output but not persistent latent state. That
probe can test generation, perception, contract discipline, and compilation.
It cannot validate the central claim that the visual source is continuous,
editable, or callable across contexts.

No successful screenshot-to-code demo is sufficient evidence to accept this
ADR. Pixels-to-code is established prior art and is the easy half.

## Required gates

The research track advances only in this order:

1. **Observation gate.** From one behavior contract, generate at least two
   states at two materially different widths with recognizable shared identity.
2. **Contract gate.** No generated observation invents an action, field, state,
   or data meaning absent from the contract.
3. **Compilation gate.** A separate pass emits type-correct Engine code with no
   appearance vocabulary, and `prove()` returns no claims at the declared
   widths.
4. **Revision gate.** A local visual edit propagates to the affected
   observations without redesigning unrelated states or widths.
5. **Continuity gate.** Unspecified widths and state transitions can be sampled
   coherently; the source is more than a contact sheet of memorized frames.
6. **Round-trip gate.** Compiler diagnostics identify visual/behavior conflicts
   and can be fed back as visual revisions without hand-editing emitted code.

Gates 4 and 5 are the novelty test. If they require reconstructing a scene graph
or hand-authored constraints, the proposed visual program has collapsed back
into a conventional design DSL.

## MVP boundary and expected difficulty

There are three materially different things that may be called an MVP:

| level | deliverable | expected effort | what it proves |
| --- | --- | ---: | --- |
| Demonstrator | prompt/contract -> several rendered observations -> agent-emitted Engine code -> `prove()` | 2–5 engineering days | the workflow is useful and the compiler target is adequate |
| Internal authoring MVP | persistent project, selection/regeneration, contract locks, state/width matrix, diff and diagnostics | 2–4 weeks | an agent can revise a UI visually without losing the family |
| Actual visual-program MVP | shared editable representation with coherent interpolation across width/state and reproducible compilation | 2–4 months, likely model/data work | the new authoring medium exists rather than being simulated |

The final range is deliberately broad. Using a closed image model makes the
first row easy but withholds the latent/editing operations needed by the third.
A serious attempt likely needs an open model, UI-family training data, and an
evaluation set of the same screen across states and widths.

## First experiment

[`visual-source-to-engine`](../research/visual-programming/experiments/visual-source-to-engine/RESULT.md)
uses the Ledger import flow because it contains conditional structure, forms,
summary values, a table, a primary action, and a real narrow-width decision.

The falsification is strict:

- if the visual family is incoherent, direct visual generation is not ready;
- if it invents behavior, a semantic contract cannot merely be a loose prompt;
- if the Engine cannot express the recovered design, its vocabulary or the
  compiler boundary is insufficient;
- if only sampled screenshots exist, the visual-program claim remains unproven
  even when generated code passes every Engine proof.

## Consequences

**Positive.** Nisli can investigate a genuinely post-JSX authoring model
without corrupting the current small, deterministic runtime. Existing Engine
work becomes the compilation target and verifier instead of being discarded.

**Negative.** The project acquires a model- and dataset-heavy research problem
outside its current TypeScript expertise. Visual similarity is not enough;
coherence and contract fidelity need new oracles.

**Neutral.** This decision does not promise a package, syntax, or public API.
Until every gate passes, application authors continue to use typed Engine
blocks directly.

## Prior art boundary

The ingredients exist separately: direct design-image generation
([DesignDiffusion](https://openaccess.thecvf.com/content/CVPR2025/html/Wang_DesignDiffusion_High-Quality_Text-to-Design_Image_Generation_with_Diffusion_Models_CVPR_2025_paper.html),
[UI-Diffuser](https://arxiv.org/abs/2306.06233)); joint image/layout generation
([Visual Layout Composer](https://openaccess.thecvf.com/content/CVPR2024/html/Shabani_Visual_Layout_Composer_Image-Vector_Dual_Diffusion_Model_for_Design_Layout_CVPR_2024_paper.html));
learned visual tokens and editing ([VQ-VAE](https://arxiv.org/abs/1711.00937),
[MaskGIT](https://research.google/pubs/maskgit-masked-image-generative-transformers/));
output-directed programming ([Sketch-n-Sketch](https://ravichugh.github.io/sketch-n-sketch/));
and screenshot-to-code ([pix2code](https://arxiv.org/abs/1705.07962)).

None is accepted here as evidence for a canonical, responsive, stateful visual
program compiled to typed application code. This is a technical literature
boundary, not a patent-clearance opinion.
