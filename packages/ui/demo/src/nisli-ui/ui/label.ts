/**
 * ui/label.ts — Label.
 *
 * Port of shadcn/ui `label` (MIT — https://github.com/shadcn-ui/ui),
 * which wraps Radix `@radix-ui/react-label`, as a Nisli component.
 * Renders a real light-DOM `<label>`, so native `for`/`id` association
 * and click-to-focus work with no extra machinery.
 *
 * Usable as a typed factory (`Label({ htmlFor: 'email', children: 'Email' })`)
 * or as a plain custom element (`<ui-label for="email">Email</ui-label>`).
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

export const labelVariants =
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70';

export type LabelProps = {
  /** The id of the form control this label is bound to (renders `for`). */
  htmlFor?: string;
  /** Merged last into the inner <label>'s class list via cn(). */
  className?: string;
  children?: string | TemplateResult;
};

export const Label = component<LabelProps>('ui-label', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);

  const htmlFor = attr(props.htmlFor, host, 'for');
  const className = attr(props.className, host, 'class-name');

  const classes = computed(() => cn(labelVariants, className.value));

  const root = ref<HTMLLabelElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<label
    ref="${root}"
    data-slot="label"
    class="${classes}"
    for="${htmlFor}"
  >${props.children}</label>`;
});
