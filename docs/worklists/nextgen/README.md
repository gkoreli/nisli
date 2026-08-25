# Next-generation capability — strategy scratchpads

Pre-decision strategy work on the single high-significance capability that
should carry nisli into default-choice territory. Nothing here is an ADR;
survivors graduate to `docs/adr` (or amend 0029 / 0030.x) and the losing
branches stay recorded with the reasoning that killed them.

## Contents

| File | Kind | What it holds |
|---|---|---|
| [`NEXTGEN-SCRATCHPAD.md`](./NEXTGEN-SCRATCHPAD.md) | living scratchpad | Plain-language summary first (§0.1), then the initiating prompt verbatim, the question split, eleven candidate capabilities (C1–C11) with the ones killed on evidence, the round-5 lead, kill criteria carrying their verdicts, twenty open questions, and the iteration log. |
| [`C11-EXCLUSIVITY-AND-DERIVATION.md`](./C11-EXCLUSIVITY-AND-DERIVATION.md) | design sketch | The two load-bearing claims in code: why a second styling channel (`className`) voids derivation/checking/consistency/provenance/fit-solving, and what resolving a value from context looks like against the real registry button. Marks what is real today vs invented for the sketch. |
| [`C11-PROOF/`](./C11-PROOF/) | measured proof | Working fixture (`index.html`), headless-Chromium measurements and findings (`REPORT.md`), and the visual (`proof.webp`). One component with zero pixel values and zero breakpoints, correct in four contexts; derivation through a `display: contents` host and priority-driven fit solving both confirmed. |
| [`ROUND2-EVIDENCE-defect-corpus.md`](./ROUND2-EVIDENCE-defect-corpus.md) | evidence, verbatim | Repo-internal defect corpus: 14 ranked defect classes over 48 UI-layer product defects and 395 de-duplicated commits, the appearance-vs-logic split under two denominators, the three most expensive defects, and adversarial kill-criterion evidence. |
| [`ROUND2-EVIDENCE-visual-oracle-prior-art.md`](./ROUND2-EVIDENCE-visual-oracle-prior-art.md) | evidence, verbatim | External prior art: relational/spec-based layout assertion tools (Galen, `galen-ts`, axe-core, Applitools, Chromatic…), textual snapshot formats (Playwright `ariaSnapshot` + `[box=…]`, CDP `DOMSnapshot`, Blink/WebKit layout-tree baselines, WPT reftests), design lessons, the 2026 vision-model metrology question, and nine arguments that the bet is wrong. |

## Reading order

Scratchpad §0–§4 for the framing and the candidate set, then §5 with its §5.1
and §5.2 revisions for the current position, then the two evidence files for
the sourcing. §6 (kill criteria, with round-2/3 verdicts) and §7 (open
questions) are where the next round starts.

## Provenance

Both evidence files are the complete final outputs of read-only subagent
passes commissioned on 2026-08-25 — findings captured as produced, including
their caveats and unsourced-inference warnings. Rulings on the evidence live in
the scratchpad, never in the evidence files.

Intermediate agent transcripts (tool-call trails, ~1.5 MB of JSONL) are session
artifacts and are deliberately not committed; the evidence files carry every
finding, source citation, and caveat those runs produced.
