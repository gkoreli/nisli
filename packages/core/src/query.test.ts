/**
 * query.test.ts — Keyed logical-request store (ADR 0030.2 T1).
 *
 * Pure logic tests — no DOM needed. Issues 0005–0009 each pin a named
 * regression; timing uses settle()/tick() rather than waitFor polling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  query,
  QueryClient,
  type QueryKey,
} from './query.js';
import { settle, __resetPending } from './settle.js';
import { signal, flushEffects, tick } from './signal.js';
import { resetInjector, inject, provide } from './injector.js';

// Helper: create a deferred promise for controlled async tests
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
  // Terminal errors are stored in record signals, not re-thrown to awaiters.
  promise.catch(() => {});
  return { promise, resolve, reject };
}

// Observers are real registrations now — dispose them so records never see
// stale observers across tests.
const live: { dispose(): void }[] = [];
function track<Q extends { dispose(): void }>(q: Q): Q {
  live.push(q);
  return q;
}

beforeEach(() => {
  resetInjector();
  __resetPending();
});

afterEach(() => {
  for (const q of live) q.dispose();
  live.length = 0;
  __resetPending();
  vi.restoreAllMocks();
});

// ── Basic lifecycle ─────────────────────────────────────────────────

describe('query() basic lifecycle', () => {
  it.runIf(typeof Symbol.dispose === 'symbol')('unsubscribes at using block exit', () => {
    const client = inject(QueryClient);

    {
      using result = query(
        () => ['using'],
        async () => 'unused',
        { enabled: () => false },
      );
      expect(result[Symbol.dispose]).toBe(result.dispose);
      expect(client._observers).toBe(1);
    }

    expect(client._observers).toBe(0);
  });

  it('is loading synchronously after construction, then commits', async () => {
    const d = deferred<string[]>();
    const result = track(query(
      () => ['tasks'],
      () => d.promise,
    ));

    // The observer effect runs at construction; the run starts immediately.
    expect(result.loading.value).toBe(true);
    expect(result.status.value).toBe('loading');
    expect(result.data.value).toBeUndefined();
    expect(result.error.value).toBeNull();

    d.resolve(['task-1', 'task-2']);
    await settle();
    expect(result.loading.value).toBe(false);
    expect(result.status.value).toBe('success');
    expect(result.data.value).toEqual(['task-1', 'task-2']);
    expect(result.error.value).toBeNull();
  });

  it('sets a terminal error on fetcher rejection', async () => {
    const d = deferred<string[]>();
    const result = track(query(
      () => ['tasks'],
      () => d.promise,
    ));

    d.reject(new Error('network failure'));
    await settle();
    expect(result.loading.value).toBe(false);
    expect(result.status.value).toBe('error');
    expect(result.data.value).toBeUndefined();
    expect(result.error.value?.message).toBe('network failure');
  });

  it('seeds initialData synchronously before the first commit', async () => {
    const d = deferred<number[]>();
    const result = track(query(
      () => ['numbers'],
      () => d.promise,
      { initialData: [1, 2, 3] },
    ));

    expect(result.data.value).toEqual([1, 2, 3]);

    d.resolve([4, 5, 6]);
    await settle();
    expect(result.data.value).toEqual([4, 5, 6]);
  });
});

// ── Dependency change re-registers the observer ─────────────────────

describe('auto-refetch on dependency change', () => {
  it('refetches when a signal in the key function changes', async () => {
    const scopeId = signal('scope-1');
    const fetcher = vi.fn(async () => [`data-for-${scopeId.value}`]);

    const result = track(query(
      () => ['tasks', scopeId.value],
      fetcher,
    ));

    await settle();
    expect(result.data.value).toEqual(['data-for-scope-1']);
    expect(fetcher).toHaveBeenCalledTimes(1);

    scopeId.value = 'scope-2';
    flushEffects();
    await settle();
    expect(result.data.value).toEqual(['data-for-scope-2']);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

// ── Race conditions ─────────────────────────────────────────────────

describe('race conditions', () => {
  it('a superseded key\'s late response is never shown — it commits to ITS record', async () => {
    const scopeId = signal('scope-1');
    const d1 = deferred<string>();
    const d2 = deferred<string>();
    // Call-count gated (not signal-read gated): the fetcher is invoked a
    // microtask after its run starts, by which time the signal has moved on.
    let call = 0;
    const result = track(query(
      () => ['data', scopeId.value],
      () => (++call === 1 ? d1.promise : d2.promise),
    ));

    // First fetch in flight; switch key before it resolves.
    scopeId.value = 'scope-2';
    flushEffects();

    d2.resolve('result-2');
    await tick();
    expect(result.data.value).toBe('result-2');

    // The old key's response arrives late: the view must not regress …
    d1.resolve('result-1');
    await tick();
    expect(result.data.value).toBe('result-2');

    // … but the zero-observer run COMPLETED AND COMMITTED to its own
    // record (ADR 0030.2 §8): a fresh observer of the old key reads it
    // from cache without fetching.
    const spy = vi.fn(async () => 'never');
    const back = track(query(() => ['data', 'scope-1'], spy, { staleTime: 60_000 }));
    expect(back.data.value).toBe('result-1');
    expect(spy).not.toHaveBeenCalled();
    await settle();
  });
});

// ── enabled option ──────────────────────────────────────────────────

describe('enabled option', () => {
  it('skips fetching while disabled, fetches on enable', async () => {
    const scopeId = signal<string | null>(null);
    const fetcher = vi.fn(async () => ['data']);

    const result = track(query(
      () => ['tasks', scopeId.value], // null is the legal optional sentinel
      fetcher,
      { enabled: () => scopeId.value !== null },
    ));

    await settle();
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.loading.value).toBe(false);
    expect(result.status.value).toBe('idle');

    scopeId.value = 'scope-1';
    flushEffects();
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.data.value).toEqual(['data']);
  });
});

// ── Retry ───────────────────────────────────────────────────────────

describe('retry option', () => {
  it('one run owns the retry loop until success', async () => {
    let attempt = 0;
    const fetcher = async () => {
      attempt++;
      if (attempt < 3) throw new Error(`fail-${attempt}`);
      return 'success';
    };

    const result = track(query(() => ['retry-test'], fetcher, { retry: 2 }));

    await settle();
    expect(result.data.value).toBe('success');
    expect(attempt).toBe(3);
    expect(result.error.value).toBeNull();
  });

  it('reports the terminal error after all retries exhaust', async () => {
    const result = track(query(
      () => ['fail-test'],
      async () => { throw new Error('always fails'); },
      { retry: 2 },
    ));

    await settle();
    expect(result.loading.value).toBe(false);
    expect(result.status.value).toBe('error');
    expect(result.error.value?.message).toBe('always fails');
  });
});

// ── Issue regressions (docs/issues/0005–0009) ───────────────────────

describe('issue 0005: dedup unit is the logical request, not the attempt', () => {
  it('same-key observers share one run through its retries; refetch joins in-flight', async () => {
    const d1 = deferred<string>();
    const d2 = deferred<string>();
    let attempt = 0;
    const fetcher1 = vi.fn(() => (++attempt === 1 ? d1.promise : d2.promise));
    const fetcher2 = vi.fn(async () => 'other');

    const q1 = track(query(() => ['shared'], fetcher1, { retry: 1 }));
    expect(fetcher1).toHaveBeenCalledTimes(0); // fetcher starts a microtask later (0008)
    await Promise.resolve();
    expect(fetcher1).toHaveBeenCalledTimes(1);

    // A second observer mounts mid-flight: it JOINS the logical request —
    // its own fetcher never fires.
    const q2 = track(query(() => ['shared'], fetcher2));
    expect(q2.loading.value).toBe(true);

    // A manual refetch mid-flight also joins (no second fetch).
    q1.refetch();
    q2.refetch();
    expect(fetcher1).toHaveBeenCalledTimes(1);

    // Attempt 1 fails; the SAME run retries. Joiners are still attached —
    // they see the retry-final result, not the first attempt's failure.
    d1.reject(new Error('attempt-1 failed'));
    d2.resolve('recovered');
    await settle();

    expect(q1.data.value).toBe('recovered');
    expect(q2.data.value).toBe('recovered');
    expect(q1.error.value).toBeNull();
    expect(q2.error.value).toBeNull();
    expect(fetcher1).toHaveBeenCalledTimes(2); // the retry, same run
    expect(fetcher2).not.toHaveBeenCalled();
  });
});

describe('issue 0006: invalidation revalidates records with enabled observers', () => {
  it('reruns matching enabled observers once; disabled ones revalidate on re-enable', async () => {
    const fetchA = vi.fn(async () => 'a');
    const fetchB = vi.fn(async () => 'b');
    const fetchC = vi.fn(async () => 'c');
    const fetchD = vi.fn(async () => 'd');
    const gate = signal(false);

    const qA = track(query(() => ['tasks', '1'], fetchA));
    const qB = track(query(() => ['users', '1'], fetchB)); // nonmatching
    const qC = track(query(() => ['tasks', '2'], fetchC, { enabled: () => gate.value }));
    const qD = track(query(() => ['tasks', '3'], fetchD));
    await settle();
    expect(fetchA).toHaveBeenCalledTimes(1);
    expect(fetchB).toHaveBeenCalledTimes(1);
    expect(fetchC).not.toHaveBeenCalled();
    expect(fetchD).toHaveBeenCalledTimes(1);

    qD.dispose(); // disposed observers never refetch

    const client = inject(QueryClient);
    // Three records match the prefix: tasks/1 (enabled), tasks/2
    // (disabled observer), tasks/3 (no observers) — the count contract.
    expect(client.invalidate(['tasks'])).toBe(3);
    await settle();

    expect(fetchA).toHaveBeenCalledTimes(2); // enabled → reran once
    expect(fetchB).toHaveBeenCalledTimes(1); // nonmatching → untouched
    expect(fetchC).not.toHaveBeenCalled();   // disabled → NOT rerun …
    expect(fetchD).toHaveBeenCalledTimes(1); // disposed → NOT rerun
    expect(qA.data.value).toBe('a');

    // … but the disabled observer revalidates on re-enable (stale record).
    gate.value = true;
    flushEffects();
    await settle();
    expect(fetchC).toHaveBeenCalledTimes(1);
    expect(qC.data.value).toBe('c');
    expect(qB.data.value).toBe('b');
  });
});

describe('issue 0007: disable and cache-hit transitions leave no stale state', () => {
  it('disabling mid-flight is immediately non-loading; the run still commits to cache', async () => {
    const on = signal(true);
    const d = deferred<string>();
    const fetcher = vi.fn(() => d.promise);

    const result = track(query(() => ['slow'], fetcher, { enabled: () => on.value }));
    expect(result.loading.value).toBe(true);

    on.value = false;
    flushEffects();
    expect(result.loading.value).toBe(false); // immediately, not eventually

    // The hanging request resolving later cannot resurrect loading state —
    // and per §8 the run completes and commits for the cache.
    d.resolve('late');
    await settle();
    expect(result.loading.value).toBe(false);
    expect(result.data.value).toBe('late');
  });

  it('switching from a pending key to an errored/fresh record shows that record\'s truth', async () => {
    const gateB = deferred<string>();
    const seeder = track(query(() => ['kv', 'b'], () => gateB.promise, { staleTime: 60_000 }));
    gateB.resolve('data-b');
    await settle();
    expect(seeder.data.value).toBe('data-b');

    const key = signal('a');
    const gateA = deferred<string>();
    const fetcher = vi.fn(() => gateA.promise);
    const result = track(query(() => ['kv', key.value], fetcher, { staleTime: 60_000 }));
    expect(result.loading.value).toBe(true);

    gateA.reject(new Error('a failed'));
    await settle();
    expect(result.error.value?.message).toBe('a failed');

    // Pointing at the fresh cached record clears loading AND the stale
    // error in the same transition — the view is the record, so stale
    // local state is unrepresentable.
    key.value = 'b';
    flushEffects();
    expect(result.loading.value).toBe(false);
    expect(result.data.value).toBe('data-b');
    expect(result.error.value).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1); // fresh hit — no refetch
  });
});

describe('issue 0008: synchronous fetcher throws are normal rejections', () => {
  it('a sync throw retries through the same path and can recover', async () => {
    let calls = 0;
    const fetcher = vi.fn((): Promise<string> => {
      calls++;
      if (calls === 1) throw new Error('sync boom');
      return Promise.resolve('recovered');
    });

    const result = track(query(() => ['sync'], fetcher, { retry: 1 }));
    await settle();
    expect(result.data.value).toBe('recovered');
    expect(result.error.value).toBeNull();
    expect(result.loading.value).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('a terminal sync failure settles loading and reports the error', async () => {
    const fetcher = vi.fn((): Promise<string> => {
      throw new Error('always sync');
    });

    const result = track(query(() => ['sync-terminal'], fetcher, { retry: 2 }));
    await settle();
    expect(result.loading.value).toBe(false); // loading always settles
    expect(result.status.value).toBe('error');
    expect(result.error.value?.message).toBe('always sync');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

describe('issue 0009: flat key contract with one serializer', () => {
  it('rejects object elements with coded error N602 at the call site', () => {
    expect(() => query(
      () => [{ id: 1 }] as unknown as QueryKey,
      async () => 'x',
    )).toThrow(/N602/);
  });

  it('rejects undefined elements (null is the optional sentinel)', async () => {
    expect(() => query(
      () => ['a', undefined] as unknown as QueryKey,
      async () => 'x',
    )).toThrow(/N602/);
    expect(() => query(
      () => ['a', Number.NaN],
      async () => 'x',
    )).toThrow(/N602/);

    // null IS legal:
    const result = track(query(() => ['a', null], async () => 'ok'));
    await settle();
    expect(result.data.value).toBe('ok');
  });

  it('a reactive key going invalid later is contained and logged with the code', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = signal<readonly unknown[]>(['ok']);
    const result = track(query(() => bad.value as QueryKey, async () => 'ok-data'));
    await settle();
    expect(result.data.value).toBe('ok-data');

    bad.value = [{}];
    flushEffects();
    expect(spy.mock.calls.some((args) => args.some((a) => String(a).includes('N602')))).toBe(true);
    expect(result.data.value).toBe('ok-data'); // old record view intact
  });

  it('keys are order-sensitive and type-preserving; prefixes match element-wise', async () => {
    const fAB = vi.fn(async () => 'ab');
    const fBA = vi.fn(async () => 'ba');
    const fNum = vi.fn(async () => 'num');
    const fStr = vi.fn(async () => 'str');

    track(query(() => ['a', 'b'], fAB));
    track(query(() => ['b', 'a'], fBA));       // reordered → distinct record
    track(query(() => ['tasks', 1], fNum));
    track(query(() => ['tasks', '1'], fStr));  // '1' !== 1 → distinct record
    await settle();
    expect(fAB).toHaveBeenCalledTimes(1);
    expect(fBA).toHaveBeenCalledTimes(1);
    expect(fNum).toHaveBeenCalledTimes(1);
    expect(fStr).toHaveBeenCalledTimes(1);

    const client = inject(QueryClient);
    expect(client.invalidate(['tasks'])).toBe(2); // both element types match the prefix
    expect(client.invalidate(['a'])).toBe(1);     // ['a','b'] only — not ['b','a']
    expect(() => client.invalidate([{} as unknown as string])).toThrow(/N602/);
    await settle();
  });
});

// ── staleTime is per-observer policy ────────────────────────────────

describe('staleTime (per-observer freshness policy)', () => {
  it('a fresh record serves late observers from cache without fetching', async () => {
    const fetcher = vi.fn(async () => 'value');

    const q1 = track(query(() => ['shared-fresh'], fetcher, { staleTime: 60_000 }));
    await settle();
    expect(q1.data.value).toBe('value');
    expect(fetcher).toHaveBeenCalledTimes(1);

    const q2 = track(query(() => ['shared-fresh'], fetcher, { staleTime: 60_000 }));
    expect(q2.data.value).toBe('value'); // synchronously, from the record
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('an observer with a stricter policy revalidates the same record', async () => {
    let n = 0;
    const fetcher = vi.fn(async () => `v${++n}`);

    const q1 = track(query(() => ['policy'], fetcher, { staleTime: 60_000 }));
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);

    // staleTime 0: this observer's registration always revalidates.
    const q2 = track(query(() => ['policy'], fetcher, { staleTime: 0 }));
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(q1.data.value).toBe('v2'); // shared record truth updated for all
    expect(q2.data.value).toBe('v2');
  });
});

// ── Shared-key run ownership ────────────────────────────────────────

describe('run ownership (most recently mounted observer)', () => {
  it('invalidate reruns with the most recently mounted enabled observer\'s fetcher', async () => {
    const f1 = vi.fn(async () => 'from-1');
    const f2 = vi.fn(async () => 'from-2');

    const q1 = track(query(() => ['owned'], f1, { staleTime: 60_000 }));
    await settle();
    expect(f1).toHaveBeenCalledTimes(1);

    const q2 = track(query(() => ['owned'], f2, { staleTime: 60_000 }));
    await settle();
    expect(f2).not.toHaveBeenCalled(); // fresh — q2 joined the cache

    inject(QueryClient).invalidate(['owned']);
    await settle();
    expect(f2).toHaveBeenCalledTimes(1); // q2 owns the next run
    expect(f1).toHaveBeenCalledTimes(1);
    expect(q1.data.value).toBe('from-2'); // both views share the record
    expect(q2.data.value).toBe('from-2');
  });
});

// ── refetch() ───────────────────────────────────────────────────────

describe('refetch()', () => {
  it('forces past staleTime freshness', async () => {
    let counter = 0;
    const fetcher = vi.fn(async () => ++counter);

    const result = track(query(() => ['fresh'], fetcher, { staleTime: 60_000 }));
    await settle();
    expect(result.data.value).toBe(1);

    // Fresh window — the automatic path would serve cache; refetch forces.
    result.refetch();
    await settle();
    expect(result.data.value).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('is a no-op while disabled', async () => {
    const fetcher = vi.fn(async () => 'x');
    const result = track(query(() => ['off'], fetcher, { enabled: () => false }));
    await settle();
    result.refetch();
    await settle();
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.loading.value).toBe(false);
  });
});

// ── Record store lifecycle ──────────────────────────────────────────

describe('record store (QueryClient)', () => {
  it('a zero-observer in-flight run completes, commits, and the record is never GC\'d', async () => {
    const d = deferred<string>();
    const fetcher = vi.fn(() => d.promise);

    const q1 = track(query(() => ['persist'], fetcher, { staleTime: 60_000 }));
    q1.dispose(); // zero observers, run still in flight

    d.resolve('kept');
    await settle();

    const spy = vi.fn(async () => 'never');
    const q2 = track(query(() => ['persist'], spy, { staleTime: 60_000 }));
    expect(q2.data.value).toBe('kept'); // committed by the orphaned run
    expect(spy).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await settle();
  });

  it('clear() drops records; live enabled observers re-resolve and revalidate', async () => {
    let n = 0;
    const fetcher = vi.fn(async () => `v${++n}`);
    const result = track(query(() => ['c'], fetcher, { staleTime: 60_000 }));
    await settle();
    expect(result.data.value).toBe('v1');

    inject(QueryClient).clear();
    flushEffects();
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.data.value).toBe('v2');
  });

  it('prefetch() warms a record that later observers read without fetching', async () => {
    const client = inject(QueryClient);
    const warm = vi.fn(async () => 'warm');
    await client.prefetch(['warm'], warm, 60_000);
    expect(warm).toHaveBeenCalledTimes(1);

    await client.prefetch(['warm'], warm, 60_000); // fresh → no-op
    expect(warm).toHaveBeenCalledTimes(1);

    const spy = vi.fn(async () => 'cold');
    const q = track(query(() => ['warm'], spy, { staleTime: 60_000 }));
    expect(q.data.value).toBe('warm');
    await settle();
    expect(spy).not.toHaveBeenCalled();
  });
});

// ── Client resolution — the mixed-client class is eliminated ────────

describe('client resolution', () => {
  it('post-inject provide(QueryClient) throws N501 at the cause — the mixed-client state is unrepresentable', () => {
    track(query(() => ['n501-a'], async () => 1)); // binds the auto-singleton
    // Formerly this scenario produced a symptom-side warning (N601). The
    // injector freeze (ADR 0030.2 T6) now throws at the provide() itself,
    // so two live clients cannot exist in dev; N601 was retired.
    expect(() => provide(QueryClient, () => new QueryClient())).toThrowError(/N501/);
  });
});

// ── SSG stance (ADR 0030.2 §8) ──────────────────────────────────────

describe('ssg stance', () => {
  it('build-lifetime records terminate before snapshot: settle() is the barrier', async () => {
    // Core-render shape: a standalone query fetching into the
    // build-lifetime client. The snapshot may only be taken once every
    // record has TERMINATED — settle() is that barrier.
    const result = track(query(() => ['build', 'page'], async () => 'static-content'));
    await settle();
    expect(result.status.value).toBe('success'); // terminated — snapshot-safe
    expect(result.data.value).toBe('static-content');
  });
});
