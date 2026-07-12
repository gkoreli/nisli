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
  children,
  component,
  computed,
  html,
  type TemplateResult,
} from '@nisli/core';
import { cn, cv, transparentHost } from '../lib/utils.js';

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
  const classes = computed(() =>
    cn(markerVariants({ variant: props.variant.value ?? 'default' }), props.className.value),
  );
  return html`<div
    data-slot="marker"
    data-variant="${computed(() => props.variant.value ?? 'default')}"
    class="${classes}"
  >${children()}</div>`;
}, {
  attrs: {
    variant: 'string',
    className: 'string',
  },
});

export type MarkerPartProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const MarkerIcon = component<MarkerPartProps>('ui-marker-icon', (props, host) => {
  transparentHost(host);
  const classes = computed(() =>
    cn("size-4 shrink-0 [&_svg:not([class*='size-'])]:size-4", props.className.value),
  );
  return html`<span
    data-slot="marker-icon"
    aria-hidden="true"
    class="${classes}"
  >${children()}</span>`;
}, {
  attrs: {
    className: 'string',
  },
});

export const MarkerContent = component<MarkerPartProps>(
  'ui-marker-content',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() =>
      cn(
        'min-w-0 wrap-break-word group-data-[variant=separator]/marker:flex-none group-data-[variant=separator]/marker:text-center *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
        props.className.value,
      ),
    );
    return html`<span
      data-slot="marker-content"
      class="${classes}"
    >${children()}</span>`;
  },
  {
    attrs: {
      className: 'string',
    },
  },
);
