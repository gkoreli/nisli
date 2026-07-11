/**
 * ui/select.ts — Select (native).
 *
 * Ported from new-york-v4/ui/native-select.tsx (shadcn/ui, MIT —
 * https://github.com/shadcn-ui/ui). This is shadcn's NATIVE select: a real
 * `<select>` in a wrapper `<div>` with a chevron icon, not the Radix custom
 * listbox in `select.tsx` (that is a separate, later combobox-style
 * component). The browser's own popup, keyboard, typeahead, and form
 * participation all work natively (ADR 0022 §5).
 *
 * `<option>` children are projected into the inner `<select>`:
 *
 * ```html
 * <ui-select name="fruit">
 *   <option value="apple">Apple</option>
 *   <option value="pear">Pear</option>
 * </ui-select>
 * ```
 *
 * The native arrow is stripped with `appearance-none`; the chevron is a real
 * `text-muted-foreground` SVG element in the wrapper (matches the v4 source —
 * it themes with the token layer, unlike a fixed-color background image).
 * `id`/`name` are forwarded onto the inner control. `value`/`defaultValue`
 * mirror the native attribute/property split: `defaultValue` (or an
 * `<option selected>`) is the initial selection and `form.reset()` target,
 * while later `value` signal updates set the property. Native `change`
 * bubbles out.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  component,
  computed,
  effect,
  html,
  onMount,
  ref,
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

export const selectWrapperClasses =
  'group/native-select relative w-fit has-[select:disabled]:opacity-50';

export const selectClasses =
  'h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-transparent px-3 py-2 pr-9 text-sm shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed data-[size=sm]:h-8 data-[size=sm]:py-1 dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40';

export const selectIconClasses =
  'pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground opacity-50 select-none';

export type SelectSize = 'sm' | 'default';

export type SelectProps = {
  /** Controlled selected value. */
  value?: string;
  /** Initial selection + form.reset() target. */
  defaultValue?: string;
  size?: SelectSize;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  /** Merged last into the inner <select>'s class list via cn(). */
  className?: string;
  /** The <option> elements. */
  children?: string | TemplateResult;
};

export const Select = component<SelectProps>('ui-select', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);

  const value = attr(props.value, host, 'value');
  const defaultValue = attr(props.defaultValue, host, 'default-value');
  const size = attr(props.size, host, 'size');
  const id = forwardedAttr(props.id, host, 'id');
  const name = forwardedAttr(props.name, host, 'name');
  const disabled = boolAttr(props.disabled, host, 'disabled');
  const required = boolAttr(props.required, host, 'required');
  const className = attr(props.className, host, 'class-name');

  const classes = computed(() => cn(selectClasses, className.value));

  const root = ref<HTMLSelectElement>();

  // Controlled value updates → the property (leaves the reset target alone).
  effect(() => {
    const v = value.value;
    const select = root.current;
    if (select && v != null && select.value !== v) select.value = v;
  });

  onMount(() => {
    const select = root.current;
    if (!select) return;
    // Project <option> children into the <select> first (may append late,
    // streaming options in a microtask).
    projectChildren(host, select, projected);

    // Select the initial value once options exist, and mark it as the native
    // reset target (defaultSelected). Runs now (captured options) and after
    // projectChildren's microtask sweep (streaming options).
    const applyInitial = () => {
      const initial = value.value ?? defaultValue.value;
      if (initial == null) return;
      select.value = initial;
      for (const opt of Array.from(select.options)) {
        opt.defaultSelected = opt.value === initial;
      }
    };
    applyInitial();
    queueMicrotask(applyInitial);
  });

  return html`<div data-slot="native-select-wrapper" class="${selectWrapperClasses}">
    <select
      ref="${root}"
      data-slot="native-select"
      data-size="${computed(() => size.value ?? 'default')}"
      class="${classes}"
      id="${id}"
      name="${name}"
      disabled="${disabled}"
      required="${required}"
    >${props.children}</select>
    <svg
      data-slot="native-select-icon"
      class="${selectIconClasses}"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    ><path d="m6 9 6 6 6-6"></path></svg>
  </div>`;
});
