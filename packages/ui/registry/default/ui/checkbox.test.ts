/**
 * checkbox.test.ts — Checkbox: native rendering, form participation, interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import { Checkbox, checkboxClasses } from './checkbox.js';
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

function getBox(container: ParentNode = document.body): HTMLInputElement {
  const el = container.querySelector('input[type="checkbox"]');
  expect(el).not.toBeNull();
  return el as HTMLInputElement;
}

describe('Checkbox via factory', () => {
  it('renders a native checkbox with the appearance-none visual', () => {
    const c = mount(html`${Checkbox({})}`);
    const box = getBox(c);

    expect(box.tagName).toBe('INPUT');
    expect(box.type).toBe('checkbox');
    expect(box.getAttribute('data-slot')).toBe('checkbox');
    expect(box.className).toContain('appearance-none');
    expect(box.className).toContain('rounded-[4px]');
    expect(box.checked).toBe(false);
  });

  it('draws the check glyph with pure CSS, not a script or child node', () => {
    const c = mount(html`${Checkbox({ checked: true })}`);
    const box = getBox(c);

    // The indicator is a checked: background-image data-URI, no child nodes.
    expect(checkboxClasses).toContain('checked:bg-primary');
    expect(checkboxClasses).toContain('data:image/svg+xml');
    expect(box.childNodes.length).toBe(0);
  });

  it('host is layout-transparent; the checkbox lives in the light DOM', () => {
    const c = mount(html`${Checkbox({})}`);
    const host = c.querySelector('ui-checkbox') as HTMLElement;

    expect(host.style.display).toBe('contents');
    expect(host.className).toBe('');
    expect(getBox(host).parentElement).toBe(host);
  });

  it('reflects the initial checked prop and sets the reset target', () => {
    const c = mount(html`${Checkbox({ checked: true })}`);
    const box = getBox(c);

    expect(box.checked).toBe(true);
    expect(box.defaultChecked).toBe(true);
  });

  it('applies programmatic checked updates to the property', () => {
    const checked = signal<boolean | undefined>(false);
    const c = mount(html`${Checkbox({ checked })}`);
    const box = getBox(c);
    expect(box.checked).toBe(false);

    checked.value = true;
    flushEffects();
    flushEffects();

    expect(box.checked).toBe(true);
  });

  it('forwards disabled/required and a submitted value', () => {
    const c = mount(html`${Checkbox({ disabled: true, required: true, value: 'yes' })}`);
    const box = getBox(c);

    expect(box.disabled).toBe(true);
    expect(box.required).toBe(true);
    expect(box.getAttribute('value')).toBe('yes');
  });

  it('bubbles native change events out of the light DOM', () => {
    const onChange = vi.fn();
    const c = mount(html`<div @change=${onChange}>${Checkbox({})}</div>`);

    getBox(c).dispatchEvent(new Event('change', { bubbles: true }));

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('Checkbox native form participation', () => {
  it('toggles with the spacebar (free native keyboard behavior)', () => {
    const c = mount(html`${Checkbox({})}`);
    const box = getBox(c);
    expect(box.checked).toBe(false);

    // The platform toggles a checkbox on click/space; simulate the result.
    box.click();
    expect(box.checked).toBe(true);
  });

  it('forwards id/name and associates with <ui-label for> in a form', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    form.innerHTML =
      '<ui-label for="tos">Accept</ui-label><ui-checkbox id="tos" name="tos"></ui-checkbox>';

    const box = getBox(form);
    const label = form.querySelector('label') as HTMLLabelElement;

    expect(box.id).toBe('tos');
    expect(label.control).toBe(box);
    expect(form.elements.namedItem('tos')).toBe(box);
  });

  it('restores the initial checked state on form.reset()', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    mount(html`${Checkbox({ name: 'tos', checked: true })}`, form);

    const box = getBox(form);
    box.checked = false;
    expect(box.checked).toBe(false);

    form.reset();
    expect(box.checked).toBe(true);
  });

  it('reads checked from a bare host attribute (plain HTML)', () => {
    const host = document.createElement('ui-checkbox');
    host.setAttribute('checked', '');
    document.body.appendChild(host);

    expect(getBox(host).checked).toBe(true);
  });

  it('explicit prop wins over host attribute', () => {
    const host = document.createElement('ui-checkbox');
    host.setAttribute('checked', '');
    (host as unknown as { _setProp(k: string, v: unknown): void })._setProp('checked', false);
    document.body.appendChild(host);

    expect(getBox(host).checked).toBe(false);
  });
});

describe('Checkbox data-state reflection', () => {
  it('reflects unchecked + data-disabled by default when disabled', () => {
    const c = mount(html`${Checkbox({ disabled: true })}`);
    const box = getBox(c);
    expect(box.getAttribute('data-state')).toBe('unchecked');
    expect(box.hasAttribute('data-disabled')).toBe(true);
  });

  it('reflects checked state and omits data-disabled when enabled', () => {
    const c = mount(html`${Checkbox({ checked: true })}`);
    const box = getBox(c);
    expect(box.getAttribute('data-state')).toBe('checked');
    expect(box.hasAttribute('data-disabled')).toBe(false);
  });

  it('updates data-state on native change', () => {
    const c = mount(html`${Checkbox({})}`);
    const box = getBox(c);
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    flushEffects();
    expect(box.getAttribute('data-state')).toBe('checked');
  });

  it('follows the checked signal', () => {
    const checked = signal<boolean | undefined>(false);
    const c = mount(html`${Checkbox({ checked })}`);
    const box = getBox(c);
    expect(box.getAttribute('data-state')).toBe('unchecked');
    checked.value = true;
    flushEffects();
    flushEffects();
    flushEffects();
    expect(box.getAttribute('data-state')).toBe('checked');
  });
});

describe('Checkbox — aria-invalid forwarding', () => {
  it('forwards factory ariaInvalid to the inner class-bearing checkbox', () => {
    expect(getBox(mount(html`${Checkbox({ ariaInvalid: true })}`)).getAttribute('aria-invalid')).toBe('true');
  });

  it('reacts to live host aria-invalid changes', () => {
    const c = mount(html`${Checkbox({})}`);
    const host = c.querySelector('ui-checkbox') as HTMLElement;
    const box = getBox(host);
    host.setAttribute('aria-invalid', 'true');
    flushEffects();
    expect(box.getAttribute('aria-invalid')).toBe('true');
    host.setAttribute('aria-invalid', 'false');
    flushEffects();
    expect(box.getAttribute('aria-invalid')).toBeNull();
  });
});
