/**
 * ui/navigation-menu.ts — NavigationMenu.
 *
 * Ported from new-york-v4/ui/navigation-menu.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui)
 * and the Radix NavigationMenu behavior it wraps (MIT), rebuilt as Nisli
 * custom elements. A non-modal menu bar: a horizontal list of triggers, each
 * revealing a content panel on hover / click / keyboard.
 *
 * ```
 * <ui-navigation-menu>
 *   <ui-navigation-menu-list>
 *     <ui-navigation-menu-item>
 *       <ui-navigation-menu-trigger value="products">Products</ui-navigation-menu-trigger>
 *       <ui-navigation-menu-content value="products">
 *         <ui-navigation-menu-link href="/a">Item A</ui-navigation-menu-link>
 *       </ui-navigation-menu-content>
 *     </ui-navigation-menu-item>
 *   </ui-navigation-menu-list>
 * </ui-navigation-menu>
 * ```
 *
 * V1 DEVIATION — NO VIEWPORT: Radix can teleport the active panel into a
 * single shared, animated `NavigationMenuViewport`. We skip that machinery and
 * render each `NavigationMenuContent` INLINE under its own trigger
 * (`data-viewport="false"` on the root), toggled by `data-state`/`hidden`.
 * NavigationMenuIndicator and NavigationMenuViewport are intentionally omitted.
 *
 * Triggers correlate with content by a shared `value` (like ui-tabs). Left/
 * right arrows roving-move focus between triggers (roving-focus lib); hover and
 * click open, pointer-leave (with a short grace) and Escape close. Selection
 * changes dispatch a bubbling `ui-value-change` CustomEvent from the root host.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  children,
  component,
  type ComponentAttrs,
  createContext,
  computed,
  html,
  onCleanup,
  ref,
  signal,
  type ReadonlySignal,
  type TemplateResult,
} from '@nisli/core';
import { cn, cv, transparentHost } from '../lib/utils.js';
import { rovingFocus } from '../lib/roving-focus.js';

const CLOSE_DELAY = 150;

// ── Shared state (published on the <ui-navigation-menu> host) ────────

export interface NavigationMenuState {
  /** The open item's value, or '' when closed. */
  value: ReadonlySignal<string>;
  /** Open an item now (cancels a pending close). */
  open(value: string): void;
  /** Toggle an item open/closed. */
  toggle(value: string): void;
  /** Close after a short grace, so trigger→content transit stays open. */
  scheduleClose(): void;
  /** Cancel a pending close (pointer entered the content). */
  keepOpen(): void;
  /** Close immediately (Escape). */
  close(): void;
  baseId: string;
}

/** Subtree-scoped channel from the NavigationMenu provider to its parts. */
const NavigationMenuContext = createContext<NavigationMenuState>('NavigationMenu', { providerTag: 'ui-navigation-menu' });

let uid = 0;

// ── ui-navigation-menu (root, owns state) ────────────────────────────

export type NavigationMenuProps = {
  className?: string;
  children?: string | TemplateResult;
};

const navigationMenuAttrs = { className: 'string' } satisfies ComponentAttrs<NavigationMenuProps>;

export const NavigationMenu = component<NavigationMenuProps, typeof navigationMenuAttrs>(
  'ui-navigation-menu',
  (props, host) => {
    transparentHost(host);

    // The root's `value` (which submenu is open) is EPHEMERAL interaction state —
    // there is no `value` attribute/prop on the root, so it stays an internal
    // signal (the value-state attribute-as-truth shape does not apply here).
    const value = signal<string>('');
    let closeTimer: ReturnType<typeof setTimeout> | undefined;

    const setValue = (next: string): void => {
      if (next === value.value) return;
      value.value = next;
      host.dispatchEvent(
        new CustomEvent('ui-value-change', { detail: { value: next }, bubbles: true }),
      );
    };

    const state: NavigationMenuState = {
      value,
      open: (v) => {
        clearTimeout(closeTimer);
        setValue(v);
      },
      toggle: (v) => {
        clearTimeout(closeTimer);
        setValue(value.value === v ? '' : v);
      },
      scheduleClose: () => {
        clearTimeout(closeTimer);
        closeTimer = setTimeout(() => setValue(''), CLOSE_DELAY);
      },
      keepOpen: () => clearTimeout(closeTimer),
      close: () => {
        clearTimeout(closeTimer);
        setValue('');
      },
      baseId: `ui-navigation-menu-${++uid}`,
    };
    NavigationMenuContext.provide(host, state);

    const className = props.className;
    const classes = computed(() =>
      cn(
        'group/navigation-menu relative flex max-w-max flex-1 items-center justify-center',
        className.value,
      ),
    );

    onCleanup(() => clearTimeout(closeTimer));

    return html`<div
      data-slot="navigation-menu"
      data-viewport="false"
      class="${classes}"
    >${children()}</div>`;
  },
  { attrs: navigationMenuAttrs },
);

// ── ui-navigation-menu-list ──────────────────────────────────────────

export type NavigationMenuListProps = {
  className?: string;
  children?: string | TemplateResult;
};

const navigationMenuListAttrs = { className: 'string' } satisfies ComponentAttrs<NavigationMenuListProps>;

export const NavigationMenuList = component<NavigationMenuListProps, typeof navigationMenuListAttrs>(
  'ui-navigation-menu-list',
  (props, host) => {
    const state = NavigationMenuContext.inject();
    transparentHost(host);

    const className = props.className;
    const classes = computed(() =>
      cn('group flex flex-1 list-none items-center justify-center gap-1', className.value),
    );

    const root = ref<HTMLUListElement>();

    // Left/right roving focus over the triggers (focus-only; open is on
    // hover/click/Enter, matching Radix's manual activation for menus).
    const roving = rovingFocus(
      () =>
        root.current
          ? Array.from(
              root.current.querySelectorAll<HTMLElement>(
                '[data-slot="navigation-menu-trigger"]',
              ),
            )
          : [],
      { orientation: 'horizontal', loop: true },
    );

    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        state.close();
        return;
      }
      roving.onKeydown(event);
    };

    return html`<ul
      ref="${root}"
      data-slot="navigation-menu-list"
      class="${classes}"
      @keydown=${onKeydown}
    >${children()}</ul>`;
  },
  { attrs: navigationMenuListAttrs },
);

// ── ui-navigation-menu-item ──────────────────────────────────────────

export type NavigationMenuItemProps = {
  className?: string;
  children?: string | TemplateResult;
};

const navigationMenuItemAttrs = { className: 'string' } satisfies ComponentAttrs<NavigationMenuItemProps>;

export const NavigationMenuItem = component<NavigationMenuItemProps, typeof navigationMenuItemAttrs>(
  'ui-navigation-menu-item',
  (props, host) => {
    NavigationMenuContext.inject();
    transparentHost(host);

    const className = props.className;
    const classes = computed(() => cn('relative', className.value));

    return html`<li
      data-slot="navigation-menu-item"
      class="${classes}"
    >${children()}</li>`;
  },
  { attrs: navigationMenuItemAttrs },
);

// ── ui-navigation-menu-trigger ───────────────────────────────────────

export const navigationMenuTriggerStyle = cv(
  'group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-[color,box-shadow] outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-accent/50 data-[state=open]:text-accent-foreground data-[state=open]:hover:bg-accent data-[state=open]:focus:bg-accent',
);

export type NavigationMenuTriggerProps = {
  /** Correlates this trigger with its content by value. Required. */
  value?: string;
  className?: string;
  children?: string | TemplateResult;
};

const navigationMenuTriggerAttrs = {
  value: 'string',
  className: 'string',
} satisfies ComponentAttrs<NavigationMenuTriggerProps>;

export const NavigationMenuTrigger = component<NavigationMenuTriggerProps, typeof navigationMenuTriggerAttrs>(
  'ui-navigation-menu-trigger',
  (props, host) => {
    const state = NavigationMenuContext.inject();
    transparentHost(host);

    const own = computed(() => props.value.value ?? '');
    const isOpen = computed(() => own.value !== '' && state.value.value === own.value);
    const triggerId = computed(() => `${state.baseId}-trigger-${own.value}`);
    const contentId = computed(() => `${state.baseId}-content-${own.value}`);

    const className = props.className;
    const classes = computed(() => cn(navigationMenuTriggerStyle(), className.value));

    return html`<button
      type="button"
      data-slot="navigation-menu-trigger"
      id="${triggerId}"
      aria-controls="${contentId}"
      aria-expanded="${computed(() => (isOpen.value ? 'true' : 'false'))}"
      data-state="${computed(() => (isOpen.value ? 'open' : 'closed'))}"
      class="${classes}"
      @pointerenter=${() => state.open(own.value)}
      @pointerleave=${() => state.scheduleClose()}
      @click=${() => state.toggle(own.value)}
    >${children()}<svg
        class="relative top-[1px] ml-1 size-3 transition duration-300 group-data-[state=open]:rotate-180"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      ><path d="m6 9 6 6 6-6"></path></svg></button>`;
  },
  { attrs: navigationMenuTriggerAttrs },
);

// ── ui-navigation-menu-content ───────────────────────────────────────

const contentClasses =
  'absolute top-full left-0 z-50 mt-1.5 w-max overflow-hidden rounded-md border bg-popover p-2 text-popover-foreground shadow duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95';

export type NavigationMenuContentProps = {
  /** Correlates this content with its trigger by value. Required. */
  value?: string;
  className?: string;
  children?: string | TemplateResult;
};

const navigationMenuContentAttrs = {
  value: 'string',
  className: 'string',
} satisfies ComponentAttrs<NavigationMenuContentProps>;

export const NavigationMenuContent = component<NavigationMenuContentProps, typeof navigationMenuContentAttrs>(
  'ui-navigation-menu-content',
  (props, host) => {
    const state = NavigationMenuContext.inject();
    transparentHost(host);

    const own = computed(() => props.value.value ?? '');
    const isOpen = computed(() => own.value !== '' && state.value.value === own.value);
    const triggerId = computed(() => `${state.baseId}-trigger-${own.value}`);
    const contentId = computed(() => `${state.baseId}-content-${own.value}`);

    const className = props.className;
    const classes = computed(() => cn(contentClasses, className.value));

    return html`<div
      data-slot="navigation-menu-content"
      id="${contentId}"
      aria-labelledby="${triggerId}"
      data-state="${computed(() => (isOpen.value ? 'open' : 'closed'))}"
      hidden="${computed(() => !isOpen.value)}"
      class="${classes}"
      @pointerenter=${() => state.keepOpen()}
      @pointerleave=${() => state.scheduleClose()}
    >${children()}</div>`;
  },
  { attrs: navigationMenuContentAttrs },
);

// ── ui-navigation-menu-link ──────────────────────────────────────────

export type NavigationMenuLinkProps = {
  href?: string;
  active?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

const navigationMenuLinkAttrs = {
  href: 'string',
  active: 'boolean',
  className: 'string',
} satisfies ComponentAttrs<NavigationMenuLinkProps>;

export const NavigationMenuLink = component<NavigationMenuLinkProps, typeof navigationMenuLinkAttrs>(
  'ui-navigation-menu-link',
  (props, host) => {
    transparentHost(host);

    const href = props.href;
    // `active` is a declared boolean attribute — its presence IS the truth, so
    // props.active reads it directly (no separate host.hasAttribute fallback).
    const active = computed<boolean>(() => props.active.value);
    const className = props.className;
    const classes = computed(() =>
      cn(
        "flex flex-col gap-1 rounded-sm p-2 text-sm transition-all outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 data-[active=true]:bg-accent/50 data-[active=true]:text-accent-foreground data-[active=true]:hover:bg-accent data-[active=true]:focus:bg-accent [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className.value,
      ),
    );

    return html`<a
      data-slot="navigation-menu-link"
      href="${href}"
      data-active="${computed(() => (active.value ? 'true' : undefined))}"
      class="${classes}"
    >${children()}</a>`;
  },
  { attrs: navigationMenuLinkAttrs },
);
