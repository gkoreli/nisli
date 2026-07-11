/**
 * ui/separator.ts — Separator.
 *
 * Port of shadcn/ui `separator` (MIT — https://github.com/shadcn-ui/ui),
 * which wraps Radix `@radix-ui/react-separator`, as a Nisli component.
 * Visually or semantically separates content.
 *
 * ARIA follows Radix: a decorative separator (the default) is `role="none"`
 * with no `aria-orientation`; a semantic one is `role="separator"` and only
 * carries `aria-orientation` when vertical (horizontal is the ARIA default).
 *
 * Usable as a typed factory (`Separator({ orientation: 'vertical' })`) or as
 * a plain custom element (`<ui-separator orientation="vertical">`).
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import { component, computed, html } from '@nisli/core';
import { attr, boolAttr, cn, transparentHost } from '../lib/utils.js';

export type SeparatorOrientation = 'horizontal' | 'vertical';

export type SeparatorProps = {
  orientation?: SeparatorOrientation;
  /** Decorative separators are hidden from assistive tech. Defaults to true. */
  decorative?: boolean;
  /** Merged last into the inner <div>'s class list via cn(). */
  className?: string;
};

export const Separator = component<SeparatorProps>('ui-separator', (props, host) => {
  transparentHost(host);

  const orientationAttr = attr(props.orientation, host, 'orientation');
  const orientation = computed<SeparatorOrientation>(
    () => orientationAttr.value ?? 'horizontal',
  );

  const className = attr(props.className, host, 'class-name');

  // decorative defaults to true; plain-HTML consumers opt into a semantic
  // separator with `decorative="false"`. An explicit prop always wins.
  const decorative = boolAttr(props.decorative, host, 'decorative', true);

  const role = computed(() => (decorative.value ? 'none' : 'separator'));
  const ariaOrientation = computed(() =>
    !decorative.value && orientation.value === 'vertical' ? 'vertical' : undefined,
  );

  const classes = computed(() =>
    cn(
      'shrink-0 bg-border',
      orientation.value === 'vertical' ? 'h-full w-[1px]' : 'h-[1px] w-full',
      className.value,
    ),
  );

  return html`<div
    data-slot="separator"
    data-orientation="${orientation}"
    role="${role}"
    aria-orientation="${ariaOrientation}"
    class="${classes}"
  ></div>`;
});
