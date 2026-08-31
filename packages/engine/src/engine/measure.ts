/**
 * The engine's one read of the screen. Swapped in tests so a block can be
 * proven at any width without a browser.
 */
import { signal, onMount, onCleanup, type ReadonlySignal } from '@nisli/core';

export type Measurer = (el: HTMLElement) => number;

const domMeasurer: Measurer = (el) => el.getBoundingClientRect().width;
let measurer: Measurer = domMeasurer;

export const measure: Measurer = (el) => measurer(el);

/** Test seam. Not part of the public API. */
export function setMeasurer(next: Measurer | null): void {
  measurer = next ?? domMeasurer;
}

const observers = new Set<() => void>();

/** Test seam: the screen changed — every observed element re-measures, as a ResizeObserver would tell it. */
export function remeasure(): void {
  for (const cb of [...observers]) cb();
}

/** Re-run `cb` whenever `el` changes size, when the platform can tell us. */
export function observeWidth(el: HTMLElement, cb: () => void): () => void {
  observers.add(cb);
  const stop = () => observers.delete(cb);
  if (typeof ResizeObserver === 'undefined') return stop;
  // Only the inline size matters. A block's own decisions change its height
  // (a folded column adds a line); reacting to that would solve forever.
  let last = -1;
  let frame = 0;
  const ro = new ResizeObserver((entries) => {
    const width = entries[entries.length - 1]?.contentRect.width ?? measure(el);
    if (width === last) return;
    last = width;
    cancelAnimationFrame(frame);
    // Layout decisions can change the observed element. Move those writes to
    // the next frame so they do not feed the current ResizeObserver delivery.
    frame = requestAnimationFrame(cb);
  });
  ro.observe(el);
  return () => { stop(); cancelAnimationFrame(frame); ro.disconnect(); };
}

/**
 * A block's own width as a signal. Read at mount, then whenever it changes.
 * Must be called during setup (it registers lifecycle hooks).
 */
export function useWidth(el: HTMLElement): ReadonlySignal<number> {
  const width = signal(0);
  let stop = () => {};
  onMount(() => {
    width.value = measure(el);
    stop = observeWidth(el, () => { width.value = measure(el); });
  });
  onCleanup(() => stop());
  return width;
}

/** The viewport's width as a signal (for blocks that float above the page). */
export function useViewportWidth(): ReadonlySignal<number> {
  const width = signal(0);
  const read = () => { width.value = typeof window === 'undefined' ? 0 : measure(document.documentElement); };
  onMount(() => {
    read();
    window.addEventListener('resize', read);
  });
  onCleanup(() => window.removeEventListener('resize', read));
  return width;
}
