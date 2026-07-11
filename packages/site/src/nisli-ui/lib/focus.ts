/**
 * lib/focus.ts — focus trap and focus restore.
 *
 * Behavior ported from Radix UI's FocusScope (MIT —
 * https://github.com/radix-ui/primitives), the primitive shadcn/ui's dialog
 * and other overlays use for modal focus management. Rebuilt on Nisli
 * lifecycle.
 *
 * A focus trap keeps keyboard focus inside a root element while active: Tab
 * from the last tabbable wraps to the first, Shift+Tab from the first wraps to
 * the last, and focus that escapes the root is pulled back. On activate it
 * moves focus into the root; on deactivate it restores focus to whatever was
 * focused before (typically the trigger). Operates on the component's inner
 * root element (via a Ref), never the `display: contents` host (ADR 0022).
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import { hasContext, onCleanup, type Ref } from '@nisli/core';

export interface FocusTrapOptions {
  /** Element to focus on activate; defaults to the first tabbable in the root. */
  initialFocus?: Ref<HTMLElement>;
  /**
   * Element to return focus to on deactivate; defaults to whatever was focused
   * when the trap activated (the trigger).
   */
  returnFocus?: Ref<HTMLElement>;
}

export interface FocusTrapController {
  /** Move focus into the root and start trapping Tab. Idempotent. */
  activate(): void;
  /** Stop trapping and restore focus. Idempotent. */
  deactivate(): void;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button',
  'input',
  'select',
  'textarea',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]',
  '[tabindex]',
].join(',');

function isFocusable(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  if (el.hidden || el.closest('[hidden]') != null) return false;
  const tabindex = el.getAttribute('tabindex');
  if (tabindex != null && Number(tabindex) < 0) return false;
  return true;
}

/**
 * Create a focus trap bound to `rootRef`. Call `activate()` when the trapping
 * surface opens and `deactivate()` when it closes; both are idempotent. When
 * created during component setup, the trap auto-deactivates on disconnect.
 *
 * ```ts
 * const trap = focusTrap(contentRef);
 * effect(() => (open.value ? trap.activate() : trap.deactivate()));
 * ```
 */
export function focusTrap(
  rootRef: Ref<HTMLElement>,
  options: FocusTrapOptions = {},
): FocusTrapController {
  let active = false;
  let previouslyFocused: HTMLElement | null = null;

  const tabbables = (): HTMLElement[] => {
    const root = rootRef.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      isFocusable,
    );
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab' || !active) return;
    const root = rootRef.current;
    if (!root) return;
    const items = tabbables();
    if (items.length === 0) {
      // Nothing tabbable inside — keep focus on the root itself.
      event.preventDefault();
      root.focus();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const activeEl = document.activeElement as HTMLElement | null;
    const inside = activeEl != null && root.contains(activeEl);

    if (event.shiftKey) {
      if (!inside || activeEl === first) {
        event.preventDefault();
        last.focus();
      }
    } else if (!inside || activeEl === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const activate = (): void => {
    if (active) return;
    active = true;
    previouslyFocused = document.activeElement as HTMLElement | null;
    const root = rootRef.current;
    const target = options.initialFocus?.current ?? tabbables()[0] ?? root ?? null;
    if (target) {
      // A focusable-less root still needs to receive focus.
      if (target === root && root.getAttribute('tabindex') == null) {
        root.setAttribute('tabindex', '-1');
      }
      target.focus();
    }
    document.addEventListener('keydown', handleKeyDown, true);
  };

  const deactivate = (): void => {
    if (!active) return;
    active = false;
    document.removeEventListener('keydown', handleKeyDown, true);
    const restoreTo = options.returnFocus?.current ?? previouslyFocused;
    previouslyFocused = null;
    restoreTo?.focus?.();
  };

  // Never leave a document listener behind if the component disconnects.
  if (hasContext()) onCleanup(deactivate);

  return { activate, deactivate };
}
