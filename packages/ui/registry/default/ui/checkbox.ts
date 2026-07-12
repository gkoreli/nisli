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
import { cn, transparentHost } from '../lib/utils.js';

export const checkboxClasses =
  'peer size-4 shrink-0 appearance-none rounded-[4px] border border-input shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 checked:border-primary checked:bg-primary checked:text-primary-foreground dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:checked:bg-primary checked:bg-[length:0.875rem] checked:bg-center checked:bg-no-repeat checked:bg-[url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27white%27%20stroke-width=%272%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27M20%206%209%2017l-5-5%27/%3E%3C/svg%3E")]';

export type CheckboxProps = {
  checked?: boolean;
  /** The value submitted with the form when checked (native default: "on"). */
  value?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  /** Invalid state forwarded to the inner checkbox that owns aria-invalid:* classes. */
  ariaInvalid?: boolean;
  /** Merged last into the inner <input>'s class list via cn(). */
  className?: string;
};

export const Checkbox = component<CheckboxProps>('ui-checkbox', (props, host) => {
  transparentHost(host);

  // Attribute fallbacks are declared in the `attrs` option below (ADR 0025
  // item 3) — no userland attr()/boolAttr()/forwardedAttr(). Declared-default
  // booleans are runtime-guaranteed non-undefined (`as boolean` is the typing
  // stopgap until ReactiveProps carries the declared type).
  const value = props.value;
  const id = props.id;
  const name = props.name;
  const checked = computed<boolean>(() => props.checked.value as boolean);
  const disabled = computed<boolean>(() => props.disabled.value as boolean);
  const required = computed<boolean>(() => props.required.value as boolean);
  const className = props.className;

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
    aria-invalid="${computed(() => (props.ariaInvalid.value ? 'true' : undefined))}"
    @change=${syncState}
  />`;
}, {
  // ADR 0025 item 3: opt-in attribute reactivity. 'forward' relocates id/name
  // onto the inner control (native form participation).
  attrs: {
    value: 'string',
    className: 'string',
    id: 'forward',
    name: 'forward',
    checked: 'boolean',
    disabled: 'boolean',
    required: 'boolean',
    ariaInvalid: 'boolean',
  },
});
