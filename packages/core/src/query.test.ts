/**
 * query.test.ts — Tests for declarative data loading.
 * Pure logic tests — no DOM needed (query is signal-based).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { query, QueryClient } from './query.js';
import { signal, flushEffects } from './signal.js';
import { resetInjector } from './injector.js';

beforeEach(() => {
  resetInjector();
});

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
  return { promise, resolve, reject };
}

// ── Basic lifecycle ─────────────────────────────────────────────────

describe('query() basic lifecycle', () => {
  it('starts with loading=true after initial effect runs', async () => {
    const d = deferred<string[]>();
    const result = query(
      () => ['tasks'],
      () => d.promise,
    );

    flushEffects();
    // After the effect runs, loading should be true
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(true);
    });
    expect(result.data.value).toBeUndefined();
    expect(result.error.value).toBeNull();

    d.resolve(['task-1', 'task-2']);
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });
    expect(result.data.value).toEqual(['task-1', 'task-2']);
    expect(result.error.value).toBeNull();
  });

  it('sets error on fetcher rejection', async () => {
    const d = deferred<string[]>();
    const result = query(
      () => ['tasks'],
      () => d.promise,
    );

    flushEffects();
    d.reject(new Error('network failure'));

    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });
    expect(result.data.value).toBeUndefined();
    expect(result.error.value?.message).toBe('network failure');
  });

  it('uses initialData before first fetch resolves', async () => {
    const d = deferred<number[]>();
    const result = query(
      () => ['numbers'],
      () => d.promise,
      { initialData: [1, 2, 3] },
    );

    expect(result.data.value).toEqual([1, 2, 3]);

    d.resolve([4, 5, 6]);
    await vi.waitFor(() => {
      expect(result.data.value).toEqual([4, 5, 6]);
    });
  });
});

// ── Dependency change re-fetches ────────────────────────────────────

describe('auto-refetch on dependency change', () => {
  it('refetches when a signal in the key function changes', async () => {
    const scopeId = signal('scope-1');
    const fetcher = vi.fn(async () => [`data-for-${scopeId.value}`]);

    const result = query(
      () => ['tasks', scopeId.value],
      fetcher,
    );

    flushEffects();
    await vi.waitFor(() => {
      expect(result.data.value).toEqual(['data-for-scope-1']);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    scopeId.value = 'scope-2';
    flushEffects();

    await vi.waitFor(() => {
      expect(result.data.value).toEqual(['data-for-scope-2']);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

// ── Race conditions ─────────────────────────────────────────────────

describe('race conditions', () => {
  it('discards stale responses', async () => {
    const scopeId = signal('scope-1');
    const d1 = deferred<string>();
    const d2 = deferred<string>();
    let callCount = 0;

    const fetcher = () => {
      callCount++;
      return callCount === 1 ? d1.promise : d2.promise;
    };

    const result = query(
      () => ['data', scopeId.value],
      fetcher,
    );

    flushEffects();
    // First fetch is in flight

    // Change scope before first fetch resolves
    scopeId.value = 'scope-2';
    flushEffects();
    // Second fetch starts, first should be stale

    // Resolve second fetch first
    d2.resolve('result-2');
    await vi.waitFor(() => {
      expect(result.data.value).toBe('result-2');
    });

    // Resolve first fetch (stale) — should NOT overwrite
    d1.resolve('result-1');
    await new Promise(r => setTimeout(r, 10));
    expect(result.data.value).toBe('result-2'); // still scope-2 data
  });
});

// ── enabled option ──────────────────────────────────────────────────

describe('enabled option', () => {
  it('skips fetch when enabled returns false', async () => {
    const scopeId = signal<string | null>(null);
    const fetcher = vi.fn(async () => ['data']);

    const result = query(
      () => ['tasks', scopeId.value],
      fetcher,
      { enabled: () => scopeId.value !== null },
    );

    flushEffects();
    await new Promise(r => setTimeout(r, 10));
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.loading.value).toBe(false);

    // Enable by setting scope
    scopeId.value = 'scope-1';
    flushEffects();

    await vi.waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });
});

// ── Retry ───────────────────────────────────────────────────────────

describe('retry option', () => {
  it('retries failed fetches', async () => {
    let attempt = 0;
    const fetcher = async () => {
      attempt++;
      if (attempt < 3) throw new Error(`fail-${attempt}`);
      return 'success';
    };

    const result = query(
      () => ['retry-test'],
      fetcher,
      { retry: 2 },
    );

    flushEffects();
    await vi.waitFor(() => {
      expect(result.data.value).toBe('success');
    });
    expect(attempt).toBe(3);
    expect(result.error.value).toBeNull();
  });

  it('reports error after all retries exhausted', async () => {
    const fetcher = async () => {
      throw new Error('always fails');
    };

    const result = query(
      () => ['fail-test'],
      fetcher,
      { retry: 2 },
    );

    flushEffects();
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });
    expect(result.error.value?.message).toBe('always fails');
  });
});

// ── QueryClient ─────────────────────────────────────────────────────

describe('QueryClient', () => {
  it('invalidate() removes matching cache entries', () => {
    const client = new QueryClient();
    client.set('["tasks","1"]', 'data1', 0);
    client.set('["tasks","2"]', 'data2', 0);
    client.set('["users","1"]', 'user1', 0);

    const count = client.invalidate(['tasks']);
    expect(count).toBe(2);
    expect(client.getCached('["tasks","1"]')).toBeUndefined();
    expect(client.getCached('["users","1"]')).toBe('user1');
  });

  it('clear() removes everything', () => {
    const client = new QueryClient();
    client.set('["a"]', 1, 0);
    client.set('["b"]', 2, 0);
    client.clear();
    expect(client.getCached('["a"]')).toBeUndefined();
    expect(client.getCached('["b"]')).toBeUndefined();
  });

  it('isFresh() respects staleTime', () => {
    const client = new QueryClient();
    client.set('["x"]', 'data', 5000); // 5 second staleTime
    expect(client.isFresh('["x"]', 5000)).toBe(true);
    expect(client.isFresh('["x"]', 0)).toBe(false); // 0 = always stale
  });
});

// ── Callbacks ───────────────────────────────────────────────────────

describe('callbacks', () => {
  it('onSuccess fires after successful fetch', async () => {
    const onSuccess = vi.fn();
    const result = query(
      () => ['cb-test'],
      async () => 'hello',
      { onSuccess },
    );

    flushEffects();
    await vi.waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('hello');
    });
  });

  it('onError fires after failed fetch', async () => {
    const onError = vi.fn();
    const result = query(
      () => ['cb-err-test'],
      async () => { throw new Error('fail'); },
      { onError },
    );

    flushEffects();
    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});

// ── refetch() ───────────────────────────────────────────────────────

describe('refetch()', () => {
  it('manually triggers a new fetch', async () => {
    let counter = 0;
    const fetcher = async () => ++counter;

    const result = query(
      () => ['manual'],
      fetcher,
    );

    flushEffects();
    await vi.waitFor(() => {
      expect(result.data.value).toBe(1);
    });

    result.refetch();
    await vi.waitFor(() => {
      expect(result.data.value).toBe(2);
    });
  });
});

// ── refetch() bypasses staleTime (ADR 0025 item 12) ─────────────────

describe('refetch() bypasses staleTime (ADR 0025 item 12)', () => {
  it('a manual refetch inside a FRESH cache window still invokes the fetcher', async () => {
    let counter = 0;
    const fetcher = vi.fn(async () => ++counter);

    const result = query(
      () => ['fresh'],
      fetcher,
      { staleTime: 60_000 }, // cache stays fresh for a full minute
    );

    flushEffects();
    await vi.waitFor(() => expect(result.data.value).toBe(1));
    expect(fetcher).toHaveBeenCalledTimes(1);

    // The entry is fresh — the AUTOMATIC path would serve it from cache. An
    // explicit refetch is a force: it bypasses staleTime and hits the fetcher.
    result.refetch();
    await vi.waitFor(() => expect(result.data.value).toBe(2));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('the AUTOMATIC path stays cache-first within the fresh window', async () => {
    // Both queries share the auto-singleton QueryClient (inject() creates it on
    // first use; resetInjector() in beforeEach clears it between tests).
    const fetcher = vi.fn(async () => 'value');

    const q1 = query(() => ['shared'], fetcher, { staleTime: 60_000 });
    flushEffects();
    await vi.waitFor(() => expect(q1.data.value).toBe('value'));
    expect(fetcher).toHaveBeenCalledTimes(1);

    // A second query for the same key in the same fresh window is served from
    // cache — the automatic path never forces, so the fetcher is not re-invoked.
    const q2 = query(() => ['shared'], fetcher, { staleTime: 60_000 });
    flushEffects();
    await vi.waitFor(() => expect(q2.data.value).toBe('value'));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('a same-key refetch during an in-flight request DEDUPS (no second fetch), and supersession still discards', async () => {
    const key = signal('a');
    const gates: Record<string, ReturnType<typeof deferred<string>>> = {
      a: deferred<string>(),
      b: deferred<string>(),
    };
    // A spy (not a same-deferred stub) so a wrongly-doubled fetch is caught.
    const fetcher = vi.fn(() => gates[key.value]!.promise);

    const result = query(() => [key.value], fetcher, { staleTime: 60_000 });
    flushEffects(); // fetch 'a' is in-flight
    expect(fetcher).toHaveBeenCalledTimes(1);

    // A manual refetch WHILE 'a' is still in-flight forces past the fresh cache
    // but must JOIN the in-flight request — it does NOT start a second fetch.
    result.refetch();
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Supersede with a newer key so the older 'a' response must be discarded.
    key.value = 'b';
    flushEffects(); // 'b' fetch in-flight, now the latest generation
    expect(fetcher).toHaveBeenCalledTimes(2);

    // Resolve the OLD 'a' after 'b' is pending — 'a' must be discarded.
    gates.a!.resolve('data-a');
    await Promise.resolve();
    gates.b!.resolve('data-b');
    await vi.waitFor(() => expect(result.data.value).toBe('data-b'));
    expect(result.data.value).toBe('data-b'); // stale 'a' never clobbered it
  });
});
