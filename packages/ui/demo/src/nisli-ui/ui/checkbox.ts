/**
 * ui/checkbox.ts — Checkbox.
 *
 * Port of shadcn/ui `checkbox` (MIT — https://github.com/shadcn-ui/ui) as a
 * Nisli component. Renders a REAL native `<input type="checkbox">` in the
 * light DOM for native form participation (ADR 0022 §5): `form.elements`,
 * `form.reset()`, label association, and free spacebar toggling all work
 * natively. Keyboard and a11y come from the platform — no role shims.
 *
 * The visual is pure CSS: `appearance-none` strips the native box and the
 * shadcn styling is drawn with Tailwind `checked:`/`disabled:` variants. The
 * check mark is a `background-image` data-URI SVG (not a `::before` glyph —
 * pseudo-elements do not render on replaced `<input>` elements) shown on
 * `:checked`. No JavaScript draws the indicator.
 *
 * `checked` mirrors the native attribute/property split: the attribute is the
 * initial state and `form.reset()` target (`defaultChecked`); later signal
 * updates set the property. Native `change` events bubble out.
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

export const checkboxClasses =
  'peer h-4 w-4 shrink-0 appearance-none rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 checked:border-primary checked:bg-primary checked:bg-[length:0.75rem] checked:bg-center checked:bg-no-repeat checked:bg-[url("data:image/svg+xml,%3Csvg%20xmlns=\'http://www.w3.org/2000/svg\'%20viewBox=\'0%200%2020%2020\'%20fill=\'none\'%20stroke=\'white\'%20stroke-width=\'3\'%20stroke-linecap=\'round\'%20stroke-linejoin=\'round\'%3E%3Cpath%20d=\'M5%2010l4%204l6-8\'/%3E%3C/svg%3E")]';

export type CheckboxProps = {
  checked?: boolean;
  /** The value submitted with the form when checked (native default: "on"). */
  value?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  /** Merged last into the inner <input>'s class list via cn(). */
  className?: string;
};

export const Checkbox = component<CheckboxProps>('ui-checkbox', (props, host) => {
  transparentHost(host);

  const value = attr(props.value, host, 'value');
  const id = forwardedAttr(props.id, host, 'id');
  const name = forwardedAttr(props.name, host, 'name');
  const checked = boolAttr(props.checked, host, 'checked');
  const disabled = boolAttr(props.disabled, host, 'disabled');
  const required = boolAttr(props.required, host, 'required');
  const className = attr(props.className, host, 'class-name');

  const classes = computed(() => cn(checkboxClasses, className.value));

  const root = ref<HTMLInputElement>();

  // Programmatic checked updates → the property (leaves the reset target).
  effect(() => {
    const c = checked.value;
    const box = root.current;
    if (box && box.checked !== c) box.checked = c;
  });

  onMount(() => {
    const box = root.current;
    if (!box) return;
    if (checked.value) {
      box.defaultChecked = true; // native form.reset() target
      box.checked = true;
    }
  });

  return html`<input
    ref="${root}"
    type="checkbox"
    data-slot="checkbox"
    class="${classes}"
    id="${id}"
    name="${name}"
    value="${value}"
    disabled="${disabled}"
    required="${required}"
  />`;
});
