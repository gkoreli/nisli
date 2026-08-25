Implementation is complete and locally verified, but I could not create the requested commit because the sandbox cannot write the worktree’s Git index. The branch remains uncommitted at `b17e3ae`; nothing was pushed.

## Changes

- [template.ts](/Users/goga/Documents/goga/.codex-worktrees/nisli/movebefore/packages/core/src/template.ts:39) adds narrow local `moveBefore` typing and feature detection. The keyed reorder uses atomic moves only for wrappers already under the same parent; fresh nodes and unsupported browsers retain `insertBefore()` at [line 1134](/Users/goga/Documents/goga/.codex-worktrees/nisli/movebefore/packages/core/src/template.ts:1134).
- [component.ts](/Users/goga/Documents/goga/.codex-worktrees/nisli/movebefore/packages/core/src/component.ts:630) adds the empty `connectedMoveCallback()`. ADR 0023’s deferred disconnect teardown remains unchanged at [line 611](/Users/goga/Documents/goga/.codex-worktrees/nisli/movebefore/packages/core/src/component.ts:611).
- [each.test.ts](/Users/goga/Documents/goga/.codex-worktrees/nisli/movebefore/packages/core/src/each.test.ts:15) adds the scoped prototype shim and tests attached reorders, fresh attachment, fallback insertion, and removal behavior at [line 182](/Users/goga/Documents/goga/.codex-worktrees/nisli/movebefore/packages/core/src/each.test.ts:182).
- [component.test.ts](/Users/goga/Documents/goga/.codex-worktrees/nisli/movebefore/packages/core/src/component.test.ts:146) verifies the callback schedules no teardown and mutates no component state.
- [registry portal.ts](/Users/goga/Documents/goga/.codex-worktrees/nisli/movebefore/packages/ui/registry/default/lib/portal.ts:38) uses `moveBefore(el, null)` only when both nodes are connected and share an owner document; all other cases retain `appendChild()` at [line 80](/Users/goga/Documents/goga/.codex-worktrees/nisli/movebefore/packages/ui/registry/default/lib/portal.ts:80).
- [portal.test.ts](/Users/goga/Documents/goga/.codex-worktrees/nisli/movebefore/packages/ui/registry/default/lib/portal.test.ts:83) covers atomic mounting, stacking order, detached-target fallback, and cleanup.
- [www portal copy](/Users/goga/Documents/goga/.codex-worktrees/nisli/movebefore/packages/www/src/nisli-ui/lib/portal.ts:80) was regenerated through `pnpm --filter @nisli/www sync` and exactly matches the registry source.
- [movebefore-proof.mjs](/Users/goga/Documents/goga/.codex-worktrees/nisli/movebefore/packages/www/scripts/movebefore-proof.mjs:1) and [movebefore-proof-fixture.js](/Users/goga/Documents/goga/.codex-worktrees/nisli/movebefore/packages/www/scripts/movebefore-proof-fixture.js:1) add the requested Chromium/Firefox/WebKit state-preservation proof. [package.json](/Users/goga/Documents/goga/.codex-worktrees/nisli/movebefore/packages/www/package.json:17) exposes it as `proof:movebefore`.

## Verification

Commands used `MISE_PNPM_VERSION=10.17.1` because the default `pnpm` mise shim had no selected version.

| Command | Result |
|---|---|
| `pnpm --filter @nisli/core test` | PASS — 20 files, 426 tests |
| `pnpm --filter @nisli/ui test` | PASS — 78 files, 1,112 tests |
| `pnpm --filter @nisli/www sync` | PASS — 77 registry files installed |
| `pnpm build` | PASS — all five workspace projects; www render 9/9; Vite 144 modules |
| `pnpm typecheck` | PASS — core, router, SSG, UI, www |
| `pnpm test` | PASS — 121 files, 1,689 tests total |
| `node --check` on both proof files | PASS |
| `git diff --check` | PASS |

Root test totals:

- Core: 426
- Router: 62, with no type errors
- SSG: 36
- UI: 1,112
- WWW: 53

Existing expected diagnostic stderr (`N401`, `N302`, and `N102`) was emitted by established tests; no final test failed.

Size measurement used esbuild 0.28.1, ESM bundle+minify, and `gzip -9n`:

- Minified: 34,745 → 34,872 bytes, **+127 bytes**
- Gzip: 12,291 → 12,335 bytes, **+44 bytes**

## Browser-proof limitation

The proof bundled successfully in memory, but browsers could not launch in this sandbox. Relevant failures verbatim:

```text
chromium: browserType.launch: Target page, context or browser has been closed
Check failed: kr == KERN_SUCCESS. bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer.10123: Permission denied (1100)

firefox: browserType.launch: Executable doesn't exist at /Users/goga/Library/Caches/ms-playwright/firefox-1532/firefox/Nightly.app/Contents/MacOS/firefox

webkit: browserType.launch: Executable doesn't exist at /Users/goga/Library/Caches/ms-playwright/webkit-2311/pw_run.sh
```

Therefore, only an unrestricted real-browser run can prove actual preservation of focus, document selection, iframe state, animation identity/time, popover state, native lifecycle suppression, and cross-shadow-root portal behavior. The happy-dom shim proves dispatch selection, not browser semantics.

## Brief/source divergences

- The file targets and runtime source agreed materially.
- The brief’s `const movable` followed by `dest.moveBefore(...)` did not retain TypeScript narrowing under the repository’s strict check. The implementation captures the narrowly typed method and invokes `moveBefore.call(dest, ...)`, preserving identical runtime behavior without global DOM augmentation.
- The documented 12,389-byte bundle baseline measured as 12,291 bytes with the available esbuild 0.28.1 and deterministic `gzip -9n`.
- The proof initially followed the server-based precedent, but local listening was sandbox-blocked. It now uses Vite’s `write:false` in-memory bundle, requiring no server or generated harness output.

## Cleanup checklist

- The two `packages/www/scripts/movebefore-proof*` files intentionally stay as the durable proof runner and fixture.
- The `proof:movebefore` package script intentionally stays.
- Vite writes no proof output, and browser cleanup is in `finally`; no server or persistent browser profile remains.
- Three disposable bundle measurements under `/private/tmp/nisli-core-*.js` were not added to Git. Sandbox policy denied their removal; normal temporary-directory cleanup may remove them.

## Commit blocker

Staging failed verbatim:

```text
fatal: Unable to create '/Users/goga/Documents/goga/nisli/.git/worktrees/movebefore/index.lock': Operation not permitted
```

Once Git metadata is writable, the pending commit subject is:

```text
feat(core): adopt moveBefore at move sites (BET01)
```

Model: `gpt-5.6-sol`  
Reasoning effort: `high`