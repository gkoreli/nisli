/**
 * ui/spinner.ts — Spinner.
 *
 * Ported from shadcn/ui `new-york-v4/ui/spinner.tsx` (MIT —
 * https://github.com/shadcn-ui/ui) as a Nisli component. The lucide
 * Loader2Icon is inlined so copied source has zero runtime dependencies.
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

export const spinnerClasses = 'size-4 animate-spin';

export type SpinnerProps = {
  role?: string;
  ariaLabel?: string;
  /** Merged last into the inner <svg>'s class list via cn(). */
  className?: string;
  children?: string | TemplateResult;
};

export const Spinner = component<SpinnerProps>('ui-spinner', (props, host) => {
  transparentHost(host);

  const role = props.role;
  const ariaLabel = props.ariaLabel;
  const className = props.className;
  const classes = computed(() => cn(spinnerClasses, className.value));

  return html`<svg
    data-slot="spinner"
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="${computed(() => role.value ?? 'status')}"
    aria-label="${computed(() => ariaLabel.value ?? 'Loading')}"
    class="${classes}"
  ><path d="M21 12a9 9 0 1 1-6.219-8.56"></path>${children()}</svg>`;
}, {
  attrs: {
    role: 'string',
    ariaLabel: 'string',
    className: 'string',
  },
});
