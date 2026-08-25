Context: nisli — a fine-grained-signals web-component framework (pnpm workspace: packages/core, router, ssg, ui, www). You are implementing section (a) of an approved draft brief: explicit-resource-management support — guarded `[Symbol.dispose]` aliases on nisli's disposables so `using e = effect(...)` works (ES2026 explicit resource management, TS 5.2+).
Working directory: /Users/goga/Documents/goga/.codex-worktrees/nisli/symbol-dispose (a dedicated git worktree on branch codex/symbol-dispose — never touch any other checkout).
Goal: implement ONLY section (a) "ERM / Symbol.dispose" of the brief at /private/tmp/claude-501/-Users-goga-Documents-goga-nisli/555a71eb-93f0-40a2-a436-90da1f5456d0/scratchpad/bets/bet-09-runtime-wins.md — read the whole brief first for context, implement only section (a). Sections (b), (c), (d) are explicitly out of scope. Where the brief and the actual source disagree, the source wins; note the divergence in your report.
Assigned execution: gpt-5.6-sol at high.

Scope (from the brief, section a):
- Add guarded `[Symbol.dispose]` aliases to the disposal surfaces the brief identifies (effect disposer, resource dispose, query subscription, Emitter handles — follow the brief's exact list and file:line targets in packages/core/src/).
- tsconfig: the brief says the repo needs `ESNext.Disposable` in lib (or equivalent) — verify the actual tsconfig target/lib and make the minimal change; do not otherwise alter compiler options.
- No polyfill. The brief's guarded approach (alias only when `Symbol.dispose` exists, or TS-downlevel-safe pattern) — follow its recommendation exactly.
- Tests: `using`-based disposal tests (effect stops reacting after block exit; query subscription unsubscribes; Emitter handle detaches). Also a test asserting plain `.dispose()`/existing API still works unchanged.
- Byte budget: the brief estimates ~0.08KB min+gzip. Keep it there; report the measured delta if the repo has a size measurement script (search docs/worklists/agn for how the AGN gate measured core size).

Constraints:
- Follow all applicable AGENTS.md instructions (auto-loaded from the worktree root).
- Keep changes scoped; no drive-by refactors; do not rename existing APIs; additive only.
- No new dependencies.
- Commit ownership: create ONE verified bounded commit on branch codex/symbol-dispose. Subject convention `type(scope): summary (TICKET)` — use `feat(core): Symbol.dispose on disposables (BET09a)`. Do not push. Do not commit logs/prompts/reports.

Verification (run all, in the worktree):
- pnpm --filter @nisli/core test
- pnpm build
- pnpm typecheck
- pnpm test (root gate, final)

Return (final message = your report):
- what changed and why, per file
- model and reasoning effort used
- files changed, commands run, full test results (pass/fail counts; paste failures verbatim if any)
- evidence with file:line references
- any divergence between the brief and the source you found
- uncertainty and unresolved risks
