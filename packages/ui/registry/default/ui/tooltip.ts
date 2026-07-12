/**
 * ui/tooltip.ts — Tooltip.
 *
 * Ported from new-york-v4/ui/tooltip.tsx (shadcn/ui, MIT —
 * https://github.com/shadcn-ui/ui) and the Radix Tooltip behavior it wraps
 * (MIT — https://github.com/radix-ui/primitives), rebuilt as Nisli custom
 * elements positioned with the floating lib item.
 *
 * Three elements:
 *   <ui-tooltip>
 *     <ui-tooltip-trigger>Hover me</ui-tooltip-trigger>
 *     <ui-tooltip-content>Tooltip text</ui-tooltip-content>
 *   </ui-tooltip>
 *
 * Shows on hover/focus after a delay and hides on leave/blur/pointerdown/Escape.
 * A module-level manager provides Radix TooltipProvider semantics: only one
 * tooltip is open at a time, and once one has shown, others open instantly for
 * a short skip-delay window. Content carries data-side/data-align for the
 * slide animations and, by default, is moved to `document.body` on mount via
 * the `portal` lib item so its `position: fixed` escapes transformed ancestors
 * (pass `portal={false}` / `portal="false"` to render inline). Positioning
 * (floating), Escape-to-close, and the provider manager all operate by
 * reference, so they survive the move.
 *
 * v1 limits: no arrow (the floating lib has no arrow positioning — upstream's
 * TooltipArrow is omitted). SSG note: the portaled content escapes the static
 * snapshot (client-only, matching upstream); use `portal={false}` if needed.
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
import { positionFloating, type Side } from '../lib/floating.js';
import { portal } from '../lib/portal.js';

// ── Module-level open/delay manager (TooltipProvider semantics) ──────

const DEFAULT_DELAY = 700;
const SKIP_DELAY = 300;

let openTimer: ReturnType<typeof setTimeout> | undefined;
let skipTimer: ReturnType<typeof setTimeout> | undefined;
let skipActive = false;
let activeClose: (() => void) | null = null;

/** Schedule a show after `delay`, or immediately during the skip window. */
function scheduleOpen(delay: number, show: () => void): void {
  clearTimeout(openTimer);
  if (skipActive || delay <= 0) {
    show();
  } else {
    openTimer = setTimeout(show, delay);
  }
}

function cancelScheduledOpen(): void {
  clearTimeout(openTimer);
}

/** A tooltip has opened: close any other, become the active one. */
function notifyOpened(close: () => void): void {
  if (activeClose && activeClose !== close) activeClose();
  activeClose = close;
}

/** A tooltip has closed: open a skip window so the next one shows instantly. */
function notifyClosed(close: () => void): void {
  if (activeClose === close) activeClose = null;
  skipActive = true;
  clearTimeout(skipTimer);
  skipTimer = setTimeout(() => {
    skipActive = false;
  }, SKIP_DELAY);
}

// ── Shared state (published on the <ui-tooltip> host) ────────────────

export interface TooltipState {
  open: ReadonlySignal<boolean>;
  requestOpen(): void;
  requestClose(): void;
  baseId: string;
  anchor: Ref<HTMLElement>;
}

/** Subtree-scoped channel from <ui-tooltip> to its parts. */
const TooltipContext = createContext<TooltipState>('Tooltip', { providerTag: 'ui-tooltip' });

let uid = 0;

const stateAttr = (open: boolean) => (open ? 'open' : 'closed');

// ── ui-tooltip (root, owns state) ────────────────────────────────────

export type TooltipProps = {
  /** Controlled open state. */
  open?: boolean;
  /** Hover/focus delay in ms before showing. Default 700 (Radix). */
  delayDuration?: number;
  className?: string;
  children?: string | TemplateResult;
};

export const Tooltip = component<TooltipProps>('ui-tooltip', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);

  const internal = signal<boolean>(false);
  const open = computed<boolean>(() => props.open.value ?? internal.value);
  const delay = computed<number>(() => props.delayDuration.value ?? DEFAULT_DELAY);
  const anchor = ref<HTMLElement>();

  const setOpen = (next: boolean): void => {
    if (next === open.value) return;
    internal.value = next;
    if (next) notifyOpened(() => setOpen(false));
    else notifyClosed(() => setOpen(false));
    host.dispatchEvent(
      new CustomEvent('ui-open-change', { detail: { open: next }, bubbles: true }),
    );
  };

  const state: TooltipState = {
    open,
    requestOpen: () => scheduleOpen(delay.value, () => setOpen(true)),
    requestClose: () => {
      cancelScheduledOpen();
      setOpen(false);
    },
    baseId: `ui-tooltip-${++uid}`,
    anchor,
  };
  TooltipContext.provide(host, state);

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn(className.value));

  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  // Cancel any pending open if the tooltip is torn down mid-hover.
  onCleanup(() => state.requestClose());

  return html`<div
    ref="${root}"
    data-slot="tooltip"
    style="display:contents"
    class="${classes}"
  >${props.children}</div>`;
});

// ── ui-tooltip-trigger ───────────────────────────────────────────────

export type TooltipTriggerProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const TooltipTrigger = component<TooltipTriggerProps>(
  'ui-tooltip-trigger',
  (props, host) => {
    const state = TooltipContext.inject();
    transparentHost(host);
    const projected = captureChildren(host);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(className.value));

    const root = ref<HTMLButtonElement>();
    onMount(() => {
      if (root.current) {
        projectChildren(host, root.current, projected);
        state.anchor.current = root.current;
      }
    });

    return html`<button
      ref="${root}"
      type="button"
      data-slot="tooltip-trigger"
      aria-describedby="${`${state.baseId}-content`}"
      data-state="${computed(() => stateAttr(state.open.value))}"
      class="${classes}"
      @pointerenter=${() => state.requestOpen()}
      @focus=${() => state.requestOpen()}
      @pointerleave=${() => state.requestClose()}
      @blur=${() => state.requestClose()}
      @pointerdown=${() => state.requestClose()}
    >${props.children}</button>`;
  },
);

// ── ui-tooltip-content ───────────────────────────────────────────────

const contentClasses =
  'z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95';

export type TooltipContentProps = {
  side?: Side;
  /** Gap in px between trigger and content. Default 0 (upstream). */
  sideOffset?: number;
  /**
   * Move the content to `document.body` so `position: fixed` escapes
   * transformed ancestors. Defaults to true; pass false to render inline.
   */
  portal?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const TooltipContent = component<TooltipContentProps>(
  'ui-tooltip-content',
  (props, host) => {
    const state = TooltipContext.inject();
    transparentHost(host);
    const projected = captureChildren(host);

    const sideAttr = attr(props.side, host, 'side');
    const side = computed<Side>(() => (sideAttr.value as Side) ?? 'top');
    const sideOffset = computed<number>(() => props.sideOffset.value ?? 0);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(contentClasses, className.value));
    const contentId = `${state.baseId}-content`;

    const content = ref<HTMLDivElement>();

    // Portal the content to <body> (default on) so its fixed positioning
    // escapes transformed ancestors. Floating positioning, Escape handling,
    // and projection all operate on `content` by reference — move-safe.
    const portalEnabled =
      props.portal.value ?? (host.getAttribute('portal') === 'false' ? false : true);
    portal(content, { enabled: portalEnabled });

    let disposePosition: (() => void) | null = null;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') state.requestClose();
    };

    const stopPositioning = (): void => {
      if (disposePosition) {
        disposePosition();
        disposePosition = null;
      }
      document.removeEventListener('keydown', onKeyDown, true);
    };

    effect(() => {
      if (state.open.value) {
        document.addEventListener('keydown', onKeyDown, true);
        // Position after the `hidden` binding clears so the element is measurable.
        queueMicrotask(() => {
          if (!state.open.value) return;
          const anchor = state.anchor.current;
          if (anchor && content.current) {
            disposePosition?.();
            disposePosition = positionFloating(anchor, content.current, {
              side: side.value,
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
      role="tooltip"
      data-slot="tooltip-content"
      id="${contentId}"
      data-state="${computed(() => stateAttr(state.open.value))}"
      hidden="${computed(() => !state.open.value)}"
      class="${classes}"
    >${props.children}</div>`;
  },
);
