# Visual programming — can the visual result become the source?

**Status**: active research · **Opened**: 2026-08-31

This programme began by testing [ADR 0047](../../adr/0047-visual-programs-as-source.md)
and now tests its superseder,
[ADR 0047.1](../../adr/0047.1-live-visual-programming.md): an agent authors and
executes a persistent visual program without generated UI code. The research
starts with the uncertain authoring representation, not runtime machinery.

## Ledger

| bet | status | evidence | verdict |
| --- | --- | --- | --- |
| 01. Current image generation can stand in for a visual source | **Experiment complete** | [brief](./bets/01-visual-source-mvp.md), [review](./reviews/01-visual-source-mvp.review.md), [experiment](./experiments/visual-source-to-engine/RESULT.md) | **Partial: useful demonstrator, falsified as the source representation** |
| 02. A persistent visual object can execute directly without generated UI code | **Prototype complete** | [executable `.nvis` example](./examples/import-transactions/README.md) | **Pass for format/runtime skeleton; editor and semantic projection remain** |
| 03. Semantic visual corrections preserve locality across a state/width family | **Mechanical probe complete** | [brief](./bets/03-semantic-visual-corrections.md), [review](./reviews/03-semantic-visual-corrections.review.md), [experiment](./experiments/semantic-visual-correction/RESULT.md) | **Pixel-to-identity propagation passes; authoring advantage unproven** |
| 04. A multimodal agent can infer target, correction, and scope more economically than editing UI code | Not started | — | Decisive agent-native bet |

## Files

- [`REPORT.md`](./REPORT.md) — current synthesis and decisive next experiment.
- `bets/` — one investment brief per testable bet.
- `reviews/` — adversarial reviews and falsification criteria.
- `experiments/` — throwaway probes; every probe carries its command, output,
  and verdict in `RESULT.md`.

## Rule

A rendered screenshot may carry an observation through an early probe, but it
is never called the visual program. The programme succeeds only when the
canonical source can be edited and sampled across contexts without first being
translated into a hand-authored layout tree. A full retained scene graph is an
implementation substrate, not by itself a research success; the target source
model is sparse visual corrections and accepted observations over Engine
policy.
