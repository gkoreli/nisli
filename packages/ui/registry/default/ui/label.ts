/**
 * ui/label.ts — Label.
 *
 * Ported from shadcn/ui `new-york-v4/ui/label.tsx` (MIT —
 * https://github.com/shadcn-ui/ui), which wraps Radix Label, as a Nisli
 * component.
 * Renders a real light-DOM `<label>`, so native `for`/`id` association
 * and click-to-focus work with no extra machinery.
 *
 * Usable as a typed factory (`Label({ htmlFor: 'email', children: 'Email' })`)
 * or as a plain custom element (`<ui-label for="email">Email</ui-label>`).
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

export const labelVariants =
  'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50';

export type LabelProps = {
  /** The id of the form control this label is bound to (renders `for`). */
  htmlFor?: string;
  /** Merged last into the inner <label>'s class list via cn(). */
  className?: string;
  children?: string | TemplateResult;
};

export const Label = component<LabelProps>('ui-label', (props, host) => {
  transparentHost(host);

  const className = props.className;

  const classes = computed(() => cn(labelVariants, className.value));

  // ADR 0025 item 1: children() owns projection. ADR 0025 item 3: attribute
  // fallbacks are declared via the `attrs` option below and delivered as live
  // prop signals. `htmlFor` maps to the native `for` attribute via the v1.1
  // name override ({ type: 'string', attr: 'for' }) — the auto-kebab default
  // would be `html-for`, but native label association requires `for`.
  return html`<label
    data-slot="label"
    class="${classes}"
    for="${props.htmlFor}"
  >${children()}</label>`;
}, {
  attrs: {
    htmlFor: { type: 'string', attr: 'for' },
    className: 'string',
  },
});
