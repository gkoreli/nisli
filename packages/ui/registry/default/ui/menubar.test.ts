/**
 * menubar.test.ts — menubar open/roving/open-follows-focus/select.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
} from './menubar.js';

beforeEach(async () => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
  await Promise.resolve();
  await Promise.resolve();
});
afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function mountBar(): HTMLElement {
  const menu = (label: string, a: string, b: string): TemplateResult =>
    MenubarMenu({
      children: html`${MenubarTrigger({ children: label })}
      ${MenubarContent({
        children: html`${MenubarItem({ value: `${a}`, children: a })}
        ${MenubarItem({ value: `${b}`, children: b })}`,
      })}`,
    });
  return mount(
    html`${Menubar({
      children: html`${menu('File', 'New', 'Open')}${menu('Edit', 'Undo', 'Redo')}`,
    })}`,
  );
}

const triggers = (c: ParentNode) =>
  Array.from(c.querySelectorAll<HTMLElement>('[data-slot="menubar-trigger"]'));
const contents = (c: ParentNode) =>
  Array.from(c.querySelectorAll<HTMLElement>('[data-slot="menubar-content"]'));
const openContents = (c: ParentNode) => contents(c).filter((el) => !el.hasAttribute('hidden'));
function flush2(): void {
  flushEffects();
  flushEffects();
}
async function settle(): Promise<void> {
  flush2();
  await Promise.resolve();
  flush2();
}
function press(el: Element, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  flush2();
}

describe('Menubar — structure', () => {
  it('is a role=menubar with role=menuitem triggers, all menus closed', () => {
    const c = mountBar();
    expect(c.querySelector('[data-slot="menubar"]')!.getAttribute('role')).toBe('menubar');
    expect(triggers(c)).toHaveLength(2);
    expect(triggers(c)[0].getAttribute('role')).toBe('menuitem');
    expect(triggers(c)[0].getAttribute('aria-haspopup')).toBe('menu');
    expect(openContents(c)).toHaveLength(0);
  });

  it('roving tabindex: the first trigger is the tab stop', () => {
    const c = mountBar();
    expect(triggers(c)[0].getAttribute('tabindex')).toBe('0');
    expect(triggers(c)[1].getAttribute('tabindex')).toBe('-1');
  });
});

describe('Menubar — trigger roving + open', () => {
  it('ArrowRight/ArrowLeft move focus between triggers (wrapping)', () => {
    const c = mountBar();
    const [file, edit] = triggers(c);
    file.focus();
    press(file, 'ArrowRight');
    expect(document.activeElement).toBe(edit);
    expect(edit.getAttribute('tabindex')).toBe('0');
    press(edit, 'ArrowRight'); // wrap
    expect(document.activeElement).toBe(file);
  });

  it('ArrowDown opens the focused menu on its first item', async () => {
    const c = mountBar();
    const [file] = triggers(c);
    file.focus();
    press(file, 'ArrowDown');
    await settle();
    expect(openContents(c)).toHaveLength(1);
    const firstItem = openContents(c)[0].querySelector('[role="menuitem"]');
    expect(document.activeElement).toBe(firstItem);
  });
});

describe('Menubar — open-follows-focus', () => {
  it('ArrowRight inside an open menu switches to the sibling menu', async () => {
    const c = mountBar();
    triggers(c)[0].click(); // open File
    await settle();
    expect(openContents(c)[0].id).toContain(triggers(c)[0].getAttribute('data-menu-id')!);

    // ArrowRight from within the menu moves to the Edit menu.
    press(document.activeElement!, 'ArrowRight');
    await settle();
    const open = openContents(c);
    expect(open).toHaveLength(1);
    expect(open[0].id).toContain(triggers(c)[1].getAttribute('data-menu-id')!);
  });

  it('hovering another trigger while a menu is open switches menus', async () => {
    const c = mountBar();
    triggers(c)[0].click();
    await settle();
    triggers(c)[1].dispatchEvent(new Event('pointerenter', { bubbles: true }));
    await settle();
    expect(openContents(c)).toHaveLength(1);
    expect(openContents(c)[0].id).toContain(triggers(c)[1].getAttribute('data-menu-id')!);
  });
});

describe('Menubar — selection + dismissal', () => {
  it('activating an item dispatches ui-select and closes the bar', async () => {
    const c = mountBar();
    const onSelect = vi.fn();
    c.querySelector('ui-menubar')!.addEventListener('ui-select', onSelect as EventListener);
    triggers(c)[0].click();
    await settle();
    openContents(c)[0].querySelector<HTMLElement>('[role="menuitem"]')!.click();
    flush2();
    expect((onSelect.mock.calls[0][0] as CustomEvent).detail).toEqual({ value: 'New' });
    expect(openContents(c)).toHaveLength(0);
  });

  it('Escape closes the open menu and returns focus to its trigger', async () => {
    const c = mountBar();
    triggers(c)[0].click();
    await settle();
    press(document.activeElement!, 'Escape');
    await Promise.resolve();
    expect(openContents(c)).toHaveLength(0);
    expect(document.activeElement).toBe(triggers(c)[0]);
  });
});

describe('Menubar — misuse', () => {
  it('a trigger outside <ui-menubar> renders an error fallback', () => {
    const host = document.createElement('ui-menubar-trigger');
    document.body.appendChild(host);
    expect(host.querySelector('[role="menuitem"]')).toBeNull();
    expect(host.textContent).toContain('Error');
  });

  it('an item outside <ui-menubar-menu> renders an error fallback', () => {
    const host = document.createElement('ui-menubar-item');
    document.body.appendChild(host);
    expect(host.textContent).toContain('Error');
  });
});
