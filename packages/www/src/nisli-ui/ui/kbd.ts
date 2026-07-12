/**
 * ui/kbd.ts — Kbd, KbdGroup.
 *
 * Ported from shadcn/ui `new-york-v4/ui/kbd.tsx` (MIT —
 * https://github.com/shadcn-ui/ui) as Nisli components. Usable as typed
 * factories (`Kbd({ children: '⌘' })`) or as plain custom elements
 * (`<ui-kbd>⌘</ui-kbd>`).
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
import { cn, transparentHost } from '../lib/utils.js';

export const kbdClasses =
  "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none [&_svg:not([class*='size-'])]:size-3 [[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10";

export const kbdGroupClasses = 'inline-flex items-center gap-1';

export type KbdProps = {
  /** Merged last into the inner <kbd>'s class list via cn(). */
  className?: string;
  children?: string | TemplateResult;
};

export const Kbd = component<KbdProps>('ui-kbd', (props, host) => {
  transparentHost(host);

  const className = props.className;
  const classes = computed(() => cn(kbdClasses, className.value));

  return html`<kbd
    data-slot="kbd"
    class="${classes}"
  >${children()}</kbd>`;
}, {
  attrs: {
    className: 'string',
  },
});

export type KbdGroupProps = {
  /** Merged last into the inner <kbd>'s class list via cn(). */
  className?: string;
  children?: string | TemplateResult;
};

export const KbdGroup = component<KbdGroupProps>('ui-kbd-group', (props, host) => {
  transparentHost(host);

  const className = props.className;
  const classes = computed(() => cn(kbdGroupClasses, className.value));

  return html`<kbd
    data-slot="kbd-group"
    class="${classes}"
  >${children()}</kbd>`;
}, {
  attrs: {
    className: 'string',
  },
});
