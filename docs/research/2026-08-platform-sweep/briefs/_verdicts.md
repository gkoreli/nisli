# Nisli Investment Briefs

Ten ADR-grade investment briefs, one per bet from the August 2026 research sweep ([The Platform Caught Up](https://claude.ai/code/artifact/563573aa-c238-4f81-b7f4-5a1cced2dc2a)). Each was produced by a dedicated agent working read-only against the repo — every current-state claim carries `file:line` evidence, and platform-support claims were verified against primary sources during August 2026. **Nothing here has landed on main: drafts for the fleet to review, renumber as real ADRs, and execute through arch.**

**Execution update (2026-08-21):** Bets 01 and 09a are implemented and gate-green on isolated branches `codex/movebefore` (676d1af) and `codex/symbol-dispose` (0ec1d52) — codex sol/high workers, parent-verified, awaiting arch review. Bets 05 and 07 went through adversarial cross-lab review (codex sol/xhigh): **both verdicts UNSOUND as written**, with concrete revision paths and cheap falsification experiments — full reports in the appendix at the bottom. Their table rows below carry the warning.

## The verdicts at a glance

| # | Bet | Verdict | Size |
|---|-----|---------|------|
| 01 | moveBefore() | Ship now — ~10 lines of production code; the cost is the three-engine Playwright state-preservation proof | 2.5–3.5 days |
| 02 | Overlay stack | Net-deletion — ~985 LOC of hand-rolled overlay machinery replaced by popover + anchor CSS + native dialog, one `beforetoggle` sync seam | 5–8 wks |
| 03 | Navigation router | Split ruling — adopt `navigation.intercept()` behind a two-engine seam; **keep the hand matcher, reject URLPattern** (stringly groups, no Node 20/22) | 8–12 days |
| 04 | View transitions | Core `viewTransition()` calling `flush()` inside the update callback; zero-JS SSG lane via shell-emitted CSS + speculation rules | M, 3 phases |
| 05 | adopt() islands | Resolve ADR 0025 §17 as core adopt(), phased — marker-free HTML + `data-nisli-adopt` flag kills the WWW-14 double-render class; P2 claim-walk rides T4's cached parse. **⚠ Cross-lab review verdict: UNSOUND as written — needs a serialization/replay contract and an internal claim protocol first; see review appendix** | 5–6 wks (disputed) |
| 06 | Agent-native | Three deliverables planned concretely: manifest.json (3 extractors), buildAppResource() (hello-world ~14–17KB gzip vs React's 100–300KB), @nisli/mcp (4 tools); F3 gates size claims | M–L |
| 07 | Server functions | `@nisli/server`: `serverFn()` + Standard Schema, `*.server.ts` module-boundary split, ECMA-429-only ctx (one handler on Node + Workers), Better Auth recipe. **⚠ Cross-lab review verdict: UNSOUND as written — bundle secrecy needs a fail-closed split prototype first; query/SSG "zero-change" claims refuted; see review appendix** | 1–2 wk gate, then 9–13 wks (revised) |
| 08 | Modern CSS | Targeted pass, not rewrite — `field-sizing` already shipped in textarea.ts; @scope closes UI-58/59 ownership intent (not UI-36B mechanics); `light-dark()` collapses the `.dark` block | ~3 wks |
| 09 | Runtime wins | ~0.4KB committed: `Symbol.dispose` aliases, fail-closed `sanitized()`→setHTML, soft-nav guard; `flush({yield})` **rejected** (breaks ADR 0015 sync contract) | S |
| 10 | TC39 interop | Hold — polyfill frozen, Lit labs its only consumer, no semantic divergence found; adapter specced with five tripwires, 1–2 days to build when one fires | spec-only |

Briefs follow, in rank order.

---
