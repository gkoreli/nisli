/**
 * ui/collapsible.ts — Collapsible.
 *
 * Ported from shadcn/ui `new-york-v4/ui/collapsible.tsx` (MIT —
 * https://github.com/shadcn-ui/ui) and the Radix Collapsible behavior it wraps
 * (MIT — https://github.com/radix-ui/primitives), rebuilt as Nisli custom
 * elements. A single trigger that toggles one region — accordion machinery
 * without the multi-item list.
 *
 * Three elements:
 *   <ui-collapsible>
 *     <ui-collapsible-trigger>Toggle</ui-collapsible-trigger>
 *     <ui-collapsible-content>…</ui-collapsible-content>
 *   </ui-collapsible>
 *
 * Upstream carries no classes (bare data-slot hooks); style via className or
 * the data-slot/data-state selectors. Open state follows PATTERN A (ADR 0025
 * item 3): the `open` ATTRIBUTE is the uncontrolled state (like native
 * <details open>), `defaultOpen` seeds it once, and a controlled factory `open`
 * signal pins the prop. Open/close dispatches a bubbling `ui-open-change`
 * CustomEvent from the `<ui-collapsible>` host.
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
  type ReadonlySignal,
  type TemplateResult,
} from '@nisli/core';
import { cn, isPinned, transparentHost } from '../lib/utils.js';

// ── Shared state (published on the <ui-collapsible> host) ────────────

export interface CollapsibleState {
  open: ReadonlySignal<boolean>;
  setOpen(open: boolean): void;
  disabled: ReadonlySignal<boolean>;
  baseId: string;
}

/** Subtree-scoped channel from the Collapsible provider to its parts. */
const CollapsibleContext = createContext<CollapsibleState>('Collapsible', { providerTag: 'ui-collapsible' });

let uid = 0;

const stateAttr = (open: boolean) => (open ? 'open' : 'closed');

// ── ui-collapsible (root, owns state) ────────────────────────────────

export type CollapsibleProps = {
  /** Controlled open state. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  disabled?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const Collapsible = component<CollapsibleProps>('ui-collapsible', (props, host) => {
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

  const disabled = computed<boolean>(() => props.disabled.value as boolean);

  const state: CollapsibleState = {
    open,
    setOpen,
    disabled,
    baseId: `ui-collapsible-${++uid}`,
  };
  CollapsibleContext.provide(host, state);

  const className = props.className;
  const classes = computed(() => cn(className.value));

  return html`<div
    data-slot="collapsible"
    data-state="${computed(() => stateAttr(open.value))}"
    data-disabled="${computed(() => (disabled.value ? '' : undefined))}"
    class="${classes}"
  >${children()}</div>`;
}, {
  // PATTERN A: `open` is the attribute-as-truth state; `defaultOpen` seeds it.
  attrs: {
    open: 'boolean',
    defaultOpen: 'boolean',
    disabled: 'boolean',
    className: 'string',
  },
});

// ── ui-collapsible-trigger ───────────────────────────────────────────

export type CollapsibleTriggerProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const CollapsibleTrigger = component<CollapsibleTriggerProps>(
  'ui-collapsible-trigger',
  (props, host) => {
    const state = CollapsibleContext.inject();
    transparentHost(host);

    const className = props.className;
    const classes = computed(() => cn(className.value));

    const onToggle = (): void => {
      if (!state.disabled.value) state.setOpen(!state.open.value);
    };

    return html`<button
      type="button"
      data-slot="collapsible-trigger"
      aria-controls="${`${state.baseId}-content`}"
      aria-expanded="${computed(() => (state.open.value ? 'true' : 'false'))}"
      data-state="${computed(() => stateAttr(state.open.value))}"
      data-disabled="${computed(() => (state.disabled.value ? '' : undefined))}"
      disabled="${state.disabled}"
      class="${classes}"
      @click=${onToggle}
    >${children()}</button>`;
  },
  { attrs: { className: 'string' } },
);

// ── ui-collapsible-content ───────────────────────────────────────────

export type CollapsibleContentProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const CollapsibleContent = component<CollapsibleContentProps>(
  'ui-collapsible-content',
  (props, host) => {
    const state = CollapsibleContext.inject();
    transparentHost(host);

    const className = props.className;
    const classes = computed(() => cn(className.value));

    return html`<div
      data-slot="collapsible-content"
      id="${`${state.baseId}-content`}"
      data-state="${computed(() => stateAttr(state.open.value))}"
      hidden="${computed(() => !state.open.value)}"
      class="${classes}"
    >${children()}</div>`;
  },
  { attrs: { className: 'string' } },
);
