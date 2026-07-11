/**
 * ui/skeleton.ts — Skeleton.
 *
 * Ported from shadcn/ui `new-york-v4/ui/skeleton.tsx` (MIT —
 * https://github.com/shadcn-ui/ui) as a Nisli component. A pulsing placeholder for content that is loading.
 *
 * Usable as a typed factory (`Skeleton({ className: 'h-4 w-32' })`) or as a
 * plain custom element (`<ui-skeleton class-name="h-4 w-32"></ui-skeleton>`).
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

export const skeletonClasses = 'animate-pulse rounded-md bg-accent';

export type SkeletonProps = {
  /** Merged last into the inner <div>'s class list via cn(). */
  className?: string;
  children?: string | TemplateResult;
};

export const Skeleton = component<SkeletonProps>('ui-skeleton', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn(skeletonClasses, className.value));

  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<div
    ref="${root}"
    data-slot="skeleton"
    class="${classes}"
  >${props.children}</div>`;
});
