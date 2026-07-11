/**
 * skeleton.test.ts — Skeleton component rendering and interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { html, type TemplateResult } from '@nisli/core';
import { Skeleton, skeletonClasses } from './skeleton.js';

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

function getSkeleton(container: ParentNode = document.body): HTMLElement {
  const el = container.querySelector('[data-slot="skeleton"]');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

describe('Skeleton via factory', () => {
  it('renders a pulsing <div> with defaults', () => {
    const c = mount(html`${Skeleton({})}`);
    const sk = getSkeleton(c);

    expect(sk.tagName).toBe('DIV');
    expect(sk.getAttribute('data-slot')).toBe('skeleton');
    expect(sk.className).toContain('animate-pulse');
    expect(sk.className).toContain('rounded-md');
    expect(sk.className).toContain('bg-accent');
  });

  it('host is layout-transparent; styling lives on the inner div', () => {
    const c = mount(html`${Skeleton({})}`);
    const host = c.querySelector('ui-skeleton') as HTMLElement;

    expect(host).not.toBeNull();
    expect(host.style.display).toBe('contents');
    expect(host.className).toBe('');
    expect(getSkeleton(host).parentElement).toBe(host);
  });

  it('merges className last for sizing', () => {
    const c = mount(html`${Skeleton({ className: 'h-4 w-32' })}`);
    const sk = getSkeleton(c);

    const expected = new Set(`${skeletonClasses} h-4 w-32`.split(/\s+/));
    expect(new Set(sk.className.split(/\s+/))).toEqual(expected);
    expect(sk.className.endsWith('w-32')).toBe(true);
  });

  it('renders TemplateResult children (placeholder wrapping)', () => {
    const c = mount(html`${Skeleton({ children: html`<span data-testid="ph">x</span>` })}`);
    const sk = getSkeleton(c);

    expect(sk.querySelector('[data-testid="ph"]')).not.toBeNull();
  });
});

describe('Skeleton as a plain custom element', () => {
  it('reads className from the class-name host attribute', () => {
    const host = document.createElement('ui-skeleton');
    host.setAttribute('class-name', 'h-8 w-8 rounded-full');
    document.body.appendChild(host);

    const sk = getSkeleton(host);
    expect(sk.className).toContain('rounded-full');
    expect(sk.className.endsWith('rounded-full')).toBe(true);
  });

  it('projects pre-existing light-DOM children into the inner div', () => {
    const host = document.createElement('ui-skeleton');
    const inner = document.createElement('span');
    inner.textContent = 'loading';
    host.append(inner);
    document.body.appendChild(host);

    const sk = getSkeleton(host);
    expect(sk.contains(inner)).toBe(true);
    expect([...host.childNodes].every((n) => n === sk)).toBe(true);
  });
});
