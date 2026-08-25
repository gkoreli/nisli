Context: nisli — a fine-grained-signals web-component framework (repo at /Users/goga/Documents/goga/nisli; pnpm workspace: packages/core, router, ssg, ui, www). A draft investment brief proposes the framework's largest internals change: a core `adopt()` primitive giving nisli an islands-style story (bind components to SSG-prerendered DOM in place, with state continuity), resolving the open question in docs/adr/0025-core-proposals-from-ui.md §17. Before any build, this design needs an independent adversarial review. You are the cross-lab reviewer; be skeptical, not polite.
Working directory: /Users/goga/Documents/goga/nisli (READ-ONLY — you must not modify anything).
Goal: adversarially review the brief at /private/tmp/claude-501/-Users-goga-Documents-goga-nisli/555a71eb-93f0-40a2-a436-90da1f5456d0/scratchpad/bets/bet-05-adopt-islands.md against the ACTUAL source. Verify its load-bearing claims by reading the code it cites, and attack the design where it is weakest.
Assigned execution: gpt-5.6-sol at xhigh.

Load-bearing claims to verify against source (not exhaustive — find your own):
- The claim that SSG output can stay marker-free because everything hydration markers encode is client-recomputable except provenance (check packages/ssg/src/core-render.ts marker stripping, and what the P2 claim-walk actually needs to re-derive binding positions).
- The claim that a single `data-nisli-adopt` flag kills the WWW-14 double-render class at the root (check packages/www/src/client/hydrate.ts invariants and packages/core/src/component.ts connect/setup path — is there a race between custom-element upgrade timing and the flag check?).
- The P2 claim-walk feasibility on top of T4's cached parse (packages/core/src/template.ts — comment markers, cloned-tree walk, text-node splitting; can positions really be claimed against SSG-serialized HTML where the browser parser may have normalized whitespace/text nodes, and where `<each-item>` wrappers and projection content complicate child indices?).
- Form/focus/scroll carry-over in P1's "atomic in-place replace" — what does atomicity actually mean across a microtask boundary; what state demonstrably survives and what cannot.
- Interaction with projection (packages/core/src/projection.ts late-parser sweep), portals escaping SSG snapshots, and display:contents transparent hosts.
- The estimate (~5-6 engineer-weeks, P1 ~2 weeks) — given what you see in the source, is it honest?

Constraints:
- Read-only. Cite file:line for every verified or refuted claim.
- Distinguish: CONFIRMED (verified in source) / REFUTED (contradicted by source, show the evidence) / UNVERIFIABLE (would need a prototype).
- No web access needed; judge against the code.

Return (final message = your report, ordered by severity):
1. Verdict: SOUND / SOUND-WITH-REVISIONS / UNSOUND, one paragraph.
2. Findings ordered by severity, each: claim → evidence (file:line) → consequence → suggested revision.
3. The single riskiest unproven assumption and the cheapest experiment that would test it.
4. Anything the brief missed that the source reveals (hidden coupling, existing code that helps or blocks).
5. Model and reasoning effort used; files inspected.
