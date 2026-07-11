/**
 * ui/alert-dialog.ts — Alert Dialog.
 *
 * Ported from new-york-v4/ui/alert-dialog.tsx (shadcn/ui, MIT —
 * https://github.com/shadcn-ui/ui) and the Radix AlertDialog behavior it wraps
 * (MIT — https://github.com/radix-ui/primitives), rebuilt as Nisli custom
 * elements. A modal that interrupts the user and expects an explicit response.
 *
 * Elements: ui-alert-dialog / -trigger / -content / -header / -footer /
 * -media / -title / -description / -action / -cancel. Like ui-dialog but with
 * role="alertdialog" and no outside-pointer dismissal — only the Cancel/Action
 * buttons or Escape close it (Radix AlertDialog semantics). There is no
 * top-right close button. Content renders inline (position:fixed, z-50; no
 * portal in v1 — same transformed-ancestor caveat as ui-dialog) and traps +
 * restores focus via the focus lib.
 *
 * Open state is signal-driven (controlled `open` prop; default-open / attr
 * fallback) and dispatches a bubbling `ui-open-change` CustomEvent. Action and
 * Cancel both close the dialog; their native click still bubbles, so a consumer
 * can `addEventListener` on the action button to run the confirmed operation.
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
import { buttonVariants, type ButtonSize, type ButtonVariant } from './button.js';

// ── Shared state (published on the <ui-alert-dialog> host) ───────────

export interface AlertDialogState {
  open: ReadonlySignal<boolean>;
  setOpen(open: boolean): void;
  baseId: string;
}

type AlertDialogHost = HTMLElement & { __uiAlertDialog?: AlertDialogState };

let uid = 0;

function useAlertDialogState(host: HTMLElement, tag: string): AlertDialogState {
  const parent = host.closest('ui-alert-dialog') as AlertDialogHost | null;
  const state = parent?.__uiAlertDialog;
  if (!state) {
    throw new Error(`<${tag}> must be used inside <ui-alert-dialog>.`);
  }
  return state;
}

const stateAttr = (open: boolean) => (open ? 'open' : 'closed');

// ── ui-alert-dialog (root, owns state) ───────────────────────────────

export type AlertDialogProps = {
  open?: boolean;
  defaultOpen?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const AlertDialog = component<AlertDialogProps>('ui-alert-dialog', (props, host) => {
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

  const state: AlertDialogState = { open, setOpen, baseId: `ui-alert-dialog-${++uid}` };
  (host as AlertDialogHost).__uiAlertDialog = state;

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn(className.value));

  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<div
    ref="${root}"
    data-slot="alert-dialog"
    style="display:contents"
    class="${classes}"
  >${props.children}</div>`;
});

// ── ui-alert-dialog-trigger ──────────────────────────────────────────

export type AlertDialogTriggerProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const AlertDialogTrigger = component<AlertDialogTriggerProps>(
  'ui-alert-dialog-trigger',
  (props, host) => {
    const state = useAlertDialogState(host, 'ui-alert-dialog-trigger');
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
      data-slot="alert-dialog-trigger"
      aria-haspopup="dialog"
      aria-controls="${`${state.baseId}-content`}"
      aria-expanded="${computed(() => (state.open.value ? 'true' : 'false'))}"
      data-state="${computed(() => stateAttr(state.open.value))}"
      class="${classes}"
      @click=${() => state.setOpen(true)}
    >${props.children}</button>`;
  },
);

// ── ui-alert-dialog-content (overlay + panel) ────────────────────────

const overlayClasses =
  'fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0';

const contentClasses =
  'group/alert-dialog-content fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[size=sm]:max-w-xs data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[size=default]:sm:max-w-lg';

export type AlertDialogContentProps = {
  size?: 'default' | 'sm';
  className?: string;
  children?: string | TemplateResult;
};

export const AlertDialogContent = component<AlertDialogContentProps>(
  'ui-alert-dialog-content',
  (props, host) => {
    const state = useAlertDialogState(host, 'ui-alert-dialog-content');
    transparentHost(host);
    const projected = captureChildren(host);

    const sizeAttr = attr(props.size, host, 'size');
    const size = computed(() => sizeAttr.value ?? 'default');
    const dataState = computed(() => stateAttr(state.open.value));
    const hidden = computed(() => !state.open.value);
    const contentId = `${state.baseId}-content`;

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(contentClasses, className.value));

    const overlayRef = ref<HTMLDivElement>();
    const contentRef = ref<HTMLElement>();

    // Escape closes (Radix default); outside-pointer never dismisses an alert
    // dialog — it demands an explicit choice.
    const layer = dismissableLayer(contentRef, {
      onDismiss: () => state.setOpen(false),
      onPointerDownOutside: (event) => event.preventDefault(),
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

    onMount(() => {
      if (contentRef.current) projectChildren(host, contentRef.current, projected);
    });

    return html`<div data-slot="alert-dialog-portal" style="display:contents">
      <div
        ref="${overlayRef}"
        data-slot="alert-dialog-overlay"
        data-state="${dataState}"
        hidden="${hidden}"
        class="${overlayClasses}"
      ></div>
      <div
        ref="${contentRef}"
        role="alertdialog"
        aria-modal="true"
        data-slot="alert-dialog-content"
        data-size="${size}"
        id="${contentId}"
        aria-labelledby="${`${state.baseId}-title`}"
        aria-describedby="${`${state.baseId}-description`}"
        data-state="${dataState}"
        hidden="${hidden}"
        tabindex="-1"
        class="${classes}"
      >${props.children}</div>
    </div>`;
  },
);

// ── ui-alert-dialog-header / -footer / -media ────────────────────────

export type AlertDialogSectionProps = {
  className?: string;
  children?: string | TemplateResult;
};

function alertDialogSection(tag: string, slot: string, base: string) {
  return component<AlertDialogSectionProps>(tag, (props, host) => {
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

export const AlertDialogHeader = alertDialogSection(
  'ui-alert-dialog-header',
  'alert-dialog-header',
  'grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-6 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]',
);

export const AlertDialogFooter = alertDialogSection(
  'ui-alert-dialog-footer',
  'alert-dialog-footer',
  'flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end',
);

export const AlertDialogMedia = alertDialogSection(
  'ui-alert-dialog-media',
  'alert-dialog-media',
  "mb-2 inline-flex size-16 items-center justify-center rounded-md bg-muted sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-8",
);

// ── ui-alert-dialog-title / -description ─────────────────────────────

export type AlertDialogTitleProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const AlertDialogTitle = component<AlertDialogTitleProps>(
  'ui-alert-dialog-title',
  (props, host) => {
    const state = useAlertDialogState(host, 'ui-alert-dialog-title');
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        'text-lg font-semibold sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2',
        className.value,
      ),
    );
    const root = ref<HTMLHeadingElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<h2
      ref="${root}"
      data-slot="alert-dialog-title"
      id="${`${state.baseId}-title`}"
      class="${classes}"
    >${props.children}</h2>`;
  },
);

export type AlertDialogDescriptionProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const AlertDialogDescription = component<AlertDialogDescriptionProps>(
  'ui-alert-dialog-description',
  (props, host) => {
    const state = useAlertDialogState(host, 'ui-alert-dialog-description');
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
      data-slot="alert-dialog-description"
      id="${`${state.baseId}-description`}"
      class="${classes}"
    >${props.children}</p>`;
  },
);

// ── ui-alert-dialog-action / -cancel ─────────────────────────────────

export type AlertDialogActionProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: string | TemplateResult;
};

/** Confirm button — styled like Button, closes the dialog on click. */
export const AlertDialogAction = component<AlertDialogActionProps>(
  'ui-alert-dialog-action',
  (props, host) => {
    const state = useAlertDialogState(host, 'ui-alert-dialog-action');
    transparentHost(host);
    const projected = captureChildren(host);

    const variant = attr(props.variant, host, 'variant');
    const size = attr(props.size, host, 'size');
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        buttonVariants({ variant: variant.value ?? 'default', size: size.value ?? 'default' }),
        className.value,
      ),
    );

    const root = ref<HTMLButtonElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<button
      ref="${root}"
      type="button"
      data-slot="alert-dialog-action"
      class="${classes}"
      @click=${() => state.setOpen(false)}
    >${props.children}</button>`;
  },
);

export type AlertDialogCancelProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: string | TemplateResult;
};

/** Dismiss button — styled like an outline Button, closes the dialog. */
export const AlertDialogCancel = component<AlertDialogCancelProps>(
  'ui-alert-dialog-cancel',
  (props, host) => {
    const state = useAlertDialogState(host, 'ui-alert-dialog-cancel');
    transparentHost(host);
    const projected = captureChildren(host);

    const variant = attr(props.variant, host, 'variant');
    const size = attr(props.size, host, 'size');
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        buttonVariants({ variant: variant.value ?? 'outline', size: size.value ?? 'default' }),
        className.value,
      ),
    );

    const root = ref<HTMLButtonElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<button
      ref="${root}"
      type="button"
      data-slot="alert-dialog-cancel"
      class="${classes}"
      @click=${() => state.setOpen(false)}
    >${props.children}</button>`;
  },
);
