/**
 * alert-dialog.test.ts — AlertDialog structure, dismissal, actions, focus.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from './alert-dialog.js';

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

function mountAlertDialog(
  opts: {
    defaultOpen?: boolean;
    open?: ReturnType<typeof signal<boolean | undefined>>;
    size?: 'default' | 'sm';
  } = {},
): HTMLElement {
  const { defaultOpen, open, size } = opts;
  return mount(
    html`${AlertDialog({
      defaultOpen,
      open: open as unknown as boolean,
      children: html`${AlertDialogTrigger({ children: 'Delete' })}
      ${AlertDialogContent({
        size,
        children: html`${AlertDialogHeader({
          children: html`${AlertDialogTitle({ children: 'Are you sure?' })}
          ${AlertDialogDescription({ children: 'This cannot be undone.' })}`,
        })}
        ${AlertDialogFooter({
          children: html`${AlertDialogCancel({ children: 'Cancel' })}
          ${AlertDialogAction({ children: 'Continue' })}`,
        })}`,
      })}`,
    })}`,
  );
}

const q = (root: ParentNode, slot: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
const isOpen = (root: ParentNode) => !q(root, 'alert-dialog-content').hasAttribute('hidden');
function flush2(): void {
  flushEffects();
  flushEffects();
}

describe('AlertDialog — structure and ARIA', () => {
  it('is a role=alertdialog with title/description wiring, closed by default', () => {
    const c = mountAlertDialog();
    const content = q(c, 'alert-dialog-content');
    expect(content.getAttribute('role')).toBe('alertdialog');
    expect(content.getAttribute('aria-modal')).toBe('true');
    expect(content.getAttribute('data-size')).toBe('default');
    expect(content.hasAttribute('hidden')).toBe(true);
    expect(q(c, 'alert-dialog-trigger').getAttribute('aria-haspopup')).toBe('dialog');

    const title = q(c, 'alert-dialog-title');
    const desc = q(c, 'alert-dialog-description');
    expect(content.getAttribute('aria-labelledby')).toBe(title.id);
    expect(content.getAttribute('aria-describedby')).toBe(desc.id);
  });

  it('has no close button and styles action/cancel like buttons', () => {
    const c = mountAlertDialog({ defaultOpen: true });
    expect(c.querySelector('[data-slot="alert-dialog-close"]')).toBeNull();
    expect(q(c, 'alert-dialog-action').className).toContain('bg-primary'); // default variant
    expect(q(c, 'alert-dialog-cancel').className).toContain('border'); // outline variant
  });

  it('reflects the sm size', () => {
    const c = mountAlertDialog({ defaultOpen: true, size: 'sm' });
    expect(q(c, 'alert-dialog-content').getAttribute('data-size')).toBe('sm');
  });
});

describe('AlertDialog — open/close', () => {
  it('opens on trigger click', () => {
    const c = mountAlertDialog();
    q(c, 'alert-dialog-trigger').click();
    flush2();
    expect(isOpen(c)).toBe(true);
  });

  it('closes on Cancel and on Action', () => {
    const c1 = mountAlertDialog({ defaultOpen: true });
    q(c1, 'alert-dialog-cancel').click();
    flush2();
    expect(isOpen(c1)).toBe(false);

    const c2 = mountAlertDialog({ defaultOpen: true });
    q(c2, 'alert-dialog-action').click();
    flush2();
    expect(isOpen(c2)).toBe(false);
  });

  it('dispatches ui-open-change', () => {
    const c = mountAlertDialog();
    const host = c.querySelector('ui-alert-dialog') as HTMLElement;
    const onChange = vi.fn();
    host.addEventListener('ui-open-change', onChange as EventListener);
    q(c, 'alert-dialog-trigger').click();
    flush2();
    expect((onChange.mock.calls[0][0] as CustomEvent).detail).toEqual({ open: true });
  });
});

describe('AlertDialog — dismissal semantics', () => {
  it('closes on Escape', () => {
    const c = mountAlertDialog({ defaultOpen: true });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    flush2();
    expect(isOpen(c)).toBe(false);
  });

  it('does NOT close on outside pointerdown (alert dialogs demand a choice)', () => {
    const c = mountAlertDialog({ defaultOpen: true });
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    flush2();
    expect(isOpen(c)).toBe(true);
  });
});

describe('AlertDialog — focus management', () => {
  it('moves focus into the content on open and restores it on close', async () => {
    const c = mountAlertDialog();
    const trigger = q(c, 'alert-dialog-trigger') as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    flush2();
    await Promise.resolve();
    expect(q(c, 'alert-dialog-content').contains(document.activeElement)).toBe(true);

    q(c, 'alert-dialog-cancel').click();
    flush2();
    await Promise.resolve();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('AlertDialog — controlled', () => {
  it('reflects an externally controlled open signal', () => {
    const open = signal<boolean | undefined>(false);
    const c = mountAlertDialog({ open });
    expect(isOpen(c)).toBe(false);
    open.value = true;
    flush2();
    expect(isOpen(c)).toBe(true);
  });
});

describe('AlertDialog — misuse', () => {
  it('content used outside <ui-alert-dialog> renders an error fallback', () => {
    const host = document.createElement('ui-alert-dialog-content');
    document.body.appendChild(host);
    expect(host.querySelector('[data-slot="alert-dialog-content"]')).toBeNull();
    expect(host.textContent).toContain('Error');
  });
});

describe('AlertDialog — plain custom element usage', () => {
  it('reads default-open + projects content, exact element counts', async () => {
    document.body.innerHTML =
      '<ui-alert-dialog default-open>' +
      '<ui-alert-dialog-content>' +
      '<ui-alert-dialog-title>Sure?</ui-alert-dialog-title>' +
      '<ui-alert-dialog-description>No undo.</ui-alert-dialog-description>' +
      '</ui-alert-dialog-content>' +
      '</ui-alert-dialog>';
    await Promise.resolve();
    await Promise.resolve();
    const root = document.querySelector('ui-alert-dialog')!;
    expect(root.querySelectorAll('[data-slot="alert-dialog-content"]')).toHaveLength(1);
    expect(root.querySelectorAll('[data-slot="alert-dialog-title"]')).toHaveLength(1);
    const content = q(root, 'alert-dialog-content');
    expect(content.getAttribute('role')).toBe('alertdialog');
    expect(content.hasAttribute('hidden')).toBe(false); // default-open
    expect(q(root, 'alert-dialog-title').textContent).toBe('Sure?');
  });
});
