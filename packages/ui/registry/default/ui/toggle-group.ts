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
 * The `<ui-toggle-group>` publishes its state via a subtree-scoped context
 * (`ToggleGroupContext`); items resolve it with `ToggleGroupContext.inject()`
 * and render the setup error fallback when used standalone.
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
  /** Group-level disable — disables every item (Radix Root `disabled`). */
  disabled: ReadonlySignal<boolean>;
}

/** Subtree-scoped channel from the ToggleGroup provider to its parts. */
const ToggleGroupContext = createContext<ToggleGroupState>('ToggleGroup', { providerTag: 'ui-toggle-group' });

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

export const ToggleGroup = component<ToggleGroupProps>('ui-toggle-group', (props, host) => {
  transparentHost(host);

  // `type` is known at setup (attribute-seeded); the value-state shape below
  // branches on it and never changes shape after.
  const type: ToggleGroupType = props.type.value === 'multiple' ? 'multiple' : 'single';
  const variant = props.variant;
  const size = props.size;
  const spacing = computed(() => props.spacing.value ?? 0);
  const disabled = computed<boolean>(() => props.disabled.value as boolean);

  // VALUE-STATE pattern (ADR 0025 item 3): the `value` ATTRIBUTE is the
  // uncontrolled selection state — the attribute IS the truth. `defaultValue`
  // seeds it once. `single` stores a plain string; `multiple` stores a
  // comma-separated list.
  // Encoding limit: comma-separated attribute — values containing commas are
  // unsupported (upstream values are slugs).
  const normalize = (v: unknown): string[] =>
    Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(',') : [];

  let value: ReadonlySignal<string[]>;
  let toggleValue: (v: string) => void;

  if (type === 'single') {
    const current = computed<string>(() => (props.value.value as string | undefined) ?? '');
    const setValue = (v: string): void => {
      if (v === current.value) return;
      if (!isPinned(host, 'value')) {
        // uncontrolled: attr IS state
        if (v) host.setAttribute('value', v);
        else host.removeAttribute('value');
      }
      host.dispatchEvent(
        new CustomEvent('ui-value-change', { detail: { value: v }, bubbles: true }),
      );
    };
    // defaultValue INIT-SEED-ONLY, double-guarded. host.hasAttribute('value')
    // is a SANCTIONED read of a DECLARED attribute (absent vs present).
    if (props.defaultValue.value && !isPinned(host, 'value') && !host.hasAttribute('value')) {
      host.setAttribute('value', props.defaultValue.value as string);
    }
    effect(() => {
      const v = current.value;
      if (v) host.setAttribute('value', v);
      else host.removeAttribute('value');
    });

    value = computed<string[]>(() => (current.value ? [current.value] : []));
    toggleValue = (v: string): void => setValue(current.value === v ? '' : v);
  } else {
    const current = computed<string[]>(() => normalize(props.value.value));
    value = current;
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
    toggleValue = (v: string): void => {
      const cur = current.value;
      setValue(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
    };

    if (props.defaultValue.value != null && !isPinned(host, 'value') && !host.hasAttribute('value')) {
      const seed = normalize(props.defaultValue.value);
      if (seed.length) host.setAttribute('value', seed.join(','));
    }
    effect(() => {
      const v = current.value;
      if (v.length) host.setAttribute('value', v.join(','));
      else host.removeAttribute('value');
    });
  }

  const state: ToggleGroupState = { type, value, toggleValue, variant, size, spacing, disabled };
  ToggleGroupContext.provide(host, state);

  const root = ref<HTMLDivElement>();
  const roving = rovingFocus(() =>
    root.current
      ? Array.from(root.current.querySelectorAll<HTMLElement>('[data-slot="toggle-group-item"]'))
      : [],
  );

  const className = props.className;
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
    data-variant="${variant}"
    data-size="${size}"
    data-spacing="${spacing}"
    style="${computed(() => `--gap: ${spacing.value}`)}"
    class="${classes}"
    @keydown=${(e: KeyboardEvent) => roving.onKeydown(e)}
  >${children()}</div>`;
}, {
  // VALUE-STATE: `value` is the attribute-as-truth selection; `defaultValue` seeds it.
  attrs: {
    type: 'string',
    value: 'string',
    defaultValue: 'string',
    variant: 'string',
    size: 'string',
    disabled: 'boolean',
    className: 'string',
  },
});

// ── ui-toggle-group-item ─────────────────────────────────────────────

export type ToggleGroupItemProps = {
  /** The value this item contributes to the group. Required. */
  value?: string;
  /** Per-item variant — the group's `variant` wins when set (upstream `context.variant || variant`). */
  variant?: ToggleVariant;
  /** Per-item size — the group's `size` wins when set. */
  size?: ToggleSize;
  disabled?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const ToggleGroupItem = component<ToggleGroupItemProps>(
  'ui-toggle-group-item',
  (props, host) => {
    const state = ToggleGroupContext.inject();
    transparentHost(host);

    const own = computed(() => props.value.value ?? '');
    // Group-level disable wins alongside the item's own (Radix Root semantics).
    const disabled = computed<boolean>(
      () => state.disabled.value || (props.disabled.value as boolean),
    );
    const pressed = computed(() => own.value !== '' && state.value.value.includes(own.value));
    // Upstream: `context.variant || variant` — the group's setting wins when present.
    const variant = computed<ToggleVariant | undefined>(
      () => state.variant.value ?? props.variant.value,
    );
    const size = computed<ToggleSize | undefined>(() => state.size.value ?? props.size.value);
    const className = props.className;

    const classes = computed(() =>
      cn(
        toggleVariants({ variant: variant.value, size: size.value }),
        'w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10',
        'data-[spacing=0]:rounded-none data-[spacing=0]:shadow-none data-[spacing=0]:first:rounded-l-md data-[spacing=0]:last:rounded-r-md data-[spacing=0]:data-[variant=outline]:border-l-0 data-[spacing=0]:data-[variant=outline]:first:border-l',
        className.value,
      ),
    );

    return html`<button
      type="button"
      data-slot="toggle-group-item"
      data-variant="${variant}"
      data-size="${size}"
      data-spacing="${state.spacing}"
      aria-pressed="${computed(() => (pressed.value ? 'true' : 'false'))}"
      data-state="${computed(() => (pressed.value ? 'on' : 'off'))}"
      disabled="${disabled}"
      class="${classes}"
      @click=${() => { if (!disabled.value) state.toggleValue(own.value); }}
    >${children()}</button>`;
  },
  { attrs: { value: 'string', variant: 'string', size: 'string', disabled: 'boolean', className: 'string' } },
);
