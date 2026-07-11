/**
 * switch.test.ts — Switch: native rendering, form participation, interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import { Switch, switchControlClasses, switchThumbClasses } from './switch.js';
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
  const el = container.querySelector('input[type="checkbox"]');
  expect(el).not.toBeNull();
  return el as HTMLInputElement;
}

describe('Switch via factory', () => {
  it('renders a native checkbox with role=switch and a thumb', () => {
    const c = mount(html`${Switch({})}`);
    const input = getInput(c);
    const wrapper = c.querySelector('[data-slot="switch-wrapper"]');
    const thumb = c.querySelector('[data-slot="switch-thumb"]');

    expect(input.type).toBe('checkbox');
    expect(input.getAttribute('role')).toBe('switch');
    expect(input.getAttribute('data-slot')).toBe('switch');
    expect(input.className).toContain('peer');
    expect(input.className).toContain('rounded-full');
    expect(wrapper).not.toBeNull();
    expect(thumb).not.toBeNull();
    // The thumb is a sibling after the peer input, and takes no pointer events.
    expect(input.nextElementSibling).toBe(thumb);
    expect(switchThumbClasses).toContain('peer-checked:translate-x-4');
    expect(switchThumbClasses).toContain('pointer-events-none');
  });

  it('host is layout-transparent; the control lives in the light DOM', () => {
    const c = mount(html`${Switch({})}`);
    const host = c.querySelector('ui-switch') as HTMLElement;

    expect(host.style.display).toBe('contents');
    expect(host.className).toBe('');
    expect(getInput(host).checked).toBe(false);
  });

  it('merges className into the track (the input), not the wrapper', () => {
    const c = mount(html`${Switch({ className: 'h-6 w-11' })}`);
    const input = getInput(c);
    const wrapper = c.querySelector('[data-slot="switch-wrapper"]') as HTMLElement;

    const expected = new Set(`${switchControlClasses} h-6 w-11`.split(/\s+/));
    expect(new Set(input.className.split(/\s+/))).toEqual(expected);
    expect(input.className.endsWith('h-6 w-11')).toBe(true);
    expect(wrapper.className).not.toContain('w-11');
  });

  it('reflects the initial checked prop and sets the reset target', () => {
    const c = mount(html`${Switch({ checked: true })}`);
    const input = getInput(c);

    expect(input.checked).toBe(true);
    expect(input.defaultChecked).toBe(true);
  });

  it('applies programmatic checked updates to the property', () => {
    const checked = signal<boolean | undefined>(false);
    const c = mount(html`${Switch({ checked })}`);
    const input = getInput(c);
    expect(input.checked).toBe(false);

    checked.value = true;
    flushEffects();
    flushEffects();

    expect(input.checked).toBe(true);
  });

  it('forwards disabled/required and a submitted value', () => {
    const c = mount(html`${Switch({ disabled: true, required: true, value: 'on' })}`);
    const input = getInput(c);

    expect(input.disabled).toBe(true);
    expect(input.required).toBe(true);
    expect(input.getAttribute('value')).toBe('on');
  });

  it('bubbles native change events out of the light DOM', () => {
    const onChange = vi.fn();
    const c = mount(html`<div @change=${onChange}>${Switch({})}</div>`);

    getInput(c).dispatchEvent(new Event('change', { bubbles: true }));

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('Switch native form participation', () => {
  it('toggles on click (free native checkbox behavior)', () => {
    const c = mount(html`${Switch({})}`);
    const input = getInput(c);

    input.click();
    expect(input.checked).toBe(true);
  });

  it('forwards id/name and associates with <ui-label for> in a form', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    form.innerHTML =
      '<ui-label for="notify">Notify</ui-label><ui-switch id="notify" name="notify"></ui-switch>';

    const input = getInput(form);
    const label = form.querySelector('label') as HTMLLabelElement;

    expect(input.id).toBe('notify');
    expect(label.control).toBe(input);
    expect(form.elements.namedItem('notify')).toBe(input);
  });

  it('restores the initial checked state on form.reset()', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    mount(html`${Switch({ name: 'notify', checked: true })}`, form);

    const input = getInput(form);
    input.checked = false;
    expect(input.checked).toBe(false);

    form.reset();
    expect(input.checked).toBe(true);
  });

  it('explicit prop wins over host attribute', () => {
    const host = document.createElement('ui-switch');
    host.setAttribute('checked', '');
    (host as unknown as { _setProp(k: string, v: unknown): void })._setProp('checked', false);
    document.body.appendChild(host);

    expect(getInput(host).checked).toBe(false);
  });
});
