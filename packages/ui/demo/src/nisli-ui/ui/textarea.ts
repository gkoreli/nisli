/**
 * ui/textarea.ts — Textarea.
 *
 * Port of shadcn/ui `textarea` (MIT — https://github.com/shadcn-ui/ui)
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
  attr,
  boolAttr,
  captureChildren,
  cn,
  forwardedAttr,
  transparentHost,
} from '../lib/utils.js';

export const textareaClasses =
  'flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

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
  /** Merged last into the inner <textarea>'s class list via cn(). */
  className?: string;
};

export const Textarea = component<TextareaProps>('ui-textarea', (props, host) => {
  transparentHost(host);
  // A textarea's child text is its value; capture pre-existing content.
  const captured = captureChildren(host);
  const capturedText = captured.map((n) => n.textContent ?? '').join('');

  const placeholder = attr(props.placeholder, host, 'placeholder');
  const autocomplete = attr(props.autocomplete, host, 'autocomplete');
  const value = attr(props.value, host, 'value');
  const id = forwardedAttr(props.id, host, 'id');
  const name = forwardedAttr(props.name, host, 'name');
  const disabled = boolAttr(props.disabled, host, 'disabled');
  const required = boolAttr(props.required, host, 'required');
  const readOnly = boolAttr(props.readOnly, host, 'readonly');
  const className = attr(props.className, host, 'class-name');

  const rowsAttr = host.getAttribute('rows') ?? undefined;
  const rows = computed(() => props.rows.value ?? rowsAttr);

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
  ></textarea>`;
});
