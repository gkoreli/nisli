/**
 * ui/tabs.ts — Tabs.
 *
 * Ported from shadcn/ui `new-york-v4/ui/tabs.tsx` (MIT —
 * https://github.com/shadcn-ui/ui) and the
 * Radix Tabs behavior it wraps (MIT — https://github.com/radix-ui/primitives),
 * rebuilt as Nisli custom elements. WAI-ARIA Tabs pattern with automatic
 * activation (selection follows focus).
 *
 * Four elements compose a tabs widget:
 *   <ui-tabs value|default-value orientation>
 *     <ui-tabs-list>
 *       <ui-tabs-trigger value="a">…</ui-tabs-trigger>
 *     </ui-tabs-list>
 *     <ui-tabs-content value="a">…</ui-tabs-content>
 *   </ui-tabs>
 *
 * Usable via typed factories (`Tabs({...})`) or as plain custom elements.
 * The parent `<ui-tabs>` publishes its state via a subtree-scoped
 * `createContext` (`TabsContext.provide`); children resolve it with
 * `TabsContext.inject()` during setup and render an error fallback if used
 * outside a `<ui-tabs>`. The value is captured at setup, so it keeps resolving
 * the original provider even if the subtree is later reparented (portal-safe).
 *
 * State changes dispatch a bubbling `ui-value-change` CustomEvent
 * (`detail: { value }`) from the `<ui-tabs>` host — consumable anywhere via
 * `addEventListener`, no Nisli required.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  children,
  component,
  computed,
  createContext,
  effect,
  html,
  ref,
  type ReadonlySignal,
  type TemplateResult,
  type TypedEventHandler,
} from '@nisli/core';
import { cn, cv, isPinned, transparentHost } from '../lib/utils.js';
import { rovingFocus, type Orientation } from '../lib/roving-focus.js';

// ── Shared parent state (published on the <ui-tabs> host) ────────────

export interface TabsState {
  /** The selected tab value. */
  value: ReadonlySignal<string>;
  /** Select a value; dispatches `ui-value-change` when it actually changes. */
  setValue(value: string): void;
  /** Tab list axis; drives arrow-key navigation and `aria-orientation`. */
  orientation: ReadonlySignal<Orientation>;
  /** Stable id prefix for `aria-controls`/`aria-labelledby` wiring. */
  baseId: string;
}

/** Subtree-scoped channel from <ui-tabs> to its list/trigger/content parts. */
const TabsContext = createContext<TabsState>('Tabs', { providerTag: 'ui-tabs' });

let uid = 0;

// ── ui-tabs (root, owns state) ───────────────────────────────────────

export type TabsProps = {
  /** Controlled selected value. */
  value?: string;
  /** Initial value when uncontrolled. */
  defaultValue?: string;
  orientation?: Orientation;
  className?: string;
  children?: string | TemplateResult;
};

export const Tabs = component<TabsProps>('ui-tabs', (props, host) => {
  transparentHost(host);

  const orientation = computed<Orientation>(() =>
    props.orientation.value === 'vertical' ? 'vertical' : 'horizontal',
  );

  // VALUE-STATE (ADR 0025): the `value` ATTRIBUTE is the uncontrolled selection
  // (the string analog of native <details open>). The attribute IS the truth.
  const current = computed<string>(() => props.value.value ?? '');

  const setValue = (v: string): void => {
    if (v === current.value) return;
    // Uncontrolled → the attribute IS the state, so write it (empty = removed).
    // Controlled (a pinned factory `value` signal) → don't; the parent drives
    // and the reflect effect re-syncs the attr. isPinned('value') discriminates.
    if (!isPinned(host, 'value')) {
      if (v) host.setAttribute('value', v);
      else host.removeAttribute('value');
    }
    host.dispatchEvent(
      new CustomEvent('ui-value-change', { detail: { value: v }, bubbles: true }),
    );
  };

  // defaultValue is INIT-SEED-ONLY: seed the value attribute once, but only when
  // `value` is neither controlled (pinned — else the reflect effect would revert
  // it) nor explicitly authored. host.hasAttribute('value') is a SANCTIONED read
  // of a DECLARED attribute: it distinguishes 'absent' from 'present' so an
  // explicit value beats defaultValue.
  if (props.defaultValue.value && !isPinned(host, 'value') && !host.hasAttribute('value')) {
    host.setAttribute('value', props.defaultValue.value);
  }

  // Reflect the resolved value to the attribute so CONTROLLED (factory) usage
  // also reflects (CSS + parity); empty selection removes it; dedupe makes it cheap.
  effect(() => {
    const v = current.value;
    if (v) host.setAttribute('value', v);
    else host.removeAttribute('value');
  });

  const state: TabsState = {
    value: current,
    setValue,
    orientation,
    baseId: `ui-tabs-${++uid}`,
  };
  TabsContext.provide(host, state);

  const className = props.className;
  const classes = computed(() =>
    cn('group/tabs flex gap-2 data-[orientation=horizontal]:flex-col', className.value),
  );

  return html`<div
    data-slot="tabs"
    data-orientation="${orientation}"
    class="${classes}"
  >${children()}</div>`;
}, {
  // VALUE-STATE: `value` is the attribute-as-truth selection; `defaultValue` seeds it.
  attrs: {
    value: 'string',
    defaultValue: 'string',
    orientation: 'string',
    className: 'string',
  },
});

// ── ui-tabs-list ─────────────────────────────────────────────────────

export type TabsListVariant = 'default' | 'line';

export const tabsListVariants = cv(
  'group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none',
  {
    variants: {
      variant: {
        default: 'bg-muted',
        line: 'gap-1 bg-transparent',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export type TabsListProps = {
  variant?: TabsListVariant;
  className?: string;
  children?: string | TemplateResult;
};

export const TabsList = component<TabsListProps>('ui-tabs-list', (props, host) => {
  const state = TabsContext.inject();
  transparentHost(host);

  const variant = computed<TabsListVariant>(() =>
    props.variant.value === 'line' ? 'line' : 'default',
  );
  const className = props.className;
  const classes = computed(() =>
    cn(tabsListVariants({ variant: variant.value }), className.value),
  );

  const root = ref<HTMLDivElement>();

  // Roving focus over the trigger buttons; automatic activation selects
  // the focused tab (data-value carries each trigger's value).
  const roving = rovingFocus(
    () =>
      root.current
        ? Array.from(root.current.querySelectorAll<HTMLElement>('[role="tab"]'))
        : [],
    {
      orientation: state.orientation,
      loop: true,
      onActiveChange: (_index, item) => {
        const v = item.getAttribute('data-value');
        if (v != null) state.setValue(v);
      },
    },
  );

  const onKeydown: TypedEventHandler<'keydown'> = (event) => {
    roving.onKeydown(event);
  };

  return html`<div
    ref="${root}"
    role="tablist"
    data-slot="tabs-list"
    data-variant="${variant}"
    aria-orientation="${state.orientation}"
    data-orientation="${state.orientation}"
    class="${classes}"
    @keydown=${onKeydown}
  >${children()}</div>`;
}, { attrs: { variant: 'string', className: 'string' } });

// ── ui-tabs-trigger ──────────────────────────────────────────────────

const triggerClasses = cn(
  "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  'group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent',
  'data-[state=active]:bg-background data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground',
  'after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100',
);

export type TabsTriggerProps = {
  /** The value this trigger selects. Required. */
  value?: string;
  disabled?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const TabsTrigger = component<TabsTriggerProps>(
  'ui-tabs-trigger',
  (props, host) => {
    const state = TabsContext.inject();
    transparentHost(host);

    const own = computed(() => props.value.value ?? '');
    const disabled = computed<boolean>(() => props.disabled.value as boolean);
    const selected = computed(
      () => own.value !== '' && state.value.value === own.value,
    );
    const triggerId = computed(() => `${state.baseId}-trigger-${own.value}`);
    const contentId = computed(() => `${state.baseId}-content-${own.value}`);

    const className = props.className;
    const classes = computed(() => cn(triggerClasses, className.value));

    const select = (): void => {
      if (!disabled.value) state.setValue(own.value);
    };

    return html`<button
      type="button"
      role="tab"
      data-slot="tabs-trigger"
      id="${triggerId}"
      data-value="${own}"
      aria-controls="${contentId}"
      aria-selected="${computed(() => (selected.value ? 'true' : 'false'))}"
      data-state="${computed(() => (selected.value ? 'active' : 'inactive'))}"
      tabindex="${computed(() => (selected.value ? 0 : -1))}"
      disabled="${disabled}"
      class="${classes}"
      @click=${select}
    >${children()}</button>`;
  },
  { attrs: { value: 'string', disabled: 'boolean', className: 'string' } },
);

// ── ui-tabs-content ──────────────────────────────────────────────────

export type TabsContentProps = {
  /** The value this panel is shown for. Required. */
  value?: string;
  className?: string;
  children?: string | TemplateResult;
};

export const TabsContent = component<TabsContentProps>(
  'ui-tabs-content',
  (props, host) => {
    const state = TabsContext.inject();
    transparentHost(host);

    const own = computed(() => props.value.value ?? '');
    const selected = computed(
      () => own.value !== '' && state.value.value === own.value,
    );
    const triggerId = computed(() => `${state.baseId}-trigger-${own.value}`);
    const contentId = computed(() => `${state.baseId}-content-${own.value}`);

    const className = props.className;
    const classes = computed(() => cn('flex-1 outline-none', className.value));

    return html`<div
      role="tabpanel"
      data-slot="tabs-content"
      id="${contentId}"
      aria-labelledby="${triggerId}"
      data-state="${computed(() => (selected.value ? 'active' : 'inactive'))}"
      hidden="${computed(() => !selected.value)}"
      tabindex="0"
      class="${classes}"
    >${children()}</div>`;
  },
  { attrs: { value: 'string', className: 'string' } },
);
