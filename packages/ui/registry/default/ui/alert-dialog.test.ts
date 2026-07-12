/**
 * alert-dialog.test.ts — AlertDialog structure, dismissal, actions, focus.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal, flush, flushEffects, html, type TemplateResult } from '@nisli/core';
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
const contentFor = (root: ParentNode): HTMLElement =>
  document.getElementById(q(root, 'alert-dialog-trigger').getAttribute('aria-controls')!)!;
const within = (root: ParentNode, slot: string): HTMLElement =>
  contentFor(root).querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
const isOpen = (root: ParentNode) => !contentFor(root).hasAttribute('hidden');
function flush2(): void {
  flush();
}

describe('AlertDialog — structure and ARIA', () => {
  it('is a role=alertdialog with title/description wiring, closed by default', () => {
    const c = mountAlertDialog();
    const content = contentFor(c);
    expect(content.getAttribute('role')).toBe('alertdialog');
    expect(content.getAttribute('aria-modal')).toBe('true');
    expect(content.getAttribute('data-size')).toBe('default');
    expect(content.hasAttribute('hidden')).toBe(true);
    expect(q(c, 'alert-dialog-trigger').getAttribute('aria-haspopup')).toBe('dialog');

    const title = within(c, 'alert-dialog-title');
    const desc = within(c, 'alert-dialog-description');
    expect(content.getAttribute('aria-labelledby')).toBe(title.id);
    expect(content.getAttribute('aria-describedby')).toBe(desc.id);
  });

  it('has no close button and styles action/cancel like buttons', () => {
    const c = mountAlertDialog({ defaultOpen: true });
    expect(contentFor(c).querySelector('[data-slot="alert-dialog-close"]')).toBeNull();
    expect(within(c, 'alert-dialog-action').className).toContain('bg-primary'); // default variant
    expect(within(c, 'alert-dialog-cancel').className).toContain('border'); // outline variant
  });

  it('reflects the sm size', () => {
    const c = mountAlertDialog({ defaultOpen: true, size: 'sm' });
    expect(contentFor(c).getAttribute('data-size')).toBe('sm');
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
    within(c1, 'alert-dialog-cancel').click();
    flush2();
    expect(isOpen(c1)).toBe(false);

    const c2 = mountAlertDialog({ defaultOpen: true });
    within(c2, 'alert-dialog-action').click();
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
    expect((onChange.mock.calls[0]![0] as CustomEvent).detail).toEqual({ open: true });
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
    expect(contentFor(c).contains(document.activeElement)).toBe(true);

    within(c, 'alert-dialog-cancel').click();
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

describe('AlertDialog — portal', () => {
  it('moves the overlay + content wrapper to <body> by default', () => {
    const c = mountAlertDialog({ defaultOpen: true });
    const wrapper = document.querySelector<HTMLElement>('[data-slot="alert-dialog-portal"]')!;
    expect(wrapper.parentElement).toBe(document.body);
    expect(c.contains(contentFor(c))).toBe(false);
    expect(c.contains(q(c, 'alert-dialog-trigger'))).toBe(true);
  });

  it('portal={false} keeps the overlay + content inline', () => {
    const c = mount(
      html`${AlertDialog({
        defaultOpen: true,
        children: html`${AlertDialogTrigger({ children: 'Delete' })}
        ${AlertDialogContent({ portal: false, children: AlertDialogTitle({ children: 'T' }) })}`,
      })}`,
    );
    flush2();
    expect(
      document.querySelector<HTMLElement>('[data-slot="alert-dialog-portal"]')!.parentElement,
    ).not.toBe(document.body);
    expect(c.contains(contentFor(c))).toBe(true);
  });

  it('Escape dismissal still works from the portaled content', () => {
    const c = mountAlertDialog({ defaultOpen: true });
    expect(isOpen(c)).toBe(true);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    flush2();
    expect(isOpen(c)).toBe(false);
  });

  it('removes the portaled subtree when the dialog is disconnected (no leak)', async () => {
    const c = mountAlertDialog({ defaultOpen: true });
    expect(document.querySelector('[data-slot="alert-dialog-portal"]')).not.toBeNull();
    c.querySelector('ui-alert-dialog')!.remove();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('[data-slot="alert-dialog-portal"]')).toBeNull();
  });
});

describe('AlertDialog — attribute-as-truth (live regressions)', () => {
  it('mounts open from literal `open` markup, then Cancel closes it', async () => {
    // The `open` attribute is present at PARSE, so the SEED-AT-CONNECT path (not
    // attributeChangedCallback) must render the content OPEN at connect.
    document.body.innerHTML =
      '<ui-alert-dialog open>' +
      '<ui-alert-dialog-content portal="false">' +
      '<ui-alert-dialog-title>Sure?</ui-alert-dialog-title>' +
      '<ui-alert-dialog-cancel>Cancel</ui-alert-dialog-cancel>' +
      '</ui-alert-dialog-content>' +
      '</ui-alert-dialog>';
    await Promise.resolve();
    await Promise.resolve();

    const content = q(document, 'alert-dialog-content');
    expect(content.hasAttribute('hidden')).toBe(false);
    expect(content.getAttribute('data-state')).toBe('open');

    // Close via the COMPONENT path (the Cancel button).
    q(document, 'alert-dialog-cancel').click();
    flush2();
    expect(content.hasAttribute('hidden')).toBe(true);
    expect(content.getAttribute('data-state')).toBe('closed');
  });

  it('toggles open when a plain element gains/loses the open attribute', async () => {
    document.body.innerHTML =
      '<ui-alert-dialog>' +
      '<ui-alert-dialog-trigger>Delete</ui-alert-dialog-trigger>' +
      '<ui-alert-dialog-content>' +
      '<ui-alert-dialog-title>Sure?</ui-alert-dialog-title>' +
      '</ui-alert-dialog-content>' +
      '</ui-alert-dialog>';
    await Promise.resolve();
    await Promise.resolve();
    const root = document.querySelector('ui-alert-dialog') as HTMLElement;
    expect(isOpen(root)).toBe(false);

    root.setAttribute('open', '');
    flush2();
    expect(isOpen(root)).toBe(true);

    root.removeAttribute('open');
    flush2();
    expect(isOpen(root)).toBe(false);
  });

  it('default-open seeds the open attribute (uncontrolled)', async () => {
    document.body.innerHTML =
      '<ui-alert-dialog default-open>' +
      '<ui-alert-dialog-trigger>Delete</ui-alert-dialog-trigger>' +
      '<ui-alert-dialog-content>' +
      '<ui-alert-dialog-title>Sure?</ui-alert-dialog-title>' +
      '</ui-alert-dialog-content>' +
      '</ui-alert-dialog>';
    await Promise.resolve();
    await Promise.resolve();
    const root = document.querySelector('ui-alert-dialog') as HTMLElement;
    expect(root.hasAttribute('open')).toBe(true);
    expect(isOpen(root)).toBe(true);
  });

  it('explicit open="false" beats default-open (stays closed)', async () => {
    document.body.innerHTML =
      '<ui-alert-dialog default-open open="false">' +
      '<ui-alert-dialog-trigger>Delete</ui-alert-dialog-trigger>' +
      '<ui-alert-dialog-content>' +
      '<ui-alert-dialog-title>Sure?</ui-alert-dialog-title>' +
      '</ui-alert-dialog-content>' +
      '</ui-alert-dialog>';
    await Promise.resolve();
    await Promise.resolve();
    const root = document.querySelector('ui-alert-dialog') as HTMLElement;
    expect(isOpen(root)).toBe(false);
  });

  it('controlled: setOpen(false) is guarded — attr not clobbered, event fires, parent signal drives', () => {
    const open = signal<boolean | undefined>(true);
    const c = mountAlertDialog({ open });
    const host = c.querySelector('ui-alert-dialog') as HTMLElement;
    flush2();
    expect(isOpen(c)).toBe(true);
    expect(host.hasAttribute('open')).toBe(true); // reflect effect mirrors the parent signal

    const onChange = vi.fn();
    host.addEventListener('ui-open-change', onChange as EventListener);

    // Cancel calls setOpen(false): controlled (pinned) → attr NOT clobbered and
    // open stays true (parent still true), but the event STILL fires.
    within(c, 'alert-dialog-cancel').click();
    flush2();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0]![0] as CustomEvent).detail).toEqual({ open: false });
    expect(isOpen(c)).toBe(true);
    expect(host.hasAttribute('open')).toBe(true);

    // The parent signal drives close.
    open.value = false;
    flush2();
    expect(isOpen(c)).toBe(false);
    expect(host.hasAttribute('open')).toBe(false);
  });
});

describe('AlertDialog — misuse', () => {
  it('content used outside <ui-alert-dialog> renders an error fallback', () => {
    const __err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const host = document.createElement('ui-alert-dialog-content');
    document.body.appendChild(host);
    expect(host.querySelector('[data-slot="alert-dialog-content"]')).toBeNull();
    expect(host.textContent).toContain('Error');
    expect(String(__err.mock.calls.flat())).toContain('must be used inside <ui-alert-dialog>');
    __err.mockRestore();
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
    expect(document.querySelectorAll('[data-slot="alert-dialog-content"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-slot="alert-dialog-title"]')).toHaveLength(1);
    const content = q(document, 'alert-dialog-content');
    expect(content.getAttribute('role')).toBe('alertdialog');
    expect(content.hasAttribute('hidden')).toBe(false); // default-open
    expect(q(document, 'alert-dialog-title').textContent).toBe('Sure?');
  });
});
