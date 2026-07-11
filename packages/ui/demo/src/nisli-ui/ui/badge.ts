/**
 * ui/badge.ts — Badge.
 *
 * Port of shadcn/ui `badge` (MIT — https://github.com/shadcn-ui/ui)
 * as a Nisli component. Usable as a typed factory (`Badge({...})`)
 * or as a plain custom element (`<ui-badge variant="secondary">`).
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

export const badgeVariants = cv(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export type BadgeProps = {
  variant?: BadgeVariant;
  /** Merged last into the inner <span>'s class list via cn(). */
  className?: string;
  children?: string | TemplateResult;
};

export const Badge = component<BadgeProps>('ui-badge', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);

  const variant = attr(props.variant, host, 'variant');
  const className = attr(props.className, host, 'class-name');

  const classes = computed(() =>
    cn(badgeVariants({ variant: variant.value }), className.value),
  );

  const root = ref<HTMLSpanElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<span
    ref="${root}"
    data-slot="badge"
    class="${classes}"
  >${props.children}</span>`;
});
