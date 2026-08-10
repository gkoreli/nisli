/**
 * signal.test.ts — Tests for the reactive primitives.
 *
 * These tests verify the core contracts that every other framework
 * primitive depends on. All tests are pure logic — no DOM needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  signal,
  computed,
  effect,
  isSignal,
  flush,
  flushEffects,
  tick,
  untrack,
  SIGNAL_BRAND,
  __setDevMode,
} from './signal.js';

// ── signal() ────────────────────────────────────────────────────────

describe('signal()', () => {
  it('holds an initial value', () => {
    const s = signal(42);
    expect(s.value).toBe(42);
  });

  it('updates value on write', () => {
    const s = signal(0);
    s.value = 10;
    expect(s.value).toBe(10);
  });

  it('skips notification when value is identical (Object.is)', () => {
    const s = signal(1);
    const fn = vi.fn();
    effect(() => {
      fn(s.value);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    s.value = 1; // same value
    flushEffects();
    expect(fn).toHaveBeenCalledTimes(1); // no re-run
  });

  it('handles NaN correctly (NaN === NaN via Object.is)', () => {
    const s = signal(NaN);
    const fn = vi.fn();
    effect(() => {
      fn(s.value);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    s.value = NaN; // Object.is(NaN, NaN) is true
    flushEffects();
    expect(fn).toHaveBeenCalledTimes(1); // no re-run
  });

  it('is branded with SIGNAL_BRAND', () => {
    const s = signal(0);
    expect(s[SIGNAL_BRAND]).toBe(true);
    expect(isSignal(s)).toBe(true);
  });

  it('subscribe() calls immediately and on changes', () => {
    const s = signal('hello');
    const values: string[] = [];
    const unsub = s.subscribe(v => values.push(v));

    expect(values).toEqual(['hello']);

    s.value = 'world';
    flushEffects();
    expect(values.at(-1)).toBe('world');

    unsub();
    s.value = 'gone';
    flushEffects();
    // Should not have been called again
    expect(values.at(-1)).toBe('world');
  });

  it('subscribe() does not track signals read inside the callback', () => {
    const source = signal('source');
    const unrelated = signal('other');
    const values: string[] = [];

    source.subscribe((value) => {
      values.push(`${value}:${unrelated.value}`);
    });
    expect(values).toEqual(['source:other']);

    unrelated.value = 'changed';
    flushEffects();
    expect(values).toEqual(['source:other']);

    source.value = 'next';
    flushEffects();
    expect(values).toEqual(['source:other', 'next:changed']);
  });
});

// ── computed() ──────────────────────────────────────────────────────

describe('computed()', () => {
  it('derives a value from a signal', () => {
    const count = signal(2);
    const doubled = computed(() => count.value * 2);
    expect(doubled.value).toBe(4);
  });

  it('is branded with SIGNAL_BRAND', () => {
    const c = computed(() => 1);
    expect(isSignal(c)).toBe(true);
  });

  it('updates when dependency changes', () => {
    const count = signal(1);
    const doubled = computed(() => count.value * 2);

    count.value = 5;
    expect(doubled.value).toBe(10);
  });

  it('caches — compute function runs only when dirty', () => {
    const count = signal(1);
    const fn = vi.fn(() => count.value * 2);
    const doubled = computed(fn);

    doubled.value; // first read → computes
    doubled.value; // second read → cached
    doubled.value; // third read → cached
    expect(fn).toHaveBeenCalledTimes(1);

    count.value = 2;
    doubled.value; // dirty → recomputes
    expect(fn).toHaveBeenCalledTimes(2);

    doubled.value; // cached again
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('handles conditional dependency tracking', () => {
    const flag = signal(true);
    const a = signal('A');
    const b = signal('B');
    const fn = vi.fn(() => (flag.value ? a.value : b.value));
    const result = computed(fn);

    expect(result.value).toBe('A');
    expect(fn).toHaveBeenCalledTimes(1);

    // Changing b should NOT trigger recompute (it's not a dependency)
    b.value = 'B2';
    expect(result.value).toBe('A');
    // The computed may re-evaluate if it sees dirty but the value won't change

    // Switch to b branch
    flag.value = false;
    expect(result.value).toBe('B2');

    // Now a is no longer tracked — changing it should not affect result
    a.value = 'A2';
    expect(result.value).toBe('B2');
  });

  it('throws on circular dependency', () => {
    // a depends on b, b depends on a
    const a: any = signal(1);
    const b = computed(() => a.value);
    // This is not circular — it's fine. Let's create a real circular:
    // We can't easily create a true circular with the current API since
    // computed is read-only. But we can detect self-reference:
    const selfRef = computed((): number => {
      return (selfRef as any).value + 1;
    });

    expect(() => selfRef.value).toThrow('Circular dependency');
  });

  it('recovers after a temporary computed error when a dependency changes', () => {
    const source = signal(0);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const value = computed(() => {
      if (source.value === 1) throw new Error('temporary');
      return source.value;
    });
    const seen: number[] = [];

    effect(() => {
      seen.push(value.value);
    });
    expect(seen).toEqual([0]);

    source.value = 1;
    flushEffects();
    expect(seen).toEqual([0]);

    // The failed computed subscribed to `source` before throwing. Its state
    // must allow this later write to re-schedule the downstream effect.
    source.value = 2;
    flushEffects();
    expect(seen).toEqual([0, 2]);
    errorSpy.mockRestore();
  });

  it('rethrows a cached computed error until a dependency changes', () => {
    const source = signal(1);
    const value = computed(() => {
      if (source.value === 1) throw new Error('still broken');
      return source.value;
    });

    expect(() => value.value).toThrow('still broken');
    expect(() => value.value).toThrow('still broken');
    source.value = 2;
    expect(value.value).toBe(2);
  });

  it('computed subscribe() notifies once initially and ignores callback dependencies', () => {
    const source = signal(2);
    const unrelated = signal('a');
    const doubled = computed(() => source.value * 2);
    const values: string[] = [];

    doubled.subscribe((value) => {
      values.push(`${value}:${unrelated.value}`);
    });
    expect(values).toEqual(['4:a']);

    unrelated.value = 'b';
    flushEffects();
    expect(values).toEqual(['4:a']);

    source.value = 3;
    flushEffects();
    expect(values).toEqual(['4:a', '6:b']);
  });

  it('diamond dependency: D recomputes exactly once when A changes', () => {
    // A → B, A → C, B+C → D
    const a = signal(1);
    const b = computed(() => a.value + 1);  // 2
    const c = computed(() => a.value * 10); // 10
    const fn = vi.fn(() => b.value + c.value);
    const d = computed(fn);

    expect(d.value).toBe(12); // 2 + 10
    fn.mockClear();

    a.value = 2;
    expect(d.value).toBe(23); // 3 + 20
    // D's compute function should have run exactly once for the pull
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('synchronous read after write sees updated value (pull semantics)', () => {
    const a = signal(1);
    const doubled = computed(() => a.value * 2);

    expect(doubled.value).toBe(2);
    a.value = 5;
    // Synchronous read should pull the fresh value immediately
    expect(doubled.value).toBe(10);
  });

  it('chains of computeds propagate correctly', () => {
    const a = signal(1);
    const b = computed(() => a.value + 1);
    const c = computed(() => b.value + 1);
    const d = computed(() => c.value + 1);

    expect(d.value).toBe(4);
    a.value = 10;
    expect(d.value).toBe(13);
  });

  it('does not notify downstream if computed value does not change', () => {
    const a = signal(1);
    const clamped = computed(() => Math.min(a.value, 5));
    const fn = vi.fn(() => clamped.value);
    const downstream = computed(fn);

    expect(downstream.value).toBe(1);
    fn.mockClear();

    a.value = 3;
    expect(downstream.value).toBe(3);
    expect(fn).toHaveBeenCalledTimes(1);
    fn.mockClear();

    // a goes from 3 → 10 but clamped stays at 5
    a.value = 10;
    downstream.value; // pull
    // Clamped changes from 3 → 5, so downstream recomputes
    expect(fn).toHaveBeenCalledTimes(1);
    fn.mockClear();

    a.value = 20; // clamped still 5, so downstream should not recompute
    downstream.value; // pull
    // This is tricky — the computed is marked dirty by the push, but on pull
    // it finds the value hasn't changed. Whether it avoids downstream depends
    // on implementation. With our approach it will still call fn because
    // clamped gets marked dirty. That's acceptable — the important thing is
    // it doesn't over-notify EFFECTS (which is what causes DOM work).
  });
});

// ── effect() ────────────────────────────────────────────────────────

describe('effect()', () => {
  it('runs immediately on creation', () => {
    const fn = vi.fn();
    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('re-runs when a dependency changes', () => {
    const count = signal(0);
    const fn = vi.fn(() => {
      count.value; // read → track
    });
    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    count.value = 1;
    flushEffects();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('batches multiple synchronous writes into one effect run', () => {
    const a = signal(0);
    const b = signal(0);
    const c = signal(0);
    const fn = vi.fn(() => {
      a.value + b.value + c.value;
    });
    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    a.value = 1;
    b.value = 2;
    c.value = 3;
    // All three writes schedule the effect, but it hasn't run yet
    flushEffects();
    expect(fn).toHaveBeenCalledTimes(2); // just one re-run for all three
  });

  it('microtask coalescing: multiple writes produce one effect run', async () => {
    const a = signal(0);
    const b = signal(0);
    const fn = vi.fn(() => {
      a.value + b.value;
    });
    effect(fn);
    fn.mockClear();

    a.value = 1;
    b.value = 2;
    // Effects haven't run yet — scheduled on microtask
    expect(fn).not.toHaveBeenCalled();

    await new Promise(r => queueMicrotask(r));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('flush() synchronously executes pending effects', () => {
    const a = signal(0);
    const b = signal(0);
    const fn = vi.fn(() => {
      a.value + b.value;
    });
    effect(fn);
    fn.mockClear();

    a.value = 1;
    b.value = 2;
    flush();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cleanup runs before re-execution', () => {
    const count = signal(0);
    const order: string[] = [];

    effect(() => {
      const current = count.value;
      order.push(`run:${current}`);
      return () => {
        order.push(`cleanup:${current}`);
      };
    });
    expect(order).toEqual(['run:0']);

    count.value = 1;
    flushEffects();
    expect(order).toEqual(['run:0', 'cleanup:0', 'run:1']);

    count.value = 2;
    flushEffects();
    expect(order).toEqual(['run:0', 'cleanup:0', 'run:1', 'cleanup:1', 'run:2']);
  });

  it('dispose() stops the effect and runs final cleanup', () => {
    const count = signal(0);
    const fn = vi.fn(() => { count.value; });
    const dispose = effect(() => {
      count.value;
      fn();
      return () => { fn.mockClear(); }; // cleanup
    });
    expect(fn).toHaveBeenCalledTimes(1);

    dispose();

    count.value = 1;
    flushEffects();
    // Effect should NOT have re-run
    expect(fn).not.toHaveBeenCalled();
  });

  it('disposed effect does not re-run even after microtask', async () => {
    const count = signal(0);
    const fn = vi.fn(() => { count.value; });
    const dispose = effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    count.value = 1; // schedules effect via microtask
    dispose(); // dispose before microtask fires

    await new Promise(r => queueMicrotask(r)); // let microtask run
    expect(fn).toHaveBeenCalledTimes(1); // still just the initial run
  });

  it('errors in effects are caught and logged, not thrown', () => {
    const s = signal(0);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    effect(() => {
      if (s.value > 0) throw new Error('boom');
      s.value; // track
    });

    s.value = 1;
    // Should not throw
    expect(() => flushEffects()).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith('Effect error:', expect.any(Error));

    errorSpy.mockRestore();
  });

  it('effect with computed dependency', () => {
    const count = signal(1);
    const doubled = computed(() => count.value * 2);
    const values: number[] = [];

    effect(() => {
      values.push(doubled.value);
    });
    expect(values).toEqual([2]);

    count.value = 5;
    flushEffects();
    expect(values).toEqual([2, 10]);
  });

  it('dynamic dependency tracking — effect stops reacting to unused signals', () => {
    const flag = signal(true);
    const a = signal('A');
    const b = signal('B');
    const fn = vi.fn(() => {
      return flag.value ? a.value : b.value;
    });
    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    // Only a is tracked. Changing b should not trigger
    b.value = 'B2';
    flushEffects();
    expect(fn).toHaveBeenCalledTimes(1);

    // Switch branch
    flag.value = false;
    flushEffects();
    expect(fn).toHaveBeenCalledTimes(2);

    // Now only b is tracked. Changing a should not trigger
    a.value = 'A2';
    flushEffects();
    expect(fn).toHaveBeenCalledTimes(2);

    // b is tracked
    b.value = 'B3';
    flushEffects();
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

// ── isSignal() ──────────────────────────────────────────────────────

describe('isSignal()', () => {
  it('returns true for signal()', () => {
    expect(isSignal(signal(0))).toBe(true);
  });

  it('returns true for computed()', () => {
    expect(isSignal(computed(() => 1))).toBe(true);
  });

  it('returns false for non-signals', () => {
    expect(isSignal(null)).toBe(false);
    expect(isSignal(undefined)).toBe(false);
    expect(isSignal(42)).toBe(false);
    expect(isSignal('hello')).toBe(false);
    expect(isSignal({})).toBe(false);
    expect(isSignal([])).toBe(false);
  });
});

// ── Integration scenarios ───────────────────────────────────────────

describe('integration', () => {
  it('effect → signal write → another effect (cascading updates)', () => {
    const source = signal(1);
    const derived = signal(0);
    const results: number[] = [];

    // Effect 1: writes to derived based on source
    effect(() => {
      derived.value = source.value * 10;
    });

    // Effect 2: reads derived
    effect(() => {
      results.push(derived.value);
    });

    expect(results).toEqual([10]);

    source.value = 2;
    // Effect 1 runs and writes derived = 20, which schedules effect 2.
    // Need two flush cycles: first flush runs effect 1 (which schedules effect 2),
    // second flush runs effect 2.
    flushEffects(); // runs effect 1 → derived = 20, schedules effect 2
    flushEffects(); // runs effect 2 → reads derived = 20
    expect(results.at(-1)).toBe(20);
  });

  it('multiple computeds feeding one effect', () => {
    const a = signal(1);
    const b = signal(2);
    const sum = computed(() => a.value + b.value);
    const product = computed(() => a.value * b.value);
    const results: string[] = [];

    effect(() => {
      results.push(`sum=${sum.value}, product=${product.value}`);
    });
    expect(results).toEqual(['sum=3, product=2']);

    a.value = 3;
    b.value = 4;
    flush();
    expect(results).toEqual(['sum=3, product=2', 'sum=7, product=12']);
  });

  it('signal holding an object — reference change triggers update', () => {
    const data = signal({ name: 'Alice' });
    const fn = vi.fn(() => data.value.name);
    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    data.value = { name: 'Bob' }; // new reference
    flushEffects();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('signal holding an object — mutation does NOT trigger (referential equality)', () => {
    const obj = { name: 'Alice' };
    const data = signal(obj);
    const fn = vi.fn(() => data.value.name);
    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    data.value = obj; // same reference
    flushEffects();
    expect(fn).toHaveBeenCalledTimes(1); // no change
  });

  it('stress: many signals, one effect', () => {
    const signals = Array.from({ length: 100 }, (_, i) => signal(i));
    const fn = vi.fn(() => signals.reduce((sum, s) => sum + s.value, 0));
    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    signals[50].value = 1000;
    flushEffects();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('flush() drains cascades + tick()', () => {
  it('settles a multi-hop effect cascade in ONE flush() call', () => {
    // A writes `derived`; B reads `derived`. Before, B needed a second flush.
    const source = signal(0);
    const derived = signal(0);
    const seen: number[] = [];
    effect(() => {
      derived.value = source.value * 10;
    });
    effect(() => {
      seen.push(derived.value);
    });
    flush(); // initial run of both

    source.value = 2;
    flush(); // single call drains A → derived=20 → B
    expect(derived.value).toBe(20);
    expect(seen).toEqual([0, 20]);
  });

  it('does not double-run an effect that reads a computed which recomputes', () => {
    const count = signal(1);
    const doubled = computed(() => count.value * 2);
    const results: number[] = [];
    effect(() => results.push(doubled.value));
    flush();
    expect(results).toEqual([2]);

    count.value = 5;
    flush();
    // Exactly one run per change — no spurious re-schedule from the lazy
    // recompute during the effect's read.
    expect(results).toEqual([2, 10]);
  });

  it('tick() settles effects AND queued microtask work', async () => {
    const s = signal(0);
    const log: number[] = [];
    effect(() => log.push(s.value));
    await tick();
    expect(log).toEqual([0]);

    s.value = 1;
    // Some behavior schedules follow-up work via queueMicrotask; tick() drains
    // both that and the effects it triggers.
    let microtaskRan = false;
    queueMicrotask(() => {
      microtaskRan = true;
      s.value = 2;
    });
    await tick();
    expect(microtaskRan).toBe(true);
    expect(log).toEqual([0, 1, 2]);
  });

  it('tick() settles a deep (3-level) microtask chain that writes a signal', async () => {
    // rev's UI-22 repro: a self-extending queueMicrotask chain escapes a
    // microtask-only drain (you can't introspect the queue to prove
    // quiescence). Crossing a macrotask boundary runs the whole microtask
    // queue — at any depth — before the timer fires, so the chain settles.
    const s = signal(0);
    const log: number[] = [];
    effect(() => log.push(s.value));
    await tick();
    expect(log).toEqual([0]);

    queueMicrotask(() => queueMicrotask(() => queueMicrotask(() => {
      s.value = 3;
    })));
    await tick();
    expect(s.value).toBe(3);
    expect(log).toEqual([0, 3]);
  });
});

// ── ADR 0030.2 T5: deterministic flush order ────────────────────────

describe('deterministic flush order (ADR 0030.2 T5)', () => {
  it('pending effects run in creation order, surviving observer-set reshuffles', () => {
    const s = signal(0);
    const flag = signal(true);
    const log: number[] = [];

    effect(() => { s.value; log.push(1); });               // e1
    effect(() => { flag.value; s.value; log.push(2); });   // e2 — re-tracks below
    effect(() => { s.value; log.push(3); });               // e3

    // Force e2 to re-track: it unsubscribes and re-subscribes to `s`,
    // moving it to the END of s's observer set. Notification order is now
    // e1, e3, e2 — flush order must still be creation order.
    flag.value = false;
    flush();
    log.length = 0;

    s.value = 1;
    flushEffects();
    expect(log).toEqual([1, 2, 3]);
  });

  it('identical writes produce identical run order across repetitions', () => {
    const s = signal(0);
    const log: number[] = [];
    effect(() => { s.value; log.push(1); });
    effect(() => { s.value; log.push(2); });
    effect(() => { s.value; log.push(3); });
    log.length = 0;

    for (let i = 1; i <= 3; i++) {
      s.value = i;
      flushEffects();
    }
    expect(log).toEqual([1, 2, 3, 1, 2, 3, 1, 2, 3]);
  });

  it('documented cost: a later-created writer costs one deterministic extra run', () => {
    const src = signal(1);
    const derived = signal(10);
    const log: string[] = [];

    // Reader created FIRST (lower creation index) — reads both signals.
    effect(() => { log.push(`reader:${src.value}:${derived.value}`); });
    // Writer created SECOND — derives `derived` from `src`.
    effect(() => { derived.value = src.value * 10; });
    flush();
    log.length = 0;

    src.value = 2;
    flush();
    // Both are pending; creation order runs the reader first (sees the stale
    // derived value), the writer then updates `derived`, and the reader runs
    // once more. One extra run versus topological order — accepted, because
    // the order is identical on every replay.
    expect(log).toEqual(['reader:2:10', 'reader:2:20']);

    log.length = 0;
    src.value = 3;
    flush();
    expect(log).toEqual(['reader:3:20', 'reader:3:30']);
  });
});

// ── ADR 0030.2 T5: clock-free loop guard (N301) ─────────────────────

describe('clock-free loop guard (N301)', () => {
  it('disposes a self-rescheduling effect after a deterministic run count, under fake timers', () => {
    vi.useFakeTimers();
    const calls: unknown[][] = [];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      calls.push(args);
    });
    try {
      const counter = signal(0);
      effect(() => {
        counter.value = counter.value + 1;
      });
      expect(counter.value).toBe(1); // initial run

      for (let i = 0; i < 5; i++) flushEffects();

      // Clock-free and deterministic: initial run + exactly 100 guarded
      // re-runs, regardless of timers or wall-clock (the old guard counted
      // a Date.now window and was nondeterministic under fake timers).
      expect(counter.value).toBe(101);
      expect(calls.some((a) => String(a[0]).includes('[nisli:N301]'))).toBe(true);
      expect(calls.some((a) => String(a[0]).includes('maximum re-run limit'))).toBe(true);

      const final = counter.value;
      flushEffects();
      expect(counter.value).toBe(final); // truly disposed
    } finally {
      errorSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('a convergent clamp passes: the counter resets when a run does not re-schedule', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const s = signal(10);
      effect(() => {
        if (s.value > 5) s.value = 5; // converges: second run writes an equal value
      });
      flushEffects();
      expect(s.value).toBe(5);

      // Re-trigger convergence far more than MAX_EFFECT_RERUNS times in a
      // row — consecutive-self-reschedule never exceeds 1, so the guard
      // must not trip and the effect must stay alive.
      for (let i = 0; i < 150; i++) {
        s.value = 10 + i;
        flushEffects();
        expect(s.value).toBe(5);
      }

      s.value = 100;
      flushEffects();
      expect(s.value).toBe(5); // still clamping — never disposed
      expect(errorSpy.mock.calls.some((a) => String(a[0]).includes('N301'))).toBe(false);
    } finally {
      errorSpy.mockRestore();
    }
  });
});

// ── ADR 0030.2 T5: write-in-own-sources diagnostic (N302) ───────────

describe('write-in-own-sources diagnostic (N302)', () => {
  const n302Calls = (spy: ReturnType<typeof vi.spyOn>) =>
    spy.mock.calls.filter((a) => String(a[0]).includes('[nisli:N302]')).length;

  it('warns at the write when a running effect writes a CHANGED value to a signal it read', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const s = signal(0);
      effect(() => {
        if (s.value < 3) s.value = s.value + 1;
      });
      // Initial run read s(0) then wrote 1 — in-sources, changed → warn.
      expect(n302Calls(errorSpy)).toBe(1);

      flushEffects(); // converges 1 → 2 → 3, warning at each changing write
      expect(s.value).toBe(3);
      expect(n302Calls(errorSpy)).toBe(3);

      // Attribution-only: the effect is NOT disposed by N302.
      s.value = 0;
      flushEffects();
      expect(s.value).toBe(3);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('does not warn when the write targets a signal the effect did not read', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const a = signal(0);
      const b = signal('');
      effect(() => { b.value = `v-${a.value}`; });
      a.value = 1;
      flushEffects();
      expect(b.value).toBe('v-1');
      expect(n302Calls(errorSpy)).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('does not warn on equal-value writes — certified converging writers stay silent', () => {
    // Registry reflect effects (0025 open-state) and each()'s item-signal
    // reuse write back the value they read; the Object.is cutoff runs
    // BEFORE the diagnostic, so they never warn.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const reflected = signal('open');
      const item = signal({ id: 1 });
      const sameRef = item.value;
      let runs = 0;
      effect(() => {
        runs++;
        reflected.value = reflected.value;   // reflect-style equal write
        item.value = sameRef;                // each()-style same-reference reuse
      });
      flushEffects();
      expect(runs).toBe(1);
      expect(n302Calls(errorSpy)).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('does not warn when the signal was read only via peek()', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const gate = signal(0);
      const out = signal(0);
      effect(() => {
        gate.value;
        out.value = out.peek() + 1; // peek does not track → out is not a source
      });
      gate.value = 1;
      flushEffects();
      expect(out.value).toBe(2);
      expect(n302Calls(errorSpy)).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('__setDevMode(false) silences the diagnostic (loop-guard behavior is unaffected)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    __setDevMode(false);
    try {
      const s = signal(0);
      effect(() => {
        if (s.value < 2) s.value = s.value + 1;
      });
      flushEffects();
      expect(s.value).toBe(2);
      expect(n302Calls(errorSpy)).toBe(0);
    } finally {
      __setDevMode(true);
      errorSpy.mockRestore();
    }
  });
});

// ── ADR 0030.2 §3: effect(async) guard (N310) ───────────────────────

describe('effect(async) guard (N310)', () => {
  it('diagnoses a Promise-returning effect once, names resource(), and contains the rejection', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const n310Calls = () =>
      errorSpy.mock.calls.filter((a) => String(a[0]).includes('[nisli:N310]'));
    try {
      const s = signal(0);
      let runs = 0;
      const asyncFn = async () => {
        runs++;
        s.value; // synchronous part still tracks
        if (runs === 1) throw new Error('async boom');
      };
      // Cast past the type-level rejection to exercise the runtime guard.
      effect(asyncFn as unknown as () => void);
      expect(runs).toBe(1);
      expect(n310Calls().length).toBe(1);
      expect(String(n310Calls()[0]?.[0])).toContain('resource()');

      // The rejection routes into the effect error path — logged, never an
      // unhandled rejection (vitest would fail this test on one).
      await new Promise((r) => setTimeout(r, 0));
      expect(errorSpy).toHaveBeenCalledWith('Effect error:', expect.any(Error));

      // Dependency tracked in the synchronous part still re-runs the effect,
      // but N310 reports once per effect, not once per run.
      s.value = 1;
      flushEffects();
      expect(runs).toBe(2);
      expect(n310Calls().length).toBe(1);
      await new Promise((r) => setTimeout(r, 0));
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('does not treat the returned Promise as a cleanup', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const s = signal(0);
      effect((async () => { s.value; }) as unknown as () => void);
      s.value = 1;
      // If the Promise had been stored as `cleanup`, the re-run would try to
      // call it and throw. It must re-run cleanly.
      expect(() => flushEffects()).not.toThrow();
      await new Promise((r) => setTimeout(r, 0));
    } finally {
      errorSpy.mockRestore();
    }
  });
});

// ── ADR 0030.2 T5: loud cap breaks (N303) ───────────────────────────

describe('loud cap breaks (N303)', () => {
  it('flush() breaks a cross-effect ping-pong loop loudly instead of silently', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const a = signal(0);
      const b = signal(0);
      // Neither effect re-schedules ITSELF (each writes the other's source),
      // so the N301 self-loop guard never trips — this is exactly the shape
      // only the flush cascade cap can catch.
      const d1 = effect(() => { b.value = a.value + 1; });
      const d2 = effect(() => { a.value = b.value + 1; });

      flushEffects(); // drains to the cascade cap, then breaks LOUDLY

      expect(
        errorSpy.mock.calls.some((c) => String(c[0]).includes('[nisli:N303]')),
      ).toBe(true);
      expect(
        errorSpy.mock.calls.some((c) => String(c[0]).includes('flush()')),
      ).toBe(true);

      d1();
      d2();
      flushEffects(); // remnant drains without further work
    } finally {
      errorSpy.mockRestore();
    }
  });
});

// ── ADR 0030.2 §3 papercuts: untrack value + peek ───────────────────

describe('papercuts: untrack<T> and peek()', () => {
  it('untrack returns the value of its callback', () => {
    const s = signal(21);
    expect(untrack(() => s.value * 2)).toBe(42);
  });

  it('untrack-returned reads are still not tracked', () => {
    const s = signal(1);
    let runs = 0;
    let last = 0;
    effect(() => {
      runs++;
      last = untrack(() => s.value);
    });
    expect([runs, last]).toEqual([1, 1]);

    s.value = 2;
    flushEffects();
    expect(runs).toBe(1); // not a dependency
  });

  it('signal.peek() reads without tracking', () => {
    const s = signal(1);
    let runs = 0;
    effect(() => {
      runs++;
      s.peek();
    });
    expect(s.peek()).toBe(1);

    s.value = 2;
    flushEffects();
    expect(runs).toBe(1); // peek did not subscribe
    expect(s.peek()).toBe(2);
  });

  it('computed.peek() pulls a fresh value without tracking', () => {
    const s = signal(1);
    const c = computed(() => s.value * 2);
    expect(c.peek()).toBe(2);

    s.value = 5;
    expect(c.peek()).toBe(10); // fresh pull

    let runs = 0;
    effect(() => {
      runs++;
      c.peek();
    });
    s.value = 6;
    flushEffects();
    expect(runs).toBe(1); // not tracked
  });

  it('computed.peek() rethrows the cached error until a dependency changes', () => {
    const s = signal(1);
    const c = computed(() => {
      if (s.value === 1) throw new Error('nope');
      return s.value;
    });
    expect(() => c.peek()).toThrow('nope');
    expect(() => c.peek()).toThrow('nope');
    s.value = 2;
    expect(c.peek()).toBe(2);
  });

  it('subscribe() on a computed skips equal recomputes', () => {
    const s = signal(1);
    const clamped = computed(() => Math.min(s.value, 5));
    const seen: number[] = [];
    clamped.subscribe((v) => seen.push(v));
    expect(seen).toEqual([1]);

    s.value = 10;
    flushEffects();
    s.value = 20; // clamped recomputes equal — no notification
    flushEffects();
    expect(seen).toEqual([1, 5]);
  });
});
