/**
 * ui/alert.ts — Alert, AlertTitle, AlertDescription.
 *
 * Ported from shadcn/ui `new-york-v4/ui/alert.tsx` (MIT —
 * https://github.com/shadcn-ui/ui)
 * as Nisli components. Displays a callout for user attention.
 *
 * Usable as typed factories (`Alert({ variant: 'destructive', children: ... })`)
 * or as plain custom elements:
 *
 * ```html
 * <ui-alert variant="destructive">
 *   <ui-alert-title>Error</ui-alert-title>
 *   <ui-alert-description>Something went wrong.</ui-alert-description>
 * </ui-alert>
 * ```
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

export const alertVariants = cv(
  'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive:
          'bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type AlertVariant = 'default' | 'destructive';

export type AlertProps = {
  variant?: AlertVariant;
  /** Merged last into the inner root's class list via cn(). */
  className?: string;
  children?: string | TemplateResult;
};

export const Alert = component<AlertProps>('ui-alert', (props, host) => {
  transparentHost(host);

  const variant = props.variant;
  const className = props.className;

  const classes = computed(() =>
    cn(alertVariants({ variant: variant.value }), className.value),
  );

  return html`<div
    data-slot="alert"
    role="alert"
    class="${classes}"
  >${children()}</div>`;
}, {
  attrs: {
    variant: 'string',
    className: 'string',
  },
});

export type AlertTitleProps = {
  /** Merged last into the inner <div>'s class list via cn(). */
  className?: string;
  children?: string | TemplateResult;
};

export const AlertTitle = component<AlertTitleProps>('ui-alert-title', (props, host) => {
  transparentHost(host);

  const className = props.className;
  const classes = computed(() =>
    cn('col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight', className.value),
  );

  return html`<div
    data-slot="alert-title"
    class="${classes}"
  >${children()}</div>`;
}, {
  attrs: {
    className: 'string',
  },
});

export type AlertDescriptionProps = {
  /** Merged last into the inner <div>'s class list via cn(). */
  className?: string;
  children?: string | TemplateResult;
};

export const AlertDescription = component<AlertDescriptionProps>(
  'ui-alert-description',
  (props, host) => {
    transparentHost(host);

    const className = props.className;
    const classes = computed(() =>
      cn('col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed', className.value),
    );

    return html`<div
      data-slot="alert-description"
      class="${classes}"
    >${children()}</div>`;
  },
  {
    attrs: {
      className: 'string',
    },
  },
);
