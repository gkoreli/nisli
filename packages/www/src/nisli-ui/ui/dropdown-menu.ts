/**
 * ui/dropdown-menu.ts — Dropdown Menu.
 *
 * Ported from new-york-v4/ui/dropdown-menu.tsx (shadcn/ui, MIT —
 * https://github.com/shadcn-ui/ui) and the Radix DropdownMenu behavior it
 * wraps (MIT — https://github.com/radix-ui/primitives), rebuilt as Nisli
 * custom elements. Submenu elements (ui-dropdown-menu-sub/-sub-trigger/
 * -sub-content) are defined in the Submenu section near the end of this file.
 *
 * The content is a role=menu surface positioned with the floating lib,
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
  children,
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
import { cn, isPinned, transparentHost } from '../lib/utils.js';
import { positionFloating, type Align, type Side } from '../lib/floating.js';
import { portal } from '../lib/portal.js';
import { dismissableLayer } from '../lib/dismissable-layer.js';
import { focusTrap } from '../lib/focus.js';
import { rovingFocus } from '../lib/roving-focus.js';
import { typeahead } from '../lib/typeahead.js';

// ── Icons (literal SVG — the parser namespaces them) ─────────────────

const checkIcon = html`<svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>`;
const circleIcon = html`<svg class="size-2 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle></svg>`;

// ── Shared root state (published on the <ui-dropdown-menu> host) ─────

export interface DropdownMenuState {
  open: ReadonlySignal<boolean>;
  setOpen(open: boolean): void;
  baseId: string;
  trigger: Ref<HTMLElement>;
  /** The <ui-dropdown-menu> host — the stable dispatch anchor for ui-select
   * once the (portaled) content no longer bubbles through it. */
  rootHost: HTMLElement;
  /** Where the content should place focus when it next opens. */
  focusIntent: 'first' | 'last';
}

/** Menu state — trigger/content/items/sub resolve it. */
const DropdownMenuContext = createContext<DropdownMenuState>('DropdownMenu', { providerTag: 'ui-dropdown-menu' });

let uid = 0;

const stateAttr = (open: boolean) => (open ? 'open' : 'closed');

const ITEM_SELECTOR =
  '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]';

// ── ui-dropdown-menu (root) ──────────────────────────────────────────

export type DropdownMenuProps = {
  open?: boolean;
  defaultOpen?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const DropdownMenu = component<DropdownMenuProps>(
  'ui-dropdown-menu',
  (props, host) => {
    transparentHost(host);

    // PATTERN A (ADR 0025 item 3): the `open` ATTRIBUTE is the uncontrolled state
    // (like native <dialog open>/<details open>). The attribute IS the truth.
    const open = computed<boolean>(() => props.open.value ?? false);

    const setOpen = (next: boolean): void => {
      if (next === open.value) return;
      // Uncontrolled → the attribute IS the state, so write it. Controlled (a
      // pinned factory `open` signal) → don't; the parent drives and the reflect
      // effect re-syncs the attr. isPinned('open') is the discriminator (a declared
      // 'boolean' is never undefined, so pin state is the only controlled signal).
      if (!isPinned(host, 'open')) host.toggleAttribute('open', next);
      host.dispatchEvent(
        new CustomEvent('ui-open-change', { detail: { open: next }, bubbles: true }),
      );
    };

    // defaultOpen is INIT-SEED-ONLY: seed the open attribute once, but only when
    // `open` is neither controlled (pinned — else the reflect effect would revert
    // it, a pointless flicker) nor explicitly authored. host.hasAttribute('open')
    // is a SANCTIONED read of a DECLARED attribute: it distinguishes 'absent' from
    // 'present-false' so an explicit open="false" beats defaultOpen (stays closed).
    if (props.defaultOpen.value && !isPinned(host, 'open') && !host.hasAttribute('open')) {
      host.toggleAttribute('open', true);
    }

    // Reflect the resolved state to the attribute so CONTROLLED (factory) usage
    // also reflects (CSS [open] selectors + native parity); dedupe makes it cheap.
    effect(() => {
      host.toggleAttribute('open', open.value);
    });

    const state: DropdownMenuState = {
      open,
      setOpen,
      baseId: `ui-dropdown-menu-${++uid}`,
      trigger: ref<HTMLElement>(),
      rootHost: host,
      focusIntent: 'first',
    };
    DropdownMenuContext.provide(host, state);

    const classes = computed(() => cn(props.className.value));

    return html`<div
      data-slot="dropdown-menu"
      style="display:contents"
      class="${classes}"
    >${children()}</div>`;
  },
  { attrs: { open: 'boolean', defaultOpen: 'boolean', className: 'string' } },
);

// ── ui-dropdown-menu-trigger ─────────────────────────────────────────

export type DropdownMenuTriggerProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const DropdownMenuTrigger = component<DropdownMenuTriggerProps>(
  'ui-dropdown-menu-trigger',
  (props, host) => {
    const state = DropdownMenuContext.inject();
    transparentHost(host);

    const classes = computed(() => cn(props.className.value));

    const root = ref<HTMLButtonElement>();
    onMount(() => {
      if (root.current) state.trigger.current = root.current;
    });

    const openWith = (intent: 'first' | 'last'): void => {
      state.focusIntent = intent;
      state.setOpen(true);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openWith('first');
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        openWith('last');
      }
    };

    return html`<button
      ref="${root}"
      type="button"
      data-slot="dropdown-menu-trigger"
      aria-haspopup="menu"
      aria-controls="${`${state.baseId}-content`}"
      aria-expanded="${computed(() => (state.open.value ? 'true' : 'false'))}"
      data-state="${computed(() => stateAttr(state.open.value))}"
      class="${classes}"
      @click=${() => state.setOpen(!state.open.value)}
      @keydown=${onKeyDown}
    >${children()}</button>`;
  },
  { attrs: { className: 'string' } },
);

// ── ui-dropdown-menu-content ─────────────────────────────────────────

const contentClasses =
  'z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95';

export type DropdownMenuContentProps = {
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

export const DropdownMenuContent = component<DropdownMenuContentProps>(
  'ui-dropdown-menu-content',
  (props, host) => {
    const state = DropdownMenuContext.inject();
    transparentHost(host);

    const side = computed<Side>(() => (props.side.value as Side) ?? 'bottom');
    const align = computed<Align>(() => (props.align.value as Align) ?? 'start');
    const sideOffset = computed<number>(() => props.sideOffset.value ?? 4);

    const classes = computed(() => cn(contentClasses, props.className.value));
    const contentId = `${state.baseId}-content`;

    const content = ref<HTMLElement>();
    // Portal the menu surface to <body> (default on) so its fixed positioning
    // escapes transformed ancestors; the wired behavior operates by reference.
    portal(content, { enabled: props.portal.value as boolean });
    const { onKeyDown, onPointerOver } = wireMenuSurface({
      content,
      open: state.open,
      close: () => state.setOpen(false),
      anchor: () => state.trigger.current,
      placement: () => ({ side: side.value, align: align.value, sideOffset: sideOffset.value }),
      focusIntent: () => state.focusIntent,
      afterOpen: () => {
        state.focusIntent = 'first';
      },
      useTrap: true,
      returnFocus: state.trigger,
      triggerExclude: () => state.trigger.current,
    });

    return html`<div
      ref="${content}"
      role="menu"
      data-slot="dropdown-menu-content"
      id="${contentId}"
      data-state="${computed(() => stateAttr(state.open.value))}"
      hidden="${computed(() => !state.open.value)}"
      tabindex="-1"
      class="${classes}"
      @keydown=${onKeyDown}
      @pointerover=${onPointerOver}
    >${children()}</div>`;
  },
  { attrs: { side: 'string', align: 'string', sideOffset: 'number', portal: { type: 'boolean', default: true }, className: 'string' } },
);

// ── Item selection helper ────────────────────────────────────────────

/** Dispatch a cancelable `ui-select`; close the whole menu unless prevented. */
function emitSelect(state: DropdownMenuState, value: string | undefined): void {
  const event = new CustomEvent('ui-select', {
    detail: { value },
    bubbles: true,
    cancelable: true,
  });
  // Dispatch on the root host, not the item: once the content is portaled to
  // <body> the item no longer bubbles through <ui-dropdown-menu>, so a
  // consumer listening there would miss it.
  state.rootHost.dispatchEvent(event);
  if (!event.defaultPrevented) state.setOpen(false);
}

// ── ui-dropdown-menu-item ────────────────────────────────────────────

const itemClasses =
  "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!";

export type DropdownMenuItemProps = {
  inset?: boolean;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  /** Emitted as `ui-select` detail.value when the item is activated. */
  value?: string;
  className?: string;
  children?: string | TemplateResult;
};

export const DropdownMenuItem = component<DropdownMenuItemProps>(
  'ui-dropdown-menu-item',
  (props, host) => {
    const state = DropdownMenuContext.inject();
    transparentHost(host);

    const disabled = computed<boolean>(() => props.disabled.value as boolean);
    const classes = computed(() => cn(itemClasses, props.className.value));

    const root = ref<HTMLDivElement>();

    const onClick = (): void => {
      if (disabled.value || !root.current) return;
      emitSelect(state, props.value.value);
    };

    return html`<div
      ref="${root}"
      role="menuitem"
      data-slot="dropdown-menu-item"
      data-inset="${computed(() => (props.inset.value ? '' : undefined))}"
      data-variant="${computed(() => props.variant.value ?? 'default')}"
      data-disabled="${computed(() => (disabled.value ? '' : undefined))}"
      aria-disabled="${computed(() => (disabled.value ? 'true' : undefined))}"
      tabindex="-1"
      class="${classes}"
      @click=${onClick}
    >${children()}</div>`;
  },
  { attrs: { inset: 'boolean', variant: 'string', disabled: 'boolean', value: 'string', className: 'string' } },
);

// ── ui-dropdown-menu-checkbox-item ───────────────────────────────────

const checkboxItemClasses =
  "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const indicatorSpan = 'pointer-events-none absolute left-2 flex size-3.5 items-center justify-center';

export type DropdownMenuCheckboxItemProps = {
  checked?: boolean;
  disabled?: boolean;
  value?: string;
  className?: string;
  children?: string | TemplateResult;
};

export const DropdownMenuCheckboxItem = component<DropdownMenuCheckboxItemProps>(
  'ui-dropdown-menu-checkbox-item',
  (props, host) => {
    const state = DropdownMenuContext.inject();
    transparentHost(host);

    const disabled = computed<boolean>(() => props.disabled.value as boolean);
    // Controlled when the factory PINS `checked`; else uncontrolled internal
    // state (a declared 'boolean' is false-when-absent, so pin state — not
    // `?? undefined` — is the discriminator).
    const internal = signal<boolean>(Boolean(props.checked.value));
    const checked = computed<boolean>(() =>
      isPinned(host, 'checked') ? Boolean(props.checked.value) : internal.value,
    );

    const classes = computed(() => cn(checkboxItemClasses, props.className.value));

    const item = ref<HTMLDivElement>();

    const onClick = (): void => {
      if (disabled.value || !item.current) return;
      internal.value = !checked.value;
      emitSelect(state, props.value.value);
    };

    return html`<div
      ref="${item}"
      role="menuitemcheckbox"
      data-slot="dropdown-menu-checkbox-item"
      aria-checked="${computed(() => (checked.value ? 'true' : 'false'))}"
      data-disabled="${computed(() => (disabled.value ? '' : undefined))}"
      aria-disabled="${computed(() => (disabled.value ? 'true' : undefined))}"
      tabindex="-1"
      class="${classes}"
      @click=${onClick}
    ><span class="${indicatorSpan}">${when(checked, () => checkIcon)}</span><span style="display:contents">${children()}</span></div>`;
  },
  { attrs: { checked: 'boolean', disabled: 'boolean', value: 'string', className: 'string' } },
);

// ── ui-dropdown-menu-radio-group + radio-item ────────────────────────

export interface DropdownMenuRadioGroupState {
  value: ReadonlySignal<string>;
  setValue(value: string): void;
}
/** Radio-group value scope — its radio items resolve it. */
const DropdownMenuRadioGroupContext = createContext<DropdownMenuRadioGroupState>('DropdownMenuRadioGroup', { providerTag: 'ui-dropdown-menu-radio-group' });

export type DropdownMenuRadioGroupProps = {
  value?: string;
  defaultValue?: string;
  className?: string;
  children?: string | TemplateResult;
};

export const DropdownMenuRadioGroup = component<DropdownMenuRadioGroupProps>(
  'ui-dropdown-menu-radio-group',
  (props, host) => {
    transparentHost(host);

    const internal = signal<string>(props.defaultValue.value ?? '');
    const value = computed<string>(() => props.value.value ?? internal.value);
    const setValue = (v: string): void => {
      internal.value = v;
    };
    DropdownMenuRadioGroupContext.provide(host, { value, setValue });

    const classes = computed(() => cn(props.className.value));

    return html`<div role="group" data-slot="dropdown-menu-radio-group" style="display:contents" class="${classes}">${children()}</div>`;
  },
  { attrs: { value: 'string', defaultValue: 'string', className: 'string' } },
);

const radioItemClasses = checkboxItemClasses;

export type DropdownMenuRadioItemProps = {
  value?: string;
  disabled?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const DropdownMenuRadioItem = component<DropdownMenuRadioItemProps>(
  'ui-dropdown-menu-radio-item',
  (props, host) => {
    const state = DropdownMenuContext.inject();
    const group = DropdownMenuRadioGroupContext.inject.optional();
    transparentHost(host);

    const disabled = computed<boolean>(() => props.disabled.value as boolean);
    const checked = computed<boolean>(
      () => group != null && group.value.value === (props.value.value ?? ''),
    );

    const classes = computed(() => cn(radioItemClasses, props.className.value));

    const item = ref<HTMLDivElement>();

    const onClick = (): void => {
      if (disabled.value || !item.current) return;
      group?.setValue(props.value.value ?? '');
      emitSelect(state, props.value.value);
    };

    return html`<div
      ref="${item}"
      role="menuitemradio"
      data-slot="dropdown-menu-radio-item"
      aria-checked="${computed(() => (checked.value ? 'true' : 'false'))}"
      data-disabled="${computed(() => (disabled.value ? '' : undefined))}"
      aria-disabled="${computed(() => (disabled.value ? 'true' : undefined))}"
      tabindex="-1"
      class="${classes}"
      @click=${onClick}
    ><span class="${indicatorSpan}">${when(checked, () => circleIcon)}</span><span style="display:contents">${children()}</span></div>`;
  },
  { attrs: { value: 'string', disabled: 'boolean', className: 'string' } },
);

// ── ui-dropdown-menu-label / -separator / -shortcut / -group ─────────

export type DropdownMenuLabelProps = {
  inset?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const DropdownMenuLabel = component<DropdownMenuLabelProps>(
  'ui-dropdown-menu-label',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() =>
      cn('px-2 py-1.5 text-sm font-medium data-[inset]:pl-8', props.className.value),
    );
    return html`<div
      data-slot="dropdown-menu-label"
      data-inset="${computed(() => (props.inset.value ? '' : undefined))}"
      class="${classes}"
    >${children()}</div>`;
  },
  { attrs: { inset: 'boolean', className: 'string' } },
);

export type DropdownMenuSeparatorProps = { className?: string };

export const DropdownMenuSeparator = component<DropdownMenuSeparatorProps>(
  'ui-dropdown-menu-separator',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() => cn('-mx-1 my-1 h-px bg-border', props.className.value));
    return html`<div role="separator" aria-orientation="horizontal" data-slot="dropdown-menu-separator" class="${classes}"></div>`;
  },
  { attrs: { className: 'string' } },
);

export type DropdownMenuShortcutProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const DropdownMenuShortcut = component<DropdownMenuShortcutProps>(
  'ui-dropdown-menu-shortcut',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() =>
      cn('ml-auto text-xs tracking-widest text-muted-foreground', props.className.value),
    );
    return html`<span data-slot="dropdown-menu-shortcut" class="${classes}">${children()}</span>`;
  },
  { attrs: { className: 'string' } },
);

export type DropdownMenuGroupProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const DropdownMenuGroup = component<DropdownMenuGroupProps>(
  'ui-dropdown-menu-group',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() => cn(props.className.value));
    return html`<div role="group" data-slot="dropdown-menu-group" style="display:contents" class="${classes}">${children()}</div>`;
  },
  { attrs: { className: 'string' } },
);

// ── Submenu: ui-dropdown-menu-sub / -sub-trigger / -sub-content ──────

const chevronRightIcon = html`<svg class="ml-auto size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>`;

const HOVER_DELAY = 100;
let subUid = 0;

export interface DropdownMenuSubState {
  open: ReadonlySignal<boolean>;
  setOpen(open: boolean): void;
  baseId: string;
  trigger: Ref<HTMLElement>;
  hoverOpen(): void;
  hoverClose(): void;
  hoverCancel(): void;
}
/** Submenu state — sub-trigger/sub-content resolve it. */
const DropdownMenuSubContext = createContext<DropdownMenuSubState>('DropdownMenuSub', { providerTag: 'ui-dropdown-menu-sub' });

/** Nearest ancestor scope open signal (enclosing submenu, else the root menu). */
function resolveParentOpen(host: HTMLElement): ReadonlySignal<boolean> {
  let el: HTMLElement | null = host.parentElement;
  while (el) {
    const sub = DropdownMenuSubContext.peek(el);
    if (sub) return sub.open;
    const root = DropdownMenuContext.peek(el);
    if (root) return root.open;
    el = el.parentElement;
  }
  return computed(() => false);
}

export type DropdownMenuSubProps = {
  open?: boolean;
  defaultOpen?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const DropdownMenuSub = component<DropdownMenuSubProps>(
  'ui-dropdown-menu-sub',
  (props, host) => {
    DropdownMenuContext.inject();
    transparentHost(host);

    const parentOpen = resolveParentOpen(host);
    // Submenu open is INTERNAL (root-only attribute-as-truth rule): plain signal
    // seeded from the declared default-open; `open` stays a factory-only control.
    const internal = signal<boolean>(Boolean(props.defaultOpen.value));
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

    const state: DropdownMenuSubState = {
      open,
      setOpen,
      baseId: `ui-dropdown-menu-sub-${++subUid}`,
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
    DropdownMenuSubContext.provide(host, state);
    onCleanup(clearTimers);

    const classes = computed(() => cn(props.className.value));

    return html`<div data-slot="dropdown-menu-sub" style="display:contents" class="${classes}">${children()}</div>`;
  },
  { attrs: { defaultOpen: 'boolean', className: 'string' } },
);

const subTriggerClasses =
  "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground";

export type DropdownMenuSubTriggerProps = {
  inset?: boolean;
  disabled?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const DropdownMenuSubTrigger = component<DropdownMenuSubTriggerProps>(
  'ui-dropdown-menu-sub-trigger',
  (props, host) => {
    const sub = DropdownMenuSubContext.inject();
    transparentHost(host);

    const disabled = computed<boolean>(() => props.disabled.value as boolean);
    const classes = computed(() => cn(subTriggerClasses, props.className.value));

    const item = ref<HTMLDivElement>();
    onMount(() => {
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
      data-slot="dropdown-menu-sub-trigger"
      aria-haspopup="menu"
      aria-expanded="${computed(() => (sub.open.value ? 'true' : 'false'))}"
      aria-controls="${`${sub.baseId}-content`}"
      data-state="${computed(() => stateAttr(sub.open.value))}"
      data-inset="${computed(() => (props.inset.value ? '' : undefined))}"
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
    ><span style="display:contents">${children()}</span>${chevronRightIcon}</div>`;
  },
  { attrs: { inset: 'boolean', disabled: 'boolean', className: 'string' } },
);

const subContentClasses =
  'z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95';

export type DropdownMenuSubContentProps = {
  sideOffset?: number;
  /**
   * Move the sub-content to `document.body` so `position: fixed` escapes
   * transformed ancestors. Defaults to true; pass false to render inline.
   */
  portal?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const DropdownMenuSubContent = component<DropdownMenuSubContentProps>(
  'ui-dropdown-menu-sub-content',
  (props, host) => {
    const sub = DropdownMenuSubContext.inject();
    transparentHost(host);

    const sideOffset = computed<number>(() => props.sideOffset.value ?? 0);
    const classes = computed(() => cn(subContentClasses, props.className.value));
    const contentId = `${sub.baseId}-content`;

    const content = ref<HTMLElement>();
    portal(content, { enabled: props.portal.value as boolean });
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

    return html`<div
      ref="${content}"
      role="menu"
      data-slot="dropdown-menu-sub-content"
      id="${contentId}"
      data-state="${computed(() => stateAttr(sub.open.value))}"
      hidden="${computed(() => !sub.open.value)}"
      tabindex="-1"
      class="${classes}"
      @keydown=${onKeyDown}
      @pointerover=${onPointerOver}
      @pointerenter=${() => sub.hoverCancel()}
      @pointerleave=${() => sub.hoverClose()}
    >${children()}</div>`;
  },
  { attrs: { sideOffset: 'number', portal: { type: 'boolean', default: true }, className: 'string' } },
);
