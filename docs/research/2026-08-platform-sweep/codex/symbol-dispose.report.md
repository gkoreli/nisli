Implemented section (a) only; sections (b)–(d) were untouched. All code and test gates pass. The requested commit could not be created because the sandbox cannot write this worktree’s external Git metadata.

## Changes by file

- [disposable.ts](/Users/goga/Documents/goga/.codex-worktrees/nisli/symbol-dispose/packages/core/src/disposable.ts:1): added the shared guarded alias helper and conditional structural types. It never polyfills `Symbol.dispose`.
- [signal.ts](/Users/goga/Documents/goga/.codex-worktrees/nisli/symbol-dispose/packages/core/src/signal.ts:652): `effect()` now returns `Disposer`; signal/computed subscriptions inherit the alias through `effect()`.
- [emitter.ts](/Users/goga/Documents/goga/.codex-worktrees/nisli/symbol-dispose/packages/core/src/emitter.ts:59): `Emitter.on()` handles are callable `Disposer`s.
- [resource.ts](/Users/goga/Documents/goga/.codex-worktrees/nisli/symbol-dispose/packages/core/src/resource.ts:14): `ResourceResult` is disposable; its symbol aliases `.dispose()`.
- [query.ts](/Users/goga/Documents/goga/.codex-worktrees/nisli/symbol-dispose/packages/core/src/query.ts:136): `QueryResult` is disposable and unregisters through the same `.dispose()` closure.
- [index.ts](/Users/goga/Documents/goga/.codex-worktrees/nisli/symbol-dispose/packages/core/src/index.ts:18): exports the public `Disposer` type.
- [signal.test.ts](/Users/goga/Documents/goga/.codex-worktrees/nisli/symbol-dispose/packages/core/src/signal.test.ts:325): tests `using` effect teardown, callable compatibility, double disposal, and signal/computed aliases.
- [signal.test-d.ts](/Users/goga/Documents/goga/.codex-worktrees/nisli/symbol-dispose/packages/core/src/signal.test-d.ts:26): proves effects and subscriptions are assignable to `Disposable`.
- [emitter.test.ts](/Users/goga/Documents/goga/.codex-worktrees/nisli/symbol-dispose/packages/core/src/emitter.test.ts:27): proves block exit detaches emitter handles.
- [query.test.ts](/Users/goga/Documents/goga/.codex-worktrees/nisli/symbol-dispose/packages/core/src/query.test.ts:57): proves block exit unregisters the query observer.
- [resource.test.ts](/Users/goga/Documents/goga/.codex-worktrees/nisli/symbol-dispose/packages/core/src/resource.test.ts:31): verifies symbol equality, unchanged `.dispose()`, and idempotence.
- [tsconfig.json](/Users/goga/Documents/goga/.codex-worktrees/nisli/symbol-dispose/tsconfig.json:4) and [core tsconfig](/Users/goga/Documents/goga/.codex-worktrees/nisli/symbol-dispose/packages/core/tsconfig.json:4): added only `ESNext.Disposable`.
- [README.md](/Users/goga/Documents/goga/.codex-worktrees/nisli/symbol-dispose/README.md:125) and [core README](/Users/goga/Documents/goga/.codex-worktrees/nisli/symbol-dispose/packages/core/README.md:113): documented native ERM, unchanged legacy APIs, and application-owned downlevel polyfills.

## Verification

Model: `gpt-5.6-sol`, high reasoning effort.

- `pnpm --filter @nisli/core test`: **20/20 files, 427/427 tests passed**.
- `pnpm build`: **5/5 workspace packages built**; www render tests **9/9 passed**.
- `pnpm typecheck`: **5/5 workspace packages passed**.
- `pnpm test`:
  - Core: 427/427
  - Router: 62/62, no type errors
  - SSG: 36/36
  - UI: 1110/1110
  - WWW: 53/53
  - Total: **121/121 files, 1688/1688 tests passed**
- Strict emitted-declaration consumer checks passed:
  - With `ESNext.Disposable`, all five surfaces compile in `using`.
  - Without it, existing callable/object usage compiles with `skipLibCheck: false`.
- `git diff --check`: passed.
- Expected N401/N302/N102 diagnostic output appeared in existing tests; no failures.

Size gate: no reusable script exists, so I reproduced the documented esbuild minify + gzip method using esbuild 0.28.1 against `HEAD`.

- Before: 34,745 B min / 12,291 B gzip
- After: 34,838 B min / 12,338 B gzip
- Delta: **+93 B min / +47 B gzip (~0.046 KB)**

## Source/brief divergences

- Signal and computed subscriptions already delegate directly to `effect()`, so no additional runtime wrapper was needed at those return sites; only their public return type changed.
- The package core tsconfig overrides the root `lib`, so adding `ESNext.Disposable` only at the root would not compile core. Both effective configurations required the addition.
- The brief records 12,389 B gzip; current `HEAD` measured 12,291 B with the reproducible command above.
- Node v20.20.2 exposes `Symbol.dispose` but not `DisposableStack`. Resource runtime aliasing and type-level `using` were verified, but native `DisposableStack.use(resource(...))` could not execute on this runtime.

## Failures encountered

An intermediate type inference failure was fixed:

```text
src/resource.ts(126,21): error TS2345: Argument of type '{ data: Signal<T | undefined>; loading: Signal<boolean>; error: Signal<Error | null>; refresh(): void; dispose: () => void; }' is not assignable to parameter of type 'ResourceResult<T>'.
  Property '[SymbolConstructor.dispose]' is missing in type '{ data: Signal<T | undefined>; loading: Signal<boolean>; error: Signal<Error | null>; refresh(): void; dispose: () => void; }' but required in type 'ResourceResult<T>'.
```

The first root build invocation hit the local mise shim; rerunning with pnpm 10.17.1 on `PATH` passed:

```text
mise ERROR No version is set for shim: pnpm
Set a global default version with one of the following:
mise use -g node@20.19.5
mise use -g node@24.14.1
mise use -g node@24.18.0
mise use -g pnpm@10.17.1
mise use -g pnpm@10.33.2
mise ERROR Version: 2026.7.7 macos-arm64 (2026-07-15)
```

## Commit blocker

No commit was created and nothing was pushed. Staging failed verbatim:

```text
fatal: Unable to create '/Users/goga/Documents/goga/nisli/.git/worktrees/symbol-dispose/index.lock': Operation not permitted
```

`HEAD` remains `b17e3ae`; all 15 intended files remain unstaged in `codex/symbol-dispose`. The requested subject remains:

```text
feat(core): Symbol.dispose on disposables (BET09a)
```