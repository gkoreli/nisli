/**
 * empty.test.ts — Empty parts render slots + classes.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { html, type TemplateResult } from '@nisli/core';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
  emptyMediaVariants,
} from './empty.js';

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

describe('Empty', () => {
  it('renders the centered empty container', () => {
    const c = mount(html`${Empty({ children: 'x' })}`);
    const el = bySlot('empty', c);
    expect(el.getAttribute('data-slot')).toBe('empty');
    expect(el.className).toContain('flex-col');
    expect(el.className).toContain('border-dashed');
  });

  it('hosts are layout-transparent', () => {
    const c = mount(html`${Empty({ children: 'x' })}`);
    expect((c.querySelector('ui-empty') as HTMLElement).style.display).toBe('contents');
  });

  it('composes header/media/title/description/content', () => {
    const c = mount(
      html`${Empty({
        children: html`${EmptyHeader({
          children: html`${EmptyMedia({ variant: 'icon', children: '★' })}
          ${EmptyTitle({ children: 'No projects' })}
          ${EmptyDescription({ children: 'Create one to get started.' })}`,
        })}
        ${EmptyContent({ children: 'Action' })}`,
      })}`,
    );

    expect(bySlot('empty-header', c).className).toContain('max-w-sm');
    const media = bySlot('empty-icon', c);
    expect(media.getAttribute('data-variant')).toBe('icon');
    expect(media.className).toContain('bg-muted');
    expect(bySlot('empty-title', c).textContent).toBe('No projects');
    expect(bySlot('empty-description', c).className).toContain('text-muted-foreground');
    expect(bySlot('empty-content', c).textContent).toBe('Action');
  });

  it('EmptyMedia defaults to the transparent variant', () => {
    const c = mount(html`${EmptyMedia({ children: '★' })}`);
    const media = bySlot('empty-icon', c);
    expect(media.getAttribute('data-variant')).toBe('default');
    expect(media.className).toBe(emptyMediaVariants({ variant: 'default' }));
  });

  it('merges className last', () => {
    const c = mount(html`${EmptyTitle({ className: 'text-2xl', children: 'T' })}`);
    expect(bySlot('empty-title', c).className.endsWith('text-2xl')).toBe(true);
  });
});
