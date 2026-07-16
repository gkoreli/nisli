/**
 * signal.ts — Reactive primitives: signal(), computed(), effect()
 *
 * Push-pull hybrid model:
 * - Writes push "dirty" flags up the dependency graph
 * - Reads pull fresh values lazily (computed only recalculates when read)
 * - Multiple synchronous writes coalesce into one microtask flush
 *
 * Dependency tracking is automatic: reading a signal inside a computed
 * or effect registers it as a dependency. Dependencies are re-tracked
 * on every execution (dynamic/conditional tracking).
 */

// ── Late-bound context hook for auto-disposal ──────────────────────
// Avoids circular dependency: context.ts imports nothing from signal.ts,
// but signal.ts needs to check for component context to auto-dispose effects.
// component.ts wires this up at import time via `setContextHook()`.

let contextHook: (() => ((fn: () => void) => void) | null) | null = null;

/**
 * Register the context hook. Called by component.ts at module init.
 * The hook returns an `addDisposer` function if inside setup context, null otherwise.
 */
export function setContextHook(hook: () => ((fn: () => void) => void) | null): void {
  contextHook = hook;
}

// ── Brand symbol for signal detection in templates ──────────────────

export const SIGNAL_BRAND = Symbol.for('backlog.signal');

// ── Types ───────────────────────────────────────────────────────────

/** Readable reactive container. */
export interface ReadonlySignal<T> {
  readonly [SIGNAL_BRAND]: true;
  readonly value: T;
  /** Subscribe to value changes. Returns unsubscribe function. */
  subscribe(fn: (value: T) => void): () => void;
}

/** Read-write reactive container. */
export interface Signal<T> extends ReadonlySignal<T> {
  value: T;
}

// ── Internal tracking state ─────────────────────────────────────────

/**
 * The currently executing reactive context (computed or effect).
 * When non-null, any signal read during execution is recorded as a dependency.
 */
let activeObserver: ReactiveNode | null = null;

/**
 * Global epoch counter. Incremented on every signal write.
 * Used to determine if a computed needs recalculation: if a dependency's
 * lastChanged > this computed's lastChecked, the computed is stale.
 */
let globalEpoch = 0;

// ── Effect scheduling ────────────────────────────────────────────────

const pendingEffects = new Set<EffectNode>();
let flushScheduled = false;

function scheduleFlush(): void {
  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(flushPendingEffects);
  }
}

function flushPendingEffects(): void {
  flushScheduled = false;
  // Copy to avoid mutation during iteration
  const effects = [...pendingEffects];
  pendingEffects.clear();
  for (const effect of effects) {
    if (!effect.disposed) {
      runEffect(effect);
    }
  }
}

// ── Dependency graph node types ─────────────────────────────────────

const enum NodeState {
  Clean = 0,
  MaybeDirty = 1,  // A dependency changed, but we haven't checked yet
  Dirty = 2,        // Definitely needs recalculation
}

const NO_COMPUTED_ERROR = Symbol('no-computed-error');

interface ReactiveNode {
  state: NodeState;
  /** Signals/computeds this node reads from */
  sources: Set<SignalNode<unknown> | ComputedNode<unknown>>;
  /** Called when a source changes */
  notify(): void;
}

// ── Signal (writable) ───────────────────────────────────────────────

interface SignalNode<T> {
  value: T;
  lastChanged: number;
  observers: Set<ReactiveNode>;
}

class SignalImpl<T> implements Signal<T> {
  readonly [SIGNAL_BRAND] = true as const;
  /** @internal */
  _node: SignalNode<T>;

  constructor(initialValue: T) {
    this._node = {
      value: initialValue,
      lastChanged: globalEpoch,
      observers: new Set(),
    };
  }

  get value(): T {
    // Track dependency if inside a reactive context
    if (activeObserver) {
      activeObserver.sources.add(this._node);
      this._node.observers.add(activeObserver);
    }
    return this._node.value;
  }

  set value(newValue: T) {
    if (Object.is(this._node.value, newValue)) return;
    this._node.value = newValue;
    this._node.lastChanged = ++globalEpoch;
    notifyObservers(this._node.observers);
  }

  subscribe(fn: (value: T) => void): () => void {
    return effect(() => {
      const value = this.value;
      // A subscription depends on THIS signal only. Reads performed by the
      // consumer callback are observational work, not reactive dependencies
      // of the subscription itself (issue 0004).
      untrack(() => fn(value));
    });
  }
}

function notifyObservers(observers: Set<ReactiveNode>): void {
  for (const observer of observers) {
    observer.notify();
  }
}

// ── Computed (derived, lazy, cached) ────────────────────────────────

interface ComputedNode<T> {
  value: T;
  lastChanged: number;
  observers: Set<ReactiveNode>;
}

class ComputedImpl<T> implements ReadonlySignal<T> {
  readonly [SIGNAL_BRAND] = true as const;
  /** @internal */
  _node: ComputedNode<T>;

  private compute: () => T;
  private state: NodeState = NodeState.Dirty; // Start dirty so first read computes
  private sources = new Set<SignalNode<unknown> | ComputedNode<unknown>>();
  private computing = false;
  private error: unknown = NO_COMPUTED_ERROR;

  constructor(fn: () => T) {
    this.compute = fn;
    this._node = {
      value: undefined as T,
      lastChanged: 0,
      observers: new Set(),
    };
  }

  get value(): T {
    if (this.computing) {
      throw new Error('Circular dependency detected in computed()');
    }

    // Track dependency if inside a reactive context
    if (activeObserver) {
      activeObserver.sources.add(this._node);
      this._node.observers.add(activeObserver);
    }

    // Pull: recalculate if dirty
    if (this.state !== NodeState.Clean) {
      this.update();
    }

    if (this.error !== NO_COMPUTED_ERROR) {
      throw this.error;
    }

    return this._node.value;
  }

  private update(): void {
    // Unsubscribe from previous sources (for dynamic dependency tracking)
    for (const source of this.sources) {
      source.observers.delete(this as unknown as ReactiveNode);
    }
    this.sources.clear();

    // Run compute with tracking
    const prevObserver = activeObserver;
    activeObserver = this as unknown as ReactiveNode;
    this.computing = true;
    try {
      const newValue = this.compute();
      this.error = NO_COMPUTED_ERROR;
      if (!Object.is(this._node.value, newValue)) {
        this._node.value = newValue;
        this._node.lastChanged = ++globalEpoch;
        // NOTE: no notifyObservers() here. This update() is a *lazy* recompute
        // triggered by a read; every downstream observer was already marked
        // dirty / scheduled eagerly when the source signal changed (notify()
        // propagates through the computed chain). Re-notifying here would
        // re-schedule the very effect performing this read — a spurious
        // double-run that only surfaced once flush() began draining cascades.
      }
    } catch (error) {
      this.error = error;
      throw error;
    } finally {
      this.computing = false;
      activeObserver = prevObserver;
      // A failed computed remains in an error state, but it must look clean to
      // notify(): the next dependency write then marks it dirty and propagates
      // to downstream observers so the computation can recover (issue 0003).
      this.state = NodeState.Clean;
    }
  }

  /** @internal — called by the ReactiveNode interface when a source changes */
  notify(): void {
    if (this.state === NodeState.Clean) {
      this.state = NodeState.Dirty;
      // Propagate dirty flags to downstream observers
      // (they need to re-check if this computed's value actually changed)
      notifyObservers(this._node.observers);
    }
  }

  subscribe(fn: (value: T) => void): () => void {
    return effect(() => {
      const value = this.value;
      untrack(() => fn(value));
    });
  }

  // ReactiveNode interface — used by dependency tracking
  get sources_(): Set<SignalNode<unknown> | ComputedNode<unknown>> {
    return this.sources;
  }
}

// Make ComputedImpl satisfy ReactiveNode for the dependency tracker
Object.defineProperty(ComputedImpl.prototype, 'sources', {
  enumerable: false,
});

// Bridge ComputedImpl to ReactiveNode — the observer interface.
// We cast in notify() above; here we make the computed usable as a ReactiveNode
// by defining the properties the tracker expects.
const computedAsReactiveNode = (c: ComputedImpl<unknown>): ReactiveNode => ({
  get state() { return c['state']; },
  set state(v) { c['state'] = v; },
  get sources() { return c['sources']; },
  notify: () => c.notify(),
});

// ── Effect (side-effect, auto-tracks, auto-disposes) ────────────────

/**
 * Maximum consecutive re-runs within a time window before we assume an infinite loop.
 * An effect that writes to a signal it reads will re-trigger itself
 * on every flush. This guard prevents silent UI freezes.
 * See ADR 0008 Gap 2 / ADR 0009.
 */
const MAX_EFFECT_RERUNS = 100;

/**
 * Time window (ms) for counting consecutive re-runs.
 * If an effect runs MAX_EFFECT_RERUNS times within this window, it's a loop.
 * Resets when the effect hasn't been re-triggered for longer than this window.
 */
const LOOP_WINDOW_MS = 2000;

interface EffectNode extends ReactiveNode {
  fn: () => void | (() => void);
  cleanup: (() => void) | null;
  disposed: boolean;
  sources: Set<SignalNode<unknown> | ComputedNode<unknown>>;
  /** List of dispose callbacks registered by the component */
  disposers: (() => void)[];
  /** Consecutive re-run counter for loop detection */
  runCount: number;
  /** Timestamp of first run in current counting window */
  windowStart: number;
}

function createEffectNode(fn: () => void | (() => void)): EffectNode {
  return {
    state: NodeState.Dirty,
    fn,
    cleanup: null,
    disposed: false,
    sources: new Set(),
    disposers: [],
    runCount: 0,
    windowStart: 0,
    notify() {
      if (this.disposed) return;
      this.state = NodeState.Dirty;
      pendingEffects.add(this);
      scheduleFlush();
    },
  };
}

function runEffect(node: EffectNode): void {
  if (node.disposed) return;

  // Loop detection: count consecutive re-runs within a time window.
  // If the effect runs MAX_EFFECT_RERUNS times within LOOP_WINDOW_MS,
  // it's almost certainly a write-to-own-dependency loop. Dispose it.
  const now = Date.now();
  if (now - node.windowStart > LOOP_WINDOW_MS) {
    // New window — reset counter
    node.runCount = 0;
    node.windowStart = now;
  }
  node.runCount++;
  if (node.runCount > MAX_EFFECT_RERUNS) {
    console.error(
      `Effect exceeded maximum re-run limit (${MAX_EFFECT_RERUNS}). ` +
      `This usually means the effect writes to a signal it reads. ` +
      `The effect has been disposed to prevent a UI freeze.`
    );
    node.disposed = true;
    // Unsubscribe from all sources to stop further notifications
    for (const source of node.sources) {
      source.observers.delete(node);
    }
    node.sources.clear();
    pendingEffects.delete(node);
    return;
  }

  // Run cleanup from previous execution
  if (node.cleanup) {
    try { node.cleanup(); } catch (_) { /* cleanup errors are swallowed */ }
    node.cleanup = null;
  }

  // Unsubscribe from previous sources
  for (const source of node.sources) {
    source.observers.delete(node);
  }
  node.sources.clear();

  // Run effect with tracking
  const prevObserver = activeObserver;
  activeObserver = node;
  try {
    const result = node.fn();
    if (typeof result === 'function') {
      node.cleanup = result;
    }
  } catch (err) {
    // Effect errors: log but don't crash the system.
    // The effect is NOT disposed — it may succeed on next signal change.
    console.error('Effect error:', err);
  } finally {
    activeObserver = prevObserver;
  }
  node.state = NodeState.Clean;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Create a writable reactive signal.
 *
 * ```ts
 * const count = signal(0);
 * count.value;     // read (auto-tracks in reactive contexts)
 * count.value = 5; // write (notifies dependents)
 * ```
 */
export function signal<T>(initialValue: T): Signal<T> {
  return new SignalImpl(initialValue);
}

/**
 * Create a derived, lazy, cached computed signal.
 * Re-evaluates only when dependencies change AND the value is read.
 *
 * ```ts
 * const doubled = computed(() => count.value * 2);
 * doubled.value; // lazy evaluation
 * ```
 */
export function computed<T>(fn: () => T): ReadonlySignal<T> {
  return new ComputedImpl(fn);
}

/**
 * Create a side-effect that re-runs when its dependencies change.
 * Returns a dispose function to stop the effect.
 *
 * The effect function may return a cleanup callback that runs
 * before each re-execution and on disposal.
 *
 * ```ts
 * const dispose = effect(() => {
 *   console.log('count is', count.value);
 *   return () => { // cleanup
 *     console.log('cleaning up');
 *   };
 * });
 * dispose(); // stop the effect
 * ```
 */
export function effect(fn: () => void | (() => void)): () => void {
  const node = createEffectNode(fn);
  // Run immediately to establish initial dependencies
  runEffect(node);

  const dispose = () => {
    node.disposed = true;
    // Run final cleanup
    if (node.cleanup) {
      try { node.cleanup(); } catch (_) { /* swallow */ }
      node.cleanup = null;
    }
    // Unsubscribe from all sources
    for (const source of node.sources) {
      source.observers.delete(node);
    }
    node.sources.clear();
    pendingEffects.delete(node);
  };

  // Auto-dispose when inside component setup context
  if (contextHook) {
    const addDisposer = contextHook();
    if (addDisposer) {
      addDisposer(dispose);
    }
  }

  return dispose;
}

/**
 * Check if a value is a signal (writable or computed).
 * Used by the template engine to detect signals in expression slots.
 */
export function isSignal(value: unknown): value is ReadonlySignal<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    SIGNAL_BRAND in (value as Record<symbol, unknown>)
  );
}

// ── Observer isolation ───────────────────────────────────────────────

/**
 * Run a function with activeObserver set to null, preventing any
 * signal reads inside `fn` from being tracked by an outer effect.
 *
 * Used by component.ts to isolate connectedCallback: child component
 * setup signal reads must not leak into a parent effect's dependency
 * set. See ADR 0008 Gap 1.
 */
export function untrack(fn: () => void): void {
  const prev = activeObserver;
  activeObserver = null;
  try {
    fn();
  } finally {
    activeObserver = prev;
  }
}

// ── Synchronous flush ───────────────────────────────────────────────

/**
 * Synchronously execute all pending effects.
 *
 * In normal usage, effects run automatically on the next microtask.
 * Use flush() only when you need effects to have executed before
 * the next line — e.g., imperative DOM measurement after state change.
 *
 * flush() is idempotent: calling it with no pending effects is a no-op.
 */
export function flush(): void {
  // Drain cascades: an effect may write a signal that schedules more effects
  // (e.g. A computes → B renders). Loop until the queue is empty so a single
  // flush() settles the whole synchronous cascade — no double-flush idiom.
  // Bounded to mirror the effect-loop guard; a runaway is a bug, not silence.
  let guard = 0;
  while (pendingEffects.size > 0) {
    flushPendingEffects();
    if (++guard > 100000) break;
  }
}

/** Backward compat alias for tests. */
export { flush as flushEffects };

/**
 * Settle the synchronous effect cascade AND all MICROTASK-scheduled work
 * pending at await time (content-projection sweeps, query/command initial
 * passes — at any queueMicrotask depth), plus the effects that work
 * schedules. Replaces the hand-rolled `flush(); await Promise.resolve();
 * flush()` and double-`flushEffects()` idioms.
 *
 * Bounded contract — deliberately NOT awaited: timers and other future
 * TASKS scheduled by that microtask work (e.g. a microtask calling
 * setTimeout) may fire after tick() resolves; awaiting arbitrary future
 * tasks is unbounded. Self-perpetuating schedulers are cut off at the
 * iteration cap.
 *
 * ```ts
 * host.setProp('x', 1);
 * await tick();
 * expect(el.textContent).toBe('1');
 * ```
 */
export async function tick(): Promise<void> {
  flush(); // drain the synchronous effect cascade first
  // Each iteration crosses a MACROTASK boundary (setTimeout 0). Doing so runs
  // the ENTIRE microtask queue to completion first — including microtasks a
  // microtask schedules, at any depth — so a 3-deep `queueMicrotask` chain is
  // fully drained before the timer fires. After the drain we flush the effects
  // that work scheduled. When a full iteration schedules no effects, the queue
  // is quiescent and we return. Contract: microtask-scheduled work + effect
  // cascades pending at await time settle; TIMER-scheduled work does not
  // (see the doc above — bounded by design). The iteration cap is a
  // documented backstop for self-perpetuating schedulers, not a silent hang.
  for (let i = 0; i < 50; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (pendingEffects.size === 0) return; // the microtask drain scheduled nothing
    flush();
  }
}
