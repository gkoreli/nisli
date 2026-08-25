/**
 * observe.ts — lifecycle. Binds the pure solver to the DOM adapter and to a
 * component's own subtree, so an author registers the measured tier with one
 * line: `fit(host)`.
 */

import { onCleanup, onMount } from '@nisli/core';
import { discoverCandidates, domMetrics, domMutator, fitContainers } from './dom.js';
import { solveFit } from './solver.js';

/** The domain solver, wired to the document. Three call sites need it identical. */
function solveContainer(container: HTMLElement): void {
  solveFit(container, discoverCandidates(container), domMetrics, domMutator);
}

/**
 * Attach the measured tier to a component's subtree: solve on mount, re-solve
 * on every resize, disconnect on cleanup. The lifecycle is the framework's, not
 * the author's.
 *
 * Both hooks are registered synchronously in setup. Registering `onCleanup`
 * from inside the `onMount` callback throws N402 — nisli's own diagnostics
 * caught exactly that while this experiment was being written (F6), and the
 * observer must be created here for the same reason: setup owns it, mount only
 * points it at nodes.
 */
export function fit(host: HTMLElement): void {
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) solveContainer(entry.target as HTMLElement);
  });

  onMount(() => {
    for (const container of fitContainers(host)) {
      solveContainer(container);
      observer.observe(container);
    }
  });

  onCleanup(() => observer.disconnect());
}

/**
 * Re-solve every container under `root`, in document order. This is the entry
 * point for anything that changes the context without resizing a box — the
 * demo's check button, the geometry proof — where the resize observer has no
 * reason to fire but the resolved values have changed.
 */
export function solveAll(root: ParentNode = document): void {
  for (const container of root.querySelectorAll<HTMLElement>('[data-fit]')) solveContainer(container);
}
