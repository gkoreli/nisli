/**
 * dialog.test.ts — Dialog rendering, ARIA, dismissal, focus, and interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal, flush, flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogClose,
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
  flush();
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
    expect(q(document, 'dialog-overlay').hasAttribute('hidden')).toBe(true);
    expect(q(document, 'dialog-content').hasAttribute('hidden')).toBe(true);
    expect(q(document, 'dialog-content').getAttribute('data-state')).toBe('closed');
  });
});

describe('Dialog — structure and ARIA', () => {
  it('wires role/aria-modal and labelledby/describedby to title/description ids', () => {
    const c = mountDialog({ defaultOpen: true });
    const content = q(document, 'dialog-content');
    const title = q(document, 'dialog-title');
    const desc = q(document, 'dialog-description');

    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.getAttribute('aria-modal')).toBe('true');
    expect(title.id).toBeTruthy();
    expect(desc.id).toBeTruthy();
    expect(content.getAttribute('aria-labelledby')).toBe(title.id);
    expect(content.getAttribute('aria-describedby')).toBe(desc.id);
    expect(q(c, 'dialog-trigger').getAttribute('aria-controls')).toBe(content.id);
    // exactly one of each slot — no ghosts (ADR 0023)
    expect(all(document, 'dialog-content')).toHaveLength(1);
    expect(all(document, 'dialog-overlay')).toHaveLength(1);
    expect(all(document, 'dialog-title')).toHaveLength(1);
  });

  it('renders the close button with a namespaced X icon by default', () => {
    const c = mountDialog({ defaultOpen: true });
    const close = q(document, 'dialog-close');
    expect(close).not.toBeNull();
    expect(close.getAttribute('aria-label')).toBe('Close');
    const svg = close.querySelector('svg')!;
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('omits the close button when showCloseButton is false', () => {
    const c = mountDialog({ defaultOpen: true, showCloseButton: false });
    expect(all(document, 'dialog-close')).toHaveLength(0);
  });
});

describe('Dialog — open via trigger', () => {
  it('opens on trigger click and reveals overlay + content', async () => {
    const c = mountDialog();
    await openViaTrigger(c);

    expect(q(c, 'dialog-trigger').getAttribute('aria-expanded')).toBe('true');
    expect(q(document, 'dialog-content').hasAttribute('hidden')).toBe(false);
    expect(q(document, 'dialog-overlay').hasAttribute('hidden')).toBe(false);
    expect(q(document, 'dialog-content').getAttribute('data-state')).toBe('open');
  });

  it('dispatches ui-open-change with the new open state', async () => {
    const c = mountDialog();
    const host = c.querySelector('ui-dialog') as HTMLElement;
    const onChange = vi.fn();
    host.addEventListener('ui-open-change', onChange as EventListener);

    await openViaTrigger(c);
    expect((onChange.mock.calls[0]![0] as CustomEvent).detail).toEqual({ open: true });
  });
});

describe('Dialog — dismissal', () => {
  it('closes on Escape', () => {
    const c = mountDialog({ defaultOpen: true });
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    flush2();
    expect(q(document, 'dialog-content').hasAttribute('hidden')).toBe(true);
  });

  it('closes on outside pointerdown (on the overlay)', () => {
    const c = mountDialog({ defaultOpen: true });
    q(document, 'dialog-overlay').dispatchEvent(
      new Event('pointerdown', { bubbles: true, cancelable: true }),
    );
    flush2();
    expect(q(document, 'dialog-content').hasAttribute('hidden')).toBe(true);
  });

  it('stays open on pointerdown inside the content', () => {
    const c = mountDialog({ defaultOpen: true });
    q(document, 'dialog-content').dispatchEvent(
      new Event('pointerdown', { bubbles: true, cancelable: true }),
    );
    flush2();
    expect(q(document, 'dialog-content').hasAttribute('hidden')).toBe(false);
  });

  it('closes when the close button is clicked', () => {
    const c = mountDialog({ defaultOpen: true });
    q(document, 'dialog-close').click();
    flush2();
    expect(q(document, 'dialog-content').hasAttribute('hidden')).toBe(true);
  });

  it('a standalone ui-dialog-close (e.g. in the footer) closes the dialog', () => {
    const c = mount(
      html`${Dialog({
        defaultOpen: true,
        children: html`${DialogTrigger({ children: 'Open' })}
        ${DialogContent({
          showCloseButton: false,
          children: html`${DialogTitle({ children: 'T' })}
          ${DialogFooter({
            children: DialogClose({ children: 'Cancel' }),
          })}`,
        })}`,
      })}`,
    );
    const footerClose = document.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')!;
    expect(footerClose.textContent).toBe('Cancel');
    footerClose.click();
    flush2();
    expect(q(document, 'dialog-content').hasAttribute('hidden')).toBe(true);
  });
});

describe('Dialog — focus management', () => {
  it('moves focus into the content on open and restores it on close', async () => {
    const c = mountDialog();
    const triggerBtn = q(c, 'dialog-trigger') as HTMLButtonElement;
    triggerBtn.focus();

    await openViaTrigger(c);
    const content = q(document, 'dialog-content');
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
    expect(q(document, 'dialog-content').hasAttribute('hidden')).toBe(true);

    open.value = true;
    flush2();
    expect(q(document, 'dialog-content').hasAttribute('hidden')).toBe(false);
    expect(q(document, 'dialog-content').getAttribute('data-state')).toBe('open');
  });
});

describe('Dialog — portal', () => {
  it('moves the overlay + content wrapper to <body> by default', () => {
    const c = mountDialog({ defaultOpen: true });
    const wrapper = document.querySelector<HTMLElement>('[data-slot="dialog-portal"]')!;
    expect(wrapper.parentElement).toBe(document.body); // escaped the container
    expect(c.contains(q(document, 'dialog-content'))).toBe(false);
    // The trigger is NOT portaled — it stays in place.
    expect(c.contains(q(c, 'dialog-trigger'))).toBe(true);
  });

  it('the portaled content stays reactive to the injected state (UI-28 capture-at-setup)', () => {
    // The content injects the dialog state at setup (while still under the
    // provider), THEN is portaled to <body>. A later state change must still
    // drive it — proving the context value was captured, not re-walked.
    const open = signal<boolean | undefined>(false);
    const c = mountDialog({ open });
    const content = q(document, 'dialog-content');
    expect(c.contains(content)).toBe(false); // portaled out of the container
    expect(content.getAttribute('data-state')).toBe('closed');

    open.value = true;
    flush2();
    expect(content.getAttribute('data-state')).toBe('open'); // signal reached the reparented node
  });

  it('portal={false} keeps the overlay + content inline', () => {
    const c = mount(
      html`${Dialog({
        defaultOpen: true,
        children: html`${DialogTrigger({ children: 'Open' })}
        ${DialogContent({ portal: false, children: DialogTitle({ children: 'T' }) })}`,
      })}`,
    );
    flush2();
    const wrapper = document.querySelector<HTMLElement>('[data-slot="dialog-portal"]')!;
    expect(wrapper.parentElement).not.toBe(document.body);
    expect(c.contains(q(document, 'dialog-content'))).toBe(true);
  });

  it('honours the portal="false" attribute in plain-HTML usage', async () => {
    document.body.innerHTML =
      '<ui-dialog default-open>' +
      '<ui-dialog-content portal="false">' +
      '<ui-dialog-title>T</ui-dialog-title>' +
      '</ui-dialog-content>' +
      '</ui-dialog>';
    await Promise.resolve();
    await Promise.resolve();
    const dialogHost = document.querySelector('ui-dialog')!;
    expect(dialogHost.contains(q(document, 'dialog-content'))).toBe(true); // inline
  });

  it('Escape + outside-pointer dismissal still work from the portaled content', () => {
    mountDialog({ defaultOpen: true });
    expect(q(document, 'dialog-content').hasAttribute('hidden')).toBe(false);
    q(document, 'dialog-overlay').dispatchEvent(
      new Event('pointerdown', { bubbles: true, cancelable: true }),
    );
    flush2();
    expect(q(document, 'dialog-content').hasAttribute('hidden')).toBe(true);
  });

  it('removes the portaled subtree when the dialog is disconnected (no leak)', async () => {
    const c = mountDialog({ defaultOpen: true });
    expect(document.querySelector('[data-slot="dialog-portal"]')).not.toBeNull();

    c.querySelector('ui-dialog')!.remove();
    // ADR 0023 defers teardown one microtask; portal's onCleanup then runs.
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('[data-slot="dialog-portal"]')).toBeNull();
  });
});

describe('Dialog — attribute-as-truth (PATTERN A)', () => {
  it('mounts open from literal `open` markup, then the close button closes it', async () => {
    // The `open` attribute is present at PARSE, so the SEED-AT-CONNECT path (not
    // attributeChangedCallback) must render the content OPEN at connect.
    document.body.innerHTML =
      '<ui-dialog open>' +
      '<ui-dialog-trigger>Open</ui-dialog-trigger>' +
      '<ui-dialog-content portal="false">' +
      '<ui-dialog-title>Title</ui-dialog-title>' +
      '</ui-dialog-content>' +
      '</ui-dialog>';
    await Promise.resolve();
    await Promise.resolve();

    const content = q(document, 'dialog-content');
    expect(content.hasAttribute('hidden')).toBe(false);
    expect(content.getAttribute('data-state')).toBe('open');

    // Close via the COMPONENT path (the built-in close button).
    q(document, 'dialog-close').click();
    flush2();
    expect(content.hasAttribute('hidden')).toBe(true);
    expect(content.getAttribute('data-state')).toBe('closed');
  });

  it('plain-HTML setAttribute("open") opens; removeAttribute closes', async () => {
    document.body.innerHTML =
      '<ui-dialog>' +
      '<ui-dialog-trigger>Open</ui-dialog-trigger>' +
      '<ui-dialog-content portal="false">' +
      '<ui-dialog-title>Title</ui-dialog-title>' +
      '</ui-dialog-content>' +
      '</ui-dialog>';
    await Promise.resolve();
    await Promise.resolve();

    const host = document.querySelector('ui-dialog')!;
    const content = q(document, 'dialog-content');
    const trigger = q(document, 'dialog-trigger');
    // closed by default
    expect(content.hasAttribute('hidden')).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    host.setAttribute('open', '');
    flush2();
    expect(content.hasAttribute('hidden')).toBe(false);
    expect(content.getAttribute('data-state')).toBe('open');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    host.removeAttribute('open');
    flush2();
    expect(content.hasAttribute('hidden')).toBe(true);
    expect(content.getAttribute('data-state')).toBe('closed');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders open when the default-open attribute is present', async () => {
    document.body.innerHTML =
      '<ui-dialog default-open>' +
      '<ui-dialog-content portal="false">' +
      '<ui-dialog-title>Title</ui-dialog-title>' +
      '</ui-dialog-content>' +
      '</ui-dialog>';
    await Promise.resolve();
    await Promise.resolve();

    const host = document.querySelector('ui-dialog')!;
    expect(host.hasAttribute('open')).toBe(true); // seeded from default-open
    expect(q(document, 'dialog-content').hasAttribute('hidden')).toBe(false);
  });

  it('explicit open="false" beats default-open (stays closed)', async () => {
    document.body.innerHTML =
      '<ui-dialog default-open open="false">' +
      '<ui-dialog-content portal="false">' +
      '<ui-dialog-title>Title</ui-dialog-title>' +
      '</ui-dialog-content>' +
      '</ui-dialog>';
    await Promise.resolve();
    await Promise.resolve();
    // hasAttribute('open') is present-but-"false" → the seed is skipped, so the
    // explicit closed state wins over default-open.
    expect(q(document, 'dialog-content').hasAttribute('hidden')).toBe(true);
  });

  it('controlled (factory open signal): setOpen is guarded, the parent stays in control', () => {
    const open = signal<boolean | undefined>(true);
    const c = mountDialog({ open });
    const host = c.querySelector('ui-dialog') as HTMLElement;
    const onChange = vi.fn();
    host.addEventListener('ui-open-change', onChange as EventListener);
    flush2();
    // The reflect effect mirrors the pinned signal onto the attribute.
    expect(host.hasAttribute('open')).toBe(true);
    expect(q(document, 'dialog-content').hasAttribute('hidden')).toBe(false);

    // A close-button click calls state.setOpen(false). Because `open` is a pinned
    // factory prop (controlled), the guard skips the attribute write — the parent
    // stays in control (attr NOT cleared) and only the event fires.
    q(document, 'dialog-close').click();
    flush2();
    expect(host.hasAttribute('open')).toBe(true); // guard held
    expect(q(document, 'dialog-content').hasAttribute('hidden')).toBe(false);
    expect((onChange.mock.calls.at(-1)![0] as CustomEvent).detail).toEqual({ open: false });

    // The parent responds by updating the signal → reflect effect closes it.
    open.value = false;
    flush2();
    expect(host.hasAttribute('open')).toBe(false);
    expect(q(document, 'dialog-content').hasAttribute('hidden')).toBe(true);
  });
});

describe('Dialog — misuse', () => {
  it('content used outside <ui-dialog> renders an error fallback', () => {
    const __err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const host = document.createElement('ui-dialog-content');
    document.body.appendChild(host);
    expect(host.querySelector('[data-slot="dialog-content"]')).toBeNull();
    expect(host.textContent).toContain('Error');
    expect(String(__err.mock.calls.flat())).toContain('must be used inside <ui-dialog>');
    __err.mockRestore();
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

    expect(document.querySelector('ui-dialog')).not.toBeNull();
    expect(all(document, 'dialog-content')).toHaveLength(1);
    expect(all(document, 'dialog-title')).toHaveLength(1);
    const content = q(document, 'dialog-content');
    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.hasAttribute('hidden')).toBe(false); // default-open
    expect(q(document, 'dialog-title').textContent).toBe('Title');
    expect(content.getAttribute('aria-labelledby')).toBe(q(document, 'dialog-title').id);
  });
});
