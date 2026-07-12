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
 * top-right close button. By default the overlay + content wrapper is moved to
 * `document.body` on mount via the `portal` lib item so `position: fixed`
 * escapes transformed ancestors (pass `portal={false}` / `portal="false"` to
 * render inline). Escape dismissal (document listener) and the focus trap (by
 * ref) survive the move. SSG note: the portaled subtree escapes the static
 * snapshot (client-only, matching upstream); use `portal={false}` if needed.
 * Focus is trapped + restored via the focus lib.
 *
 * PATTERN A (ADR 0025 item 3): the `open` ATTRIBUTE is the uncontrolled state
 * (like native <dialog open>/<details open>); `defaultOpen` seeds it once. A
 * controlled factory `open` signal pins the prop and drives it instead. Action
 * and Cancel both close the dialog; their native click still bubbles, so a
 * consumer can `addEventListener` on the action button to run the confirmed
 * operation. Open/close changes dispatch a bubbling `ui-open-change`
 * CustomEvent (`detail: { open }`) from the `<ui-alert-dialog>` host.
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
import { cn, isPinned, transparentHost } from '../lib/utils.js';
import { dismissableLayer } from '../lib/dismissable-layer.js';
import { focusTrap } from '../lib/focus.js';
import { portal } from '../lib/portal.js';
import { buttonVariants, type ButtonSize, type ButtonVariant } from './button.js';

// ── Shared state (published on the <ui-alert-dialog> host) ───────────

export interface AlertDialogState {
  open: ReadonlySignal<boolean>;
  setOpen(open: boolean): void;
  baseId: string;
}

/** Subtree-scoped channel from <ui-alert-dialog> to its parts. */
const AlertDialogContext = createContext<AlertDialogState>('AlertDialog', { providerTag: 'ui-alert-dialog' });

let uid = 0;

const stateAttr = (open: boolean) => (open ? 'open' : 'closed');

// ── ui-alert-dialog (root, owns state) ───────────────────────────────

export type AlertDialogProps = {
  /** Controlled open state. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const AlertDialog = component<AlertDialogProps>('ui-alert-dialog', (props, host) => {
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

  const state: AlertDialogState = { open, setOpen, baseId: `ui-alert-dialog-${++uid}` };
  AlertDialogContext.provide(host, state);

  const className = props.className;
  const classes = computed(() => cn(className.value));

  return html`<div
    data-slot="alert-dialog"
    style="display:contents"
    class="${classes}"
  >${children()}</div>`;
}, {
  // PATTERN A: `open` is the attribute-as-truth state; `defaultOpen` seeds it.
  attrs: {
    open: 'boolean',
    defaultOpen: 'boolean',
    className: 'string',
  },
});

// ── ui-alert-dialog-trigger ──────────────────────────────────────────

export type AlertDialogTriggerProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const AlertDialogTrigger = component<AlertDialogTriggerProps>(
  'ui-alert-dialog-trigger',
  (props, host) => {
    const state = AlertDialogContext.inject();
    transparentHost(host);

    const className = props.className;
    const classes = computed(() => cn(className.value));

    return html`<button
      type="button"
      data-slot="alert-dialog-trigger"
      aria-haspopup="dialog"
      aria-controls="${`${state.baseId}-content`}"
      aria-expanded="${computed(() => (state.open.value ? 'true' : 'false'))}"
      data-state="${computed(() => stateAttr(state.open.value))}"
      class="${classes}"
      @click=${() => state.setOpen(true)}
    >${children()}</button>`;
  },
  { attrs: { className: 'string' } },
);

// ── ui-alert-dialog-content (overlay + panel) ────────────────────────

const overlayClasses =
  'fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0';

const contentClasses =
  'group/alert-dialog-content fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[size=sm]:max-w-xs data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[size=default]:sm:max-w-lg';

export type AlertDialogContentProps = {
  size?: 'default' | 'sm';
  /**
   * Move the overlay + content to `document.body` so `position: fixed` escapes
   * transformed ancestors. Defaults to true; pass false to render inline.
   */
  portal?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const AlertDialogContent = component<AlertDialogContentProps>(
  'ui-alert-dialog-content',
  (props, host) => {
    const state = AlertDialogContext.inject();
    transparentHost(host);

    const size = computed(() => props.size.value ?? 'default');
    const dataState = computed(() => stateAttr(state.open.value));
    const hidden = computed(() => !state.open.value);
    const contentId = `${state.baseId}-content`;

    const className = props.className;
    const classes = computed(() => cn(contentClasses, className.value));

    const portalRef = ref<HTMLDivElement>();
    const overlayRef = ref<HTMLDivElement>();
    const contentRef = ref<HTMLElement>();

    // Portal the overlay + content wrapper to <body> (default on) so fixed
    // positioning escapes transformed ancestors. Static setup-time decision
    // (PATTERN B): `portal` is a default-true boolean — absent → on, "false" →
    // off. Escape dismissal (document listener) and the focus trap (by ref)
    // keep working after the move.
    const portalEnabled = props.portal.value as boolean;
    portal(portalRef, { enabled: portalEnabled });

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

    return html`<div ref="${portalRef}" data-slot="alert-dialog-portal" style="display:contents">
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
      >${children()}</div>
    </div>`;
  },
  {
    // PATTERN B: `portal` is a default-true boolean (absent → true, "false" → false).
    attrs: {
      size: 'string',
      portal: { type: 'boolean', default: true },
      className: 'string',
    },
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
    const className = props.className;
    const classes = computed(() => cn(base, className.value));
    return html`<div data-slot="${slot}" class="${classes}">${children()}</div>`;
  }, { attrs: { className: 'string' } });
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
    const state = AlertDialogContext.inject();
    transparentHost(host);
    const className = props.className;
    const classes = computed(() =>
      cn(
        'text-lg font-semibold sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2',
        className.value,
      ),
    );
    return html`<h2
      data-slot="alert-dialog-title"
      id="${`${state.baseId}-title`}"
      class="${classes}"
    >${children()}</h2>`;
  },
  { attrs: { className: 'string' } },
);

export type AlertDialogDescriptionProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const AlertDialogDescription = component<AlertDialogDescriptionProps>(
  'ui-alert-dialog-description',
  (props, host) => {
    const state = AlertDialogContext.inject();
    transparentHost(host);
    const className = props.className;
    const classes = computed(() => cn('text-sm text-muted-foreground', className.value));
    return html`<p
      data-slot="alert-dialog-description"
      id="${`${state.baseId}-description`}"
      class="${classes}"
    >${children()}</p>`;
  },
  { attrs: { className: 'string' } },
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
    const state = AlertDialogContext.inject();
    transparentHost(host);

    const variant = props.variant;
    const size = props.size;
    const className = props.className;
    const classes = computed(() =>
      cn(
        buttonVariants({ variant: variant.value ?? 'default', size: size.value ?? 'default' }),
        className.value,
      ),
    );

    return html`<button
      type="button"
      data-slot="alert-dialog-action"
      class="${classes}"
      @click=${() => state.setOpen(false)}
    >${children()}</button>`;
  },
  { attrs: { variant: 'string', size: 'string', className: 'string' } },
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
    const state = AlertDialogContext.inject();
    transparentHost(host);

    const variant = props.variant;
    const size = props.size;
    const className = props.className;
    const classes = computed(() =>
      cn(
        buttonVariants({ variant: variant.value ?? 'outline', size: size.value ?? 'default' }),
        className.value,
      ),
    );

    return html`<button
      type="button"
      data-slot="alert-dialog-cancel"
      class="${classes}"
      @click=${() => state.setOpen(false)}
    >${children()}</button>`;
  },
  { attrs: { variant: 'string', size: 'string', className: 'string' } },
);
