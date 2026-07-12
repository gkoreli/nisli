/**
 * temp-cleanup.ts — a tiny injectable cleanup registry for tests that stage a
 * build into a mkdtemp dir. Encodes the fleet harness-hygiene contract so a
 * cleanup fault can never corrupt the failure signal:
 *
 *  - ALL-ATTEMPT: every registered root is attempted; a rm that throws does NOT
 *    skip the later roots (no leaked sibling temp dirs).
 *  - PRIMARY PRECEDENCE: if setup/build captured a primary failure, cleanup
 *    preserves it — a cleanup error is collected but never thrown OVER the
 *    primary (which already surfaced at the failing hook).
 *  - CLEANUP-ONLY SURFACING: with no primary, the FIRST cleanup failure is
 *    thrown rather than silently swallowed.
 *
 * `remove` is injectable so the failure branches are unit-tested without a real
 * filesystem fault (see temp-cleanup.test.ts).
 */
import { rmSync } from 'node:fs';

export type Remove = (root: string) => void;

const rmDir: Remove = (root) => rmSync(root, { recursive: true, force: true });

export interface TempCleanup {
  /** Register a temp root; returns it so mkdtempSync can be wrapped inline. */
  track(root: string): string;
  /** Record a setup/build failure so finalize preserves its precedence. */
  capturePrimary(error: unknown): void;
  /**
   * Remove every tracked root (attempting all, even if some throw). If a primary
   * failure was captured, it is preserved (cleanup errors are swallowed so they
   * can't mask it); otherwise the first cleanup error is surfaced.
   */
  finalize(remove?: Remove): void;
}

export function createTempCleanup(): TempCleanup {
  const roots: string[] = [];
  let hasPrimary = false;
  let primary: unknown;
  return {
    track(root) {
      roots.push(root);
      return root;
    },
    capturePrimary(error) {
      hasPrimary = true;
      primary = error;
    },
    finalize(remove = rmDir) {
      const cleanupErrors: unknown[] = [];
      // Attempt EVERY root — a failing rm must not skip later roots.
      for (const root of roots.splice(0)) {
        try {
          remove(root);
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
      // Primary precedence: the setup failure already surfaced at its hook; a
      // cleanup error must not override it. (primary is retained for inspection.)
      if (hasPrimary) {
        void primary;
        return;
      }
      // Cleanup-only: surface the first failure rather than swallow it silently.
      if (cleanupErrors.length > 0) throw cleanupErrors[0];
    },
  };
}
