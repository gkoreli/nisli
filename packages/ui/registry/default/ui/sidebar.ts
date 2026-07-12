/**
 * ui/sidebar.ts — Sidebar.
 *
 * Ported from new-york-v4/ui/sidebar.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui).
 * The class lists, data-slot / data-sidebar / data-state / data-collapsible /
 * data-variant / data-side attributes, the --sidebar-width* CSS vars, and the
 * whole part family are ported verbatim; the provider state is published via a
 * subtree-scoped `SidebarContext` (createContext).
 *
 * Provider: open/collapsed state with cookie persistence, a Cmd/Ctrl+B keyboard
 * shortcut, and an `isMobile` signal (matchMedia). The desktop `Sidebar` frame
 * supports the side / variant / collapsible variants via data-* attributes and
 * the group-data Tailwind selectors.
 *
 * Mobile: the `Sidebar` frame renders an off-canvas `Sheet` when `isMobile`
 * (upstream sidebar.tsx mobile branch — verbatim Sheet side, the
 * `--sidebar-width` mobile override, `data-mobile`, and the sr-only header),
 * driven by the provider's `openMobile` state and dismissable via the sheet's
 * focus-trap + Escape. Upstream re-renders on `isMobile`; Nisli swaps the tree
 * reactively via `when()` with a SINGLE captured `children()` slot placed into
 * whichever branch is live (ADR 0025 item-1 re-mountable slot + ADR 0023
 * move-resilience). See the ADR 0025 GAP-NOTE: a breakpoint flip re-mounts the
 * subtree (state loss across the threshold) — the single-slot v1 limitation.
 *
 * v1 deviations (documented):
 * - `asChild` is not supported (Nisli renders the native element directly).
 * - No tooltip on a collapsed menu button.
 * - `data-sidebar="sidebar"` / `data-slot="sidebar"` / `data-mobile="true"` sit
 *   on the mobile panel's inner wrapper (upstream sets them on SheetContent
 *   itself); the `--sidebar-width` override rides SheetContent's `style` prop.
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
  signal,
  useHostEvent,
  when,
  type ReadonlySignal,
  type TemplateResult,
} from '@nisli/core';
import { cn, cv, transparentHost } from '../lib/utils.js';
import { useIsMobile } from '../lib/use-mobile.js';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from './sheet.js';

const SIDEBAR_COOKIE_NAME = 'sidebar_state';
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = '16rem';
const SIDEBAR_WIDTH_MOBILE = '18rem';
const SIDEBAR_WIDTH_ICON = '3rem';
const SIDEBAR_KEYBOARD_SHORTCUT = 'b';

// ── Provider state (published on the <ui-sidebar-provider> host) ─────

export interface SidebarState {
  state: ReadonlySignal<'expanded' | 'collapsed'>;
  open: ReadonlySignal<boolean>;
  setOpen(open: boolean): void;
  openMobile: ReadonlySignal<boolean>;
  setOpenMobile(open: boolean): void;
  isMobile: ReadonlySignal<boolean>;
  toggleSidebar(): void;
}

/** Subtree-scoped channel from the Sidebar provider to its parts. */
const SidebarContext = createContext<SidebarState>('Sidebar', { providerTag: 'ui-sidebar-provider' });

// ── ui-sidebar-provider ──────────────────────────────────────────────

export type SidebarProviderProps = {
  open?: boolean;
  defaultOpen?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

const sidebarProviderAttrs = {
  defaultOpen: { type: 'boolean', default: true },
  className: 'string',
} satisfies ComponentAttrs<SidebarProviderProps>;

export const SidebarProvider = component<SidebarProviderProps, typeof sidebarProviderAttrs>(
  'ui-sidebar-provider',
  (props, host) => {
    transparentHost(host);

    // default-open is a DEFAULT-TRUE boolean seed; `open` is a factory-only
    // controlled override (no attribute source → undeclared, undefined-when-unset).
    const internal = signal<boolean>(Boolean(props.defaultOpen.value));
    const open = computed<boolean>(() => props.open.value ?? internal.value);
    const openMobile = signal<boolean>(false);
    const { isMobile } = useIsMobile();

    const setOpen = (next: boolean): void => {
      if (next !== open.value) {
        internal.value = next;
        host.dispatchEvent(
          new CustomEvent('ui-open-change', { detail: { open: next }, bubbles: true }),
        );
      }
      try {
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${next}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
      } catch {
        /* no document (SSG) — fine */
      }
    };
    const setOpenMobile = (next: boolean): void => {
      openMobile.value = next;
    };
    const toggleSidebar = (): void => {
      if (isMobile.value) setOpenMobile(!openMobile.value);
      else setOpen(!open.value);
    };

    const state: SidebarState = {
      state: computed(() => (open.value ? 'expanded' : 'collapsed')),
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      isMobile,
      toggleSidebar,
    };
    SidebarContext.provide(host, state);

    // Cmd/Ctrl+B toggles the sidebar.
    if (typeof window !== 'undefined') {
      useHostEvent(window, 'keydown', (event: Event) => {
        const e = event as KeyboardEvent;
        if (e.key === SIDEBAR_KEYBOARD_SHORTCUT && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          toggleSidebar();
        }
      });
    }

    const classes = computed(() =>
      cn('group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar', props.className.value),
    );

    return html`<div
      data-slot="sidebar-wrapper"
      style="${`--sidebar-width:${SIDEBAR_WIDTH};--sidebar-width-icon:${SIDEBAR_WIDTH_ICON}`}"
      class="${classes}"
    >${children()}</div>`;
  },
  { attrs: sidebarProviderAttrs },
);

// ── ui-sidebar (desktop frame) ───────────────────────────────────────

export type SidebarSide = 'left' | 'right';
export type SidebarVariant = 'sidebar' | 'floating' | 'inset';
export type SidebarCollapsible = 'offcanvas' | 'icon' | 'none';

export type SidebarProps = {
  side?: SidebarSide;
  variant?: SidebarVariant;
  collapsible?: SidebarCollapsible;
  className?: string;
  children?: string | TemplateResult;
};

const gapClasses = (variant: SidebarVariant): string =>
  cn(
    'relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear',
    'group-data-[collapsible=offcanvas]:w-0',
    'group-data-[side=right]:rotate-180',
    variant === 'floating' || variant === 'inset'
      ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]'
      : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)',
  );

const containerClasses = (side: SidebarSide, variant: SidebarVariant): string =>
  cn(
    'fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex',
    side === 'left'
      ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
      : 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
    variant === 'floating' || variant === 'inset'
      ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]'
      : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l',
  );

const sidebarAttrs = {
  side: 'string',
  variant: 'string',
  collapsible: 'string',
  className: 'string',
} satisfies ComponentAttrs<SidebarProps>;

export const Sidebar = component<SidebarProps, typeof sidebarAttrs>('ui-sidebar', (props, host) => {
  const state = SidebarContext.inject();
  transparentHost(host);

  const side = (props.side.value as SidebarSide) ?? 'left';
  const variant = (props.variant.value as SidebarVariant) ?? 'sidebar';
  const collapsible = (props.collapsible.value as SidebarCollapsible) ?? 'offcanvas';

  // Single-projection children, captured ONCE. It is placed into whichever tree
  // (collapsible=none / mobile Sheet / desktop frame) is live; a breakpoint flip
  // re-mounts it (ADR 0025 item-1 re-mountable slot + ADR 0023 move-resilience).
  const kids = children();

  if (collapsible === 'none') {
    const classes = computed(() =>
      cn('flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground', props.className.value),
    );
    return html`<div data-slot="sidebar" class="${classes}">${kids}</div>`;
  }

  const dataState = computed(() => state.state.value);
  const dataCollapsible = computed(() => (state.state.value === 'collapsed' ? collapsible : ''));
  const notMobile = computed(() => !state.isMobile.value);

  // The sheet's own dismissal (Escape / overlay click) dispatches a bubbling
  // ui-open-change from the (non-portaled) <ui-sheet> host; sync it back to the
  // provider's controlled openMobile so the frame closes. The desktop frame has
  // no <ui-sheet>, so this never fires there.
  useHostEvent(host, 'ui-open-change', (event: Event) => {
    const detail = (event as CustomEvent<{ open: boolean }>).detail;
    if (detail && state.isMobile.value) state.setOpenMobile(detail.open);
  });

  // Mobile: off-canvas Sheet, controlled by openMobile (upstream mobile branch).
  const mobileSidebar = (): TemplateResult =>
    Sheet({
      open: state.openMobile,
      children: SheetContent({
        side,
        showCloseButton: false,
        style: `--sidebar-width:${SIDEBAR_WIDTH_MOBILE}`,
        className:
          'w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden',
        children: html`${SheetHeader({
          className: 'sr-only',
          children: html`${SheetTitle({ children: 'Sidebar' })}${SheetDescription({
            children: 'Displays the mobile sidebar.',
          })}`,
        })}<div
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          class="flex h-full w-full flex-col"
        >${kids}</div>`,
      }),
    });

  // Desktop: the fixed frame.
  const desktopSidebar = (): TemplateResult => html`<div
    class="group peer hidden text-sidebar-foreground md:block"
    data-state="${dataState}"
    data-collapsible="${dataCollapsible}"
    data-variant="${variant}"
    data-side="${side}"
    data-slot="sidebar"
  >
    <div data-slot="sidebar-gap" class="${gapClasses(variant)}"></div>
    <div data-slot="sidebar-container" class="${cn(containerClasses(side, variant), props.className.value)}">
      <div
        data-sidebar="sidebar"
        data-slot="sidebar-inner"
        class="flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow-sm"
      >${kids}</div>
    </div>
  </div>`;

  return html`${when(state.isMobile, mobileSidebar)}${when(notMobile, desktopSidebar)}`;
}, { attrs: sidebarAttrs });

// ── ui-sidebar-trigger / -rail ───────────────────────────────────────

const panelLeftIcon = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 3v18"></path></svg>`;

export type SidebarTriggerProps = {
  className?: string;
  children?: string | TemplateResult;
};

const sidebarTriggerAttrs = { className: 'string' } satisfies ComponentAttrs<SidebarTriggerProps>;

export const SidebarTrigger = component<SidebarTriggerProps, typeof sidebarTriggerAttrs>(
  'ui-sidebar-trigger',
  (props, host) => {
    const state = SidebarContext.inject();
    transparentHost(host);
    const classes = computed(() =>
      cn(
        "inline-flex size-7 shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        props.className.value,
      ),
    );
    return html`<button
      type="button"
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      aria-label="Toggle Sidebar"
      class="${classes}"
      @click=${() => state.toggleSidebar()}
    >${panelLeftIcon}<span class="sr-only">Toggle Sidebar</span>${children()}</button>`;
  },
  { attrs: sidebarTriggerAttrs },
);

export type SidebarRailProps = {
  className?: string;
};

const sidebarRailAttrs = { className: 'string' } satisfies ComponentAttrs<SidebarRailProps>;

export const SidebarRail = component<SidebarRailProps, typeof sidebarRailAttrs>('ui-sidebar-rail', (props, host) => {
  const state = SidebarContext.inject();
  transparentHost(host);
  const classes = computed(() =>
    cn(
      'absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border sm:flex',
      'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
      '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
      'group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full hover:group-data-[collapsible=offcanvas]:bg-sidebar',
      '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
      '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
      props.className.value,
    ),
  );
  return html`<button
    type="button"
    data-sidebar="rail"
    data-slot="sidebar-rail"
    aria-label="Toggle Sidebar"
    tabindex="-1"
    title="Toggle Sidebar"
    class="${classes}"
    @click=${() => state.toggleSidebar()}
  ></button>`;
}, { attrs: sidebarRailAttrs });

// ── ui-sidebar-inset / -input / -header / -footer / -separator / -content

export type SidebarSectionProps = {
  className?: string;
  children?: string | TemplateResult;
};

const sidebarSectionAttrs = { className: 'string' } satisfies ComponentAttrs<SidebarSectionProps>;

function sidebarSection(
  tag: string,
  slot: string,
  sidebarAttr: string,
  base: string,
  element: 'div' | 'main' = 'div',
) {
  return component<SidebarSectionProps, typeof sidebarSectionAttrs>(tag, (props, host) => {
    transparentHost(host);
    const classes = computed(() => cn(base, props.className.value));
    return element === 'main'
      ? html`<main data-slot="${slot}" data-sidebar="${sidebarAttr}" class="${classes}">${children()}</main>`
      : html`<div data-slot="${slot}" data-sidebar="${sidebarAttr}" class="${classes}">${children()}</div>`;
  }, { attrs: sidebarSectionAttrs });
}

export const SidebarInset = sidebarSection(
  'ui-sidebar-inset',
  'sidebar-inset',
  'inset',
  'relative flex w-full flex-1 flex-col bg-background md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2',
  'main',
);

export const SidebarHeader = sidebarSection(
  'ui-sidebar-header',
  'sidebar-header',
  'header',
  'flex flex-col gap-2 p-2',
);

export const SidebarFooter = sidebarSection(
  'ui-sidebar-footer',
  'sidebar-footer',
  'footer',
  'flex flex-col gap-2 p-2',
);

export const SidebarContent = sidebarSection(
  'ui-sidebar-content',
  'sidebar-content',
  'content',
  'flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden',
);

export type SidebarInputProps = {
  type?: string;
  placeholder?: string;
  className?: string;
};

const sidebarInputAttrs = {
  type: 'string',
  placeholder: 'string',
  className: 'string',
} satisfies ComponentAttrs<SidebarInputProps>;

export const SidebarInput = component<SidebarInputProps, typeof sidebarInputAttrs>('ui-sidebar-input', (props, host) => {
  transparentHost(host);
  const classes = computed(() =>
    cn(
      'flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
      props.className.value,
    ),
  );
  return html`<input
    data-slot="sidebar-input"
    data-sidebar="input"
    type="${computed(() => props.type.value ?? 'text')}"
    placeholder="${props.placeholder}"
    class="${classes}"
  />`;
}, { attrs: sidebarInputAttrs });

export type SidebarSeparatorProps = { className?: string };

const sidebarSeparatorAttrs = { className: 'string' } satisfies ComponentAttrs<SidebarSeparatorProps>;

export const SidebarSeparator = component<SidebarSeparatorProps, typeof sidebarSeparatorAttrs>(
  'ui-sidebar-separator',
  (props, host) => {
    transparentHost(host);
    // Base separator classes + the sidebar override (upstream wraps <Separator>).
    const classes = computed(() =>
      cn('shrink-0 bg-border h-px w-full', 'mx-2 w-auto bg-sidebar-border', props.className.value),
    );
    return html`<div
      role="none"
      data-slot="sidebar-separator"
      data-sidebar="separator"
      data-orientation="horizontal"
      class="${classes}"
    ></div>`;
  },
  { attrs: sidebarSeparatorAttrs },
);

// ── Group family: ui-sidebar-group / -group-label / -group-action / -group-content

export const SidebarGroup = sidebarSection(
  'ui-sidebar-group',
  'sidebar-group',
  'group',
  'relative flex w-full min-w-0 flex-col p-2',
);

const sidebarGroupLabelAttrs = { className: 'string' } satisfies ComponentAttrs<SidebarSectionProps>;

export const SidebarGroupLabel = component<SidebarSectionProps, typeof sidebarGroupLabelAttrs>(
  'ui-sidebar-group-label',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() =>
      cn(
        'flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 ring-sidebar-ring outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        'group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0',
        props.className.value,
      ),
    );
    return html`<div data-slot="sidebar-group-label" data-sidebar="group-label" class="${classes}">${children()}</div>`;
  },
  { attrs: sidebarGroupLabelAttrs },
);

const sidebarGroupActionAttrs = { className: 'string' } satisfies ComponentAttrs<SidebarSectionProps>;

export const SidebarGroupAction = component<SidebarSectionProps, typeof sidebarGroupActionAttrs>(
  'ui-sidebar-group-action',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() =>
      cn(
        'absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        'after:absolute after:-inset-2 md:after:hidden',
        'group-data-[collapsible=icon]:hidden',
        props.className.value,
      ),
    );
    return html`<button type="button" data-slot="sidebar-group-action" data-sidebar="group-action" class="${classes}">${children()}</button>`;
  },
  { attrs: sidebarGroupActionAttrs },
);

export const SidebarGroupContent = sidebarSection(
  'ui-sidebar-group-content',
  'sidebar-group-content',
  'group-content',
  'w-full text-sm',
);

// ── Menu: ui-sidebar-menu / -menu-item ───────────────────────────────

const sidebarMenuAttrs = { className: 'string' } satisfies ComponentAttrs<SidebarSectionProps>;

export const SidebarMenu = component<SidebarSectionProps, typeof sidebarMenuAttrs>('ui-sidebar-menu', (props, host) => {
  transparentHost(host);
  const classes = computed(() => cn('flex w-full min-w-0 flex-col gap-1', props.className.value));
  return html`<ul data-slot="sidebar-menu" data-sidebar="menu" class="${classes}">${children()}</ul>`;
}, { attrs: sidebarMenuAttrs });

const sidebarMenuItemAttrs = { className: 'string' } satisfies ComponentAttrs<SidebarSectionProps>;

export const SidebarMenuItem = component<SidebarSectionProps, typeof sidebarMenuItemAttrs>(
  'ui-sidebar-menu-item',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() => cn('group/menu-item relative', props.className.value));
    return html`<li data-slot="sidebar-menu-item" data-sidebar="menu-item" class="${classes}">${children()}</li>`;
  },
  { attrs: sidebarMenuItemAttrs },
);

// ── ui-sidebar-menu-button ───────────────────────────────────────────

export const sidebarMenuButtonVariants = cv(
  'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding] group-has-data-[sidebar=menu-action]/menu-item:pr-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        outline:
          'bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_var(--sidebar-accent)]',
      },
      size: {
        default: 'h-8 text-sm',
        sm: 'h-7 text-xs',
        lg: 'h-12 text-sm group-data-[collapsible=icon]:p-0!',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type SidebarMenuButtonVariant = 'default' | 'outline';
export type SidebarMenuButtonSize = 'default' | 'sm' | 'lg';

export type SidebarMenuButtonProps = {
  isActive?: boolean;
  variant?: SidebarMenuButtonVariant;
  size?: SidebarMenuButtonSize;
  className?: string;
  children?: string | TemplateResult;
};

const sidebarMenuButtonAttrs = {
  isActive: 'boolean',
  variant: 'string',
  size: 'string',
  className: 'string',
} satisfies ComponentAttrs<SidebarMenuButtonProps>;

export const SidebarMenuButton = component<SidebarMenuButtonProps, typeof sidebarMenuButtonAttrs>(
  'ui-sidebar-menu-button',
  (props, host) => {
    transparentHost(host);
    const isActive = computed<boolean>(() => props.isActive.value);
    const classes = computed(() =>
      cn(
        sidebarMenuButtonVariants({
          variant: props.variant.value ?? 'default',
          size: props.size.value ?? 'default',
        }),
        props.className.value,
      ),
    );
    return html`<button
      type="button"
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size="${computed(() => props.size.value ?? 'default')}"
      data-active="${computed(() => (isActive.value ? 'true' : 'false'))}"
      class="${classes}"
    >${children()}</button>`;
  },
  { attrs: sidebarMenuButtonAttrs },
);

// ── ui-sidebar-menu-action / -menu-badge / -menu-skeleton ────────────

export type SidebarMenuActionProps = {
  showOnHover?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

const sidebarMenuActionAttrs = {
  showOnHover: 'boolean',
  className: 'string',
} satisfies ComponentAttrs<SidebarMenuActionProps>;

export const SidebarMenuAction = component<SidebarMenuActionProps, typeof sidebarMenuActionAttrs>(
  'ui-sidebar-menu-action',
  (props, host) => {
    transparentHost(host);
    const showOnHover = computed<boolean>(() => props.showOnHover.value);
    const classes = computed(() =>
      cn(
        'absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform peer-hover/menu-button:text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        'after:absolute after:-inset-2 md:after:hidden',
        'peer-data-[size=sm]/menu-button:top-1',
        'peer-data-[size=default]/menu-button:top-1.5',
        'peer-data-[size=lg]/menu-button:top-2.5',
        'group-data-[collapsible=icon]:hidden',
        showOnHover.value &&
          'group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground data-[state=open]:opacity-100 md:opacity-0',
        props.className.value,
      ),
    );
    return html`<button type="button" data-slot="sidebar-menu-action" data-sidebar="menu-action" class="${classes}">${children()}</button>`;
  },
  { attrs: sidebarMenuActionAttrs },
);

const sidebarMenuBadgeAttrs = { className: 'string' } satisfies ComponentAttrs<SidebarSectionProps>;

export const SidebarMenuBadge = component<SidebarSectionProps, typeof sidebarMenuBadgeAttrs>(
  'ui-sidebar-menu-badge',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() =>
      cn(
        'pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium text-sidebar-foreground tabular-nums select-none',
        'peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground',
        'peer-data-[size=sm]/menu-button:top-1',
        'peer-data-[size=default]/menu-button:top-1.5',
        'peer-data-[size=lg]/menu-button:top-2.5',
        'group-data-[collapsible=icon]:hidden',
        props.className.value,
      ),
    );
    return html`<div data-slot="sidebar-menu-badge" data-sidebar="menu-badge" class="${classes}">${children()}</div>`;
  },
  { attrs: sidebarMenuBadgeAttrs },
);

export type SidebarMenuSkeletonProps = {
  showIcon?: boolean;
  /** The text placeholder width. Upstream randomizes it; kept fixed here so
   * static (SSG) renders are deterministic. */
  width?: string;
  className?: string;
};

const sidebarMenuSkeletonAttrs = {
  showIcon: 'boolean',
  width: 'string',
  className: 'string',
} satisfies ComponentAttrs<SidebarMenuSkeletonProps>;

export const SidebarMenuSkeleton = component<SidebarMenuSkeletonProps, typeof sidebarMenuSkeletonAttrs>(
  'ui-sidebar-menu-skeleton',
  (props, host) => {
    transparentHost(host);
    const showIcon = computed<boolean>(() => props.showIcon.value);
    const classes = computed(() =>
      cn('flex h-8 items-center gap-2 rounded-md px-2', props.className.value),
    );
    return html`<div data-slot="sidebar-menu-skeleton" data-sidebar="menu-skeleton" class="${classes}">${when(
      showIcon,
      () =>
        html`<div class="animate-pulse rounded-md bg-accent size-4" data-sidebar="menu-skeleton-icon"></div>`,
    )}<div
        class="animate-pulse rounded-md bg-accent h-4 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style="${computed(() => `--skeleton-width:${props.width.value ?? '70%'}`)}"
      ></div></div>`;
  },
  { attrs: sidebarMenuSkeletonAttrs },
);

// ── ui-sidebar-menu-sub / -menu-sub-item / -menu-sub-button ──────────

const sidebarMenuSubAttrs = { className: 'string' } satisfies ComponentAttrs<SidebarSectionProps>;

export const SidebarMenuSub = component<SidebarSectionProps, typeof sidebarMenuSubAttrs>(
  'ui-sidebar-menu-sub',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() =>
      cn(
        'mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5',
        'group-data-[collapsible=icon]:hidden',
        props.className.value,
      ),
    );
    return html`<ul data-slot="sidebar-menu-sub" data-sidebar="menu-sub" class="${classes}">${children()}</ul>`;
  },
  { attrs: sidebarMenuSubAttrs },
);

const sidebarMenuSubItemAttrs = { className: 'string' } satisfies ComponentAttrs<SidebarSectionProps>;

export const SidebarMenuSubItem = component<SidebarSectionProps, typeof sidebarMenuSubItemAttrs>(
  'ui-sidebar-menu-sub-item',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() => cn('group/menu-sub-item relative', props.className.value));
    return html`<li data-slot="sidebar-menu-sub-item" data-sidebar="menu-sub-item" class="${classes}">${children()}</li>`;
  },
  { attrs: sidebarMenuSubItemAttrs },
);

export type SidebarMenuSubButtonProps = {
  size?: 'sm' | 'md';
  isActive?: boolean;
  href?: string;
  className?: string;
  children?: string | TemplateResult;
};

const sidebarMenuSubButtonAttrs = {
  size: 'string',
  isActive: 'boolean',
  href: 'string',
  className: 'string',
} satisfies ComponentAttrs<SidebarMenuSubButtonProps>;

export const SidebarMenuSubButton = component<SidebarMenuSubButtonProps, typeof sidebarMenuSubButtonAttrs>(
  'ui-sidebar-menu-sub-button',
  (props, host) => {
    transparentHost(host);
    const isActive = computed<boolean>(() => props.isActive.value);
    const classes = computed(() =>
      cn(
        'flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground ring-sidebar-ring outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground',
        'data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground',
        (props.size.value ?? 'md') === 'sm' && 'text-xs',
        (props.size.value ?? 'md') === 'md' && 'text-sm',
        'group-data-[collapsible=icon]:hidden',
        props.className.value,
      ),
    );
    return html`<a
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size="${computed(() => props.size.value ?? 'md')}"
      data-active="${computed(() => (isActive.value ? 'true' : 'false'))}"
      href="${props.href}"
      class="${classes}"
    >${children()}</a>`;
  },
  { attrs: sidebarMenuSubButtonAttrs },
);
