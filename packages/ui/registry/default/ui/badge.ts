/**
 * ui/badge.ts — Badge.
 *
 * Ported from shadcn/ui `new-york-v4/ui/badge.tsx` (MIT —
 * https://github.com/shadcn-ui/ui) as a Nisli component. Usable as a typed factory (`Badge({...})`)
 * or as a plain custom element (`<ui-badge variant="secondary">`).
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

export const badgeVariants = cv(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
        secondary:
          'bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
        destructive:
          'bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90',
        outline:
          'border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
        ghost: '[a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 [a&]:hover:underline',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'ghost'
  | 'link';

export type BadgeProps = {
  variant?: BadgeVariant;
  /** Merged last into the inner <span>'s class list via cn(). */
  className?: string;
  children?: string | TemplateResult;
};

export const Badge = component<BadgeProps>('ui-badge', (props, host) => {
  transparentHost(host);

  const classes = computed(() =>
    cn(badgeVariants({ variant: props.variant.value }), props.className.value),
  );

  // ADR 0025 item 1: children() owns projection — light-DOM children AND the
  // factory `children` prop route through the one slot. The
  // captureChildren/projectChildren + onMount dance is gone.
  return html`<span
    data-slot="badge"
    data-variant="${computed(() => props.variant.value ?? 'default')}"
    class="${classes}"
  >${children()}</span>`;
}, {
  // ADR 0025 item 3: opt-in attribute reactivity. Kebab-case attr names
  // (className → class-name); values delivered as live prop signals.
  attrs: {
    variant: 'string',
    className: 'string',
  },
});
