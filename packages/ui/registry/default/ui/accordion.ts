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
 * Usable via typed factories or as plain custom elements. Two subtree-scoped
 * contexts: `<ui-accordion>` publishes its open-state via `AccordionContext`
 * and each `<ui-accordion-item>` publishes its value via `AccordionItemContext`;
 * triggers/content resolve both with `.inject()` and render the setup error
 * fallback when used outside an accordion. Open/close changes dispatch a
 * bubbling `ui-value-change` CustomEvent from the `<ui-accordion>` host.
 *
 * The trigger carries the shadcn chevron (a literal `<svg>` in the html
 * template, which the parser namespaces correctly); it rotates on open via the
 * `[&[data-state=open]>svg]:rotate-180` class hook.
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
  onMount,
  ref,
  signal,
  type ReadonlySignal,
  type TemplateResult,
} from '@nisli/core';
import { cn, isPinned, transparentHost } from '../lib/utils.js';
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

/** Root accordion state (open-set, type) shared with items/triggers/content. */
const AccordionContext = createContext<AccordionState>('Accordion', { providerTag: 'ui-accordion' });
/** Per-item value, published by each <ui-accordion-item> for its trigger/content. */
const AccordionItemContext = createContext<{ value: string }>('AccordionItem', { providerTag: 'ui-accordion-item' });

let uid = 0;

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

// VALUE-STATE: `value` is the attribute-as-truth selection; `defaultValue`
// seeds it. For type='multiple' the attribute is a comma-separated list. `value`/
// `defaultValue` type as `string | string[]` (dual-mode) while the attr is a
// 'string', so their casts are the documented residual (ADR 0025 candidate (b));
// `collapsible` narrows to `boolean` from its declaration.
const accordionAttrs = {
  type: 'string',
  collapsible: 'boolean',
  value: 'string',
  defaultValue: 'string',
  className: 'string',
} satisfies ComponentAttrs<AccordionProps>;

export const Accordion = component<AccordionProps, typeof accordionAttrs>('ui-accordion', (props, host) => {
  transparentHost(host);

  // VALUE-STATE (ADR 0025 item 3): the `value` ATTRIBUTE is the uncontrolled
  // selection state; `defaultValue` seeds it once. The `type` is fixed at setup,
  // so the state shape branches on it: single uses the string shape, multiple
  // the comma-separated array shape. The consumer contract (`openValues` set +
  // `toggle`) is unchanged.
  const isMultiple = props.type.value === 'multiple';
  const collapsible = computed<boolean>(() => props.collapsible.value);

  let openValues: ReadonlySignal<ReadonlySet<string>>;
  let toggle: (value: string) => void;

  if (isMultiple) {
    // Encoding limit: comma-separated attribute — values containing commas are unsupported (upstream values are slugs).
    const normalize = (v: unknown): string[] =>
      Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(',') : [];
    const current = computed<string[]>(() => normalize(props.value.value));
    const setValue = (next: string[]): void => {
      if (next.join(',') === current.value.join(',')) return;
      if (!isPinned(host, 'value')) {
        if (next.length) host.setAttribute('value', next.join(','));
        else host.removeAttribute('value');
      }
      host.dispatchEvent(
        new CustomEvent('ui-value-change', { detail: { value: next }, bubbles: true }),
      );
    };
    // defaultValue INIT-SEED-ONLY, double-guarded. host.hasAttribute('value') is a
    // SANCTIONED read of a DECLARED attribute (absent vs present).
    if (props.defaultValue.value != null && !isPinned(host, 'value') && !host.hasAttribute('value')) {
      const seed = normalize(props.defaultValue.value);
      if (seed.length) host.setAttribute('value', seed.join(','));
    }
    effect(() => {
      const v = current.value;
      if (v.length) host.setAttribute('value', v.join(','));
      else host.removeAttribute('value');
    });

    openValues = computed<ReadonlySet<string>>(() => new Set(current.value));
    toggle = (value: string): void => {
      const cur = current.value;
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      setValue(next);
    };
  } else {
    const current = computed<string>(() => (props.value.value as string | undefined) ?? '');
    const setValue = (v: string): void => {
      if (v === current.value) return;
      if (!isPinned(host, 'value')) {
        if (v) host.setAttribute('value', v);
        else host.removeAttribute('value');
      }
      host.dispatchEvent(
        new CustomEvent('ui-value-change', { detail: { value: v }, bubbles: true }),
      );
    };
    // defaultValue INIT-SEED-ONLY, double-guarded. host.hasAttribute('value') is a
    // SANCTIONED read of a DECLARED attribute (absent vs present).
    if (props.defaultValue.value && !isPinned(host, 'value') && !host.hasAttribute('value')) {
      host.setAttribute('value', props.defaultValue.value as string);
    }
    effect(() => {
      const v = current.value;
      if (v) host.setAttribute('value', v);
      else host.removeAttribute('value');
    });

    openValues = computed<ReadonlySet<string>>(() =>
      current.value ? new Set([current.value]) : new Set<string>(),
    );
    toggle = (value: string): void => {
      if (current.value === value) {
        if (collapsible.value) setValue('');
      } else setValue(value);
    };
  }

  const state: AccordionState = {
    openValues,
    toggle,
    baseId: `ui-accordion-${++uid}`,
  };
  AccordionContext.provide(host, state);

  const className = props.className;
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

  return html`<div
    ref="${root}"
    data-slot="accordion"
    data-orientation="vertical"
    class="${classes}"
    @keydown=${(e: KeyboardEvent) => roving.onKeydown(e)}
  >${children()}</div>`;
}, { attrs: accordionAttrs });

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
    const state = AccordionContext.inject();
    transparentHost(host);

    const value = props.value.value ?? '';
    AccordionItemContext.provide(host, { value });

    const open = computed(() => value !== '' && state.openValues.value.has(value));

    const className = props.className;
    const classes = computed(() => cn('border-b last:border-b-0', className.value));

    return html`<div
      data-slot="accordion-item"
      data-state="${computed(() => (open.value ? 'open' : 'closed'))}"
      class="${classes}"
    >${children()}</div>`;
  },
  { attrs: { value: 'string', className: 'string' } },
);

// ── ui-accordion-trigger ─────────────────────────────────────────────

const triggerClasses =
  'flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180';

export type AccordionTriggerProps = {
  disabled?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

const accordionTriggerAttrs = {
  disabled: 'boolean',
  className: 'string',
} satisfies ComponentAttrs<AccordionTriggerProps>;

export const AccordionTrigger = component<AccordionTriggerProps, typeof accordionTriggerAttrs>(
  'ui-accordion-trigger',
  (props, host) => {
    const state = AccordionContext.inject();
    const value = AccordionItemContext.inject().value;
    transparentHost(host);

    const disabled = computed<boolean>(() => props.disabled.value);
    const open = computed(() => state.openValues.value.has(value));
    const triggerId = `${state.baseId}-trigger-${value}`;
    const contentId = `${state.baseId}-content-${value}`;

    const className = props.className;
    const classes = computed(() => cn(triggerClasses, className.value));

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
      ><span>${children()}</span><svg
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
  { attrs: accordionTriggerAttrs },
);

// ── ui-accordion-content ─────────────────────────────────────────────

export type AccordionContentProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const AccordionContent = component<AccordionContentProps>(
  'ui-accordion-content',
  (props, host) => {
    const state = AccordionContext.inject();
    const value = AccordionItemContext.inject().value;
    transparentHost(host);

    const open = computed(() => state.openValues.value.has(value));
    const triggerId = `${state.baseId}-trigger-${value}`;
    const contentId = `${state.baseId}-content-${value}`;

    const className = props.className;
    const innerClasses = computed(() => cn('pt-0 pb-4', className.value));

    const outer = ref<HTMLDivElement>();
    const inner = ref<HTMLDivElement>();

    // `present` decouples the `hidden` attribute from `open` so the
    // accordion-up (close) animation can play before the region is removed
    // from the a11y tree; the accordion-down (open) animation plays as soon as
    // the region is shown.
    const present = signal<boolean>(open.value);

    // JS-MEASURE + CSS-ANIMATE (theme.css keyframes animate height 0 ↔
    // var(--accordion-content-height)). We only measure and set the var; the
    // browser runs the animation. Measuring uses the inner content's
    // scrollHeight, which is unaffected by the outer element's animated height.
    const measure = (): void => {
      const el = outer.current;
      const content = inner.current;
      if (el && content) {
        el.style.setProperty('--accordion-content-height', `${content.scrollHeight}px`);
      }
    };

    effect(() => {
      const isOpen = open.value;
      const el = outer.current;
      if (!el) return;
      if (isOpen) {
        present.value = true;
        // Measure once the region is displayed (the `hidden` binding has run).
        queueMicrotask(measure);
      } else if (present.value) {
        // Freeze the current height so accordion-up animates from it. Arm the
        // closed state now, then either wait for the up animation to end before
        // hiding (real browser) or hide synchronously when none runs (reduced
        // motion / no compiled CSS / happy-dom) — keeping `hidden` in step with
        // the flush so a11y stays correct without a JS-driven animation.
        measure();
        el.setAttribute('data-state', 'closed');
        const name = el.ownerDocument.defaultView?.getComputedStyle(el).animationName;
        if (name && name !== 'none') {
          const onEnd = (): void => {
            el.removeEventListener('animationend', onEnd);
            if (!open.value) present.value = false;
          };
          el.addEventListener('animationend', onEnd);
        } else {
          present.value = false;
        }
      }
    });

    onMount(() => {
      // Initially-open items never see `open` change, so measure here too.
      if (open.value) queueMicrotask(measure);
    });

    return html`<div
      ref="${outer}"
      data-slot="accordion-content"
      role="region"
      id="${contentId}"
      aria-labelledby="${triggerId}"
      data-state="${computed(() => (open.value ? 'open' : 'closed'))}"
      hidden="${computed(() => !present.value)}"
      class="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    ><div ref="${inner}" class="${innerClasses}">${children()}</div></div>`;
  },
  { attrs: { className: 'string' } },
);
