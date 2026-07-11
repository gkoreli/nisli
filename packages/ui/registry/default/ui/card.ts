/**
 * ui/card.ts — Card, CardHeader, CardTitle, CardDescription, CardContent,
 * CardFooter.
 *
 * Port of shadcn/ui `card` (MIT — https://github.com/shadcn-ui/ui)
 * as Nisli components. A container with header/title/description/content/
 * footer regions.
 *
 * Usable as typed factories (`Card({ children: ... })`) or as plain custom
 * elements:
 *
 * ```html
 * <ui-card>
 *   <ui-card-header>
 *     <ui-card-title>Title</ui-card-title>
 *     <ui-card-description>Description</ui-card-description>
 *   </ui-card-header>
 *   <ui-card-content>Body</ui-card-content>
 *   <ui-card-footer>Footer</ui-card-footer>
 * </ui-card>
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
  projectChildren,
  transparentHost,
} from '../lib/utils.js';

/** Every card region shares the same shape: className merge + children. */
export type CardSectionProps = {
  /** Merged last into the inner <div>'s class list via cn(). */
  className?: string;
  children?: string | TemplateResult;
};

/**
 * Build a single-root card region: a `<div>` carrying `data-slot`, the ported
 * base classes, host `class-name` fallback, and light-DOM children projection.
 */
function cardSection(tag: string, slot: string, base: string) {
  return component<CardSectionProps>(tag, (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(base, className.value));

    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<div
      ref="${root}"
      data-slot="${slot}"
      class="${classes}"
    >${props.children}</div>`;
  });
}

export const Card = cardSection(
  'ui-card',
  'card',
  'rounded-xl border bg-card text-card-foreground shadow',
);

export const CardHeader = cardSection(
  'ui-card-header',
  'card-header',
  'flex flex-col space-y-1.5 p-6',
);

export const CardTitle = cardSection(
  'ui-card-title',
  'card-title',
  'font-semibold leading-none tracking-tight',
);

export const CardDescription = cardSection(
  'ui-card-description',
  'card-description',
  'text-sm text-muted-foreground',
);

export const CardContent = cardSection('ui-card-content', 'card-content', 'p-6 pt-0');

export const CardFooter = cardSection(
  'ui-card-footer',
  'card-footer',
  'flex items-center p-6 pt-0',
);
