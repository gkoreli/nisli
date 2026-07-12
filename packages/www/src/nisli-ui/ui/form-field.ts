/**
 * ui/form-field.ts — FormField, FieldDescription, FieldError.
 *
 * Ported from new-york-v4/ui/field.tsx (shadcn/ui, MIT) for visuals +
 * data-slots, with the id/aria wiring from new-york-v4/ui/form.tsx's
 * FormItem/FormControl adapted to work WITHOUT a form library.
 *
 * ── Design ──────────────────────────────────────────────────────────
 * `<ui-form-field>` is a layout + accessibility composition helper. It is
 * MECHANISM ONLY: it does no validation and holds no value — consumers bring
 * their own validation and flip the `invalid` prop. What it does is wire the
 * a11y relationships shadcn's <FormField> gets from react-hook-form, but over
 * plain light-DOM composition:
 *
 *   <ui-form-field invalid>
 *     <ui-label>Email</ui-label>
 *     <ui-input type="email"></ui-input>
 *     <ui-form-field-description>We'll never share it.</ui-form-field-description>
 *     <ui-form-field-error>Enter a valid email.</ui-form-field-error>
 *   </ui-form-field>
 *
 * After its children mount, the field finds its inner control (`input`,
 * `select`, `textarea`), its `<label>`, and its description/error elements
 * (by `data-slot`) and wires them:
 *   - the control gets an `id` (generated if unset); the `<label>` gets a
 *     matching `for` (if unset) → native label association;
 *   - description/error get generated ids and the control's `aria-describedby`
 *     points at whichever are present;
 *   - `invalid` sets `data-invalid` on the field (drives the v4
 *     `data-[invalid=true]:text-destructive` styling) and `aria-invalid` on
 *     the control, reactively.
 * Consumer-set ids/`for`/`aria-*` always win — the field only fills the gaps.
 *
 * Groups (radio/checkbox) whose a11y target is the group container rather than
 * a single input are out of scope for this helper's auto-wiring; wire their
 * `aria-describedby` by hand.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  children,
  component,
  type ComponentAttrs,
  computed,
  effect,
  html,
  onMount,
  ref,
  signal,
  type TemplateResult,
} from '@nisli/core';
import {
  cn,
  cv,
  transparentHost,
} from '../lib/utils.js';

let uid = 0;

// ── ui-form-field (root, owns the wiring) ───────────────────────────

export const fieldVariants = cv(
  'group/field flex w-full gap-3 data-[invalid=true]:text-destructive',
  {
    variants: {
      orientation: {
        vertical: 'flex-col [&>*]:w-full [&>.sr-only]:w-auto',
        horizontal:
          'flex-row items-center [&>[data-slot=field-label]]:flex-auto has-[>[data-slot=field-content]]:items-start',
      },
    },
    defaultVariants: {
      orientation: 'vertical',
    },
  },
);

export type FieldOrientation = 'vertical' | 'horizontal';

export type FormFieldProps = {
  orientation?: FieldOrientation;
  /** Error state: sets data-invalid on the field + aria-invalid on the control. */
  invalid?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

// ADR 0025 item 3: opt-in attribute reactivity. Kebab-case attr names
// (className → class-name). Passed as component()'s second type argument
// (`typeof formFieldAttrs`) so declared `invalid` narrows to `boolean` (ADR 0025
// candidate (b)) — no `as boolean` stopgap.
const formFieldAttrs = {
  orientation: 'string',
  className: 'string',
  invalid: 'boolean',
} satisfies ComponentAttrs<FormFieldProps>;

export const FormField = component<FormFieldProps, typeof formFieldAttrs>('ui-form-field', (props, host) => {
  transparentHost(host);

  // Attribute fallbacks are declared via `formFieldAttrs` and delivered as live
  // prop signals — no userland attr()/boolAttr(). Declared booleans now TYPE as
  // `boolean` (narrowed via `typeof formFieldAttrs`), so there is no `as boolean`.
  const orientation = computed<FieldOrientation>(() =>
    props.orientation.value === 'horizontal' ? 'horizontal' : 'vertical',
  );
  const invalid = computed<boolean>(() => props.invalid.value);
  const className = props.className;

  const classes = computed(() =>
    cn(fieldVariants({ orientation: orientation.value }), className.value),
  );

  const base = `ui-form-field-${++uid}`;
  const itemId = `${base}-control`;
  const descId = `${base}-description`;
  const errId = `${base}-message`;

  // ADR 0025 item 1: children() owns projection. Hoisted above this
  // component's own onMount so its late-parser sweep registers FIRST — the
  // wire() re-run below is thereby queued AFTER projection settles.
  const slot = children();

  const root = ref<HTMLDivElement>();
  let controlEl: HTMLElement | null = null;
  const wired = signal(false);

  /** Wire ids + aria between the label, control, description, and error. */
  const wire = (): void => {
    const el = root.current;
    if (!el) return;
    const control = el.querySelector(
      'input:not([type=hidden]), select, textarea',
    ) as HTMLElement | null;
    const label = el.querySelector('label');
    const desc = el.querySelector('[data-slot="field-description"]') as HTMLElement | null;
    const err = el.querySelector('[data-slot="field-error"]') as HTMLElement | null;

    if (desc && !desc.id) desc.id = descId;
    if (err && !err.id) err.id = errId;
    if (control) {
      if (!control.id) control.id = itemId;
      if (label && !label.hasAttribute('for')) label.setAttribute('for', control.id);
      const described = [desc?.id, err?.id].filter(Boolean) as string[];
      if (described.length) control.setAttribute('aria-describedby', described.join(' '));
      controlEl = control;
    }
    wired.value = true;
  };

  // Reflect `invalid` onto the (foreign) control's aria-invalid, reactively,
  // once wiring has located it. The field root's data-invalid is bound in the
  // template below.
  effect(() => {
    const inv = invalid.value;
    if (!wired.value || !controlEl) return;
    if (inv) controlEl.setAttribute('aria-invalid', 'true');
    else controlEl.removeAttribute('aria-invalid');
  });

  onMount(() => {
    wire();
    // Re-wire after the projection microtask sweep for streaming children.
    queueMicrotask(wire);
  });

  return html`<div
    ref="${root}"
    role="group"
    data-slot="field"
    data-orientation="${orientation}"
    data-invalid="${computed(() => (invalid.value ? 'true' : undefined))}"
    class="${classes}"
  >${slot}</div>`;
}, { attrs: formFieldAttrs });

// ── ui-form-field-description ───────────────────────────────────────

export const fieldDescriptionClasses =
  'text-sm leading-normal font-normal text-muted-foreground group-has-[[data-orientation=horizontal]]/field:text-balance last:mt-0 nth-last-2:-mt-1 [[data-variant=legend]+&]:-mt-1.5 [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary';

export type FieldTextProps = {
  className?: string;
  children?: string | TemplateResult;
};

const fieldDescriptionAttrs = { className: 'string' } satisfies ComponentAttrs<FieldTextProps>;

export const FieldDescription = component<FieldTextProps, typeof fieldDescriptionAttrs>(
  'ui-form-field-description',
  (props, host) => {
    transparentHost(host);

    const className = props.className;
    const classes = computed(() => cn(fieldDescriptionClasses, className.value));

    return html`<p
      data-slot="field-description"
      class="${classes}"
    >${children()}</p>`;
  },
  { attrs: fieldDescriptionAttrs },
);

// ── ui-form-field-error ─────────────────────────────────────────────

export const fieldErrorClasses = 'text-sm font-normal text-destructive';

const fieldErrorAttrs = { className: 'string' } satisfies ComponentAttrs<FieldTextProps>;

export const FieldError = component<FieldTextProps, typeof fieldErrorAttrs>(
  'ui-form-field-error',
  (props, host) => {
    transparentHost(host);

    const className = props.className;
    const classes = computed(() => cn(fieldErrorClasses, className.value));

    return html`<div
      role="alert"
      data-slot="field-error"
      class="${classes}"
    >${children()}</div>`;
  },
  { attrs: fieldErrorAttrs },
);
