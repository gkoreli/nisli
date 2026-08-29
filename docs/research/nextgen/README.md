# nextgen — the record of the first attempt

**Status**: record, not a plan · **Dates**: 2026-08-25 → 2026-08-27

The programme that set out to answer the initiating prompt in
[`NEXTGEN-SCRATCHPAD.md`](./NEXTGEN-SCRATCHPAD.md) §0 — *a higher-level
engineering language and engine so agents can build pixel-perfect UI* — and
built `@nisli/intent` instead: a closed styling vocabulary, a stylesheet that
resolves it, a 35-line fit loop and a 3,400-line checker.
[`AUDIT-2026-08-27.md`](./AUDIT-2026-08-27.md) traces, round by round, how the
goal became that build and what survives. The code is on the `intent-archive`
branch (tag `main-before-rewind` marks the old tip); `main` was rewound to the
commit before the programme opened and the unrelated work re-applied.

**What happened next.** The rebuild started from zero on 2026-08-27 with one
typed block and an engine under it, and grew as a real application demanded.
It is [`packages/engine`](../../../packages/engine) with
[`packages/ledger`](../../../packages/ledger) as its first consumer; the
architecture is recorded in [ADR 0034](../../adr/0034-engine-typed-blocks-decided-by-an-engine.md)
and its visual layer in [ADR 0035](../../adr/0035-engine-appearance-layer.md).
The withdrawn ADRs 0032/0033 keep their numbers.

Kept because the evidence outlives the code:

| where | what | why it still matters |
|---|---|---|
| `PRIOR-ART/01` | constraint and intent layout — Cassowary, GSS, CCSS, Flutter, Fluent overflow, Every Layout | the graves and the living precedents an engine must know |
| `PRIOR-ART/03` | priority- and attention-adaptive UI — five vendors converge on "child declares priority, container decides" | the engine's vocabulary, already discovered three times |
| `PRIOR-ART/04` | agent-native and generative UI — A2UI's 18 components with zero styling props; OpenAI's 12,096-combination button; nobody's UI is machine-checked | the market brief for *UI for agents* |
| `PRIOR-ART/02`, `05` | semantic vocabularies; attention and aesthetics | what closure costs; what can never be a rule |
| `COVERAGE/01–07` | what each CSS area can express from declared intent, measured | the output surface an engine emits into |
| `ORACLE/01–04` | how a checker is verified | for whatever guard remains on the escape hatch |
| `ROUND2-EVIDENCE-*` | the defect corpus; visual-oracle prior art | why appearance, not logic, is where agent UI fails |
| `NORTH-STAR.md` | the 2026-08-25 framing | the document the audit is against |

Dropped: the C11 exclusivity sketch and proof fixture, and the fifth-package
skeleton — artefacts of the withdrawn materialisation, all on `intent-archive`.
