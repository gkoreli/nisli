/**
 * ui/context-menu.ts — Context Menu.
 *
 * Ported from new-york-v4/ui/context-menu.tsx (shadcn/ui, MIT —
 * https://github.com/shadcn-ui/ui) and the Radix ContextMenu behavior it
 * wraps (MIT — https://github.com/radix-ui/primitives), rebuilt as Nisli
 * custom elements. Submenu elements (ui-context-menu-sub/-sub-trigger/
 * -sub-content) are defined in the Submenu section near the end of this file.
 *
 * Unlike a dropdown menu there is no trigger button: ui-context-menu-trigger
 * is an area that opens the menu on a right-click (`contextmenu` event),
 * positioned at the pointer via a virtual anchor rect (a getBoundingClientRect
 * shim over the cursor coords — lib/floating is not modified). Otherwise the
 * content is the same role=menu surface positioned with the floating lib,
 * dismissed via dismissable-layer (LIFO Escape), focus-contained via the focus
 * lib, navigated with vertical roving-focus (no wrap) + typeahead over item
 * text. Items are role=menuitem/-checkbox/-radio; data-highlighted tracks the
 * focused item; pointerenter focuses. Activating an item dispatches a
 * cancelable bubbling `ui-select` CustomEvent — unless a listener calls
 * preventDefault, the whole menu then closes.
 *
 * By default the content and sub-content are moved to `document.body` on mount
 * via the `portal` lib item, so their `position: fixed` escapes transformed
 * ancestors (pass `portal={false}` / `portal="false"` per surface to render
 * inline). Floating placement, dismissal, roving focus, and typeahead all
 * operate by reference, so they survive the move. SSG note: portaled content
 * escapes the static snapshot (client-only, matching upstream); use
 * `portal={false}` if needed.
 *
 * v1 limits (documented): focus is contained (Tab wraps) rather than closing
 * the menu as Radix does.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  component,
  createContext,
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
import { portal } from '../lib/portal.js';
import { dismissableLayer } from '../lib/dismissable-layer.js';
import { focusTrap } from '../lib/focus.js';
import { rovingFocus } from '../lib/roving-focus.js';
import { typeahead } from '../lib/typeahead.js';

// ── Icons (literal SVG — the parser namespaces them) ─────────────────

const checkIcon = html`<svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>`;
const circleIcon = html`<svg class="size-2 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle></svg>`;

// ── Shared root state (published on the <ui-context-menu> host) ─────

export interface ContextMenuState {
  open: ReadonlySignal<boolean>;
  setOpen(open: boolean): void;
  /** Open the menu anchored at viewport coordinates (the pointer). */
  openAt(x: number, y: number): void;
  baseId: string;
  /** The <ui-context-menu> host — the stable dispatch anchor for ui-select
   * once the (portaled) content no longer bubbles through it. */
  rootHost: HTMLElement;
  /** Last pointer coordinates the menu was opened at. */
  x: number;
  y: number;
}

/** Menu state — trigger/content/items/sub resolve it. */
const ContextMenuContext = createContext<ContextMenuState>('ContextMenu', { providerTag: 'ui-context-menu' });

let uid = 0;

const stateAttr = (open: boolean) => (open ? 'open' : 'closed');

const ITEM_SELECTOR =
  '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]';

// ── ui-context-menu (root) ──────────────────────────────────────────

export type ContextMenuProps = {
  open?: boolean;
  defaultOpen?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const ContextMenu = component<ContextMenuProps>(
  'ui-context-menu',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);

    const initialOpen =
      props.defaultOpen.value ??
      props.open.value ??
      (host.hasAttribute('open') || host.hasAttribute('default-open'));
    const internal = signal<boolean>(Boolean(initialOpen));
    const open = computed<boolean>(() => props.open.value ?? internal.value);

    const setOpen = (next: boolean): void => {
      if (next === open.value) return;
      internal.value = next;
      host.dispatchEvent(
        new CustomEvent('ui-open-change', { detail: { open: next }, bubbles: true }),
      );
    };

    const state: ContextMenuState = {
      open,
      setOpen,
      openAt: (x: number, y: number) => {
        // A right-click's pointerdown fires first and dismisses any open menu
        // via the layer, so by the time `contextmenu` calls this the menu is
        // closed — we just record the fresh coords and open.
        state.x = x;
        state.y = y;
        setOpen(true);
      },
      baseId: `ui-context-menu-${++uid}`,
      rootHost: host,
      x: 0,
      y: 0,
    };
    ContextMenuContext.provide(host, state);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(className.value));

    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<div
      ref="${root}"
      data-slot="context-menu"
      style="display:contents"
      class="${classes}"
    >${props.children}</div>`;
  },
);

// ── ui-context-menu-trigger ─────────────────────────────────────────

export type ContextMenuTriggerProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const ContextMenuTrigger = component<ContextMenuTriggerProps>(
  'ui-context-menu-trigger',
  (props, host) => {
    const state = ContextMenuContext.inject();
    transparentHost(host);
    const projected = captureChildren(host);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(className.value));

    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    // Right-click anywhere in the trigger area opens the menu at the pointer.
    const onContextMenu = (event: MouseEvent): void => {
      event.preventDefault();
      state.openAt(event.clientX, event.clientY);
    };

    return html`<div
      ref="${root}"
      data-slot="context-menu-trigger"
      aria-controls="${`${state.baseId}-content`}"
      data-state="${computed(() => stateAttr(state.open.value))}"
      class="${classes}"
      @contextmenu=${onContextMenu}
    >${props.children}</div>`;
  },
);

// ── ui-context-menu-content ─────────────────────────────────────────

const contentClasses =
  'z-50 max-h-(--radix-context-menu-content-available-height) min-w-[8rem] origin-(--radix-context-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95';

export type ContextMenuContentProps = {
  side?: Side;
  align?: Align;
  sideOffset?: number;
  /**
   * Move the content to `document.body` so `position: fixed` escapes
   * transformed ancestors. Defaults to true; pass false to render inline.
   */
  portal?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

/**
 * Wire the shared behavior of a menu surface (root content or submenu content):
 * floating placement, dismissable-layer, optional focus trap, vertical roving
 * focus with data-highlighted, typeahead, and pointerover focus. Returns the
 * keydown/pointerover handlers to bind to the surface element.
 */
interface MenuSurfaceConfig {
  content: Ref<HTMLElement>;
  open: ReadonlySignal<boolean>;
  /** Close this surface (and, for a submenu, restore focus to its trigger). */
  close: () => void;
  anchor: () => HTMLElement | null;
  placement: () => { side: Side; align: Align; sideOffset: number };
  /** Where to place focus on open; read once per open. */
  focusIntent: () => 'first' | 'last';
  afterOpen?: () => void;
  useTrap: boolean;
  returnFocus?: Ref<HTMLElement>;
  /** The surface's own trigger — excluded from outside-pointer dismissal. */
  triggerExclude: () => HTMLElement | null;
  /** ArrowLeft handler (submenus close themselves). */
  onArrowLeft?: () => void;
}

function wireMenuSurface(cfg: MenuSurfaceConfig): {
  onKeyDown: (event: KeyboardEvent) => void;
  onPointerOver: (event: PointerEvent) => void;
} {
  const { content } = cfg;
  // Only items belonging to THIS menu — not ones nested in a submenu, whose
  // nearest [role=menu] ancestor is that submenu's content.
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
    if (roving.onKeydown(event)) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      (document.activeElement as HTMLElement | null)?.click();
      return;
    }
    const items = allItems();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const match = search.onKey(
      event.key,
      items.map((el) => el.textContent?.trim() ?? ''),
      current,
    );
    if (match >= 0) {
      event.preventDefault();
      focusItem(items[match]);
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
      const intent = cfg.focusIntent();
      queueMicrotask(() => {
        if (!cfg.open.value) return;
        const anchor = cfg.anchor();
        if (anchor && content.current) {
          stopPositioning();
          disposePosition = positionFloating(anchor, content.current, cfg.placement());
        }
        trap?.activate();
        const items = enabledItems();
        focusItem(intent === 'last' ? items[items.length - 1] : items[0]);
        cfg.afterOpen?.();
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

export const ContextMenuContent = component<ContextMenuContentProps>(
  'ui-context-menu-content',
  (props, host) => {
    const state = ContextMenuContext.inject();
    transparentHost(host);
    const projected = captureChildren(host);

    const sideAttr = attr(props.side, host, 'side');
    const alignAttr = attr(props.align, host, 'align');
    const side = computed<Side>(() => (sideAttr.value as Side) ?? 'bottom');
    const align = computed<Align>(() => (alignAttr.value as Align) ?? 'start');
    const sideOffset = computed<number>(() => props.sideOffset.value ?? 0);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(contentClasses, className.value));
    const contentId = `${state.baseId}-content`;

    // A virtual anchor: a getBoundingClientRect shim over the cursor point, so
    // the floating lib places the menu at the pointer (lib/floating unchanged).
    const cursorAnchor = (): HTMLElement =>
      ({
        getBoundingClientRect: () => ({
          x: state.x,
          y: state.y,
          top: state.y,
          left: state.x,
          right: state.x,
          bottom: state.y,
          width: 0,
          height: 0,
          toJSON: () => ({}),
        }),
      }) as unknown as HTMLElement;

    const content = ref<HTMLElement>();
    // Portal the menu surface to <body> (default on) so its fixed positioning
    // escapes transformed ancestors; the wired behavior operates by reference.
    const portalEnabled =
      props.portal.value ?? (host.getAttribute('portal') === 'false' ? false : true);
    portal(content, { enabled: portalEnabled });
    const { onKeyDown, onPointerOver } = wireMenuSurface({
      content,
      open: state.open,
      close: () => state.setOpen(false),
      anchor: cursorAnchor,
      placement: () => ({ side: side.value, align: align.value, sideOffset: sideOffset.value }),
      focusIntent: () => 'first',
      useTrap: true,
      triggerExclude: () => null,
    });

    onMount(() => {
      if (content.current) projectChildren(host, content.current, projected);
    });

    return html`<div
      ref="${content}"
      role="menu"
      data-slot="context-menu-content"
      id="${contentId}"
      data-state="${computed(() => stateAttr(state.open.value))}"
      hidden="${computed(() => !state.open.value)}"
      tabindex="-1"
      class="${classes}"
      @keydown=${onKeyDown}
      @pointerover=${onPointerOver}
    >${props.children}</div>`;
  },
);

// ── Item selection helper ────────────────────────────────────────────

/** Dispatch a cancelable `ui-select`; close the whole menu unless prevented. */
function emitSelect(state: ContextMenuState, value: string | undefined): void {
  const event = new CustomEvent('ui-select', {
    detail: { value },
    bubbles: true,
    cancelable: true,
  });
  // Dispatch on the root host, not the item: once the content is portaled to
  // <body> the item no longer bubbles through <ui-context-menu>.
  state.rootHost.dispatchEvent(event);
  if (!event.defaultPrevented) state.setOpen(false);
}

// ── ui-context-menu-item ────────────────────────────────────────────

const itemClasses =
  "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!";

export type ContextMenuItemProps = {
  inset?: boolean;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  /** Emitted as `ui-select` detail.value when the item is activated. */
  value?: string;
  className?: string;
  children?: string | TemplateResult;
};

export const ContextMenuItem = component<ContextMenuItemProps>(
  'ui-context-menu-item',
  (props, host) => {
    const state = ContextMenuContext.inject();
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
      emitSelect(state, value.value);
    };

    return html`<div
      ref="${root}"
      role="menuitem"
      data-slot="context-menu-item"
      data-inset="${computed(() => (inset.value ? '' : undefined))}"
      data-variant="${computed(() => variant.value ?? 'default')}"
      data-disabled="${computed(() => (disabled.value ? '' : undefined))}"
      aria-disabled="${computed(() => (disabled.value ? 'true' : undefined))}"
      tabindex="-1"
      class="${classes}"
      @click=${onClick}
    >${props.children}</div>`;
  },
);

// ── ui-context-menu-checkbox-item ───────────────────────────────────

const checkboxItemClasses =
  "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const indicatorSpan = 'pointer-events-none absolute left-2 flex size-3.5 items-center justify-center';

export type ContextMenuCheckboxItemProps = {
  checked?: boolean;
  disabled?: boolean;
  value?: string;
  className?: string;
  children?: string | TemplateResult;
};

export const ContextMenuCheckboxItem = component<ContextMenuCheckboxItemProps>(
  'ui-context-menu-checkbox-item',
  (props, host) => {
    const state = ContextMenuContext.inject();
    transparentHost(host);
    const projected = captureChildren(host);

    const disabled = boolAttr(props.disabled, host, 'disabled');
    const value = attr(props.value, host, 'value');
    const controlled = props.checked;
    const internal = signal<boolean>(Boolean(props.checked.value ?? host.hasAttribute('checked')));
    const checked = computed<boolean>(() => controlled.value ?? internal.value);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(checkboxItemClasses, className.value));

    const item = ref<HTMLDivElement>();
    const label = ref<HTMLSpanElement>();
    onMount(() => {
      if (label.current) projectChildren(host, label.current, projected);
    });

    const onClick = (): void => {
      if (disabled.value || !item.current) return;
      internal.value = !checked.value;
      emitSelect(state, value.value);
    };

    return html`<div
      ref="${item}"
      role="menuitemcheckbox"
      data-slot="context-menu-checkbox-item"
      aria-checked="${computed(() => (checked.value ? 'true' : 'false'))}"
      data-disabled="${computed(() => (disabled.value ? '' : undefined))}"
      aria-disabled="${computed(() => (disabled.value ? 'true' : undefined))}"
      tabindex="-1"
      class="${classes}"
      @click=${onClick}
    ><span class="${indicatorSpan}">${when(checked, () => checkIcon)}</span><span ref="${label}" style="display:contents">${props.children}</span></div>`;
  },
);

// ── ui-context-menu-radio-group + radio-item ────────────────────────

export interface ContextMenuRadioGroupState {
  value: ReadonlySignal<string>;
  setValue(value: string): void;
}
/** Radio-group value scope — its radio items resolve it. */
const ContextMenuRadioGroupContext = createContext<ContextMenuRadioGroupState>('ContextMenuRadioGroup', { providerTag: 'ui-context-menu-radio-group' });

export type ContextMenuRadioGroupProps = {
  value?: string;
  defaultValue?: string;
  className?: string;
  children?: string | TemplateResult;
};

export const ContextMenuRadioGroup = component<ContextMenuRadioGroupProps>(
  'ui-context-menu-radio-group',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);

    const internal = signal<string>(props.defaultValue.value ?? host.getAttribute('default-value') ?? '');
    const value = computed<string>(() => props.value.value ?? internal.value);
    const setValue = (v: string): void => {
      internal.value = v;
    };
    ContextMenuRadioGroupContext.provide(host, { value, setValue });

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(className.value));

    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<div ref="${root}" role="group" data-slot="context-menu-radio-group" style="display:contents" class="${classes}">${props.children}</div>`;
  },
);

const radioItemClasses = checkboxItemClasses;

export type ContextMenuRadioItemProps = {
  value?: string;
  disabled?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const ContextMenuRadioItem = component<ContextMenuRadioItemProps>(
  'ui-context-menu-radio-item',
  (props, host) => {
    const state = ContextMenuContext.inject();
    const group = ContextMenuRadioGroupContext.inject.optional();
    transparentHost(host);
    const projected = captureChildren(host);

    const disabled = boolAttr(props.disabled, host, 'disabled');
    const value = attr(props.value, host, 'value');
    const checked = computed<boolean>(() => group != null && group.value.value === (value.value ?? ''));

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(radioItemClasses, className.value));

    const item = ref<HTMLDivElement>();
    const label = ref<HTMLSpanElement>();
    onMount(() => {
      if (label.current) projectChildren(host, label.current, projected);
    });

    const onClick = (): void => {
      if (disabled.value || !item.current) return;
      group?.setValue(value.value ?? '');
      emitSelect(state, value.value);
    };

    return html`<div
      ref="${item}"
      role="menuitemradio"
      data-slot="context-menu-radio-item"
      aria-checked="${computed(() => (checked.value ? 'true' : 'false'))}"
      data-disabled="${computed(() => (disabled.value ? '' : undefined))}"
      aria-disabled="${computed(() => (disabled.value ? 'true' : undefined))}"
      tabindex="-1"
      class="${classes}"
      @click=${onClick}
    ><span class="${indicatorSpan}">${when(checked, () => circleIcon)}</span><span ref="${label}" style="display:contents">${props.children}</span></div>`;
  },
);

// ── ui-context-menu-label / -separator / -shortcut / -group ─────────

export type ContextMenuLabelProps = {
  inset?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const ContextMenuLabel = component<ContextMenuLabelProps>(
  'ui-context-menu-label',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const inset = boolAttr(props.inset, host, 'inset');
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn('px-2 py-1.5 text-sm font-medium text-foreground data-[inset]:pl-8', className.value),
    );
    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<div
      ref="${root}"
      data-slot="context-menu-label"
      data-inset="${computed(() => (inset.value ? '' : undefined))}"
      class="${classes}"
    >${props.children}</div>`;
  },
);

export type ContextMenuSeparatorProps = { className?: string };

export const ContextMenuSeparator = component<ContextMenuSeparatorProps>(
  'ui-context-menu-separator',
  (props, host) => {
    transparentHost(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn('-mx-1 my-1 h-px bg-border', className.value));
    return html`<div role="separator" aria-orientation="horizontal" data-slot="context-menu-separator" class="${classes}"></div>`;
  },
);

export type ContextMenuShortcutProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const ContextMenuShortcut = component<ContextMenuShortcutProps>(
  'ui-context-menu-shortcut',
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
    return html`<span ref="${root}" data-slot="context-menu-shortcut" class="${classes}">${props.children}</span>`;
  },
);

export type ContextMenuGroupProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const ContextMenuGroup = component<ContextMenuGroupProps>(
  'ui-context-menu-group',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(className.value));
    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<div ref="${root}" role="group" data-slot="context-menu-group" style="display:contents" class="${classes}">${props.children}</div>`;
  },
);

// ── Submenu: ui-context-menu-sub / -sub-trigger / -sub-content ──────

const chevronRightIcon = html`<svg class="ml-auto" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>`;

const HOVER_DELAY = 100;
let subUid = 0;

export interface ContextMenuSubState {
  open: ReadonlySignal<boolean>;
  setOpen(open: boolean): void;
  baseId: string;
  trigger: Ref<HTMLElement>;
  hoverOpen(): void;
  hoverClose(): void;
  hoverCancel(): void;
}
/** Submenu state — sub-trigger/sub-content resolve it. */
const ContextMenuSubContext = createContext<ContextMenuSubState>('ContextMenuSub', { providerTag: 'ui-context-menu-sub' });

/** Nearest ancestor scope open signal (enclosing submenu, else the root menu). */
function resolveParentOpen(host: HTMLElement): ReadonlySignal<boolean> {
  let el: HTMLElement | null = host.parentElement;
  while (el) {
    const sub = ContextMenuSubContext.peek(el);
    if (sub) return sub.open;
    const root = ContextMenuContext.peek(el);
    if (root) return root.open;
    el = el.parentElement;
  }
  return computed(() => false);
}

export type ContextMenuSubProps = {
  open?: boolean;
  defaultOpen?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const ContextMenuSub = component<ContextMenuSubProps>(
  'ui-context-menu-sub',
  (props, host) => {
    ContextMenuContext.inject();
    transparentHost(host);
    const projected = captureChildren(host);

    const parentOpen = resolveParentOpen(host);
    const internal = signal<boolean>(
      Boolean(props.defaultOpen.value ?? host.hasAttribute('default-open')),
    );
    const desired = computed<boolean>(() => props.open.value ?? internal.value);
    // A submenu is open only while its parent scope is — closing the root
    // collapses every nested submenu.
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

    const state: ContextMenuSubState = {
      open,
      setOpen,
      baseId: `ui-context-menu-sub-${++subUid}`,
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
    ContextMenuSubContext.provide(host, state);
    onCleanup(clearTimers);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(className.value));
    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<div ref="${root}" data-slot="context-menu-sub" style="display:contents" class="${classes}">${props.children}</div>`;
  },
);

const subTriggerClasses =
  "flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground";

export type ContextMenuSubTriggerProps = {
  inset?: boolean;
  disabled?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const ContextMenuSubTrigger = component<ContextMenuSubTriggerProps>(
  'ui-context-menu-sub-trigger',
  (props, host) => {
    const sub = ContextMenuSubContext.inject();
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
      data-slot="context-menu-sub-trigger"
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
  'z-50 min-w-[8rem] origin-(--radix-context-menu-content-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95';

export type ContextMenuSubContentProps = {
  sideOffset?: number;
  /**
   * Move the sub-content to `document.body` so `position: fixed` escapes
   * transformed ancestors. Defaults to true; pass false to render inline.
   */
  portal?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const ContextMenuSubContent = component<ContextMenuSubContentProps>(
  'ui-context-menu-sub-content',
  (props, host) => {
    const sub = ContextMenuSubContext.inject();
    transparentHost(host);
    const projected = captureChildren(host);

    const sideOffset = computed<number>(() => props.sideOffset.value ?? 0);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(subContentClasses, className.value));
    const contentId = `${sub.baseId}-content`;

    const content = ref<HTMLElement>();
    const portalEnabled =
      props.portal.value ?? (host.getAttribute('portal') === 'false' ? false : true);
    portal(content, { enabled: portalEnabled });
    const closeAndFocusTrigger = (): void => {
      sub.setOpen(false);
      sub.trigger.current?.focus();
    };
    const { onKeyDown, onPointerOver } = wireMenuSurface({
      content,
      open: sub.open,
      close: closeAndFocusTrigger,
      anchor: () => sub.trigger.current,
      placement: () => ({ side: 'right', align: 'start', sideOffset: sideOffset.value }),
      focusIntent: () => 'first',
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
      data-slot="context-menu-sub-content"
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
