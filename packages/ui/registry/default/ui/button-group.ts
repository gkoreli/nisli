/**
 * ui/button-group.ts — ButtonGroup, ButtonGroupText, ButtonGroupSeparator.
 *
 * Ported from shadcn/ui `new-york-v4/ui/button-group.tsx` (MIT —
 * https://github.com/shadcn-ui/ui) as Nisli components. The React-only
 * `asChild`/Radix Slot escape hatch is omitted; Nisli composes custom elements
 * through typed factories instead. Separator markup is inlined from the
 * registry component so this source remains standards-consumable.
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
import type { SeparatorOrientation } from './separator.js';
import { cn, cv, transparentHost } from '../lib/utils.js';

export const buttonGroupVariants = cv(
  "flex w-fit items-stretch has-[>[data-slot=button-group]]:gap-2 [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
  {
    variants: {
      orientation: {
        horizontal:
          '[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none',
        vertical:
          'flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none',
      },
    },
    defaultVariants: { orientation: 'horizontal' },
  },
);

export type ButtonGroupOrientation = 'horizontal' | 'vertical';

export type ButtonGroupProps = {
  orientation?: ButtonGroupOrientation;
  className?: string;
  children?: string | TemplateResult;
};

export const ButtonGroup = component<ButtonGroupProps>('ui-button-group', (props, host) => {
  transparentHost(host);
  const classes = computed(() =>
    cn(buttonGroupVariants({ orientation: props.orientation.value }), props.className.value),
  );
  return html`<div
    role="group"
    data-slot="button-group"
    data-orientation="${props.orientation}"
    class="${classes}"
  >${children()}</div>`;
}, {
  attrs: {
    orientation: 'string',
    className: 'string',
  },
});

export const buttonGroupTextClasses =
  "flex items-center gap-2 rounded-md border bg-muted px-4 text-sm font-medium shadow-xs [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4";

export type ButtonGroupTextProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const ButtonGroupText = component<ButtonGroupTextProps>(
  'ui-button-group-text',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() => cn(buttonGroupTextClasses, props.className.value));
    return html`<div
      data-slot="button-group-text"
      class="${classes}"
    >${children()}</div>`;
  },
  {
    attrs: {
      className: 'string',
    },
  },
);

const separatorClasses =
  'shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px';
export const buttonGroupSeparatorClasses =
  'relative m-0! self-stretch bg-input data-[orientation=vertical]:h-auto';

export type ButtonGroupSeparatorProps = {
  orientation?: SeparatorOrientation;
  className?: string;
};

export const ButtonGroupSeparator = component<ButtonGroupSeparatorProps>(
  'ui-button-group-separator',
  (props, host) => {
    transparentHost(host);
    const orientation = computed<SeparatorOrientation>(
      () => props.orientation.value ?? 'vertical',
    );
    const classes = computed(() =>
      cn(separatorClasses, buttonGroupSeparatorClasses, props.className.value),
    );
    return html`<div
      data-slot="button-group-separator"
      data-orientation="${orientation}"
      role="none"
      class="${classes}"
    ></div>`;
  },
  {
    attrs: {
      orientation: 'string',
      className: 'string',
    },
  },
);
