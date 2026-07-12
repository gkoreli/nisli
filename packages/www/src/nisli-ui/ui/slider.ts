/**
 * ui/slider.ts — Slider.
 *
 * Ported from new-york-v4/ui/slider.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui).
 * ARCHITECTURE (ADR 0022, native-first): where shadcn wraps Radix's div-based
 * slider, we render a REAL native `<input type="range">` in the light DOM, so
 * keyboard, drag, and form participation come from the platform. The v4 visual
 * (muted track, primary fill, bordered thumb) is reproduced with Tailwind
 * pseudo-element variants (`[&::-webkit-slider-thumb]:…`,
 * `[&::-moz-range-thumb]:…`) plus a `--slider-fill` custom property the track
 * gradient reads — no JavaScript draws the control.
 *
 * `value`/`defaultValue` mirror the native attribute/property split (the
 * attribute is the initial value and `form.reset()` target); `min`/`max`/
 * `step` and `id`/`name` are forwarded; native `input`/`change` bubble.
 *
 * SINGLE THUMB in v1. Radix's multi-thumb range (two values) has no native
 * `<input type="range">" equivalent and is deferred — reach for two sliders,
 * or wait for a future dual-range component.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  component,
  type ComponentAttrs,
  computed,
  effect,
  html,
  onMount,
  ref,
  signal,
} from '@nisli/core';
import { cn, transparentHost } from '../lib/utils.js';

export const sliderClasses =
  'w-full cursor-pointer appearance-none bg-transparent select-none disabled:pointer-events-none disabled:opacity-50 ' +
  // Track (WebKit): muted base with a primary fill up to --slider-fill.
  "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-primary)_var(--slider-fill),var(--color-muted)_var(--slider-fill))] " +
  // Track (Firefox): muted track + native progress fill.
  '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-muted [&::-moz-range-progress]:h-1.5 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-primary ' +
  // Thumb (WebKit): centered on the 1.5-high track (-(16-6)/2 = -5px).
  '[&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-[color,box-shadow] hover:[&::-webkit-slider-thumb]:ring-4 hover:[&::-webkit-slider-thumb]:ring-ring/50 focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-ring/50 ' +
  // Thumb (Firefox).
  '[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-background [&::-moz-range-thumb]:shadow-sm ' +
  'focus-visible:outline-hidden';

export type SliderProps = {
  /** Controlled value; later signal updates set the property. */
  value?: number;
  /** Initial value + form.reset() target. */
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
};

// ADR 0025 item 3 (+ v1.1 'number' kind). Kebab-case attr names
// (className → class-name, defaultValue → default-value). 'forward' relocates
// id/name off the transparent host onto the inner control. Passed as
// component()'s second type argument (`typeof sliderAttrs`) so declared
// `disabled` narrows to `boolean` (ADR 0025 candidate (b)) — no `as boolean`.
const sliderAttrs = {
  value: 'number',
  defaultValue: 'number',
  min: 'number',
  max: 'number',
  step: 'number',
  className: 'string',
  id: 'forward',
  name: 'forward',
  disabled: 'boolean',
} satisfies ComponentAttrs<SliderProps>;

export const Slider = component<SliderProps, typeof sliderAttrs>('ui-slider', (props, host) => {
  transparentHost(host);

  // ADR 0025 item 3 (+ v1.1 'number' kind): attribute fallbacks declared via the
  // `attrs` option below and delivered as plain, LIVE prop signals — no userland
  // attr()/boolAttr()/forwardedAttr() at setup. min/max/step use the 'number'
  // kind; the `?? fallback` also covers a non-numeric attribute (→ undefined).
  // value/default-value are optional numbers (undefined when unset). 'forward'
  // relocates id/name off the transparent host onto the inner control.
  const min = props.min.value ?? 0;
  const max = props.max.value ?? 100;
  const step = props.step.value ?? 1;
  const value = props.value;
  const defaultValue = props.defaultValue;
  const id = props.id;
  const name = props.name;
  const disabled = computed<boolean>(() => props.disabled.value);
  const className = props.className;

  const classes = computed(() => cn(sliderClasses, className.value));

  const root = ref<HTMLInputElement>();
  const fill = signal('0%');
  const percentOf = (v: number): string => {
    const span = max - min || 1;
    const pct = Math.min(100, Math.max(0, ((v - min) / span) * 100));
    return `${pct}%`;
  };
  const syncFill = (): void => {
    if (root.current) fill.value = percentOf(Number(root.current.value));
  };

  // Controlled value updates → the property (leaves the reset target alone).
  effect(() => {
    const v = value.value;
    const input = root.current;
    if (input && v != null && input.value !== String(v)) {
      input.value = String(v);
      syncFill();
    }
  });

  onMount(() => {
    const input = root.current;
    if (!input) return;
    const initial = value.value ?? defaultValue.value;
    if (initial != null) {
      input.setAttribute('value', String(initial)); // native reset target
      input.value = String(initial);
    }
    syncFill();
  });

  const style = computed(() => `--slider-fill: ${fill.value}`);

  return html`<input
    ref="${root}"
    type="range"
    data-slot="slider"
    class="${classes}"
    style="${style}"
    min="${String(min)}"
    max="${String(max)}"
    step="${String(step)}"
    id="${id}"
    name="${name}"
    disabled="${disabled}"
    @input=${syncFill}
  />`;
}, { attrs: sliderAttrs });
