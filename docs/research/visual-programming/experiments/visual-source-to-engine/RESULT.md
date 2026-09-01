# Visual source -> Engine code — first falsification probe

**Date**: 2026-08-31

**Verdict: the demonstrator passes; the proposed source representation remains
falsified.**

A current image model painted a coherent four-observation UI family before the
experiment screen code existed. A subsequent visual interpretation emitted 133
lines of typed Engine code. After one verifier-driven compiler repair, both
states typecheck and make zero claims/reports at 1280, 1024, 768, 480, and 360.

The saved source carrier is nevertheless a PNG contact sheet. It has no
persistent editable generator state, cannot promise local revision, and cannot
be called at an unrequested width. It is evidence for the workflow, not the
visual program proposed by [ADR 0047](../../../../adr/0047-visual-programs-as-source.md).

## Files

| file | role |
| --- | --- |
| [`CONTRACT.md`](./CONTRACT.md) | behavior and state contract; deliberately contains no layout description |
| [`PROMPT.md`](./PROMPT.md) | exact image-generation prompt and raw generation output |
| [`visual-source.png`](./visual-source.png) | generated four-observation visual carrier, SHA-256 recorded in `PROMPT.md` |
| [`emitted-screen.ts`](./emitted-screen.ts) | code recovered from the contract and visual |
| [`emitted-screen.test.ts`](./emitted-screen.test.ts) | width proof, contract-content checks, and appearance-vocabulary guard |
| [`tsconfig.json`](./tsconfig.json) | isolated typecheck against real package sources |
| [`vitest.config.ts`](./vitest.config.ts) | isolated happy-dom proof harness |

## What the generated visual did

One built-in image-generation call completed in 54.8 seconds and returned a
1672 x 941 observation sheet. It visibly preserved one product identity across:

- wide empty;
- wide populated;
- narrow empty;
- narrow populated.

The narrow observations recomposed the workflow rather than shrinking the
desktop. The output also invented behavior absent from the contract:
drag-and-drop, reset mapping, pagination, collapsible sections, additional
table meanings, and unrelated navigation entries. The compiler omitted those
suggestions rather than silently expanding the behavior contract.

## Commands and full outputs

### Image generation

The built-in image generation call used the exact prompt in [`PROMPT.md`](./PROMPT.md).

```text
Generated PNG: 1672 x 941, 8-bit/color RGB, non-interlaced.
Generation completed successfully in 54.8 seconds.
```

### Initial typecheck — harness failure

```sh
pnpm exec tsc -p docs/research/visual-programming/experiments/visual-source-to-engine/tsconfig.json
```

```text
docs/research/visual-programming/experiments/visual-source-to-engine/emitted-screen.test.ts(4,41): error TS2307: Cannot find module '@nisli/engine/test' or its corresponding type declarations.
```

The isolated config named `packages/engine/src/test/index.ts`; the package's
actual test export is `packages/engine/src/test/prove.ts`. Correcting the path
made the same command exit 0 with no output. This was experiment harness wiring,
not a product falsification.

### Initial proof — compiler failures

```sh
pnpm exec vitest run --config docs/research/visual-programming/experiments/visual-source-to-engine/vitest.config.ts
```

```text
RUN  v2.1.9 /Users/goga/Documents/goga/nisli

FAIL docs/research/visual-programming/experiments/visual-source-to-engine/emitted-screen.test.ts (4 tests | 2 failed)

1. populated state satisfies the Engine proof at all declared widths

19 claims:
- 1280: FIGURE_TRUNCATED x3 — “May 24, 2024”, “May 23, 2024”, and “May 22, 2024” each need 115px in an 82px date budget.
- 1024: FIGURE_TRUNCATED x3 — the same three dates.
- 768: FIT_CELL x2 — each form received a 203px cell, 37px below its minimum.
- 768: FIT_CELL x1 — the summary grid received a 203px cell, 17px below its minimum.
- 768: FIT_COLUMNS x1 — Date, Payee, and Amount were 85px short in the 203px preview section.
- 768: FIGURE_TRUNCATED x3 — the same three dates.
- 480: FIGURE_TRUNCATED x3 — the same three dates.
- 360: FIGURE_TRUNCATED x3 — the same three dates.

2. the emitted application source contains no appearance escape hatch

TypeError: The URL must be of scheme file
at emitted-screen.test.ts:42:33

Test Files  1 failed (1)
Tests       2 failed | 2 passed (4)
Duration    1.30s
```

The first compiler copied the painting's three-column populated composition by
placing all workflow sections in one `Grid`. At the intermediate observation
width that structure was impossible, and the Engine correctly rejected it. It
also classified long prose dates as figures while emitting values too wide for
the invariant date budget.

The repair:

- emitted sequential semantic sections and let each block make its own width
  decision, losing the painting's exact wide three-column composition;
- emitted compact dates (`May 24`) consistent with `kind: 'date'`;
- read the source guard through `process.cwd()` because Vite supplies a
  non-file `import.meta.url` in this environment.

No assertion or proof width was removed.

### Final gates

```sh
pnpm exec tsc -p docs/research/visual-programming/experiments/visual-source-to-engine/tsconfig.json
pnpm exec vitest run --config docs/research/visual-programming/experiments/visual-source-to-engine/vitest.config.ts
```

```text
The CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.

RUN  v2.1.9 /Users/goga/Documents/goga/nisli

✓ docs/research/visual-programming/experiments/visual-source-to-engine/emitted-screen.test.ts (5 tests) 661ms
  ✓ visual-source compiler probe > populated state satisfies the Engine proof at all declared widths 425ms

Test Files  1 passed (1)
Tests       5 passed (5)
Start at    22:21:23
Duration    1.12s (transform 163ms, setup 0ms, collect 213ms, tests 661ms, environment 80ms, prepare 47ms)
```

```sh
git diff --check
```

```text
(no output; exit 0)
```

## Gate ledger

| ADR 0047 gate | result | evidence |
| --- | --- | --- |
| Observation | **Pass for four declared samples** | one coherent wide/narrow, empty/populated board |
| Contract | **Fail at generation; pass after compiler filtering** | generator invented six classes of behavior |
| Compilation | **Pass after one repair loop** | typecheck clean; 5/5 tests; zero claims/reports at five widths |
| Revision | **Fail / unavailable** | hosted call exposes no persistent editable source |
| Continuity | **Fail / unavailable** | contact sheet cannot sample an absent width or transition |
| Round trip | **Partial** | Engine diagnostics repaired code, but cannot revise the hidden visual source |

## What this says about difficulty

The cheap version is easy: one model call, a small emitted screen, and existing
Engine verification are enough for a convincing demo. The compiler pass was
not the hard part; its first errors were precise and mechanical.

The actual MVP is not a weekend wrapper around image generation. It needs a
saved generative representation, contract locks during generation, local edit
propagation, and tests over unobserved contexts. The estimate in ADR 0047 stands:
2–5 days for a demonstrator, 2–4 weeks for a useful internal observation-based
tool, and 2–4 months for an honest attempt at a persistent visual program.

## Next falsification

Bet 02 should use separately callable observations rather than a four-panel
canvas. Save whatever shared state the model exposes, perform one local edit,
then sample an unrequested width. If unrelated states drift or the source must
be reconstructed as boxes and constraints, the visual-program thesis fails at
its defining gate.
