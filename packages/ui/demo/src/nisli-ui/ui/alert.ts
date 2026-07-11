/**
 * ui/alert.ts — Alert, AlertTitle, AlertDescription.
 *
 * Port of shadcn/ui `alert` (MIT — https://github.com/shadcn-ui/ui)
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

export const alertVariants = cv(
  'relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive:
          'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
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
  const projected = captureChildren(host);

  const variant = attr(props.variant, host, 'variant');
  const className = attr(props.className, host, 'class-name');

  const classes = computed(() =>
    cn(alertVariants({ variant: variant.value }), className.value),
  );

  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<div
    ref="${root}"
    data-slot="alert"
    role="alert"
    class="${classes}"
  >${props.children}</div>`;
});

export type AlertTitleProps = {
  /** Merged last into the inner <h5>'s class list via cn(). */
  className?: string;
  children?: string | TemplateResult;
};

export const AlertTitle = component<AlertTitleProps>('ui-alert-title', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() =>
    cn('mb-1 font-medium leading-none tracking-tight', className.value),
  );

  const root = ref<HTMLHeadingElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<h5
    ref="${root}"
    data-slot="alert-title"
    class="${classes}"
  >${props.children}</h5>`;
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
    const projected = captureChildren(host);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn('text-sm [&_p]:leading-relaxed', className.value),
    );

    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<div
      ref="${root}"
      data-slot="alert-description"
      class="${classes}"
    >${props.children}</div>`;
  },
);
