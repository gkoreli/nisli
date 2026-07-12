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
 * Open state is attribute-as-truth (the `open` ATTRIBUTE is the uncontrolled
 * state, like native <dialog open>; `defaultOpen` seeds it; a controlled `open`
 * factory prop overrides) and dispatches a bubbling `ui-open-change` CustomEvent.
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
  ref,
  type ReadonlySignal,
  type Ref,
  type TemplateResult,
} from '@nisli/core';
import { cn, isPinned, transparentHost } from '../lib/utils.js';
import { floatingHidden, positionFloating, type Align, type Side } from '../lib/floating.js';
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

// PATTERN A: `open` is the attribute-as-truth state; `defaultOpen` seeds it.
const popoverAttrs = {
  open: 'boolean',
  defaultOpen: 'boolean',
  className: 'string',
} satisfies ComponentAttrs<PopoverProps>;

export const Popover = component<PopoverProps, typeof popoverAttrs>('ui-popover', (props, host) => {
  transparentHost(host);

  // PATTERN A (ADR 0025 item 3): the `open` ATTRIBUTE is the uncontrolled state
  // (like native <dialog open>/<details open>). The attribute IS the truth. The
  // declared 'boolean' now narrows to `boolean`, so no `?? false` is needed.
  const open = computed<boolean>(() => props.open.value);

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

  const state: PopoverState = {
    open,
    setOpen,
    baseId: `ui-popover-${++uid}`,
    trigger: ref<HTMLElement>(),
    anchor: ref<HTMLElement>(),
  };
  PopoverContext.provide(host, state);

  const className = props.className;
  const classes = computed(() => cn(className.value));

  return html`<div
    data-slot="popover"
    style="display:contents"
    class="${classes}"
  >${children()}</div>`;
}, { attrs: popoverAttrs });

// ── ui-popover-trigger ───────────────────────────────────────────────

export type PopoverTriggerProps = {
  className?: string;
  children?: string | TemplateResult;
};

const popoverTriggerAttrs = { className: 'string' } satisfies ComponentAttrs<PopoverTriggerProps>;

export const PopoverTrigger = component<PopoverTriggerProps, typeof popoverTriggerAttrs>(
  'ui-popover-trigger',
  (props, host) => {
    const state = PopoverContext.inject();
    transparentHost(host);

    const className = props.className;
    const classes = computed(() => cn(className.value));

    return html`<button
      ref="${state.trigger}"
      type="button"
      data-slot="popover-trigger"
      aria-haspopup="dialog"
      aria-controls="${`${state.baseId}-content`}"
      aria-expanded="${computed(() => (state.open.value ? 'true' : 'false'))}"
      data-state="${computed(() => stateAttr(state.open.value))}"
      class="${classes}"
      @click=${() => state.setOpen(!state.open.value)}
    >${children()}</button>`;
  },
  { attrs: popoverTriggerAttrs },
);

// ── ui-popover-anchor (optional positioning anchor) ──────────────────

export type PopoverAnchorProps = {
  className?: string;
  children?: string | TemplateResult;
};

const popoverAnchorAttrs = { className: 'string' } satisfies ComponentAttrs<PopoverAnchorProps>;

export const PopoverAnchor = component<PopoverAnchorProps, typeof popoverAnchorAttrs>(
  'ui-popover-anchor',
  (props, host) => {
    const state = PopoverContext.inject();
    transparentHost(host);

    const className = props.className;
    const classes = computed(() => cn(className.value));

    return html`<div ref="${state.anchor}" data-slot="popover-anchor" style="display:contents" class="${classes}">${children()}</div>`;
  },
  { attrs: popoverAnchorAttrs },
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

// PATTERN B: `portal` is a default-true boolean (absent → true, "false" → false).
const popoverContentAttrs = {
  side: 'string',
  align: 'string',
  portal: { type: 'boolean', default: true },
  className: 'string',
} satisfies ComponentAttrs<PopoverContentProps>;

export const PopoverContent = component<PopoverContentProps, typeof popoverContentAttrs>(
  'ui-popover-content',
  (props, host) => {
    const state = PopoverContext.inject();
    transparentHost(host);

    const side = computed<Side>(() => (props.side.value as Side) ?? 'bottom');
    const align = computed<Align>(() => (props.align.value as Align) ?? 'center');
    const sideOffset = computed<number>(() => props.sideOffset.value ?? 4);
    const alignOffset = computed<number>(() => props.alignOffset.value ?? 0);

    const className = props.className;
    const classes = computed(() => cn(contentClasses, className.value));
    const contentId = `${state.baseId}-content`;

    const content = ref<HTMLElement>();
    const anchorEl = () => state.anchor.current ?? state.trigger.current;

    // Portal the content to <body> (default on) so its fixed positioning
    // escapes transformed ancestors. Floating, dismissable-layer (document),
    // and focus trap all operate on `content` by reference. PATTERN B: `portal`
    // is a default-true boolean — absent → on, "false" → off (now narrows to `boolean`).
    const portalEnabled = props.portal.value;
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

    let positionFrame: number | null = null;
    let disposePosition: (() => void) | null = null;
    const stopPositioning = (): void => {
      if (positionFrame !== null) cancelAnimationFrame(positionFrame);
      positionFrame = null;
      disposePosition?.();
      disposePosition = null;
    };

    effect(() => {
      if (state.open.value) {
        layer.activate();
        queueMicrotask(() => {
          if (!state.open.value) return;
          trap.activate();
          // The hidden binding converges after this effect. Measuring in this
          // microtask observes a zero-size panel, so wait for visible layout.
          // positionFloating reads the untransformed layout size once here.
          positionFrame = requestAnimationFrame(() => {
            positionFrame = null;
            if (!state.open.value) return;
            const anchor = anchorEl();
            if (!anchor || !content.current) return;
            disposePosition?.();
            disposePosition = positionFloating(anchor, content.current, {
              side: side.value,
              align: align.value,
              sideOffset: sideOffset.value,
              alignOffset: alignOffset.value,
            });
          });
        });
      } else {
        trap.deactivate();
        layer.deactivate();
        stopPositioning();
      }
    });

    onCleanup(stopPositioning);

    return html`<div
      ref="${content}"
      role="dialog"
      data-slot="popover-content"
      id="${contentId}"
      data-state="${computed(() => stateAttr(state.open.value))}"
      hidden="${floatingHidden(state.open, content)}"
      tabindex="-1"
      class="${classes}"
    >${children()}</div>`;
  },
  { attrs: popoverContentAttrs },
);

// ── ui-popover-header / -title / -description ────────────────────────

export type PopoverSectionProps = {
  className?: string;
  children?: string | TemplateResult;
};

const popoverSectionAttrs = { className: 'string' } satisfies ComponentAttrs<PopoverSectionProps>;

function popoverSection(tag: string, slot: string, base: string, element: 'div' | 'p') {
  return component<PopoverSectionProps, typeof popoverSectionAttrs>(tag, (props, host) => {
    transparentHost(host);
    const className = props.className;
    const classes = computed(() => cn(base, className.value));
    return element === 'p'
      ? html`<p data-slot="${slot}" class="${classes}">${children()}</p>`
      : html`<div data-slot="${slot}" class="${classes}">${children()}</div>`;
  }, { attrs: popoverSectionAttrs });
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
