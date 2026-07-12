/**
 * input.test.ts — Input: native rendering, form participation, interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import { Input, inputClasses } from './input.js';
import './label.js';

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

function getInput(container: ParentNode = document.body): HTMLInputElement {
  const el = container.querySelector('input');
  expect(el).not.toBeNull();
  return el as HTMLInputElement;
}

describe('Input via factory', () => {
  it('renders a themed native <input> with defaults', () => {
    const c = mount(html`${Input({})}`);
    const input = getInput(c);

    expect(input.tagName).toBe('INPUT');
    expect(input.getAttribute('data-slot')).toBe('input');
    expect(input.getAttribute('type')).toBe('text');
    expect(input.className).toContain('rounded-md');
    expect(input.className).toContain('border-input');
  });

  it('host is layout-transparent; the input lives in the light DOM', () => {
    const c = mount(html`${Input({})}`);
    const host = c.querySelector('ui-input') as HTMLElement;

    expect(host.style.display).toBe('contents');
    expect(host.className).toBe('');
    expect(getInput(host).parentElement).toBe(host);
  });

  it('forwards type/placeholder/autocomplete and boolean attrs', () => {
    const c = mount(
      html`${Input({
        type: 'email',
        placeholder: 'you@example.com',
        autocomplete: 'email',
        disabled: true,
        required: true,
        readOnly: true,
        className: 'w-64',
      })}`,
    );
    const input = getInput(c);

    expect(input.getAttribute('type')).toBe('email');
    expect(input.getAttribute('placeholder')).toBe('you@example.com');
    expect(input.getAttribute('autocomplete')).toBe('email');
    expect(input.disabled).toBe(true);
    expect(input.required).toBe(true);
    expect(input.readOnly).toBe(true);
    expect(input.className.endsWith('w-64')).toBe(true);
  });

  it('sets the initial value as attribute and property', () => {
    const c = mount(html`${Input({ value: 'hello' })}`);
    const input = getInput(c);

    expect(input.getAttribute('value')).toBe('hello');
    expect(input.value).toBe('hello');
  });

  it('applies programmatic value updates to the property', () => {
    const value = signal<string | undefined>('a');
    const c = mount(html`${Input({ value })}`);
    const input = getInput(c);
    expect(input.value).toBe('a');

    value.value = 'b';
    // A single flushEffects() now drains the whole cascade (outer signal →
    // _setProp → internal → effect); the double-flush idiom is retired
    // (ADR 0025 §7).
    flushEffects();

    expect(input.value).toBe('b');
  });

  it('bubbles native input events out of the light DOM', () => {
    const onInput = vi.fn();
    const c = mount(html`<div @input=${onInput}>${Input({})}</div>`);

    getInput(c).dispatchEvent(new Event('input', { bubbles: true }));

    expect(onInput).toHaveBeenCalledTimes(1);
  });
});

describe('Input native form participation', () => {
  it('forwards id/name onto the inner control, moving them off the host', () => {
    const host = document.createElement('ui-input');
    host.setAttribute('id', 'email');
    host.setAttribute('name', 'email');
    document.body.appendChild(host);

    const input = getInput(host);
    expect(input.id).toBe('email');
    expect(input.getAttribute('name')).toBe('email');
    // Moved off the host so the id isn't duplicated.
    expect(host.hasAttribute('id')).toBe(false);
    expect(host.hasAttribute('name')).toBe(false);
  });

  it('associates with <ui-label for> and appears in form.elements', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    form.innerHTML =
      '<ui-label for="email">Email</ui-label><ui-input id="email" name="email"></ui-input>';

    const input = getInput(form);
    const label = form.querySelector('label') as HTMLLabelElement;

    expect(label.htmlFor).toBe('email');
    expect(label.control).toBe(input);
    expect(form.elements.namedItem('email')).toBe(input);
  });

  it('restores the initial value on form.reset()', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    mount(html`${Input({ name: 'q', value: 'initial' })}`, form);

    const input = getInput(form);
    expect(input.value).toBe('initial');

    input.value = 'typed by user';
    expect(input.value).toBe('typed by user');

    form.reset();
    expect(input.value).toBe('initial');
  });

  it('explicit prop wins over host attribute for forwarded id', () => {
    const host = document.createElement('ui-input');
    host.setAttribute('id', 'from-attr');
    (host as unknown as { _setProp(k: string, v: unknown): void })._setProp('id', 'from-prop');
    document.body.appendChild(host);

    expect(getInput(host).id).toBe('from-prop');
  });
});
