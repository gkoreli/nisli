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
  component,
  computed,
  html,
  onMount,
  ref,
  signal,
  type TemplateResult,
} from '@nisli/core';
import {
  attr,
  boolAttr,
  captureChildren,
  cn,
  cv,
  projectChildren,
  transparentHost,
} from '../lib/utils.js';

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
  /** Merged last into the inner <button>'s class list via cn(). */
  className?: string;
  children?: string | TemplateResult;
};

export const Toggle = component<ToggleProps>('ui-toggle', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);

  const variant = attr(props.variant, host, 'variant');
  const size = attr(props.size, host, 'size');
  const disabled = boolAttr(props.disabled, host, 'disabled');
  const className = attr(props.className, host, 'class-name');

  // Controlled `pressed` wins; otherwise internal state seeded from
  // default-pressed (or a parse-time bare `pressed` attribute).
  const internal = signal(
    boolAttr(props.defaultPressed, host, 'default-pressed').value ||
      host.hasAttribute('pressed'),
  );
  const pressed = computed(() => props.pressed.value ?? internal.value);

  const toggle = (): void => {
    if (disabled.value) return;
    const next = !pressed.value;
    internal.value = next;
    host.dispatchEvent(
      new CustomEvent('ui-pressed-change', { detail: { pressed: next }, bubbles: true }),
    );
  };

  const classes = computed(() =>
    cn(toggleVariants({ variant: variant.value, size: size.value }), className.value),
  );

  const root = ref<HTMLButtonElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<button
    ref="${root}"
    type="button"
    data-slot="toggle"
    aria-pressed="${computed(() => (pressed.value ? 'true' : 'false'))}"
    data-state="${computed(() => (pressed.value ? 'on' : 'off'))}"
    disabled="${disabled}"
    class="${classes}"
    @click=${toggle}
  >${props.children}</button>`;
});
