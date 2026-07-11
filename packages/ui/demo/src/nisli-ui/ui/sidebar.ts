/**
 * ui/sidebar.ts — Sidebar.
 *
 * Ported from new-york-v4/ui/sidebar.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui).
 * The class lists, data-slot / data-sidebar / data-state / data-collapsible /
 * data-variant / data-side attributes, the --sidebar-width* CSS vars, and the
 * whole part family are ported verbatim; the provider state is rebuilt on the
 * `__uiSidebar` host-state convention.
 *
 * Provider: open/collapsed state with cookie persistence, a Cmd/Ctrl+B keyboard
 * shortcut, and an `isMobile` signal (matchMedia). The desktop `Sidebar` frame
 * supports the side / variant / collapsible variants via data-* attributes and
 * the group-data Tailwind selectors.
 *
 * v1 deviations (documented):
 * - The dedicated MOBILE off-canvas Sheet is deferred. Upstream conditionally
 *   renders a completely different tree on mobile; that fights Nisli's
 *   single-projection children model. The provider still exposes
 *   isMobile/openMobile/toggle so the API is forward-compatible, and the
 *   desktop `collapsible="offcanvas"` variant provides a CSS-driven collapse.
 * - `asChild` is not supported (Nisli renders the native element directly).
 * - No tooltip on a collapsed menu button.
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
  useHostEvent,
  when,
  type ReadonlySignal,
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
import { useIsMobile } from '../lib/use-mobile.js';

const SIDEBAR_COOKIE_NAME = 'sidebar_state';
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = '16rem';
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

type SidebarHost = HTMLElement & { __uiSidebar?: SidebarState };

function useSidebar(host: HTMLElement, tag: string): SidebarState {
  const state = (host.closest('ui-sidebar-provider') as SidebarHost | null)?.__uiSidebar;
  if (!state) {
    throw new Error(`<${tag}> must be used inside <ui-sidebar-provider>.`);
  }
  return state;
}

// ── ui-sidebar-provider ──────────────────────────────────────────────

export type SidebarProviderProps = {
  open?: boolean;
  defaultOpen?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const SidebarProvider = component<SidebarProviderProps>(
  'ui-sidebar-provider',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);

    const internal = signal<boolean>(
      props.defaultOpen.value ?? (host.hasAttribute('default-open') ? host.getAttribute('default-open') !== 'false' : true),
    );
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
    (host as SidebarHost).__uiSidebar = state;

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

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn('group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar', className.value),
    );

    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<div
      ref="${root}"
      data-slot="sidebar-wrapper"
      style="${`--sidebar-width:${SIDEBAR_WIDTH};--sidebar-width-icon:${SIDEBAR_WIDTH_ICON}`}"
      class="${classes}"
    >${props.children}</div>`;
  },
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

export const Sidebar = component<SidebarProps>('ui-sidebar', (props, host) => {
  const state = useSidebar(host, 'ui-sidebar');
  transparentHost(host);
  const projected = captureChildren(host);

  const side = (attr(props.side, host, 'side').value as SidebarSide) ?? 'left';
  const variant = (attr(props.variant, host, 'variant').value as SidebarVariant) ?? 'sidebar';
  const collapsible =
    (attr(props.collapsible, host, 'collapsible').value as SidebarCollapsible) ?? 'offcanvas';

  const className = attr(props.className, host, 'class-name');
  const root = ref<HTMLDivElement>();
  const inner = ref<HTMLDivElement>();

  onMount(() => {
    const target = inner.current ?? root.current;
    if (target) projectChildren(host, target, projected);
  });

  if (collapsible === 'none') {
    const classes = computed(() =>
      cn('flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground', className.value),
    );
    return html`<div ref="${root}" data-slot="sidebar" class="${classes}">${props.children}</div>`;
  }

  const dataState = computed(() => state.state.value);
  const dataCollapsible = computed(() => (state.state.value === 'collapsed' ? collapsible : ''));

  return html`<div
    class="group peer hidden text-sidebar-foreground md:block"
    data-state="${dataState}"
    data-collapsible="${dataCollapsible}"
    data-variant="${variant}"
    data-side="${side}"
    data-slot="sidebar"
  >
    <div data-slot="sidebar-gap" class="${gapClasses(variant)}"></div>
    <div data-slot="sidebar-container" class="${cn(containerClasses(side, variant), className.value)}">
      <div
        ref="${inner}"
        data-sidebar="sidebar"
        data-slot="sidebar-inner"
        class="flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow-sm"
      >${props.children}</div>
    </div>
  </div>`;
});

// ── ui-sidebar-trigger / -rail ───────────────────────────────────────

const panelLeftIcon = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 3v18"></path></svg>`;

export type SidebarTriggerProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const SidebarTrigger = component<SidebarTriggerProps>(
  'ui-sidebar-trigger',
  (props, host) => {
    const state = useSidebar(host, 'ui-sidebar-trigger');
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        "inline-flex size-7 shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className.value,
      ),
    );
    const root = ref<HTMLButtonElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<button
      ref="${root}"
      type="button"
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      aria-label="Toggle Sidebar"
      class="${classes}"
      @click=${() => state.toggleSidebar()}
    >${panelLeftIcon}<span class="sr-only">Toggle Sidebar</span>${props.children}</button>`;
  },
);

export type SidebarRailProps = {
  className?: string;
};

export const SidebarRail = component<SidebarRailProps>('ui-sidebar-rail', (props, host) => {
  const state = useSidebar(host, 'ui-sidebar-rail');
  transparentHost(host);
  const className = attr(props.className, host, 'class-name');
  const classes = computed(() =>
    cn(
      'absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border sm:flex',
      'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
      '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
      'group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full hover:group-data-[collapsible=offcanvas]:bg-sidebar',
      '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
      '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
      className.value,
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
});

// ── ui-sidebar-inset / -input / -header / -footer / -separator / -content

export type SidebarSectionProps = {
  className?: string;
  children?: string | TemplateResult;
};

function sidebarSection(
  tag: string,
  slot: string,
  sidebarAttr: string,
  base: string,
  element: 'div' | 'main' = 'div',
) {
  return component<SidebarSectionProps>(tag, (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(base, className.value));
    const root = ref<HTMLElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return element === 'main'
      ? html`<main ref="${root}" data-slot="${slot}" data-sidebar="${sidebarAttr}" class="${classes}">${props.children}</main>`
      : html`<div ref="${root}" data-slot="${slot}" data-sidebar="${sidebarAttr}" class="${classes}">${props.children}</div>`;
  });
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

export const SidebarInput = component<SidebarInputProps>('ui-sidebar-input', (props, host) => {
  transparentHost(host);
  const type = attr(props.type, host, 'type');
  const placeholder = attr(props.placeholder, host, 'placeholder');
  const className = attr(props.className, host, 'class-name');
  const classes = computed(() =>
    cn(
      'flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
      className.value,
    ),
  );
  return html`<input
    data-slot="sidebar-input"
    data-sidebar="input"
    type="${computed(() => type.value ?? 'text')}"
    placeholder="${placeholder}"
    class="${classes}"
  />`;
});

export type SidebarSeparatorProps = { className?: string };

export const SidebarSeparator = component<SidebarSeparatorProps>(
  'ui-sidebar-separator',
  (props, host) => {
    transparentHost(host);
    const className = attr(props.className, host, 'class-name');
    // Base separator classes + the sidebar override (upstream wraps <Separator>).
    const classes = computed(() =>
      cn('shrink-0 bg-border h-px w-full', 'mx-2 w-auto bg-sidebar-border', className.value),
    );
    return html`<div
      role="none"
      data-slot="sidebar-separator"
      data-sidebar="separator"
      data-orientation="horizontal"
      class="${classes}"
    ></div>`;
  },
);

// ── Group family: ui-sidebar-group / -group-label / -group-action / -group-content

export const SidebarGroup = sidebarSection(
  'ui-sidebar-group',
  'sidebar-group',
  'group',
  'relative flex w-full min-w-0 flex-col p-2',
);

export const SidebarGroupLabel = component<SidebarSectionProps>(
  'ui-sidebar-group-label',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        'flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 ring-sidebar-ring outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        'group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0',
        className.value,
      ),
    );
    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<div ref="${root}" data-slot="sidebar-group-label" data-sidebar="group-label" class="${classes}">${props.children}</div>`;
  },
);

export const SidebarGroupAction = component<SidebarSectionProps>(
  'ui-sidebar-group-action',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        'absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        'after:absolute after:-inset-2 md:after:hidden',
        'group-data-[collapsible=icon]:hidden',
        className.value,
      ),
    );
    const root = ref<HTMLButtonElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<button ref="${root}" type="button" data-slot="sidebar-group-action" data-sidebar="group-action" class="${classes}">${props.children}</button>`;
  },
);

export const SidebarGroupContent = sidebarSection(
  'ui-sidebar-group-content',
  'sidebar-group-content',
  'group-content',
  'w-full text-sm',
);

// ── Menu: ui-sidebar-menu / -menu-item ───────────────────────────────

export const SidebarMenu = component<SidebarSectionProps>('ui-sidebar-menu', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);
  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn('flex w-full min-w-0 flex-col gap-1', className.value));
  const root = ref<HTMLUListElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });
  return html`<ul ref="${root}" data-slot="sidebar-menu" data-sidebar="menu" class="${classes}">${props.children}</ul>`;
});

export const SidebarMenuItem = component<SidebarSectionProps>(
  'ui-sidebar-menu-item',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn('group/menu-item relative', className.value));
    const root = ref<HTMLLIElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<li ref="${root}" data-slot="sidebar-menu-item" data-sidebar="menu-item" class="${classes}">${props.children}</li>`;
  },
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

export const SidebarMenuButton = component<SidebarMenuButtonProps>(
  'ui-sidebar-menu-button',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const isActive = boolAttr(props.isActive, host, 'is-active');
    const variant = attr(props.variant, host, 'variant');
    const size = attr(props.size, host, 'size');
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        sidebarMenuButtonVariants({
          variant: variant.value ?? 'default',
          size: size.value ?? 'default',
        }),
        className.value,
      ),
    );
    const root = ref<HTMLButtonElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<button
      ref="${root}"
      type="button"
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size="${computed(() => size.value ?? 'default')}"
      data-active="${computed(() => (isActive.value ? 'true' : 'false'))}"
      class="${classes}"
    >${props.children}</button>`;
  },
);

// ── ui-sidebar-menu-action / -menu-badge / -menu-skeleton ────────────

export type SidebarMenuActionProps = {
  showOnHover?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const SidebarMenuAction = component<SidebarMenuActionProps>(
  'ui-sidebar-menu-action',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const showOnHover = boolAttr(props.showOnHover, host, 'show-on-hover');
    const className = attr(props.className, host, 'class-name');
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
        className.value,
      ),
    );
    const root = ref<HTMLButtonElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<button ref="${root}" type="button" data-slot="sidebar-menu-action" data-sidebar="menu-action" class="${classes}">${props.children}</button>`;
  },
);

export const SidebarMenuBadge = component<SidebarSectionProps>(
  'ui-sidebar-menu-badge',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        'pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium text-sidebar-foreground tabular-nums select-none',
        'peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground',
        'peer-data-[size=sm]/menu-button:top-1',
        'peer-data-[size=default]/menu-button:top-1.5',
        'peer-data-[size=lg]/menu-button:top-2.5',
        'group-data-[collapsible=icon]:hidden',
        className.value,
      ),
    );
    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<div ref="${root}" data-slot="sidebar-menu-badge" data-sidebar="menu-badge" class="${classes}">${props.children}</div>`;
  },
);

export type SidebarMenuSkeletonProps = {
  showIcon?: boolean;
  /** The text placeholder width. Upstream randomizes it; kept fixed here so
   * static (SSG) renders are deterministic. */
  width?: string;
  className?: string;
};

export const SidebarMenuSkeleton = component<SidebarMenuSkeletonProps>(
  'ui-sidebar-menu-skeleton',
  (props, host) => {
    transparentHost(host);
    const showIcon = boolAttr(props.showIcon, host, 'show-icon');
    const width = attr(props.width, host, 'width');
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn('flex h-8 items-center gap-2 rounded-md px-2', className.value),
    );
    return html`<div data-slot="sidebar-menu-skeleton" data-sidebar="menu-skeleton" class="${classes}">${when(
      showIcon,
      () =>
        html`<div class="animate-pulse rounded-md bg-accent size-4" data-sidebar="menu-skeleton-icon"></div>`,
    )}<div
        class="animate-pulse rounded-md bg-accent h-4 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style="${computed(() => `--skeleton-width:${width.value ?? '70%'}`)}"
      ></div></div>`;
  },
);

// ── ui-sidebar-menu-sub / -menu-sub-item / -menu-sub-button ──────────

export const SidebarMenuSub = component<SidebarSectionProps>(
  'ui-sidebar-menu-sub',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        'mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5',
        'group-data-[collapsible=icon]:hidden',
        className.value,
      ),
    );
    const root = ref<HTMLUListElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<ul ref="${root}" data-slot="sidebar-menu-sub" data-sidebar="menu-sub" class="${classes}">${props.children}</ul>`;
  },
);

export const SidebarMenuSubItem = component<SidebarSectionProps>(
  'ui-sidebar-menu-sub-item',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn('group/menu-sub-item relative', className.value));
    const root = ref<HTMLLIElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<li ref="${root}" data-slot="sidebar-menu-sub-item" data-sidebar="menu-sub-item" class="${classes}">${props.children}</li>`;
  },
);

export type SidebarMenuSubButtonProps = {
  size?: 'sm' | 'md';
  isActive?: boolean;
  href?: string;
  className?: string;
  children?: string | TemplateResult;
};

export const SidebarMenuSubButton = component<SidebarMenuSubButtonProps>(
  'ui-sidebar-menu-sub-button',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const size = attr(props.size, host, 'size');
    const isActive = boolAttr(props.isActive, host, 'is-active');
    const href = attr(props.href, host, 'href');
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        'flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground ring-sidebar-ring outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground',
        'data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground',
        (size.value ?? 'md') === 'sm' && 'text-xs',
        (size.value ?? 'md') === 'md' && 'text-sm',
        'group-data-[collapsible=icon]:hidden',
        className.value,
      ),
    );
    const root = ref<HTMLAnchorElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<a
      ref="${root}"
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size="${computed(() => size.value ?? 'md')}"
      data-active="${computed(() => (isActive.value ? 'true' : 'false'))}"
      href="${href}"
      class="${classes}"
    >${props.children}</a>`;
  },
);
