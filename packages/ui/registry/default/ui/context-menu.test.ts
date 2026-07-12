/**
 * context-menu.test.ts — right-click menu open/keyboard/select + submenu.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flush, flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from './context-menu.js';

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

function mountMenu(items?: TemplateResult): HTMLElement {
  return mount(
    html`${ContextMenu({
      children: html`${ContextMenuTrigger({ children: 'Right-click here' })}
      ${ContextMenuContent({
        children:
          items ??
          html`${ContextMenuItem({ value: 'edit', children: 'Edit' })}
          ${ContextMenuItem({ value: 'copy', children: 'Copy' })}
          ${ContextMenuItem({ value: 'delete', disabled: true, children: 'Delete' })}`,
      })}`,
    })}`,
  );
}

const q = (root: ParentNode, slot: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
const contentFor = (root: ParentNode): HTMLElement =>
  document.getElementById(q(root, 'context-menu-trigger').getAttribute('aria-controls')!)!;
const isOpen = (root: ParentNode) => !contentFor(root).hasAttribute('hidden');
const items = (root: ParentNode) =>
  Array.from(contentFor(root).querySelectorAll<HTMLElement>('[role^="menuitem"]'));
function flush2(): void {
  flush();
}
async function rightClick(c: HTMLElement, x = 120, y = 80): Promise<void> {
  q(c, 'context-menu-trigger').dispatchEvent(
    new MouseEvent('contextmenu', { clientX: x, clientY: y, bubbles: true, cancelable: true }),
  );
  flush2();
  await Promise.resolve();
  flush2();
}
function press(key: string): void {
  (document.activeElement ?? document.body).dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  );
  flush2();
}

describe('ContextMenu — open on right-click', () => {
  it('is closed until a contextmenu event, then opens focused on the first item', async () => {
    const c = mountMenu();
    expect(contentFor(c).getAttribute('role')).toBe('menu');
    expect(isOpen(c)).toBe(false);

    await rightClick(c);
    expect(isOpen(c)).toBe(true);
    expect(document.activeElement).toBe(items(c)[0]);
    // positioned as a fixed floating layer at the cursor
    expect(contentFor(c).style.position).toBe('fixed');
  });

  it('preventDefault stops the native browser menu', async () => {
    const c = mountMenu();
    const ev = new MouseEvent('contextmenu', { clientX: 10, clientY: 10, bubbles: true, cancelable: true });
    q(c, 'context-menu-trigger').dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe('ContextMenu — keyboard + selection', () => {
  it('ArrowDown/ArrowUp move highlight and skip disabled items', async () => {
    const c = mountMenu();
    await rightClick(c);
    const [edit, copy] = items(c) as [HTMLElement, HTMLElement];
    press('ArrowDown');
    expect(document.activeElement).toBe(copy);
    press('ArrowDown'); // 'delete' disabled → no move (no wrap)
    expect(document.activeElement).toBe(copy);
    press('ArrowUp');
    expect(document.activeElement).toBe(edit);
  });

  it('typeahead focuses a matching item', async () => {
    const c = mountMenu();
    await rightClick(c);
    press('c'); // Copy
    expect(document.activeElement).toBe(items(c)[1]);
  });

  it('activating an item dispatches ui-select and closes; preventDefault keeps it open', async () => {
    const c = mountMenu();
    const onSelect = vi.fn();
    c.querySelector('ui-context-menu')!.addEventListener('ui-select', onSelect as EventListener);
    await rightClick(c);
    items(c)[0]!.click();
    flush2();
    expect((onSelect.mock.calls[0]![0] as CustomEvent).detail).toEqual({ value: 'edit' });
    expect(isOpen(c)).toBe(false);

    const c2 = mountMenu();
    c2.querySelector('ui-context-menu')!.addEventListener('ui-select', (e) => e.preventDefault());
    await rightClick(c2);
    items(c2)[0]!.click();
    flush2();
    expect(isOpen(c2)).toBe(true);
  });
});

describe('ContextMenu — dismissal', () => {
  it('closes on Escape', async () => {
    const c = mountMenu();
    await rightClick(c);
    press('Escape');
    expect(isOpen(c)).toBe(false);
  });

  it('closes on outside pointerdown', async () => {
    const c = mountMenu();
    await rightClick(c);
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    flush2();
    expect(isOpen(c)).toBe(false);
  });
});

describe('ContextMenu — checkbox + labels/separator', () => {
  it('checkbox item toggles aria-checked; label/separator render', async () => {
    const c = mountMenu(
      html`${ContextMenuLabel({ children: 'View' })}
      ${ContextMenuSeparator({})}
      ${ContextMenuCheckboxItem({ value: 'grid', children: 'Grid' })}`,
    );
    await rightClick(c);
    expect(q(document, 'context-menu-label').textContent).toBe('View');
    expect(q(document, 'context-menu-separator').getAttribute('role')).toBe('separator');
    const box = q(document, 'context-menu-checkbox-item');
    expect(box.getAttribute('aria-checked')).toBe('false');
    box.click();
    flush2();
    expect(box.getAttribute('aria-checked')).toBe('true');
  });
});

describe('ContextMenu — submenu', () => {
  function mountNested(): HTMLElement {
    return mount(
      html`${ContextMenu({
        children: html`${ContextMenuTrigger({ children: 'area' })}
        ${ContextMenuContent({
          children: html`${ContextMenuItem({ value: 'a', children: 'Item A' })}
          ${ContextMenuSub({
            children: html`${ContextMenuSubTrigger({ children: 'More' })}
            ${ContextMenuSubContent({
              children: html`${ContextMenuItem({ value: 'x', children: 'Sub X' })}`,
            })}`,
          })}`,
        })}`,
      })}`,
    );
  }

  it('ArrowRight opens the submenu (scoped items), ArrowLeft closes it', async () => {
    const c = mountNested();
    await rightClick(c);
    // Parent roving sees Item A + sub-trigger only, not Sub X.
    expect(document.activeElement).toBe(items(c)[0]);
    press('ArrowDown');
    expect(document.activeElement).toBe(q(document, 'context-menu-sub-trigger'));

    press('ArrowRight');
    await Promise.resolve();
    flush2();
    expect(q(document, 'context-menu-sub-content').hasAttribute('hidden')).toBe(false);

    press('ArrowLeft');
    expect(q(document, 'context-menu-sub-content').hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(q(document, 'context-menu-sub-trigger'));
  });
});

describe('ContextMenu — portal', () => {
  it('moves the content to <body> by default, trigger stays put', () => {
    const c = mountMenu();
    const content = contentFor(c);
    expect(content.parentElement).toBe(document.body);
    expect(c.contains(content)).toBe(false);
    expect(c.contains(q(c, 'context-menu-trigger'))).toBe(true);
  });

  it('portal={false} keeps the content inline', () => {
    const c = mount(
      html`${ContextMenu({
        children: html`${ContextMenuTrigger({ children: 'area' })}
        ${ContextMenuContent({ portal: false, children: ContextMenuItem({ value: 'a', children: 'A' }) })}`,
      })}`,
    );
    flush2();
    const content = contentFor(c);
    expect(content.parentElement).not.toBe(document.body);
    expect(c.contains(content)).toBe(true);
  });

  it('ui-select still reaches a listener on <ui-context-menu> from portaled items', async () => {
    const c = mountMenu();
    const onSelect = vi.fn();
    c.querySelector('ui-context-menu')!.addEventListener('ui-select', onSelect as EventListener);
    await rightClick(c);
    items(c)[0]!.click();
    flush2();
    expect(onSelect).toHaveBeenCalled();
  });

  it('removes the portaled content when the menu is disconnected (no leak)', async () => {
    const c = mountMenu();
    expect(document.querySelector('[data-slot="context-menu-content"]')).not.toBeNull();
    c.querySelector('ui-context-menu')!.remove();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('[data-slot="context-menu-content"]')).toBeNull();
  });
});

describe('ContextMenu — misuse', () => {
  it('an item used outside <ui-context-menu> renders an error fallback', () => {
    const __err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const host = document.createElement('ui-context-menu-item');
    document.body.appendChild(host);
    expect(host.querySelector('[role="menuitem"]')).toBeNull();
    expect(host.textContent).toContain('Error');
    expect(String(__err.mock.calls.flat())).toContain('must be used inside <ui-context-menu>');
    __err.mockRestore();
  });
});
