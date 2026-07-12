/**
 * ui/separator.ts — Separator.
 *
 * Ported from shadcn/ui `new-york-v4/ui/separator.tsx` (MIT —
 * https://github.com/shadcn-ui/ui), which wraps Radix Separator, as a Nisli
 * component.
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
import { cn, transparentHost } from '../lib/utils.js';

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

  const orientation = computed<SeparatorOrientation>(
    () => props.orientation.value ?? 'horizontal',
  );

  // decorative defaults to true; plain-HTML consumers opt into a semantic
  // separator with `decorative="false"`. An explicit prop always wins.
  const decorative = computed<boolean>(() => props.decorative.value as boolean);

  const role = computed(() => (decorative.value ? 'none' : 'separator'));
  const ariaOrientation = computed(() =>
    !decorative.value && orientation.value === 'vertical' ? 'vertical' : undefined,
  );

  // Sizing is driven by the data-orientation attribute, as upstream.
  const classes = computed(() =>
    cn(
      'shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
      props.className.value,
    ),
  );

  return html`<div
    data-slot="separator"
    data-orientation="${orientation}"
    role="${role}"
    aria-orientation="${ariaOrientation}"
    class="${classes}"
  ></div>`;
}, { attrs: { orientation: 'string', decorative: { type: 'boolean', default: true }, className: 'string' } });
