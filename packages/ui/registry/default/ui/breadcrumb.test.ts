/**
 * breadcrumb.test.ts — Breadcrumb parts + ARIA.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { html, type TemplateResult } from '@nisli/core';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from './breadcrumb.js';

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

describe('Breadcrumb', () => {
  it('renders a labelled nav', () => {
    const c = mount(html`${Breadcrumb({ children: '' })}`);
    const nav = bySlot('breadcrumb', c);
    expect(nav.tagName).toBe('NAV');
    expect(nav.getAttribute('aria-label')).toBe('breadcrumb');
  });

  it('composes list/item/link/page with correct elements and aria', () => {
    const c = mount(
      html`${Breadcrumb({
        children: BreadcrumbList({
          children: html`${BreadcrumbItem({
            children: BreadcrumbLink({ href: '/', children: 'Home' }),
          })}${BreadcrumbItem({
            children: BreadcrumbPage({ children: 'Settings' }),
          })}`,
        }),
      })}`,
    );

    const list = bySlot('breadcrumb-list', c);
    expect(list.tagName).toBe('OL');
    expect(list.querySelectorAll('[data-slot="breadcrumb-item"]').length).toBe(2);

    const link = bySlot('breadcrumb-link', c) as HTMLAnchorElement;
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/');
    expect(link.textContent).toBe('Home');

    const page = bySlot('breadcrumb-page', c);
    expect(page.getAttribute('role')).toBe('link');
    expect(page.getAttribute('aria-current')).toBe('page');
    expect(page.getAttribute('aria-disabled')).toBe('true');
    expect(page.textContent).toBe('Settings');
  });

  it('renders a separator with a default chevron, hidden from a11y', () => {
    const c = mount(html`${Breadcrumb({ children: BreadcrumbSeparator({}) })}`);
    const sep = bySlot('breadcrumb-separator', c);
    expect(sep.tagName).toBe('LI');
    expect(sep.getAttribute('role')).toBe('presentation');
    expect(sep.getAttribute('aria-hidden')).toBe('true');
    expect(sep.querySelector('svg')).not.toBeNull();
  });

  it('lets a custom separator replace the default chevron', () => {
    const c = mount(html`${Breadcrumb({ children: BreadcrumbSeparator({ children: '/' }) })}`);
    const sep = bySlot('breadcrumb-separator', c);
    expect(sep.textContent).toBe('/');
    expect(sep.querySelector('svg')).toBeNull();
  });

  it('renders an ellipsis with an icon and sr-only label', () => {
    const c = mount(html`${Breadcrumb({ children: BreadcrumbEllipsis({}) })}`);
    const el = bySlot('breadcrumb-ellipsis', c);
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.querySelector('.sr-only')?.textContent).toBe('More');
  });

  it('hosts are layout-transparent', () => {
    const c = mount(html`${Breadcrumb({ children: '' })}`);
    expect((c.querySelector('ui-breadcrumb') as HTMLElement).style.display).toBe('contents');
  });
});
