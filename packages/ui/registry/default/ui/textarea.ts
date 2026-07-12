/**
 * ui/textarea.ts — Textarea.
 *
 * Ported from shadcn/ui `new-york-v4/ui/textarea.tsx` (MIT —
 * https://github.com/shadcn-ui/ui)
 * as a Nisli component. Renders a REAL native `<textarea>` in the light DOM
 * for native form participation (ADR 0022 §5): `form.elements`,
 * `form.reset()`, validation, and `<ui-label for>` association all work
 * natively.
 *
 * `id`/`name` are forwarded onto the inner control. `value` is one-way (the
 * initial value is the `form.reset()` target, later signal updates set the
 * property). A textarea's child text is its value, so plain-HTML content
 * (`<ui-textarea>Initial text</ui-textarea>`) becomes the initial value.
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
} from '@nisli/core';
import {
  captureChildren,
  cn,
  transparentHost,
} from '../lib/utils.js';

export const textareaClasses =
  'flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40';

export type TextareaProps = {
  placeholder?: string;
  autocomplete?: string;
  rows?: number;
  /** Initial value + form.reset() target; later updates set the property. */
  value?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
  /** Invalid state forwarded to the inner textarea that owns aria-invalid:* classes. */
  ariaInvalid?: boolean;
  /** Merged last into the inner <textarea>'s class list via cn(). */
  className?: string;
};

export const Textarea = component<TextareaProps>('ui-textarea', (props, host) => {
  transparentHost(host);
  // A textarea's child text is its value; capture pre-existing content.
  // NOTE: captureChildren here CONSUMES child text as the initial value (native
  // <textarea> semantics) — it does NOT project children into a slot, so this
  // is deliberately kept rather than migrated to children() (ADR 0025 item 1).
  const captured = captureChildren(host);
  const capturedText = captured.map((n) => n.textContent ?? '').join('');

  // ADR 0025 item 3: attribute fallbacks are declared via the `attrs` option
  // below and delivered as plain, LIVE prop signals — no userland
  // attr()/boolAttr()/forwardedAttr() at setup. Declared-default booleans are
  // runtime-guaranteed non-undefined; the `as boolean` is the typing stopgap.
  const placeholder = props.placeholder;
  const autocomplete = props.autocomplete;
  const value = props.value;
  const id = props.id;
  const name = props.name;
  const disabled = computed<boolean>(() => props.disabled.value as boolean);
  const required = computed<boolean>(() => props.required.value as boolean);
  const readOnly = computed<boolean>(() => props.readOnly.value as boolean);
  const className = props.className;

  const rows = props.rows; // 'number' attr (declared below) — live

  const classes = computed(() => cn(textareaClasses, className.value));

  const root = ref<HTMLTextAreaElement>();

  // Programmatic value updates → the property (leaves the reset target alone).
  effect(() => {
    const v = value.value;
    const ta = root.current;
    if (ta && v != null && ta.value !== v) ta.value = v;
  });

  const setInitial = (ta: HTMLTextAreaElement, text: string | undefined) => {
    // Setting textContent sets the native defaultValue = form.reset() target;
    // the property assignment sets the current value.
    ta.textContent = text ?? '';
    ta.value = text ?? '';
  };

  onMount(() => {
    const ta = root.current;
    if (!ta) return;
    const explicit = value.value;
    if (explicit != null) {
      setInitial(ta, explicit);
    } else if (capturedText !== '') {
      setInitial(ta, capturedText);
    } else {
      // Streaming parser: content can arrive after upgrade. Sweep once.
      queueMicrotask(() => {
        const late = Array.from(host.childNodes).filter((n) => n !== ta);
        if (!late.length) return;
        const text = late.map((n) => n.textContent ?? '').join('');
        for (const n of late) host.removeChild(n);
        if (text !== '' && value.value == null) setInitial(ta, text);
      });
    }
  });

  return html`<textarea
    ref="${root}"
    data-slot="textarea"
    class="${classes}"
    id="${id}"
    name="${name}"
    placeholder="${placeholder}"
    autocomplete="${autocomplete}"
    rows="${rows}"
    disabled="${disabled}"
    required="${required}"
    readonly="${readOnly}"
    aria-invalid="${computed(() => (props.ariaInvalid.value ? 'true' : undefined))}"
  ></textarea>`;
}, {
  // ADR 0025 item 3: opt-in attribute reactivity. Kebab-case attr names
  // (className → class-name). 'forward' relocates id/name off the transparent
  // host onto the inner control (native form participation).
  attrs: {
    placeholder: 'string',
    autocomplete: 'string',
    value: 'string',
    className: 'string',
    id: 'forward',
    name: 'forward',
    disabled: 'boolean',
    required: 'boolean',
    readOnly: { type: 'boolean', attr: 'readonly' },
    ariaInvalid: 'boolean',
    rows: 'number',
  },
});
