/**
 * ui/menubar.ts — Menubar.
 *
 * Ported from new-york-v4/ui/menubar.tsx (shadcn/ui, MIT —
 * https://github.com/shadcn-ui/ui) and the Radix Menubar behavior it wraps
 * (MIT — https://github.com/radix-ui/primitives), rebuilt as Nisli custom
 * elements. A horizontal bar (role=menubar) of menus, each a role=menu surface
 * reusing the same machinery as dropdown-menu (floating + dismissable-layer +
 * focus + vertical roving + typeahead over item text).
 *
 * WAI-ARIA menubar: the triggers are role=menuitem with horizontal roving
 * (ArrowLeft/ArrowRight/Home/End); ArrowDown/Enter/Space opens a menu focused
 * on its first item. Once any menu is open, focus-follows on the bar —
 * ArrowLeft/ArrowRight inside a menu (or hovering another trigger) closes the
 * current menu and opens the sibling. Escape closes the open menu and returns
 * focus to its trigger. Submenus (ui-menubar-sub) nest with the same
 * hover/keyboard model as dropdown-menu.
 *
 * v1 limits (documented): no portal (position:fixed, same transformed-ancestor
 * caveat as ui-dialog); focus is contained (Tab wraps) rather than closing.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  component,
  computed,
  effect,
  html,
  onCleanup,
  onMount,
  ref,
  signal,
  when,
  type ReadonlySignal,
  type Ref,
  type TemplateResult,
} from '@nisli/core';
import {
  attr,
  boolAttr,
  captureChildren,
  cn,
  projectChildren,
  transparentHost,
} from '../lib/utils.js';
import { positionFloating, type Align, type Side } from '../lib/floating.js';
import { dismissableLayer } from '../lib/dismissable-layer.js';
import { focusTrap } from '../lib/focus.js';
import { rovingFocus } from '../lib/roving-focus.js';
import { typeahead } from '../lib/typeahead.js';

// ── Icons (literal SVG — the parser namespaces them) ─────────────────

const checkIcon = html`<svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>`;
const circleIcon = html`<svg class="size-2 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle></svg>`;
const chevronRightIcon = html`<svg class="ml-auto h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>`;

const stateAttr = (open: boolean) => (open ? 'open' : 'closed');
const ITEM_SELECTOR = '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]';
const TRIGGER_SELECTOR = '[data-slot="menubar-trigger"]';

// ── Bar state (published on the <ui-menubar> host) ───────────────────

export interface MenubarState {
  openMenuId: ReadonlySignal<string | null>;
  setOpenMenu(id: string | null): void;
  bar: Ref<HTMLElement>;
  /** Close the menu `fromId` and open the sibling in the given direction. */
  moveMenu(fromId: string, dir: 1 | -1): void;
  /** Make `el` the single tab stop among the bar's triggers. */
  focusTrigger(el: HTMLElement): void;
}
type MenubarHost = HTMLElement & { __uiMenubar?: MenubarState };

function useMenubar(host: HTMLElement, tag: string): MenubarState {
  const bar = (host.closest('ui-menubar') as MenubarHost | null)?.__uiMenubar;
  if (!bar) throw new Error(`<${tag}> must be used inside <ui-menubar>.`);
  return bar;
}

// ── Menu scope state (published on each <ui-menubar-menu> host) ───────

export interface MenubarMenuState {
  open: ReadonlySignal<boolean>;
  setOpen(open: boolean): void;
  baseId: string;
  menuId: string;
  trigger: Ref<HTMLElement>;
}
type MenubarMenuHost = HTMLElement & { __uiMenubarMenu?: MenubarMenuState };

function useMenu(host: HTMLElement, tag: string): MenubarMenuState {
  const menu = (host.closest('ui-menubar-menu') as MenubarMenuHost | null)?.__uiMenubarMenu;
  if (!menu) throw new Error(`<${tag}> must be used inside <ui-menubar-menu>.`);
  return menu;
}

let uid = 0;

// ── ui-menubar (root bar) ────────────────────────────────────────────

export type MenubarProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const Menubar = component<MenubarProps>('ui-menubar', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);

  const openMenuId = signal<string | null>(null);
  const bar = ref<HTMLElement>();

  const triggers = (): HTMLElement[] =>
    bar.current ? Array.from(bar.current.querySelectorAll<HTMLElement>(TRIGGER_SELECTOR)) : [];

  const focusTrigger = (el: HTMLElement): void => {
    for (const t of triggers()) t.setAttribute('tabindex', t === el ? '0' : '-1');
    el.focus();
  };

  const state: MenubarState = {
    openMenuId,
    setOpenMenu: (id) => {
      openMenuId.value = id;
    },
    bar,
    moveMenu: (fromId, dir) => {
      const list = triggers();
      const idx = list.findIndex((t) => t.getAttribute('data-menu-id') === fromId);
      if (idx < 0 || list.length === 0) return;
      const target = list[(idx + dir + list.length) % list.length];
      const targetId = target?.getAttribute('data-menu-id');
      if (targetId) openMenuId.value = targetId;
    },
    focusTrigger,
  };
  (host as MenubarHost).__uiMenubar = state;

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() =>
    cn('flex h-9 items-center gap-1 rounded-md border bg-background p-1 shadow-xs', className.value),
  );

  onMount(() => {
    if (bar.current) {
      projectChildren(host, bar.current, projected);
      // First trigger is the initial tab stop (roving).
      const list = triggers();
      list.forEach((t, i) => t.setAttribute('tabindex', i === 0 ? '0' : '-1'));
    }
  });

  return html`<div ref="${bar}" role="menubar" data-slot="menubar" class="${classes}">${props.children}</div>`;
});

// ── ui-menubar-menu (per-menu scope) ─────────────────────────────────

export type MenubarMenuProps = {
  value?: string;
  className?: string;
  children?: string | TemplateResult;
};

export const MenubarMenu = component<MenubarMenuProps>('ui-menubar-menu', (props, host) => {
  const barState = useMenubar(host, 'ui-menubar-menu');
  transparentHost(host);
  const projected = captureChildren(host);

  const menuId = `ui-menubar-menu-${++uid}`;
  const open = computed<boolean>(() => barState.openMenuId.value === menuId);
  const setOpen = (next: boolean): void => {
    if (next) barState.setOpenMenu(menuId);
    else if (barState.openMenuId.value === menuId) barState.setOpenMenu(null);
  };

  const state: MenubarMenuState = {
    open,
    setOpen,
    baseId: menuId,
    menuId,
    trigger: ref<HTMLElement>(),
  };
  (host as MenubarMenuHost).__uiMenubarMenu = state;

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn(className.value));
  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<div ref="${root}" data-slot="menubar-menu" style="display:contents" class="${classes}">${props.children}</div>`;
});

// ── ui-menubar-trigger ───────────────────────────────────────────────

const triggerClasses =
  'flex items-center rounded-sm px-2 py-1 text-sm font-medium outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground';

export type MenubarTriggerProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const MenubarTrigger = component<MenubarTriggerProps>(
  'ui-menubar-trigger',
  (props, host) => {
    const bar = useMenubar(host, 'ui-menubar-trigger');
    const menu = useMenu(host, 'ui-menubar-trigger');
    transparentHost(host);
    const projected = captureChildren(host);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(triggerClasses, className.value));

    const root = ref<HTMLButtonElement>();
    onMount(() => {
      if (root.current) {
        projectChildren(host, root.current, projected);
        menu.trigger.current = root.current;
      }
    });

    const siblings = (): HTMLElement[] =>
      bar.bar.current
        ? Array.from(bar.bar.current.querySelectorAll<HTMLElement>(TRIGGER_SELECTOR))
        : [];

    const onKeyDown = (event: KeyboardEvent): void => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowLeft':
        case 'Home':
        case 'End': {
          event.preventDefault();
          const list = siblings();
          const i = list.indexOf(root.current as HTMLElement);
          const n = list.length;
          let t = i;
          if (event.key === 'ArrowRight') t = (i + 1) % n;
          else if (event.key === 'ArrowLeft') t = (i - 1 + n) % n;
          else if (event.key === 'Home') t = 0;
          else t = n - 1;
          const target = list[t];
          if (target) bar.focusTrigger(target);
          break;
        }
        case 'ArrowDown':
        case 'Enter':
        case ' ':
          event.preventDefault();
          menu.setOpen(true);
          break;
      }
    };

    return html`<button
      ref="${root}"
      type="button"
      role="menuitem"
      data-slot="menubar-trigger"
      data-menu-id="${menu.menuId}"
      aria-haspopup="menu"
      aria-controls="${`${menu.baseId}-content`}"
      aria-expanded="${computed(() => (menu.open.value ? 'true' : 'false'))}"
      data-state="${computed(() => stateAttr(menu.open.value))}"
      tabindex="-1"
      class="${classes}"
      @click=${() => menu.setOpen(!menu.open.value)}
      @focus=${() => bar.focusTrigger(root.current as HTMLElement)}
      @pointerenter=${() => {
        // Open-follows-focus: hovering another trigger while a menu is open
        // switches to this menu.
        if (bar.openMenuId.value != null) menu.setOpen(true);
      }}
      @keydown=${onKeyDown}
    >${props.children}</button>`;
  },
);

// ── Shared menu-surface wiring (root content + submenu content) ──────

interface MenuSurfaceConfig {
  content: Ref<HTMLElement>;
  open: ReadonlySignal<boolean>;
  close: () => void;
  anchor: () => HTMLElement | null;
  placement: () => { side: Side; align: Align; sideOffset: number; alignOffset: number };
  useTrap: boolean;
  returnFocus?: Ref<HTMLElement>;
  triggerExclude: () => HTMLElement | null;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
}

function wireMenuSurface(cfg: MenuSurfaceConfig): {
  onKeyDown: (event: KeyboardEvent) => void;
  onPointerOver: (event: PointerEvent) => void;
} {
  const { content } = cfg;
  const allItems = (): HTMLElement[] =>
    content.current
      ? Array.from(content.current.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter(
          (el) => el.closest('[role="menu"]') === content.current,
        )
      : [];
  const isDisabled = (el: HTMLElement) => el.getAttribute('aria-disabled') === 'true';
  const enabledItems = (): HTMLElement[] => allItems().filter((el) => !isDisabled(el));

  const applyHighlight = (activeEl: HTMLElement | null): void => {
    for (const el of allItems()) {
      const on = el === activeEl;
      el.setAttribute('tabindex', on ? '0' : '-1');
      if (on) el.setAttribute('data-highlighted', '');
      else el.removeAttribute('data-highlighted');
    }
  };

  const roving = rovingFocus(allItems, {
    orientation: 'vertical',
    loop: false,
    onActiveChange: (_index, el) => applyHighlight(el),
  });
  const search = typeahead();

  const focusItem = (el: HTMLElement | undefined): void => {
    if (!el) return;
    const idx = allItems().indexOf(el);
    if (idx >= 0) roving.setActiveIndex(idx);
    el.focus();
    applyHighlight(el);
  };

  const layer = dismissableLayer(content, {
    onDismiss: cfg.close,
    onPointerDownOutside: (event) => {
      const t = cfg.triggerExclude();
      if (t && t.contains(event.target as Node)) event.preventDefault();
    },
  });
  const trap = cfg.useTrap ? focusTrap(content, { returnFocus: cfg.returnFocus }) : null;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (cfg.onArrowLeft && event.key === 'ArrowLeft') {
      event.preventDefault();
      event.stopPropagation();
      cfg.onArrowLeft();
      return;
    }
    if (cfg.onArrowRight && event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      cfg.onArrowRight();
      return;
    }
    if (roving.onKeydown(event)) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      (document.activeElement as HTMLElement | null)?.click();
      return;
    }
    const list = allItems();
    const current = list.indexOf(document.activeElement as HTMLElement);
    const match = search.onKey(event.key, list.map((el) => el.textContent?.trim() ?? ''), current);
    if (match >= 0) {
      event.preventDefault();
      focusItem(list[match]);
    }
  };

  const onPointerOver = (event: PointerEvent): void => {
    const item = (event.target as HTMLElement)?.closest<HTMLElement>(ITEM_SELECTOR);
    if (item && item.closest('[role="menu"]') === content.current && !isDisabled(item)) {
      focusItem(item);
    }
  };

  let disposePosition: (() => void) | null = null;
  const stopPositioning = (): void => {
    disposePosition?.();
    disposePosition = null;
  };

  effect(() => {
    if (cfg.open.value) {
      layer.activate();
      queueMicrotask(() => {
        if (!cfg.open.value) return;
        const anchor = cfg.anchor();
        if (anchor && content.current) {
          stopPositioning();
          disposePosition = positionFloating(anchor, content.current, cfg.placement());
        }
        trap?.activate();
        const list = enabledItems();
        focusItem(list[0]);
      });
    } else {
      trap?.deactivate();
      layer.deactivate();
      stopPositioning();
      search.reset();
    }
  });
  onCleanup(stopPositioning);

  return { onKeyDown, onPointerOver };
}

// ── ui-menubar-content ───────────────────────────────────────────────

const contentClasses =
  'z-50 min-w-[12rem] origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95';

export type MenubarContentProps = {
  align?: Align;
  alignOffset?: number;
  sideOffset?: number;
  className?: string;
  children?: string | TemplateResult;
};

export const MenubarContent = component<MenubarContentProps>(
  'ui-menubar-content',
  (props, host) => {
    const bar = useMenubar(host, 'ui-menubar-content');
    const menu = useMenu(host, 'ui-menubar-content');
    transparentHost(host);
    const projected = captureChildren(host);

    const alignAttr = attr(props.align, host, 'align');
    const align = computed<Align>(() => (alignAttr.value as Align) ?? 'start');
    const alignOffset = computed<number>(() => props.alignOffset.value ?? -4);
    const sideOffset = computed<number>(() => props.sideOffset.value ?? 8);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(contentClasses, className.value));
    const contentId = `${menu.baseId}-content`;

    const content = ref<HTMLElement>();
    const closeAndFocusTrigger = (): void => {
      menu.setOpen(false);
      menu.trigger.current?.focus();
    };
    const { onKeyDown, onPointerOver } = wireMenuSurface({
      content,
      open: menu.open,
      close: closeAndFocusTrigger,
      anchor: () => menu.trigger.current,
      placement: () => ({
        side: 'bottom',
        align: align.value,
        sideOffset: sideOffset.value,
        alignOffset: alignOffset.value,
      }),
      useTrap: true,
      returnFocus: menu.trigger,
      triggerExclude: () => menu.trigger.current,
      // At the top level of a menu, Left/Right move between menubar menus.
      onArrowLeft: () => bar.moveMenu(menu.menuId, -1),
      onArrowRight: () => bar.moveMenu(menu.menuId, 1),
    });

    onMount(() => {
      if (content.current) projectChildren(host, content.current, projected);
    });

    return html`<div
      ref="${content}"
      role="menu"
      data-slot="menubar-content"
      id="${contentId}"
      data-state="${computed(() => stateAttr(menu.open.value))}"
      hidden="${computed(() => !menu.open.value)}"
      tabindex="-1"
      class="${classes}"
      @keydown=${onKeyDown}
      @pointerover=${onPointerOver}
    >${props.children}</div>`;
  },
);

// ── Item selection helper ────────────────────────────────────────────

function emitSelect(host: HTMLElement, el: HTMLElement, value: string | undefined): void {
  const event = new CustomEvent('ui-select', { detail: { value }, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  if (!event.defaultPrevented) {
    const menu = (host.closest('ui-menubar-menu') as MenubarMenuHost | null)?.__uiMenubarMenu;
    menu?.setOpen(false);
  }
}

// ── ui-menubar-item ──────────────────────────────────────────────────

const itemClasses =
  "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!";

export type MenubarItemProps = {
  inset?: boolean;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  value?: string;
  className?: string;
  children?: string | TemplateResult;
};

export const MenubarItem = component<MenubarItemProps>('ui-menubar-item', (props, host) => {
  useMenu(host, 'ui-menubar-item');
  transparentHost(host);
  const projected = captureChildren(host);

  const inset = boolAttr(props.inset, host, 'inset');
  const variant = attr(props.variant, host, 'variant');
  const disabled = boolAttr(props.disabled, host, 'disabled');
  const value = attr(props.value, host, 'value');

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn(itemClasses, className.value));

  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  const onClick = (): void => {
    if (disabled.value || !root.current) return;
    emitSelect(host, root.current, value.value);
  };

  return html`<div
    ref="${root}"
    role="menuitem"
    data-slot="menubar-item"
    data-inset="${computed(() => (inset.value ? '' : undefined))}"
    data-variant="${computed(() => variant.value ?? 'default')}"
    data-disabled="${computed(() => (disabled.value ? '' : undefined))}"
    aria-disabled="${computed(() => (disabled.value ? 'true' : undefined))}"
    tabindex="-1"
    class="${classes}"
    @click=${onClick}
  >${props.children}</div>`;
});

// ── ui-menubar-checkbox-item / radio-group / radio-item ──────────────

const checkableItemClasses =
  "relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
const indicatorSpan = 'pointer-events-none absolute left-2 flex size-3.5 items-center justify-center';

export type MenubarCheckboxItemProps = {
  checked?: boolean;
  disabled?: boolean;
  value?: string;
  className?: string;
  children?: string | TemplateResult;
};

export const MenubarCheckboxItem = component<MenubarCheckboxItemProps>(
  'ui-menubar-checkbox-item',
  (props, host) => {
    useMenu(host, 'ui-menubar-checkbox-item');
    transparentHost(host);
    const projected = captureChildren(host);

    const disabled = boolAttr(props.disabled, host, 'disabled');
    const value = attr(props.value, host, 'value');
    const controlled = props.checked;
    const internal = signal<boolean>(Boolean(props.checked.value ?? host.hasAttribute('checked')));
    const checked = computed<boolean>(() => controlled.value ?? internal.value);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(checkableItemClasses, className.value));

    const item = ref<HTMLDivElement>();
    const label = ref<HTMLSpanElement>();
    onMount(() => {
      if (label.current) projectChildren(host, label.current, projected);
    });

    const onClick = (): void => {
      if (disabled.value || !item.current) return;
      internal.value = !checked.value;
      emitSelect(host, item.current, value.value);
    };

    return html`<div
      ref="${item}"
      role="menuitemcheckbox"
      data-slot="menubar-checkbox-item"
      aria-checked="${computed(() => (checked.value ? 'true' : 'false'))}"
      data-disabled="${computed(() => (disabled.value ? '' : undefined))}"
      aria-disabled="${computed(() => (disabled.value ? 'true' : undefined))}"
      tabindex="-1"
      class="${classes}"
      @click=${onClick}
    ><span class="${indicatorSpan}">${when(checked, () => checkIcon)}</span><span ref="${label}" style="display:contents">${props.children}</span></div>`;
  },
);

export interface MenubarRadioGroupState {
  value: ReadonlySignal<string>;
  setValue(value: string): void;
}
type RadioGroupHost = HTMLElement & { __uiMenubarRadioGroup?: MenubarRadioGroupState };

export type MenubarRadioGroupProps = {
  value?: string;
  defaultValue?: string;
  className?: string;
  children?: string | TemplateResult;
};

export const MenubarRadioGroup = component<MenubarRadioGroupProps>(
  'ui-menubar-radio-group',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);

    const internal = signal<string>(props.defaultValue.value ?? host.getAttribute('default-value') ?? '');
    const value = computed<string>(() => props.value.value ?? internal.value);
    (host as RadioGroupHost).__uiMenubarRadioGroup = {
      value,
      setValue: (v) => {
        internal.value = v;
      },
    };

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(className.value));
    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<div ref="${root}" role="group" data-slot="menubar-radio-group" style="display:contents" class="${classes}">${props.children}</div>`;
  },
);

export type MenubarRadioItemProps = {
  value?: string;
  disabled?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const MenubarRadioItem = component<MenubarRadioItemProps>(
  'ui-menubar-radio-item',
  (props, host) => {
    useMenu(host, 'ui-menubar-radio-item');
    const group = (host.closest('ui-menubar-radio-group') as RadioGroupHost | null)
      ?.__uiMenubarRadioGroup;
    transparentHost(host);
    const projected = captureChildren(host);

    const disabled = boolAttr(props.disabled, host, 'disabled');
    const value = attr(props.value, host, 'value');
    const checked = computed<boolean>(() => group != null && group.value.value === (value.value ?? ''));

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(checkableItemClasses, className.value));

    const item = ref<HTMLDivElement>();
    const label = ref<HTMLSpanElement>();
    onMount(() => {
      if (label.current) projectChildren(host, label.current, projected);
    });

    const onClick = (): void => {
      if (disabled.value || !item.current) return;
      group?.setValue(value.value ?? '');
      emitSelect(host, item.current, value.value);
    };

    return html`<div
      ref="${item}"
      role="menuitemradio"
      data-slot="menubar-radio-item"
      aria-checked="${computed(() => (checked.value ? 'true' : 'false'))}"
      data-disabled="${computed(() => (disabled.value ? '' : undefined))}"
      aria-disabled="${computed(() => (disabled.value ? 'true' : undefined))}"
      tabindex="-1"
      class="${classes}"
      @click=${onClick}
    ><span class="${indicatorSpan}">${when(checked, () => circleIcon)}</span><span ref="${label}" style="display:contents">${props.children}</span></div>`;
  },
);

// ── ui-menubar-label / -separator / -shortcut / -group ───────────────

export type MenubarLabelProps = {
  inset?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const MenubarLabel = component<MenubarLabelProps>('ui-menubar-label', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);
  const inset = boolAttr(props.inset, host, 'inset');
  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn('px-2 py-1.5 text-sm font-medium data-[inset]:pl-8', className.value));
  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });
  return html`<div
    ref="${root}"
    data-slot="menubar-label"
    data-inset="${computed(() => (inset.value ? '' : undefined))}"
    class="${classes}"
  >${props.children}</div>`;
});

export type MenubarSeparatorProps = { className?: string };

export const MenubarSeparator = component<MenubarSeparatorProps>(
  'ui-menubar-separator',
  (props, host) => {
    transparentHost(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn('-mx-1 my-1 h-px bg-border', className.value));
    return html`<div role="separator" aria-orientation="horizontal" data-slot="menubar-separator" class="${classes}"></div>`;
  },
);

export type MenubarShortcutProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const MenubarShortcut = component<MenubarShortcutProps>(
  'ui-menubar-shortcut',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn('ml-auto text-xs tracking-widest text-muted-foreground', className.value),
    );
    const root = ref<HTMLSpanElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<span ref="${root}" data-slot="menubar-shortcut" class="${classes}">${props.children}</span>`;
  },
);

export type MenubarGroupProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const MenubarGroup = component<MenubarGroupProps>('ui-menubar-group', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);
  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn(className.value));
  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });
  return html`<div ref="${root}" role="group" data-slot="menubar-group" style="display:contents" class="${classes}">${props.children}</div>`;
});

// ── Submenu: ui-menubar-sub / -sub-trigger / -sub-content ────────────

const HOVER_DELAY = 100;
let subUid = 0;

export interface MenubarSubState {
  open: ReadonlySignal<boolean>;
  setOpen(open: boolean): void;
  baseId: string;
  trigger: Ref<HTMLElement>;
  hoverOpen(): void;
  hoverClose(): void;
  hoverCancel(): void;
}
type SubHost = HTMLElement & { __uiMenubarSub?: MenubarSubState };

function useSubState(host: HTMLElement, tag: string): MenubarSubState {
  const sub = (host.closest('ui-menubar-sub') as SubHost | null)?.__uiMenubarSub;
  if (!sub) throw new Error(`<${tag}> must be used inside <ui-menubar-sub>.`);
  return sub;
}

/** Nearest ancestor scope open signal (enclosing submenu, else the menu). */
function resolveParentOpen(host: HTMLElement): ReadonlySignal<boolean> {
  let el: HTMLElement | null = host.parentElement;
  while (el) {
    const sub = (el as SubHost).__uiMenubarSub;
    if (sub) return sub.open;
    const menu = (el as MenubarMenuHost).__uiMenubarMenu;
    if (menu) return menu.open;
    el = el.parentElement;
  }
  return computed(() => false);
}

export type MenubarSubProps = {
  open?: boolean;
  defaultOpen?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const MenubarSub = component<MenubarSubProps>('ui-menubar-sub', (props, host) => {
  useMenu(host, 'ui-menubar-sub');
  transparentHost(host);
  const projected = captureChildren(host);

  const parentOpen = resolveParentOpen(host);
  const internal = signal<boolean>(Boolean(props.defaultOpen.value ?? host.hasAttribute('default-open')));
  const desired = computed<boolean>(() => props.open.value ?? internal.value);
  const open = computed<boolean>(() => desired.value && parentOpen.value);
  const setOpen = (next: boolean): void => {
    if (next === desired.value) return;
    internal.value = next;
  };

  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const clearTimers = (): void => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
  };

  const state: MenubarSubState = {
    open,
    setOpen,
    baseId: `ui-menubar-sub-${++subUid}`,
    trigger: ref<HTMLElement>(),
    hoverOpen: () => {
      clearTimeout(closeTimer);
      openTimer = setTimeout(() => setOpen(true), HOVER_DELAY);
    },
    hoverClose: () => {
      clearTimeout(openTimer);
      closeTimer = setTimeout(() => setOpen(false), HOVER_DELAY);
    },
    hoverCancel: clearTimers,
  };
  (host as SubHost).__uiMenubarSub = state;
  onCleanup(clearTimers);

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn(className.value));
  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<div ref="${root}" data-slot="menubar-sub" style="display:contents" class="${classes}">${props.children}</div>`;
});

const subTriggerClasses =
  'flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground';

export type MenubarSubTriggerProps = {
  inset?: boolean;
  disabled?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const MenubarSubTrigger = component<MenubarSubTriggerProps>(
  'ui-menubar-sub-trigger',
  (props, host) => {
    const sub = useSubState(host, 'ui-menubar-sub-trigger');
    transparentHost(host);
    const projected = captureChildren(host);

    const inset = boolAttr(props.inset, host, 'inset');
    const disabled = boolAttr(props.disabled, host, 'disabled');
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(subTriggerClasses, className.value));

    const item = ref<HTMLDivElement>();
    const label = ref<HTMLSpanElement>();
    onMount(() => {
      if (label.current) projectChildren(host, label.current, projected);
      if (item.current) sub.trigger.current = item.current;
    });

    const onKeyDown = (event: KeyboardEvent): void => {
      if (disabled.value) return;
      if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        sub.hoverCancel();
        sub.setOpen(true);
      }
    };

    return html`<div
      ref="${item}"
      role="menuitem"
      data-slot="menubar-sub-trigger"
      aria-haspopup="menu"
      aria-expanded="${computed(() => (sub.open.value ? 'true' : 'false'))}"
      aria-controls="${`${sub.baseId}-content`}"
      data-state="${computed(() => stateAttr(sub.open.value))}"
      data-inset="${computed(() => (inset.value ? '' : undefined))}"
      data-disabled="${computed(() => (disabled.value ? '' : undefined))}"
      aria-disabled="${computed(() => (disabled.value ? 'true' : undefined))}"
      tabindex="-1"
      class="${classes}"
      @click=${() => {
        if (!disabled.value) sub.setOpen(true);
      }}
      @pointerenter=${() => {
        if (!disabled.value) {
          sub.hoverOpen();
          item.current?.focus();
        }
      }}
      @pointerleave=${() => sub.hoverClose()}
      @keydown=${onKeyDown}
    ><span ref="${label}" style="display:contents">${props.children}</span>${chevronRightIcon}</div>`;
  },
);

const subContentClasses =
  'z-50 min-w-[8rem] origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95';

export type MenubarSubContentProps = {
  sideOffset?: number;
  className?: string;
  children?: string | TemplateResult;
};

export const MenubarSubContent = component<MenubarSubContentProps>(
  'ui-menubar-sub-content',
  (props, host) => {
    const sub = useSubState(host, 'ui-menubar-sub-content');
    transparentHost(host);
    const projected = captureChildren(host);

    const sideOffset = computed<number>(() => props.sideOffset.value ?? 0);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(subContentClasses, className.value));
    const contentId = `${sub.baseId}-content`;

    const content = ref<HTMLElement>();
    const closeAndFocusTrigger = (): void => {
      sub.setOpen(false);
      sub.trigger.current?.focus();
    };
    const { onKeyDown, onPointerOver } = wireMenuSurface({
      content,
      open: sub.open,
      close: closeAndFocusTrigger,
      anchor: () => sub.trigger.current,
      placement: () => ({ side: 'right', align: 'start', sideOffset: sideOffset.value, alignOffset: 0 }),
      useTrap: false,
      triggerExclude: () => sub.trigger.current,
      onArrowLeft: closeAndFocusTrigger,
    });

    onMount(() => {
      if (content.current) projectChildren(host, content.current, projected);
    });

    return html`<div
      ref="${content}"
      role="menu"
      data-slot="menubar-sub-content"
      id="${contentId}"
      data-state="${computed(() => stateAttr(sub.open.value))}"
      hidden="${computed(() => !sub.open.value)}"
      tabindex="-1"
      class="${classes}"
      @keydown=${onKeyDown}
      @pointerover=${onPointerOver}
      @pointerenter=${() => sub.hoverCancel()}
      @pointerleave=${() => sub.hoverClose()}
    >${props.children}</div>`;
  },
);
