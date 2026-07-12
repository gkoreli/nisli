/**
 * drawer.test.ts — Drawer open/close, ARIA, dismissal, and drag-to-dismiss.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal, flush, flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from './drawer.js';

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

function mountDrawer(
  opts: {
    defaultOpen?: boolean;
    open?: ReturnType<typeof signal<boolean | undefined>>;
    direction?: 'top' | 'bottom' | 'left' | 'right';
    extra?: TemplateResult;
  } = {},
): HTMLElement {
  const { defaultOpen, open, direction, extra } = opts;
  return mount(
    html`${Drawer({
      defaultOpen,
      open: open as unknown as boolean,
      direction,
      children: html`${DrawerTrigger({ children: 'Open' })}
      ${DrawerContent({
        children: html`${DrawerHeader({
          children: html`${DrawerTitle({ children: 'Title' })}
          ${DrawerDescription({ children: 'Description' })}`,
        })}
        ${extra ?? ''}
        ${DrawerFooter({ children: DrawerClose({ children: 'Cancel' }) })}`,
      })}`,
    })}`,
  );
}

const q = (root: ParentNode, slot: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
const isOpen = (root: ParentNode) => !q(root, 'drawer-content').hasAttribute('hidden');
function flush2(): void {
  flush();
}
function pointer(el: EventTarget, type: string, clientY: number): void {
  el.dispatchEvent(new MouseEvent(type, { clientY, clientX: 0, bubbles: true, cancelable: true }));
}
/** Simulate a drag on the content from `fromY` to `toY`. */
function drag(content: HTMLElement, fromY: number, toY: number, target: EventTarget = content): void {
  pointer(target, 'pointerdown', fromY);
  pointer(document, 'pointermove', toY);
  pointer(document, 'pointerup', toY);
  flush2();
}

describe('Drawer — structure and ARIA', () => {
  it('is a role=dialog panel with a bottom direction + drag handle by default', () => {
    const c = mountDrawer({ defaultOpen: true });
    const content = q(c, 'drawer-content');
    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.getAttribute('aria-modal')).toBe('true');
    expect(content.getAttribute('data-vaul-drawer-direction')).toBe('bottom');
    expect(q(c, 'drawer-handle')).not.toBeNull();
    expect(content.getAttribute('aria-labelledby')).toBe(q(c, 'drawer-title').id);
    expect(content.getAttribute('aria-describedby')).toBe(q(c, 'drawer-description').id);
  });

  it('reflects an explicit direction', () => {
    const c = mountDrawer({ defaultOpen: true, direction: 'right' });
    expect(q(c, 'drawer-content').getAttribute('data-vaul-drawer-direction')).toBe('right');
  });
});

describe('Drawer — open/close', () => {
  it('is closed by default and opens on the trigger', () => {
    const c = mountDrawer();
    expect(isOpen(c)).toBe(false);
    q(c, 'drawer-trigger').click();
    flush2();
    expect(isOpen(c)).toBe(true);
    expect(q(c, 'drawer-overlay').hasAttribute('hidden')).toBe(false);
  });

  it('dispatches ui-open-change', () => {
    const c = mountDrawer();
    const host = c.querySelector('ui-drawer') as HTMLElement;
    const onChange = vi.fn();
    host.addEventListener('ui-open-change', onChange as EventListener);
    q(c, 'drawer-trigger').click();
    flush2();
    expect((onChange.mock.calls[0]![0] as CustomEvent).detail).toEqual({ open: true });
  });

  it('closes on Escape, outside pointerdown, and DrawerClose', () => {
    const a = mountDrawer({ defaultOpen: true });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    flush2();
    expect(isOpen(a)).toBe(false);

    const b = mountDrawer({ defaultOpen: true });
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    flush2();
    expect(isOpen(b)).toBe(false);

    const d = mountDrawer({ defaultOpen: true });
    q(d, 'drawer-close').click();
    flush2();
    expect(isOpen(d)).toBe(false);
  });
});

describe('Drawer — drag to dismiss', () => {
  it('dismisses when dragged past the threshold', () => {
    const c = mountDrawer({ defaultOpen: true });
    drag(q(c, 'drawer-content'), 100, 400); // large downward drag
    expect(isOpen(c)).toBe(false);
  });

  it('snaps back (stays open) for a small drag', () => {
    const c = mountDrawer({ defaultOpen: true });
    drag(q(c, 'drawer-content'), 100, 130); // 30px < threshold
    expect(isOpen(c)).toBe(true);
    // transform is reset after the gesture
    expect(q(c, 'drawer-content').style.transform).toBe('');
  });

  it('does not dismiss when dragging upward (away from the dismiss axis)', () => {
    const c = mountDrawer({ defaultOpen: true });
    drag(q(c, 'drawer-content'), 400, 100); // upward for a bottom drawer
    expect(isOpen(c)).toBe(true);
  });

  it('ignores drags that start on an interactive control', () => {
    const c = mountDrawer({
      defaultOpen: true,
      extra: html`<button data-testid="inner" type="button">Action</button>`,
    });
    const button = c.querySelector('[data-testid="inner"]')!;
    drag(q(c, 'drawer-content'), 100, 400, button);
    expect(isOpen(c)).toBe(true);
  });

  it('does not drag when closed', () => {
    const c = mountDrawer();
    drag(q(c, 'drawer-content'), 100, 400);
    expect(isOpen(c)).toBe(false); // stays closed, no crash
  });
});

describe('Drawer — controlled', () => {
  it('reflects an externally controlled open signal', () => {
    const open = signal<boolean | undefined>(false);
    const c = mountDrawer({ open });
    expect(isOpen(c)).toBe(false);
    open.value = true;
    flush2();
    expect(isOpen(c)).toBe(true);
  });
});

describe('Drawer — misuse', () => {
  it('content used outside <ui-drawer> renders an error fallback', () => {
    const __err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const host = document.createElement('ui-drawer-content');
    document.body.appendChild(host);
    expect(host.querySelector('[data-slot="drawer-content"]')).toBeNull();
    expect(host.textContent).toContain('Error');
    expect(String(__err.mock.calls.flat())).toContain('must be used inside <ui-drawer>');
    __err.mockRestore();
  });
});

describe('Drawer — plain custom element usage', () => {
  it('reads default-open + direction from attributes and projects content', async () => {
    document.body.innerHTML =
      '<ui-drawer default-open direction="left">' +
      '<ui-drawer-content>' +
      '<ui-drawer-title>Menu</ui-drawer-title>' +
      '</ui-drawer-content>' +
      '</ui-drawer>';
    await Promise.resolve();
    await Promise.resolve();
    const c = document.querySelector('ui-drawer')!;
    const content = q(c, 'drawer-content');
    expect(content.getAttribute('data-vaul-drawer-direction')).toBe('left');
    expect(content.hasAttribute('hidden')).toBe(false);
    expect(q(c, 'drawer-title').textContent).toBe('Menu');
  });
});
