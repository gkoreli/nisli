/**
 * ui/progress.ts — Progress.
 *
 * Ported from new-york-v4/ui/progress.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui)
 * and the Radix Progress behavior it wraps (MIT), as a Nisli component. A
 * determinate progress bar: the track holds an indicator translated on the X
 * axis by `-(100 - value)%` (shadcn treats `value` as a 0–100 percentage).
 *
 * Renders the Radix ARIA contract on a real element: `role="progressbar"`
 * with `aria-valuemin=0`, `aria-valuemax`, and `aria-valuenow` (omitted when
 * indeterminate), plus `data-state`/`data-value`/`data-max`. `value` is
 * signal-able and updates the indicator reactively.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import { component, computed, html } from '@nisli/core';
import { attr, cn, transparentHost } from '../lib/utils.js';

export const progressClasses =
  'relative h-2 w-full overflow-hidden rounded-full bg-primary/20';

export const progressIndicatorClasses = 'h-full w-full flex-1 bg-primary transition-all';

export type ProgressProps = {
  /** Progress as a 0–100 percentage; omit/undefined for indeterminate. */
  value?: number;
  /** Maximum value for aria-valuemax (default 100). */
  max?: number;
  className?: string;
};

export const Progress = component<ProgressProps>('ui-progress', (props, host) => {
  transparentHost(host);

  const valueFallback = host.hasAttribute('value')
    ? Number(host.getAttribute('value'))
    : undefined;
  const value = computed(() => props.value.value ?? valueFallback);

  const maxFallback = host.hasAttribute('max') ? Number(host.getAttribute('max')) : 100;
  const max = computed(() => props.max.value ?? maxFallback);

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn(progressClasses, className.value));

  const state = computed(() => {
    const v = value.value;
    if (v == null) return 'indeterminate';
    return v >= max.value ? 'complete' : 'loading';
  });
  const indicatorStyle = computed(
    () => `transform: translateX(-${100 - (value.value ?? 0)}%)`,
  );

  return html`<div
    data-slot="progress"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="${max}"
    aria-valuenow="${value}"
    data-state="${state}"
    data-value="${value}"
    data-max="${max}"
    class="${classes}"
  ><div
      data-slot="progress-indicator"
      class="${progressIndicatorClasses}"
      style="${indicatorStyle}"
    ></div></div>`;
});
