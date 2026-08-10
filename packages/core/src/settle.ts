/**
 * settle.ts — Awaitable async quiescence (ADR 0030.2 T2).
 *
 * `await settle()` resolves when every framework-started logical async
 * request has TERMINATED and the reactive graph is quiescent. Query runs
 * (query.ts) and resource loads (resource.ts) enroll here when they start
 * and deregister at *termination* — commit, terminal error after retries,
 * or abort — never at raw promise settlement. An abort-ignoring fetcher
 * whose run was superseded therefore cannot wedge `settle()`: the run's
 * registry entry closed at the abort even though the underlying promise
 * never resolves.
 *
 * ```ts
 * mount(app);
 * await settle();
 * expect(screen.textContent).toContain('loaded');   // no waitFor polling
 * ```
 *
 * Contract and bounds:
 * - This is a **test/verify primitive** (and the SSG pre-snapshot barrier).
 *   Awaiting it in a live app with continuous background refetch/polling is
 *   unbounded *by design* — each commit may legally schedule the next
 *   request. A scope argument waits for a second consumer (ADR 0030.2 §8).
 * - Each iteration awaits the pending registry, then `tick()` (signal.ts's
 *   bounded microtask-drain contract). Timer-scheduled work is NOT awaited
 *   beyond what a pending logical request itself spans.
 * - Iteration-capped at 50 like `tick()`; hitting the cap emits diagnostic
 *   N603 and resolves — never a silent hang, never an unbounded loop.
 *
 * MERGE ITEM: `__resetPending()` should be folded into `resetInjector()`
 * (injector.ts is owned by another worktree); until then test teardown
 * calls it directly.
 */

import { tick } from './signal.js';

// ── Pending logical-request registry ────────────────────────────────

/**
 * One entry per in-flight logical request. The promise is a *termination*
 * promise resolved by the enroller's `done()` callback — deliberately not
 * the fetcher/loader promise itself (see module doc).
 */
const pending = new Set<Promise<void>>();

/**
 * Enroll a logical async request. Returns its `done()` terminator: call it
 * at commit, terminal error, or abort. Idempotent — a superseded run whose
 * terminator was already invoked by the superseding path may safely call
 * it again from its own settlement branch.
 *
 * @internal — called by query.ts runs and resource.ts loader generations.
 */
export function __enrollPending(): () => void {
  let resolve!: () => void;
  const entry = new Promise<void>((res) => { resolve = res; });
  pending.add(entry);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    pending.delete(entry);
    resolve();
  };
}

/**
 * Reset the registry. Test-teardown escape hatch: entries orphaned by a
 * test that never terminated its fetchers would otherwise leak into the
 * next test's `settle()`.
 *
 * @internal
 */
export function __resetPending(): void {
  pending.clear();
}

/** Current number of enrolled (unterminated) logical requests. @internal */
export function __pendingCount(): number {
  return pending.size;
}

// ── Diagnostics + test isolation ────────────────────────────────────
// Reporting goes through the core diagnostics leaf. The pending registry
// self-registers with resetInjector() so test teardown clears it without
// an upside-down import (settle → injector, never the reverse).
import { diag, isDev } from './diagnostics.js';
import { registerResetHook } from './injector.js';

registerResetHook(__resetPending);

// ── settle() ────────────────────────────────────────────────────────

/**
 * Await async quiescence: loop `tick()` → `Promise.allSettled(pending)`
 * until a full `tick()` leaves the pending registry empty.
 *
 * The `tick()` *first* ordering matters: observer effects created since
 * the last flush are what *start* runs (and enroll them) — the registry
 * can only be trusted empty after the reactive graph has flushed.
 */
export async function settle(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    await tick();
    if (pending.size === 0) return;
    await Promise.allSettled([...pending]);
  }
  if (isDev()) diag(
    'N603',
    'settle() did not reach quiescence within 50 iterations — something '
    + 'keeps scheduling new async work (a self-invalidating query or a '
    + 'polling loop?). settle() is a test/verify primitive; under live '
    + 'background refetch it is unbounded by design. Returning anyway.',
  );
}
