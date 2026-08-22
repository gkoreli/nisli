/**
 * lib/portal.ts — render a component's subtree into a different DOM container.
 *
 * The Nisli equivalent of Radix UI's `Portal` primitive (MIT —
 * https://github.com/radix-ui/primitives), which shadcn/ui's overlays use to
 * escape `overflow`/`transform`/`z-index` stacking contexts by mounting their
 * content at the document body. Rebuilt on the Nisli lifecycle.
 *
 * `portal(ref)` moves the referenced element (with its whole subtree) into a
 * target container (`document.body` by default) after the component mounts,
 * and removes it again on teardown. Capable engines use moveBefore() to retain
 * platform state; ADR 0023's deferred teardown remains the correctness layer
 * for append-based fallback moves. Bindings track their nodes by reference,
 * not by DOM position.
 *
 * ```ts
 * const contentRef = ref<HTMLElement>();
 * portal(contentRef); // → moved under <body> on mount, removed on teardown
 * return html`<div ref="${contentRef}">…</div>`;
 * ```
 *
 * Ownership: once moved, the element lives under the portal target rather than
 * the component's own root, so neither template disposal (which only unbinds —
 * it never removes mounted nodes) nor the host leaving the DOM will remove it.
 * The portal is therefore the sole owner of the moved subtree's removal, which
 * it captures at mount time so a later ref reset can't strand it.
 *
 * Multiple portals stack as siblings under the target in mount order and each
 * removes only its own subtree. To portal several siblings together, wrap them
 * in a single element and portal that (as `dialog` does with its overlay +
 * content wrapper).
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import { hasContext, isRef, onCleanup, onMount, type Ref } from '@nisli/core';

interface MoveCapableParent extends ParentNode {
  moveBefore(node: Node, child: Node | null): void;
}

/** Where to send the portaled subtree; a function is resolved at mount time. */
export type PortalTarget = HTMLElement | (() => HTMLElement | null | undefined);

export interface PortalOptions {
  /** Container to move the subtree into. Defaults to `document.body`. */
  target?: PortalTarget;
  /** When false, `portal()` is a no-op and the subtree stays in place. */
  enabled?: boolean;
}

function resolveTarget(target: PortalTarget | undefined): HTMLElement | null {
  if (typeof target === 'function') return target() ?? null;
  if (target) return target;
  return typeof document !== 'undefined' ? document.body : null;
}

/**
 * Move a component's subtree into a portal target on mount, and remove it on
 * teardown. Must be called during component setup.
 *
 * @param node   A `Ref<HTMLElement>` (resolved at mount) or a live element.
 * @param options `target` (default `document.body`) and `enabled` (default true).
 */
export function portal(
  node: Ref<HTMLElement> | HTMLElement,
  options: PortalOptions = {},
): void {
  if (!hasContext()) {
    throw new Error('portal() must be called during component setup.');
  }

  const { enabled = true, target } = options;
  if (!enabled) return;

  // The element actually moved, captured at mount so teardown removes exactly
  // it — independent of the ref being reset to null during disposal.
  let moved: HTMLElement | null = null;

  onMount(() => {
    const el = isRef(node) ? node.current : node;
    if (!el) return;
    const dest = resolveTarget(target);
    // Already in place (no target, or the element is not connected anywhere
    // else): still record it so cleanup removes it if it later leaks.
    if (dest && dest !== el.parentNode) {
      const moveBefore = (dest as Partial<MoveCapableParent>).moveBefore;
      if (
        typeof moveBefore === 'function'
        && el.isConnected
        && dest.isConnected
        && el.ownerDocument === dest.ownerDocument
      ) {
        moveBefore.call(dest, el, null);
      } else {
        dest.appendChild(el);
      }
    }
    moved = el;
  });

  onCleanup(() => {
    moved?.parentNode?.removeChild(moved);
    moved = null;
  });
}
