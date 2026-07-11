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
 * -description. Content renders inline with position:fixed (no portal in v1;
 * same transformed-ancestor caveat as ui-dialog) and carries data-side/
 * data-align for the slide animations. The panel is role="dialog" and its
 * focus is contained while open (focus lib traps; slightly more modal than
 * Radix's non-modal default — documented).
 *
 * Open state is signal-driven (controlled `open` prop; default-open / attr
 * fallback) and dispatches a bubbling `ui-open-change` CustomEvent.
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

type PopoverHost = HTMLElement & { __uiPopover?: PopoverState };

let uid = 0;

function usePopoverState(host: HTMLElement, tag: string): PopoverState {
  const parent = host.closest('ui-popover') as PopoverHost | null;
  const state = parent?.__uiPopover;
  if (!state) {
    throw new Error(`<${tag}> must be used inside <ui-popover>.`);
  }
  return state;
}

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
  (host as PopoverHost).__uiPopover = state;

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
    const state = usePopoverState(host, 'ui-popover-trigger');
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
    const state = usePopoverState(host, 'ui-popover-anchor');
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
  className?: string;
  children?: string | TemplateResult;
};

export const PopoverContent = component<PopoverContentProps>(
  'ui-popover-content',
  (props, host) => {
    const state = usePopoverState(host, 'ui-popover-content');
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

    const layer = dismissableLayer(content, {
      onDismiss: () => state.setOpen(false),
      // Clicking the trigger while open must not double-fire dismiss + toggle.
      onPointerDownOutside: (event) => {
        const t = state.trigger.current;
        if (t && t.contains(event.target as Node)) event.preventDefault();
      },
    });
    const trap = focusTrap(content, { returnFocus: state.trigger });

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
