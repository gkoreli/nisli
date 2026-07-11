/**
 * ui/switch.ts — Switch.
 *
 * Ported from shadcn/ui `new-york-v4/ui/switch.tsx` (MIT —
 * https://github.com/shadcn-ui/ui) as a Nisli component. Radix
 * `data-[state=*]` tokens are translated to native `checked:` /
 * `peer-checked:` / `peer-[:not(:checked)]:` variants. Renders a REAL native `<input type="checkbox"
 * role="switch">` in the light DOM for native form participation (ADR 0022
 * §5): spacebar toggling, `form.elements`, `form.reset()`, and label
 * association all come from the platform.
 *
 * Structure (not single-root): a minimal `relative inline-flex` `<span>`
 * wrapper holds the input, which is itself the sized track (`peer`,
 * `appearance-none`, `rounded-full`, `checked:bg-primary`), and a sibling
 * `<span>` thumb driven purely by `peer-checked:translate-x`. The thumb is
 * `pointer-events-none` so clicks reach the input. `className` merges into
 * the track (the input) so consumer size overrides (`h-6 w-11`) land there.
 * No JS drives the visual.
 *
 * `checked` mirrors the native attribute/property split (attribute =
 * `defaultChecked` / `form.reset()` target, property = programmatic updates);
 * native `change` events bubble out.
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

export const switchWrapperClasses = 'relative inline-flex shrink-0';

export const switchControlClasses =
  'peer inline-flex shrink-0 appearance-none items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 checked:bg-primary [&:not(:checked)]:bg-input dark:[&:not(:checked)]:bg-input/80';

export const switchSizeClasses: Record<SwitchSize, string> = {
  default: 'h-[1.15rem] w-8',
  sm: 'h-3.5 w-6',
};

export const switchThumbClasses =
  'pointer-events-none absolute left-[2px] top-1/2 -translate-y-1/2 rounded-full bg-background ring-0 transition-transform peer-checked:translate-x-[calc(100%-2px)] dark:peer-checked:bg-primary-foreground dark:peer-[:not(:checked)]:bg-foreground';

export const switchThumbSizeClasses: Record<SwitchSize, string> = {
  default: 'size-4',
  sm: 'size-3',
};

export type SwitchSize = 'default' | 'sm';

export type SwitchProps = {
  checked?: boolean;
  size?: SwitchSize;
  /** The value submitted with the form when checked (native default: "on"). */
  value?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  /** Merged last into the switch root's class list via cn(). */
  className?: string;
};

export const Switch = component<SwitchProps>('ui-switch', (props, host) => {
  transparentHost(host);

  const value = attr(props.value, host, 'value');
  const id = forwardedAttr(props.id, host, 'id');
  const name = forwardedAttr(props.name, host, 'name');
  const checked = boolAttr(props.checked, host, 'checked');
  const disabled = boolAttr(props.disabled, host, 'disabled');
  const required = boolAttr(props.required, host, 'required');
  const className = attr(props.className, host, 'class-name');
  const sizeAttr = attr(props.size, host, 'size');
  const size = computed<SwitchSize>(() => (sizeAttr.value === 'sm' ? 'sm' : 'default'));

  // className merges into the track (the input), where size overrides belong.
  const controlClasses = computed(() =>
    cn(switchControlClasses, switchSizeClasses[size.value], className.value),
  );
  const thumbClasses = computed(() =>
    cn(switchThumbClasses, switchThumbSizeClasses[size.value]),
  );

  const control = ref<HTMLInputElement>();

  // Programmatic checked updates → the property (leaves the reset target).
  effect(() => {
    const c = checked.value;
    const box = control.current;
    if (box && box.checked !== c) box.checked = c;
  });

  onMount(() => {
    const box = control.current;
    if (!box) return;
    if (checked.value) {
      box.defaultChecked = true; // native form.reset() target
      box.checked = true;
    }
  });

  return html`<span data-slot="switch-wrapper" class="${switchWrapperClasses}">
    <input
      ref="${control}"
      type="checkbox"
      role="switch"
      data-slot="switch"
      data-size="${size}"
      class="${controlClasses}"
      id="${id}"
      name="${name}"
      value="${value}"
      disabled="${disabled}"
      required="${required}"
    />
    <span data-slot="switch-thumb" class="${thumbClasses}"></span>
  </span>`;
});
