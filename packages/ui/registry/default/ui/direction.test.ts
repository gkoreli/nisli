/**
 * direction.test.ts — Direction provider rendering and interop.
 *
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { flushEffects, html, signal, type TemplateResult } from '@nisli/core';
import { DirectionProvider, useDirection } from './direction.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

describe('DirectionProvider via factory', () => {
  it('renders an LTR provider by default with the house data-slot', () => {
    const container = mount(html`${DirectionProvider({ children: 'Content' })}`);
    const provider = container.querySelector('[data-slot="direction-provider"]');

    expect(provider?.getAttribute('dir')).toBe('ltr');
    expect(provider?.textContent).toBe('Content');
    expect((container.querySelector('ui-direction-provider') as HTMLElement).style.display).toBe('contents');
  });

  it('uses direction before dir and updates reactively', () => {
    const direction = signal<'ltr' | 'rtl'>('rtl');
    const container = mount(
      html`${DirectionProvider({ dir: 'ltr', direction, children: 'مرحبا' })}`,
    );
    const provider = container.querySelector('[data-slot="direction-provider"]') as HTMLElement;

    expect(provider.getAttribute('dir')).toBe('rtl');
    direction.value = 'ltr';
    flushEffects();
    flushEffects();
    expect(provider.getAttribute('dir')).toBe('ltr');
  });

  it('publishes direction through host state for descendants', () => {
    const container = mount(
      html`${DirectionProvider({ direction: 'rtl', children: html`<span>Child</span>` })}`,
    );
    const child = container.querySelector('span') as HTMLElement;

    expect(useDirection(child).value).toBe('rtl');
  });
});

describe('DirectionProvider as a plain custom element', () => {
  it('reads the direction host attribute and projects existing children', () => {
    const host = document.createElement('ui-direction-provider');
    host.setAttribute('direction', 'rtl');
    const child = document.createElement('span');
    child.textContent = 'Projected';
    host.appendChild(child);
    document.body.appendChild(host);

    const provider = host.querySelector('[data-slot="direction-provider"]') as HTMLElement;
    expect(provider.getAttribute('dir')).toBe('rtl');
    expect(provider.contains(child)).toBe(true);
    expect([...host.childNodes].every((node) => node === provider)).toBe(true);
  });

  it('falls back to dir and rejects invalid values as LTR', () => {
    const host = document.createElement('ui-direction-provider');
    host.setAttribute('dir', 'rtl');
    document.body.appendChild(host);
    expect(host.querySelector('[data-slot="direction-provider"]')?.getAttribute('dir')).toBe('rtl');

    const invalid = document.createElement('ui-direction-provider');
    invalid.setAttribute('direction', 'sideways');
    document.body.appendChild(invalid);
    expect(invalid.querySelector('[data-slot="direction-provider"]')?.getAttribute('dir')).toBe('ltr');
  });
});
