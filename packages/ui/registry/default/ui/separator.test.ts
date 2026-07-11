/**
 * separator.test.ts — Separator component rendering and ARIA semantics.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import { Separator, type SeparatorOrientation } from './separator.js';

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

function getSeparator(container: ParentNode = document.body): HTMLElement {
  const el = container.querySelector('[data-slot="separator"]');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

describe('Separator via factory', () => {
  it('renders a decorative horizontal separator by default', () => {
    const c = mount(html`${Separator({})}`);
    const sep = getSeparator(c);

    expect(sep.getAttribute('data-slot')).toBe('separator');
    expect(sep.getAttribute('data-orientation')).toBe('horizontal');
    // Decorative by default → hidden from assistive tech.
    expect(sep.getAttribute('role')).toBe('none');
    expect(sep.hasAttribute('aria-orientation')).toBe(false);
    expect(sep.className).toContain('bg-border');
    expect(sep.className).toContain('h-[1px]');
    expect(sep.className).toContain('w-full');
  });

  it('host is layout-transparent; styling lives on the inner div', () => {
    const c = mount(html`${Separator({})}`);
    const host = c.querySelector('ui-separator') as HTMLElement;

    expect(host).not.toBeNull();
    expect(host.style.display).toBe('contents');
    expect(host.className).toBe('');
    expect(getSeparator(host).parentElement).toBe(host);
  });

  it('applies vertical sizing classes, merging className last', () => {
    const c = mount(html`${Separator({ orientation: 'vertical', className: 'mx-2' })}`);
    const sep = getSeparator(c);

    expect(sep.getAttribute('data-orientation')).toBe('vertical');
    expect(sep.className).toContain('h-full');
    expect(sep.className).toContain('w-[1px]');
    expect(sep.className.endsWith('mx-2')).toBe(true);
  });

  it('is semantic (role=separator) when decorative is false', () => {
    const c = mount(html`${Separator({ decorative: false })}`);
    const sep = getSeparator(c);

    expect(sep.getAttribute('role')).toBe('separator');
    // Horizontal is the ARIA implicit default → no aria-orientation.
    expect(sep.hasAttribute('aria-orientation')).toBe(false);
  });

  it('sets aria-orientation only for a semantic vertical separator', () => {
    const c = mount(html`${Separator({ decorative: false, orientation: 'vertical' })}`);
    const sep = getSeparator(c);

    expect(sep.getAttribute('role')).toBe('separator');
    expect(sep.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('does not expose aria-orientation on a decorative vertical separator', () => {
    const c = mount(html`${Separator({ orientation: 'vertical' })}`);
    const sep = getSeparator(c);

    expect(sep.getAttribute('role')).toBe('none');
    expect(sep.hasAttribute('aria-orientation')).toBe(false);
  });

  it('updates sizing reactively when the orientation signal changes', () => {
    const orientation = signal<SeparatorOrientation | undefined>('horizontal');
    const c = mount(html`${Separator({ orientation })}`);
    const sep = getSeparator(c);
    expect(sep.className).toContain('w-full');

    orientation.value = 'vertical';
    flushEffects();
    flushEffects();

    expect(sep.getAttribute('data-orientation')).toBe('vertical');
    expect(sep.className).toContain('h-full');
    expect(sep.className).not.toContain('w-full');
  });
});

describe('Separator as a plain custom element', () => {
  it('reads orientation from the host attribute', () => {
    const host = document.createElement('ui-separator');
    host.setAttribute('orientation', 'vertical');
    document.body.appendChild(host);

    const sep = getSeparator(host);
    expect(sep.getAttribute('data-orientation')).toBe('vertical');
    expect(sep.className).toContain('h-full');
  });

  it('opts out of decoration via decorative="false"', () => {
    const host = document.createElement('ui-separator');
    host.setAttribute('decorative', 'false');
    host.setAttribute('orientation', 'vertical');
    document.body.appendChild(host);

    const sep = getSeparator(host);
    expect(sep.getAttribute('role')).toBe('separator');
    expect(sep.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('explicit prop wins over host attribute', () => {
    const host = document.createElement('ui-separator');
    host.setAttribute('orientation', 'horizontal');
    (host as unknown as { _setProp(k: string, v: unknown): void })._setProp(
      'orientation',
      'vertical',
    );
    document.body.appendChild(host);

    expect(getSeparator(host).getAttribute('data-orientation')).toBe('vertical');
  });
});
