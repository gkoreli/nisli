/**
 * ui/popover.ts — Popover.
 *
 * Ported from new-york-v4/ui/popover.tsx (shadcn/ui, MIT —
 * https://github.com/shadcn-ui/ui) and the Radix Popover behavior it wraps
 * (MIT — https://github.com/radix-ui/primitives), rebuilt as Nisli custom
 * elements. A trigger toggles a floating panel that positions with the
 * floating lib item, dismisses on Escape/outside-pointer (dismissable-layer),
 * and moves focus into the panel + restores it on close (focus lib).
 *
 * Elements: ui-popover / -trigger / -anchor / -content / -header / -title /
 * -description. Content carries data-side/data-align for the slide animations
 * and, by default, is moved to `document.body` on mount via the `portal` lib
 * item so its `position: fixed` escapes transformed ancestors (pass
 * `portal={false}` / `portal="false"` to render inline). Positioning
 * (floating), dismissal (dismissable-layer on document), and the focus trap
 * all operate by reference, so they survive the move. SSG note: the portaled
 * content escapes the static snapshot (client-only, matching upstream); use
 * `portal={false}` if needed. The panel is role="dialog"; focus moves into it
 * on open and restores on close, but is NOT trapped
 * (`focusTrap(..., { trapped: false })`) — Radix's non-modal Popover default,
 * so Tab can leave the panel.
 *
 * Open state is signal-driven (controlled `open` prop; default-open / attr
 * fallback) and dispatches a bubbling `ui-open-change` CustomEvent.
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
import { dismissableLayer } from '../lib/dismissable-layer.js';
import { focusTrap } from '../lib/focus.js';
import { portal } from '../lib/portal.js';

// ── Shared state (published on the <ui-popover> host) ────────────────

export interface PopoverState {
  open: ReadonlySignal<boolean>;
  setOpen(open: boolean): void;
  baseId: string;
  /** The trigger button (default positioning anchor + dismissal exception). */
  trigger: Ref<HTMLElement>;
  /** An explicit <ui-popover-anchor>, if used; overrides the trigger anchor. */
  anchor: Ref<HTMLElement>;
}

/** Subtree-scoped channel from <ui-popover> to its parts. */
const PopoverContext = createContext<PopoverState>('Popover', { providerTag: 'ui-popover' });

let uid = 0;

const stateAttr = (open: boolean) => (open ? 'open' : 'closed');

// ── ui-popover (root, owns state) ────────────────────────────────────

export type PopoverProps = {
  open?: boolean;
  defaultOpen?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const Popover = component<PopoverProps>('ui-popover', (props, host) => {
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

  const state: PopoverState = {
    open,
    setOpen,
    baseId: `ui-popover-${++uid}`,
    trigger: ref<HTMLElement>(),
    anchor: ref<HTMLElement>(),
  };
  PopoverContext.provide(host, state);

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn(className.value));

  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<div
    ref="${root}"
    data-slot="popover"
    style="display:contents"
    class="${classes}"
  >${props.children}</div>`;
});

// ── ui-popover-trigger ───────────────────────────────────────────────

export type PopoverTriggerProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const PopoverTrigger = component<PopoverTriggerProps>(
  'ui-popover-trigger',
  (props, host) => {
    const state = PopoverContext.inject();
    transparentHost(host);
    const projected = captureChildren(host);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(className.value));

    const root = ref<HTMLButtonElement>();
    onMount(() => {
      if (root.current) {
        projectChildren(host, root.current, projected);
        state.trigger.current = root.current;
      }
    });

    return html`<button
      ref="${root}"
      type="button"
      data-slot="popover-trigger"
      aria-haspopup="dialog"
      aria-controls="${`${state.baseId}-content`}"
      aria-expanded="${computed(() => (state.open.value ? 'true' : 'false'))}"
      data-state="${computed(() => stateAttr(state.open.value))}"
      class="${classes}"
      @click=${() => state.setOpen(!state.open.value)}
    >${props.children}</button>`;
  },
);

// ── ui-popover-anchor (optional positioning anchor) ──────────────────

export type PopoverAnchorProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const PopoverAnchor = component<PopoverAnchorProps>(
  'ui-popover-anchor',
  (props, host) => {
    const state = PopoverContext.inject();
    transparentHost(host);
    const projected = captureChildren(host);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(className.value));

    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) {
        projectChildren(host, root.current, projected);
        state.anchor.current = root.current;
      }
    });

    return html`<div ref="${root}" data-slot="popover-anchor" style="display:contents" class="${classes}">${props.children}</div>`;
  },
);

// ── ui-popover-content ───────────────────────────────────────────────

const contentClasses =
  'z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95';

export type PopoverContentProps = {
  side?: Side;
  align?: Align;
  /** Gap in px between anchor and content. Default 4 (upstream). */
  sideOffset?: number;
  alignOffset?: number;
  /**
   * Move the content to `document.body` so `position: fixed` escapes
   * transformed ancestors. Defaults to true; pass false to render inline.
   */
  portal?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const PopoverContent = component<PopoverContentProps>(
  'ui-popover-content',
  (props, host) => {
    const state = PopoverContext.inject();
    transparentHost(host);
    const projected = captureChildren(host);

    const sideAttr = attr(props.side, host, 'side');
    const alignAttr = attr(props.align, host, 'align');
    const side = computed<Side>(() => (sideAttr.value as Side) ?? 'bottom');
    const align = computed<Align>(() => (alignAttr.value as Align) ?? 'center');
    const sideOffset = computed<number>(() => props.sideOffset.value ?? 4);
    const alignOffset = computed<number>(() => props.alignOffset.value ?? 0);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(contentClasses, className.value));
    const contentId = `${state.baseId}-content`;

    const content = ref<HTMLElement>();
    const anchorEl = () => state.anchor.current ?? state.trigger.current;

    // Portal the content to <body> (default on) so its fixed positioning
    // escapes transformed ancestors. Floating, dismissable-layer (document),
    // focus trap, and projection all operate on `content` by reference.
    const portalEnabled =
      props.portal.value ?? (host.getAttribute('portal') === 'false' ? false : true);
    portal(content, { enabled: portalEnabled });

    const layer = dismissableLayer(content, {
      onDismiss: () => state.setOpen(false),
      // Clicking the trigger while open must not double-fire dismiss + toggle.
      onPointerDownOutside: (event) => {
        const t = state.trigger.current;
        if (t && t.contains(event.target as Node)) event.preventDefault();
      },
    });
    // Non-modal, matching Radix Popover: focus moves in on open and restores
    // on close, but Tab can leave the panel.
    const trap = focusTrap(content, { returnFocus: state.trigger, trapped: false });

    let disposePosition: (() => void) | null = null;
    const stopPositioning = (): void => {
      disposePosition?.();
      disposePosition = null;
    };

    effect(() => {
      if (state.open.value) {
        layer.activate();
        queueMicrotask(() => {
          if (!state.open.value) return;
          const anchor = anchorEl();
          if (anchor && content.current) {
            stopPositioning();
            disposePosition = positionFloating(anchor, content.current, {
              side: side.value,
              align: align.value,
              sideOffset: sideOffset.value,
              alignOffset: alignOffset.value,
            });
          }
          trap.activate();
        });
      } else {
        trap.deactivate();
        layer.deactivate();
        stopPositioning();
      }
    });

    onMount(() => {
      if (content.current) projectChildren(host, content.current, projected);
    });
    onCleanup(stopPositioning);

    return html`<div
      ref="${content}"
      role="dialog"
      data-slot="popover-content"
      id="${contentId}"
      data-state="${computed(() => stateAttr(state.open.value))}"
      hidden="${computed(() => !state.open.value)}"
      tabindex="-1"
      class="${classes}"
    >${props.children}</div>`;
  },
);

// ── ui-popover-header / -title / -description ────────────────────────

export type PopoverSectionProps = {
  className?: string;
  children?: string | TemplateResult;
};

function popoverSection(tag: string, slot: string, base: string, element: 'div' | 'p') {
  return component<PopoverSectionProps>(tag, (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(base, className.value));
    const root = ref<HTMLElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return element === 'p'
      ? html`<p ref="${root}" data-slot="${slot}" class="${classes}">${props.children}</p>`
      : html`<div ref="${root}" data-slot="${slot}" class="${classes}">${props.children}</div>`;
  });
}

export const PopoverHeader = popoverSection(
  'ui-popover-header',
  'popover-header',
  'flex flex-col gap-1 text-sm',
  'div',
);

export const PopoverTitle = popoverSection(
  'ui-popover-title',
  'popover-title',
  'font-medium',
  'div',
);

export const PopoverDescription = popoverSection(
  'ui-popover-description',
  'popover-description',
  'text-muted-foreground',
  'p',
);
