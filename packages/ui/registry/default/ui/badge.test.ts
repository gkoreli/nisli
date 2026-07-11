/**
 * badge.test.ts — Badge component rendering and interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import { Badge, badgeVariants, type BadgeVariant } from './badge.js';

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

function getBadge(container: ParentNode = document.body): HTMLElement {
  const el = container.querySelector('[data-slot="badge"]');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

describe('Badge via factory', () => {
  it('renders a themed <span> with defaults', () => {
    const c = mount(html`${Badge({ children: 'New' })}`);
    const badge = getBadge(c);

    expect(badge.tagName).toBe('SPAN');
    expect(badge.textContent).toBe('New');
    expect(badge.getAttribute('data-slot')).toBe('badge');
    expect(badge.className).toContain('bg-primary');
    expect(badge.className).toContain('rounded-full');
  });

  it('host is layout-transparent; styling lives on the inner span', () => {
    const c = mount(html`${Badge({ children: 'New' })}`);
    const host = c.querySelector('ui-badge') as HTMLElement;

    expect(host).not.toBeNull();
    expect(host.style.display).toBe('contents');
    expect(host.className).toBe('');
    expect(getBadge(host).parentElement).toBe(host);
  });

  it('applies variant classes, merging className last', () => {
    const c = mount(
      html`${Badge({ variant: 'outline', className: 'ml-2', children: 'Beta' })}`,
    );
    const badge = getBadge(c);

    const expected = new Set(`${badgeVariants({ variant: 'outline' })} ml-2`.split(/\s+/));
    expect(new Set(badge.className.split(/\s+/))).toEqual(expected);
    expect(badge.className).toContain('text-foreground');
    expect(badge.className.endsWith('ml-2')).toBe(true);
  });

  it('updates classes reactively when a variant signal changes', () => {
    const variant = signal<BadgeVariant | undefined>('default');
    const c = mount(html`${Badge({ variant, children: 'X' })}`);
    const badge = getBadge(c);
    expect(badge.className).toContain('bg-primary');

    variant.value = 'destructive';
    flushEffects();
    flushEffects();

    expect(badge.className).toContain('bg-destructive');
    expect(badge.className).not.toContain('bg-primary ');
  });

  it('renders TemplateResult children', () => {
    const c = mount(html`${Badge({ children: html`<span data-testid="dot">•</span> Live` })}`);
    const badge = getBadge(c);

    expect(badge.querySelector('[data-testid="dot"]')).not.toBeNull();
    expect(badge.textContent).toContain('Live');
  });
});

describe('Badge as a plain custom element', () => {
  it('reads variant from host attributes', () => {
    const host = document.createElement('ui-badge');
    host.setAttribute('variant', 'secondary');
    host.append('Draft');
    document.body.appendChild(host);

    const badge = getBadge(host);
    expect(badge.className).toContain('bg-secondary');
    expect(badge.textContent).toBe('Draft');
  });

  it('projects pre-existing light-DOM children into the inner span', () => {
    const host = document.createElement('ui-badge');
    const dot = document.createElement('span');
    dot.textContent = '•';
    host.append(dot, ' Online');
    document.body.appendChild(host);

    const badge = getBadge(host);
    expect(badge.contains(dot)).toBe(true);
    expect(badge.textContent).toBe('• Online');
    expect([...host.childNodes].every((n) => n === badge)).toBe(true);
  });

  it('explicit prop wins over host attribute', () => {
    const host = document.createElement('ui-badge');
    host.setAttribute('variant', 'outline');
    (host as unknown as { _setProp(k: string, v: unknown): void })._setProp(
      'variant',
      'destructive',
    );
    document.body.appendChild(host);

    const badge = getBadge(host);
    expect(badge.className).toContain('bg-destructive');
    expect(badge.className).not.toContain('text-foreground');
  });
});
