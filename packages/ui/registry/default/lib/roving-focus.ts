/**
 * lib/roving-focus.ts — roving-tabindex keyboard navigation.
 *
 * Port of the roving-focus behavior behind Radix UI's RovingFocusGroup
 * (MIT — https://github.com/radix-ui/primitives), rebuilt on Nisli
 * signals. Moves focus among a group of items with the arrow keys
 * (by orientation), Home/End, optional wrap, and disabled-skipping,
 * while tracking a single tabbable "active" item as a signal.
 *
 * Behavior primitives operate on the component's inner root element and
 * the real focusable items inside it — never the `display: contents`
 * host (ADR 0022).
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import { signal, isSignal, type ReadonlySignal } from '@nisli/core';

export type Orientation = 'horizontal' | 'vertical';

/** Accepts a static orientation or a reactive one (e.g. from parent state). */
export type OrientationInput = Orientation | ReadonlySignal<Orientation>;

export interface RovingFocusOptions {
  /**
   * Axis the arrow keys navigate along. `'horizontal'` binds
   * ArrowLeft/ArrowRight, `'vertical'` binds ArrowUp/ArrowDown.
   * Default `'horizontal'`.
   */
  orientation?: OrientationInput;
  /** Wrap past the ends (last→first, first→last). Default `true`. */
  loop?: boolean;
  /**
   * Treat items with a `disabled` attribute or `aria-disabled="true"`
   * as unfocusable and skip over them. Default `true`.
   */
  skipDisabled?: boolean;
  /** Initial active index. Default `0`. */
  active?: number;
  /**
   * Called after the active item changes via keyboard navigation, with
   * the new index (into the live item list) and the item element. Use
   * this for "activation follows focus" (e.g. selecting a tab on arrow).
   */
  onActiveChange?: (index: number, item: HTMLElement) => void;
}

export interface RovingFocusController {
  /** Index of the item that should be tabbable (`tabindex="0"`). */
  readonly activeIndex: ReadonlySignal<number>;
  /**
   * Handle a keydown: arrow keys / Home / End move the active item and
   * DOM focus. Returns `true` (and calls `preventDefault`) when it
   * consumed the key, `false` otherwise. Safe to pass straight to
   * `@keydown=${controller.onKeydown}`.
   */
  onKeydown(event: KeyboardEvent): boolean;
  /** Set the active index (clamped to the item range); no focus move. */
  setActiveIndex(index: number): void;
  /** Roving `tabindex` for the item at `index`: `0` when active, else `-1`. */
  tabindex(index: number): 0 | -1;
  /** Move DOM focus to the active item, or to `index` if given. */
  focus(index?: number): void;
}

function readOrientation(o: OrientationInput | undefined): Orientation {
  if (o == null) return 'horizontal';
  return isSignal(o) ? o.value : o;
}

function isDisabled(el: HTMLElement): boolean {
  return el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
}

/**
 * Create a roving-focus controller over a dynamic set of items.
 *
 * `items` is called fresh on every keydown, so the group can grow, shrink,
 * or reorder between key presses.
 *
 * ```ts
 * const roving = rovingFocus(
 *   () => Array.from(root.current!.querySelectorAll<HTMLElement>('[role="tab"]')),
 *   { orientation: state.orientation, onActiveChange: (_i, el) => state.setValue(el.dataset.value!) },
 * );
 * // on the tablist element: @keydown=${roving.onKeydown}
 * ```
 */
export function rovingFocus(
  items: () => HTMLElement[],
  options: RovingFocusOptions = {},
): RovingFocusController {
  const { orientation, loop = true, skipDisabled = true, active = 0, onActiveChange } = options;
  const activeIndex = signal(Math.max(0, active));

  const enabled = (el: HTMLElement): boolean => !skipDisabled || !isDisabled(el);

  /**
   * Walk from `start` in `step` direction to the next enabled item,
   * wrapping when `loop`. Returns the index, or -1 if none is reachable.
   */
  const seek = (list: HTMLElement[], start: number, step: number): number => {
    const n = list.length;
    if (n === 0) return -1;
    for (let i = 1; i <= n; i++) {
      let idx = start + step * i;
      if (loop) {
        idx = ((idx % n) + n) % n;
      } else if (idx < 0 || idx >= n) {
        break;
      }
      const item = list[idx];
      if (item && enabled(item)) return idx;
    }
    return -1;
  };

  /** First/last enabled item in the given scan direction. */
  const edge = (list: HTMLElement[], step: 1 | -1): number => {
    const from = step === 1 ? -1 : list.length;
    return seek(list, from, step);
  };

  const commit = (list: HTMLElement[], index: number): boolean => {
    if (index < 0 || index >= list.length) return false;
    activeIndex.value = index;
    const item = list[index];
    if (item) {
      item.focus();
      onActiveChange?.(index, item);
    }
    return true;
  };

  const controller: RovingFocusController = {
    activeIndex,

    onKeydown(event: KeyboardEvent): boolean {
      const list = items();
      if (list.length === 0) return false;

      const dir = readOrientation(orientation);
      const forward = dir === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
      const backward = dir === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';

      // The current position: prefer real DOM focus if it's on an item,
      // else fall back to the tracked active index.
      const focused = list.indexOf(document.activeElement as HTMLElement);
      const current = focused >= 0 ? focused : Math.min(activeIndex.value, list.length - 1);

      let target = -1;
      switch (event.key) {
        case forward:
          target = seek(list, current, 1);
          break;
        case backward:
          target = seek(list, current, -1);
          break;
        case 'Home':
          target = edge(list, 1);
          break;
        case 'End':
          target = edge(list, -1);
          break;
        default:
          return false;
      }

      if (target < 0 || target === current) {
        // Still consume Home/End/arrows on this axis to avoid the page
        // scrolling, even when focus doesn't move.
        event.preventDefault();
        return false;
      }

      event.preventDefault();
      return commit(list, target);
    },

    setActiveIndex(index: number): void {
      const list = items();
      const max = Math.max(0, list.length - 1);
      activeIndex.value = Math.min(Math.max(0, index), max);
    },

    tabindex(index: number): 0 | -1 {
      return index === activeIndex.value ? 0 : -1;
    },

    focus(index?: number): void {
      const list = items();
      const target = index ?? activeIndex.value;
      list[target]?.focus();
    },
  };

  return controller;
}
