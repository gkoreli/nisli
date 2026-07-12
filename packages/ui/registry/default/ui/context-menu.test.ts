/**
 * context-menu.test.ts — right-click menu open/keyboard/select + submenu.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flush, flushEffects, html, signal, type TemplateResult } from '@nisli/core';
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
  CONTEXT_MENU_LONG_PRESS_MS,
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

function pointer(target: Element, type: string, x: number, y: number, pointerType = 'touch'): Event {
  const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  target.dispatchEvent(event);
  flush2();
  return event;
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

describe('ContextMenu — touch long press (UI-63)', () => {
  it('opens at the touch point only after the Radix 700ms duration', async () => {
    const c = mountMenu();
    const trigger = q(c, 'context-menu-trigger');
    pointer(trigger, 'pointerdown', 72, 96);
    vi.advanceTimersByTime(CONTEXT_MENU_LONG_PRESS_MS - 1);
    flush2();
    expect(isOpen(c)).toBe(false);
    vi.advanceTimersByTime(1);
    flush2();
    await Promise.resolve();
    flush2();
    expect(isOpen(c)).toBe(true);
    expect(contentFor(c).style.position).toBe('fixed');
  });

  it.each(['pointerup', 'pointercancel'])('%s cancels a pending long press', (type) => {
    const c = mountMenu();
    const trigger = q(c, 'context-menu-trigger');
    pointer(trigger, 'pointerdown', 20, 20);
    pointer(trigger, type, 20, 20);
    vi.advanceTimersByTime(CONTEXT_MENU_LONG_PRESS_MS + 1);
    flush2();
    expect(isOpen(c)).toBe(false);
  });

  it('movement beyond 10px and scroll cancel, while small jitter does not', () => {
    const moved = mountMenu();
    let trigger = q(moved, 'context-menu-trigger');
    pointer(trigger, 'pointerdown', 20, 20);
    pointer(trigger, 'pointermove', 31, 20);
    vi.advanceTimersByTime(CONTEXT_MENU_LONG_PRESS_MS + 1);
    expect(isOpen(moved)).toBe(false);

    const scrolled = mountMenu();
    trigger = q(scrolled, 'context-menu-trigger');
    pointer(trigger, 'pointerdown', 20, 20);
    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(CONTEXT_MENU_LONG_PRESS_MS + 1);
    expect(isOpen(scrolled)).toBe(false);

    const jitter = mountMenu();
    trigger = q(jitter, 'context-menu-trigger');
    pointer(trigger, 'pointerdown', 20, 20);
    pointer(trigger, 'pointermove', 25, 25);
    vi.advanceTimersByTime(CONTEXT_MENU_LONG_PRESS_MS);
    flush2();
    expect(isOpen(jitter)).toBe(true);
  });

  it('suppresses the synthetic click/contextmenu after long press', () => {
    const c = mountMenu();
    const trigger = q(c, 'context-menu-trigger');
    pointer(trigger, 'pointerdown', 20, 20);
    vi.advanceTimersByTime(CONTEXT_MENU_LONG_PRESS_MS);
    flush2();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    trigger.dispatchEvent(click);
    const menu = new MouseEvent('contextmenu', { clientX: 20, clientY: 20, bubbles: true, cancelable: true });
    trigger.dispatchEvent(menu);
    expect(click.defaultPrevented).toBe(true);
    expect(menu.defaultPrevented).toBe(true);
    expect(isOpen(c)).toBe(true);
  });

  it('disconnect before 700ms clears the pending timer without opening', async () => {
    const c = mountMenu();
    const root = c.querySelector('ui-context-menu') as HTMLElement;
    const onOpen = vi.fn();
    root.addEventListener('ui-open-change', onOpen);
    pointer(q(c, 'context-menu-trigger'), 'pointerdown', 20, 20);
    root.remove();
    await Promise.resolve();
    vi.advanceTimersByTime(CONTEXT_MENU_LONG_PRESS_MS + 1);
    flush2();
    expect(onOpen).not.toHaveBeenCalled();
    expect(root.hasAttribute('open')).toBe(false);
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

  it('controlled checkbox: a pinned `checked` signal is parent-authoritative — a click cannot dislodge it', async () => {
    const checked = signal<boolean | undefined>(true);
    const c = mountMenu(
      html`${ContextMenuCheckboxItem({ checked, value: 'grid', children: 'Grid' })}`,
    );
    await rightClick(c);
    const box = q(document, 'context-menu-checkbox-item');
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

describe('ContextMenu — open is attribute-as-truth (UI-30)', () => {
  it('a post-mount setAttribute("open") toggles the menu, and openAt reflects back', async () => {
    const c = mountMenu();
    const host = c.querySelector('ui-context-menu')!;
    expect(isOpen(c)).toBe(false);
    expect(host.hasAttribute('open')).toBe(false);

    host.setAttribute('open', '');
    flush2();
    expect(isOpen(c)).toBe(true); // opened via the attribute

    host.removeAttribute('open');
    flush2();
    expect(isOpen(c)).toBe(false);

    // A right-click (openAt → setOpen) reflects the resolved state to [open].
    await rightClick(c);
    expect(host.hasAttribute('open')).toBe(true);
  });

  it('mounts open from literal `open` markup, then a real select closes it', async () => {
    // The `open` attribute is present at PARSE, so the SEED-AT-CONNECT path (not
    // attributeChangedCallback) must render the content OPEN at connect.
    document.body.innerHTML =
      '<ui-context-menu open>' +
      '<ui-context-menu-trigger>area</ui-context-menu-trigger>' +
      '<ui-context-menu-content portal="false">' +
      '<ui-context-menu-item value="edit">Edit</ui-context-menu-item>' +
      '</ui-context-menu-content>' +
      '</ui-context-menu>';
    await Promise.resolve();
    await Promise.resolve();

    const host = document.querySelector('ui-context-menu')!;
    const content = q(document, 'context-menu-content');
    expect(content.hasAttribute('hidden')).toBe(false); // open at connect
    expect(host.hasAttribute('open')).toBe(true);

    // Close via the COMPONENT path (activating an item selects + closes).
    q(document, 'context-menu-item').click();
    flush2();
    expect(content.hasAttribute('hidden')).toBe(true);
    expect(host.hasAttribute('open')).toBe(false); // uncontrolled → attr cleared
  });

  it('controlled (factory open signal): setOpen is guarded, the parent stays in control', () => {
    const open = signal<boolean | undefined>(true);
    const c = mount(
      html`${ContextMenu({
        open,
        children: html`${ContextMenuTrigger({ children: 'area' })}
        ${ContextMenuContent({
          portal: false,
          children: ContextMenuItem({ value: 'edit', children: 'Edit' }),
        })}`,
      })}`,
    );
    const host = c.querySelector('ui-context-menu') as HTMLElement;
    const onChange = vi.fn();
    host.addEventListener('ui-open-change', onChange as EventListener);
    flush2();
    // The reflect effect mirrors the pinned signal onto the attribute.
    expect(host.hasAttribute('open')).toBe(true);
    expect(q(document, 'context-menu-content').hasAttribute('hidden')).toBe(false);

    // A real select calls state.setOpen(false). Because `open` is a pinned factory
    // prop (controlled), the guard skips the attribute write — the parent stays in
    // control (attr NOT cleared, content still open) and only the event fires.
    q(document, 'context-menu-item').click();
    flush2();
    expect(host.hasAttribute('open')).toBe(true); // guard held
    expect(q(document, 'context-menu-content').hasAttribute('hidden')).toBe(false);
    expect((onChange.mock.calls.at(-1)![0] as CustomEvent).detail).toEqual({ open: false });

    // The parent responds by updating the signal → reflect effect closes it.
    open.value = false;
    flush2();
    expect(host.hasAttribute('open')).toBe(false);
    expect(q(document, 'context-menu-content').hasAttribute('hidden')).toBe(true);
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
