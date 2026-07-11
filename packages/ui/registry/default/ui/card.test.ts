/**
 * card.test.ts — Card and its regions: rendering and interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { html, type TemplateResult } from '@nisli/core';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './card.js';

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

function bySlot(slot: string, container: ParentNode = document.body): HTMLElement {
  const el = container.querySelector(`[data-slot="${slot}"]`);
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

describe('Card via factory', () => {
  it('renders a themed card with defaults', () => {
    const c = mount(html`${Card({ children: 'Body' })}`);
    const card = bySlot('card', c);

    expect(card.tagName).toBe('DIV');
    expect(card.getAttribute('data-slot')).toBe('card');
    expect(card.textContent).toBe('Body');
    expect(card.className).toContain('rounded-xl');
    expect(card.className).toContain('bg-card');
    expect(card.className).toContain('shadow');
  });

  it('host is layout-transparent; styling lives on the inner div', () => {
    const c = mount(html`${Card({ children: 'x' })}`);
    const host = c.querySelector('ui-card') as HTMLElement;

    expect(host).not.toBeNull();
    expect(host.style.display).toBe('contents');
    expect(host.className).toBe('');
    expect(bySlot('card', host).parentElement).toBe(host);
  });

  it('renders every region with its own data-slot and base classes', () => {
    const regions: Array<[TemplateResult, string, string]> = [
      [CardHeader({ children: 'h' }), 'card-header', 'space-y-1.5'],
      [CardTitle({ children: 't' }), 'card-title', 'font-semibold'],
      [CardDescription({ children: 'd' }), 'card-description', 'text-muted-foreground'],
      [CardContent({ children: 'c' }), 'card-content', 'pt-0'],
      [CardFooter({ children: 'f' }), 'card-footer', 'items-center'],
    ];
    for (const [tpl, slot, cls] of regions) {
      document.body.innerHTML = '';
      const c = mount(html`${tpl}`);
      const el = bySlot(slot, c);
      expect(el.getAttribute('data-slot')).toBe(slot);
      expect(el.className).toContain(cls);
    }
  });

  it('merges className last on a region', () => {
    const c = mount(html`${CardContent({ className: 'grid gap-4', children: 'x' })}`);
    const el = bySlot('card-content', c);
    expect(el.className.endsWith('grid gap-4')).toBe(true);
  });

  it('composes a full card from region factories', () => {
    const c = mount(
      html`${Card({
        children: html`
          ${CardHeader({
            children: html`${CardTitle({ children: 'Title' })}${CardDescription({ children: 'Desc' })}`,
          })}
          ${CardContent({ children: 'Content' })}
          ${CardFooter({ children: 'Footer' })}
        `,
      })}`,
    );
    const card = bySlot('card', c);

    expect(card.contains(bySlot('card-header', card))).toBe(true);
    expect(bySlot('card-title', card).textContent).toBe('Title');
    expect(bySlot('card-description', card).textContent).toBe('Desc');
    expect(bySlot('card-content', card).textContent).toBe('Content');
    expect(bySlot('card-footer', card).textContent).toBe('Footer');
  });
});

describe('Card as plain custom elements', () => {
  it('projects a nested plain-HTML card tree into inner roots', () => {
    document.body.innerHTML =
      '<ui-card><ui-card-header><ui-card-title>T</ui-card-title></ui-card-header><ui-card-content>C</ui-card-content></ui-card>';

    const card = bySlot('card');
    // Projection for parser-appended children resolves across microtasks;
    // the nesting guard keeps the sweep from throwing.
    return Promise.resolve()
      .then(() => Promise.resolve())
      .then(() => {
        const header = bySlot('card-header', card);
        expect(card.contains(header)).toBe(true);
        expect(bySlot('card-title', card).textContent).toBe('T');
        expect(bySlot('card-content', card).textContent).toBe('C');
      });
  });

  it('projects pre-existing light-DOM children into the inner div', () => {
    const host = document.createElement('ui-card-content');
    const p = document.createElement('p');
    p.textContent = 'Paragraph';
    host.append(p);
    document.body.appendChild(host);

    const content = bySlot('card-content', host);
    expect(content.contains(p)).toBe(true);
    expect([...host.childNodes].every((n) => n === content)).toBe(true);
  });

  it('reads className from the class-name host attribute', () => {
    const host = document.createElement('ui-card');
    host.setAttribute('class-name', 'w-96');
    document.body.appendChild(host);

    expect(bySlot('card', host).className.endsWith('w-96')).toBe(true);
  });
});
