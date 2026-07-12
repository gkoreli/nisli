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
 * the data-slot/data-state selectors. Open state is signal-driven (controlled
 * `open` prop, derived; default-open / attribute fallback) and dispatches a
 * bubbling `ui-open-change` CustomEvent from the `<ui-collapsible>` host.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  component,
  createContext,
  computed,
  html,
  onMount,
  ref,
  signal,
  type ReadonlySignal,
  type TemplateResult,
} from '@nisli/core';
import {
  attr,
  boolAttr,
  captureChildren,
  cn,
  projectChildren,
  transparentHost,
} from '../lib/utils.js';

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
  const projected = captureChildren(host);

  const initialOpen =
    props.defaultOpen.value ??
    props.open.value ??
    (host.hasAttribute('open') || host.hasAttribute('default-open'));
  const internal = signal<boolean>(Boolean(initialOpen));
  const open = computed<boolean>(() => props.open.value ?? internal.value);
  const disabled = boolAttr(props.disabled, host, 'disabled');

  const setOpen = (next: boolean): void => {
    if (next === open.value) return;
    internal.value = next;
    host.dispatchEvent(
      new CustomEvent('ui-open-change', { detail: { open: next }, bubbles: true }),
    );
  };

  const state: CollapsibleState = {
    open,
    setOpen,
    disabled,
    baseId: `ui-collapsible-${++uid}`,
  };
  CollapsibleContext.provide(host, state);

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn(className.value));

  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<div
    ref="${root}"
    data-slot="collapsible"
    data-state="${computed(() => stateAttr(open.value))}"
    data-disabled="${computed(() => (disabled.value ? '' : undefined))}"
    class="${classes}"
  >${props.children}</div>`;
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
    const projected = captureChildren(host);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(className.value));

    const root = ref<HTMLButtonElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    const onToggle = (): void => {
      if (!state.disabled.value) state.setOpen(!state.open.value);
    };

    return html`<button
      ref="${root}"
      type="button"
      data-slot="collapsible-trigger"
      aria-controls="${`${state.baseId}-content`}"
      aria-expanded="${computed(() => (state.open.value ? 'true' : 'false'))}"
      data-state="${computed(() => stateAttr(state.open.value))}"
      data-disabled="${computed(() => (state.disabled.value ? '' : undefined))}"
      disabled="${state.disabled}"
      class="${classes}"
      @click=${onToggle}
    >${props.children}</button>`;
  },
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
    const projected = captureChildren(host);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(className.value));

    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<div
      ref="${root}"
      data-slot="collapsible-content"
      id="${`${state.baseId}-content`}"
      data-state="${computed(() => stateAttr(state.open.value))}"
      hidden="${computed(() => !state.open.value)}"
      class="${classes}"
    >${props.children}</div>`;
  },
);
