/**
 * view-transition.ts — opt-in View Transitions over the synchronous flush.
 *
 * `viewTransition()` wraps a state update so the browser animates between the
 * before and after frames. It is a thin, opt-in wrapper: nothing here runs
 * unless you call it, and no scheduler behaviour changes.
 *
 * ```ts
 * viewTransition(() => { items.value = sorted; }, { types: ['reorder'] });
 * ```
 *
 * ## Why `flush()` is the whole trick
 *
 * `document.startViewTransition()` captures the OLD frame, runs the update
 * callback, then captures the NEW frame. Nisli coalesces signal writes onto a
 * microtask (ADR 0015), so a bare `items.value = sorted` inside that callback
 * would mutate the DOM *after* the capture window — the browser would animate
 * a frame to itself. Calling `flush()` inside the callback drains the effect
 * cascade synchronously, so the DOM mutation the browser snapshots is nisli's
 * own synchronous flush. `flush()` keeps its documented contract exactly
 * ("effects executed before the next line", ADR 0015); this is a consumer of
 * it, not a change to it. N303's cascade cap still applies inside the
 * callback — a runaway cascade degrades to a skipped transition, not a hang.
 *
 * ## Progressive enhancement
 *
 * Where `document.startViewTransition` is missing (no DOM at all, or an engine
 * without the API) the update still applies — synchronously, flushed, and
 * unanimated — and the return is `null`. Where the API exists but the
 * object/`types` form does not (Chrome 111–124), the plain callback form is
 * used: the transition still runs, `:active-view-transition-type()` CSS simply
 * never matches. There is no polyfill and no UA sniffing.
 *
 * ## Companion CSS (author-side, core ships no stylesheet)
 *
 * The root crossfade is the UA default and needs no CSS; tune it, and cut
 * motion for users who ask, with:
 *
 * ```css
 * ::view-transition-old(root),
 * ::view-transition-new(root) { animation-duration: 200ms; }
 *
 * @media (prefers-reduced-motion: reduce) {
 *   ::view-transition-group(*),
 *   ::view-transition-old(*),
 *   ::view-transition-new(*) { animation: none !important; }
 * }
 * ```
 *
 * Reduced motion is answered in CSS, not JS: `viewTransition()` is still
 * called, so the swap stays atomic and typed styles stay active — only the
 * motion is neutralised. `skipTransition()` on the returned handle is the hard
 * opt-out.
 */

import { flush } from './signal.js';

// ── Types ───────────────────────────────────────────────────────────

export interface ViewTransitionOptions {
  /** Transition types, surfaced to `:active-view-transition-type()` CSS. */
  types?: string[];
}

// ── Feature detection ───────────────────────────────────────────────

/**
 * Does this engine accept `startViewTransition({ update, types })`?
 *
 * The object form and the `ViewTransition.types` accessor shipped together,
 * so the accessor is the probe. Engines predating it take a bare callback —
 * passing them an object would throw. A false negative costs only type-scoped
 * CSS, never the transition.
 */
function supportsTransitionTypes(): boolean {
  return typeof ViewTransition !== 'undefined'
    && 'types' in ViewTransition.prototype;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Run a state update inside a view transition.
 *
 * `update` must be synchronous: everything it does happens inside the
 * browser's capture window, where the page is frozen. Keep async work
 * (loaders, fetches) outside and wrap only the commit.
 *
 * @returns the live `ViewTransition` handle (`finished`, `ready`,
 * `skipTransition()`), or `null` when the platform has no support and the
 * update was applied directly.
 */
export function viewTransition(
  update: () => void,
  options: ViewTransitionOptions = {},
): ViewTransition | null {
  // The commit the browser snapshots: apply the update, then settle the
  // reactive cascade now rather than on the next microtask.
  const commit = (): void => {
    update();
    flush();
  };

  if (typeof document === 'undefined'
    || typeof document.startViewTransition !== 'function') {
    commit();
    return null;
  }

  const types = options.types;
  return types !== undefined && types.length > 0 && supportsTransitionTypes()
    ? document.startViewTransition({ update: commit, types })
    : document.startViewTransition(commit);
}
