/**
 * field.ts — a labelled text input.
 *
 * DECLARES: that the control is a field, that its label is a label, that its
 * hint is metadata, and whether its value is currently invalid.
 *
 * DOES NOT DECIDE: control height, inline padding, border, focus ring, or the
 * colour that "invalid" is drawn in. `aria-invalid` is the declaration; the
 * theme derives the treatment from it, so the announced state and the painted
 * state are the same fact read twice and cannot disagree.
 *
 * The label is associated EXPLICITLY (generated id, `for`/`id`, and
 * `aria-describedby` for the hint) rather than by wrapping the input in the
 * <label>. Wrapping associates the label but leaves the hint unassociated, so a
 * screen reader announces the requirement and never the constraint — and the
 * explicit form is also what lets the hint sit outside the label's click target.
 */

import { component, type ComponentAttrs, computed, html, when } from '@nisli/core';

export interface FieldProps {
  label?: string;
  value?: string;
  placeholder?: string;
  hint?: string;
  invalid?: boolean;
  type?: 'text' | 'email' | 'password' | 'search';
  onInput?: (value: string) => void;
}

const fieldAttrs = {
  label: 'string',
  value: 'string',
  placeholder: 'string',
  hint: 'string',
  invalid: 'boolean',
  type: 'string',
} satisfies ComponentAttrs<FieldProps>;

/** Per-instance id source. Ids are identity, not appearance. */
let fieldSeq = 0;

export const Field = component<FieldProps, typeof fieldAttrs>(
  'app-field',
  (props) => {
    const instance = ++fieldSeq;
    const inputId = `app-field-${instance}`;
    const hintId = `app-field-hint-${instance}`;
    const hasHint = computed(() => Boolean(props.hint.value));

    return html`<div data-component="app-field" data-layout="stack">
      <label data-text="label" for=${inputId}>${props.label}</label>
      <input
        id=${inputId}
        data-appearance="field"
        type=${computed(() => props.type.value ?? 'text')}
        value=${props.value}
        placeholder=${props.placeholder}
        aria-invalid=${computed(() => (props.invalid.value ? 'true' : undefined))}
        aria-describedby=${computed(() => (hasHint.value ? hintId : undefined))}
        @input=${(event: Event) => {
          const target = event.target;
          if (target instanceof HTMLInputElement) props.onInput.value?.(target.value);
        }}
      />
      ${when(hasHint, () => html`<span id=${hintId} data-text="meta">${props.hint}</span>`)}
    </div>`;
  },
  { attrs: fieldAttrs },
);
