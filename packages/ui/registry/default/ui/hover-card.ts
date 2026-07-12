/**
 * ui/hover-card.ts — HoverCard.
 *
 * Ported from new-york-v4/ui/hover-card.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui)
 * and the Radix HoverCard behavior it wraps (MIT), rebuilt as Nisli custom
 * elements positioned with the floating lib item.
 *
 * ```
 * <ui-hover-card>
 *   <ui-hover-card-trigger>@nisli</ui-hover-card-trigger>
 *   <ui-hover-card-content>Rich preview…</ui-hover-card-content>
 * </ui-hover-card>
 * ```
 *
 * Pointer-hover only: it opens `openDelay` ms (default 700) after the pointer
 * enters the trigger and closes `closeDelay` ms (default 300) after the pointer
 * leaves both trigger and content — so moving from trigger to content keeps it
 * open. There is NO focus-open and NO focus trap: a hover card is supplementary
 * pointer affordance (that is a deliberate deviation from Radix, which also
 * opens on focus; documented). Content positions inline with position:fixed (no
 * portal in v1; same transformed-ancestor caveat as ui-dialog).
 *
 * Open/close changes dispatch a bubbling `ui-open-change` CustomEvent
 * (`detail: { open }`) from the `<ui-hover-card>` host.
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
  type ReadonlySignal,
  type Ref,
  type TemplateResult,
} from '@nisli/core';
import {
  attr,
  captureChildren,
  cn,
  projectChildren,
  transparentHost,
} from '../lib/utils.js';
import { positionFloating, type Align, type Side } from '../lib/floating.js';

const DEFAULT_OPEN_DELAY = 700;
const DEFAULT_CLOSE_DELAY = 300;

// ── Shared state (published on the <ui-hover-card> host) ─────────────

export interface HoverCardState {
  open: ReadonlySignal<boolean>;
  /** Schedule an open after openDelay (cancels a pending close). */
  scheduleOpen(): void;
  /** Schedule a close after closeDelay (cancels a pending open). */
  scheduleClose(): void;
  /** Cancel a pending close — the pointer entered the content. */
  keepOpen(): void;
  baseId: string;
  anchor: Ref<HTMLElement>;
}

/** Subtree-scoped channel from the HoverCard provider to its parts. */
const HoverCardContext = createContext<HoverCardState>('HoverCard');

let uid = 0;

const stateAttr = (open: boolean) => (open ? 'open' : 'closed');

// ── ui-hover-card (root, owns state) ─────────────────────────────────

export type HoverCardProps = {
  /** Controlled open state. */
  open?: boolean;
  /** Delay before opening on pointer enter (ms). Default 700 (Radix). */
  openDelay?: number;
  /** Delay before closing on pointer leave (ms). Default 300 (Radix). */
  closeDelay?: number;
  className?: string;
  children?: string | TemplateResult;
};

export const HoverCard = component<HoverCardProps>('ui-hover-card', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);

  const internal = signal<boolean>(false);
  const open = computed<boolean>(() => props.open.value ?? internal.value);
  const openDelay = computed<number>(() => props.openDelay.value ?? DEFAULT_OPEN_DELAY);
  const closeDelay = computed<number>(() => props.closeDelay.value ?? DEFAULT_CLOSE_DELAY);
  const anchor = ref<HTMLElement>();

  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const setOpen = (next: boolean): void => {
    if (next === open.value) return;
    internal.value = next;
    host.dispatchEvent(
      new CustomEvent('ui-open-change', { detail: { open: next }, bubbles: true }),
    );
  };

  const clearTimers = (): void => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
  };

  const state: HoverCardState = {
    open,
    scheduleOpen: () => {
      clearTimeout(closeTimer);
      if (open.value) return;
      clearTimeout(openTimer);
      const d = openDelay.value;
      if (d <= 0) setOpen(true);
      else openTimer = setTimeout(() => setOpen(true), d);
    },
    scheduleClose: () => {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
      const d = closeDelay.value;
      if (d <= 0) setOpen(false);
      else closeTimer = setTimeout(() => setOpen(false), d);
    },
    keepOpen: () => clearTimeout(closeTimer),
    baseId: `ui-hover-card-${++uid}`,
    anchor,
  };
  HoverCardContext.provide(host, state);

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn(className.value));

  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  onCleanup(clearTimers);

  return html`<div
    ref="${root}"
    data-slot="hover-card"
    style="display:contents"
    class="${classes}"
  >${props.children}</div>`;
});

// ── ui-hover-card-trigger ────────────────────────────────────────────

export type HoverCardTriggerProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const HoverCardTrigger = component<HoverCardTriggerProps>(
  'ui-hover-card-trigger',
  (props, host) => {
    const state = HoverCardContext.inject();
    transparentHost(host);
    const projected = captureChildren(host);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(className.value));

    const root = ref<HTMLElement>();
    onMount(() => {
      if (root.current) {
        projectChildren(host, root.current, projected);
        state.anchor.current = root.current;
      }
    });

    return html`<span
      ref="${root}"
      data-slot="hover-card-trigger"
      data-state="${computed(() => stateAttr(state.open.value))}"
      class="${classes}"
      @pointerenter=${() => state.scheduleOpen()}
      @pointerleave=${() => state.scheduleClose()}
    >${props.children}</span>`;
  },
);

// ── ui-hover-card-content ────────────────────────────────────────────

const contentClasses =
  'z-50 w-64 origin-(--radix-hover-card-content-transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95';

export type HoverCardContentProps = {
  side?: Side;
  align?: Align;
  /** Gap in px between trigger and content. Default 4 (upstream). */
  sideOffset?: number;
  className?: string;
  children?: string | TemplateResult;
};

export const HoverCardContent = component<HoverCardContentProps>(
  'ui-hover-card-content',
  (props, host) => {
    const state = HoverCardContext.inject();
    transparentHost(host);
    const projected = captureChildren(host);

    const sideAttr = attr(props.side, host, 'side');
    const side = computed<Side>(() => (sideAttr.value as Side) ?? 'bottom');
    const alignAttr = attr(props.align, host, 'align');
    const align = computed<Align>(() => (alignAttr.value as Align) ?? 'center');
    const sideOffset = computed<number>(() => props.sideOffset.value ?? 4);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(contentClasses, className.value));
    const contentId = `${state.baseId}-content`;

    const content = ref<HTMLDivElement>();
    let disposePosition: (() => void) | null = null;

    const stopPositioning = (): void => {
      if (disposePosition) {
        disposePosition();
        disposePosition = null;
      }
    };

    effect(() => {
      if (state.open.value) {
        // Position after the `hidden` binding clears so the element is measurable.
        queueMicrotask(() => {
          if (!state.open.value) return;
          const anchor = state.anchor.current;
          if (anchor && content.current) {
            disposePosition?.();
            disposePosition = positionFloating(anchor, content.current, {
              side: side.value,
              align: align.value,
              sideOffset: sideOffset.value,
            });
          }
        });
      } else {
        stopPositioning();
      }
    });

    onMount(() => {
      if (content.current) projectChildren(host, content.current, projected);
    });
    onCleanup(stopPositioning);

    return html`<div
      ref="${content}"
      data-slot="hover-card-content"
      id="${contentId}"
      data-state="${computed(() => stateAttr(state.open.value))}"
      hidden="${computed(() => !state.open.value)}"
      class="${classes}"
      @pointerenter=${() => state.keepOpen()}
      @pointerleave=${() => state.scheduleClose()}
    >${props.children}</div>`;
  },
);
