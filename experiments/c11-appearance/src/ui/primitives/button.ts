/**
 * button.ts — a control.
 *
 * DECLARES: that this is an action (`data-appearance="action"`) and how much
 * emphasis it carries within that role (`data-role`).
 *
 * DOES NOT DECIDE: height, padding, radius, colour, font, hit target or focus
 * ring — and there is no variant table to pick from. The shipped
 * registry/default/ui/button.ts needs four hand-written class sets to cover
 * comfortable / compact / dense / touch, plus a caller who picked one by looking
 * at a design. Here those four results come from one inherited `--unit`, and the
 * caller has no channel through which to make the choice.
 *
 * `disabled` is expressed as `aria-disabled` plus a guard in the handler rather
 * than the native attribute, deliberately: a natively disabled control is
 * excluded from the accessibility tree and from keyboard order, so a toolbar
 * that disables an action loses it entirely. This keeps the control announced,
 * focusable and — the reason it matters here — MEASURABLE, which is the F4
 * precondition every diagnostic rule asserts before it reports on geometry.
 */

import { children, component, type ComponentAttrs, computed, html } from '@nisli/core';
import type { Emphasis } from '../../appearance/contracts.js';

export interface ButtonProps {
  role?: Emphasis;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: (event: MouseEvent) => void;
  children?: unknown;
}

const buttonAttrs = {
  role: 'string',
  type: 'string',
  disabled: 'boolean',
} satisfies ComponentAttrs<ButtonProps>;

export const Button = component<ButtonProps, typeof buttonAttrs>(
  'app-button',
  (props) => html`<button
    data-component="app-button"
    data-appearance="action"
    data-role=${props.role}
    type=${computed(() => props.type.value ?? 'button')}
    aria-disabled=${computed(() => (props.disabled.value ? 'true' : undefined))}
    @click=${(event: MouseEvent) => {
      if (props.disabled.value) return;
      props.onClick.value?.(event);
    }}
  >${children()}</button>`,
  { attrs: buttonAttrs },
);
