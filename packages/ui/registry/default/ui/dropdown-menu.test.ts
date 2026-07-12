/**
 * dropdown-menu.test.ts — Dropdown menu open/keyboard/select and interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from './dropdown-menu.js';

beforeEach(async () => {
  document.body.innerHTML = '';
  await Promise.resolve();
  await Promise.resolve();
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function mountMenu(items?: TemplateResult): HTMLElement {
  return mount(
    html`${DropdownMenu({
      children: html`${DropdownMenuTrigger({ children: 'Open' })}
      ${DropdownMenuContent({
        children:
          items ??
          html`${DropdownMenuItem({ value: 'edit', children: 'Edit' })}
          ${DropdownMenuItem({ value: 'copy', children: 'Copy' })}
          ${DropdownMenuItem({ value: 'delete', variant: 'destructive', disabled: true, children: 'Delete' })}`,
      })}`,
    })}`,
  );
}

const q = (root: ParentNode, slot: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
const isOpen = (_root: ParentNode) => !q(document, 'dropdown-menu-content').hasAttribute('hidden');
const items = (_root: ParentNode) =>
  Array.from(document.querySelectorAll<HTMLElement>('[role^="menuitem"]'));
function flush2(): void {
  flushEffects();
  flushEffects();
}
async function openMenu(c: HTMLElement): Promise<void> {
  q(c, 'dropdown-menu-trigger').click();
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

describe('DropdownMenu — structure and open', () => {
  it('wires the trigger to a role=menu content, closed by default', () => {
    const c = mountMenu();
    const trigger = q(c, 'dropdown-menu-trigger');
    const content = q(document, 'dropdown-menu-content');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(content.getAttribute('role')).toBe('menu');
    expect(trigger.getAttribute('aria-controls')).toBe(content.id);
    expect(content.hasAttribute('hidden')).toBe(true);
  });

  it('opens on click and focuses the first enabled item', async () => {
    const c = mountMenu();
    await openMenu(c);
    expect(isOpen(c)).toBe(true);
    const [edit] = items(c) as [HTMLElement];
    expect(document.activeElement).toBe(edit);
    expect(edit.hasAttribute('data-highlighted')).toBe(true);
  });

  it('trigger ArrowUp opens and focuses the last enabled item', async () => {
    const c = mountMenu();
    const trigger = q(c, 'dropdown-menu-trigger');
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    flush2();
    await Promise.resolve();
    flush2();
    // 'delete' is disabled, so the last *enabled* item is 'copy'.
    expect(document.activeElement).toBe(items(c)[1]);
  });
});

describe('DropdownMenu — keyboard navigation', () => {
  it('ArrowDown/ArrowUp move highlight; disabled items are skipped; no wrap', async () => {
    const c = mountMenu();
    await openMenu(c);
    const [edit, copy] = items(c) as [HTMLElement, HTMLElement];

    press('ArrowDown');
    expect(document.activeElement).toBe(copy);
    expect(copy.hasAttribute('data-highlighted')).toBe(true);
    expect(edit.hasAttribute('data-highlighted')).toBe(false);

    // 'delete' disabled → ArrowDown stays on 'copy' (no wrap, skip disabled).
    press('ArrowDown');
    expect(document.activeElement).toBe(copy);

    press('ArrowUp');
    expect(document.activeElement).toBe(edit);
    press('ArrowUp'); // already first, no wrap
    expect(document.activeElement).toBe(edit);
  });

  it('typeahead focuses the item whose label matches the typed key', async () => {
    const c = mountMenu();
    await openMenu(c);
    press('c'); // "Copy"
    expect(document.activeElement).toBe(items(c)[1]);
  });
});

describe('DropdownMenu — pointer', () => {
  it('pointerover focuses (highlights) the item under the pointer', async () => {
    const c = mountMenu();
    await openMenu(c);
    const copy = items(c)[1]!;
    copy.dispatchEvent(new Event('pointerover', { bubbles: true }));
    flush2();
    expect(document.activeElement).toBe(copy);
    expect(copy.hasAttribute('data-highlighted')).toBe(true);
  });
});

describe('DropdownMenu — selection', () => {
  it('activating an item dispatches ui-select and closes the menu', async () => {
    const c = mountMenu();
    const onSelect = vi.fn();
    c.querySelector('ui-dropdown-menu')!.addEventListener('ui-select', onSelect as EventListener);
    await openMenu(c);
    items(c)[0]!.click();
    flush2();
    expect((onSelect.mock.calls[0]![0] as CustomEvent).detail).toEqual({ value: 'edit' });
    expect(isOpen(c)).toBe(false);
  });

  it('a listener can preventDefault to keep the menu open', async () => {
    const c = mountMenu();
    c.querySelector('ui-dropdown-menu')!.addEventListener('ui-select', (e) => e.preventDefault());
    await openMenu(c);
    items(c)[0]!.click();
    flush2();
    expect(isOpen(c)).toBe(true);
  });

  it('Enter activates the highlighted item', async () => {
    const c = mountMenu();
    const onSelect = vi.fn();
    c.querySelector('ui-dropdown-menu')!.addEventListener('ui-select', onSelect as EventListener);
    await openMenu(c);
    press('Enter');
    expect(onSelect).toHaveBeenCalled();
  });

  it('a disabled item does not activate on click', async () => {
    const c = mountMenu();
    const onSelect = vi.fn();
    c.querySelector('ui-dropdown-menu')!.addEventListener('ui-select', onSelect as EventListener);
    await openMenu(c);
    items(c)[2]!.click(); // 'delete' is disabled
    flush2();
    expect(onSelect).not.toHaveBeenCalled();
    expect(isOpen(c)).toBe(true);
  });
});

describe('DropdownMenu — checkbox + radio items', () => {
  it('checkbox item toggles aria-checked and shows an indicator', async () => {
    const c = mountMenu(
      html`${DropdownMenuCheckboxItem({ value: 'wrap', children: 'Word wrap' })}`,
    );
    await openMenu(c);
    const box = q(document, 'dropdown-menu-checkbox-item');
    expect(box.getAttribute('aria-checked')).toBe('false');
    box.click();
    flush2();
    // Menu closes on select by default; the checked state flipped first.
    expect(box.getAttribute('aria-checked')).toBe('true');
  });

  it('radio items reflect the group value', async () => {
    const value = signal<string | undefined>('a');
    const c = mountMenu(
      DropdownMenuRadioGroup({
        value,
        children: html`${DropdownMenuRadioItem({ value: 'a', children: 'A' })}
        ${DropdownMenuRadioItem({ value: 'b', children: 'B' })}`,
      }),
    );
    await openMenu(c);
    const radios = document.querySelectorAll('[role="menuitemradio"]');
    expect(radios[0]!.getAttribute('aria-checked')).toBe('true');
    expect(radios[1]!.getAttribute('aria-checked')).toBe('false');
  });
});

describe('DropdownMenu — inset/variant/static slots', () => {
  it('renders label/separator/shortcut and item data attributes', async () => {
    const c = mountMenu(
      html`${DropdownMenuLabel({ inset: true, children: 'Actions' })}
      ${DropdownMenuSeparator({})}
      ${DropdownMenuItem({
        inset: true,
        children: html`Save ${DropdownMenuShortcut({ children: '⌘S' })}`,
      })}`,
    );
    await openMenu(c);
    expect(q(document, 'dropdown-menu-label').hasAttribute('data-inset')).toBe(true);
    expect(q(document, 'dropdown-menu-separator').getAttribute('role')).toBe('separator');
    expect(q(document, 'dropdown-menu-shortcut').textContent).toBe('⌘S');
    const item = q(document, 'dropdown-menu-item');
    expect(item.hasAttribute('data-inset')).toBe(true);
    expect(item.getAttribute('data-variant')).toBe('default');
  });
});

describe('DropdownMenu — dismissal + focus restore', () => {
  it('closes on Escape and restores focus to the trigger', async () => {
    const c = mountMenu();
    const trigger = q(c, 'dropdown-menu-trigger') as HTMLButtonElement;
    trigger.focus();
    await openMenu(c);
    press('Escape');
    await Promise.resolve();
    expect(isOpen(c)).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('does not dismiss on pointerdown on the trigger (guard)', async () => {
    const c = mountMenu();
    await openMenu(c);
    q(c, 'dropdown-menu-trigger').dispatchEvent(
      new Event('pointerdown', { bubbles: true, cancelable: true }),
    );
    flush2();
    expect(isOpen(c)).toBe(true);
  });
});

describe('DropdownMenu — portal', () => {
  it('moves the content to <body> by default, trigger stays put', () => {
    const c = mountMenu();
    const content = q(document, 'dropdown-menu-content');
    expect(content.parentElement).toBe(document.body);
    expect(c.contains(content)).toBe(false);
    expect(c.contains(q(c, 'dropdown-menu-trigger'))).toBe(true);
  });

  it('portal={false} keeps the content inline', () => {
    const c = mount(
      html`${DropdownMenu({
        children: html`${DropdownMenuTrigger({ children: 'Open' })}
        ${DropdownMenuContent({ portal: false, children: DropdownMenuItem({ children: 'X' }) })}`,
      })}`,
    );
    flush2();
    const content = q(document, 'dropdown-menu-content');
    expect(content.parentElement).not.toBe(document.body);
    expect(c.contains(content)).toBe(true);
  });

  it('dismissal + focus restore still work from the portaled content', async () => {
    const c = mountMenu();
    const trigger = q(c, 'dropdown-menu-trigger') as HTMLButtonElement;
    trigger.focus();
    await openMenu(c);
    expect(isOpen(c)).toBe(true);
    press('Escape');
    await Promise.resolve();
    expect(isOpen(c)).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('removes the portaled content when the menu is disconnected (no leak)', async () => {
    const c = mountMenu();
    expect(document.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeNull();
    c.querySelector('ui-dropdown-menu')!.remove();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('[data-slot="dropdown-menu-content"]')).toBeNull();
  });
});

describe('DropdownMenu — misuse', () => {
  it('an item used outside <ui-dropdown-menu> renders an error fallback', () => {
    const host = document.createElement('ui-dropdown-menu-item');
    document.body.appendChild(host);
    expect(host.querySelector('[role="menuitem"]')).toBeNull();
    expect(host.textContent).toContain('Error');
  });
});
