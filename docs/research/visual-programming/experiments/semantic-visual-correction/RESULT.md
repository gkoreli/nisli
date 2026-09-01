# Semantic visual correction — pixel address to identity propagation

**Date**: 2026-08-31

**Verdict: pixel-addressed semantic propagation passes; authoring superiority
and the AI-specific thesis remain unproven.**

The operation points at the Preview surface in `populated@wide`, samples a
visual material by pointing at the note surface in `empty@wide`, and chooses
phase propagation. It does not name `step.preview`, the sampled material, or
the narrow observation. The runtime resolves those details.

The result changes `step.preview` in both `populated@wide` and
`populated@narrow`, whose boxes have different coordinates and dimensions. The
empty observations remain structurally equal to their originals. The resolved
identity, visual brush address, predicate, affected observations, and material
change survive an `.nvis` encode/decode round trip.

## Command

```sh
node --test docs/research/visual-programming/experiments/semantic-visual-correction/visual-edit.test.mjs
```

## Full output

```text
TAP version 13
# Subtest: a painted point resolves to identity and propagates across the phase
ok 1 - a painted point resolves to identity and propagates across the phase
  ---
  duration_ms: 1.067166
  type: 'test'
  ...
# Subtest: observations outside the correction scope do not drift
ok 2 - observations outside the correction scope do not drift
  ---
  duration_ms: 0.354
  type: 'test'
  ...
# Subtest: the visual correction survives binary save and reload
ok 3 - the visual correction survives binary save and reload
  ---
  duration_ms: 8.282958
  type: 'test'
  ...
# Subtest: a painted region without stable identity is rejected
ok 4 - a painted region without stable identity is rejected
  ---
  duration_ms: 0.214334
  type: 'test'
  ...
1..4
# tests 4
# suites 0
# pass 4
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 51.625458
```

## What this falsifies

It falsifies the claim that every cross-observation visual revision must be
expressed as a textual tree edit or repeated once per observation. A rendered
point plus stable identity is sufficient for this class of edit.

It does **not** falsify the stronger objection that this is conventional direct
manipulation over a retained scene graph. The test harness still chooses the
propagation mode. No model inferred intent, no new width was synthesized, and
no comparison with Engine authoring was run.
