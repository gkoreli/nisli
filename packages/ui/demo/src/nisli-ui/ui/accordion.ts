/**
 * ui/accordion.ts — Accordion.
 *
 * Ported from shadcn/ui `new-york-v4/ui/accordion.tsx`, (MIT — https://github.com/shadcn-ui/ui) and
 * the Radix Accordion behavior it wraps (MIT — https://github.com/radix-ui/primitives),
 * rebuilt as Nisli custom elements following the WAI-ARIA Accordion pattern.
 *
 * Four elements compose an accordion:
 *   <ui-accordion type="single" collapsible>
 *     <ui-accordion-item value="a">
 *       <ui-accordion-trigger>Section A</ui-accordion-trigger>
 *       <ui-accordion-content>…</ui-accordion-content>
 *     </ui-accordion-item>
 *   </ui-accordion>
 *
 * Usable via typed factories or as plain custom elements. The parent
 * `<ui-accordion>` publishes its open-state on `host.__uiAccordion`; each
 * `<ui-accordion-item>` publishes its value on `host.__uiAccordionItem`.
 * Triggers/content locate both via `host.closest(...)` and render the setup
 * error fallback when used outside an accordion. Open/close changes dispatch a
 * bubbling `ui-value-change` CustomEvent from the `<ui-accordion>` host.
 *
 * The trigger carries the shadcn chevron (a literal `<svg>` in the html
 * template, which the parser namespaces correctly); it rotates on open via the
 * `[&[data-state=open]>svg]:rotate-180` class hook.
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
import { rovingFocus } from '../lib/roving-focus.js';

// ── Shared state (published on the <ui-accordion> host) ──────────────

export type AccordionType = 'single' | 'multiple';

export interface AccordionState {
  /** The set of currently open item values. */
  openValues: ReadonlySignal<ReadonlySet<string>>;
  /** Toggle an item's open state, honoring `type`/`collapsible`. */
  toggle(value: string): void;
  /** Stable id prefix for `aria-controls`/`aria-labelledby` wiring. */
  baseId: string;
}

type AccordionHost = HTMLElement & { __uiAccordion?: AccordionState };
type AccordionItemHost = HTMLElement & { __uiAccordionItem?: { value: string } };

let uid = 0;

function useAccordionState(host: HTMLElement, tag: string): AccordionState {
  const parent = host.closest('ui-accordion') as AccordionHost | null;
  const state = parent?.__uiAccordion;
  if (!state) {
    throw new Error(`<${tag}> must be used inside <ui-accordion>.`);
  }
  return state;
}

function useItemValue(host: HTMLElement, tag: string): string {
  const item = host.closest('ui-accordion-item') as AccordionItemHost | null;
  const value = item?.__uiAccordionItem?.value;
  if (value == null) {
    throw new Error(`<${tag}> must be used inside <ui-accordion-item>.`);
  }
  return value;
}

/** Normalize a controlled value (string | string[]) into a Set. */
function toSet(value: string | string[] | undefined): Set<string> {
  if (value == null || value === '') return new Set();
  return new Set(Array.isArray(value) ? value : [value]);
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// ── ui-accordion (root, owns state) ──────────────────────────────────

export type AccordionProps = {
  /** `'single'` opens one item at a time; `'multiple'` opens many. */
  type?: AccordionType;
  /** In `single` mode, allow closing the open item. */
  collapsible?: boolean;
  /** Controlled open value(s). */
  value?: string | string[];
  /** Initial open value(s) when uncontrolled. */
  defaultValue?: string | string[];
  className?: string;
  children?: string | TemplateResult;
};

export const Accordion = component<AccordionProps>('ui-accordion', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);

  const typeAttr = attr(props.type, host, 'type');
  const type = computed<AccordionType>(() =>
    typeAttr.value === 'multiple' ? 'multiple' : 'single',
  );
  const collapsible = boolAttr(props.collapsible, host, 'collapsible');

  const defaultAttr = attr(props.defaultValue as ReadonlySignal<string | undefined>, host, 'default-value');
  const internal = signal<ReadonlySet<string>>(
    toSet(props.defaultValue.value ?? defaultAttr.value ?? props.value.value),
  );
  const current = computed<ReadonlySet<string>>(() => {
    const controlled = props.value.value;
    return controlled != null ? toSet(controlled) : internal.value;
  });

  const emit = (next: ReadonlySet<string>): void => {
    const list = [...next];
    host.dispatchEvent(
      new CustomEvent('ui-value-change', {
        detail: { value: type.value === 'multiple' ? list : (list[0] ?? '') },
        bubbles: true,
      }),
    );
  };

  const toggle = (value: string): void => {
    const cur = current.value;
    const isOpen = cur.has(value);
    let next: Set<string>;
    if (type.value === 'multiple') {
      next = new Set(cur);
      if (isOpen) next.delete(value);
      else next.add(value);
    } else {
      // single
      if (isOpen) next = collapsible.value ? new Set() : new Set(cur);
      else next = new Set([value]);
    }
    if (sameSet(next, cur)) return;
    internal.value = next;
    emit(next);
  };

  const state: AccordionState = {
    openValues: current,
    toggle,
    baseId: `ui-accordion-${++uid}`,
  };
  (host as AccordionHost).__uiAccordion = state;

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn(className.value));

  const root = ref<HTMLDivElement>();

  // Arrow-key roving among the trigger headers (vertical, no wrap — WAI-ARIA
  // Accordion). Triggers stay in the tab order; this only moves focus.
  const roving = rovingFocus(
    () =>
      root.current
        ? Array.from(
            root.current.querySelectorAll<HTMLElement>('[data-slot="accordion-trigger"]'),
          )
        : [],
    { orientation: 'vertical', loop: false },
  );

  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<div
    ref="${root}"
    data-slot="accordion"
    class="${classes}"
    @keydown=${(e: KeyboardEvent) => roving.onKeydown(e)}
  >${props.children}</div>`;
});

// ── ui-accordion-item ────────────────────────────────────────────────

export type AccordionItemProps = {
  /** The item's value; identifies it in the accordion's open set. Required. */
  value?: string;
  className?: string;
  children?: string | TemplateResult;
};

export const AccordionItem = component<AccordionItemProps>(
  'ui-accordion-item',
  (props, host) => {
    const state = useAccordionState(host, 'ui-accordion-item');
    transparentHost(host);
    const projected = captureChildren(host);

    const valueAttr = attr(props.value, host, 'value');
    const value = valueAttr.value ?? '';
    (host as AccordionItemHost).__uiAccordionItem = { value };

    const open = computed(() => value !== '' && state.openValues.value.has(value));

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn('border-b last:border-b-0', className.value));

    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<div
      ref="${root}"
      data-slot="accordion-item"
      data-state="${computed(() => (open.value ? 'open' : 'closed'))}"
      class="${classes}"
    >${props.children}</div>`;
  },
);

// ── ui-accordion-trigger ─────────────────────────────────────────────

const triggerClasses =
  'flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180';

export type AccordionTriggerProps = {
  disabled?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const AccordionTrigger = component<AccordionTriggerProps>(
  'ui-accordion-trigger',
  (props, host) => {
    const state = useAccordionState(host, 'ui-accordion-trigger');
    const value = useItemValue(host, 'ui-accordion-trigger');
    transparentHost(host);
    const projected = captureChildren(host);

    const disabled = boolAttr(props.disabled, host, 'disabled');
    const open = computed(() => state.openValues.value.has(value));
    const triggerId = `${state.baseId}-trigger-${value}`;
    const contentId = `${state.baseId}-content-${value}`;

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(triggerClasses, className.value));

    const label = ref<HTMLSpanElement>();
    onMount(() => {
      if (label.current) projectChildren(host, label.current, projected);
    });

    const onToggle = (): void => {
      if (!disabled.value) state.toggle(value);
    };

    return html`<h3 data-slot="accordion-header" class="flex">
      <button
        type="button"
        data-slot="accordion-trigger"
        id="${triggerId}"
        aria-controls="${contentId}"
        aria-expanded="${computed(() => (open.value ? 'true' : 'false'))}"
        data-state="${computed(() => (open.value ? 'open' : 'closed'))}"
        disabled="${disabled}"
        class="${classes}"
        @click=${onToggle}
      ><span ref="${label}">${props.children}</span><svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200"
        ><path d="m6 9 6 6 6-6"></path></svg></button>
    </h3>`;
  },
);

// ── ui-accordion-content ─────────────────────────────────────────────

export type AccordionContentProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const AccordionContent = component<AccordionContentProps>(
  'ui-accordion-content',
  (props, host) => {
    const state = useAccordionState(host, 'ui-accordion-content');
    const value = useItemValue(host, 'ui-accordion-content');
    transparentHost(host);
    const projected = captureChildren(host);

    const open = computed(() => state.openValues.value.has(value));
    const triggerId = `${state.baseId}-trigger-${value}`;
    const contentId = `${state.baseId}-content-${value}`;

    const className = attr(props.className, host, 'class-name');
    // shadcn's animate-accordion-up/down keyframes are omitted (they require
    // consumer @theme keyframes); visibility is via `hidden` for correctness.
    const innerClasses = computed(() => cn('pt-0 pb-4', className.value));

    const inner = ref<HTMLDivElement>();
    onMount(() => {
      if (inner.current) projectChildren(host, inner.current, projected);
    });

    return html`<div
      data-slot="accordion-content"
      role="region"
      id="${contentId}"
      aria-labelledby="${triggerId}"
      data-state="${computed(() => (open.value ? 'open' : 'closed'))}"
      hidden="${computed(() => !open.value)}"
      class="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    ><div ref="${inner}" class="${innerClasses}">${props.children}</div></div>`;
  },
);
