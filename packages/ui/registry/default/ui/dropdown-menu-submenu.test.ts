/**
 * dropdown-menu-submenu.test.ts — nested submenu behavior.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flush, flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from './dropdown-menu.js';

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

function mountNested(): HTMLElement {
  return mount(
    html`${DropdownMenu({
      children: html`${DropdownMenuTrigger({ children: 'Open' })}
      ${DropdownMenuContent({
        children: html`${DropdownMenuItem({ value: 'a', children: 'Item A' })}
        ${DropdownMenuSub({
          children: html`${DropdownMenuSubTrigger({ children: 'More' })}
          ${DropdownMenuSubContent({
            children: html`${DropdownMenuItem({ value: 'x', children: 'Sub X' })}
            ${DropdownMenuItem({ value: 'y', children: 'Sub Y' })}`,
          })}`,
        })}
        ${DropdownMenuItem({ value: 'b', children: 'Item B' })}`,
      })}`,
    })}`,
  );
}

const q = (root: ParentNode, slot: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
const rootOpen = (_c: ParentNode) => !q(document, 'dropdown-menu-content').hasAttribute('hidden');
const subOpen = (_c: ParentNode) => !q(document, 'dropdown-menu-sub-content').hasAttribute('hidden');
function flush2(): void {
  flush();
}
async function microtask(): Promise<void> {
  await Promise.resolve();
  flush2();
}
async function openRoot(c: HTMLElement): Promise<void> {
  q(c, 'dropdown-menu-trigger').click();
  flush2();
  await microtask();
}
function press(key: string): void {
  (document.activeElement ?? document.body).dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  );
  flush2();
}

describe('DropdownMenu submenu — structure', () => {
  it('sub-trigger is a menuitem announcing a submenu; sub-content hidden until open', () => {
    const c = mountNested();
    const subTrigger = q(document, 'dropdown-menu-sub-trigger');
    expect(subTrigger.getAttribute('role')).toBe('menuitem');
    expect(subTrigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(subTrigger.getAttribute('aria-expanded')).toBe('false');
    expect(q(document, 'dropdown-menu-sub-content').getAttribute('role')).toBe('menu');
    expect(subOpen(c)).toBe(false);
  });
});

describe('DropdownMenu submenu — item scoping', () => {
  it('parent roving visits only the parent menu items, not submenu items', async () => {
    const c = mountNested();
    await openRoot(c);
    // Scope to the root content (both it and the sub-content are portaled to
    // <body>, so plain document order is no longer reliable).
    const rootItems = [
      ...q(document, 'dropdown-menu-content').querySelectorAll('[data-slot="dropdown-menu-item"]'),
    ];
    const itemA = rootItems.find((el) => el.textContent === 'Item A')!;
    const subTrigger = q(document, 'dropdown-menu-sub-trigger');
    const itemB = rootItems.find((el) => el.textContent === 'Item B')!;

    expect(document.activeElement).toBe(itemA);
    press('ArrowDown');
    expect(document.activeElement).toBe(subTrigger);
    press('ArrowDown');
    expect(document.activeElement).toBe(itemB); // skips over Sub X/Y
    press('ArrowDown');
    expect(document.activeElement).toBe(itemB); // no wrap
  });
});

describe('DropdownMenu submenu — open/close', () => {
  it('ArrowRight on the sub-trigger opens the submenu and focuses its first item', async () => {
    const c = mountNested();
    await openRoot(c);
    press('ArrowDown'); // focus sub-trigger
    expect(document.activeElement).toBe(q(document, 'dropdown-menu-sub-trigger'));
    press('ArrowRight');
    await microtask();
    expect(subOpen(c)).toBe(true);
    const subX = q(document, 'dropdown-menu-sub-content').querySelector('[role="menuitem"]');
    expect(document.activeElement).toBe(subX);
  });

  it('ArrowLeft in the submenu closes it and returns focus to the sub-trigger', async () => {
    const c = mountNested();
    await openRoot(c);
    q(document, 'dropdown-menu-sub-trigger').click();
    await microtask();
    expect(subOpen(c)).toBe(true);
    press('ArrowLeft');
    expect(subOpen(c)).toBe(false);
    expect(document.activeElement).toBe(q(document, 'dropdown-menu-sub-trigger'));
  });

  it('opens on hover after the delay and closes on leave after the delay', async () => {
    const c = mountNested();
    await openRoot(c);
    const subTrigger = q(document, 'dropdown-menu-sub-trigger');
    subTrigger.dispatchEvent(new Event('pointerenter', { bubbles: true }));
    flush2();
    expect(subOpen(c)).toBe(false); // within the 100ms delay
    vi.advanceTimersByTime(100);
    await microtask();
    expect(subOpen(c)).toBe(true);

    subTrigger.dispatchEvent(new Event('pointerleave', { bubbles: true }));
    flush2();
    vi.advanceTimersByTime(100);
    flush2();
    expect(subOpen(c)).toBe(false);
  });
});

describe('DropdownMenu submenu — dismissal', () => {
  it('Escape closes the innermost (submenu) first, leaving the root open', async () => {
    const c = mountNested();
    await openRoot(c);
    q(document, 'dropdown-menu-sub-trigger').click();
    await microtask();
    expect(subOpen(c)).toBe(true);

    press('Escape');
    expect(subOpen(c)).toBe(false);
    expect(rootOpen(c)).toBe(true); // LIFO — only the submenu closed
  });

  it('closing the root collapses the submenu', async () => {
    const c = mountNested();
    await openRoot(c);
    q(document, 'dropdown-menu-sub-trigger').click();
    await microtask();
    expect(subOpen(c)).toBe(true);

    // Close the ROOT directly via its trigger (a toggle) — NOT a layer dismiss,
    // so it collapses the whole menu regardless of the LIFO stack. The submenu
    // open state is derived from the parent, so it collapses too.
    q(c, 'dropdown-menu-trigger').click();
    flush2();
    expect(rootOpen(c)).toBe(false);
    expect(subOpen(c)).toBe(false); // derived from parent open
  });

  it('selecting a submenu item closes the whole menu', async () => {
    const c = mountNested();
    const onSelect = vi.fn();
    c.querySelector('ui-dropdown-menu')!.addEventListener('ui-select', onSelect as EventListener);
    await openRoot(c);
    q(document, 'dropdown-menu-sub-trigger').click();
    await microtask();
    const subX = q(document, 'dropdown-menu-sub-content').querySelector<HTMLElement>('[role="menuitem"]')!;
    subX.click();
    flush2();
    expect((onSelect.mock.calls[0]![0] as CustomEvent).detail).toEqual({ value: 'x' });
    expect(rootOpen(c)).toBe(false);
  });
});
