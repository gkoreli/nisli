/**
 * form-field.test.ts — FormField a11y wiring + FieldDescription/FieldError.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import { FormField, FieldDescription, FieldError, fieldErrorClasses } from './form-field.js';
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
