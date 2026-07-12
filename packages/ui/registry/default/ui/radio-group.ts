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
import {
  attr,
  boolAttr,
  captureChildren,
  cn,
  forwardedAttr,
  projectChildren,
  transparentHost,
} from '../lib/utils.js';

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

export const RadioGroup = component<RadioGroupProps>('ui-radio-group', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);

  const valueAttr = attr(props.value, host, 'value');
  const defaultAttr = attr(props.defaultValue, host, 'default-value');
  const disabled = boolAttr(props.disabled, host, 'disabled');
  // name belongs on the inner radios, not the transparent host.
  const nameAttr = forwardedAttr(props.name, host, 'name');
  const name = nameAttr.value ?? `ui-radio-group-${++uid}`;

  // Uncontrolled state, seeded from default-value (or a parse-time value attr).
  const internal = signal<string>(defaultAttr.value ?? valueAttr.value ?? '');
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

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn('grid gap-3', className.value));

  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<div
    ref="${root}"
    role="radiogroup"
    data-slot="radio-group"
    aria-disabled="${computed(() => (disabled.value ? 'true' : undefined))}"
    class="${classes}"
  >${props.children}</div>`;
});

// ── ui-radio-group-item ─────────────────────────────────────────────

// v4 radio-group-item classes, plus `appearance-none` to strip the native
// radio and a `checked:` radial-gradient dot standing in for Radix's
// `CircleIcon size-2 fill-primary` indicator (~size-2 in a size-4 box → a
// solid dot out to ~25% radius, in currentColor = text-primary).
export const radioItemClasses =
  'aspect-square size-4 shrink-0 appearance-none rounded-full border border-input text-primary shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40 checked:bg-[radial-gradient(circle,_currentColor_0%,_currentColor_25%,_transparent_29%)]';

export type RadioGroupItemProps = {
  /** The value this item selects. Required. */
  value?: string;
  id?: string;
  disabled?: boolean;
  /** Merged last into the inner <input>'s class list via cn(). */
  className?: string;
};

export const RadioGroupItem = component<RadioGroupItemProps>(
  'ui-radio-group-item',
  (props, host) => {
    const group = RadioGroupContext.inject();
    transparentHost(host);

    const valueAttr = attr(props.value, host, 'value');
    const own = computed(() => valueAttr.value ?? '');
    const id = forwardedAttr(props.id, host, 'id');
    const ownDisabled = boolAttr(props.disabled, host, 'disabled');
    const disabled = computed(() => ownDisabled.value || group.disabled.value);
    const checked = computed(() => own.value !== '' && group.value.value === own.value);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(radioItemClasses, className.value));

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
      @change=${onChange}
    />`;
  },
);
