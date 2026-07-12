/**
 * ui/combobox.ts — Combobox.
 *
 * Cited source: new-york-v4/ui/combobox.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui).
 *
 * DEVIATION (documented, per ADR 0022's canonical-reference rule — same class
 * as toast.ts/command.ts): upstream's v4 combobox delegates to
 * `@base-ui/react`'s Combobox primitive (Positioner/Popup/Chips/Collection/…),
 * a library we do not vendor. We instead build the CLASSIC shadcn combobox —
 * the documented Popover + Command composition — reusing our landed ui-popover
 * and ui-command, and pull the extractable v4 class strings (content/item/
 * indicator) so the visuals stay canonical while the behavior follows our
 * conventions. The CHIPS UI (multi-value pills) is deferred in v1; multiple
 * selection shows a count in the trigger.
 *
 * ```
 * Combobox({
 *   placeholder: 'Select framework…',
 *   children: html`
 *     ${ComboboxItem({ value: 'next', children: 'Next.js' })}
 *     ${ComboboxItem({ value: 'svelte', children: 'SvelteKit' })}`,
 * })
 * ```
 *
 * The trigger is `role="combobox"` with `aria-expanded`; the popup hosts a
 * ui-command (input `role="combobox"`, list `role="listbox"`, items
 * `role="option"`) which already provides type-to-filter, arrow highlight, and
 * Enter-to-select. Popup width matches the trigger via a measured
 * `--cb-anchor-width` custom property (local; lib/floating untouched).
 * Selection changes dispatch a bubbling `ui-value-change` CustomEvent from the
 * `<ui-combobox>` host.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  component,
  createContext,
  computed,
  effect,
  html,
  onMount,
  signal,
  useHostEvent,
  type ReadonlySignal,
  type TemplateResult,
} from '@nisli/core';
import {
  cn,
  isPinned,
  transparentHost,
} from '../lib/utils.js';
import { buttonVariants } from './button.js';
import { Popover, PopoverTrigger, PopoverContent } from './popover.js';
import { Command, CommandInput, CommandList, CommandEmpty } from './command.js';

// ── Shared state (published on the <ui-combobox> host) ───────────────

export interface ComboboxState {
  multiple: boolean;
  isSelected(value: string): boolean;
  select(value: string): void;
  baseId: string;
}

/** Subtree-scoped channel from <ui-combobox> to its parts. */
const ComboboxContext = createContext<ComboboxState>('Combobox', { providerTag: 'ui-combobox' });

let uid = 0;

// ── ui-combobox (root: owns selection + open, composes popover+command) ─

const chevron = (): TemplateResult => html`<svg
  class="ml-2 size-4 shrink-0 opacity-50"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
><path d="m7 15 5 5 5-5"></path><path d="m7 9 5-5 5 5"></path></svg>`;

export type ComboboxProps = {
  /** Controlled value: a single value, or comma-separated for multiple. */
  value?: string;
  defaultValue?: string;
  multiple?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  /** The ComboboxItem options (optionally in ui-command-groups). */
  children?: string | TemplateResult;
};

export const Combobox = component<ComboboxProps>('ui-combobox', (props, host) => {
  transparentHost(host);

  // `multiple` is a declared 'boolean' attr (runtime-guaranteed non-undefined),
  // read ONCE at setup — it selects the value-state shape (string vs array).
  const multiple = props.multiple.value as boolean;

  const open = signal<boolean>(false);
  const labelText = signal<string>('');

  // VALUE-STATE (ADR 0025 item 3): the `value` ATTRIBUTE is the uncontrolled
  // selection. `defaultValue` seeds it once; a pinned factory `value` is the
  // controlled discriminator (isPinned). Single mode uses the string shape,
  // multiple the array shape. `selectedArray` is the read-side both parts share
  // (isSelected + label); `select` toggles/sets through `setValue`.
  let selectedArray: ReadonlySignal<string[]>;
  let select: (value: string) => void;

  if (multiple) {
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
    // defaultValue INIT-SEED-ONLY, double-guarded. host.hasAttribute('value') is
    // a SANCTIONED read of a DECLARED attribute (absent vs present).
    if (props.defaultValue.value != null && !isPinned(host, 'value') && !host.hasAttribute('value')) {
      const seed = normalize(props.defaultValue.value);
      if (seed.length) host.setAttribute('value', seed.join(','));
    }
    effect(() => {
      const v = current.value;
      if (v.length) host.setAttribute('value', v.join(','));
      else host.removeAttribute('value');
    });
    selectedArray = current;
    select = (value) => {
      const set = new Set(current.value);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      setValue([...set]);
    };
  } else {
    const current = computed<string>(() => props.value.value ?? '');
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
    // defaultValue INIT-SEED-ONLY (see multiple branch); hasAttribute('value')
    // is the SANCTIONED declared-attribute read.
    if (props.defaultValue.value && !isPinned(host, 'value') && !host.hasAttribute('value')) {
      host.setAttribute('value', props.defaultValue.value);
    }
    effect(() => {
      const v = current.value;
      if (v) host.setAttribute('value', v);
      else host.removeAttribute('value');
    });
    selectedArray = computed<string[]>(() => (current.value ? [current.value] : []));
    select = (value) => {
      setValue(value);
      open.value = false; // single-select closes the popup
    };
  }

  const items = (): HTMLElement[] =>
    Array.from(host.querySelectorAll<HTMLElement>('[data-slot="command-item"]'));
  const labelFor = (value: string): string => {
    const el = items().find((e) => e.getAttribute('data-value') === value);
    return el ? (el.textContent ?? '').trim() : value;
  };
  const updateLabel = (): void => {
    const sel = selectedArray.value;
    if (sel.length === 0) labelText.value = '';
    else if (multiple) labelText.value = `${sel.length} selected`;
    else labelText.value = labelFor(sel[0]!);
  };
  // Re-derive the trigger label whenever the resolved selection changes (incl.
  // external/plain-HTML value writes). Item labels settle a microtask after
  // mount, so onMount re-runs it once the projected options exist.
  effect(() => {
    selectedArray.value;
    updateLabel();
  });

  const state: ComboboxState = {
    multiple,
    isSelected: (value) => selectedArray.value.includes(value),
    select,
    baseId: `ui-combobox-${++uid}`,
  };
  ComboboxContext.provide(host, state);

  // Match the popup width to the trigger (Radix's --radix-popover-trigger-width
  // equivalent), measured locally — lib/floating is untouched.
  const measure = (): void => {
    const trigger = host.querySelector<HTMLElement>('[data-slot="popover-trigger"]');
    if (trigger) host.style.setProperty('--cb-anchor-width', `${trigger.offsetWidth}px`);
  };

  // ui-popover is controlled by our `open` signal; sync it from the popover's
  // own open-change events (trigger toggle, Escape, outside-pointer).
  useHostEvent(host, 'ui-open-change', (e) => {
    const next = (e as CustomEvent).detail.open as boolean;
    open.value = next;
    if (next) queueMicrotask(measure);
  });

  onMount(() => {
    // a11y: promote the popover trigger to a combobox disclosure.
    const trigger = host.querySelector('[data-slot="popover-trigger"]');
    if (trigger) {
      trigger.setAttribute('role', 'combobox');
      trigger.setAttribute('aria-haspopup', 'listbox');
    }
    // The options live inside the (nested, projected) command; their labels
    // and the trigger width settle a microtask after mount.
    queueMicrotask(() => {
      updateLabel();
      measure();
    });
  });

  const triggerClasses = cn(
    buttonVariants({ variant: 'outline' }),
    'w-[200px] justify-between font-normal',
  );
  const labelDisplay = computed(() => labelText.value || (props.placeholder.value ?? 'Select…'));
  const isEmpty = computed(() => labelText.value === '');

  return html`<div data-slot="combobox" style="display:contents" class="${computed(() => cn(props.className.value))}">${Popover({
    open,
    children: html`${PopoverTrigger({
      className: triggerClasses,
      children: html`<span
          class="truncate"
          class:text-muted-foreground=${isEmpty}
        >${labelDisplay}</span>${chevron()}`,
    })}
    ${PopoverContent({
      className: 'w-[var(--cb-anchor-width)] p-0',
      align: 'start',
      // Keep the popup inline: combobox manages its command-items by querying
      // its own host subtree (and width-matches the trigger), so it opts out of
      // the popover's default body-portal to preserve that self-contained model.
      portal: false,
      children: Command({
        children: html`${CommandInput({ placeholder: props.searchPlaceholder.value ?? 'Search…' })}
        ${CommandList({
          children: html`${CommandEmpty({ children: props.emptyText.value ?? 'No results found.' })}${props.children}`,
        })}`,
      }),
    })}`,
  })}</div>`;
}, {
  // VALUE-STATE: `value` is the attribute-as-truth selection; `defaultValue`
  // seeds it. `multiple` selects the value shape. The rest are plain strings.
  attrs: {
    value: 'string',
    defaultValue: 'string',
    multiple: 'boolean',
    placeholder: 'string',
    searchPlaceholder: 'string',
    emptyText: 'string',
    className: 'string',
  },
});

// ── ui-combobox-item ─────────────────────────────────────────────────

export const comboboxItemClasses =
  "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

export type ComboboxItemProps = {
  /** The value selected when this item is chosen. Required. */
  value?: string;
  keywords?: string;
  disabled?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const ComboboxItem = component<ComboboxItemProps>('ui-combobox-item', (props, host) => {
  const combo = ComboboxContext.inject();
  transparentHost(host);

  const disabled = computed<boolean>(() => props.disabled.value as boolean);
  const own = computed(() => props.value.value ?? '');
  const chosen = computed(() => combo.isSelected(own.value));

  const classes = computed(() => cn(comboboxItemClasses, props.className.value));
  const checkClasses = computed(() =>
    cn(
      'pointer-events-none absolute right-2 flex size-4 items-center justify-center transition-opacity',
      chosen.value ? 'opacity-100' : 'opacity-0',
    ),
  );

  const onSelect = (): void => {
    if (!disabled.value) combo.select(own.value);
  };

  return html`<div
    data-slot="command-item"
    cmdk-item=""
    role="option"
    data-value="${props.value}"
    data-keywords="${props.keywords}"
    data-disabled="${computed(() => (disabled.value ? 'true' : 'false'))}"
    data-selected="false"
    aria-selected="${computed(() => (chosen.value ? 'true' : 'false'))}"
    class="${classes}"
    @click=${onSelect}
  >${props.children}<span class="${checkClasses}"><svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="size-4"
        aria-hidden="true"
      ><path d="M20 6 9 17l-5-5"></path></svg></span></div>`;
}, {
  attrs: {
    value: 'string',
    keywords: 'string',
    disabled: 'boolean',
    className: 'string',
  },
});
