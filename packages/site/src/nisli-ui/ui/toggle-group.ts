/**
 * ui/toggle-group.ts — ToggleGroup, ToggleGroupItem.
 *
 * Ported from shadcn/ui `new-york-v4/ui/toggle-group.tsx` (MIT —
 * https://github.com/shadcn-ui/ui) and the Radix ToggleGroup behavior it
 * wraps. A set of two-state buttons where `type="single"` keeps at most one
 * pressed and `type="multiple"` allows many. Arrow keys rove between items
 * (roving-focus lib); selection changes dispatch a bubbling
 * `ui-value-change` CustomEvent (`detail: { value }`).
 *
 * Deviation from Radix (documented): single-type items stay `aria-pressed`
 * buttons rather than switching to `role="radio"`/`aria-checked` — one
 * semantic for both modes.
 *
 * The `<ui-toggle-group>` publishes its state on `host.__uiToggleGroup`;
 * items locate it via `closest('ui-toggle-group')` and render the setup
 * error fallback when used standalone.
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
import { toggleVariants, type ToggleSize, type ToggleVariant } from './toggle.js';

// ── Shared group state ────────────────────────────────────────────────

export type ToggleGroupType = 'single' | 'multiple';

interface ToggleGroupState {
  type: ToggleGroupType;
  /** Selected values — at most one entry when type is `single`. */
  value: ReadonlySignal<string[]>;
  toggleValue(value: string): void;
  variant: ReadonlySignal<ToggleVariant | undefined>;
  size: ReadonlySignal<ToggleSize | undefined>;
  spacing: ReadonlySignal<number>;
}

type GroupHost = HTMLElement & { __uiToggleGroup?: ToggleGroupState };

function useToggleGroupState(host: HTMLElement): ToggleGroupState {
  const parent = host.closest('ui-toggle-group') as GroupHost | null;
  const state = parent?.__uiToggleGroup;
  if (!state) {
    throw new Error('<ui-toggle-group-item> must be used inside <ui-toggle-group>.');
  }
  return state;
}

// ── ui-toggle-group (root) ───────────────────────────────────────────

export type ToggleGroupProps = {
  type?: ToggleGroupType;
  /** Controlled value: a string for single, string[] for multiple. */
  value?: string | string[];
  defaultValue?: string | string[];
  variant?: ToggleVariant;
  size?: ToggleSize;
  /** Gap between items in Tailwind spacing units (upstream `--gap`). Default 0. */
  spacing?: number;
  disabled?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

const toList = (v: string | string[] | undefined): string[] =>
  v == null || v === '' ? [] : Array.isArray(v) ? v : [v];

export const ToggleGroup = component<ToggleGroupProps>('ui-toggle-group', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);

  const typeAttr = attr(props.type, host, 'type');
  const type: ToggleGroupType = typeAttr.value === 'multiple' ? 'multiple' : 'single';
  const variant = attr(props.variant, host, 'variant');
  const size = attr(props.size, host, 'size');
  const className = attr(props.className, host, 'class-name');
  const spacing = computed(() => props.spacing.value ?? 0);

  const internal = signal<string[]>(
    toList(props.defaultValue.value ?? host.getAttribute('default-value') ?? undefined),
  );
  const value = computed<string[]>(() =>
    props.value.value != null ? toList(props.value.value) : internal.value,
  );

  const toggleValue = (v: string): void => {
    const current = value.value;
    const next =
      type === 'single'
        ? current.includes(v) ? [] : [v]
        : current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
    internal.value = next;
    host.dispatchEvent(
      new CustomEvent('ui-value-change', {
        detail: { value: type === 'single' ? (next[0] ?? '') : next },
        bubbles: true,
      }),
    );
  };

  const state: ToggleGroupState = { type, value, toggleValue, variant, size, spacing };
  (host as GroupHost).__uiToggleGroup = state;

  const root = ref<HTMLDivElement>();
  const roving = rovingFocus(() =>
    root.current
      ? Array.from(root.current.querySelectorAll<HTMLElement>('[data-slot="toggle-group-item"]'))
      : [],
  );

  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  const classes = computed(() =>
    cn(
      'group/toggle-group flex w-fit items-center gap-[--spacing(var(--gap))] rounded-md data-[spacing=default]:data-[variant=outline]:shadow-xs',
      className.value,
    ),
  );

  return html`<div
    ref="${root}"
    role="group"
    data-slot="toggle-group"
    data-variant="${computed(() => variant.value ?? 'default')}"
    data-size="${computed(() => size.value ?? 'default')}"
    data-spacing="${spacing}"
    style="${computed(() => `--gap: ${spacing.value}`)}"
    class="${classes}"
    @keydown=${(e: KeyboardEvent) => roving.onKeydown(e)}
  >${props.children}</div>`;
});

// ── ui-toggle-group-item ─────────────────────────────────────────────

export type ToggleGroupItemProps = {
  /** The value this item contributes to the group. Required. */
  value?: string;
  disabled?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const ToggleGroupItem = component<ToggleGroupItemProps>(
  'ui-toggle-group-item',
  (props, host) => {
    const state = useToggleGroupState(host);
    transparentHost(host);
    const projected = captureChildren(host);

    const valueAttr = attr(props.value, host, 'value');
    const own = computed(() => valueAttr.value ?? '');
    const disabled = boolAttr(props.disabled, host, 'disabled');
    const pressed = computed(() => own.value !== '' && state.value.value.includes(own.value));
    const className = attr(props.className, host, 'class-name');

    const classes = computed(() =>
      cn(
        toggleVariants({ variant: state.variant.value, size: state.size.value }),
        'w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10',
        'data-[spacing=0]:rounded-none data-[spacing=0]:shadow-none data-[spacing=0]:first:rounded-l-md data-[spacing=0]:last:rounded-r-md data-[spacing=0]:data-[variant=outline]:border-l-0 data-[spacing=0]:data-[variant=outline]:first:border-l',
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
      data-slot="toggle-group-item"
      data-variant="${computed(() => state.variant.value ?? 'default')}"
      data-size="${computed(() => state.size.value ?? 'default')}"
      data-spacing="${state.spacing}"
      aria-pressed="${computed(() => (pressed.value ? 'true' : 'false'))}"
      data-state="${computed(() => (pressed.value ? 'on' : 'off'))}"
      disabled="${disabled}"
      class="${classes}"
      @click=${() => { if (!disabled.value) state.toggleValue(own.value); }}
    >${props.children}</button>`;
  },
);
