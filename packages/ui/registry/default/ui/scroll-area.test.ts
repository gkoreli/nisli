/**
 * scroll-area.test.ts — ScrollArea structure and native-scroll translation.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { html, type TemplateResult } from '@nisli/core';
import { ScrollArea } from './scroll-area.js';

beforeEach(() => {
  document.body.innerHTML = '';
  document.getElementById('ui-scroll-area-style')?.remove();
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

describe('ScrollArea', () => {
  it('renders root + focusable overflow viewport with children inside', () => {
    const c = mount(
      html`${ScrollArea({ className: 'h-72 w-48', children: html`<p data-testid="content">long</p>` })}`,
    );
    const root = c.querySelector('[data-slot="scroll-area"]') as HTMLElement;
    const viewport = c.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement;

    expect(root.className).toContain('relative');
    expect(root.className).toContain('h-72');
    expect(viewport.className).toContain('overflow-auto');
    expect(viewport.getAttribute('tabindex')).toBe('0');
    expect(viewport.querySelector('[data-testid="content"]')).not.toBeNull();
  });

  it('injects the scrollbar stylesheet exactly once', () => {
    mount(html`${ScrollArea({ children: 'a' })}${ScrollArea({ children: 'b' })}`);
    expect(document.querySelectorAll('#ui-scroll-area-style')).toHaveLength(1);
    expect(document.getElementById('ui-scroll-area-style')?.textContent).toContain(
      'scrollbar-color: var(--border) transparent',
    );
  });

  it('projects plain-HTML children into the viewport', () => {
    const host = document.createElement('ui-scroll-area');
    host.setAttribute('class-name', 'h-24');
    const p = document.createElement('p');
    p.textContent = 'projected';
    host.append(p);
    document.body.appendChild(host);

    const viewport = host.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement;
    expect(viewport.contains(p)).toBe(true);
    const root = host.querySelector('[data-slot="scroll-area"]') as HTMLElement;
    expect(root.className).toContain('h-24');
  });
});
