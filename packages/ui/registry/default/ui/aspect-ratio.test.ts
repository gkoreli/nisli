/**
 * aspect-ratio.test.ts — AspectRatio component rendering and interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { html, type TemplateResult } from '@nisli/core';
import { AspectRatio, aspectRatioClasses } from './aspect-ratio.js';

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

function getAspectRatio(container: ParentNode = document.body): HTMLDivElement {
  const el = container.querySelector('[data-slot="aspect-ratio"]');
  expect(el).not.toBeNull();
  return el as HTMLDivElement;
}

describe('AspectRatio via factory', () => {
  it('renders a square <div> by default', () => {
    const c = mount(html`${AspectRatio({ children: 'Media' })}`);
    const el = getAspectRatio(c);

    expect(el.tagName).toBe('DIV');
    expect(el.getAttribute('data-slot')).toBe('aspect-ratio');
    expect(el.style.aspectRatio).toBe('1 / 1');
    expect(el.className).toBe(aspectRatioClasses);
    expect(el.classList).toContain('relative');
    expect(el.classList).toContain('w-full');
    expect(el.textContent).toBe('Media');
  });

  it('host is layout-transparent; styling lives on the inner div', () => {
    const c = mount(html`${AspectRatio({ ratio: 16 / 9 })}`);
    const host = c.querySelector('ui-aspect-ratio') as HTMLElement;

    expect(host).not.toBeNull();
    expect(host.style.display).toBe('contents');
    expect(host.className).toBe('');
    expect(getAspectRatio(host).parentElement).toBe(host);
  });

  it('applies the ratio and merges className onto the root', () => {
    const c = mount(
      html`${AspectRatio({ ratio: 16 / 9, className: 'rounded-lg bg-muted' })}`,
    );
    const el = getAspectRatio(c);

    expect(el.style.aspectRatio).toBe(`${16 / 9} / 1`);
    expect(el.className).toBe('relative w-full rounded-lg bg-muted');
  });

  it('renders TemplateResult children', () => {
    const c = mount(
      html`${AspectRatio({ children: html`<img data-testid="image" alt="Preview" />` })}`,
    );

    expect(getAspectRatio(c).querySelector('[data-testid="image"]')).not.toBeNull();
  });
});

describe('AspectRatio as a plain custom element', () => {
  it('reads ratio and className from host attributes', () => {
    const host = document.createElement('ui-aspect-ratio');
    host.setAttribute('ratio', '1.5');
    host.setAttribute('class-name', 'overflow-hidden rounded-lg');
    document.body.appendChild(host);

    const el = getAspectRatio(host);
    expect(el.style.aspectRatio).toBe('1.5 / 1');
    expect(el.className).toBe('relative w-full overflow-hidden rounded-lg');
  });

  it('falls back to a square for an invalid ratio attribute', () => {
    const host = document.createElement('ui-aspect-ratio');
    host.setAttribute('ratio', 'wide');
    document.body.appendChild(host);

    expect(getAspectRatio(host).style.aspectRatio).toBe('1 / 1');
  });

  it('projects pre-existing light-DOM children into the inner div', () => {
    const host = document.createElement('ui-aspect-ratio');
    const image = document.createElement('img');
    image.alt = 'Preview';
    host.append(image);
    document.body.appendChild(host);

    const el = getAspectRatio(host);
    expect(el.contains(image)).toBe(true);
    expect([...host.childNodes].every((node) => node === el)).toBe(true);
  });
});
