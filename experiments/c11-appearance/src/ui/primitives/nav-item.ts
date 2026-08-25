/**
 * nav-item.ts — one destination in a navigation list.
 *
 * DECLARES: that this is a nav item, and whether it is the current one.
 *
 * DOES NOT DECIDE: how "current" looks. `aria-current="page"` is a statement of
 * fact, not a style hook chosen by the author; the theme derives the selected
 * treatment from it, which means the accessible state and the visible state
 * cannot drift apart — there is no separate `active` class to forget.
 */

import { component, type ComponentAttrs, computed, html } from '@nisli/core';

export interface NavItemProps {
  label?: string;
  current?: boolean;
  onSelect?: () => void;
}

const navItemAttrs = {
  label: 'string',
  current: 'boolean',
} satisfies ComponentAttrs<NavItemProps>;

export const NavItem = component<NavItemProps, typeof navItemAttrs>(
  'app-nav-item',
  (props) => html`<button
    data-component="app-nav-item"
    data-appearance="nav-item"
    type="button"
    aria-current=${computed(() => (props.current.value ? 'page' : undefined))}
    @click=${() => props.onSelect.value?.()}
  ><span data-grow>${props.label}</span></button>`,
  { attrs: navItemAttrs },
);
