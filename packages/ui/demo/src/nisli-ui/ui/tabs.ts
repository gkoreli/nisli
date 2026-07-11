/**
 * ui/tabs.ts — Tabs.
 *
 * Port of shadcn/ui `tabs` (MIT — https://github.com/shadcn-ui/ui) and the
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
 * The parent `<ui-tabs>` exposes its state on `host.__uiTabs`; children
 * locate it with `host.closest('ui-tabs')` and render an error fallback if
 * used outside a `<ui-tabs>`.
 *
 * State changes dispatch a bubbling `ui-value-change` CustomEvent
 * (`detail: { value }`) from the `<ui-tabs>` host — consumable anywhere via
 * `addEventListener`, no Nisli required.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  component,
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

type TabsHost = HTMLElement & { __uiTabs?: TabsState };

let uid = 0;

/** Locate the owning `<ui-tabs>` state, or throw (setup error boundary). */
function useTabsState(host: HTMLElement, tag: string): TabsState {
  const parent = host.closest('ui-tabs') as TabsHost | null;
  const state = parent?.__uiTabs;
  if (!state) {
    throw new Error(`<${tag}> must be used inside <ui-tabs>.`);
  }
  return state;
}

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
  const projected = captureChildren(host);

  const valueAttr = attr(props.value, host, 'value');
  const defaultAttr = attr(props.defaultValue, host, 'default-value');
  const orientationRaw = attr(props.orientation, host, 'orientation');
  const orientation = computed<Orientation>(() =>
    orientationRaw.value === 'vertical' ? 'vertical' : 'horizontal',
  );

  // Uncontrolled state, seeded from default-value (or a parse-time value attr).
  const internal = signal<string>(defaultAttr.value ?? valueAttr.value ?? '');
  // A controlled `value` prop always wins and stays reactively in sync; when
  // absent, the selection is our own internal state. Deriving (not mirroring
  // via an effect) keeps controlled updates a single reactive hop.
  const current = computed<string>(() => props.value.value ?? internal.value);

  const setValue = (v: string): void => {
    if (v === current.value) return;
    internal.value = v;
    host.dispatchEvent(
      new CustomEvent('ui-value-change', { detail: { value: v }, bubbles: true }),
    );
  };

  const state: TabsState = {
    value: current,
    setValue,
    orientation,
    baseId: `ui-tabs-${++uid}`,
  };
  (host as TabsHost).__uiTabs = state;

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn('flex flex-col gap-2', className.value));

  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<div
    ref="${root}"
    data-slot="tabs"
    data-orientation="${orientation}"
    class="${classes}"
  >${props.children}</div>`;
});

// ── ui-tabs-list ─────────────────────────────────────────────────────

export type TabsListProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const TabsList = component<TabsListProps>('ui-tabs-list', (props, host) => {
  const state = useTabsState(host, 'ui-tabs-list');
  transparentHost(host);
  const projected = captureChildren(host);

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() =>
    cn(
      'bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]',
      className.value,
    ),
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

  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<div
    ref="${root}"
    role="tablist"
    data-slot="tabs-list"
    aria-orientation="${state.orientation}"
    data-orientation="${state.orientation}"
    class="${classes}"
    @keydown=${(e: KeyboardEvent) => roving.onKeydown(e)}
  >${props.children}</div>`;
});

// ── ui-tabs-trigger ──────────────────────────────────────────────────

const triggerClasses =
  "inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:shadow-sm dark:text-muted-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

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
    const state = useTabsState(host, 'ui-tabs-trigger');
    transparentHost(host);
    const projected = captureChildren(host);

    const valueAttr = attr(props.value, host, 'value');
    const own = computed(() => valueAttr.value ?? '');
    const disabled = boolAttr(props.disabled, host, 'disabled');
    const selected = computed(
      () => own.value !== '' && state.value.value === own.value,
    );
    const triggerId = computed(() => `${state.baseId}-trigger-${own.value}`);
    const contentId = computed(() => `${state.baseId}-content-${own.value}`);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(triggerClasses, className.value));

    const root = ref<HTMLButtonElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    const select = (): void => {
      if (!disabled.value) state.setValue(own.value);
    };

    return html`<button
      ref="${root}"
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
    >${props.children}</button>`;
  },
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
    const state = useTabsState(host, 'ui-tabs-content');
    transparentHost(host);
    const projected = captureChildren(host);

    const valueAttr = attr(props.value, host, 'value');
    const own = computed(() => valueAttr.value ?? '');
    const selected = computed(
      () => own.value !== '' && state.value.value === own.value,
    );
    const triggerId = computed(() => `${state.baseId}-trigger-${own.value}`);
    const contentId = computed(() => `${state.baseId}-content-${own.value}`);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn('flex-1 outline-none', className.value));

    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<div
      ref="${root}"
      role="tabpanel"
      data-slot="tabs-content"
      id="${contentId}"
      aria-labelledby="${triggerId}"
      data-state="${computed(() => (selected.value ? 'active' : 'inactive'))}"
      hidden="${computed(() => !selected.value)}"
      tabindex="0"
      class="${classes}"
    >${props.children}</div>`;
  },
);
