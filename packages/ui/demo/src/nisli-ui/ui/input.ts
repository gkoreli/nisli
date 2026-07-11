/**
 * ui/input.ts — Input.
 *
 * Port of shadcn/ui `input` (MIT — https://github.com/shadcn-ui/ui)
 * as a Nisli component. Renders a REAL native `<input>` in the light DOM,
 * so native form participation is the differentiator over shadcn/Radix:
 * `form.elements`, `form.reset()`, constraint validation, and label
 * association all work natively (ADR 0022 §5).
 *
 * - `id`/`name` are forwarded onto the inner `<input>` (moved off the host)
 *   so `form.elements.namedItem()` and `<ui-label for>` resolve to it.
 * - `value` is one-way: the attribute is the initial value and reset target,
 *   later signal updates set the property. Native `input`/`change` events
 *   bubble out; there is no synthetic event layer or two-way binding.
 *
 * Usable as a typed factory (`Input({ type: 'email', name: 'email' })`) or as
 * a plain custom element (`<ui-input type="email" name="email">`).
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
} from '@nisli/core';
import {
  attr,
  boolAttr,
  cn,
  forwardedAttr,
  transparentHost,
} from '../lib/utils.js';

export const inputClasses =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export type InputProps = {
  type?: string;
  placeholder?: string;
  autocomplete?: string;
  /** Initial value + form.reset() target; later updates set the property. */
  value?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
  /** Merged last into the inner <input>'s class list via cn(). */
  className?: string;
};

export const Input = component<InputProps>('ui-input', (props, host) => {
  transparentHost(host);

  const type = attr(props.type, host, 'type');
  const placeholder = attr(props.placeholder, host, 'placeholder');
  const autocomplete = attr(props.autocomplete, host, 'autocomplete');
  const value = attr(props.value, host, 'value');
  // id/name belong on the real control, not the transparent host.
  const id = forwardedAttr(props.id, host, 'id');
  const name = forwardedAttr(props.name, host, 'name');
  const disabled = boolAttr(props.disabled, host, 'disabled');
  const required = boolAttr(props.required, host, 'required');
  const readOnly = boolAttr(props.readOnly, host, 'readonly');
  const className = attr(props.className, host, 'class-name');

  const classes = computed(() => cn(inputClasses, className.value));

  const root = ref<HTMLInputElement>();

  // Programmatic value updates → the property (leaves the reset target alone).
  // First run is at setup (root null) and no-ops; it re-runs post-mount when
  // the value signal changes, by which point the input exists.
  effect(() => {
    const v = value.value;
    const input = root.current;
    if (input && v != null && input.value !== v) input.value = v;
  });

  onMount(() => {
    const input = root.current;
    if (!input) return;
    const initial = value.value;
    if (initial != null) {
      input.setAttribute('value', initial); // native defaultValue / reset target
      input.value = initial;
    }
  });

  return html`<input
    ref="${root}"
    data-slot="input"
    class="${classes}"
    type="${computed(() => type.value ?? 'text')}"
    id="${id}"
    name="${name}"
    placeholder="${placeholder}"
    autocomplete="${autocomplete}"
    disabled="${disabled}"
    required="${required}"
    readonly="${readOnly}"
  />`;
});
