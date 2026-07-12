/**
 * bubble.test.ts — chat bubble variants + alignment.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { flushEffects, html, type TemplateResult } from '@nisli/core';
import { BubbleGroup, Bubble, BubbleContent, BubbleReactions } from './bubble.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}
const q = (root: ParentNode, slot: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;

describe('Bubble', () => {
  it('renders group + bubble + content with default variant/align hooks', () => {
    const c = mount(
      html`${BubbleGroup({
        children: Bubble({ children: BubbleContent({ children: 'Hello' }) }),
      })}`,
    );
    flushEffects();
    expect(q(c, 'bubble-group').className).toContain('flex-col');
    const b = q(c, 'bubble');
    expect(b.getAttribute('data-variant')).toBe('default');
    expect(b.getAttribute('data-align')).toBe('start');
    expect(q(c, 'bubble-content').textContent).toBe('Hello');
    expect(q(c, 'bubble-content').className).toContain('rounded-xl');
  });

  it('reflects variant + end alignment', () => {
    const c = mount(html`${Bubble({ variant: 'secondary', align: 'end', children: 'Hi' })}`);
    flushEffects();
    const b = q(c, 'bubble');
    expect(b.getAttribute('data-variant')).toBe('secondary');
    expect(b.getAttribute('data-align')).toBe('end');
    expect(b.className).toContain('data-[align=end]:self-end');
  });

  it('reactions carry side/align hooks (defaults bottom/end)', () => {
    const c = mount(html`${BubbleReactions({ children: '👍' })}`);
    flushEffects();
    const r = q(c, 'bubble-reactions');
    expect(r.getAttribute('data-side')).toBe('bottom');
    expect(r.getAttribute('data-align')).toBe('end');
    expect(r.className).toContain('rounded-full');
  });
});

describe('Bubble — plain custom elements', () => {
  it('host is layout-transparent; styling lives on the inner element', () => {
    const c = mount(html`${Bubble({ children: '' })}`);
    flushEffects();
    const host = c.querySelector('ui-bubble') as HTMLElement;
    expect(host.style.display).toBe('contents');
    expect(host.className).toBe('');
    expect(host.querySelector('[data-slot="bubble"]')).not.toBeNull();
  });

  it('reads variant/align from host attributes', () => {
    const host = document.createElement('ui-bubble');
    host.setAttribute('variant', 'secondary');
    host.setAttribute('align', 'end');
    document.body.appendChild(host);
    flushEffects();
    const b = host.querySelector('[data-slot="bubble"]')!;
    expect(b.getAttribute('data-variant')).toBe('secondary');
    expect(b.getAttribute('data-align')).toBe('end');
  });

  it('projects pre-existing light-DOM children into the inner root', () => {
    const host = document.createElement('ui-bubble-content');
    const span = document.createElement('span');
    span.textContent = 'Hi';
    host.append(span);
    document.body.appendChild(host);
    flushEffects();
    const content = host.querySelector('[data-slot="bubble-content"]')!;
    expect(content.contains(span)).toBe(true);
  });

  it('works via innerHTML parsing (children appended after upgrade)', async () => {
    document.body.innerHTML = '<ui-bubble-content>Parsed</ui-bubble-content>';
    flushEffects();
    await Promise.resolve();
    expect(q(document.body, 'bubble-content').textContent).toBe('Parsed');
  });

  it('explicit prop wins over the host attribute (variant)', () => {
    const host = document.createElement('ui-bubble');
    host.setAttribute('variant', 'default');
    (host as unknown as { _setProp(k: string, v: unknown): void })._setProp('variant', 'secondary');
    document.body.appendChild(host);
    flushEffects();
    expect(host.querySelector('[data-slot="bubble"]')!.getAttribute('data-variant')).toBe('secondary');
  });
});
