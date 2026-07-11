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
  computed,
  html,
  onMount,
  ref,
  signal,
  useHostEvent,
  type ReadonlySignal,
  type TemplateResult,
} from '@nisli/core';
import {
  attr,
  boolAttr,
  cn,
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

type ComboboxHost = HTMLElement & { __uiCombobox?: ComboboxState };

let uid = 0;

function useComboboxState(host: HTMLElement, tag: string): ComboboxState {
  const parent = host.closest('ui-combobox') as ComboboxHost | null;
  const state = parent?.__uiCombobox;
  if (!state) {
    throw new Error(`<${tag}> must be used inside <ui-combobox>.`);
  }
  return state;
}

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

  const multiple = props.multiple.value ?? host.hasAttribute('multiple');

  const initial = ((): string[] => {
    const v =
      props.value.value ??
      props.defaultValue.value ??
      host.getAttribute('value') ??
      host.getAttribute('default-value') ??
      undefined;
    if (v == null || v === '') return [];
    return multiple ? v.split(',').map((s) => s.trim()).filter(Boolean) : [v];
  })();
  const selected = signal<string[]>(initial);
  const open = signal<boolean>(false);
  const labelText = signal<string>('');

  const placeholder = attr(props.placeholder, host, 'placeholder');
  const searchPlaceholder = attr(props.searchPlaceholder, host, 'search-placeholder');
  const emptyText = attr(props.emptyText, host, 'empty-text');
  const className = attr(props.className, host, 'class-name');

  const items = (): HTMLElement[] =>
    Array.from(host.querySelectorAll<HTMLElement>('[data-slot="command-item"]'));
  const labelFor = (value: string): string => {
    const el = items().find((e) => e.getAttribute('data-value') === value);
    return el ? (el.textContent ?? '').trim() : value;
  };
  const updateLabel = (): void => {
    const sel = selected.value;
    if (sel.length === 0) labelText.value = '';
    else if (multiple) labelText.value = `${sel.length} selected`;
    else labelText.value = labelFor(sel[0]!);
  };

  const emit = (): void => {
    host.dispatchEvent(
      new CustomEvent('ui-value-change', {
        detail: { value: multiple ? [...selected.value] : selected.value[0] ?? '' },
        bubbles: true,
      }),
    );
  };

  const state: ComboboxState = {
    multiple,
    isSelected: (value) => selected.value.includes(value),
    select: (value) => {
      if (multiple) {
        const set = new Set(selected.value);
        if (set.has(value)) set.delete(value);
        else set.add(value);
        selected.value = [...set];
      } else {
        selected.value = [value];
        open.value = false; // single-select closes the popup
      }
      updateLabel();
      emit();
    },
    baseId: `ui-combobox-${++uid}`,
  };
  (host as ComboboxHost).__uiCombobox = state;

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
  const labelDisplay = computed(() => labelText.value || (placeholder.value ?? 'Select…'));
  const isEmpty = computed(() => labelText.value === '');

  return html`<div data-slot="combobox" style="display:contents" class="${computed(() => cn(className.value))}">${Popover({
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
      children: Command({
        children: html`${CommandInput({ placeholder: searchPlaceholder.value ?? 'Search…' })}
        ${CommandList({
          children: html`${CommandEmpty({ children: emptyText.value ?? 'No results found.' })}${props.children}`,
        })}`,
      }),
    })}`,
  })}</div>`;
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
  const combo = useComboboxState(host, 'ui-combobox-item');
  transparentHost(host);

  const value = attr(props.value, host, 'value');
  const keywords = attr(props.keywords, host, 'keywords');
  const disabled = boolAttr(props.disabled, host, 'disabled');
  const className = attr(props.className, host, 'class-name');
  const own = computed(() => value.value ?? '');
  const chosen = computed(() => combo.isSelected(own.value));

  const classes = computed(() => cn(comboboxItemClasses, className.value));
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
    data-value="${value}"
    data-keywords="${keywords}"
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
});
