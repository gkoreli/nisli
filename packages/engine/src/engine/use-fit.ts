/**
 * useFit — one reactive solve for every fit-driven block.
 *
 * Measure, decide, apply — with the DOM owned by reactive styles the whole
 * way. The block renders "everything at natural size" while `measuring` is
 * true and renders the plan otherwise; nothing imperative touches a style
 * the block also computes. (Mixing the two is how a plan silently fails to
 * re-apply: the computed string does not change, the imperative write wins.)
 */
import { signal, effect, flush, onMount, onCleanup, type ReadonlySignal } from '@nisli/core';
import { fit, type FitItem, type FitPlan, type FitDecision } from './fit.js';
import { observeWidth } from './measure.js';
import { sizing } from './axes.js';

export interface FitSpec {
  /** Room in the row, read during the measuring phase. */
  available: () => number;
  /** Items at natural size, given the room. Read during the measuring phase when `measures` (the default); pure data otherwise. */
  items: (available: number) => FitItem[];
  /**
   * `items()` reads the DOM at natural size (default): the solve renders the
   * block unconstrained, flushes, and measures. `false` — the items are pure
   * data (budgets): no measuring render, no extra flush, and `measuring`
   * never turns true, so a rows change re-renders rows only (ADR 0044).
   */
  measures?: boolean;
  /** Between items, px; a thunk is resolved per solve, so a gap from `metrics` follows the axes. */
  gap: number | (() => number);
  triggerWidth?: () => number;
  /** Signals whose change should re-solve (read them inside). A sizing-axis change re-solves every fit without being listed. */
  deps?: () => void;
  /** Called with every plan, e.g. to report an unsatisfiable one. */
  onPlan?: (plan: FitPlan, available: number) => void;
}

export interface Fit {
  readonly plan: ReadonlySignal<FitPlan | null>;
  readonly measuring: ReadonlySignal<boolean>;
  decision(id: string): FitDecision | undefined;
  /** True when the item is out of the row (stacked or overflowed) and we are not measuring. */
  gone(id: string): boolean;
  solve(): void;
}

export function useFit(host: HTMLElement, spec: FitSpec): Fit {
  const measuring = signal(false);
  const plan = signal<FitPlan | null>(null);

  const solve = () => {
    if (!host.isConnected) return;
    const measures = spec.measures !== false;
    if (measures) { measuring.value = true; flush(); }
    const available = spec.available();
    const gap = typeof spec.gap === 'function' ? spec.gap() : spec.gap;
    const next = fit({ available, gap, triggerWidth: spec.triggerWidth?.() ?? 0, items: spec.items(available) });
    plan.value = next;
    if (measures) measuring.value = false;
    flush();
    spec.onPlan?.(next, available);
  };

  let mounted = false;
  let stopObserving = () => {};
  onMount(() => {
    mounted = true;
    solve();
    stopObserving = observeWidth(host, solve);
  });
  // The deps effect runs in the flush after the style effects, so one solve
  // per change lands after the DOM it measures has settled. `sizing` (density +
  // input, never scheme) is a dep of every fit: an axis moves the numbers a
  // plan is made of, and a scheme flip must not re-measure a Toolbar.
  const stopWatching = effect(() => { sizing.value; spec.deps?.(); if (mounted) queueMicrotask(solve); });
  onCleanup(stopWatching);
  onCleanup(() => stopObserving());

  const decision = (id: string) => plan.value?.decisions.find((d) => d.id === id);
  return {
    plan,
    measuring,
    decision,
    gone: (id) => { const a = decision(id)?.action; return !measuring.value && (a === 'stack' || a === 'overflow'); },
    solve,
  };
}
