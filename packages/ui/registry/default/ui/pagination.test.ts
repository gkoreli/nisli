/**
 * pagination.test.ts — Pagination parts + buttonVariants-based links.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { html, type TemplateResult } from '@nisli/core';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from './pagination.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function bySlot(slot: string, container: ParentNode = document.body): HTMLElement {
  const el = container.querySelector(`[data-slot="${slot}"]`);
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

describe('Pagination', () => {
  it('renders a labelled navigation with a content list', () => {
    const c = mount(
      html`${Pagination({ children: PaginationContent({ children: PaginationItem({ children: 'x' }) }) })}`,
    );
    const nav = bySlot('pagination', c);
    expect(nav.tagName).toBe('NAV');
    expect(nav.getAttribute('role')).toBe('navigation');
    expect(nav.getAttribute('aria-label')).toBe('pagination');
    expect(bySlot('pagination-content', c).tagName).toBe('UL');
    expect(bySlot('pagination-item', c).tagName).toBe('LI');
  });

  it('styles the active link with the outline button variant + aria-current', () => {
    const c = mount(html`${PaginationLink({ href: '/2', isActive: true, children: '2' })}`);
    const link = bySlot('pagination-link', c) as HTMLAnchorElement;

    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/2');
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(link.getAttribute('data-active')).toBe('true');
    // outline variant token
    expect(link.className).toContain('bg-background');
  });

  it('styles an inactive link with the ghost variant and no aria-current', () => {
    const c = mount(html`${PaginationLink({ href: '/3', children: '3' })}`);
    const link = bySlot('pagination-link', c);
    expect(link.hasAttribute('aria-current')).toBe(false);
    expect(link.hasAttribute('data-active')).toBe(false);
    expect(link.className).toContain('hover:bg-accent');
  });

  it('renders previous/next links with labels and chevrons', () => {
    const p = mount(html`${PaginationPrevious({ href: '/1' })}`);
    const prev = bySlot('pagination-link', p);
    expect(prev.getAttribute('aria-label')).toBe('Go to previous page');
    expect(prev.textContent).toContain('Previous');
    expect(prev.querySelector('svg')).not.toBeNull();

    const n = mount(html`${PaginationNext({ href: '/3' })}`);
    const next = bySlot('pagination-link', n);
    expect(next.getAttribute('aria-label')).toBe('Go to next page');
    expect(next.textContent).toContain('Next');
  });

  it('renders an ellipsis with an icon and sr-only label', () => {
    const c = mount(html`${PaginationEllipsis({})}`);
    const el = bySlot('pagination-ellipsis', c);
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.querySelector('.sr-only')?.textContent).toBe('More pages');
  });

  it('hosts are layout-transparent', () => {
    const c = mount(html`${Pagination({ children: '' })}`);
    expect((c.querySelector('ui-pagination') as HTMLElement).style.display).toBe('contents');
  });
});
