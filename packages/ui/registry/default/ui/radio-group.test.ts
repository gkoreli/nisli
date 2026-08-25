/**
 * radio-group.test.ts — RadioGroup / RadioGroupItem: native radios, form
 * participation, parent/child wiring.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import { RadioGroup, RadioGroupItem, radioItemClasses } from './radio-group.js';
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

function radios(
  container: ParentNode = document.body,
): [HTMLInputElement, HTMLInputElement, ...HTMLInputElement[]] {
  return Array.from(container.querySelectorAll('input[type="radio"]')) as [
    HTMLInputElement,
    HTMLInputElement,
    ...HTMLInputElement[],
  ];
}

/** A two-item group; returns its container. */
function group(props: Record<string, unknown> = {}, into?: HTMLElement): HTMLElement {
  return mount(
    html`${RadioGroup({
      ...props,
      children: html`${RadioGroupItem({ value: 'a', id: 'opt-a' })}${RadioGroupItem({
        value: 'b',
        id: 'opt-b',
      })}`,
    })}`,
    into,
  );
}

describe('RadioGroup via factory', () => {
  it('renders a radiogroup of native radios that share a name', () => {
    const c = group({ name: 'plan' });
    const rg = c.querySelector('[data-slot="radio-group"]') as HTMLElement;
    const [a, b] = radios(c);

    expect(rg.getAttribute('role')).toBe('radiogroup');
    expect(a.type).toBe('radio');
    expect(a.getAttribute('data-slot')).toBe('radio-group-item');
    expect(a.name).toBe('plan');
    expect(b.name).toBe('plan');
    expect(a.className).toContain('appearance-none');
    expect(a.className).toContain('rounded-full');
  });

  it('draws the dot with a themeable pure-CSS radial gradient', () => {
    expect(radioItemClasses).toContain('checked:bg-[radial-gradient');
    expect(radioItemClasses).toContain('currentColor');
    expect(radioItemClasses).toContain('text-primary');
  });

  it('hosts are layout-transparent; radios live in the light DOM', () => {
    const c = group();
    expect((c.querySelector('ui-radio-group') as HTMLElement).style.display).toBe('contents');
    expect((c.querySelector('ui-radio-group-item') as HTMLElement).style.display).toBe(
      'contents',
    );
  });

  it('selects the item matching a controlled value', () => {
    const c = group({ value: 'b' });
    const [a, b] = radios(c);

    expect(b.checked).toBe(true);
    expect(a.checked).toBe(false);
  });

  it('updates selection and unselects siblings when an item is chosen', () => {
    const c = group({ name: 'plan' });
    const [a, b] = radios(c);

    a.click();
    flushEffects();
    flushEffects();
    expect(a.checked).toBe(true);
    expect(b.checked).toBe(false);

    b.click();
    flushEffects();
    flushEffects();
    expect(b.checked).toBe(true);
    expect(a.checked).toBe(false);
  });

  it('dispatches a bubbling ui-value-change with the new value', () => {
    const onChange = vi.fn();
    const c = group({ name: 'plan' });
    (c.querySelector('ui-radio-group') as HTMLElement).addEventListener(
      'ui-value-change',
      (e) => onChange((e as CustomEvent).detail),
    );

    radios(c)[1].click();
    flushEffects();

    expect(onChange).toHaveBeenCalledWith({ value: 'b' });
  });

  it('follows a controlled value signal reactively', () => {
    const value = signal<string | undefined>('a');
    const c = mount(
      html`${RadioGroup({
        value,
        children: html`${RadioGroupItem({ value: 'a' })}${RadioGroupItem({ value: 'b' })}`,
      })}`,
    );
    const [a, b] = radios(c);
    expect(a.checked).toBe(true);

    value.value = 'b';
    flushEffects();
    flushEffects();

    expect(b.checked).toBe(true);
    expect(a.checked).toBe(false);
  });

  it('disables every item when the group is disabled', () => {
    const c = group({ disabled: true });
    for (const r of radios(c)) expect(r.disabled).toBe(true);
  });
});

describe('RadioGroup native form participation', () => {
  it('exposes a single grouped value via form.elements', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    group({ name: 'plan', defaultValue: 'a' }, form);

    const list = form.elements.namedItem('plan') as RadioNodeList;
    expect(list.value).toBe('a');

    radios(form)[1].click();
    flushEffects();
    flushEffects();
    expect((form.elements.namedItem('plan') as RadioNodeList).value).toBe('b');
  });

  it('restores the initial selection on form.reset()', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    group({ name: 'plan', defaultValue: 'a' }, form);

    radios(form)[1].click();
    flushEffects();
    flushEffects();
    expect((form.elements.namedItem('plan') as RadioNodeList).value).toBe('b');

    form.reset();
    expect((form.elements.namedItem('plan') as RadioNodeList).value).toBe('a');
  });

  it('forwards item id onto the radio and associates with <ui-label for>', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    form.innerHTML =
      '<ui-radio-group name="plan"><ui-label for="opt-a">A</ui-label><ui-radio-group-item value="a" id="opt-a"></ui-radio-group-item></ui-radio-group>';

    const radio = form.querySelector('#opt-a') as HTMLInputElement;
    const label = form.querySelector('label') as HTMLLabelElement;
    expect(radio.tagName).toBe('INPUT');
    expect(radio.type).toBe('radio');
    expect(label.control).toBe(radio);
  });
});

describe('RadioGroupItem outside a group', () => {
  it('renders the setup error boundary instead of a stray radio', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = mount(html`${RadioGroupItem({ value: 'x' })}`);

    expect(c.querySelector('input[type="radio"]')).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('RadioGroupItem — aria-invalid forwarding', () => {
  const invalidGroup = (ariaInvalid?: boolean): HTMLElement => mount(html`${RadioGroup({
    children: RadioGroupItem({ value: 'a', ariaInvalid }),
  })}`);

  it('forwards factory ariaInvalid to the inner class-bearing radio', () => {
    expect(radios(invalidGroup(true))[0].getAttribute('aria-invalid')).toBe('true');
  });

  it('reacts to live item-host aria-invalid changes', () => {
    const c = invalidGroup();
    const host = c.querySelector('ui-radio-group-item') as HTMLElement;
    const radio = c.querySelector('input[type="radio"]') as HTMLInputElement;
    host.setAttribute('aria-invalid', 'true');
    flushEffects();
    expect(radio.getAttribute('aria-invalid')).toBe('true');
    host.setAttribute('aria-invalid', 'false');
    flushEffects();
    expect(radio.getAttribute('aria-invalid')).toBeNull();
  });
});

describe('RadioGroupItem — field-invalid style query (bet 08 batch 1)', () => {
  it('adds the field-invalid trio WITHOUT dropping the aria-invalid trio', () => {
    for (const token of [
      'field-invalid:border-destructive',
      'field-invalid:ring-destructive/20',
      'dark:field-invalid:ring-destructive/40',
    ]) {
      expect(radioItemClasses).toContain(token);
    }
    // Dual path: the attribute selectors stay until the support floor clears.
    for (const token of [
      'aria-invalid:border-destructive',
      'aria-invalid:ring-destructive/20',
      'dark:aria-invalid:ring-destructive/40',
    ]) {
      expect(radioItemClasses).toContain(token);
    }
  });

  it('renders both paths on the painted control', () => {
    const radio = radios(group())[0];
    expect(radio.className).toContain('field-invalid:border-destructive');
    expect(radio.className).toContain('aria-invalid:border-destructive');
  });
});
