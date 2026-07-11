/**
 * ui/aspect-ratio.ts — Aspect Ratio.
 *
 * Ported from shadcn/ui `new-york-v4/ui/aspect-ratio.tsx` (MIT —
 * https://github.com/shadcn-ui/ui) as a Nisli component. Usable as a typed
 * factory (`AspectRatio({ ratio: 16 / 9 })`) or as a plain custom element
 * (`<ui-aspect-ratio ratio="1.777"></ui-aspect-ratio>`).
 * Radix's padding-based sizing is translated to the native CSS
 * `aspect-ratio` property while preserving its relative, full-width box.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  component,
  computed,
  html,
  onMount,
  ref,
  type TemplateResult,
} from '@nisli/core';
import {
  attr,
  captureChildren,
  cn,
  projectChildren,
  transparentHost,
} from '../lib/utils.js';

export const aspectRatioClasses = 'relative w-full';

export type AspectRatioProps = {
  /** The desired width divided by height. Defaults to 1. */
  ratio?: number;
  /** Merged last into the inner <div>'s class list via cn(). */
  className?: string;
  children?: string | TemplateResult;
};

export const AspectRatio = component<AspectRatioProps>('ui-aspect-ratio', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);

  const parsedRatio = host.hasAttribute('ratio')
    ? Number(host.getAttribute('ratio'))
    : 1;
  const ratioFallback = Number.isFinite(parsedRatio) ? parsedRatio : 1;
  const ratio = computed(() => props.ratio.value ?? ratioFallback);
  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn(aspectRatioClasses, className.value));
  const style = computed(() => `aspect-ratio: ${ratio.value}`);

  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<div
    ref="${root}"
    data-slot="aspect-ratio"
    class="${classes}"
    style="${style}"
  >${props.children}</div>`;
});
