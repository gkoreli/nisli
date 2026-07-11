/**
 * dialog.test.ts — Dialog rendering, ARIA, dismissal, focus, and interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './dialog.js';

beforeEach(async () => {
  document.body.innerHTML = '';
  // Flush deferred disconnect teardown (ADR 0023) from the previous test so its
  // dialog's dismissable-layer/focus-trap document listeners are removed.
  await Promise.resolve();
  await Promise.resolve();
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function mountDialog(
  opts: {
    defaultOpen?: boolean;
    open?: ReturnType<typeof signal<boolean | undefined>>;
    showCloseButton?: boolean;
  } = {},
): HTMLElement {
  const { defaultOpen, open, showCloseButton } = opts;
  return mount(
    html`${Dialog({
      defaultOpen,
      open: open as unknown as boolean,
      children: html`${DialogTrigger({ children: 'Open' })}
      ${DialogContent({
        showCloseButton,
        children: html`${DialogHeader({
          children: html`${DialogTitle({ children: 'Title' })}
          ${DialogDescription({ children: 'Description' })}`,
        })}
        <button data-testid="inner" type="button">Inner</button>
        ${DialogFooter({ children: '' })}`,
      })}`,
    })}`,
  );
}

const q = (root: ParentNode, slot: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
const all = (root: ParentNode, slot: string) =>
  root.querySelectorAll(`[data-slot="${slot}"]`);

function flush2(): void {
  flushEffects();
  flushEffects();
}
async function openViaTrigger(root: ParentNode): Promise<void> {
  q(root, 'dialog-trigger').click();
  flush2();
  await Promise.resolve(); // trap.activate() runs in a microtask
}

describe('Dialog — closed by default', () => {
  it('renders overlay + content hidden, trigger collapsed', () => {
    const c = mountDialog();
    expect(q(c, 'dialog-trigger').getAttribute('aria-expanded')).toBe('false');
    expect(q(c, 'dialog-overlay').hasAttribute('hidden')).toBe(true);
    expect(q(c, 'dialog-content').hasAttribute('hidden')).toBe(true);
    expect(q(c, 'dialog-content').getAttribute('data-state')).toBe('closed');
  });
});

describe('Dialog — structure and ARIA', () => {
  it('wires role/aria-modal and labelledby/describedby to title/description ids', () => {
    const c = mountDialog({ defaultOpen: true });
    const content = q(c, 'dialog-content');
    const title = q(c, 'dialog-title');
    const desc = q(c, 'dialog-description');

    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.getAttribute('aria-modal')).toBe('true');
    expect(title.id).toBeTruthy();
    expect(desc.id).toBeTruthy();
    expect(content.getAttribute('aria-labelledby')).toBe(title.id);
    expect(content.getAttribute('aria-describedby')).toBe(desc.id);
    expect(q(c, 'dialog-trigger').getAttribute('aria-controls')).toBe(content.id);
    // exactly one of each slot — no ghosts (ADR 0023)
    expect(all(c, 'dialog-content')).toHaveLength(1);
    expect(all(c, 'dialog-overlay')).toHaveLength(1);
    expect(all(c, 'dialog-title')).toHaveLength(1);
  });

  it('renders the close button with a namespaced X icon by default', () => {
    const c = mountDialog({ defaultOpen: true });
    const close = q(c, 'dialog-close');
    expect(close).not.toBeNull();
    expect(close.getAttribute('aria-label')).toBe('Close');
    const svg = close.querySelector('svg')!;
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('omits the close button when showCloseButton is false', () => {
    const c = mountDialog({ defaultOpen: true, showCloseButton: false });
    expect(all(c, 'dialog-close')).toHaveLength(0);
  });
});

describe('Dialog — open via trigger', () => {
  it('opens on trigger click and reveals overlay + content', async () => {
    const c = mountDialog();
    await openViaTrigger(c);

    expect(q(c, 'dialog-trigger').getAttribute('aria-expanded')).toBe('true');
    expect(q(c, 'dialog-content').hasAttribute('hidden')).toBe(false);
    expect(q(c, 'dialog-overlay').hasAttribute('hidden')).toBe(false);
    expect(q(c, 'dialog-content').getAttribute('data-state')).toBe('open');
  });

  it('dispatches ui-open-change with the new open state', async () => {
    const c = mountDialog();
    const host = c.querySelector('ui-dialog') as HTMLElement;
    const onChange = vi.fn();
    host.addEventListener('ui-open-change', onChange as EventListener);

    await openViaTrigger(c);
    expect((onChange.mock.calls[0][0] as CustomEvent).detail).toEqual({ open: true });
  });
});

describe('Dialog — dismissal', () => {
  it('closes on Escape', () => {
    const c = mountDialog({ defaultOpen: true });
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    flush2();
    expect(q(c, 'dialog-content').hasAttribute('hidden')).toBe(true);
  });

  it('closes on outside pointerdown (on the overlay)', () => {
    const c = mountDialog({ defaultOpen: true });
    q(c, 'dialog-overlay').dispatchEvent(
      new Event('pointerdown', { bubbles: true, cancelable: true }),
    );
    flush2();
    expect(q(c, 'dialog-content').hasAttribute('hidden')).toBe(true);
  });

  it('stays open on pointerdown inside the content', () => {
    const c = mountDialog({ defaultOpen: true });
    q(c, 'dialog-content').dispatchEvent(
      new Event('pointerdown', { bubbles: true, cancelable: true }),
    );
    flush2();
    expect(q(c, 'dialog-content').hasAttribute('hidden')).toBe(false);
  });

  it('closes when the close button is clicked', () => {
    const c = mountDialog({ defaultOpen: true });
    q(c, 'dialog-close').click();
    flush2();
    expect(q(c, 'dialog-content').hasAttribute('hidden')).toBe(true);
  });
});

describe('Dialog — focus management', () => {
  it('moves focus into the content on open and restores it on close', async () => {
    const c = mountDialog();
    const triggerBtn = q(c, 'dialog-trigger') as HTMLButtonElement;
    triggerBtn.focus();

    await openViaTrigger(c);
    const content = q(c, 'dialog-content');
    expect(content.contains(document.activeElement)).toBe(true);

    // Close via Escape and the trigger regains focus.
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    flush2();
    await Promise.resolve();
    expect(document.activeElement).toBe(triggerBtn);
  });
});

describe('Dialog — controlled open', () => {
  it('reflects an externally controlled open signal', () => {
    const open = signal<boolean | undefined>(false);
    const c = mountDialog({ open });
    expect(q(c, 'dialog-content').hasAttribute('hidden')).toBe(true);

    open.value = true;
    flush2();
    expect(q(c, 'dialog-content').hasAttribute('hidden')).toBe(false);
    expect(q(c, 'dialog-content').getAttribute('data-state')).toBe('open');
  });
});

describe('Dialog — misuse', () => {
  it('content used outside <ui-dialog> renders an error fallback', () => {
    const host = document.createElement('ui-dialog-content');
    document.body.appendChild(host);
    expect(host.querySelector('[data-slot="dialog-content"]')).toBeNull();
    expect(host.textContent).toContain('Error');
  });
});

describe('Dialog — plain custom element usage', () => {
  it('reads default-open + projects content, exact element counts', async () => {
    document.body.innerHTML =
      '<ui-dialog default-open>' +
      '<ui-dialog-trigger>Open</ui-dialog-trigger>' +
      '<ui-dialog-content>' +
      '<ui-dialog-header>' +
      '<ui-dialog-title>Title</ui-dialog-title>' +
      '<ui-dialog-description>Desc</ui-dialog-description>' +
      '</ui-dialog-header>' +
      '</ui-dialog-content>' +
      '</ui-dialog>';
    await Promise.resolve();
    await Promise.resolve();

    const dialog = document.querySelector('ui-dialog')!;
    expect(all(dialog, 'dialog-content')).toHaveLength(1);
    expect(all(dialog, 'dialog-title')).toHaveLength(1);
    const content = q(dialog, 'dialog-content');
    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.hasAttribute('hidden')).toBe(false); // default-open
    expect(q(dialog, 'dialog-title').textContent).toBe('Title');
    expect(content.getAttribute('aria-labelledby')).toBe(q(dialog, 'dialog-title').id);
  });
});
