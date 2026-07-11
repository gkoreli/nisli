/**
 * ui/button.ts — Button.
 *
 * Port of shadcn/ui `button` (MIT — https://github.com/shadcn-ui/ui)
 * as a Nisli component. Usable as a typed factory (`Button({...})`)
 * or as a plain custom element (`<ui-button variant="outline">`).
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
  boolAttr,
  captureChildren,
  cn,
  cv,
  projectChildren,
  transparentHost,
} from '../lib/utils.js';

export const buttonVariants = cv(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link';

export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  /** Merged last into the inner <button>'s class list via cn(). */
  className?: string;
  children?: string | TemplateResult;
};

export const Button = component<ButtonProps>('ui-button', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);

  const variant = attr(props.variant, host, 'variant');
  const size = attr(props.size, host, 'size');
  const type = attr(props.type, host, 'type');
  const className = attr(props.className, host, 'class-name');
  const disabled = boolAttr(props.disabled, host, 'disabled');

  const classes = computed(() =>
    cn(buttonVariants({ variant: variant.value, size: size.value }), className.value),
  );

  const root = ref<HTMLButtonElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<button
    ref="${root}"
    data-slot="button"
    class="${classes}"
    type="${computed(() => type.value ?? 'button')}"
    disabled="${disabled}"
  >${props.children}</button>`;
});
