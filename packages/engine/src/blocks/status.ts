/**
 * Status — what the engine knows about an async result, and busy tracking for
 * actions. No DOM here: the kernel draws waiting, failure and refresh through
 * `ctx.part()`.
 */
import { signal, type ReadonlySignal } from '@nisli/core';
import { notify } from './notice.js';

/** Structurally matches core's QueryResult<T> and ResourceResult<T>: pass either straight in. */
export interface Status {
  readonly loading: ReadonlySignal<boolean>;
  readonly error: ReadonlySignal<Error | null>;
  readonly data?: ReadonlySignal<unknown>;
  refetch?(): void;
  refresh?(): void;
}

export interface StatusView {
  pending: boolean;
  refreshing: boolean;
  failed: Error | null;
  retry?: () => void;
}

const IDLE: StatusView = { pending: false, refreshing: false, failed: null };

/** What the engine needs to know about an async result, read reactively. */
export function viewOf(s: Status | undefined): StatusView {
  if (!s) return IDLE;
  const loading = s.loading.value;
  const hasData = s.data !== undefined && s.data.value !== undefined;
  const retry = s.refetch ? () => s.refetch!() : s.refresh ? () => s.refresh!() : undefined;
  return { pending: loading && !hasData, refreshing: loading && hasData, failed: s.error.value, retry };
}

// ── Async actions ──────────────────────────────────────────────────────

/**
 * Run an action's handler; if it returns a promise, the id is busy until it
 * settles and a rejection is told to the person. Shared by every block that
 * renders an Action.
 */
export function createBusy() {
  const busy = signal<ReadonlySet<string>>(new Set());
  const is = (id: string) => busy.value.has(id);
  const run = (id: string, handler: (() => void | Promise<unknown>) | undefined) => {
    if (!handler) return;
    let result: void | Promise<unknown>;
    try { result = handler(); } catch (err) { notify(String((err as Error)?.message ?? err), 'negative'); return; }
    if (!result || typeof (result as Promise<unknown>).then !== 'function') return;
    busy.value = new Set([...busy.value, id]);
    (result as Promise<unknown>)
      .catch((err: unknown) => notify(String((err as Error)?.message ?? err), 'negative'))
      .finally(() => { const next = new Set(busy.value); next.delete(id); busy.value = next; });
  };
  return { is, run, busy };
}
