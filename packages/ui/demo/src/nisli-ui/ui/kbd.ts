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
  const projected = captureChildren(host);

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn(kbdClasses, className.value));

  const root = ref<HTMLElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<kbd
    ref="${root}"
    data-slot="kbd"
    class="${classes}"
  >${props.children}</kbd>`;
});

export type KbdGroupProps = {
  /** Merged last into the inner <kbd>'s class list via cn(). */
  className?: string;
  children?: string | TemplateResult;
};

export const KbdGroup = component<KbdGroupProps>('ui-kbd-group', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn(kbdGroupClasses, className.value));

  const root = ref<HTMLElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<kbd
    ref="${root}"
    data-slot="kbd-group"
    class="${classes}"
  >${props.children}</kbd>`;
});
