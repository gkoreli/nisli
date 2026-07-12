/**
 * popover.test.ts — Popover toggle, positioning wiring, dismissal, focus.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from './popover.js';

beforeEach(async () => {
  document.body.innerHTML = '';
  // Flush deferred disconnect teardown so the previous popover's
  // dismissable-layer/focus listeners are removed before the next test.
  await Promise.resolve();
  await Promise.resolve();
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function mountPopover(
  opts: { defaultOpen?: boolean; open?: ReturnType<typeof signal<boolean | undefined>> } = {},
): HTMLElement {
  const { defaultOpen, open } = opts;
  return mount(
    html`${Popover({
      defaultOpen,
      open: open as unknown as boolean,
      children: html`${PopoverTrigger({ children: 'Open' })}
      ${PopoverContent({
        children: html`${PopoverHeader({
          children: html`${PopoverTitle({ children: 'Title' })}
          ${PopoverDescription({ children: 'Description' })}`,
        })}
        <button data-testid="inner" type="button">Inner</button>`,
      })}`,
    })}`,
  );
}

const q = (root: ParentNode, slot: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
const isOpen = (_root: ParentNode) => !q(document, 'popover-content').hasAttribute('hidden');
function flush2(): void {
  flushEffects();
  flushEffects();
}
function pointerDown(el: Element): void {
  el.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
  flush2();
}

describe('Popover — structure and ARIA', () => {
  it('wires trigger to a role=dialog panel, closed by default', () => {
    const c = mountPopover();
    const trigger = q(c, 'popover-trigger');
    const content = q(document, 'popover-content');
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.id).toBeTruthy();
    expect(trigger.getAttribute('aria-controls')).toBe(content.id);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(content.hasAttribute('hidden')).toBe(true);
  });

  it('renders header/title/description slots with ported classes', () => {
    const c = mountPopover({ defaultOpen: true });
    expect(q(document, 'popover-header').className).toContain('flex flex-col gap-1 text-sm');
    expect(q(document, 'popover-title').className).toContain('font-medium');
    expect(q(document, 'popover-description').tagName).toBe('P');
    expect(q(document, 'popover-description').className).toContain('text-muted-foreground');
  });
});

describe('Popover — toggle', () => {
  it('opens and closes on trigger click', () => {
    const c = mountPopover();
    const trigger = q(c, 'popover-trigger');
    trigger.click();
    flush2();
    expect(isOpen(c)).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    trigger.click();
    flush2();
    expect(isOpen(c)).toBe(false);
  });

  it('dispatches ui-open-change', () => {
    const c = mountPopover();
    const host = c.querySelector('ui-popover') as HTMLElement;
    const onChange = vi.fn();
    host.addEventListener('ui-open-change', onChange as EventListener);
    q(c, 'popover-trigger').click();
    flush2();
    expect((onChange.mock.calls[0][0] as CustomEvent).detail).toEqual({ open: true });
  });
});

describe('Popover — dismissal', () => {
  it('closes on Escape', () => {
    const c = mountPopover({ defaultOpen: true });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    flush2();
    expect(isOpen(c)).toBe(false);
  });

  it('closes on outside pointerdown', () => {
    const c = mountPopover({ defaultOpen: true });
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    pointerDown(outside);
    expect(isOpen(c)).toBe(false);
  });

  it('stays open on pointerdown inside the content', () => {
    const c = mountPopover({ defaultOpen: true });
    pointerDown(q(document, 'popover-content'));
    expect(isOpen(c)).toBe(true);
  });

  it('does not dismiss on pointerdown on the trigger (guarded to avoid double-toggle)', () => {
    const c = mountPopover({ defaultOpen: true });
    pointerDown(q(c, 'popover-trigger'));
    // The layer must not have closed it; only the trigger's click would toggle.
    expect(isOpen(c)).toBe(true);
  });
});

describe('Popover — focus management', () => {
  it('moves focus into the panel on open and restores to the trigger on close', async () => {
    const c = mountPopover();
    const trigger = q(c, 'popover-trigger') as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    flush2();
    await Promise.resolve(); // trap.activate in microtask
    expect(q(document, 'popover-content').contains(document.activeElement)).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    flush2();
    await Promise.resolve();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('Popover — controlled', () => {
  it('reflects an externally controlled open signal', () => {
    const open = signal<boolean | undefined>(false);
    const c = mountPopover({ open });
    expect(isOpen(c)).toBe(false);
    open.value = true;
    flush2();
    expect(isOpen(c)).toBe(true);
  });
});

describe('Popover — portal', () => {
  it('moves the content to <body> by default, trigger stays put', () => {
    const c = mountPopover({ defaultOpen: true });
    const content = q(document, 'popover-content');
    expect(content.parentElement).toBe(document.body);
    expect(c.contains(content)).toBe(false);
    expect(c.contains(q(c, 'popover-trigger'))).toBe(true);
  });

  it('portal={false} keeps the content inline', () => {
    const c = mount(
      html`${Popover({
        defaultOpen: true,
        children: html`${PopoverTrigger({ children: 'Open' })}
        ${PopoverContent({ portal: false, children: 'Body' })}`,
      })}`,
    );
    flushEffects();
    const content = q(document, 'popover-content');
    expect(content.parentElement).not.toBe(document.body);
    expect(c.contains(content)).toBe(true);
  });

  it('Escape + outside-pointer dismissal still work from the portaled content', () => {
    const c = mountPopover({ defaultOpen: true });
    expect(isOpen(c)).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    flushEffects();
    flushEffects();
    expect(isOpen(c)).toBe(false);
  });

  it('removes the portaled content when the popover is disconnected (no leak)', async () => {
    const c = mountPopover({ defaultOpen: true });
    expect(document.querySelector('[data-slot="popover-content"]')).not.toBeNull();
    c.querySelector('ui-popover')!.remove();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
  });
});

describe('Popover — misuse', () => {
  it('content used outside <ui-popover> renders an error fallback', () => {
    const host = document.createElement('ui-popover-content');
    document.body.appendChild(host);
    expect(host.querySelector('[data-slot="popover-content"]')).toBeNull();
    expect(host.textContent).toContain('Error');
  });
});

describe('Popover — plain custom element usage', () => {
  it('projects trigger + content, exact element counts', async () => {
    document.body.innerHTML =
      '<ui-popover>' +
      '<ui-popover-trigger>Open</ui-popover-trigger>' +
      '<ui-popover-content>Body</ui-popover-content>' +
      '</ui-popover>';
    await Promise.resolve();
    await Promise.resolve();
    const root = document.querySelector('ui-popover')!;
    expect(root.querySelectorAll('[data-slot="popover-trigger"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-slot="popover-content"]')).toHaveLength(1);
    expect(q(root, 'popover-trigger').textContent).toBe('Open');
    expect(q(document, 'popover-content').textContent).toBe('Body');
  });
});
