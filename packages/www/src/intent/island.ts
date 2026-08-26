/**
 * intent/island.ts — the live half. THE ONLY DOM-TOUCHING MODULE HERE.
 *
 * Deliberately NOT re-exported from `index.ts`: that barrel is what the router
 * lazily imports at RENDER time, which in the static build is Node with
 * happy-dom, and `component()` at module load in a non-DOM context is the ADR
 * 0026 §8 crash this repo already paid for once. `client/hydrate.ts` imports
 * this file directly, in a browser, and nothing else does.
 *
 * WHAT HYDRATION ADDS, exactly: `fit(host)`. One line. The static build already
 * rendered the declarations, the context axes and the whole visual tier from
 * `bodies.ts`; this replaces that subtree with the identical subtree plus the
 * measured pass, its ResizeObserver and its cleanup — all owned by nisli's
 * lifecycle rather than by this file. The two DOMs differ by the attributes the
 * engine writes and by nothing else.
 *
 * The host is made transparent (`display: contents`, ADR 0022 — the site's own
 * helper) so hydration adds no box. That is not cosmetic: a boxed host between
 * the frame and the rows would make the hydrated geometry differ from the static
 * geometry, and the whole point of /intent/comparison is that the only
 * difference is the solve.
 */
import { component, html, onCleanup, onMount, type TemplateResult } from '@nisli/core';
import { fit } from '@nisli/intent';
import { transparentHost } from '../nisli-ui/lib/utils.js';
import { comparisonBody, pitchSampleBody, playgroundBody } from './bodies.js';
import { readSiteTheme, theme } from './harness.js';

/**
 * Every surface an `[data-hydrate="intent"]` frame may name. A frame naming
 * something else THROWS: `hydrateFrame` catches it, leaves the static baseline
 * standing and warns, which is the right failure — a silently empty frame is the
 * "empty drawer" P0 this site already shipped once.
 */
const SURFACES: Record<string, () => TemplateResult> = {
  'pitch-row': pitchSampleBody,
  playground: playgroundBody,
  comparison: comparisonBody,
};

interface IntentIslandProps {
  /** A key of `SURFACES`. Fixed at setup — an island never becomes another one. */
  surface: string;
}

export const IntentIsland = component<IntentIslandProps>('www-intent-island', (props, host) => {
  transparentHost(host);
  // The measured tier, attached in one line. It finds every `[data-fit]` in this
  // subtree, solves it, observes it for resize, and disconnects on cleanup.
  fit(host);
  followSiteTheme();

  const build = SURFACES[props.surface.value];
  if (!build) throw new Error(`intent island: unknown surface "${props.surface.value}"`);
  return build();
});

/**
 * Keep the theme AXIS following the site's dark-mode CLASS while this island is
 * alive. See `harness.ts` for the measurement that rejected the other direction
 * (writing `data-theme` on `<html>`): it does not reach these surfaces and it
 * bleeds 23 colour properties into site chrome.
 *
 * Registered synchronously in setup and pointed at a node on mount, which is the
 * same lifecycle shape `fit()` uses and for the same reason — registering
 * `onCleanup` from inside `onMount` throws N402.
 */
function followSiteTheme(): void {
  const observer = new MutationObserver(() => {
    theme.value = readSiteTheme();
  });
  onMount(() => {
    theme.value = readSiteTheme();
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  });
  onCleanup(() => observer.disconnect());
}

export function intentSurface(id: string | null): TemplateResult {
  if (id === null || !(id in SURFACES)) throw new Error(`intent island: unknown surface "${id}"`);
  return html`${IntentIsland({ surface: id })}`;
}
