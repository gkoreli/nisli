/**
 * kbd.test.ts — Kbd / KbdGroup rendering and interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { html, type TemplateResult } from '@nisli/core';
import { Kbd, KbdGroup, kbdClasses, kbdGroupClasses } from './kbd.js';

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

describe('Kbd via factory', () => {
  it('renders a themed <kbd> with the upstream classes', () => {
    const c = mount(html`${Kbd({ children: '⌘' })}`);
    const kbd = bySlot('kbd', c);

    expect(kbd.tagName).toBe('KBD');
    expect(kbd.textContent).toBe('⌘');
    expect(kbd.className).toBe(kbdClasses);
    expect(kbd.className).toContain('bg-muted');
    expect(kbd.className).toContain('select-none');
  });

  it('uses a transparent host and merges className last', () => {
    const c = mount(html`${Kbd({ className: 'text-primary', children: 'K' })}`);
    const host = c.querySelector('ui-kbd') as HTMLElement;
    const kbd = bySlot('kbd', host);

    expect(host.style.display).toBe('contents');
    expect(host.className).toBe('');
    expect(kbd.parentElement).toBe(host);
    expect(kbd.className).toBe(`${kbdClasses} text-primary`);
  });

  it('composes a group and TemplateResult children', () => {
    const c = mount(
      html`${KbdGroup({
        className: 'ml-2',
        children: html`${Kbd({ children: '⌘' })}${Kbd({ children: 'K' })}`,
      })}`,
    );
    const group = bySlot('kbd-group', c);

    expect(group.tagName).toBe('KBD');
    expect(group.className).toBe(`${kbdGroupClasses} ml-2`);
    expect(group.querySelectorAll('[data-slot="kbd"]')).toHaveLength(2);
  });
});

describe('Kbd as plain custom elements', () => {
  it('reads className from the host attribute', () => {
    const host = document.createElement('ui-kbd');
    host.setAttribute('class-name', 'text-primary');
    host.append('Esc');
    document.body.appendChild(host);

    const kbd = bySlot('kbd', host);
    expect(kbd.className).toBe(`${kbdClasses} text-primary`);
    expect(kbd.textContent).toBe('Esc');
  });

  it('projects pre-existing children into KbdGroup', () => {
    const host = document.createElement('ui-kbd-group');
    const child = document.createElement('span');
    child.textContent = 'Ctrl + K';
    host.append(child);
    document.body.appendChild(host);

    const group = bySlot('kbd-group', host);
    expect(group.contains(child)).toBe(true);
    expect([...host.childNodes].every((node) => node === group)).toBe(true);
  });
});
