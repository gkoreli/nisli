Context: nisli — a fine-grained-signals web-component framework (pnpm workspace: packages/core, router, ssg, ui, www). You are implementing an approved draft design brief: adopt `Node.moveBefore()` at nisli's move sites, feature-detected, with ADR 0023's deferred-teardown retained as the fallback correctness layer.
Working directory: /Users/goga/Documents/goga/.codex-worktrees/nisli/movebefore (a dedicated git worktree on branch codex/movebefore — never touch any other checkout).
Goal: implement the brief at /private/tmp/claude-501/-Users-goga-Documents-goga-nisli/555a71eb-93f0-40a2-a436-90da1f5456d0/scratchpad/bets/bet-01-movebefore.md — read it first, in full. It contains file:line targets, design rulings, and the verification plan. Where the brief and the actual source disagree, the source wins; note the divergence in your report.
Assigned execution: gpt-5.6-sol at high.

Scope (from the brief):
- Feature-detected `moveBefore` (fallback `insertBefore`) at the keyed `each()` reorder site in packages/core/src/template.ts (~line 1120-1130).
- Empty `connectedMoveCallback` on the framework base class in packages/core/src/component.ts (~line 399 region) so spec-level moves become lifecycle no-ops; ADR 0023's deferred disconnect teardown stays in place, unchanged.
- The same feature-detected move in the UI registry portal: packages/ui/registry/default/lib/portal.ts. IMPORTANT: packages/www dogfoods a complete copy of the UI registry — find how registry files propagate to www (search for a sync script or a copied portal.ts under packages/www) and keep the copies in sync the way the repo does it.
- Unit tests: the test environment (happy-dom) lacks moveBefore — add a minimal test shim exactly as the brief describes, plus fallback-path tests. TypeScript may lack the DOM type — use a narrow local type augmentation, not `any` sprawl.
- If a Playwright harness pattern already exists in the repo that can host a real-browser state-preservation spec cheaply, author the spec file; if it would require new infrastructure, do NOT build infrastructure — say so in the report instead.

Constraints:
- Follow all applicable AGENTS.md instructions (auto-loaded from the worktree root; also read .agents/skills/nisli-framework if you touch component authoring semantics).
- Keep changes scoped; no drive-by refactors; preserve unrelated work.
- Do not change public API or add dependencies.
- @nisli/core has a strict size budget (currently 12.4KB min+gzip vs a 10KB target) — keep the production delta to roughly the brief's ~10-line estimate and report the byte delta if the repo has a size measurement script (search docs/worklists/agn for how the gate measured it).
- Commit ownership: create ONE verified bounded commit on branch codex/movebefore. Subject convention is `type(scope): summary (TICKET)` — use `feat(core): adopt moveBefore at move sites (BET01)`. Do not push. Do not commit logs/prompts/reports.
- If you add any script or harness file, include a cleanup checklist in your report (what was created, where, why it stays or should be removed).

Verification (run all, in the worktree):
- pnpm --filter @nisli/core test
- pnpm --filter @nisli/ui test (if the ui package has tests covering portal)
- pnpm build
- pnpm typecheck
- pnpm test (root gate, final)

Return (final message = your report):
- what changed and why, per file
- model and reasoning effort used
- files changed, commands run, full test results (pass/fail counts; paste failures verbatim if any)
- evidence with file:line references
- any divergence between the brief and the source you found
- uncertainty and unresolved risks (explicitly: what only a real-browser run can prove)
