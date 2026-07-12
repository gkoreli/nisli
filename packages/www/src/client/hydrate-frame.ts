/**
 * client/hydrate-frame.ts — the pure, failure-safe mount of one preview frame
 * (split out from the observer bootstrap so it's unit-testable). Contract:
 *
 * - `data-hydrating` is a DISTINCT synchronous lock: a repeat intersection /
 *   re-entry while a load is in flight no-ops (never double-mounts, so no
 *   duplicate portaled overlay).
 * - `data-hydrated` is set ONLY after replace+mount succeeds — the success
 *   signal, not the attempt signal.
 * - On failure the static SSG baseline is left untouched and the lock is
 *   cleared, so the frame stays retryable (a later delivery succeeds); the
 *   rejection is handled, never unhandled.
 */
import { html, type TemplateResult } from '@nisli/core';

export type ExampleLoader = () => Promise<{ default: () => TemplateResult }>;

export async function hydrateFrame(frame: Element, load: ExampleLoader): Promise<void> {
  if (frame.hasAttribute('data-hydrated') || frame.hasAttribute('data-hydrating')) return;
  frame.setAttribute('data-hydrating', '');
  try {
    const mod = await load();
    frame.replaceChildren();
    html`${mod.default()}`.mount(frame as HTMLElement);
    frame.removeAttribute('data-hydrating');
    frame.setAttribute('data-hydrated', 'true');
  } catch (error) {
    // Chunk/network/deploy-cache failure: the static baseline is still shown.
    // Unlock (retryable) and never mark data-hydrated (that would lie 'live').
    frame.removeAttribute('data-hydrating');
    console.warn('[nisli] preview hydration failed', error);
  }
}
