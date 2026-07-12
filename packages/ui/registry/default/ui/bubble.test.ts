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
