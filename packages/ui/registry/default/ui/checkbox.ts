/**
 * ui/checkbox.ts — Checkbox.
 *
 * Ported from shadcn/ui `new-york-v4/ui/checkbox.tsx` (MIT —
 * https://github.com/shadcn-ui/ui) as a Nisli component. Radix
 * `data-[state=checked]:` tokens are translated to native `checked:`
 * variants; the lucide CheckIcon becomes a data-URI (its stroke cannot
 * follow text-primary-foreground — a documented fidelity limit). Renders a REAL native `<input type="checkbox">` in the
 * light DOM for native form participation (ADR 0022 §5): `form.elements`,
 * `form.reset()`, label association, and free spacebar toggling all work
 * natively. Keyboard and a11y come from the platform — no role shims.
 *
 * The visual is pure CSS: `appearance-none` strips the native box and the
 * shadcn styling is drawn with Tailwind `checked:`/`disabled:` variants. The
 * check mark is a `background-image` data-URI SVG (not a `::before` glyph —
 * pseudo-elements do not render on replaced `<input>` elements) shown on
 * `:checked`. No JavaScript draws the indicator. `data-state` (checked /
 * unchecked) and `data-disabled` are reflected reactively so consumer CSS
 * using shadcn's `data-[state=checked]` selectors works alongside the native
 * `:checked` styling.
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
  signal,
} from '@nisli/core';
import {
  attr,
  boolAttr,
  cn,
  forwardedAttr,
  transparentHost,
} from '../lib/utils.js';

export const checkboxClasses =
  'peer size-4 shrink-0 appearance-none rounded-[4px] border border-input shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 checked:border-primary checked:bg-primary checked:text-primary-foreground dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:checked:bg-primary checked:bg-[length:0.875rem] checked:bg-center checked:bg-no-repeat checked:bg-[url("data:image/svg+xml,%3Csvg%20xmlns=\'http://www.w3.org/2000/svg\'%20viewBox=\'0%200%2024%2024\'%20fill=\'none\'%20stroke=\'white\'%20stroke-width=\'2\'%20stroke-linecap=\'round\'%20stroke-linejoin=\'round\'%3E%3Cpath%20d=\'M20%206%209%2017l-5-5\'/%3E%3C/svg%3E")]';

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

  // Radix-style data-state, reflecting the ACTUAL checked state (so consumer
  // CSS using data-[state=checked] works alongside our native :checked
  // styling). Driven by both the `checked` signal and native user changes.
  const state = signal<'checked' | 'unchecked'>(checked.value ? 'checked' : 'unchecked');
  const syncState = (): void => {
    if (root.current) state.value = root.current.checked ? 'checked' : 'unchecked';
  };

  // Programmatic checked updates → the property (leaves the reset target).
  effect(() => {
    const c = checked.value;
    const box = root.current;
    if (box && box.checked !== c) box.checked = c;
    if (box) state.value = box.checked ? 'checked' : 'unchecked';
  });

  onMount(() => {
    const box = root.current;
    if (!box) return;
    if (checked.value) {
      box.defaultChecked = true; // native form.reset() target
      box.checked = true;
    }
    syncState();
  });

  return html`<input
    ref="${root}"
    type="checkbox"
    data-slot="checkbox"
    data-state="${state}"
    data-disabled="${computed(() => (disabled.value ? '' : undefined))}"
    class="${classes}"
    id="${id}"
    name="${name}"
    value="${value}"
    disabled="${disabled}"
    required="${required}"
    @change=${syncState}
  />`;
});
