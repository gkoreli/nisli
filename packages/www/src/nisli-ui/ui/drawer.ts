/**
 * ui/drawer.ts — Drawer.
 *
 * Ported from new-york-v4/ui/drawer.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui).
 * Upstream delegates to `vaul`, which isn't vendorable into a copy-in file, so
 * — like toast/command — the VISUALS are ported verbatim (the exact class
 * lists and the `data-vaul-drawer-direction` hooks) while the BEHAVIOR follows
 * vaul's conventions on our own dialog machinery: a Sheet-like edge panel
 * (default bottom) with drag-to-dismiss (pointer capture + translate along the
 * dismiss axis, dismiss past a distance/velocity threshold, snap back
 * otherwise) and an overlay whose opacity tracks drag progress.
 *
 * Built on the same machinery as dialog/sheet: shared state via a
 * subtree-scoped `DrawerContext`, the dismissable-layer + focus lib items, and
 * an upstream-parity body portal around the fixed overlay + panel. Open/close
 * dispatches a bubbling `ui-open-change` CustomEvent from the `<ui-drawer>`
 * host.
 *
 * v1 limit (documented): no snap points (drag is open↔closed only). Pass
 * `portal={false}` / `portal="false"` on content for inline/SSG rendering.
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
  ref,
  type ReadonlySignal,
  type TemplateResult,
} from '@nisli/core';
import { cn, isPinned, transparentHost } from '../lib/utils.js';
import { dismissableLayer } from '../lib/dismissable-layer.js';
import { focusTrap } from '../lib/focus.js';
import { portal } from '../lib/portal.js';

export type DrawerDirection = 'top' | 'bottom' | 'left' | 'right';

// ── Shared state (published on the <ui-drawer> host) ─────────────────

export interface DrawerState {
  open: ReadonlySignal<boolean>;
  setOpen(open: boolean): void;
  direction: ReadonlySignal<DrawerDirection>;
  baseId: string;
}

/** Subtree-scoped channel from the Drawer provider to its parts. */
const DrawerContext = createContext<DrawerState>('Drawer', { providerTag: 'ui-drawer' });

let uid = 0;

// ── ui-drawer (root, owns state) ─────────────────────────────────────

export type DrawerProps = {
  open?: boolean;
  defaultOpen?: boolean;
  direction?: DrawerDirection;
  className?: string;
  children?: string | TemplateResult;
};

export const Drawer = component<DrawerProps>('ui-drawer', (props, host) => {
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

  const direction = computed<DrawerDirection>(
    () => (props.direction.value as DrawerDirection) ?? 'bottom',
  );

  const state: DrawerState = { open, setOpen, direction, baseId: `ui-drawer-${++uid}` };
  DrawerContext.provide(host, state);

  const className = props.className;
  const classes = computed(() => cn(className.value));

  return html`<div data-slot="drawer" style="display:contents" class="${classes}">${children()}</div>`;
}, {
  // PATTERN A: `open` is the attribute-as-truth state; `defaultOpen` seeds it.
  attrs: {
    open: 'boolean',
    defaultOpen: 'boolean',
    direction: 'string',
    className: 'string',
  },
});

// ── ui-drawer-trigger / -close ───────────────────────────────────────

export type DrawerTriggerProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const DrawerTrigger = component<DrawerTriggerProps>('ui-drawer-trigger', (props, host) => {
  const state = DrawerContext.inject();
  transparentHost(host);
  const className = props.className;
  const classes = computed(() => cn(className.value));
  return html`<button
    type="button"
    data-slot="drawer-trigger"
    aria-haspopup="dialog"
    aria-controls="${`${state.baseId}-content`}"
    aria-expanded="${computed(() => (state.open.value ? 'true' : 'false'))}"
    data-state="${computed(() => (state.open.value ? 'open' : 'closed'))}"
    class="${classes}"
    @click=${() => state.setOpen(true)}
  >${children()}</button>`;
}, { attrs: { className: 'string' } });

export type DrawerCloseProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const DrawerClose = component<DrawerCloseProps>('ui-drawer-close', (props, host) => {
  const state = DrawerContext.inject();
  transparentHost(host);
  const className = props.className;
  const classes = computed(() => cn(className.value));
  return html`<button
    type="button"
    data-slot="drawer-close"
    class="${classes}"
    @click=${() => state.setOpen(false)}
  >${children()}</button>`;
}, { attrs: { className: 'string' } });

// ── ui-drawer-content (overlay + draggable panel) ────────────────────

const overlayClasses =
  'fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0';

const contentClasses =
  'group/drawer-content fixed z-50 flex h-auto flex-col bg-background data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80vh] data-[vaul-drawer-direction=top]:rounded-b-lg data-[vaul-drawer-direction=top]:border-b data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80vh] data-[vaul-drawer-direction=bottom]:rounded-t-lg data-[vaul-drawer-direction=bottom]:border-t data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=right]:sm:max-w-sm data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=left]:sm:max-w-sm';

const handleClasses =
  'mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-full bg-muted group-data-[vaul-drawer-direction=bottom]/drawer-content:block';

// Dismiss if dragged past this fraction of the drawer's size, or flicked
// faster than this velocity (px/ms). Fallback size keeps it sane when the
// panel hasn't laid out yet (e.g. under happy-dom).
const CLOSE_FRACTION = 0.25;
const VELOCITY_THRESHOLD = 0.4;
/** A flick only dismisses past this distance (ignore fast twitches). */
const MIN_FLICK_DISTANCE = 40;
const FALLBACK_SIZE = 320;

export type DrawerContentProps = {
  /** Move overlay + panel to document.body by default; false keeps them inline. */
  portal?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const DrawerContent = component<DrawerContentProps>('ui-drawer-content', (props, host) => {
  const state = DrawerContext.inject();
  transparentHost(host);

  const dataState = computed(() => (state.open.value ? 'open' : 'closed'));
  const hidden = computed(() => !state.open.value);
  const contentId = `${state.baseId}-content`;

  const className = props.className;
  const classes = computed(() => cn(contentClasses, className.value));

  const portalRef = ref<HTMLDivElement>();
  const overlayRef = ref<HTMLDivElement>();
  const contentRef = ref<HTMLElement>();

  portal(portalRef, { enabled: props.portal.value as boolean });

  const layer = dismissableLayer(contentRef, { onDismiss: () => state.setOpen(false) });
  const trap = focusTrap(contentRef);

  effect(() => {
    if (state.open.value) {
      layer.activate();
      queueMicrotask(() => {
        if (state.open.value) trap.activate();
      });
    } else {
      trap.deactivate();
      layer.deactivate();
    }
  });

  // ── Drag-to-dismiss (vaul conventions) ──────────────────────────────
  // Axis + the sign of a dismissing drag for each direction.
  const axis = (): 'x' | 'y' =>
    state.direction.value === 'left' || state.direction.value === 'right' ? 'x' : 'y';
  const dismissSign = (): 1 | -1 =>
    state.direction.value === 'bottom' || state.direction.value === 'right' ? 1 : -1;

  let dragging = false;
  let startPos = 0;
  let startTime = 0;
  let dragged = 0;

  const setTransform = (px: number): void => {
    const el = contentRef.current;
    if (!el) return;
    el.style.transform = axis() === 'y' ? `translateY(${px}px)` : `translateX(${px}px)`;
  };
  const resetStyles = (): void => {
    const el = contentRef.current;
    if (el) {
      el.style.transition = '';
      el.style.transform = '';
    }
    if (overlayRef.current) overlayRef.current.style.opacity = '';
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging) return;
    const pos = axis() === 'y' ? event.clientY : event.clientX;
    // Only track motion in the dismiss direction; ignore dragging further open.
    dragged = Math.max(0, (pos - startPos) * dismissSign());
    setTransform(dragged * dismissSign());
    const el = contentRef.current;
    const size = axis() === 'y' ? (el?.offsetHeight ?? 0) : (el?.offsetWidth ?? 0);
    if (overlayRef.current && size > 0) {
      overlayRef.current.style.opacity = String(Math.max(0, 1 - dragged / size));
    }
  };

  const endDrag = (event: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', endDrag);
    document.removeEventListener('pointercancel', endDrag);
    const el = contentRef.current;
    const size =
      (axis() === 'y' ? el?.offsetHeight : el?.offsetWidth) || FALLBACK_SIZE;
    const elapsed = event.timeStamp - startTime;
    const velocity = elapsed > 0 ? dragged / elapsed : 0;
    const dismiss =
      dragged > size * CLOSE_FRACTION ||
      (dragged > MIN_FLICK_DISTANCE && velocity > VELOCITY_THRESHOLD);
    resetStyles();
    if (dismiss) state.setOpen(false);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!state.open.value) return;
    // Don't hijack interactive controls or elements that opt out.
    if ((event.target as HTMLElement | null)?.closest('button,a,input,textarea,select,[data-no-drag]')) {
      return;
    }
    dragging = true;
    startPos = axis() === 'y' ? event.clientY : event.clientX;
    startTime = event.timeStamp;
    dragged = 0;
    const el = contentRef.current;
    if (el) el.style.transition = 'none';
    try {
      if (event.pointerId != null) el?.setPointerCapture?.(event.pointerId);
    } catch {
      /* setPointerCapture unsupported (or invalid pointerId) — fine */
    }
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);
  };

  onCleanup(() => {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', endDrag);
    document.removeEventListener('pointercancel', endDrag);
  });

  return html`<div ref="${portalRef}" data-slot="drawer-portal" style="display:contents">
    <div
      ref="${overlayRef}"
      data-slot="drawer-overlay"
      data-state="${dataState}"
      hidden="${hidden}"
      class="${overlayClasses}"
    ></div>
    <div
      ref="${contentRef}"
      role="dialog"
      aria-modal="true"
      data-slot="drawer-content"
      data-vaul-drawer-direction="${state.direction}"
      id="${contentId}"
      aria-labelledby="${`${state.baseId}-title`}"
      aria-describedby="${`${state.baseId}-description`}"
      data-state="${dataState}"
      hidden="${hidden}"
      tabindex="-1"
      class="${classes}"
      @pointerdown=${onPointerDown}
    ><div data-slot="drawer-handle" class="${handleClasses}"></div>${children()}</div>
  </div>`;
}, {
  attrs: {
    portal: { type: 'boolean', default: true },
    className: 'string',
  },
});

// ── ui-drawer-header / -footer / -title / -description ───────────────

export type DrawerSectionProps = {
  className?: string;
  children?: string | TemplateResult;
};

function drawerSection(tag: string, slot: string, base: string) {
  return component<DrawerSectionProps>(tag, (props, host) => {
    transparentHost(host);
    const className = props.className;
    const classes = computed(() => cn(base, className.value));
    return html`<div data-slot="${slot}" class="${classes}">${children()}</div>`;
  }, { attrs: { className: 'string' } });
}

export const DrawerHeader = drawerSection(
  'ui-drawer-header',
  'drawer-header',
  'flex flex-col gap-0.5 p-4 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center group-data-[vaul-drawer-direction=top]/drawer-content:text-center md:gap-1.5 md:text-left',
);

export const DrawerFooter = drawerSection(
  'ui-drawer-footer',
  'drawer-footer',
  'mt-auto flex flex-col gap-2 p-4',
);

export type DrawerTitleProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const DrawerTitle = component<DrawerTitleProps>('ui-drawer-title', (props, host) => {
  const state = DrawerContext.inject();
  transparentHost(host);
  const className = props.className;
  const classes = computed(() => cn('font-semibold text-foreground', className.value));
  return html`<h2
    data-slot="drawer-title"
    id="${`${state.baseId}-title`}"
    class="${classes}"
  >${children()}</h2>`;
}, { attrs: { className: 'string' } });

export type DrawerDescriptionProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const DrawerDescription = component<DrawerDescriptionProps>(
  'ui-drawer-description',
  (props, host) => {
    const state = DrawerContext.inject();
    transparentHost(host);
    const className = props.className;
    const classes = computed(() => cn('text-sm text-muted-foreground', className.value));
    return html`<p
      data-slot="drawer-description"
      id="${`${state.baseId}-description`}"
      class="${classes}"
    >${children()}</p>`;
  },
  { attrs: { className: 'string' } },
);
