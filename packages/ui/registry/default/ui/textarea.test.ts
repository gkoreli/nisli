/**
 * textarea.test.ts — Textarea: native rendering, form participation, interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import { Textarea, textareaClasses } from './textarea.js';
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

function getTextarea(container: ParentNode = document.body): HTMLTextAreaElement {
  const el = container.querySelector('textarea');
  expect(el).not.toBeNull();
  return el as HTMLTextAreaElement;
}

describe('Textarea via factory', () => {
  it('renders a themed native <textarea> with defaults', () => {
    const c = mount(html`${Textarea({})}`);
    const ta = getTextarea(c);

    expect(ta.tagName).toBe('TEXTAREA');
    expect(ta.getAttribute('data-slot')).toBe('textarea');
    expect(ta.className).toContain('min-h-16');
    expect(ta.className).toContain('border-input');
  });

  it('host is layout-transparent; the textarea lives in the light DOM', () => {
    const c = mount(html`${Textarea({})}`);
    const host = c.querySelector('ui-textarea') as HTMLElement;

    expect(host.style.display).toBe('contents');
    expect(host.className).toBe('');
    expect(getTextarea(host).parentElement).toBe(host);
  });

  it('forwards rows/placeholder/autocomplete and boolean attrs', () => {
    const c = mount(
      html`${Textarea({
        rows: 5,
        placeholder: 'Message',
        autocomplete: 'off',
        disabled: true,
        required: true,
        readOnly: true,
        className: 'resize-none',
      })}`,
    );
    const ta = getTextarea(c);

    expect(ta.getAttribute('rows')).toBe('5');
    expect(ta.getAttribute('placeholder')).toBe('Message');
    expect(ta.getAttribute('autocomplete')).toBe('off');
    expect(ta.disabled).toBe(true);
    expect(ta.required).toBe(true);
    expect(ta.readOnly).toBe(true);
    expect(ta.className.endsWith('resize-none')).toBe(true);
  });

  it('uses the value prop as the initial value and reset target', () => {
    const c = mount(html`${Textarea({ value: 'hello' })}`);
    const ta = getTextarea(c);

    expect(ta.value).toBe('hello');
    expect(ta.defaultValue).toBe('hello');
  });

  it('applies programmatic value updates to the property', () => {
    const value = signal<string | undefined>('a');
    const c = mount(html`${Textarea({ value })}`);
    const ta = getTextarea(c);
    expect(ta.value).toBe('a');

    value.value = 'b';
    flushEffects();
    flushEffects();

    expect(ta.value).toBe('b');
  });

  it('bubbles native input events out of the light DOM', () => {
    const onInput = vi.fn();
    const c = mount(html`<div @input=${onInput}>${Textarea({})}</div>`);

    getTextarea(c).dispatchEvent(new Event('input', { bubbles: true }));

    expect(onInput).toHaveBeenCalledTimes(1);
  });
});

describe('Textarea content-as-value (native semantics)', () => {
  it('uses pre-existing child text as the initial value', () => {
    const host = document.createElement('ui-textarea');
    host.append('Initial text');
    document.body.appendChild(host);

    const ta = getTextarea(host);
    expect(ta.value).toBe('Initial text');
    expect(ta.defaultValue).toBe('Initial text');
    // The raw text node was consumed, not left dangling next to the textarea.
    expect([...host.childNodes].every((n) => n === ta)).toBe(true);
  });

  it('picks up parser-appended text on innerHTML upgrade', async () => {
    document.body.innerHTML = '<ui-textarea>Streamed body</ui-textarea>';

    const ta = getTextarea();
    await Promise.resolve();
    expect(ta.value).toBe('Streamed body');
    expect(ta.defaultValue).toBe('Streamed body');
  });

  it('lets the value prop win over child text', () => {
    const host = document.createElement('ui-textarea');
    (host as unknown as { _setProp(k: string, v: unknown): void })._setProp('value', 'from-prop');
    host.append('from-content');
    document.body.appendChild(host);

    expect(getTextarea(host).value).toBe('from-prop');
  });
});

describe('Textarea native form participation', () => {
  it('forwards id/name onto the inner control and associates with a label', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    form.innerHTML =
      '<ui-label for="bio">Bio</ui-label><ui-textarea id="bio" name="bio"></ui-textarea>';

    const ta = getTextarea(form);
    const label = form.querySelector('label') as HTMLLabelElement;

    expect(ta.id).toBe('bio');
    expect(label.control).toBe(ta);
    expect(form.elements.namedItem('bio')).toBe(ta);
  });

  it('restores the initial value on form.reset()', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    mount(html`${Textarea({ name: 'msg', value: 'draft' })}`, form);

    const ta = getTextarea(form);
    ta.value = 'edited';
    expect(ta.value).toBe('edited');

    form.reset();
    expect(ta.value).toBe('draft');
  });
});
