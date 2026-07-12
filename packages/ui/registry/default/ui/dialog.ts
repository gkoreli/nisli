/**
 * ui/dialog.ts — Dialog.
 *
 * Ported from new-york-v4/ui/dialog.tsx (shadcn/ui, MIT —
 * https://github.com/shadcn-ui/ui) and the Radix Dialog behavior it wraps
 * (MIT — https://github.com/radix-ui/primitives), rebuilt as Nisli custom
 * elements. Class lists, data-slot names, and structure match the canonical
 * v4 source; the modal behavior (Escape/outside-click dismissal, focus trap +
 * restore) comes from the dismissable-layer and focus lib items.
 *
 * The elements composing a dialog:
 *   <ui-dialog>
 *     <ui-dialog-trigger>Open</ui-dialog-trigger>
 *     <ui-dialog-content>
 *       <ui-dialog-header>
 *         <ui-dialog-title>Title</ui-dialog-title>
 *         <ui-dialog-description>Description</ui-dialog-description>
 *       </ui-dialog-header>
 *       …
 *       <ui-dialog-footer>…</ui-dialog-footer>
 *     </ui-dialog-content>
 *   </ui-dialog>
 *
 * PORTAL (default on): the overlay + content wrapper is moved to
 * `document.body` on mount via the `portal` lib item, so `position: fixed`
 * always resolves against the viewport — a transformed/filtered ancestor no
 * longer becomes its containing block and can't clip the overlay. Pass
 * `portal={false}` (or the `portal="false"` attribute) to render inline, e.g.
 * to keep the content in static output. The dismissal listeners live on
 * `document` and the focus trap works by element reference, so both keep
 * working after the move. Note: in `@nisli/ssg` static rendering the portaled
 * subtree escapes the component's captured HTML (it moves to the render
 * sandbox body) — closed-by-default dialogs are client-only anyway, matching
 * upstream's client-portal behavior; use `portal={false}` if you need it in
 * the static snapshot.
 *
 * Open/close changes dispatch a bubbling `ui-open-change` CustomEvent
 * (`detail: { open }`) from the `<ui-dialog>` host.
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
  ref,
  type ReadonlySignal,
  type TemplateResult,
} from '@nisli/core';
import { cn, isPinned, transparentHost } from '../lib/utils.js';
import { dismissableLayer } from '../lib/dismissable-layer.js';
import { focusTrap } from '../lib/focus.js';
import { portal } from '../lib/portal.js';

// ── Shared state (published on the <ui-dialog> host) ─────────────────

export interface DialogState {
  open: ReadonlySignal<boolean>;
  setOpen(open: boolean): void;
  baseId: string;
}

/** Subtree-scoped channel from <ui-dialog> to its parts. */
const DialogContext = createContext<DialogState>('Dialog', { providerTag: 'ui-dialog' });

let uid = 0;

// ── ui-dialog (root, owns state) ─────────────────────────────────────

export type DialogProps = {
  /** Controlled open state. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

// PATTERN A: `open` is the attribute-as-truth state; `defaultOpen` seeds it.
const dialogAttrs = {
  open: 'boolean',
  defaultOpen: 'boolean',
  className: 'string',
} satisfies ComponentAttrs<DialogProps>;

export const Dialog = component<DialogProps, typeof dialogAttrs>('ui-dialog', (props, host) => {
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

  const state: DialogState = { open, setOpen, baseId: `ui-dialog-${++uid}` };
  DialogContext.provide(host, state);

  const className = props.className;
  const classes = computed(() => cn(className.value));

  // The root is layout-transparent (shadcn's Dialog root renders no box).
  return html`<div data-slot="dialog" style="display:contents" class="${classes}">${children()}</div>`;
}, { attrs: dialogAttrs });

// ── ui-dialog-trigger ────────────────────────────────────────────────

export type DialogTriggerProps = {
  className?: string;
  children?: string | TemplateResult;
};

const dialogTriggerAttrs = { className: 'string' } satisfies ComponentAttrs<DialogTriggerProps>;

export const DialogTrigger = component<DialogTriggerProps, typeof dialogTriggerAttrs>(
  'ui-dialog-trigger',
  (props, host) => {
    const state = DialogContext.inject();
    transparentHost(host);

    const className = props.className;
    const classes = computed(() => cn(className.value));

    return html`<button
      type="button"
      data-slot="dialog-trigger"
      aria-haspopup="dialog"
      aria-controls="${`${state.baseId}-content`}"
      aria-expanded="${computed(() => (state.open.value ? 'true' : 'false'))}"
      data-state="${computed(() => (state.open.value ? 'open' : 'closed'))}"
      class="${classes}"
      @click=${() => state.setOpen(true)}
    >${children()}</button>`;
  },
  { attrs: dialogTriggerAttrs },
);

// ── ui-dialog-close (standalone, for footer composition) ─────────────

export type DialogCloseProps = {
  className?: string;
  children?: string | TemplateResult;
};

/**
 * A button that closes the dialog, for use anywhere inside it (e.g. a footer
 * "Cancel"). The content's built-in top-right close button is separate; this
 * mirrors upstream's exported `DialogClose`.
 */
const dialogCloseAttrs = { className: 'string' } satisfies ComponentAttrs<DialogCloseProps>;

export const DialogClose = component<DialogCloseProps, typeof dialogCloseAttrs>('ui-dialog-close', (props, host) => {
  const state = DialogContext.inject();
  transparentHost(host);

  const className = props.className;
  const classes = computed(() => cn(className.value));

  return html`<button
    type="button"
    data-slot="dialog-close"
    class="${classes}"
    @click=${() => state.setOpen(false)}
  >${children()}</button>`;
}, { attrs: dialogCloseAttrs });

// ── ui-dialog-content (overlay + panel + close) ──────────────────────

const overlayClasses =
  'fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0';

const contentClasses =
  'fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg';

const closeClasses =
  "absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

export type DialogContentProps = {
  /** Render the top-right close button. Defaults to true. */
  showCloseButton?: boolean;
  /**
   * Move the overlay + content to `document.body` so `position: fixed` escapes
   * transformed ancestors. Defaults to true; pass false to render inline.
   */
  portal?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

// PATTERN B: default-true booleans (absent → true, "false" → false).
const dialogContentAttrs = {
  showCloseButton: { type: 'boolean', default: true },
  portal: { type: 'boolean', default: true },
  className: 'string',
} satisfies ComponentAttrs<DialogContentProps>;

export const DialogContent = component<DialogContentProps, typeof dialogContentAttrs>(
  'ui-dialog-content',
  (props, host) => {
    const state = DialogContext.inject();
    transparentHost(host);

    const withClose = props.showCloseButton.value;
    const dataState = computed(() => (state.open.value ? 'open' : 'closed'));
    const hidden = computed(() => !state.open.value);
    const contentId = `${state.baseId}-content`;

    const className = props.className;
    const classes = computed(() => cn(contentClasses, className.value));

    const portalRef = ref<HTMLDivElement>();
    const overlayRef = ref<HTMLDivElement>();
    const contentRef = ref<HTMLElement>();

    // Portal the overlay + content wrapper to <body> (default on) so fixed
    // positioning escapes any transformed ancestor. Static setup-time decision
    // (PATTERN B): `portal` is a default-true boolean — absent → on, "false" →
    // off. The dismissable-layer (document listeners) and focus trap (operates
    // by ref) keep working after the move — verified in tests. Declared
    // 'boolean' now narrows to `boolean`.
    const portalEnabled = props.portal.value;
    portal(portalRef, { enabled: portalEnabled });

    // Escape / outside-pointer dismissal and modal focus trap, active only
    // while open. Both take the inner content root, never the host.
    const layer = dismissableLayer(contentRef, {
      onDismiss: () => state.setOpen(false),
    });
    const trap = focusTrap(contentRef);

    effect(() => {
      if (state.open.value) {
        layer.activate();
        // Activate the trap after the `hidden` binding has been removed so the
        // content is focusable and its tabbables are discoverable.
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
      data-slot="dialog-close"
      aria-label="Close"
      class="${closeClasses}"
      @click=${() => state.setOpen(false)}
    ><svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      ><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg><span class="sr-only">Close</span></button>`;

    return html`<div ref="${portalRef}" data-slot="dialog-portal" style="display:contents">
      <div
        ref="${overlayRef}"
        data-slot="dialog-overlay"
        data-state="${dataState}"
        hidden="${hidden}"
        class="${overlayClasses}"
      ></div>
      <div
        ref="${contentRef}"
        role="dialog"
        aria-modal="true"
        data-slot="dialog-content"
        id="${contentId}"
        aria-labelledby="${`${state.baseId}-title`}"
        aria-describedby="${`${state.baseId}-description`}"
        data-state="${dataState}"
        hidden="${hidden}"
        tabindex="-1"
        class="${classes}"
      >${children()}${withClose ? closeButton : ''}</div>
    </div>`;
  },
  { attrs: dialogContentAttrs },
);

// ── ui-dialog-header / -footer ───────────────────────────────────────

export type DialogSectionProps = {
  className?: string;
  children?: string | TemplateResult;
};

const dialogSectionAttrs = { className: 'string' } satisfies ComponentAttrs<DialogSectionProps>;

function dialogSection(tag: string, slot: string, base: string) {
  return component<DialogSectionProps, typeof dialogSectionAttrs>(tag, (props, host) => {
    transparentHost(host);
    const className = props.className;
    const classes = computed(() => cn(base, className.value));
    return html`<div data-slot="${slot}" class="${classes}">${children()}</div>`;
  }, { attrs: dialogSectionAttrs });
}

export const DialogHeader = dialogSection(
  'ui-dialog-header',
  'dialog-header',
  'flex flex-col gap-2 text-center sm:text-left',
);

export const DialogFooter = dialogSection(
  'ui-dialog-footer',
  'dialog-footer',
  'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
);

// ── ui-dialog-title / -description ───────────────────────────────────

export type DialogTitleProps = {
  className?: string;
  children?: string | TemplateResult;
};

const dialogTitleAttrs = { className: 'string' } satisfies ComponentAttrs<DialogTitleProps>;

export const DialogTitle = component<DialogTitleProps, typeof dialogTitleAttrs>('ui-dialog-title', (props, host) => {
  const state = DialogContext.inject();
  transparentHost(host);
  const className = props.className;
  const classes = computed(() => cn('text-lg leading-none font-semibold', className.value));
  return html`<h2
    data-slot="dialog-title"
    id="${`${state.baseId}-title`}"
    class="${classes}"
  >${children()}</h2>`;
}, { attrs: dialogTitleAttrs });

export type DialogDescriptionProps = {
  className?: string;
  children?: string | TemplateResult;
};

const dialogDescriptionAttrs = { className: 'string' } satisfies ComponentAttrs<DialogDescriptionProps>;

export const DialogDescription = component<DialogDescriptionProps, typeof dialogDescriptionAttrs>(
  'ui-dialog-description',
  (props, host) => {
    const state = DialogContext.inject();
    transparentHost(host);
    const className = props.className;
    const classes = computed(() => cn('text-sm text-muted-foreground', className.value));
    return html`<p
      data-slot="dialog-description"
      id="${`${state.baseId}-description`}"
      class="${classes}"
    >${children()}</p>`;
  },
  { attrs: dialogDescriptionAttrs },
);
