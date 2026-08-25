# Next-generation capability — strategy scratchpads

Pre-decision strategy work on the single high-significance capability that
should carry nisli into default-choice territory. Nothing here is an ADR;
survivors graduate to `docs/adr` (or amend 0029 / 0030.x) and the losing
branches stay recorded with the reasoning that killed them.

## Contents

| File | Kind | What it holds |
|---|---|---|
| [`NEXTGEN-SCRATCHPAD.md`](./NEXTGEN-SCRATCHPAD.md) | living scratchpad | The initiating prompt verbatim, the question split, nine candidate capabilities (C1–C9), the current lead with its round-2 and round-3 revisions, kill criteria with verdicts, open questions, iteration log. |
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
