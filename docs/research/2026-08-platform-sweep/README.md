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
| 01 | `moveBefore()` at move sites | **Landed + proven in three real browsers** |
| 02 | Overlay stack on popover / anchor / dialog | Not started — net-deletion of ~985 LOC |
| 03 | Navigation API router | **Phase 1 landed** — engine seam extracted, zero behaviour change. Phase 2 (`navigation.intercept()`) not started; URLPattern **rejected**, hand matcher kept |
| 04 | View transitions, both lanes | Not started |
| 05 | `adopt()` islands | **Blocked** — review verdict UNSOUND as written; needs a serialization/replay contract |
| 06 | Agent-native surface | Not started |
| 07 | `@nisli/server` server functions | **Blocked** — review verdict UNSOUND as written; needs a fail-closed bundle-split gate |
| 08 | Modern-CSS pass | **Batch 0 landed** — `light-dark()` + `@property`, `.dark` block collapsed. Batches 1–5 not started |
| 09a | `Symbol.dispose` on disposables | **Landed** |
| 09c | `sanitized()` → `setHTML` | **Landed** — fail-closed N107; ssg throws rather than emit escaped `[object Object]` |
| 09d | Soft-nav metrics guard | Not started |
| 10 | TC39 Signals interop | Hold — polyfill frozen, adapter specced with five tripwires |

## Bet 01: what the browser proof actually showed

`pnpm --filter @nisli/www proof:movebefore` now passes on Chromium, Firefox, and WebKit.
Two corrections came out of running it, both recorded here because the briefs were wrong:

**The instrument was broken.** The harness counted custom-element lifecycle by patching
the prototype *after* `customElements.define()`. Reactions are captured into the element
definition at define time, so those wrappers never fired and every counter stayed 0 —
meaning the `connected: 0` / `disconnected: 0` assertions passed vacuously and would have
passed just as happily if every row had been torn down and rebuilt. Fixed by declaring
the reactions in the probe's own class body before `define()`.

**Document Selection is not preserved.** Probed against a bare `<div><span>` with no nisli
involved, `moveBefore()` collapses the selection to offset 0 in Chromium and Firefox — and
`insertBefore()` does the same. Not a property `moveBefore` preserves, not a regression,
no longer asserted.

With a working instrument, on Chromium and Firefox: `connectedMoveCallback` fires 10×,
connect/disconnect 0, focus and input selection preserved, no iframe reload (3 → 3),
animation object and `currentTime` intact, popover still open, portal move likewise.
WebKit has no `moveBefore` and takes `insertBefore`: 10 connects, 10 disconnects, iframe
reloads 3 → 6, focus and popover lost. That contrast is what makes the passing rows
meaningful. nisli `setup` re-runs stay 0 on *every* engine, so ADR 0023's deferred
teardown holds up the fallback path.

## Outstanding proof

- **Bet 08's colours are Chromium-only.** `theme-e2e.mjs` verifies all 32 tokens in light,
  in a nested `.dark`, and after a root flip, plus a transition sampled mid-flight — but
  only in Chromium. The 153-preview sweep passes, though it checks upgrade, hydration,
  touch and fit, not pixel colour. `color-scheme` newly themes native scrollbars, form
  controls and `::backdrop`; that has not been compared against a reference.
- **Bet 09c's native path is stub-proven.** happy-dom has no `Element.setHTML`, so that the
  platform's default sanitizer actually strips `<script>`/`onerror` is taken from spec, not
  measured. TrustedHTML pass-through is unverified under a real CSP.
- **Bet 03 is happy-dom only.** ADR 0026's RTR-6 real-browser scroll/focus/hash gap is
  exactly as open as it was before the extraction. `ownsScrollRestoration: false` is dead
  code today, verified by inspection only.
