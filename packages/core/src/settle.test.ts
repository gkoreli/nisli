/**
 * settle.test.ts — Awaitable async quiescence (ADR 0030.2 T2).
 *
 * settle() is the test/verify determinism primitive: it awaits the
 * TERMINATION of framework-started logical requests (query runs, resource
 * loader generations) plus the effect cascades they schedule.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  settle,
  __enrollPending,
  __resetPending,
  __pendingCount,
} from './settle.js';
import { query, QueryClient, __resetQueryDiagnostics } from './query.js';
import { resource } from './resource.js';
import { resetInjector, inject } from './injector.js';

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.catch(() => {});
  return { promise, resolve, reject };
}

const live: { dispose(): void }[] = [];
function track<Q extends { dispose(): void }>(q: Q): Q {
  live.push(q);
  return q;
}

beforeEach(() => {
  resetInjector();
  __resetQueryDiagnostics();
  __resetPending();
});

afterEach(() => {
  for (const q of live) q.dispose();
  live.length = 0;
  __resetPending();
  vi.restoreAllMocks();
});

describe('settle()', () => {
  it('resolves immediately when nothing is pending', async () => {
    expect(__pendingCount()).toBe(0);
    await settle();
    expect(__pendingCount()).toBe(0);
  });

  it('waits for a query run to COMMIT, not merely to be scheduled', async () => {
    const d = deferred<string>();
    const q = track(query(() => ['settle-basic'], () => d.promise));

    let settled = false;
    const p = settle().then(() => { settled = true; });

    await new Promise((r) => setTimeout(r, 10));
    expect(settled).toBe(false); // run in flight — settle() is still waiting
    expect(__pendingCount()).toBe(1);

    d.resolve('v');
    await p;
    expect(settled).toBe(true);
    expect(q.data.value).toBe('v'); // commit landed before settle resolved
    expect(__pendingCount()).toBe(0);
  });

  it('a run stays ONE pending entry across its retries (termination, not settlement)', async () => {
    let calls = 0;
    const q = track(query(
      () => ['settle-retry'],
      async () => {
        calls++;
        if (calls === 1) throw new Error('first attempt');
        return 'ok';
      },
      { retry: 1 },
    ));

    await settle();
    expect(q.data.value).toBe('ok'); // waited through the retry to the commit
    expect(calls).toBe(2);
    expect(__pendingCount()).toBe(0);
  });

  it('dedups across observers: two same-key queries are one logical request', async () => {
    const d = deferred<string>();
    const fetcher = vi.fn(() => d.promise);

    const q1 = track(query(() => ['settle-dedup'], fetcher));
    const q2 = track(query(() => ['settle-dedup'], vi.fn(async () => 'other')));
    await Promise.resolve(); // let the run's microtask invoke the fetcher
    expect(__pendingCount()).toBe(1); // one run, two observers
    expect(fetcher).toHaveBeenCalledTimes(1);

    let settled = false;
    const p = settle().then(() => { settled = true; });
    d.resolve('shared');
    await p;
    expect(settled).toBe(true);
    expect(q1.data.value).toBe('shared');
    expect(q2.data.value).toBe('shared');
  });

  it('an abort-ignoring fetcher cannot wedge settle(): supersession terminates the entry', async () => {
    // Run A: a fetcher that ignores its AbortSignal and NEVER settles.
    const never = new Promise<string>(() => {});
    const q1 = track(query(() => ['wedge'], () => never));
    // Most-recently-mounted observer with a working fetcher takes ownership.
    const q2 = track(query(() => ['wedge'], async () => 'good'));
    await Promise.resolve();
    expect(__pendingCount()).toBe(1);

    // Supersede run A: its registry entry terminates at the ABORT, even
    // though its raw promise stays pending forever.
    inject(QueryClient).invalidate(['wedge']);
    await settle();

    expect(q1.data.value).toBe('good');
    expect(q2.data.value).toBe('good');
    expect(__pendingCount()).toBe(0);
  });

  it('waits for resource() loader commits', async () => {
    const gate = deferred<string>();
    const r = resource(() => 'src', () => gate.promise);

    let settled = false;
    const p = settle().then(() => { settled = true; });
    await new Promise((res) => setTimeout(res, 10));
    expect(settled).toBe(false);

    gate.resolve('done');
    await p;
    expect(r.data.value).toBe('done');
    expect(r.loading.value).toBe(false);
    r.dispose();
  });

  it('a disposed resource generation terminates at its abort', async () => {
    const r = resource(() => 'src', () => new Promise<string>(() => {}));
    await Promise.resolve(); // loader started (and will never settle)
    expect(__pendingCount()).toBe(1);

    r.dispose(); // abort IS the termination
    await settle();
    expect(__pendingCount()).toBe(0);
  });

  it('caps at 50 iterations with diagnostic N603 instead of looping forever', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // A self-perpetuating scheduler: every terminated entry immediately
    // enrolls a timer-gated successor, so each wave costs a fresh settle
    // iteration and quiescence is unreachable by design. (A microtask-speed
    // self-invalidating query cannot reach this cap — the effect loop guard
    // disposes it first; N603 is settle()'s own last line of defense.)
    let active = true;
    const scheduleNext = (): void => {
      const done = __enrollPending();
      setTimeout(() => {
        done();
        if (active) scheduleNext();
      }, 0);
    };
    scheduleNext();

    await settle(); // resolves at the cap — never hangs
    expect(spy.mock.calls.some((args) => String(args[0]).includes('N603'))).toBe(true);

    active = false; // break the loop; the tail entry terminates on its timer
    await settle();
    expect(__pendingCount()).toBe(0);
  });

  it('__resetPending() clears orphaned entries; late terminators are harmless', async () => {
    const done = __enrollPending();
    expect(__pendingCount()).toBe(1);

    __resetPending();
    expect(__pendingCount()).toBe(0);
    await settle();

    done(); // terminator of a reset entry — must not throw or re-add
    expect(__pendingCount()).toBe(0);
  });

  it('settles chained dependent queries in one call (multi-wave quiescence)', async () => {
    const first = track(query(() => ['chain', 'a'], async () => 'a-data'));
    const second = track(query(
      () => ['chain', 'b'],
      async () => 'b-data',
      { enabled: () => first.data.value !== undefined }, // starts only after A commits
    ));

    await settle();
    expect(first.data.value).toBe('a-data');
    expect(second.data.value).toBe('b-data'); // the second wave settled too
  });
});
