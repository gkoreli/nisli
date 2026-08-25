# Platform sweep — August 2026

A research sweep of web standards, framework trends, and platform capabilities worth
building into nisli, followed by one ADR-grade investment brief per bet. Every
current-state claim in the briefs carries `file:line` evidence against the repo as of
`b17e3ae`; platform-support claims were verified against primary sources in August 2026.

**These are drafts, not decisions.** Nothing here is a ratified ADR. Briefs that survive
review should be renumbered into `docs/adr/` and executed through arch.

## Contents

| Path | What it is |
|------|-----------|
| `platform-caught-up.html` | The research report — source of the published artifact |
| `briefs/_verdicts.md` | Verdict table across all ten bets |
| `briefs/bet-NN-*.md` | One investment brief per bet, in rank order |
| `reviews/*.review.md` | Adversarial cross-lab reviews (codex `gpt-5.6-sol`, xhigh) |
| `codex/*.prompt.md` / `*.report.md` | Worker prompts and returned reports, for provenance |

Published copies: [the report](https://claude.ai/code/artifact/563573aa-c238-4f81-b7f4-5a1cced2dc2a)
· [the briefs](https://claude.ai/code/artifact/ad7ff06c-6921-4ac4-aec2-dd550daf3bfb)

## Thesis

The late-2025 → mid-2026 Baseline inflection shipped, as platform primitives, several
things nisli currently hand-rolls. Signals-without-a-VDOM is now ecosystem consensus
rather than a differentiator, which moves the frontier to async, islands, and
agent-legibility.

## Status

| # | Bet | Status |
|---|-----|--------|
| 01 | `moveBefore()` at move sites | **Landed** — feature-detected, `connectedMoveCallback` no-op, deferred teardown retained |
| 02 | Overlay stack on popover / anchor / dialog | Not started — net-deletion of ~985 LOC |
| 03 | Navigation API router | Not started — adopt `navigation.intercept()` behind a seam; URLPattern **rejected** |
| 04 | View transitions, both lanes | Not started |
| 05 | `adopt()` islands | **Blocked** — review verdict UNSOUND as written; needs a serialization/replay contract |
| 06 | Agent-native surface | Not started |
| 07 | `@nisli/server` server functions | **Blocked** — review verdict UNSOUND as written; needs a fail-closed bundle-split gate |
| 08 | Modern-CSS pass | Not started — `field-sizing` already shipped in `textarea.ts` |
| 09a | `Symbol.dispose` on disposables | **Landed** |
| 09b | `sanitized()` → `setHTML`, soft-nav guard | Not started |
| 10 | TC39 Signals interop | Hold — polyfill frozen, adapter specced with five tripwires |

## Outstanding proof

Bet 01's three-engine state-preservation proof (`pnpm --filter @nisli/www proof:movebefore`)
has **not been run in a real browser**. The codex sandbox could not launch Chromium,
Firefox, or WebKit, so the landed change is backed by unit tests that prove dispatch
selection only — not that a move actually preserves focus, selection, scroll, iframe, or
media state.
