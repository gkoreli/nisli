/**
 * form-field.test.ts — FormField a11y wiring + FieldDescription/FieldError.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  FormField,
  FieldDescription,
  FieldError,
  fieldErrorClasses,
  FieldGroup,
  FieldContent,
  FieldSet,
  FieldLegend,
  FieldLabel,
  FieldTitle,
  FieldSeparator,
} from './form-field.js';
import { Label } from './label.js';
import { Input } from './input.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

/** Mount a template into a connected container and return it. */
function mount(template: TemplateResult, into: HTMLElement = document.body): HTMLElement {
  const container = document.createElement('div');
  into.appendChild(container);
  template.mount(container);
  return container;
}

function field(container: ParentNode = document.body): HTMLElement {
  const el = container.querySelector('[data-slot="field"]');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

/** A field with label + input + description + error. */
function fullField(props: Record<string, unknown> = {}): HTMLElement {
  return mount(
    html`${FormField({
      ...props,
      children: html`${Label({ children: 'Email' })}${Input({ type: 'email' })}${FieldDescription(
        { children: "We'll never share it." },
      )}${FieldError({ children: 'Enter a valid email.' })}`,
    })}`,
  );
}

describe('FormField structure', () => {
  it('renders a role=group field with defaults', () => {
    const c = mount(html`${FormField({ children: 'x' })}`);
    const f = field(c);

    expect(f.tagName).toBe('DIV');
    expect(f.getAttribute('role')).toBe('group');
    expect(f.getAttribute('data-slot')).toBe('field');
    expect(f.getAttribute('data-orientation')).toBe('vertical');
    expect(f.className).toContain('flex-col');
    expect(f.hasAttribute('data-invalid')).toBe(false);
  });

  it('host is layout-transparent', () => {
    const c = mount(html`${FormField({ children: 'x' })}`);
    const host = c.querySelector('ui-form-field') as HTMLElement;
    expect(host.style.display).toBe('contents');
    expect(host.className).toBe('');
  });

  it('applies the horizontal orientation', () => {
    const c = mount(html`${FormField({ orientation: 'horizontal', children: 'x' })}`);
    const f = field(c);
    expect(f.getAttribute('data-orientation')).toBe('horizontal');
    expect(f.className).toContain('flex-row');
  });
});

describe('FormField a11y wiring', () => {
  it('associates label with control and points aria-describedby at desc + error', async () => {
    const c = fullField();
    await Promise.resolve();

    const f = field(c);
    const label = f.querySelector('label') as HTMLLabelElement;
    const input = f.querySelector('input') as HTMLInputElement;
    const desc = f.querySelector('[data-slot="field-description"]') as HTMLElement;
    const err = f.querySelector('[data-slot="field-error"]') as HTMLElement;

    // Control got a generated id; label points at it (native association).
    expect(input.id).not.toBe('');
    expect(label.htmlFor).toBe(input.id);
    expect(label.control).toBe(input);

    // Description and error got ids; the control is described by both.
    expect(desc.id).not.toBe('');
    expect(err.id).not.toBe('');
    expect(input.getAttribute('aria-describedby')).toBe(`${desc.id} ${err.id}`);
  });

  it('respects a consumer-set control id instead of generating one', async () => {
    const c = mount(
      html`${FormField({
        children: html`${Label({ children: 'Name' })}${Input({ id: 'my-name' })}`,
      })}`,
    );
    await Promise.resolve();

    const f = field(c);
    expect((f.querySelector('input') as HTMLInputElement).id).toBe('my-name');
    expect((f.querySelector('label') as HTMLLabelElement).htmlFor).toBe('my-name');
  });

  it('reflects invalid onto data-invalid (field) and aria-invalid (control), reactively', async () => {
    const invalid = signal<boolean | undefined>(false);
    const c = mount(
      html`${FormField({
        invalid,
        children: html`${Label({ children: 'Email' })}${Input({ type: 'email' })}`,
      })}`,
    );
    await Promise.resolve();

    const f = field(c);
    const input = f.querySelector('input') as HTMLInputElement;
    expect(f.hasAttribute('data-invalid')).toBe(false);
    expect(input.hasAttribute('aria-invalid')).toBe(false);

    invalid.value = true;
    flushEffects();
    flushEffects();

    expect(f.getAttribute('data-invalid')).toBe('true');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('wires a plain-HTML field parsed from innerHTML', async () => {
    document.body.innerHTML =
      '<ui-form-field><ui-label>Email</ui-label><ui-input type="email"></ui-input><ui-form-field-error>Bad</ui-form-field-error></ui-form-field>';

    // Let projection + wiring microtasks settle.
    await Promise.resolve();
    await Promise.resolve();

    const f = field();
    const label = f.querySelector('label') as HTMLLabelElement;
    const input = f.querySelector('input') as HTMLInputElement;
    const err = f.querySelector('[data-slot="field-error"]') as HTMLElement;

    expect(label.control).toBe(input);
    expect(input.getAttribute('aria-describedby')).toBe(err.id);
  });
});

describe('FieldDescription / FieldError', () => {
  it('render their slots and classes', () => {
    const d = mount(html`${FieldDescription({ children: 'hint' })}`);
    const desc = d.querySelector('[data-slot="field-description"]') as HTMLElement;
    expect(desc.tagName).toBe('P');
    expect(desc.className).toContain('text-muted-foreground');

    const e = mount(html`${FieldError({ children: 'oops' })}`);
    const err = e.querySelector('[data-slot="field-error"]') as HTMLElement;
    expect(err.getAttribute('role')).toBe('alert');
    expect(err.className).toBe(fieldErrorClasses);
    expect(err.textContent).toBe('oops');
  });
});

// ── UI-52: the field layout family ──────────────────────────────────

const bySlot = (slot: string, root: ParentNode = document.body): HTMLElement => {
  const el = root.querySelector(`[data-slot="${slot}"]`);
  expect(el, `[data-slot="${slot}"]`).not.toBeNull();
  return el as HTMLElement;
};

describe('FieldGroup — container-query root (arch physics)', () => {
  it('puts @container/field-group on the BOXED inner div, never the transparent host', () => {
    const c = mount(html`${FieldGroup({ children: '' })}`);
    const groupHost = c.querySelector('ui-form-field-group') as HTMLElement;
    const groupDiv = bySlot('field-group', c);
    // The host is layout-transparent (display:contents → no box → cannot be a container).
    expect(groupHost.style.display).toBe('contents');
    expect(groupHost.className).toBe(''); // container class is NOT on the boxless host
    // The @container declaration + its box live on the inner div.
    expect(groupDiv.tagName).toBe('DIV');
    expect(groupDiv.className).toContain('@container/field-group');
    expect(groupDiv.className).toContain('flex');
    expect(groupDiv.className).toContain('flex-col');
  });

  it('a Field inside the group carries the responsive container-query tokens', () => {
    // NOTE: happy-dom has no layout engine, so it cannot EVALUATE `@container`
    // (the actual width-driven flip is browser-verify-gated, shared visual gate).
    // Here we prove the structural prerequisites: container on the boxed group div
    // + the `@md/field-group:` tokens present on a responsive Field descendant.
    const c = mount(
      html`${FieldGroup({
        children: FormField({ orientation: 'responsive', children: 'x' }),
      })}`,
    );
    bySlot('field-group', c); // container present
    const fieldDiv = bySlot('field', c);
    expect(fieldDiv.getAttribute('data-orientation')).toBe('responsive');
    expect(fieldDiv.className).toContain('@md/field-group:flex-row');
    expect(fieldDiv.className).toContain('@md/field-group:items-center');
  });
});

describe('FormField orientation (UI-52 responsive + horizontal token)', () => {
  it('responsive orientation reflects data-orientation + flip tokens', () => {
    const c = mount(html`${FormField({ orientation: 'responsive', children: 'x' })}`);
    const f = bySlot('field', c);
    expect(f.getAttribute('data-orientation')).toBe('responsive');
    expect(f.className).toContain('flex-col');
    expect(f.className).toContain('@md/field-group:flex-row');
  });

  it('horizontal retargets the checkbox/radio alignment token to NATIVE data-slots (not Radix role=)', () => {
    const c = mount(html`${FormField({ orientation: 'horizontal', children: 'x' })}`);
    const f = bySlot('field', c);
    expect(f.getAttribute('data-orientation')).toBe('horizontal');
    // Native-first retarget: keyed on our checkbox/radio-group-item data-slots,
    // reached through the transparent host (`[&>*>[data-slot=…]]`), not `[role=checkbox]`.
    expect(f.className).toContain('has-[[data-slot=field-content]]:[&>*>[data-slot=checkbox]]:mt-px');
    expect(f.className).toContain('has-[[data-slot=field-content]]:[&>*>[data-slot=radio-group-item]]:mt-px');
    expect(f.className).not.toContain('role=checkbox');
  });

  it('unknown orientation falls back to vertical', () => {
    const c = mount(html`${FormField({ orientation: 'sideways' as never, children: 'x' })}`);
    expect(bySlot('field', c).getAttribute('data-orientation')).toBe('vertical');
  });
});

describe('FieldContent / FieldSet / FieldLegend / FieldTitle', () => {
  it('FieldContent groups a control column', () => {
    const c = mount(html`${FieldContent({ children: 'x' })}`);
    const el = bySlot('field-content', c);
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('flex-1');
    expect(el.className).toContain('flex-col');
  });

  it('FieldSet renders a native <fieldset> and FieldLegend a native <legend>', () => {
    const c = mount(
      html`${FieldSet({
        children: html`${FieldLegend({ children: 'Address' })}`,
      })}`,
    );
    const set = bySlot('field-set', c);
    expect(set.tagName).toBe('FIELDSET');
    const legend = bySlot('field-legend', c);
    expect(legend.tagName).toBe('LEGEND');
    expect(legend.getAttribute('data-variant')).toBe('legend'); // default
    expect(legend.textContent).toBe('Address');
    // The legend is a DESCENDANT of the fieldset, but through its layout-transparent
    // ui-form-field-legend host it is NOT a direct child — so the native fieldset→
    // legend caption/naming relationship (which requires directness) does not attach.
    // The a11y grouping is instead wired explicitly (aria-labelledby, below).
    expect(set.contains(legend)).toBe(true);
    expect(legend.parentElement?.tagName).toBe('UI-FORM-FIELD-LEGEND');
    // Explicit naming restores the group→legend a11y the transparent host broke.
    flushEffects();
    expect(legend.id).not.toBe('');
    expect(set.getAttribute('aria-labelledby')).toBe(legend.id);
  });

  it('finds a LATE / plain custom-element legend after projection microtasks and names the group', async () => {
    // Plain (NON-factory) markup parsed from innerHTML: the legend projects via the
    // framework's late-parser sweep, AFTER FieldSet's own onMount registers. Because
    // children() is hoisted before onMount, wireLegend's queued re-run is ordered
    // after projection settles, so the streamed legend is still found + wired.
    document.body.innerHTML =
      '<ui-form-field-set><ui-form-field-legend>Shipping</ui-form-field-legend></ui-form-field-set>';
    await Promise.resolve();
    await Promise.resolve();
    flushEffects();

    const set = bySlot('field-set');
    const legend = bySlot('field-legend');
    expect(legend.textContent).toBe('Shipping');
    expect(legend.id).not.toBe('');
    expect(set.getAttribute('aria-labelledby')).toBe(legend.id);
  });

  it('a consumer ariaLabelledby prop WINS over the auto-wired legend (factory)', () => {
    const c = mount(
      html`${FieldSet({
        ariaLabelledby: 'external-heading',
        children: html`${FieldLegend({ children: 'Not used for naming' })}`,
      })}`,
    );
    flushEffects();
    const set = bySlot('field-set', c);
    const legend = bySlot('field-legend', c);
    expect(set.getAttribute('aria-labelledby')).toBe('external-heading');
    expect(set.getAttribute('aria-labelledby')).not.toBe(legend.id);
  });

  it('a post-mount aria-labelledby write takes over live (declared attr)', async () => {
    document.body.innerHTML =
      '<ui-form-field-set><ui-form-field-legend>Grp</ui-form-field-legend></ui-form-field-set>';
    await Promise.resolve();
    await Promise.resolve();
    flushEffects();
    const host = document.body.querySelector('ui-form-field-set') as HTMLElement;
    const set = bySlot('field-set');
    expect(set.getAttribute('aria-labelledby')).toBe(bySlot('field-legend').id); // legend-named
    host.setAttribute('aria-labelledby', 'custom-id'); // consumer wins, live
    flushEffects();
    expect(set.getAttribute('aria-labelledby')).toBe('custom-id');
  });

  it('single writer CLEARS a stale aria-labelledby when both sources go absent (no legend)', async () => {
    // No legend inside → nothing to auto-wire.
    document.body.innerHTML = '<ui-form-field-set></ui-form-field-set>';
    await Promise.resolve();
    await Promise.resolve();
    flushEffects();
    const host = document.body.querySelector('ui-form-field-set') as HTMLElement;
    const set = bySlot('field-set');
    expect(set.hasAttribute('aria-labelledby')).toBe(false); // no legend, no consumer
    // Consumer sets it post-mount → the inner fieldset receives it.
    host.setAttribute('aria-labelledby', 'external');
    flushEffects();
    expect(set.getAttribute('aria-labelledby')).toBe('external');
    // Consumer removes it → the single writer clears it; no stale value lingers.
    host.removeAttribute('aria-labelledby');
    flushEffects();
    expect(set.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('FieldLegend variant=label switches the data-variant + size token', () => {
    const c = mount(html`${FieldLegend({ variant: 'label', children: 'Small' })}`);
    const legend = bySlot('field-legend', c);
    expect(legend.getAttribute('data-variant')).toBe('label');
    expect(legend.className).toContain('data-[variant=label]:text-sm');
  });

  it('FieldTitle is a non-label element sharing data-slot=field-label', () => {
    const c = mount(html`${FieldTitle({ children: 'Title' })}`);
    const el = bySlot('field-label', c);
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('font-medium');
  });
});

describe('FieldLabel', () => {
  it('renders a <label data-slot=field-label> combining label base + field-label classes', () => {
    const c = mount(html`${FieldLabel({ htmlFor: 'email', children: 'Email' })}`);
    const label = bySlot('field-label', c);
    expect(label.tagName).toBe('LABEL');
    expect(label.getAttribute('for')).toBe('email'); // native association
    expect(label.className).toContain('font-medium'); // labelVariants base
    expect(label.className).toContain('group/field-label'); // field-label classes
    // Card-nesting selectors are translated to descendant form (host-wrapped field).
    expect(label.className).toContain('has-[[data-slot=field]]:border');
    expect(label.className).toContain('[&>*>[data-slot=field]]:p-4');
  });
});

describe('FieldSeparator', () => {
  it('renders a separator line + a content chip, reflecting data-content=true', () => {
    const c = mount(html`${FieldSeparator({ children: 'OR' })}`);
    const sep = bySlot('field-separator', c);
    expect(sep.tagName).toBe('DIV');
    expect(sep.querySelector('ui-separator')).not.toBeNull(); // composes ui-separator
    const chip = bySlot('field-separator-content', c);
    expect(chip.textContent).toBe('OR');
    expect(chip.className).toContain('empty:hidden');
    expect(sep.getAttribute('data-content')).toBe('true');
  });

  it('reflects data-content=false when there is no content', () => {
    const c = mount(html`${FieldSeparator({ children: '' })}`);
    const sep = bySlot('field-separator', c);
    expect(sep.getAttribute('data-content')).toBe('false');
  });
});
