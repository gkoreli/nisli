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
 * The upstream arrow is rendered and positioned by the shared floating helper,
 * including collision flips and cross-axis clamping. SSG note: the portaled
 * content escapes the static snapshot (client-only, matching upstream); use
 * `portal={false}` if needed.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  children,
  component,
  type ComponentAttrs,
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
import { cn, transparentHost } from '../lib/utils.js';
import { floatingHidden, positionFloating, type Side } from '../lib/floating.js';
import { portal } from '../lib/portal.js';

// ── Module-level open/delay manager (TooltipProvider semantics) ──────

// shadcn's TooltipProvider pins delayDuration to 0 (tooltip.tsx:9) — canonical
// tooltips open instantly; Radix's raw 700ms default does not apply.
const DEFAULT_DELAY = 0;
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
  /** Hover/focus delay in ms before showing. Default 0 (shadcn provider). */
  delayDuration?: number;
  className?: string;
  children?: string | TemplateResult;
};

const tooltipAttrs = {
  className: 'string',
  delayDuration: 'number',
} satisfies ComponentAttrs<TooltipProps>;

export const Tooltip = component<TooltipProps, typeof tooltipAttrs>('ui-tooltip', (props, host) => {
  transparentHost(host);

  // NOTE: no PATTERN A here. Tooltip opens on hover/focus via internal state;
  // its user-facing open is NOT attribute-backed (there is no `open`/`default-open`
  // attribute read on the root), so `open` stays a controlled-only factory prop.
  const internal = signal<boolean>(false);
  const open = computed<boolean>(() => props.open.value ?? internal.value);
  const delay = computed<number>(() => props.delayDuration.value ?? DEFAULT_DELAY);
  const anchor = ref<HTMLElement>();

  // ONE stable close identity per tooltip: the module manager tracks the
  // active tooltip by callback identity, so a fresh closure per setOpen call
  // made a re-opening tooltip "close the previous one" — itself.
  const close = (): void => setOpen(false);
  const setOpen = (next: boolean): void => {
    if (next === open.value) return;
    internal.value = next;
    if (next) notifyOpened(close);
    else notifyClosed(close);
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

  const className = props.className;
  const classes = computed(() => cn(className.value));

  // Cancel any pending open if the tooltip is torn down mid-hover.
  onCleanup(() => state.requestClose());

  return html`<div
    data-slot="tooltip"
    style="display:contents"
    class="${classes}"
  >${children()}</div>`;
}, { attrs: tooltipAttrs });

// ── ui-tooltip-trigger ───────────────────────────────────────────────

export type TooltipTriggerProps = {
  className?: string;
  children?: string | TemplateResult;
};

const tooltipTriggerAttrs = { className: 'string' } satisfies ComponentAttrs<TooltipTriggerProps>;

export const TooltipTrigger = component<TooltipTriggerProps, typeof tooltipTriggerAttrs>(
  'ui-tooltip-trigger',
  (props, host) => {
    const state = TooltipContext.inject();
    transparentHost(host);

    const className = props.className;
    const classes = computed(() => cn(className.value));

    // Ref kept for the floating anchor (positioning reads it by reference),
    // not for projection — children() renders the slot directly.
    const root = ref<HTMLButtonElement>();
    onMount(() => {
      if (root.current) state.anchor.current = root.current;
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
    >${children()}</button>`;
  },
  { attrs: tooltipTriggerAttrs },
);

// ── ui-tooltip-content ───────────────────────────────────────────────

const contentClasses =
  'z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95';
const arrowClasses =
  'z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground';

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

// PATTERN B: `portal` is a default-true boolean (absent → true, "false" → false).
const tooltipContentAttrs = {
  side: 'string',
  sideOffset: 'number',
  portal: { type: 'boolean', default: true },
  className: 'string',
} satisfies ComponentAttrs<TooltipContentProps>;

export const TooltipContent = component<TooltipContentProps, typeof tooltipContentAttrs>(
  'ui-tooltip-content',
  (props, host) => {
    const state = TooltipContext.inject();
    transparentHost(host);

    const side = computed<Side>(() => (props.side.value as Side) ?? 'top');
    const sideOffset = computed<number>(() => props.sideOffset.value ?? 0);

    const className = props.className;
    const classes = computed(() => cn(contentClasses, className.value));
    const contentId = `${state.baseId}-content`;

    const content = ref<HTMLDivElement>();
    const arrow = ref<SVGSVGElement>();

    // Portal the content to <body> (default on) so its fixed positioning
    // escapes transformed ancestors. Floating positioning and Escape handling
    // operate on `content` by reference — move-safe. PATTERN B: `portal` is a
    // default-true boolean (absent → on, "false" → off; now narrows to `boolean`).
    const portalEnabled = props.portal.value;
    portal(content, { enabled: portalEnabled });

    let disposePosition: (() => void) | null = null;
    let positionFrame: number | null = null;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') state.requestClose();
    };

    const stopPositioning = (): void => {
      if (positionFrame !== null) {
        cancelAnimationFrame(positionFrame);
        positionFrame = null;
      }
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
          positionFrame = requestAnimationFrame(() => {
            positionFrame = null;
            if (!state.open.value) return;
            const anchor = state.anchor.current;
            const arrowElement = arrow.current;
            if (anchor && content.current && arrowElement) {
              disposePosition?.();
              disposePosition = positionFloating(anchor, content.current, {
                side: side.value,
                sideOffset: sideOffset.value,
                arrow: arrowElement,
              });
            }
          });
        });
      } else {
        stopPositioning();
      }
    });

    onCleanup(stopPositioning);

    return html`<div
      ref="${content}"
      role="tooltip"
      data-slot="tooltip-content"
      id="${contentId}"
      data-state="${computed(() => stateAttr(state.open.value))}"
      hidden="${floatingHidden(state.open, content)}"
      class="${classes}"
    >${children()}<svg
      ref="${arrow}"
      data-slot="tooltip-arrow"
      aria-hidden="true"
      viewBox="0 0 30 10"
      preserveAspectRatio="none"
      style="position:absolute"
      class="${arrowClasses}"
    ><polygon points="0,0 30,0 15,10"></polygon></svg></div>`;
  },
  { attrs: tooltipContentAttrs },
);
