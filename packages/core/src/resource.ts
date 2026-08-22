/**
 * resource.ts — Local async derivations with reactive source tracking.
 *
 * `resource()` is the async counterpart to a local computed value: source
 * dependencies are tracked synchronously, while the loader runs outside the
 * reactive observer and commits only the newest live generation.
 */

import { getCurrentComponent, hasContext } from './context.js';
import { disposable, type DisposableResource } from './disposable.js';
import { __enrollPending } from './settle.js';
import { effect, signal, type ReadonlySignal } from './signal.js';

export interface ResourceResult<T> extends DisposableResource {
  /** Latest successful value. Retained while a newer load is pending. */
  readonly data: ReadonlySignal<T | undefined>;
  /** True while the current generation is loading. */
  readonly loading: ReadonlySignal<boolean>;
  /** Error from the current generation, or null. */
  readonly error: ReadonlySignal<Error | null>;
  /** Re-run the loader for the current source value. */
  refresh(): void;
  /** Stop source tracking and invalidate/abort outstanding work. */
  dispose(): void;
}

/**
 * Derive local async state from a synchronously tracked source.
 *
 * Only signal reads inside `source` are dependencies. `loader` starts in a
 * microtask, outside the active observer, so signal reads before or after its
 * first await never accidentally widen the source set.
 */
export function resource<S, T>(
  source: () => S | undefined,
  loader: (source: S, signal: AbortSignal) => PromiseLike<T>,
): ResourceResult<T> {
  const data = signal<T | undefined>(undefined);
  const loading = signal(false);
  const error = signal<Error | null>(null);
  const refreshVersion = signal(0);

  let generation = 0;
  let disposed = false;
  let stopEffect: () => void = () => {};

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    generation++;
    stopEffect();
    loading.value = false;
  };

  // Register the full resource disposer before effect() registers its own
  // lower-level disposer, so component teardown first invalidates generations
  // and then performs the idempotent raw effect cleanup.
  if (hasContext()) {
    getCurrentComponent().addDisposer(dispose);
  }

  stopEffect = effect(() => {
    refreshVersion.value;
    const currentGeneration = ++generation;

    let sourceValue: S | undefined;
    try {
      sourceValue = source();
    } catch (cause) {
      loading.value = false;
      error.value = toError(cause);
      return;
    }

    // `undefined` is the single disabled sentinel. It covers the markdown
    // consumer's empty-content branch without growing an options surface.
    if (sourceValue === undefined) {
      data.value = undefined;
      loading.value = false;
      error.value = null;
      return;
    }

    const controller = new AbortController();
    loading.value = true;
    error.value = null;
    const enabledSource = sourceValue as S;
    const isStale = () => (
      disposed
      || controller.signal.aborted
      || currentGeneration !== generation
    );

    // settle() enrollment (ADR 0030.2 T2): this generation is a pending
    // logical request from here until COMMIT (data/error write) or ABORT
    // (the cleanup below) — never raw loader settlement, so an
    // abort-ignoring loader cannot wedge settle(). Idempotent.
    const settled = __enrollPending();

    // The microtask boundary is deliberate: loader signal reads are NOT source
    // dependencies, and synchronous loader throws become normal rejections.
    void Promise.resolve().then(async () => {
      if (isStale()) { settled(); return; }

      try {
        const value = await loader(enabledSource, controller.signal);
        if (isStale()) { settled(); return; }
        data.value = value;
        loading.value = false;
        settled();
      } catch (cause) {
        if (isStale()) { settled(); return; }
        error.value = toError(cause);
        loading.value = false;
        settled();
      }
    });

    return () => {
      if (currentGeneration === generation) generation++;
      controller.abort();
      settled();
    };
  });

  const result = {
    data,
    loading,
    error,
    refresh() {
      if (!disposed) refreshVersion.value++;
    },
    dispose,
  };
  return disposable(result, dispose);
}

function toError(cause: unknown): Error {
  if (cause instanceof Error) return cause;

  try {
    return new Error(String(cause));
  } catch {
    return new Error('Unknown error');
  }
}
