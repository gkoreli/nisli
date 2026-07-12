/**
 * dropdown-menu.test.ts — Dropdown menu open/keyboard/select and interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal, flush, flushEffects, html, type TemplateResult } from '@nisli/core';
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
  flush();
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

  it('controlled checkbox: a pinned `checked` signal is parent-authoritative — a click cannot dislodge it', async () => {
    const checked = signal<boolean | undefined>(true);
    const c = mountMenu(
      html`${DropdownMenuCheckboxItem({ checked, value: 'wrap', children: 'Word wrap' })}`,
    );
    await openMenu(c);
    const box = q(document, 'dropdown-menu-checkbox-item');
    // The pinned signal drives aria-checked (controlled).
    expect(box.getAttribute('aria-checked')).toBe('true');

    // A click toggles the internal signal, but the pin discriminator keeps the
    // rendered state parent-authoritative — the click cannot flip it.
    box.click();
    flush2();
    expect(box.getAttribute('aria-checked')).toBe('true');

    // Only the parent updating the signal changes it.
    checked.value = false;
    flush2();
    expect(box.getAttribute('aria-checked')).toBe('false');
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

describe('DropdownMenu — open is attribute-as-truth (UI-30)', () => {
  it('a post-mount setAttribute("open") toggles the menu, and setOpen reflects back', async () => {
    const c = mountMenu();
    const host = c.querySelector('ui-dropdown-menu')!;
    expect(isOpen(c)).toBe(false);
    expect(host.hasAttribute('open')).toBe(false);

    // External attribute write opens it (native dialog[open] semantics).
    host.setAttribute('open', '');
    flush2();
    expect(isOpen(c)).toBe(true);

    // Removing the attribute closes it.
    host.removeAttribute('open');
    flush2();
    expect(isOpen(c)).toBe(false);

    // And the resolved state reflects BACK to the attribute (trigger open).
    await openMenu(c);
    expect(host.hasAttribute('open')).toBe(true);
  });

  it('mounts open from literal `open` markup, then a real select closes it', async () => {
    // The `open` attribute is present at PARSE, so the SEED-AT-CONNECT path (not
    // attributeChangedCallback) must render the content OPEN at connect.
    document.body.innerHTML =
      '<ui-dropdown-menu open>' +
      '<ui-dropdown-menu-trigger>Open</ui-dropdown-menu-trigger>' +
      '<ui-dropdown-menu-content portal="false">' +
      '<ui-dropdown-menu-item value="edit">Edit</ui-dropdown-menu-item>' +
      '</ui-dropdown-menu-content>' +
      '</ui-dropdown-menu>';
    await Promise.resolve();
    await Promise.resolve();

    const host = document.querySelector('ui-dropdown-menu')!;
    const content = q(document, 'dropdown-menu-content');
    expect(content.hasAttribute('hidden')).toBe(false); // open at connect
    expect(host.hasAttribute('open')).toBe(true);

    // Close via the COMPONENT path (activating an item selects + closes).
    q(document, 'dropdown-menu-item').click();
    flush2();
    expect(content.hasAttribute('hidden')).toBe(true);
    expect(host.hasAttribute('open')).toBe(false); // uncontrolled → attr cleared
  });

  it('controlled (factory open signal): setOpen is guarded, the parent stays in control', () => {
    const open = signal<boolean | undefined>(true);
    const c = mount(
      html`${DropdownMenu({
        open,
        children: html`${DropdownMenuTrigger({ children: 'Open' })}
        ${DropdownMenuContent({
          portal: false,
          children: DropdownMenuItem({ value: 'edit', children: 'Edit' }),
        })}`,
      })}`,
    );
    const host = c.querySelector('ui-dropdown-menu') as HTMLElement;
    const onChange = vi.fn();
    host.addEventListener('ui-open-change', onChange as EventListener);
    flush2();
    // The reflect effect mirrors the pinned signal onto the attribute.
    expect(host.hasAttribute('open')).toBe(true);
    expect(q(document, 'dropdown-menu-content').hasAttribute('hidden')).toBe(false);

    // A real select calls state.setOpen(false). Because `open` is a pinned factory
    // prop (controlled), the guard skips the attribute write — the parent stays in
    // control (attr NOT cleared, content still open) and only the event fires.
    q(document, 'dropdown-menu-item').click();
    flush2();
    expect(host.hasAttribute('open')).toBe(true); // guard held
    expect(q(document, 'dropdown-menu-content').hasAttribute('hidden')).toBe(false);
    expect((onChange.mock.calls.at(-1)![0] as CustomEvent).detail).toEqual({ open: false });

    // The parent responds by updating the signal → reflect effect closes it.
    open.value = false;
    flush2();
    expect(host.hasAttribute('open')).toBe(false);
    expect(q(document, 'dropdown-menu-content').hasAttribute('hidden')).toBe(true);
  });
});

describe('DropdownMenu — misuse', () => {
  it('an item used outside <ui-dropdown-menu> renders an error fallback', () => {
    const __err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const host = document.createElement('ui-dropdown-menu-item');
    document.body.appendChild(host);
    expect(host.querySelector('[role="menuitem"]')).toBeNull();
    expect(host.textContent).toContain('Error');
    expect(String(__err.mock.calls.flat())).toContain('must be used inside <ui-dropdown-menu>');
    __err.mockRestore();
  });
});
