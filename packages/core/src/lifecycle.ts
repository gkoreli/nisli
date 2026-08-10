/**
 * lifecycle.ts — Post-mount and cleanup lifecycle hooks
 *
 * `onMount()` registers a callback that runs after the component's
 * template is mounted to the DOM. If the callback returns a function,
 * that function runs on disconnect (cleanup).
 *
 * `onCleanup()` registers a standalone cleanup callback that runs
 * on disconnect — for cases where you need cleanup without mount logic.
 *
 * Both must be called synchronously during component setup.
 *
 * ```ts
 * component('my-el', (props, host) => {
 *   onMount(() => {
 *     host.querySelector('input')?.focus();
 *     return () => console.log('unmounted');
 *   });
 *
 *   onCleanup(() => clearInterval(timerId));
 *
 *   return html`<input />`;
 * });
 * ```
 */

import { hasContext, getCurrentComponent } from './context.js';

// ── Mount callback storage ──────────────────────────────────────────

/** Mount callbacks are stored on the component host and called after template mount. */
const mountCallbacks = new WeakMap<object, (() => void | (() => void))[]>();

/**
 * Register a callback to run after the component's template is mounted.
 * If the callback returns a function, it will be called on disconnect.
 *
 * Must be called synchronously during component setup.
 */
export function onMount(callback: () => void | (() => void)): void {
  if (!hasContext()) {
    throw new Error(
      'onMount() called outside setup(). ' +
      'It can only be called during component initialization.'
    );
  }
  const comp = getCurrentComponent();
  let callbacks = mountCallbacks.get(comp);
  if (!callbacks) {
    callbacks = [];
    mountCallbacks.set(comp, callbacks);
  }
  callbacks.push(callback);
}

/**
 * Register a cleanup callback to run on disconnect.
 * This is a convenience for cases where you need cleanup without mount logic.
 *
 * Must be called synchronously during component setup.
 */
export function onCleanup(callback: () => void): void {
  if (!hasContext()) {
    throw new Error(
      'onCleanup() called outside setup(). ' +
      'It can only be called during component initialization.'
    );
  }
  getCurrentComponent().addDisposer(callback);
}

/**
 * Listen for a DOM event on a target and auto-dispose the listener when the
 * component disconnects. Works with any EventTarget (host element, document,
 * window, etc.). Must be called during component setup.
 *
 * ```ts
 * useHostEvent(host, 'click', (e) => {
 *   // Runs on each click
 * });
 * ```
 */
export function useHostEvent<E extends Event = Event>(
  target: EventTarget,
  eventName: string,
  handler: (event: E) => void,
): void {
  if (!hasContext()) {
    throw new Error(
      'useHostEvent() called outside setup(). ' +
      'It can only be called during component initialization.'
    );
  }
  target.addEventListener(eventName, handler as EventListener);
  getCurrentComponent().addDisposer(() => {
    target.removeEventListener(eventName, handler as EventListener);
  });
}

/**
 * Run all registered mount callbacks for a component host.
 * Called by component.ts after the template is mounted to the DOM.
 *
 * A throw here PROPAGATES to component.ts's containment boundary — the SAME
 * boundary as a setup throw (ADR 0030.2 T6, code N402): remaining callbacks
 * are skipped, the partial scope (including cleanups already registered by
 * earlier callbacks) is disposed, the error fallback renders, and the host is
 * stamped `data-nisli-error`. The pre-T6 behavior (console-and-limp per
 * callback) left a half-mounted component alive with no machine-readable
 * trace and no teardown — the one containment semantics setup already had
 * (issue 0010) now covers mount too.
 * @internal
 */
export function runMountCallbacks(comp: object): void {
  const callbacks = mountCallbacks.get(comp);
  if (!callbacks) return;

  try {
    for (const cb of callbacks) {
      const cleanup = cb();
      if (typeof cleanup === 'function') {
        // Register cleanup as a disposer on the component
        (comp as any).addDisposer(cleanup);
      }
    }
  } finally {
    // Clear — mount callbacks run once (also when a throw contains the scope:
    // the boundary re-runs setup from scratch on the next mount, which
    // re-registers a fresh callback list).
    mountCallbacks.delete(comp);
  }
}
