/**
 * ui/sheet.ts — Sheet.
 *
 * Ported from new-york-v4/ui/sheet.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui),
 * which wraps the Radix Dialog behavior (MIT). A Sheet is a Dialog that slides
 * in from a screen edge; this mirrors our `dialog.ts` machinery (shared state
 * via a subtree-scoped `SheetContext`, the dismissable-layer + focus lib items,
 * a portaled fixed overlay) and adds the `side` (top/right/bottom/left) panel
 * variants.
 *
 * ```
 * <ui-sheet>
 *   <ui-sheet-trigger>Open</ui-sheet-trigger>
 *   <ui-sheet-content side="right">
 *     <ui-sheet-header>
 *       <ui-sheet-title>Title</ui-sheet-title>
 *       <ui-sheet-description>Description</ui-sheet-description>
 *     </ui-sheet-header>
 *     …
 *     <ui-sheet-footer>…</ui-sheet-footer>
 *   </ui-sheet-content>
 * </ui-sheet>
 * ```
 *
 * PORTAL (default on, same as dialog): the overlay + content wrapper moves to
 * `document.body` on mount via the `portal` lib item, so `position: fixed`
 * resolves against the viewport and a transformed/filtered ancestor can't
 * become its containing block. Pass `portal={false}` (or `portal="false"`) to
 * render inline. Dismissal listens on `document` and the focus trap works by
 * reference, so both survive the move. Note: in `@nisli/ssg` static rendering
 * the portaled subtree escapes the captured HTML (client-only, matching
 * upstream); use `portal={false}` if you need it in static output.
 *
 * Open/close changes dispatch a bubbling `ui-open-change` CustomEvent
 * (`detail: { open }`) from the `<ui-sheet>` host.
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
  ref,
  type ReadonlySignal,
  type TemplateResult,
} from '@nisli/core';
import { cn, cv, isPinned, transparentHost } from '../lib/utils.js';
import { dismissableLayer } from '../lib/dismissable-layer.js';
import { focusTrap } from '../lib/focus.js';
import { portal } from '../lib/portal.js';

// ── Shared state (published on the <ui-sheet> host) ──────────────────

export interface SheetState {
  open: ReadonlySignal<boolean>;
  setOpen(open: boolean): void;
  baseId: string;
}

/** Subtree-scoped channel from <ui-sheet> to its parts. */
const SheetContext = createContext<SheetState>('Sheet', { providerTag: 'ui-sheet' });

let uid = 0;

// ── ui-sheet (root, owns state) ──────────────────────────────────────

export type SheetProps = {
  open?: boolean;
  defaultOpen?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const Sheet = component<SheetProps>('ui-sheet', (props, host) => {
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

  const state: SheetState = { open, setOpen, baseId: `ui-sheet-${++uid}` };
  SheetContext.provide(host, state);

  const className = props.className;
  const classes = computed(() => cn(className.value));

  return html`<div data-slot="sheet" style="display:contents" class="${classes}">${children()}</div>`;
}, {
  // PATTERN A: `open` is the attribute-as-truth state; `defaultOpen` seeds it.
  attrs: {
    open: 'boolean',
    defaultOpen: 'boolean',
    className: 'string',
  },
});

// ── ui-sheet-trigger ─────────────────────────────────────────────────

export type SheetTriggerProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const SheetTrigger = component<SheetTriggerProps>('ui-sheet-trigger', (props, host) => {
  const state = SheetContext.inject();
  transparentHost(host);

  const className = props.className;
  const classes = computed(() => cn(className.value));

  return html`<button
    type="button"
    data-slot="sheet-trigger"
    aria-haspopup="dialog"
    aria-controls="${`${state.baseId}-content`}"
    aria-expanded="${computed(() => (state.open.value ? 'true' : 'false'))}"
    data-state="${computed(() => (state.open.value ? 'open' : 'closed'))}"
    class="${classes}"
    @click=${() => state.setOpen(true)}
  >${children()}</button>`;
}, { attrs: { className: 'string' } });

// ── ui-sheet-close (standalone) ──────────────────────────────────────

export type SheetCloseProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const SheetClose = component<SheetCloseProps>('ui-sheet-close', (props, host) => {
  const state = SheetContext.inject();
  transparentHost(host);

  const className = props.className;
  const classes = computed(() => cn(className.value));

  return html`<button
    type="button"
    data-slot="sheet-close"
    class="${classes}"
    @click=${() => state.setOpen(false)}
  >${children()}</button>`;
}, { attrs: { className: 'string' } });

// ── ui-sheet-content (overlay + side panel + close) ──────────────────

const overlayClasses =
  'fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0';

export const sheetContentVariants = cv(
  'fixed z-50 flex flex-col gap-4 bg-background shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-500',
  {
    variants: {
      side: {
        right:
          'inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm',
        left: 'inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm',
        top: 'inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
        bottom:
          'inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
      },
    },
    defaultVariants: {
      side: 'right',
    },
  },
);

const closeClasses =
  'absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-secondary';

export type SheetSide = 'top' | 'right' | 'bottom' | 'left';

export type SheetContentProps = {
  side?: SheetSide;
  showCloseButton?: boolean;
  /**
   * Move the overlay + content to `document.body` so `position: fixed` escapes
   * transformed ancestors. Defaults to true; pass false to render inline.
   */
  portal?: boolean;
  /**
   * Inline style forwarded onto the content panel. Upstream spreads `{...props}`
   * (style included); consumers set panel-scoped CSS vars this way — e.g. the
   * sidebar's mobile drawer overrides `--sidebar-width` on the panel.
   */
  style?: string;
  className?: string;
  children?: string | TemplateResult;
};

export const SheetContent = component<SheetContentProps>('ui-sheet-content', (props, host) => {
  const state = SheetContext.inject();
  transparentHost(host);

  const withClose = props.showCloseButton.value as boolean;
  const side = props.side;
  const dataState = computed(() => (state.open.value ? 'open' : 'closed'));
  const hidden = computed(() => !state.open.value);
  const contentId = `${state.baseId}-content`;

  const className = props.className;
  const classes = computed(() =>
    cn(sheetContentVariants({ side: side.value ?? 'right' }), className.value),
  );

  const portalRef = ref<HTMLDivElement>();
  const overlayRef = ref<HTMLDivElement>();
  const contentRef = ref<HTMLElement>();

  // Portal the overlay + content wrapper to <body> (default on) so fixed
  // positioning escapes transformed ancestors. Static setup-time decision
  // (PATTERN B): `portal` is a default-true boolean — absent → on, "false" →
  // off. Dismissal (document listeners) and the focus trap (by ref) keep
  // working after the move.
  const portalEnabled = props.portal.value as boolean;
  portal(portalRef, { enabled: portalEnabled });

  const layer = dismissableLayer(contentRef, {
    onDismiss: () => state.setOpen(false),
  });
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

  const closeButton = html`<button
    type="button"
    data-slot="sheet-close"
    aria-label="Close"
    class="${closeClasses}"
    @click=${() => state.setOpen(false)}
  ><svg
      class="size-4"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    ><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg><span class="sr-only">Close</span></button>`;

  return html`<div ref="${portalRef}" data-slot="sheet-portal" style="display:contents">
    <div
      ref="${overlayRef}"
      data-slot="sheet-overlay"
      data-state="${dataState}"
      hidden="${hidden}"
      class="${overlayClasses}"
    ></div>
    <div
      ref="${contentRef}"
      role="dialog"
      aria-modal="true"
      data-slot="sheet-content"
      id="${contentId}"
      aria-labelledby="${`${state.baseId}-title`}"
      aria-describedby="${`${state.baseId}-description`}"
      data-state="${dataState}"
      hidden="${hidden}"
      tabindex="-1"
      style="${props.style}"
      class="${classes}"
    >${children()}${withClose ? closeButton : ''}</div>
  </div>`;
}, {
  // PATTERN B: default-true booleans (absent → true, "false" → false).
  attrs: {
    side: 'string',
    showCloseButton: { type: 'boolean', default: true },
    portal: { type: 'boolean', default: true },
    style: 'string',
    className: 'string',
  },
});

// ── ui-sheet-header / -footer ────────────────────────────────────────

export type SheetSectionProps = {
  className?: string;
  children?: string | TemplateResult;
};

function sheetSection(tag: string, slot: string, base: string) {
  return component<SheetSectionProps>(tag, (props, host) => {
    transparentHost(host);
    const className = props.className;
    const classes = computed(() => cn(base, className.value));
    return html`<div data-slot="${slot}" class="${classes}">${children()}</div>`;
  }, { attrs: { className: 'string' } });
}

export const SheetHeader = sheetSection(
  'ui-sheet-header',
  'sheet-header',
  'flex flex-col gap-1.5 p-4',
);

export const SheetFooter = sheetSection(
  'ui-sheet-footer',
  'sheet-footer',
  'mt-auto flex flex-col gap-2 p-4',
);

// ── ui-sheet-title / -description ────────────────────────────────────

export type SheetTitleProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const SheetTitle = component<SheetTitleProps>('ui-sheet-title', (props, host) => {
  const state = SheetContext.inject();
  transparentHost(host);
  const className = props.className;
  const classes = computed(() => cn('font-semibold text-foreground', className.value));
  return html`<h2
    data-slot="sheet-title"
    id="${`${state.baseId}-title`}"
    class="${classes}"
  >${children()}</h2>`;
}, { attrs: { className: 'string' } });

export type SheetDescriptionProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const SheetDescription = component<SheetDescriptionProps>(
  'ui-sheet-description',
  (props, host) => {
    const state = SheetContext.inject();
    transparentHost(host);
    const className = props.className;
    const classes = computed(() => cn('text-sm text-muted-foreground', className.value));
    return html`<p
      data-slot="sheet-description"
      id="${`${state.baseId}-description`}"
      class="${classes}"
    >${children()}</p>`;
  },
  { attrs: { className: 'string' } },
);
