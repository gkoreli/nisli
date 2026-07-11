/**
 * label.test.ts — Label component rendering and interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import { Label } from './label.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

/** Mount a template into a connected container and return it. */
function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function getLabel(container: ParentNode = document.body): HTMLLabelElement {
  const el = container.querySelector('label');
  expect(el).not.toBeNull();
  return el as HTMLLabelElement;
}

describe('Label via factory', () => {
  it('renders a real <label> with defaults', () => {
    const c = mount(html`${Label({ children: 'Email' })}`);
    const label = getLabel(c);

    expect(label.tagName).toBe('LABEL');
    expect(label.textContent).toBe('Email');
    expect(label.getAttribute('data-slot')).toBe('label');
    expect(label.className).toContain('text-sm');
    expect(label.className).toContain('font-medium');
    // No htmlFor → no `for` attribute rendered.
    expect(label.hasAttribute('for')).toBe(false);
  });

  it('host is layout-transparent; styling lives on the inner label', () => {
    const c = mount(html`${Label({ children: 'Email' })}`);
    const host = c.querySelector('ui-label') as HTMLElement;

    expect(host).not.toBeNull();
    expect(host.style.display).toBe('contents');
    expect(host.className).toBe('');
    expect(getLabel(host).parentElement).toBe(host);
  });

  it('renders htmlFor as a native `for` attribute, merging className last', () => {
    const c = mount(
      html`${Label({ htmlFor: 'email', className: 'sr-only', children: 'Email' })}`,
    );
    const label = getLabel(c);

    expect(label.getAttribute('for')).toBe('email');
    expect(label.className.endsWith('sr-only')).toBe(true);
  });

  it('associates with a control so clicking the label focuses it', () => {
    const input = document.createElement('input');
    input.id = 'email';
    document.body.appendChild(input);
    const c = mount(html`${Label({ htmlFor: 'email', children: 'Email' })}`);

    expect(getLabel(c).htmlFor).toBe('email');
    expect(getLabel(c).control).toBe(input);
  });

  it('updates htmlFor reactively when its signal changes', () => {
    const htmlFor = signal<string | undefined>('a');
    const c = mount(html`${Label({ htmlFor, children: 'X' })}`);
    const label = getLabel(c);
    expect(label.getAttribute('for')).toBe('a');

    htmlFor.value = 'b';
    flushEffects();
    flushEffects();

    expect(label.getAttribute('for')).toBe('b');
  });

  it('renders TemplateResult children', () => {
    const c = mount(
      html`${Label({ children: html`Name <span data-testid="req">*</span>` as TemplateResult })}`,
    );
    const label = getLabel(c);

    expect(label.querySelector('[data-testid="req"]')).not.toBeNull();
    expect(label.textContent).toContain('Name');
  });
});

describe('Label as a plain custom element', () => {
  it('reads `for` from the host attribute', () => {
    const host = document.createElement('ui-label');
    host.setAttribute('for', 'email');
    host.append('Email');
    document.body.appendChild(host);

    const label = getLabel(host);
    expect(label.getAttribute('for')).toBe('email');
    expect(label.textContent).toBe('Email');
  });

  it('projects pre-existing light-DOM children into the inner label', () => {
    const host = document.createElement('ui-label');
    const req = document.createElement('span');
    req.textContent = '*';
    host.append('Name ', req);
    document.body.appendChild(host);

    const label = getLabel(host);
    expect(label.contains(req)).toBe(true);
    expect(label.textContent).toBe('Name *');
    expect([...host.childNodes].every((n) => n === label)).toBe(true);
  });

  it('explicit prop wins over host attribute', () => {
    const host = document.createElement('ui-label');
    host.setAttribute('for', 'from-attr');
    (host as unknown as { _setProp(k: string, v: unknown): void })._setProp(
      'htmlFor',
      'from-prop',
    );
    document.body.appendChild(host);

    expect(getLabel(host).getAttribute('for')).toBe('from-prop');
  });
});
