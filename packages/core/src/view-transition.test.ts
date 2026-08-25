/**
 * view-transition.test.ts — opt-in View Transitions over the synchronous flush.
 *
 * happy-dom implements neither `document.startViewTransition` nor the
 * `ViewTransition` interface, so the no-support path is exercised natively and
 * the supported path is exercised against a stub. The stub proves ORDERING
 * (that the DOM mutation lands inside the update callback) — it cannot prove
 * anything about real capture, animation, or engine behaviour.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { signal, effect, flush, tick } from './signal.js';
import { viewTransition } from './view-transition.js';

// ── Stub harness ────────────────────────────────────────────────────

/** A `ViewTransition`-shaped handle; only identity and shape are used here. */
function fakeHandle(): ViewTransition {
  return {
    ready: Promise.resolve(),
    finished: Promise.resolve(),
    updateCallbackDone: Promise.resolve(),
    types: new Set<string>() as unknown as ViewTransitionTypeSet,
    skipTransition: () => {},
  };
}

type StartArg = ViewTransitionUpdateCallback | StartViewTransitionOptions;

/**
 * Install a `document.startViewTransition` stub. Returns the recorded
 * arguments; `run` decides how/when the update callback is invoked.
 */
function stubStartViewTransition(
  run: (update: () => void) => void = (update) => update(),
): { calls: StartArg[]; handle: ViewTransition } {
  const calls: StartArg[] = [];
  const handle = fakeHandle();
  (document as Document).startViewTransition = (arg?: StartArg): ViewTransition => {
    calls.push(arg as StartArg);
    const update = typeof arg === 'function' ? arg : arg?.update;
    run(() => { update?.(); });
    return handle;
  };
  return { calls, handle };
}

/** Stub the `ViewTransition` global so the object/`types` form is detected. */
function stubTypesSupport(present: boolean): void {
  vi.stubGlobal(
    'ViewTransition',
    present ? { prototype: { types: undefined } } : undefined,
  );
}

/** A DOM node driven by an effect — the thing a transition would snapshot. */
function boundNode(): { node: HTMLElement; text: ReturnType<typeof signal<string>>; stop: () => void } {
  const node = document.createElement('div');
  const text = signal('old');
  const stop = effect(() => { node.textContent = text.value; });
  return { node, text, stop };
}

const cleanup: (() => void)[] = [];

afterEach(() => {
  for (const c of cleanup) c();
  cleanup.length = 0;
  vi.unstubAllGlobals(); // must precede the delete: one test stubs `document`
  delete (document as Partial<Document>).startViewTransition;
});

// ── No support: the progressive-enhancement path ────────────────────

describe('viewTransition() without platform support', () => {
  it('happy-dom really has no startViewTransition (the PE path is native here)', () => {
    expect((document as Partial<Document>).startViewTransition).toBeUndefined();
    expect(typeof ViewTransition).toBe('undefined');
  });

  it('applies the update and flushes it to the DOM synchronously, returning null', () => {
    const { node, text, stop } = boundNode();
    cleanup.push(stop);

    const handle = viewTransition(() => { text.value = 'new'; });

    // Same line, no await, no tick: the DOM is already current.
    expect(node.textContent).toBe('new');
    expect(handle).toBeNull();
  });

  it('control: the same bare write does NOT reach the DOM until the microtask', async () => {
    const { node, text, stop } = boundNode();
    cleanup.push(stop);

    text.value = 'new';
    expect(node.textContent).toBe('old'); // coalesced (ADR 0015)

    await tick();
    expect(node.textContent).toBe('new');
  });

  it('settles a multi-level cascade, not just the first effect', () => {
    const a = signal(1);
    const b = signal(0);
    const node = document.createElement('div');
    cleanup.push(effect(() => { b.value = a.value * 10; }));
    cleanup.push(effect(() => { node.textContent = String(b.value); }));

    viewTransition(() => { a.value = 5; });

    expect(node.textContent).toBe('50');
  });

  it('has no DOM at all: still applies the update', () => {
    vi.stubGlobal('document', undefined);
    let ran = false;

    const handle = viewTransition(() => { ran = true; });

    expect(ran).toBe(true);
    expect(handle).toBeNull();
  });

  it('lets a throwing update propagate synchronously', () => {
    expect(() => viewTransition(() => { throw new Error('boom'); }))
      .toThrow('boom');
  });
});

// ── Supported path (stubbed) ────────────────────────────────────────

describe('viewTransition() with startViewTransition (stubbed)', () => {
  it('mutates the DOM INSIDE the update callback, not after it', () => {
    const { node, text, stop } = boundNode();
    cleanup.push(stop);

    const observed: string[] = [];
    stubStartViewTransition((update) => {
      observed.push(`before:${node.textContent}`);
      update();
      observed.push(`after:${node.textContent}`);
    });

    viewTransition(() => { text.value = 'new'; });

    // The whole point: the commit the browser would snapshot happened
    // strictly between callback entry and callback exit.
    expect(observed).toEqual(['before:old', 'after:new']);
  });

  it('runs the update exactly once and returns the platform handle', () => {
    const update = vi.fn();
    const { handle } = stubStartViewTransition();

    expect(viewTransition(update)).toBe(handle);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('does not defer: nothing runs after the call returns', () => {
    const { node, text, stop } = boundNode();
    cleanup.push(stop);
    // The stub never invokes the callback — a deferred design would leave the
    // update pending; ours hands the whole commit to the platform.
    stubStartViewTransition(() => {});

    const handle = viewTransition(() => { text.value = 'new'; });

    expect(node.textContent).toBe('old');
    expect(handle).not.toBeNull();
    expect((handle as unknown as { then?: unknown }).then).toBeUndefined();
  });

  it('passes types through as the object form when the engine supports it', () => {
    stubTypesSupport(true);
    const { calls } = stubStartViewTransition();

    viewTransition(() => {}, { types: ['reorder', 'back'] });

    expect(calls[0]).toEqual({ update: expect.any(Function), types: ['reorder', 'back'] });
  });

  it('falls back to the plain callback form when types are unsupported', () => {
    stubTypesSupport(false);
    const { calls } = stubStartViewTransition();
    const { node, text, stop } = boundNode();
    cleanup.push(stop);

    viewTransition(() => { text.value = 'new'; }, { types: ['reorder'] });

    // Transition still runs and still commits; only type-scoped CSS is lost.
    expect(typeof calls[0]).toBe('function');
    expect(node.textContent).toBe('new');
  });

  it('uses the callback form when no types are requested', () => {
    stubTypesSupport(true);
    const { calls } = stubStartViewTransition();

    viewTransition(() => {});
    viewTransition(() => {}, {});
    viewTransition(() => {}, { types: [] });

    expect(calls.map((c) => typeof c)).toEqual(['function', 'function', 'function']);
  });
});

// ── ADR 0015: flush() stays synchronous ─────────────────────────────

describe('flush() contract', () => {
  it('is still synchronous and still returns undefined', () => {
    const a = signal(0);
    const node = document.createElement('div');
    cleanup.push(effect(() => { node.textContent = String(a.value); }));

    a.value = 7;
    const result: void = flush();

    expect(result).toBeUndefined();
    expect(node.textContent).toBe('7');
  });
});
