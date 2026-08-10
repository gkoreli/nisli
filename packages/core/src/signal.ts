/**
 * signal.ts — Reactive primitives: signal(), computed(), effect()
 *
 * Push-pull hybrid model:
 * - Writes push dirty flags up the dependency graph in two flavors: a signal
 *   write pushes Dirty (the value definitely changed), a computed propagates
 *   MaybeDirty (recompute to find out). Flags never downgrade.
 * - Reads pull fresh values lazily (computed only recalculates when read)
 * - Multiple synchronous writes coalesce into one microtask flush
 *
 * Scheduler invariants (ADR 0030.2 T5):
 * - An effect re-runs iff a value it read changed. Before a MaybeDirty
 *   effect runs, its computed sources are polled (recomputed via the
 *   node→impl back-pointer); if no source's change-epoch advanced past the
 *   effect's last completed run, the run is skipped. A computed's
 *   change-epoch also bumps on every error-state TRANSITION (enter and
 *   exit), so effects never skip across error entry or equal-value recovery
 *   (issue 0003 containment happens at the effect's own read).
 * - Pending effects flush in creation order (monotonic index), so identical
 *   writes produce identical run order. Documented cost: a later-created
 *   writer effect costs one deterministic extra run vs. topological order.
 * - The loop guard is clock-free: an effect that re-schedules ITSELF on
 *   MAX_EFFECT_RERUNS consecutive runs is diagnosed (N301) and disposed.
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
  /**
   * Read the current value WITHOUT registering a dependency.
   * Equivalent to reading inside `untrack()`. On a computed this still
   * pulls a fresh value (and rethrows a cached error) — it only skips
   * dependency registration.
   */
  peek(): T;
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
 * The effect whose fn frame is currently executing. Unlike activeObserver
 * (which switches to a computed during its recompute, and to null under
 * untrack()), this stays pinned to the running effect — it exists solely to
 * attribute writes to the effect that performed them (N302).
 */
let runningEffect: EffectNode | null = null;

/**
 * Global epoch counter. Incremented on every observable change: a signal
 * write, a computed recomputing to a different value, and a computed's
 * error-state transitions (enter and exit). A node's `lastChanged` epoch is
 * compared against an observer's last-validated/last-run epoch to decide
 * staleness.
 */
let globalEpoch = 0;

/** Monotonic effect creation index — pending effects flush in this order. */
let nextEffectOrder = 0;

// ── Dev diagnostics (minimal local shim) ────────────────────────────
// TODO(diagnostics): replace with core diagnostics leaf (diagnostics.ts —
// ADR 0030.2 §7 places codes + payload builder in a leaf importable by every
// layer; this shim keeps T5's scheduler diagnostics self-contained until it
// lands). Assigned codes: N301 effect loop, N302 write-in-own-effect,
// N303 flush/tick cap, N310 effect(async).

let devMode = true;

/**
 * Enable/disable dev diagnostics (N3xx console output). Guard behavior
 * (loop disposal, rejection containment) is NOT gated — only the reporting.
 * @internal TODO(diagnostics): replace with core diagnostics leaf.
 */
export function __setDevMode(on: boolean): void {
  devMode = on;
}

// TODO(diagnostics): replace with core diagnostics leaf
function diag(code: string, message: string, detail?: object): void {
  if (!devMode) return;
  if (detail !== undefined) {
    console.error(`[nisli:${code}] ${message}`, detail);
  } else {
    console.error(`[nisli:${code}] ${message}`);
  }
}

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
  // Copy to avoid mutation during iteration; sort by creation index so
  // identical writes produce identical run order forever (ADR 0030.2 T5).
  const effects = [...pendingEffects].sort((a, b) => a.order - b.order);
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
  MaybeDirty = 1,  // A computed source may have changed — poll before acting
  Dirty = 2,        // A signal source definitely changed — must recompute/run
}

/** Notification flavor: Dirty from signal writes, MaybeDirty through computeds. */
type DirtyFlavor = NodeState.MaybeDirty | NodeState.Dirty;

const NO_COMPUTED_ERROR = Symbol('no-computed-error');

interface ReactiveNode {
  state: NodeState;
  /** Signals/computeds this node reads from */
  sources: Set<SignalNode<unknown> | ComputedNode<unknown>>;
  /** Called when a source changes. Never downgrades an existing dirtier state. */
  notify(flavor: DirtyFlavor): void;
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
    // N302: write-in-own-sources — the running effect wrote a signal it also
    // reads this run, so this write re-triggers it. Attribution-only (never
    // disposes; the loop guard owns disposal). Placed AFTER the Object.is
    // cutoff so certified converging writers — registry reflect effects,
    // each() item-signal reuse — never warn on equal-value writes.
    if (
      runningEffect !== null &&
      runningEffect.sources.has(this._node as SignalNode<unknown>)
    ) {
      diag(
        'N302',
        'Effect wrote to a signal it also reads — the write re-schedules the ' +
        'effect. If this does not converge to an equal value it is an ' +
        'infinite loop. Derive the value with computed() instead.',
        runningEffect.createdAt ? { effect: runningEffect.createdAt } : undefined,
      );
    }
    this._node.value = newValue;
    this._node.lastChanged = ++globalEpoch;
    notifyObservers(this._node.observers, NodeState.Dirty);
  }

  peek(): T {
    return this._node.value;
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

function notifyObservers(observers: Set<ReactiveNode>, flavor: DirtyFlavor): void {
  for (const observer of observers) {
    observer.notify(flavor);
  }
}

// ── Computed (derived, lazy, cached) ────────────────────────────────

interface ComputedNode<T> {
  value: T;
  lastChanged: number;
  observers: Set<ReactiveNode>;
  /**
   * Back-pointer into the owning ComputedImpl (ADR 0030.2 §8 T5): recompute
   * this computed if stale, WITHOUT dependency tracking. Lets an effect's
   * pre-run poll refresh a computed source's change-epoch. Throws the
   * computed's (possibly cached) error.
   */
  pull(): void;
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
  /**
   * globalEpoch snapshot at the end of the last update()/validation pass.
   * A MaybeDirty computed recomputes only if some source's lastChanged
   * advanced past this — otherwise it revalidates to Clean for free.
   */
  private lastValidated = 0;

  constructor(fn: () => T) {
    this.compute = fn;
    this._node = {
      value: undefined as T,
      lastChanged: 0,
      observers: new Set(),
      pull: () => { this.peek(); },
    };
  }

  get value(): T {
    if (this.computing) {
      throw new Error('Circular dependency detected in computed()');
    }

    // Track dependency if inside a reactive context
    if (activeObserver) {
      activeObserver.sources.add(this._node as ComputedNode<unknown>);
      this._node.observers.add(activeObserver);
    }

    // Pull: recalculate if (maybe) dirty
    if (this.state !== NodeState.Clean) {
      this.update();
    }

    if (this.error !== NO_COMPUTED_ERROR) {
      throw this.error;
    }

    return this._node.value;
  }

  peek(): T {
    if (this.computing) {
      throw new Error('Circular dependency detected in computed()');
    }
    // Same pull as `get value`, minus dependency registration.
    if (this.state !== NodeState.Clean) {
      this.update();
    }
    if (this.error !== NO_COMPUTED_ERROR) {
      throw this.error;
    }
    return this._node.value;
  }

  /**
   * MaybeDirty validation: pull each source (computeds recompute lazily) and
   * report whether any source's change-epoch advanced past our last
   * validation. A pulled source may throw — its error-state transition
   * already bumped its change-epoch, so the epoch comparison decides.
   */
  private sourcesChanged(): boolean {
    for (const source of this.sources) {
      if ('pull' in source) {
        try { source.pull(); } catch (_) { /* transition bumped lastChanged */ }
      }
      if (source.lastChanged > this.lastValidated) return true;
    }
    return false;
  }

  private update(): void {
    // MaybeDirty means "an upstream computed MAY have changed". Validate
    // first: if no polled source advanced, revalidate to Clean without
    // recomputing (the half of push-pull that was previously unimplemented).
    if (this.state === NodeState.MaybeDirty && !this.sourcesChanged()) {
      this.state = NodeState.Clean;
      this.lastValidated = globalEpoch;
      return;
    }

    // Unsubscribe from previous sources (for dynamic dependency tracking)
    for (const source of this.sources) {
      source.observers.delete(this as unknown as ReactiveNode);
    }
    this.sources.clear();

    // Run compute with tracking
    const prevObserver = activeObserver;
    activeObserver = this as unknown as ReactiveNode;
    this.computing = true;
    const wasError = this.error !== NO_COMPUTED_ERROR;
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
      } else if (wasError) {
        // Error-state TRANSITION (exit) recovering to an EQUAL value: the
        // epoch must still advance, or downstream effects would skip the
        // recovery in their pre-run poll (ADR 0030.2 §8 T5 error rule).
        this._node.lastChanged = ++globalEpoch;
      }
    } catch (error) {
      this.error = error;
      if (!wasError) {
        // Error-state TRANSITION (enter) counts as a change: polls must see
        // the epoch advance so the effect re-runs and its own read rethrows
        // into the effect's containment (issue 0003 semantics).
        this._node.lastChanged = ++globalEpoch;
      }
      throw error;
    } finally {
      this.computing = false;
      activeObserver = prevObserver;
      // A failed computed remains in an error state, but it must look clean to
      // notify(): the next dependency write then marks it dirty and propagates
      // to downstream observers so the computation can recover (issue 0003).
      this.state = NodeState.Clean;
      this.lastValidated = globalEpoch;
    }
  }

  /** @internal — called by the ReactiveNode interface when a source changes */
  notify(flavor: DirtyFlavor): void {
    // Never downgrade: a Dirty mark (definite signal change) survives a
    // later MaybeDirty from a parallel computed path.
    if (flavor > this.state) {
      const wasClean = this.state === NodeState.Clean;
      this.state = flavor;
      // Propagate once per dirty episode. Downstream observers always get
      // MaybeDirty — through a computed, "changed" is only knowable after a
      // recompute, which stays lazy (pull-based).
      if (wasClean) {
        notifyObservers(this._node.observers, NodeState.MaybeDirty);
      }
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

// ── Effect (side-effect, auto-tracks, auto-disposes) ────────────────

/**
 * Maximum CONSECUTIVE self-re-schedules before we assume an infinite loop.
 * An effect that writes to a signal it reads re-schedules itself on every
 * run; when that happens MAX_EFFECT_RERUNS times in a row (the counter
 * resets whenever a run does NOT re-schedule the effect), the effect is
 * diagnosed (N301) and disposed. Clock-free — deterministic under CI and
 * fake timers, and convergent clamps pass because their second run writes
 * an equal value (Object.is cutoff → no re-schedule → counter reset).
 * See ADR 0008 Gap 2 / ADR 0009 / ADR 0030.2 T5.
 */
const MAX_EFFECT_RERUNS = 100;

interface EffectNode extends ReactiveNode {
  fn: () => void | (() => void);
  cleanup: (() => void) | null;
  disposed: boolean;
  sources: Set<SignalNode<unknown> | ComputedNode<unknown>>;
  /** List of dispose callbacks registered by the component */
  disposers: (() => void)[];
  /** Monotonic creation index — flush order (deterministic scheduler) */
  order: number;
  /** globalEpoch snapshot at the end of the last completed run */
  lastRunEpoch: number;
  /** Consecutive runs that re-scheduled this effect (clock-free loop guard) */
  selfReschedules: number;
  /** Dev-captured creation-site stack — effect identity for N301/N302 */
  createdAt?: string;
  /** N310 (async effect) already reported for this effect */
  asyncWarned?: boolean;
}

function createEffectNode(fn: () => void | (() => void)): EffectNode {
  return {
    state: NodeState.Dirty,
    fn,
    cleanup: null,
    disposed: false,
    sources: new Set(),
    disposers: [],
    order: nextEffectOrder++,
    lastRunEpoch: 0,
    selfReschedules: 0,
    notify(flavor: DirtyFlavor) {
      if (this.disposed) return;
      // Never downgrade Dirty (definite signal change) to MaybeDirty.
      if (flavor > this.state) this.state = flavor;
      pendingEffects.add(this);
      scheduleFlush();
    },
  };
}

/**
 * Pre-run poll (ADR 0030.2 T5): the effect was notified MaybeDirty, meaning
 * only computed sources MAY have changed. Pull each computed source (via the
 * node back-pointer) so its change-epoch is fresh, then compare every
 * source's epoch against the effect's last completed run. A pull may throw:
 * the computed's error-state transition already bumped its epoch, so the
 * comparison decides — a NEW error re-runs the effect (whose own read
 * rethrows into its containment, issue 0003), while an error the effect
 * already observed does not.
 */
function effectSourcesChanged(node: EffectNode): boolean {
  for (const source of node.sources) {
    if ('pull' in source) {
      try { source.pull(); } catch (_) { /* transition bumped lastChanged */ }
    }
    if (source.lastChanged > node.lastRunEpoch) return true;
  }
  return false;
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

function runEffect(node: EffectNode): void {
  if (node.disposed) return;

  // MaybeDirty: poll sources — skip the run when no value the effect read
  // actually changed (equal recomputes through a computed chain stop here).
  if (node.state === NodeState.MaybeDirty && !effectSourcesChanged(node)) {
    node.state = NodeState.Clean;
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

  // Reset state BEFORE running: a notify fired by the effect's own writes
  // must survive into the next flush pass, not be clobbered afterwards.
  node.state = NodeState.Clean;

  // Run effect with tracking
  const prevObserver = activeObserver;
  const prevRunning = runningEffect;
  activeObserver = node;
  runningEffect = node;
  try {
    const result: unknown = node.fn();
    if (typeof result === 'function') {
      node.cleanup = result as () => void;
    } else if (isThenable(result)) {
      // effect(async …) — rejected at the type level, guarded at runtime for
      // JS callers (ADR 0030.2 §3). The Promise is NOT a cleanup; route its
      // rejection into the effect error path so nothing goes unhandled.
      if (!node.asyncWarned) {
        node.asyncWarned = true;
        diag(
          'N310',
          'effect() callback returned a Promise — effects must be synchronous. ' +
          'Async state belongs in resource(). The returned Promise is not a ' +
          'cleanup function; its rejection is contained by the effect error path.',
          node.createdAt ? { effect: node.createdAt } : undefined,
        );
      }
      result.then(undefined, (err: unknown) => {
        console.error('Effect error:', err);
      });
    }
  } catch (err) {
    // Effect errors: log but don't crash the system.
    // The effect is NOT disposed — it may succeed on next signal change.
    console.error('Effect error:', err);
  } finally {
    activeObserver = prevObserver;
    runningEffect = prevRunning;
    // Everything observable up to now — including epochs bumped by this
    // run's own lazy computed pulls — counts as SEEN by this run.
    node.lastRunEpoch = globalEpoch;
  }

  // Clock-free loop guard: this run re-scheduled the effect iff the effect
  // is back in the pending set (only its own writes can do that mid-run).
  if (pendingEffects.has(node)) {
    if (++node.selfReschedules > MAX_EFFECT_RERUNS) {
      diag(
        'N301',
        `Effect exceeded maximum re-run limit (${MAX_EFFECT_RERUNS}). ` +
        `This usually means the effect writes to a signal it reads. ` +
        `The effect has been disposed to prevent a UI freeze.`,
        node.createdAt ? { effect: node.createdAt } : undefined,
      );
      // Dispose as today: unsubscribe everywhere and drop from the queue.
      node.disposed = true;
      for (const source of node.sources) {
        source.observers.delete(node);
      }
      node.sources.clear();
      pendingEffects.delete(node);
    }
  } else {
    node.selfReschedules = 0;
  }
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Create a writable reactive signal.
 *
 * ```ts
 * const count = signal(0);
 * count.value;     // read (auto-tracks in reactive contexts)
 * count.value = 5; // write (notifies dependents)
 * count.peek();    // read WITHOUT tracking
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
 * Type-level rejection of async callbacks: a Promise-returning fn makes the
 * call require an impossible second argument, so `effect(async () => {})`
 * fails to compile. Async work belongs in resource() (ADR 0030.2 §3; N310).
 */
type SyncEffectGuard<R> = [R] extends [Promise<unknown>]
  ? [error: 'effect() callbacks must be synchronous — async work belongs in resource() (nisli N310)']
  : [];

/**
 * Create a side-effect that re-runs when its dependencies change.
 * Returns a dispose function to stop the effect.
 *
 * The effect function may return a cleanup callback that runs
 * before each re-execution and on disposal. It must be SYNCHRONOUS —
 * async functions are rejected at the type level and diagnosed at
 * runtime (N310); async state belongs in resource().
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
export function effect<R>(fn: () => R, ..._rejectAsync: SyncEffectGuard<R>): () => void {
  const node = createEffectNode(fn as unknown as () => void | (() => void));
  if (devMode) {
    // Dev-captured effect identity: N301/N302 diagnostics name this site.
    node.createdAt = new Error('effect() created here').stack;
  }
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
 * signal reads inside `fn` from being tracked by an outer effect,
 * and return the function's result.
 *
 * Used by component.ts to isolate connectedCallback: child component
 * setup signal reads must not leak into a parent effect's dependency
 * set. See ADR 0008 Gap 1.
 */
export function untrack<T>(fn: () => T): T {
  const prev = activeObserver;
  activeObserver = null;
  try {
    return fn();
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
    if (++guard > 100000) {
      diag(
        'N303',
        'flush() cascade cap reached (100000 passes) — effects keep ' +
        'scheduling more effects (a cross-effect write cycle?). Breaking out ' +
        'to avoid a freeze; pending work remains unflushed.',
      );
      break;
    }
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
 * iteration cap (loudly — N303).
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
  diag(
    'N303',
    'tick() iteration cap (50) reached with effects still pending — ' +
    'something keeps scheduling reactive work every task (a ' +
    'self-perpetuating scheduler?). Returning with work still queued.',
  );
}
