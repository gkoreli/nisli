/**
 * ui/marker.ts — Marker and its parts.
 *
 * Ported from shadcn/ui `new-york-v4/ui/marker.tsx` (MIT —
 * https://github.com/shadcn-ui/ui) as Nisli custom elements. Class strings,
 * variants, and data-slots match the source. The Radix `asChild` escape hatch
 * is omitted; Nisli composes typed custom-element factories instead.
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
  cv,
  projectChildren,
  transparentHost,
} from '../lib/utils.js';

export const markerVariants = cv(
  "group/marker relative flex min-h-4 w-full items-center gap-2 text-left text-sm text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [a]:underline [a]:underline-offset-3 [a]:hover:text-foreground",
  {
    variants: {
      variant: {
        default: '',
        separator:
          'before:mr-1 before:h-px before:min-w-0 before:flex-1 before:bg-border after:ml-1 after:h-px after:min-w-0 after:flex-1 after:bg-border',
        border: 'border-b border-border pb-2',
      },
    },
  },
);

export type MarkerVariant = 'default' | 'separator' | 'border';

export type MarkerProps = {
  variant?: MarkerVariant;
  className?: string;
  children?: string | TemplateResult;
};

export const Marker = component<MarkerProps>('ui-marker', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);
  const variant = attr(props.variant, host, 'variant');
  const className = attr(props.className, host, 'class-name');
  const classes = computed(() =>
    cn(markerVariants({ variant: variant.value ?? 'default' }), className.value),
  );
  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });
  return html`<div
    ref="${root}"
    data-slot="marker"
    data-variant="${computed(() => variant.value ?? 'default')}"
    class="${classes}"
  >${props.children}</div>`;
});

export type MarkerPartProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const MarkerIcon = component<MarkerPartProps>('ui-marker-icon', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);
  const className = attr(props.className, host, 'class-name');
  const classes = computed(() =>
    cn("size-4 shrink-0 [&_svg:not([class*='size-'])]:size-4", className.value),
  );
  const root = ref<HTMLSpanElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });
  return html`<span
    ref="${root}"
    data-slot="marker-icon"
    aria-hidden="true"
    class="${classes}"
  >${props.children}</span>`;
});

export const MarkerContent = component<MarkerPartProps>(
  'ui-marker-content',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        'min-w-0 wrap-break-word group-data-[variant=separator]/marker:flex-none group-data-[variant=separator]/marker:text-center *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
        className.value,
      ),
    );
    const root = ref<HTMLSpanElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<span
      ref="${root}"
      data-slot="marker-content"
      class="${classes}"
    >${props.children}</span>`;
  },
);
