/**
 * observe.test.ts — the one file in `fit/` that binds to `@nisli/core`, and the
 * only test here that is NOT a port.
 *
 * The prototype had no equivalent because it proved this in a browser: the
 * geometry matrix mounted real components and measured the result. A package
 * cannot run that, and what changed in the port is exactly the risky part — the
 * lifecycle import is now the PEER DEPENDENCY rather than a module inside the
 * same experiment. So the claim this file defends is the boundary claim: both
 * hooks are registered synchronously in setup.
 *
 * That is not stylistic. `onCleanup()` throws when it is called outside setup
 * (`packages/core/src/lifecycle.ts`), and `runMountCallbacks` is invoked OUTSIDE
 * `runWithContext` (`packages/core/src/component.ts`), so registering cleanup
 * from inside a mount callback throws, is contained, and stamps the host
 * `data-nisli-error="N402"` — silently, from the author's point of view, since
 * containment means the page keeps rendering. nisli's own diagnostics caught
 * exactly that shape while the prototype was being written (F6). Asserting the
 * absence of the stamp is therefore asserting that the observer is still owned
 * by setup.
 *
 * `ResizeObserver` is stubbed because happy-dom has no layout to resize. That
 * costs nothing here: the geometry is the solver's business and it is tested
 * against a fake box model in `solver.test.ts`. What this file measures is
 * WIRING — who is observed, and when the observer is dropped.
 */
import { describe, expect, it, vi } from 'vitest';
import { component, html } from '@nisli/core';
import { fit } from './observe.js';

/** Records the wiring: what was observed, and whether the observer was dropped. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  disconnected = false;

  constructor(readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  unobserve(): void {}

  disconnect(): void {
    this.disconnected = true;
  }
}

describe('fit() against the real @nisli/core lifecycle', () => {
  it('solves on mount, observes the container, and disconnects on cleanup', async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    component('intent-fit-host', (_props, host) => {
      fit(host as unknown as HTMLElement);
      return html`<div data-fit><span data-collapse="hide" data-priority="5">x</span></div>`;
    });

    const el = document.createElement('intent-fit-host');
    document.body.append(el);

    // Solved on mount: the mutator reached the document and marked the state.
    const container = el.querySelector('[data-fit]')!;
    expect(container.getAttribute('data-fit')).toBe('settled');
    expect(container.getAttribute('data-collapsed-count')).toBe('0');

    // The boundary claim. A cleanup registered from inside the mount callback
    // would be contained as N402 and stamped here, with the page still
    // rendering — a defect that reports itself only in an attribute nobody
    // reads unless a test does.
    expect(el.getAttribute('data-nisli-error')).toBe(null);
    expect(errors).not.toHaveBeenCalled();

    // Pointed at the container, not at the host: the host is layout-transparent
    // and its box would be nothing to measure.
    const observer = FakeResizeObserver.instances.at(-1)!;
    expect(observer.observed).toEqual([container]);

    el.remove();
    // Disposal is swept on a microtask, so the assertion has to wait for it.
    await Promise.resolve();
    expect(observer.disconnected).toBe(true);

    errors.mockRestore();
    vi.unstubAllGlobals();
  });
});
