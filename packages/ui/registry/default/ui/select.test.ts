/**
 * select.test.ts — Select (native): rendering, options, form participation.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import { Select, selectClasses, selectIconClasses } from './select.js';
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

function getSelect(container: ParentNode = document.body): HTMLSelectElement {
  const el = container.querySelector('select');
  expect(el).not.toBeNull();
  return el as HTMLSelectElement;
}

const options = html`<option value="a">A</option><option value="b">B</option>`;

describe('Select via factory', () => {
  it('renders a native <select> in a wrapper with a chevron icon', () => {
    const c = mount(html`${Select({ children: options })}`);
    const wrapper = c.querySelector('[data-slot="native-select-wrapper"]');
    const select = getSelect(c);
    const icon = c.querySelector('[data-slot="native-select-icon"]');

    expect(wrapper).not.toBeNull();
    expect(select.getAttribute('data-slot')).toBe('native-select');
    expect(select.getAttribute('data-size')).toBe('default');
    expect(select.className).toContain('appearance-none');
    expect(select.className).toContain('border-input');
    expect(select.className).toContain('pr-9');
    expect(select.options.length).toBe(2);
    // Chevron is a real (themeable) svg element, not a background image.
    expect(icon).not.toBeNull();
    expect((icon as Element).tagName.toLowerCase()).toBe('svg');
    expect(selectIconClasses).toContain('text-muted-foreground');
    expect(selectClasses).not.toContain('data:image');
  });

  it('host is layout-transparent; the select lives in the light DOM', () => {
    const c = mount(html`${Select({ children: options })}`);
    const host = c.querySelector('ui-select') as HTMLElement;

    expect(host.style.display).toBe('contents');
    expect(host.className).toBe('');
  });

  it('applies the sm size', () => {
    const c = mount(html`${Select({ size: 'sm', children: options })}`);
    expect(getSelect(c).getAttribute('data-size')).toBe('sm');
  });

  it('selects the defaultValue and marks it as the reset target', () => {
    const c = mount(html`${Select({ defaultValue: 'b', children: options })}`);
    const select = getSelect(c);

    expect(select.value).toBe('b');
    const chosen = Array.from(select.options).find((o) => o.value === 'b');
    expect(chosen?.defaultSelected).toBe(true);
  });

  it('follows a controlled value signal reactively', () => {
    const value = signal<string | undefined>('a');
    const c = mount(html`${Select({ value, children: options })}`);
    const select = getSelect(c);
    expect(select.value).toBe('a');

    value.value = 'b';
    flushEffects();
    flushEffects();

    expect(select.value).toBe('b');
  });

  it('merges className last', () => {
    const c = mount(html`${Select({ className: 'w-64', children: options })}`);
    expect(getSelect(c).className.endsWith('w-64')).toBe(true);
  });

  it('bubbles native change events out of the light DOM', () => {
    const onChange = vi.fn();
    const c = mount(html`<div @change=${onChange}>${Select({ children: options })}</div>`);

    getSelect(c).dispatchEvent(new Event('change', { bubbles: true }));

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('Select native form participation', () => {
  it('projects plain-HTML <option> children into the inner select', async () => {
    document.body.innerHTML =
      '<ui-select name="fruit"><option value="apple">Apple</option><option value="pear">Pear</option></ui-select>';

    const select = getSelect();
    await Promise.resolve();
    expect(select.options.length).toBe(2);
    expect(select.options[0]!.value).toBe('apple');
  });

  it('forwards id/name and associates the native control with <ui-label for>', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    mount(html`<ui-label for="fruit">Fruit</ui-label>${Select({ id: 'fruit', name: 'fruit', defaultValue: 'a', children: options })}`, form);

    const select = getSelect(form);
    const label = form.querySelector('label') as HTMLLabelElement;
    expect(select.id).toBe('fruit');
    expect(form.elements.namedItem('fruit')).toBe(select);
    expect(label.htmlFor).toBe(select.id);
    expect(select.labels).toContain(label);
  });

  it('keeps ArrowDown selection and change behavior on the native control', () => {
    const onChange = vi.fn();
    const c = mount(html`<div @change=${onChange}>${Select({ defaultValue: 'a', children: options })}</div>`);
    const select = getSelect(c);
    const keydown = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });

    // happy-dom does not perform browser default actions, so model the native
    // selection step after proving Nisli did not cancel or replace it.
    expect(select.dispatchEvent(keydown)).toBe(true);
    expect(keydown.defaultPrevented).toBe(false);
    select.selectedIndex = 1;
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(select.value).toBe('b');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('forwards disabled state to the native control', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    mount(html`${Select({ name: 'fruit', disabled: true, defaultValue: 'a', children: options })}`, form);

    const select = getSelect(form);
    expect(select.disabled).toBe(true);
    expect(select.matches(':disabled')).toBe(true);
  });

  it('restores the initial selection on form.reset()', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    mount(html`${Select({ name: 'fruit', defaultValue: 'a', children: options })}`, form);

    const select = getSelect(form);
    select.value = 'b';
    expect(select.value).toBe('b');

    form.reset();
    expect(select.value).toBe('a');
  });
});

describe('Select — aria-invalid forwarding', () => {
  it('forwards factory ariaInvalid to the inner class-bearing select', () => {
    expect(getSelect(mount(html`${Select({ ariaInvalid: true, children: options })}`)).getAttribute('aria-invalid')).toBe('true');
  });

  it('reacts to live host aria-invalid changes', () => {
    const c = mount(html`${Select({ children: options })}`);
    const host = c.querySelector('ui-select') as HTMLElement;
    const select = getSelect(host);
    host.setAttribute('aria-invalid', 'true');
    flushEffects();
    expect(select.getAttribute('aria-invalid')).toBe('true');
    host.setAttribute('aria-invalid', 'false');
    flushEffects();
    expect(select.getAttribute('aria-invalid')).toBeNull();
  });
});

describe('Select — field-invalid style query (bet 08 batch 1)', () => {
  it('adds the field-invalid trio WITHOUT dropping the aria-invalid trio', () => {
    for (const token of [
      'field-invalid:border-destructive',
      'field-invalid:ring-destructive/20',
      'dark:field-invalid:ring-destructive/40',
    ]) {
      expect(selectClasses).toContain(token);
    }
    // Dual path: the attribute selectors stay until the support floor clears.
    for (const token of [
      'aria-invalid:border-destructive',
      'aria-invalid:ring-destructive/20',
      'dark:aria-invalid:ring-destructive/40',
    ]) {
      expect(selectClasses).toContain(token);
    }
  });

  it('renders both paths on the painted control', () => {
    const select = getSelect(mount(html`${Select({ children: options })}`));
    expect(select.className).toContain('field-invalid:border-destructive');
    expect(select.className).toContain('aria-invalid:border-destructive');
  });
});
