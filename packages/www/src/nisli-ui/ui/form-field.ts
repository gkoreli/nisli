/**
 * ui/form-field.ts — the field family: FormField (the `Field` root, with id/aria
 * wiring), FieldGroup, FieldSet, FieldLegend, FieldContent, FieldLabel, FieldTitle,
 * FieldDescription, FieldError, FieldSeparator.
 *
 * Ported from new-york-v4/ui/field.tsx (shadcn/ui, MIT) for visuals +
 * data-slots, with the id/aria wiring from new-york-v4/ui/form.tsx's
 * FormItem/FormControl adapted to work WITHOUT a form library.
 *
 * ── Layout family (UI-52) ───────────────────────────────────────────
 * `FieldGroup` (`@container/field-group`) is the container-query root that
 * unlocks `FormField`'s `responsive` orientation; `FieldContent` groups a
 * control with its description/error and is what the horizontal alignment token
 * keys on; `FieldSet`/`FieldLegend` are the native grouping pair; `FieldLabel`
 * (Label-styled) / `FieldTitle` carry `data-slot="field-label"`; `FieldSeparator`
 * is a labeled divider. Because every part renders through a layout-transparent
 * (`display:contents`) host, upstream's DIRECT-CHILD layout selectors are
 * translated to descendant form (the cross-cutting box-model rule); the
 * horizontal checkbox/radio alignment token is retargeted from Radix
 * `[role=checkbox]`/`[role=radio]` to our native controls' data-slots. Each
 * translation is annotated at its site.
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
import { labelVariants } from './label.js';
import { Separator } from './separator.js';

let uid = 0;

// ── ui-form-field (root, owns the wiring) ───────────────────────────

// TRANSPARENT-HOST TRANSLATION (UI-52, cross-cutting box-model rule): the field's
// children are projected light-DOM custom-element hosts (ui-label, ui-input,
// ui-form-field-content, …), each `display:contents`, so the BOXED element a layout
// token means to hit is one level deeper (a descendant), not a direct child. Every
// upstream `[&>…]` / `has-[>…]` that targets a slot-bearing or control child is
// therefore translated child→descendant (verbatim where the child is genuinely
// immediate, i.e. the flex direction/alignment tokens on the field div itself):
//   - `[&>*]:w-*`                    → `[&>*>*]:w-*`   (size each host's boxed inner)
//   - `[&>[data-slot=field-label]]`  → `[&_[data-slot=field-label]]` (descendant)
//   - `has-[>[data-slot=field-content]]` → `has-[[data-slot=field-content]]` (descendant :has)
//   - `[&>[role=checkbox],[role=radio]]` → `[&_[data-slot=checkbox]],[&_[data-slot=radio-group-item]]`
//     — NATIVE-FIRST retarget: nisli renders real inputs (no Radix `role=checkbox`),
//     so the horizontal alignment token (deferred feature #B) is aimed at our native
//     controls' data-slots instead. Container-query tokens (`@md/field-group:`) are
//     unchanged — they resolve against the FieldGroup container, not a direct child.
//
// STYLE-QUERY SOURCE (bet 08 batch 1): `data-[invalid=true]:[--field-invalid:true]`
// republishes the same invalid state as an inheritable custom property. Custom
// properties cross `display:contents`, so every control nested under this field —
// at any depth, through any number of transparent hosts — can style itself with
// theme.css's `field-invalid:` variant without the field having to FIND it. The
// data attribute is the truth and stays; this is one extra derivation of it, not
// a replacement, and the `aria-invalid` effect below is untouched.
export const fieldVariants = cv(
  'group/field flex w-full gap-3 data-[invalid=true]:text-destructive data-[invalid=true]:[--field-invalid:true]',
  {
    variants: {
      orientation: {
        vertical: 'flex-col [&>*>*]:w-full [&>.sr-only]:w-auto',
        horizontal:
          'flex-row items-center [&>*>[data-slot=field-label]]:flex-auto has-[[data-slot=field-content]]:items-start has-[[data-slot=field-content]]:[&>*>[data-slot=checkbox]]:mt-px has-[[data-slot=field-content]]:[&>*>[data-slot=radio-group-item]]:mt-px',
        responsive:
          'flex-col @md/field-group:flex-row @md/field-group:items-center [&>*>*]:w-full @md/field-group:[&>*>*]:w-auto [&>.sr-only]:w-auto @md/field-group:[&>*>[data-slot=field-label]]:flex-auto @md/field-group:has-[[data-slot=field-content]]:items-start @md/field-group:has-[[data-slot=field-content]]:[&>*>[data-slot=checkbox]]:mt-px @md/field-group:has-[[data-slot=field-content]]:[&>*>[data-slot=radio-group-item]]:mt-px',
      },
    },
    defaultVariants: {
      orientation: 'vertical',
    },
  },
);

export type FieldOrientation = 'vertical' | 'horizontal' | 'responsive';

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
  const orientation = computed<FieldOrientation>(() => {
    const o = props.orientation.value;
    return o === 'horizontal' || o === 'responsive' ? o : 'vertical';
  });
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

// ── ui-form-field-group (the @container/field-group container root) ──

export type FieldContainerProps = {
  className?: string;
  children?: string | TemplateResult;
};

const fieldGroupAttrs = { className: 'string' } satisfies ComponentAttrs<FieldContainerProps>;

// PHYSICS (arch, UI-52): a container-query root MUST be a BOXED element — a
// `display:contents` host cannot be a container (no box). So `@container/field-group`
// lives on the inner `flex flex-col` DIV, never the transparent host; descendant
// Fields resolve `@md/field-group:` (the `responsive` orientation) against it.
// Translation: `[&>[data-slot=field-group]]:gap-4` → `[&>*>[data-slot=field-group]]`
// (a nested group's boxed div is a grandchild through its ui-form-field-group host).
export const FieldGroup = component<FieldContainerProps, typeof fieldGroupAttrs>(
  'ui-form-field-group',
  (props, host) => {
    transparentHost(host);
    const className = props.className;
    const classes = computed(() =>
      cn(
        'group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-3 [&>*>[data-slot=field-group]]:gap-4',
        className.value,
      ),
    );
    return html`<div data-slot="field-group" class="${classes}">${children()}</div>`;
  },
  { attrs: fieldGroupAttrs },
);

// ── ui-form-field-content ───────────────────────────────────────────

const fieldContentAttrs = { className: 'string' } satisfies ComponentAttrs<FieldContainerProps>;

export const FieldContent = component<FieldContainerProps, typeof fieldContentAttrs>(
  'ui-form-field-content',
  (props, host) => {
    transparentHost(host);
    const className = props.className;
    const classes = computed(() =>
      cn('group/field-content flex flex-1 flex-col gap-1.5 leading-snug', className.value),
    );
    return html`<div data-slot="field-content" class="${classes}">${children()}</div>`;
  },
  { attrs: fieldContentAttrs },
);

// ── ui-form-field-set (native <fieldset>) ───────────────────────────

export type FieldSetProps = FieldContainerProps & {
  /**
   * Explicit group label id, forwarded to the inner `<fieldset>`'s
   * `aria-labelledby`. When set it takes PRECEDENCE over the auto-wired legend —
   * a live attribute (kebab `aria-labelledby`), so a post-mount write also wins.
   */
  ariaLabelledby?: string;
};

const fieldSetAttrs = {
  className: 'string',
  ariaLabelledby: { type: 'string', attr: 'aria-labelledby' },
} satisfies ComponentAttrs<FieldSetProps>;

// Translation: `has-[>[data-slot=radio-group]]` (direct-child :has) → descendant
// `has-[[data-slot=radio-group]]` (the radio-group is host-wrapped, one level deeper).
//
// A11y (transparent-host NATIVE-RELATIONSHIP fix): the native `<fieldset>`→`<legend>`
// naming relationship requires the legend to be a DIRECT child, but our transparent
// `ui-form-field-legend` host inserts a level, so the browser does not name the group
// from it. We restore it explicitly — point the fieldset's `aria-labelledby` at the
// legend (generating an id if unset), the same gap-filling `<ui-form-field>` does for
// label/control association. A consumer-provided `ariaLabelledby` WINS (single writer:
// one effect resolves consumer value ?? the wired legend id — no reactive-binding vs
// imperative-setAttribute race on the same attribute).
export const FieldSet = component<FieldSetProps, typeof fieldSetAttrs>(
  'ui-form-field-set',
  (props, host) => {
    transparentHost(host);
    const className = props.className;
    const ariaLabelledby = props.ariaLabelledby;
    const classes = computed(() =>
      cn(
        'flex flex-col gap-6 has-[[data-slot=checkbox-group]]:gap-3 has-[[data-slot=radio-group]]:gap-3',
        className.value,
      ),
    );

    // ADR 0025 item 1: children() owns projection. Hoisted ABOVE this component's
    // own onMount so its late-parser projection sweep registers FIRST — wireLegend's
    // queued re-run is thereby ordered AFTER projection settles (matching the
    // FormField pattern), so a late / plain custom-element legend is still found.
    const slot = children();

    const root = ref<HTMLFieldSetElement>();
    const legendId = `ui-form-field-legend-${++uid}`;
    const wiredLegendId = signal<string | undefined>(undefined);
    const mounted = signal(false);
    const wireLegend = (): void => {
      const el = root.current;
      if (!el) return;
      const legend = el.querySelector('[data-slot="field-legend"]');
      if (!legend) return;
      if (!legend.id) legend.id = legendId;
      wiredLegendId.value = legend.id;
    };
    // Single writer of aria-labelledby: the consumer value wins, else the wired
    // legend id. Read the signals FIRST (so the effect always tracks them and the
    // `mounted` flip), then act once the fieldset exists — reactive, so a post-mount
    // consumer write (attribute → prop signal) or a late-wired legend takes over.
    // When BOTH sources are absent (e.g. a no-legend fieldset whose consumer
    // aria-labelledby is later removed) the writer REMOVES the attribute so no stale
    // value lingers on the inner fieldset (rev pass 2).
    effect(() => {
      const resolved = ariaLabelledby.value ?? wiredLegendId.value;
      const ready = mounted.value;
      const el = root.current;
      if (!ready || !el) return;
      if (resolved) el.setAttribute('aria-labelledby', resolved);
      else el.removeAttribute('aria-labelledby');
    });
    onMount(() => {
      mounted.value = true;
      wireLegend();
      queueMicrotask(wireLegend); // after the projection sweep for late/plain children
    });

    return html`<fieldset
      ref="${root}"
      data-slot="field-set"
      class="${classes}"
    >${slot}</fieldset>`;
  },
  { attrs: fieldSetAttrs },
);

// ── ui-form-field-legend (native <legend>; legend | label variant) ──

export type FieldLegendVariant = 'legend' | 'label';

export type FieldLegendProps = {
  variant?: FieldLegendVariant;
  className?: string;
  children?: string | TemplateResult;
};

const fieldLegendAttrs = {
  variant: 'string',
  className: 'string',
} satisfies ComponentAttrs<FieldLegendProps>;

export const FieldLegend = component<FieldLegendProps, typeof fieldLegendAttrs>(
  'ui-form-field-legend',
  (props, host) => {
    transparentHost(host);
    const className = props.className;
    const variant = computed<FieldLegendVariant>(() =>
      props.variant.value === 'label' ? 'label' : 'legend',
    );
    const classes = computed(() =>
      cn(
        'mb-3 font-medium data-[variant=legend]:text-base data-[variant=label]:text-sm',
        className.value,
      ),
    );
    return html`<legend
      data-slot="field-legend"
      data-variant="${variant}"
      class="${classes}"
    >${children()}</legend>`;
  },
  { attrs: fieldLegendAttrs },
);

// ── ui-form-field-label (a Label-styled element, data-slot=field-label) ─

// Translated card-nesting selectors: `has-[>[data-slot=field]]` (direct-child :has)
// → descendant `has-[[data-slot=field]]`, and `[&>*]:data-[slot=field]:p-4`
// (direct-child field) → `[&>*>[data-slot=field]]:p-4` — both because a nested Field
// is host-wrapped. `has-data-[state=checked]` is already a descendant :has (verbatim).
//
// STYLE-QUERY TWIN (bet 08 batch 1): `field-disabled:opacity-50` sits ALONGSIDE the
// upstream `group-data-[disabled=true]/field:opacity-50`, which stays. The two differ
// in reach, which is the point: the group token needs `data-disabled` on the field's
// own inner div (nothing sets it — dormant upstream parity, and a consumer cannot
// reach that div), while the style query answers `--field-disabled` inherited from
// ANY ancestor, including the `<ui-form-field>` host a consumer can actually style.
export const fieldLabelClasses =
  'group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50 field-disabled:opacity-50 has-[[data-slot=field]]:w-full has-[[data-slot=field]]:flex-col has-[[data-slot=field]]:rounded-md has-[[data-slot=field]]:border [&>*>[data-slot=field]]:p-4 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5 dark:has-data-[state=checked]:bg-primary/10';

export type FieldLabelProps = {
  /** The id of the control this label is bound to (renders the native `for`). */
  htmlFor?: string;
  className?: string;
  children?: string | TemplateResult;
};

const fieldLabelAttrs = {
  htmlFor: { type: 'string', attr: 'for' },
  className: 'string',
} satisfies ComponentAttrs<FieldLabelProps>;

// Renders its OWN `<label data-slot="field-label">` combining ui-label's base
// (`labelVariants`) with the field-label classes. Composing `ui-label` directly
// would carry `data-slot="label"`, but the field layout selectors key on
// `field-label` — so we reuse the class const, not the element (the file's
// dependency on ./label is the registry `label` dep).
export const FieldLabel = component<FieldLabelProps, typeof fieldLabelAttrs>(
  'ui-form-field-label',
  (props, host) => {
    transparentHost(host);
    const className = props.className;
    const classes = computed(() => cn(labelVariants, fieldLabelClasses, className.value));
    return html`<label
      data-slot="field-label"
      class="${classes}"
      for="${props.htmlFor}"
    >${children()}</label>`;
  },
  { attrs: fieldLabelAttrs },
);

// ── ui-form-field-title (non-label title, shares data-slot=field-label) ─

const fieldTitleAttrs = { className: 'string' } satisfies ComponentAttrs<FieldTextProps>;

export const FieldTitle = component<FieldTextProps, typeof fieldTitleAttrs>(
  'ui-form-field-title',
  (props, host) => {
    transparentHost(host);
    const className = props.className;
    // Same style-query twin as fieldLabelClasses: the `group-data-` token stays,
    // `field-disabled:` adds the ancestor-property path next to it.
    const classes = computed(() =>
      cn(
        'flex w-fit items-center gap-2 text-sm leading-snug font-medium group-data-[disabled=true]/field:opacity-50 field-disabled:opacity-50',
        className.value,
      ),
    );
    return html`<div data-slot="field-label" class="${classes}">${children()}</div>`;
  },
  { attrs: fieldTitleAttrs },
);

// ── ui-form-field-separator (a labeled divider) ─────────────────────

const fieldSeparatorAttrs = { className: 'string' } satisfies ComponentAttrs<FieldTextProps>;

// Composes ui-separator (the absolute line) + an optional centered content chip.
// `empty:hidden` drops the chip's background gap when there is no content; the
// `data-content` boolean is reflected after mount (parity with upstream). The
// `group-data-[variant=outline]/field-group` token is ancestor-driven — verbatim.
export const FieldSeparator = component<FieldTextProps, typeof fieldSeparatorAttrs>(
  'ui-form-field-separator',
  (props, host) => {
    transparentHost(host);
    const className = props.className;
    const slot = children();
    const classes = computed(() =>
      cn(
        'relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2',
        className.value,
      ),
    );

    const root = ref<HTMLDivElement>();
    const reflectContent = (): void => {
      const el = root.current;
      if (!el) return;
      const chip = el.querySelector('[data-slot="field-separator-content"]');
      const has = !!chip && (chip.textContent?.trim() !== '' || chip.childElementCount > 0);
      el.setAttribute('data-content', has ? 'true' : 'false');
    };
    onMount(() => {
      reflectContent();
      queueMicrotask(reflectContent); // after the projection sweep for streamed content
    });

    return html`<div
      ref="${root}"
      data-slot="field-separator"
      class="${classes}"
    >${Separator({ className: 'absolute inset-0 top-1/2' })}<span
        class="relative mx-auto block w-fit bg-background px-2 text-muted-foreground empty:hidden"
        data-slot="field-separator-content"
      >${slot}</span></div>`;
  },
  { attrs: fieldSeparatorAttrs },
);
