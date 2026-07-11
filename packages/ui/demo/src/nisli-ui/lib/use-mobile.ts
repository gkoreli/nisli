/**
 * lib/use-mobile.ts — reactive "is the viewport mobile-width?" signal.
 *
 * The Nisli equivalent of shadcn/ui's `use-mobile` hook
 * (new-york-v4/hooks/use-mobile.ts, MIT — https://github.com/shadcn-ui/ui),
 * rebuilt on signals: instead of a React state hook it returns a
 * `ReadonlySignal<boolean>` fed by `matchMedia('(max-width: 767px)')` — true
 * below the 768px breakpoint, updating live as the viewport crosses it.
 *
 * ```ts
 * const { isMobile } = useIsMobile();
 * effect(() => host.classList.toggle('is-mobile', isMobile.value));
 * ```
 *
 * Called during component setup, the media-query listener auto-disposes on
 * disconnect; called outside a component (services, tests), use the returned
 * `dispose()`. SSR/SSG-safe: with no `matchMedia`, `isMobile` is a static
 * `false`.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  signal,
  hasContext,
  onCleanup,
  type ReadonlySignal,
} from '@nisli/core';

/** Viewport width (px) at/above which the layout is considered desktop. */
export const MOBILE_BREAKPOINT = 768;

export interface MobileController {
  /** `true` while the viewport is narrower than `MOBILE_BREAKPOINT`. */
  isMobile: ReadonlySignal<boolean>;
  /** Remove the media-query listener. Idempotent. */
  dispose(): void;
}

/**
 * Track whether the viewport is mobile-width as a signal. The listener
 * auto-disposes when created during component setup; otherwise call the
 * returned `dispose()`.
 */
export function useIsMobile(): MobileController {
  // No matchMedia (SSR/SSG or old environments): a static, non-mobile signal.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return { isMobile: signal(false), dispose: () => {} };
  }

  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  const isMobile = signal<boolean>(mql.matches);

  const onChange = (): void => {
    isMobile.value = mql.matches;
  };
  mql.addEventListener('change', onChange);

  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    mql.removeEventListener('change', onChange);
  };

  if (hasContext()) onCleanup(dispose);

  return { isMobile, dispose };
}
