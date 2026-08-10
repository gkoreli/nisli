/**
 * query.ts — Keyed logical-request store (ADR 0030.2 T1).
 *
 * The cache unit is a per-key RECORD living in `QueryClient`:
 * `{data, error, status, fetchedAt}` as signals, plus exactly one `run()`
 * owning the retry loop, a per-run `AbortController` handed to the fetcher,
 * and the cache commit. `query()` is a thin OBSERVER: an effect keeps it
 * registered on the record its current key points at, and its outputs are
 * `computed()` views over that record. Dedup unit = logical request, by
 * construction (issues 0005–0009 close as a class).
 *
 * ```ts
 * const tasks = query(
 *   () => ['tasks', scopeId.value],
 *   (signal) => api.getTasks(scopeId.value, { signal }),
 * );
 * tasks.data      // ReadonlySignal<Task[] | undefined>
 * tasks.loading   // ReadonlySignal<boolean>
 * tasks.error     // ReadonlySignal<Error | null>
 * tasks.status    // ReadonlySignal<'idle' | 'loading' | 'success' | 'error'>
 * tasks.refetch() // force a refetch (joins an in-flight run)
 * tasks.dispose() // standalone callers; component setup auto-disposes
 * ```
 *
 * Ownership rules (ADR 0030.2 §8, binding):
 * - The most-recently-mounted enabled observer's fetcher/options own the
 *   next run for a shared key; `staleTime` freshness is per-observer POLICY
 *   (it decides whether *that* observer triggers a run), while the record
 *   state is shared truth.
 * - `invalidate()` marks records stale and reruns only records with ≥1
 *   enabled observer; disabled observers revalidate on re-enable.
 * - A zero-observer record's in-flight run completes and commits.
 * - Records are NEVER garbage-collected: the cache is unbounded for the
 *   life of the client (restates today's unbounded-cache bound). Bound it
 *   operationally with `clear()` or a fresh client per app lifetime.
 *
 * Key contract: keys are FLAT — `readonly (string|number|boolean|null)[]`.
 * Objects and `undefined` are rejected with coded error N602 (`null` is
 * the optional sentinel). Flat keys are order-sensitive: prefer
 * per-endpoint key-builder helpers — a reordered key is a silent cache
 * *miss*, benign relative to a collision, but a miss.
 *
 * SSG stance (documented, not built): under core-render, records fetch
 * into the build-lifetime client and must TERMINATE before snapshot —
 * `await settle()` is the barrier. Otherwise queries must be statically
 * disabled for the build.
 */

import {
  signal,
  effect,
  computed,
  untrack,
  type Signal,
  type ReadonlySignal,
} from './signal.js';
import { hasContext, getCurrentComponent } from './context.js';
import { inject } from './injector.js';
import { __enrollPending } from './settle.js';
import { formatDiag } from './diagnostics.js';

// Diagnostics go through the core leaf (diagnostics.ts). Codes N602–N603
// belong to the query/async cluster (N601 retired before release — see
// the eliminated-class note below).

/** Build the coded error for key-contract violations. Always thrown —
 *  key validity is a contract, not an advisory diagnostic. */
function keyError(detail: string): Error {
  return new Error(formatDiag(
    'N602',
    `invalid query key: ${detail}. Keys must be flat `
    + 'readonly (string | number | boolean | null)[] arrays — spread '
    + 'object params into tuple elements; null is the optional sentinel.',
  ));
}

// ── Key contract ────────────────────────────────────────────────────

/** A single query-key element. `null` is the optional sentinel. */
export type QueryKeyElement = string | number | boolean | null;

/** The supported key contract: a flat, order-sensitive tuple. */
export type QueryKey = readonly QueryKeyElement[];

/**
 * Validate a key against the flat contract and return a detached copy
 * (callers may mutate their array; records must not observe that).
 * Rejects objects, arrays, functions, undefined, and non-finite numbers
 * (NaN/Infinity JSON-serialize as null and would collide) with N602.
 */
function validateKey(raw: unknown): QueryKey {
  if (!Array.isArray(raw)) {
    throw keyError(`expected an array, got ${typeof raw}`);
  }
  for (let i = 0; i < raw.length; i++) {
    const el: unknown = raw[i];
    if (el === null) continue;
    const t = typeof el;
    if (t === 'string' || t === 'boolean') continue;
    if (t === 'number') {
      if (Number.isFinite(el)) continue;
      throw keyError(`non-finite number at index ${i} (would collide with null)`);
    }
    if (el === undefined) {
      throw keyError(`undefined at index ${i}`);
    }
    throw keyError(`${t} at index ${i}`);
  }
  return raw.slice() as QueryKey;
}

/** THE one serializer: JSON.stringify of the validated flat array. */
function serializeKey(key: QueryKey): string {
  return JSON.stringify(key);
}

/** Element-wise prefix match over validated keys (=== is sound: elements
 *  are primitives and NaN is rejected by the contract). */
function matchesPrefix(key: QueryKey, prefix: QueryKey): boolean {
  if (prefix.length > key.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (key[i] !== prefix[i]) return false;
  }
  return true;
}

// ── Types ───────────────────────────────────────────────────────────

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

/** Fetcher contract: receives the run's AbortSignal. Zero-arg fetchers
 *  remain assignable. */
export type QueryFetcher<T> = (signal: AbortSignal) => Promise<T>;

export interface QueryResult<T> {
  /** The record's data, or `initialData`/undefined before first commit. */
  data: ReadonlySignal<T | undefined>;
  /** True while this observer is enabled and its record is fetching. */
  loading: ReadonlySignal<boolean>;
  /** The record's terminal error, or null. Cleared when a run starts. */
  error: ReadonlySignal<Error | null>;
  /** The record's lifecycle status. */
  status: ReadonlySignal<QueryStatus>;
  /** Force a refetch: bypasses staleTime freshness, but JOINS an in-flight
   *  logical request rather than starting a second one (issue 0005). No-op
   *  while disabled. */
  refetch(): void;
  /** Unregister this observer. Component setup calls this automatically at
   *  teardown; standalone callers (tests, scripts) call it explicitly. The
   *  record — and any in-flight run — survives: zero-observer runs complete
   *  and commit (ADR 0030.2 §8). */
  dispose(): void;
}

export interface QueryOptions<T> {
  /** Cache freshness duration in ms for THIS observer. Default: 0 (a
   *  registration/re-enable always revalidates). */
  staleTime?: number;
  /** Number of retries the run performs when this observer owns it. Default: 0 */
  retry?: number;
  /** Skip fetching while this returns false. Signal reads are tracked. */
  enabled?: () => boolean;
  /** Synchronous seed committed into an untouched (idle) record. */
  initialData?: T;
}

// ── Record store ────────────────────────────────────────────────────

interface QueryRecord {
  readonly key: QueryKey;
  readonly serialized: string;
  readonly data: Signal<unknown>;
  readonly error: Signal<Error | null>;
  readonly status: Signal<QueryStatus>;
  /** Epoch ms of the last successful commit; 0 = never. */
  readonly fetchedAt: Signal<number>;
  /** Marked by invalidate(); cleared when a run starts. */
  stale: boolean;
  /** True while a run is in flight (status mirrors it reactively). */
  running: boolean;
  /** Increments per run start; a superseded run may never commit. */
  generation: number;
  controller: AbortController | null;
  /** The in-flight run (joinable by prefetch). */
  runPromise: Promise<void> | null;
  /** settle() terminator for the in-flight run. */
  terminate: (() => void) | null;
  readonly observers: Set<QueryObserver>;
}

interface QueryObserver {
  readonly mountIndex: number;
  readonly fetcher: QueryFetcher<unknown>;
  readonly staleTime: number;
  readonly retry: number;
  enabled: boolean;
  record: QueryRecord | null;
}

/** Monotonic mount counter — "most recently mounted" is decided by
 *  query() construction order, not re-registration order. */
let nextMountIndex = 0;

/** Read a record signal without tracking it into the ambient observer —
 *  the observer effect must depend on keys/enabled/version ONLY, never on
 *  record state (that is what keeps refetch loops unrepresentable). */
function peek<T>(s: ReadonlySignal<T>): T {
  let v!: T;
  untrack(() => { v = s.value; });
  return v;
}

function toError(cause: unknown): Error {
  if (cause instanceof Error) return cause;
  try {
    return new Error(String(cause));
  } catch {
    return new Error('Unknown error');
  }
}

/**
 * Global keyed logical-request store. One per app: resolved via
 * `inject(QueryClient)` (auto-singleton; override with
 * `provide(QueryClient, ...)` BEFORE the first query() call).
 *
 * Records are never GC'd — see the module doc for the bound.
 */
export class QueryClient {
  /** @internal */ _records = new Map<string, QueryRecord>();
  /** @internal clear() bumps this; observer effects track it and re-resolve. */
  _version = signal(0);
  /** @internal live observer count (N601 mixed-client diagnostic). */
  _observers = 0;

  /**
   * Mark records matching the key prefix stale and rerun those with ≥1
   * enabled observer (using the owning observer's fetcher/options).
   * Disabled observers revalidate on re-enable; a record with only
   * disabled/no observers stays stale until one arrives. Returns the
   * number of records invalidated.
   *
   * invalidate(['tasks']) matches ['tasks'], ['tasks', '1'], ['tasks', '2', 'x'].
   */
  invalidate(keyPrefix: QueryKey): number {
    const prefix = validateKey(keyPrefix);
    let count = 0;
    for (const rec of this._records.values()) {
      if (!matchesPrefix(rec.key, prefix)) continue;
      count++;
      rec.stale = true;
      const owner = ownerOf(rec, /* requireEnabled */ true);
      if (owner) startRun(rec, owner.fetcher, owner.retry);
    }
    return count;
  }

  /**
   * Drop every record. In-flight runs are aborted (a settle() termination).
   * Live observers re-resolve fresh records on the version bump — enabled
   * ones revalidate immediately.
   */
  clear(): void {
    for (const rec of this._records.values()) {
      rec.generation++;
      rec.controller?.abort();
      rec.terminate?.();
      rec.controller = null;
      rec.terminate = null;
      rec.runPromise = null;
      rec.running = false;
      rec.observers.clear();
    }
    this._records.clear();
    this._version.value++;
  }

  /**
   * Imperatively warm a record. Joins an in-flight run; a fresh record
   * (per the given staleTime) is a no-op. Otherwise starts a run with THE
   * GIVEN fetcher — an explicit imperative is its own owner. The run
   * commits even with zero observers. Resolves at run termination.
   */
  prefetch<T>(key: QueryKey, fetcher: QueryFetcher<T>, staleTime = 0): Promise<void> {
    const rec = resolveRecord(this, key);
    if (rec.running) return rec.runPromise ?? Promise.resolve();
    if (!rec.stale && peek(rec.status) === 'success' && staleTime > 0
      && Date.now() - peek(rec.fetchedAt) < staleTime) {
      return Promise.resolve();
    }
    return startRun(rec, fetcher as QueryFetcher<unknown>, 0);
  }
}

/** Get-or-create the record for a key. Validation throws N602. */
function resolveRecord(client: QueryClient, rawKey: unknown): QueryRecord {
  const key = validateKey(rawKey);
  const serialized = serializeKey(key);
  let rec = client._records.get(serialized);
  if (!rec) {
    rec = {
      key,
      serialized,
      data: signal<unknown>(undefined),
      error: signal<Error | null>(null),
      status: signal<QueryStatus>('idle'),
      fetchedAt: signal(0),
      stale: false,
      running: false,
      generation: 0,
      controller: null,
      runPromise: null,
      terminate: null,
      observers: new Set(),
    };
    client._records.set(serialized, rec); // never deleted — documented bound
  }
  return rec;
}

/** The observer whose fetcher/options own the next run: most recently
 *  mounted, preferring enabled observers (a disabled observer asked not
 *  to fetch — its fetcher should not fire). */
function ownerOf(rec: QueryRecord, requireEnabled = false): QueryObserver | undefined {
  let best: QueryObserver | undefined;
  let bestDisabled: QueryObserver | undefined;
  for (const obs of rec.observers) {
    if (obs.enabled) {
      if (!best || obs.mountIndex > best.mountIndex) best = obs;
    } else if (!requireEnabled) {
      if (!bestDisabled || obs.mountIndex > bestDisabled.mountIndex) bestDisabled = obs;
    }
  }
  return best ?? bestDisabled;
}

/** Does this record need a run, per THIS observer's freshness policy?
 *  Called only on real transitions (registration, re-enable, clear());
 *  record reads are untracked, so commits never re-trigger observers. */
function needsRun(rec: QueryRecord, observer: QueryObserver): boolean {
  if (rec.running) return false; // join the in-flight logical request
  if (rec.stale) return true;
  const status = peek(rec.status);
  if (status === 'idle' || status === 'error') return true;
  if (observer.staleTime <= 0) return true;
  return Date.now() - peek(rec.fetchedAt) >= observer.staleTime;
}

/**
 * THE run: one logical request owning the retry loop and the commit.
 * Supersedes (aborts) any in-flight run for the record. Enrolls in the
 * settle() registry on start and terminates it at commit, terminal error,
 * or abort — never at raw promise settlement.
 */
function startRun(
  rec: QueryRecord,
  fetcher: QueryFetcher<unknown>,
  retry: number,
): Promise<void> {
  // Supersede: abort IS the superseded run's termination.
  rec.controller?.abort();
  rec.terminate?.();

  const generation = ++rec.generation;
  const controller = new AbortController();
  const terminate = __enrollPending();
  rec.controller = controller;
  rec.terminate = terminate;
  rec.running = true;
  rec.stale = false;
  rec.status.value = 'loading';
  rec.error.value = null;

  const run = (async () => {
    try {
      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= retry; attempt++) {
        if (generation !== rec.generation) return; // superseded
        try {
          // The microtask hop makes a synchronous fetcher throw a normal
          // rejection — it enters the same retry/terminal path (issue 0008).
          const result = await Promise.resolve().then(() => fetcher(controller.signal));
          if (generation !== rec.generation) return;
          rec.data.value = result;
          rec.error.value = null;
          rec.fetchedAt.value = Date.now();
          rec.status.value = 'success';
          return; // commit
        } catch (cause) {
          lastError = toError(cause);
        }
      }
      if (generation !== rec.generation) return;
      rec.error.value = lastError;
      rec.status.value = 'error'; // terminal error after retries
    } finally {
      if (generation === rec.generation) {
        rec.running = false;
        rec.controller = null;
        rec.runPromise = null;
        rec.terminate = null;
      }
      terminate(); // idempotent — superseded runs already terminated at abort
    }
  })();
  rec.runPromise = run;
  return run;
}

// ── Mixed clients: an eliminated class (formerly N601) ──────────────
// With inject() as the single resolution path, the only way two clients
// could mix was provide(QueryClient, ...) landing after queries already
// bound the auto-created singleton. The injector now throws N501 at that
// exact provide() (DI freeze, ADR 0030.2 T6), so the split-brain state is
// unrepresentable in dev and was always silent in prod — the symptom-side
// warning this block used to hold (N601) died with its cause. Retired
// before release; the code number is not reused.

// ── query() — the thin observer ─────────────────────────────────────

/**
 * Observe the record the reactive key points at.
 *
 * @param keyFn - Returns the flat cache key. Signal reads are tracked; a
 *   key change re-registers the observer on the new record.
 * @param fetcher - Fetches the data; receives the run's AbortSignal.
 * @param options - staleTime / retry / enabled / initialData.
 * @throws N602 synchronously when the initial key violates the contract.
 */
export function query<T>(
  keyFn: () => QueryKey,
  fetcher: QueryFetcher<T>,
  options: QueryOptions<T> = {},
): QueryResult<T> {
  const { staleTime = 0, retry = 0, enabled, initialData } = options;

  const client = inject(QueryClient);

  // Surface key-contract violations at the call site: the observer effect
  // is error-contained (a later reactive key going invalid is logged with
  // the same coded message), so the construction-time key must be checked
  // synchronously. untrack: query() may run under an ambient observer
  // (component setup) and key signals must not widen its dependencies.
  untrack(() => { validateKey(keyFn()); });

  const observer: QueryObserver = {
    mountIndex: nextMountIndex++,
    fetcher: fetcher as QueryFetcher<unknown>,
    staleTime,
    retry,
    enabled: true,
    record: null,
  };
  client._observers++;

  const recSig = signal<QueryRecord | null>(null);
  const enabledSig = signal(true);
  let disposed = false;
  let prevEnabled: boolean | null = null;
  let prevVersion = -1;

  // The registration effect — depends on keyFn signals, enabled() signals,
  // and the client version. NEVER on record state (all record reads are
  // untracked), so commits cannot re-trigger it: run starts happen only on
  // the real transitions listed in needsRun()'s doc.
  const stopEffect = effect(() => {
    if (disposed) return;
    const version = client._version.value;
    const key = keyFn();
    const on = enabled ? !!enabled() : true;
    const rec = resolveRecord(client, key);

    observer.enabled = on;
    enabledSig.value = on;

    const moved = rec !== observer.record;
    if (moved) {
      observer.record?.observers.delete(observer);
      rec.observers.add(observer);
      observer.record = rec;
      if (initialData !== undefined && peek(rec.status) === 'idle'
        && peek(rec.data) === undefined) {
        rec.data.value = initialData; // seed; not a fetch — status stays idle
      }
      recSig.value = rec;
    }

    const reEnabled = prevEnabled === false && on;
    const versionChanged = version !== prevVersion;
    prevEnabled = on;
    prevVersion = version;

    if (on && (moved || reEnabled || versionChanged) && needsRun(rec, observer)) {
      const owner = ownerOf(rec) ?? observer;
      startRun(rec, owner.fetcher, owner.retry);
    }
  });

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer.record?.observers.delete(observer);
    observer.record = null;
    client._observers--;
    stopEffect();
    // NOTE: no abort — a zero-observer in-flight run completes and commits.
  };

  if (hasContext()) {
    getCurrentComponent().addDisposer(dispose);
  }

  const refetch = () => {
    if (disposed) return;
    const rec = observer.record;
    if (!rec || !observer.enabled) return;
    if (rec.running) return; // join the in-flight logical request (dedup)
    const owner = ownerOf(rec) ?? observer;
    startRun(rec, owner.fetcher, owner.retry);
  };

  return {
    data: computed(() => {
      const rec = recSig.value;
      return (rec ? rec.data.value : initialData) as T | undefined;
    }),
    loading: computed(() => enabledSig.value && recSig.value?.status.value === 'loading'),
    error: computed(() => recSig.value?.error.value ?? null),
    status: computed<QueryStatus>(() => recSig.value?.status.value ?? 'idle'),
    refetch,
    dispose,
  };
}
