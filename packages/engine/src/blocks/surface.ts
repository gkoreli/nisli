import { createContext } from '@nisli/core';

/**
 * Surface nesting. A block that draws a surface provides its depth; a surface
 * inside another surface renders nested (no second card). The app never says
 * so — the engine reads the tree.
 */
export const SurfaceContext = createContext<number>('Surface', { providerTag: 'nisli-section' });

export const surfaceDepth = (host: HTMLElement): number =>
  SurfaceContext.inject.optional(host.parentElement ?? host) ?? 0;
