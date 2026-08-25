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
| 03 | Navigation API router | **Phases 1–2 landed** — engine seam plus `NavigationApiEngine` on `navigation.intercept()`, `engine: 'auto' \| 'history' \| 'navigation'`, `router.state()`. URLPattern **rejected**, hand matcher kept. Real-browser proof outstanding (see below) |
| 04 | View transitions, both lanes | **Phase 1 core half landed** — `viewTransition(update, { types })` in core, progressively enhanced. The phase-1 router opt-in, the phase-2 `each()` recipe, and the phase-3 SSG zero-JS lane are not landed |
| 05 | `adopt()` islands | **Blocked** — review verdict UNSOUND as written; needs a serialization/replay contract |
| 06 | Agent-native surface | Not started |
| 07 | `@nisli/server` server functions | **Blocked** — review verdict UNSOUND as written; needs a fail-closed bundle-split gate |
| 08 | Modern-CSS pass | **Batches 0–1 landed** — `light-dark()` + `@property` tokens with the `.dark` block collapsed; `field-invalid`/`field-disabled` as container style queries across the forms family. Batches 2–5 not started |
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

**Document Selection is not preserved**, and the spec says so on purpose. The move
algorithm deliberately runs the [live range pre-remove
steps](https://dom.spec.whatwg.org/#live-range-pre-remove-steps), collapsing a boundary
inside the moved node to `(oldParent, index-of-node)`. `insertBefore()` does the same.
Not a property `moveBefore` preserves, not a regression, no longer asserted.

*Correction (2026-08-24):* this was first recorded here as "collapses to offset 0". That
was an artifact of probing with the moved node at index 0. Re-measured with it at index 2,
`anchorNode` becomes the old parent and `anchorOffset` becomes **2** in both Chromium and
Firefox — the spec's rule exactly. Commit `3e7f5a1`'s message carries the original wording.

*Correction (2026-08-24):* commit `e1fc523` claims the parented-but-disconnected reorder
was "probed in all three engines". It was not. WebKit has no `moveBefore()`, so its row
exercised the `insertBefore()` fallback — the probe's own output recorded
`moveBeforeAvailable: false` for it. That finding is a **two-engine** result about
`moveBefore()`. The conclusion is unchanged and is now backed by the spec rather than by
our probe: the precondition is shadow-including **root identity**, not connectedness, so a
reorder within one detached tree is legal. Separately verified, and the sharper half of
the rule: moving between two *different* detached trees throws `HierarchyRequestError` in
both engines, because root identity is strictly stronger than "both disconnected".

With a working instrument, on Chromium and Firefox: `connectedMoveCallback` fires 10×,
connect/disconnect 0, focus and input selection preserved, no iframe reload (3 → 3),
animation object and `currentTime` intact, popover still open, portal move likewise.
WebKit has no `moveBefore` and takes `insertBefore`: 10 connects, 10 disconnects, iframe
reloads 3 → 6, focus and popover lost. That contrast is what makes the passing rows
meaningful. nisli `setup` re-runs stay 0 on *every* engine, so ADR 0023's deferred
teardown holds up the fallback path.

## Bet 01: a Firefox interop bug we found, not yet reported upstream

Measured 2026-08-24. `moveBefore()` does **not** reliably preserve an animation whose
initiating style depends on the element's *position*, and the two engines disagree about
what should happen.

Setup: `#host > div:nth-child(1) .anim { animation: … }`, then move the first row to the
end so it stops matching.

| | `moveBefore()` | `insertBefore()` (control) |
|---|---|---|
| Chromium | animation cancelled | animation cancelled |
| Firefox | **animation survives, same object, still running** | animation cancelled |

The control is what makes this a finding rather than ordinary CSS re-matching: under
`insertBefore()` both engines cancel, so Firefox's divergence is specific to `moveBefore()`.

Chromium is the correct one. The rule was proposed by rniwa and confirmed by the spec
editor in [whatwg/dom#1255](https://github.com/whatwg/dom/issues/1255): animation state
"should only be preserved if the element that got atomically moved continues to have the
same style which initiated animation applied." Firefox keeps an animation whose initiating
style no longer matches. The mechanism is visible in each engine's source — Gecko's move
path skips `ClearAllAnimationCollections()`, while Blink compensates by invalidating with
`kSubtreeStyleChange` rather than `kLocalStyleChange`.

**Consequence for nisli.** `each()`'s proof asserts animation preservation using an
animation driven by a static attribute — the easy case, which both engines preserve. Any
list styling that drives animation from `:nth-child`, `:first-child`, a sibling combinator,
or a class the reconciler swaps is *not* covered by that assertion and behaves differently
per engine. Treat position-dependent animation as unpreserved, and prefer keyed classes
over positional selectors in animated lists.

Not yet filed with Mozilla — worth reporting.

## Outstanding proof

- **Bet 08's colours are Chromium-only.** `theme-e2e.mjs` verifies all 32 tokens in light,
  in a nested `.dark`, and after a root flip, plus a transition sampled mid-flight — but
  only in Chromium. The 153-preview sweep passes, though it checks upgrade, hydration,
  touch and fit, not pixel colour. `color-scheme` newly themes native scrollbars, form
  controls and `::backdrop`; that has not been compared against a reference.
- **Bet 09c's native path is stub-proven.** happy-dom has no `Element.setHTML`, so that the
  platform's default sanitizer actually strips `<script>`/`onerror` is taken from spec, not
  measured. TrustedHTML pass-through is unverified under a real CSP.
- **Bet 03 is happy-dom only, and phase 2 raised the stakes.** ADR 0026's RTR-6
  real-browser scroll/focus/hash gap is exactly as open as it was before the extraction —
  but `ownsScrollRestoration: false` is no longer dead code. `NavigationApiEngine`
  (`packages/router/src/navigation-engine.ts:133`) declares it, so `router.ts:364` now
  *skips* nisli's own scroll work and trusts the browser, on the default `engine: 'auto'`
  path, for every Chromium and Firefox visitor. Verified by inspection and happy-dom only.
  A three-engine proof forcing both engines is in flight
  (`proof:router-navigation`).
