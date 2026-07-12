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
  component,
  computed,
  effect,
  html,
  onMount,
  ref,
  signal,
  type ReadonlySignal,
  type TemplateResult,
} from '@nisli/core';
import {
  attr,
  captureChildren,
  cn,
  projectChildren,
  transparentHost,
} from '../lib/utils.js';
import { dismissableLayer } from '../lib/dismissable-layer.js';
import { focusTrap } from '../lib/focus.js';
import { portal } from '../lib/portal.js';

// ── Shared state (published on the <ui-dialog> host) ─────────────────

export interface DialogState {
  open: ReadonlySignal<boolean>;
  setOpen(open: boolean): void;
  baseId: string;
}

type DialogHost = HTMLElement & { __uiDialog?: DialogState };

let uid = 0;

function useDialogState(host: HTMLElement, tag: string): DialogState {
  const parent = host.closest('ui-dialog') as DialogHost | null;
  const state = parent?.__uiDialog;
  if (!state) {
    throw new Error(`<${tag}> must be used inside <ui-dialog>.`);
  }
  return state;
}

// ── ui-dialog (root, owns state) ─────────────────────────────────────

export type DialogProps = {
  /** Controlled open state. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const Dialog = component<DialogProps>('ui-dialog', (props, host) => {
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

  const state: DialogState = { open, setOpen, baseId: `ui-dialog-${++uid}` };
  (host as DialogHost).__uiDialog = state;

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn(className.value));

  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  // The root is layout-transparent (shadcn's Dialog root renders no box).
  return html`<div ref="${root}" data-slot="dialog" style="display:contents" class="${classes}">${props.children}</div>`;
});

// ── ui-dialog-trigger ────────────────────────────────────────────────

export type DialogTriggerProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const DialogTrigger = component<DialogTriggerProps>(
  'ui-dialog-trigger',
  (props, host) => {
    const state = useDialogState(host, 'ui-dialog-trigger');
    transparentHost(host);
    const projected = captureChildren(host);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(className.value));

    const root = ref<HTMLButtonElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<button
      ref="${root}"
      type="button"
      data-slot="dialog-trigger"
      aria-haspopup="dialog"
      aria-controls="${`${state.baseId}-content`}"
      aria-expanded="${computed(() => (state.open.value ? 'true' : 'false'))}"
      data-state="${computed(() => (state.open.value ? 'open' : 'closed'))}"
      class="${classes}"
      @click=${() => state.setOpen(true)}
    >${props.children}</button>`;
  },
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
export const DialogClose = component<DialogCloseProps>('ui-dialog-close', (props, host) => {
  const state = useDialogState(host, 'ui-dialog-close');
  transparentHost(host);
  const projected = captureChildren(host);

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn(className.value));

  const root = ref<HTMLButtonElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<button
    ref="${root}"
    type="button"
    data-slot="dialog-close"
    class="${classes}"
    @click=${() => state.setOpen(false)}
  >${props.children}</button>`;
});

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

export const DialogContent = component<DialogContentProps>(
  'ui-dialog-content',
  (props, host) => {
    const state = useDialogState(host, 'ui-dialog-content');
    transparentHost(host);
    const projected = captureChildren(host);

    const withClose = props.showCloseButton.value ?? true;
    const dataState = computed(() => (state.open.value ? 'open' : 'closed'));
    const hidden = computed(() => !state.open.value);
    const contentId = `${state.baseId}-content`;

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(contentClasses, className.value));

    const portalRef = ref<HTMLDivElement>();
    const overlayRef = ref<HTMLDivElement>();
    const contentRef = ref<HTMLElement>();

    // Portal the overlay + content wrapper to <body> (default on) so fixed
    // positioning escapes any transformed ancestor. Static setup-time decision:
    // the factory prop wins, else the `portal` attribute (absent → on;
    // "false" → off). The dismissable-layer (document listeners) and focus trap
    // (operates by ref) keep working after the move — verified in tests.
    const portalEnabled =
      props.portal.value ?? (host.getAttribute('portal') === 'false' ? false : true);
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

    onMount(() => {
      if (contentRef.current) projectChildren(host, contentRef.current, projected);
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
      >${props.children}${withClose ? closeButton : ''}</div>
    </div>`;
  },
);

// ── ui-dialog-header / -footer ───────────────────────────────────────

export type DialogSectionProps = {
  className?: string;
  children?: string | TemplateResult;
};

function dialogSection(tag: string, slot: string, base: string) {
  return component<DialogSectionProps>(tag, (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(base, className.value));
    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<div ref="${root}" data-slot="${slot}" class="${classes}">${props.children}</div>`;
  });
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

export const DialogTitle = component<DialogTitleProps>('ui-dialog-title', (props, host) => {
  const state = useDialogState(host, 'ui-dialog-title');
  transparentHost(host);
  const projected = captureChildren(host);
  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn('text-lg leading-none font-semibold', className.value));
  const root = ref<HTMLHeadingElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });
  return html`<h2
    ref="${root}"
    data-slot="dialog-title"
    id="${`${state.baseId}-title`}"
    class="${classes}"
  >${props.children}</h2>`;
});

export type DialogDescriptionProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const DialogDescription = component<DialogDescriptionProps>(
  'ui-dialog-description',
  (props, host) => {
    const state = useDialogState(host, 'ui-dialog-description');
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn('text-sm text-muted-foreground', className.value));
    const root = ref<HTMLParagraphElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<p
      ref="${root}"
      data-slot="dialog-description"
      id="${`${state.baseId}-description`}"
      class="${classes}"
    >${props.children}</p>`;
  },
);
