/**
 * item.test.ts — Item parts render slots, variants, and classes.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { html, type TemplateResult } from '@nisli/core';
import {
  Item,
  ItemGroup,
  ItemSeparator,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemHeader,
  ItemFooter,
  itemVariants,
} from './item.js';

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

describe('Item', () => {
  it('renders an item with default variant/size data attributes', () => {
    const c = mount(html`${Item({ children: 'x' })}`);
    const el = bySlot('item', c);
    expect(el.getAttribute('data-variant')).toBe('default');
    expect(el.getAttribute('data-size')).toBe('default');
    expect(el.className).toContain('rounded-md');
  });

  it('applies variant and size, merging className last', () => {
    const c = mount(html`${Item({ variant: 'outline', size: 'sm', className: 'w-full', children: 'x' })}`);
    const el = bySlot('item', c);
    expect(el.getAttribute('data-variant')).toBe('outline');
    expect(el.getAttribute('data-size')).toBe('sm');
    const expected = new Set(`${itemVariants({ variant: 'outline', size: 'sm' })} w-full`.split(/\s+/));
    expect(new Set(el.className.split(/\s+/))).toEqual(expected);
  });

  it('hosts are layout-transparent', () => {
    const c = mount(html`${Item({ children: 'x' })}`);
    expect((c.querySelector('ui-item') as HTMLElement).style.display).toBe('contents');
  });

  it('composes group/media/content/title/description/actions', () => {
    const c = mount(
      html`${ItemGroup({
        children: Item({
          children: html`${ItemMedia({ variant: 'icon', children: '★' })}
          ${ItemContent({
            children: html`${ItemTitle({ children: 'Ada Lovelace' })}
            ${ItemDescription({ children: 'First programmer.' })}`,
          })}
          ${ItemActions({ children: 'Follow' })}`,
        }),
      })}`,
    );

    expect(bySlot('item-group', c).getAttribute('role')).toBe('list');
    expect(bySlot('item-media', c).getAttribute('data-variant')).toBe('icon');
    expect(bySlot('item-media', c).className).toContain('bg-muted');
    expect(bySlot('item-title', c).textContent).toBe('Ada Lovelace');
    expect(bySlot('item-description', c).tagName).toBe('P');
    expect(bySlot('item-description', c).className).toContain('line-clamp-2');
    expect(bySlot('item-actions', c).textContent).toBe('Follow');
  });

  it('renders header/footer with basis-full', () => {
    const h = mount(html`${ItemHeader({ children: 'H' })}`);
    expect(bySlot('item-header', h).className).toContain('basis-full');
    const f = mount(html`${ItemFooter({ children: 'F' })}`);
    expect(bySlot('item-footer', f).className).toContain('basis-full');
  });

  it('renders a horizontal separator carrying data-slot=item-separator', () => {
    const c = mount(html`${ItemSeparator({})}`);
    const sep = bySlot('item-separator', c);
    expect(sep.getAttribute('role')).toBe('none');
    expect(sep.getAttribute('data-orientation')).toBe('horizontal');
    expect(sep.className).toContain('bg-border');
  });
});
