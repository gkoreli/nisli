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
  computed,
  effect,
  html,
  onMount,
  ref,
  signal,
} from '@nisli/core';
import {
  attr,
  boolAttr,
  cn,
  forwardedAttr,
  transparentHost,
} from '../lib/utils.js';

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

export const Slider = component<SliderProps>('ui-slider', (props, host) => {
  transparentHost(host);

  const numAttr = (name: string, fallback: number): number => {
    const raw = host.getAttribute(name);
    return raw == null ? fallback : Number(raw);
  };
  const min = props.min.value ?? numAttr('min', 0);
  const max = props.max.value ?? numAttr('max', 100);
  const step = props.step.value ?? numAttr('step', 1);

  const valueFallback = host.hasAttribute('value')
    ? Number(host.getAttribute('value'))
    : undefined;
  const value = computed(() => props.value.value ?? valueFallback);
  const defaultFallback = host.hasAttribute('default-value')
    ? Number(host.getAttribute('default-value'))
    : undefined;
  const defaultValue = computed(() => props.defaultValue.value ?? defaultFallback);
  const id = forwardedAttr(props.id, host, 'id');
  const name = forwardedAttr(props.name, host, 'name');
  const disabled = boolAttr(props.disabled, host, 'disabled');
  const className = attr(props.className, host, 'class-name');

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
});
