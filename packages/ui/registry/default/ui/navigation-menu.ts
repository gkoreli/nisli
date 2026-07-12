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
  component,
  createContext,
  computed,
  html,
  onCleanup,
  onMount,
  ref,
  signal,
  type ReadonlySignal,
  type Ref,
  type TemplateResult,
} from '@nisli/core';
import {
  attr,
  captureChildren,
  cn,
  cv,
  projectChildren,
  transparentHost,
} from '../lib/utils.js';
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
const NavigationMenuContext = createContext<NavigationMenuState>('NavigationMenu');

let uid = 0;

// ── ui-navigation-menu (root, owns state) ────────────────────────────

export type NavigationMenuProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const NavigationMenu = component<NavigationMenuProps>(
  'ui-navigation-menu',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);

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

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        'group/navigation-menu relative flex max-w-max flex-1 items-center justify-center',
        className.value,
      ),
    );

    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    onCleanup(() => clearTimeout(closeTimer));

    return html`<div
      ref="${root}"
      data-slot="navigation-menu"
      data-viewport="false"
      class="${classes}"
    >${props.children}</div>`;
  },
);

// ── ui-navigation-menu-list ──────────────────────────────────────────

export type NavigationMenuListProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const NavigationMenuList = component<NavigationMenuListProps>(
  'ui-navigation-menu-list',
  (props, host) => {
    const state = NavigationMenuContext.inject();
    transparentHost(host);
    const projected = captureChildren(host);

    const className = attr(props.className, host, 'class-name');
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

    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<ul
      ref="${root}"
      data-slot="navigation-menu-list"
      class="${classes}"
      @keydown=${onKeydown}
    >${props.children}</ul>`;
  },
);

// ── ui-navigation-menu-item ──────────────────────────────────────────

export type NavigationMenuItemProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const NavigationMenuItem = component<NavigationMenuItemProps>(
  'ui-navigation-menu-item',
  (props, host) => {
    NavigationMenuContext.inject();
    transparentHost(host);
    const projected = captureChildren(host);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn('relative', className.value));

    const root = ref<HTMLLIElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<li
      ref="${root}"
      data-slot="navigation-menu-item"
      class="${classes}"
    >${props.children}</li>`;
  },
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

export const NavigationMenuTrigger = component<NavigationMenuTriggerProps>(
  'ui-navigation-menu-trigger',
  (props, host) => {
    const state = NavigationMenuContext.inject();
    transparentHost(host);
    const projected = captureChildren(host);

    const valueAttr = attr(props.value, host, 'value');
    const own = computed(() => valueAttr.value ?? '');
    const isOpen = computed(() => own.value !== '' && state.value.value === own.value);
    const triggerId = computed(() => `${state.baseId}-trigger-${own.value}`);
    const contentId = computed(() => `${state.baseId}-content-${own.value}`);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(navigationMenuTriggerStyle(), className.value));

    const root = ref<HTMLButtonElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<button
      ref="${root}"
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
    >${props.children}<svg
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

export const NavigationMenuContent = component<NavigationMenuContentProps>(
  'ui-navigation-menu-content',
  (props, host) => {
    const state = NavigationMenuContext.inject();
    transparentHost(host);
    const projected = captureChildren(host);

    const valueAttr = attr(props.value, host, 'value');
    const own = computed(() => valueAttr.value ?? '');
    const isOpen = computed(() => own.value !== '' && state.value.value === own.value);
    const triggerId = computed(() => `${state.baseId}-trigger-${own.value}`);
    const contentId = computed(() => `${state.baseId}-content-${own.value}`);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(contentClasses, className.value));

    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<div
      ref="${root}"
      data-slot="navigation-menu-content"
      id="${contentId}"
      aria-labelledby="${triggerId}"
      data-state="${computed(() => (isOpen.value ? 'open' : 'closed'))}"
      hidden="${computed(() => !isOpen.value)}"
      class="${classes}"
      @pointerenter=${() => state.keepOpen()}
      @pointerleave=${() => state.scheduleClose()}
    >${props.children}</div>`;
  },
);

// ── ui-navigation-menu-link ──────────────────────────────────────────

export type NavigationMenuLinkProps = {
  href?: string;
  active?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const NavigationMenuLink = component<NavigationMenuLinkProps>(
  'ui-navigation-menu-link',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);

    const href = attr(props.href, host, 'href');
    const active = computed(() => props.active.value ?? host.hasAttribute('active'));
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        "flex flex-col gap-1 rounded-sm p-2 text-sm transition-all outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 data-[active=true]:bg-accent/50 data-[active=true]:text-accent-foreground data-[active=true]:hover:bg-accent data-[active=true]:focus:bg-accent [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className.value,
      ),
    );

    const root = ref<HTMLAnchorElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<a
      ref="${root}"
      data-slot="navigation-menu-link"
      href="${href}"
      data-active="${computed(() => (active.value ? 'true' : undefined))}"
      class="${classes}"
    >${props.children}</a>`;
  },
);
