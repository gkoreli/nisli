/**
 * ui/radio-group.ts — RadioGroup, RadioGroupItem.
 *
 * Ported from new-york-v4/ui/radio-group.tsx (shadcn/ui, MIT —
 * https://github.com/shadcn-ui/ui) and the Radix RadioGroup behavior it
 * wraps (MIT), rebuilt as Nisli custom elements. Class lists, data-slots, and
 * aria-* match the v4 source; the visual indicator (Radix's `CircleIcon
 * size-2 fill-primary`) is adapted to a native `<input>` as a `checked:`
 * radial-gradient dot in `currentColor` (`text-primary`), since an `<input>`
 * cannot nest an indicator element.
 *
 * Each item is a REAL native `<input type="radio">` in the light DOM, so the
 * platform gives us mutual exclusion, arrow-key navigation, and form
 * participation FREE (ADR 0022 §5) — no roving-tabindex shim needed.
 *
 * ```
 * <ui-radio-group value="a" name="plan">
 *   <ui-radio-group-item value="a" id="a"></ui-radio-group-item>
 *   <ui-radio-group-item value="b" id="b"></ui-radio-group-item>
 * </ui-radio-group>
 * ```
 *
 * Parent↔child channel (matches ui-tabs): the `<ui-radio-group>` publishes its
 * state via a subtree-scoped context (`RadioGroupContext`); items resolve it
 * with `RadioGroupContext.inject()`, which throws into the setup error boundary
 * if used outside a group. Items share the group's `name` so the browser treats them
 * as one radio set. Selection changes dispatch a bubbling `ui-value-change`
 * CustomEvent (`detail: { value }`) from the group host.
 *
 * The visual is pure CSS: `appearance-none` plus a `checked:` radial-gradient
 * dot in `currentColor` (`text-primary`), so the indicator themes with the
 * token layer and needs no JavaScript.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  component,
  type ComponentAttrs,
  createContext,
  children,
  computed,
  effect,
  html,
  onMount,
  ref,
  signal,
  type ReadonlySignal,
  type TemplateResult,
} from '@nisli/core';
import { cn, transparentHost } from '../lib/utils.js';

// ── Shared parent state (published on the <ui-radio-group> host) ─────

export interface RadioGroupState {
  /** The selected value. */
  value: ReadonlySignal<string>;
  /** Select a value; dispatches `ui-value-change` when it actually changes. */
  setValue(value: string): void;
  /** The shared radio `name` all items render, so the browser groups them. */
  name: string;
  /** Whether the whole group is disabled. */
  disabled: ReadonlySignal<boolean>;
}

/** Subtree-scoped channel from the RadioGroup provider to its parts. */
const RadioGroupContext = createContext<RadioGroupState>('RadioGroup', { providerTag: 'ui-radio-group' });

let uid = 0;

// ── ui-radio-group (root, owns state) ───────────────────────────────

export type RadioGroupProps = {
  /** Controlled selected value. */
  value?: string;
  /** Initial value when uncontrolled. */
  defaultValue?: string;
  /** Shared radio `name`; falls back to a generated one if omitted. */
  name?: string;
  disabled?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

// ADR 0025 item 3: opt-in attribute reactivity. Kebab-case attr names
// (className → class-name, defaultValue → default-value). 'forward' relocates
// `name` off the transparent host onto the inner radios.
const radioGroupAttrs = {
  value: 'string',
  defaultValue: 'string',
  name: 'forward',
  className: 'string',
  disabled: 'boolean',
} satisfies ComponentAttrs<RadioGroupProps>;

export const RadioGroup = component<RadioGroupProps, typeof radioGroupAttrs>('ui-radio-group', (props, host) => {
  transparentHost(host);

  // ADR 0025 item 3: attribute fallbacks are declared via the `attrs` option
  // below and delivered as plain, LIVE prop signals — no userland
  // attr()/boolAttr()/forwardedAttr() at setup. Declared booleans are runtime-
  // guaranteed non-undefined and now TYPE as `boolean` via the second type arg
  // (ADR 0025 candidate (b)). 'forward' relocates `name` off the transparent
  // host so it lives only on the inner radios.
  const disabled = computed<boolean>(() => props.disabled.value);
  const name = props.name.value ?? `ui-radio-group-${++uid}`;

  // Uncontrolled state, seeded from default-value (or a parse-time value attr).
  const internal = signal<string>(props.defaultValue.value ?? props.value.value ?? '');
  // A controlled `value` prop always wins and stays reactively in sync; when
  // absent, the selection is our own internal state.
  const current = computed<string>(() => props.value.value ?? internal.value);

  const setValue = (v: string): void => {
    if (v === current.value) return;
    internal.value = v;
    host.dispatchEvent(
      new CustomEvent('ui-value-change', { detail: { value: v }, bubbles: true }),
    );
  };

  const state: RadioGroupState = { value: current, setValue, name, disabled };
  RadioGroupContext.provide(host, state);

  const classes = computed(() => cn('grid gap-3', props.className.value));

  return html`<div
    role="radiogroup"
    data-slot="radio-group"
    aria-disabled="${computed(() => (disabled.value ? 'true' : undefined))}"
    class="${classes}"
  >${children()}</div>`;
}, { attrs: radioGroupAttrs });

// ── ui-radio-group-item ─────────────────────────────────────────────

// v4 radio-group-item classes, plus `appearance-none` to strip the native
// radio and a `checked:` radial-gradient dot standing in for Radix's
// `CircleIcon size-2 fill-primary` indicator (~size-2 in a size-4 box → a
// solid dot out to ~25% radius, in currentColor = text-primary).
//
// STYLE-QUERY INVALID (bet 08 batch 1): the `field-invalid:` trio is ADDED next to
// the `aria-invalid:` trio, not instead of it. `aria-invalid:` only fires when the
// attribute sits on this same painted node, so it waits on <ui-form-field> having
// located the control; `field-invalid:` reads `--field-invalid` inherited from any
// ancestor (custom properties cross `display:contents`), so a control inside an
// invalid field paints unwired. Both paths stay — see styles/theme.css.
export const radioItemClasses =
  'aspect-square size-4 shrink-0 appearance-none rounded-full border border-input text-primary shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40 checked:bg-[radial-gradient(circle,_currentColor_0%,_currentColor_25%,_transparent_29%)] field-invalid:border-destructive field-invalid:ring-destructive/20 dark:field-invalid:ring-destructive/40';

export type RadioGroupItemProps = {
  /** The value this item selects. Required. */
  value?: string;
  id?: string;
  disabled?: boolean;
  /** Invalid state forwarded to this inner radio that owns aria-invalid:* classes. */
  ariaInvalid?: boolean;
  /** Merged last into the inner <input>'s class list via cn(). */
  className?: string;
};

// ADR 0025 item 3: opt-in attribute reactivity. Kebab-case attr names
// (className → class-name). 'forward' relocates `id` off the transparent
// host onto the inner radio (native form participation + label binding).
const radioGroupItemAttrs = {
  value: 'string',
  id: 'forward',
  className: 'string',
  disabled: 'boolean',
  ariaInvalid: 'boolean',
} satisfies ComponentAttrs<RadioGroupItemProps>;

export const RadioGroupItem = component<RadioGroupItemProps, typeof radioGroupItemAttrs>(
  'ui-radio-group-item',
  (props, host) => {
    const group = RadioGroupContext.inject();
    transparentHost(host);

    // ADR 0025 item 3: attribute fallbacks declared via the `attrs` option
    // below and delivered as LIVE prop signals — no userland
    // attr()/boolAttr()/forwardedAttr() at setup. 'forward' relocates `id` off
    // the transparent host onto the inner radio (native label association).
    const own = computed(() => props.value.value ?? '');
    const id = props.id;
    const ownDisabled = computed<boolean>(() => props.disabled.value);
    const disabled = computed(() => ownDisabled.value || group.disabled.value);
    const checked = computed(() => own.value !== '' && group.value.value === own.value);
    const classes = computed(() => cn(radioItemClasses, props.className.value));

    const root = ref<HTMLInputElement>();

    // Keep the native radio's checked property in sync with group state.
    effect(() => {
      const c = checked.value;
      const box = root.current;
      if (box && box.checked !== c) box.checked = c;
    });

    onMount(() => {
      const box = root.current;
      if (!box) return;
      if (checked.value) {
        box.defaultChecked = true; // native form.reset() target
        box.checked = true;
      }
    });

    const onChange = (): void => {
      if (!disabled.value) group.setValue(own.value);
    };

    return html`<input
      ref="${root}"
      type="radio"
      data-slot="radio-group-item"
      class="${classes}"
      id="${id}"
      name="${group.name}"
      value="${own}"
      disabled="${disabled}"
      aria-invalid="${computed(() => (props.ariaInvalid.value ? 'true' : undefined))}"
      @change=${onChange}
    />`;
  },
  { attrs: radioGroupItemAttrs },
);
