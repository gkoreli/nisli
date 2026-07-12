/**
 * ui/toggle.ts — Toggle.
 *
 * Ported from shadcn/ui `new-york-v4/ui/toggle.tsx` (MIT —
 * https://github.com/shadcn-ui/ui) and the Radix Toggle behavior it wraps:
 * a two-state button with `aria-pressed` and `data-state="on|off"`.
 * Pressing dispatches a bubbling `ui-pressed-change` CustomEvent
 * (`detail: { pressed }`).
 *
 * Usable as a typed factory (`Toggle({ pressed, children: 'Bold' })`) or as
 * a plain custom element (`<ui-toggle pressed>B</ui-toggle>`).
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  children,
  component,
  computed,
  effect,
  html,
  type TemplateResult,
} from '@nisli/core';
import { cn, cv, isPinned, transparentHost } from '../lib/utils.js';

export const toggleVariants = cv(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none hover:bg-muted hover:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline:
          'border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-9 min-w-9 px-2',
        sm: 'h-8 min-w-8 px-1.5',
        lg: 'h-10 min-w-10 px-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ToggleVariant = 'default' | 'outline';
export type ToggleSize = 'default' | 'sm' | 'lg';

export type ToggleProps = {
  /** Controlled pressed state; wins over internal state when set. */
  pressed?: boolean;
  /** Initial pressed state when uncontrolled. */
  defaultPressed?: boolean;
  variant?: ToggleVariant;
  size?: ToggleSize;
  disabled?: boolean;
  /** Invalid state forwarded to the inner button that owns aria-invalid:* classes. */
  ariaInvalid?: boolean;
  /** Merged last into the inner <button>'s class list via cn(). */
  className?: string;
  children?: string | TemplateResult;
};

export const Toggle = component<ToggleProps>('ui-toggle', (props, host) => {
  transparentHost(host);

  const variant = props.variant;
  const size = props.size;
  const disabled = computed<boolean>(() => props.disabled.value as boolean);
  const className = props.className;

  // PATTERN A (ADR 0025 item 3): the `pressed` ATTRIBUTE is the uncontrolled
  // state (like native <dialog open>/<details open>). The attribute IS the truth.
  const pressed = computed<boolean>(() => props.pressed.value ?? false);

  const setPressed = (next: boolean): void => {
    if (next === pressed.value) return;
    // Uncontrolled → the attribute IS the state, so write it. Controlled (a
    // pinned factory `pressed` signal) → don't; the parent drives and the reflect
    // effect re-syncs the attr. isPinned('pressed') is the discriminator (a
    // declared 'boolean' is never undefined, so pin state is the only controlled
    // signal).
    if (!isPinned(host, 'pressed')) host.toggleAttribute('pressed', next);
    host.dispatchEvent(
      new CustomEvent('ui-pressed-change', { detail: { pressed: next }, bubbles: true }),
    );
  };

  // defaultPressed is INIT-SEED-ONLY: seed the pressed attribute once, but only
  // when `pressed` is neither controlled (pinned — else the reflect effect would
  // revert it, a pointless flicker) nor explicitly authored. host.hasAttribute('pressed')
  // is a SANCTIONED read of a DECLARED attribute: it distinguishes 'absent' from
  // 'present-false' so an explicit pressed="false" beats defaultPressed (stays off).
  if (props.defaultPressed.value && !isPinned(host, 'pressed') && !host.hasAttribute('pressed')) {
    host.toggleAttribute('pressed', true);
  }

  // Reflect the resolved state to the attribute so CONTROLLED (factory) usage
  // also reflects (CSS [pressed] selectors + native parity); dedupe makes it cheap.
  effect(() => {
    host.toggleAttribute('pressed', pressed.value);
  });

  const toggle = (): void => {
    if (disabled.value) return;
    setPressed(!pressed.value);
  };

  const classes = computed(() =>
    cn(toggleVariants({ variant: variant.value, size: size.value }), className.value),
  );

  return html`<button
    type="button"
    data-slot="toggle"
    aria-pressed="${computed(() => (pressed.value ? 'true' : 'false'))}"
    data-state="${computed(() => (pressed.value ? 'on' : 'off'))}"
    disabled="${disabled}"
    aria-invalid="${computed(() => (props.ariaInvalid.value ? 'true' : undefined))}"
    class="${classes}"
    @click=${toggle}
  >${children()}</button>`;
}, {
  // PATTERN A: `pressed` is the attribute-as-truth state; `defaultPressed` seeds it.
  attrs: {
    pressed: 'boolean',
    defaultPressed: 'boolean',
    variant: 'string',
    size: 'string',
    disabled: 'boolean',
    ariaInvalid: 'boolean',
    className: 'string',
  },
});
