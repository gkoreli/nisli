/**
 * sheet.test.ts — Sheet rendering, side variants, ARIA, dismissal, interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal, flush, flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetClose,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  type SheetSide,
} from './sheet.js';

beforeEach(async () => {
  document.body.innerHTML = '';
  // Flush deferred disconnect teardown (ADR 0023) so the previous test's
  // dismissable-layer/focus-trap document listeners are removed.
  await Promise.resolve();
  await Promise.resolve();
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function mountSheet(
  opts: {
    defaultOpen?: boolean;
    open?: ReturnType<typeof signal<boolean | undefined>>;
    side?: SheetSide;
    showCloseButton?: boolean;
  } = {},
): HTMLElement {
  const { defaultOpen, open, side, showCloseButton } = opts;
  return mount(
    html`${Sheet({
      defaultOpen,
      open: open as unknown as boolean,
      children: html`${SheetTrigger({ children: 'Open' })}
      ${SheetContent({
        side,
        showCloseButton,
        children: html`${SheetHeader({
          children: html`${SheetTitle({ children: 'Title' })}
          ${SheetDescription({ children: 'Description' })}`,
        })}
        ${SheetClose({ children: 'Cancel' })}
        ${SheetFooter({ children: '' })}`,
      })}`,
    })}`,
  );
}

const q = (root: ParentNode, slot: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;

function flush2(): void {
  flush();
}
async function openViaTrigger(root: ParentNode): Promise<void> {
  q(root, 'sheet-trigger').click();
  flush2();
  await Promise.resolve();
}

describe('Sheet — closed by default', () => {
  it('renders overlay + content hidden, trigger collapsed', () => {
    const c = mountSheet();
    expect(q(c, 'sheet-trigger').getAttribute('aria-expanded')).toBe('false');
    expect(q(document, 'sheet-overlay').hasAttribute('hidden')).toBe(true);
    expect(q(document, 'sheet-content').hasAttribute('hidden')).toBe(true);
  });

  it('wires content ARIA to the title/description ids', () => {
    const c = mountSheet({ defaultOpen: true });
    const content = q(document, 'sheet-content');
    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.getAttribute('aria-modal')).toBe('true');
    expect(content.getAttribute('aria-labelledby')).toBe(q(document, 'sheet-title').id);
    expect(content.getAttribute('aria-describedby')).toBe(q(document, 'sheet-description').id);
  });
});

describe('Sheet — open/close', () => {
  it('opens via the trigger', async () => {
    const c = mountSheet();
    await openViaTrigger(c);

    expect(q(c, 'sheet-trigger').getAttribute('aria-expanded')).toBe('true');
    expect(q(document, 'sheet-content').hasAttribute('hidden')).toBe(false);
    expect(q(document, 'sheet-content').getAttribute('data-state')).toBe('open');
  });

  it('closes via the built-in close button', () => {
    const c = mountSheet({ defaultOpen: true });
    expect(q(document, 'sheet-content').hasAttribute('hidden')).toBe(false);

    q(document, 'sheet-content')
      .querySelector<HTMLButtonElement>('[data-slot="sheet-close"][aria-label="Close"]')!
      .click();
    flush2();

    expect(q(document, 'sheet-content').hasAttribute('hidden')).toBe(true);
  });

  it('closes via a composed SheetClose button', () => {
    const c = mountSheet({ defaultOpen: true });
    // The footer "Cancel" close (not the top-right one).
    const cancel = [...document.querySelectorAll<HTMLButtonElement>('[data-slot="sheet-close"]')].find(
      (b) => b.textContent === 'Cancel',
    )!;
    cancel.click();
    flush2();
    expect(q(document, 'sheet-content').hasAttribute('hidden')).toBe(true);
  });

  it('follows a controlled open signal and emits ui-open-change', () => {
    const open = signal<boolean | undefined>(false);
    const c = mountSheet({ open });
    const onChange = vi.fn();
    (c.querySelector('ui-sheet') as HTMLElement).addEventListener('ui-open-change', (e) =>
      onChange((e as CustomEvent).detail),
    );

    open.value = true;
    flush2();
    expect(q(document, 'sheet-content').hasAttribute('hidden')).toBe(false);

    // A user close dispatches the change event with open:false.
    q(document, 'sheet-content')
      .querySelector<HTMLButtonElement>('[aria-label="Close"]')!
      .click();
    flush2();
    expect(onChange).toHaveBeenCalledWith({ open: false });
  });
});

describe('Sheet — side variants', () => {
  it('defaults to the right side', () => {
    const c = mountSheet({ defaultOpen: true });
    expect(q(document, 'sheet-content').className).toContain('inset-y-0');
    expect(q(document, 'sheet-content').className).toContain('right-0');
    expect(q(document, 'sheet-content').className).toContain('border-l');
  });

  it('applies the left/top/bottom side classes', () => {
    for (const [side, tokens] of [
      ['left', ['left-0', 'border-r']],
      ['top', ['inset-x-0', 'top-0', 'border-b']],
      ['bottom', ['bottom-0', 'border-t']],
    ] as const) {
      document.body.innerHTML = '';
      const c = mountSheet({ defaultOpen: true, side });
      const cls = q(document, 'sheet-content').className;
      for (const t of tokens) expect(cls).toContain(t);
    }
  });
});

describe('Sheet — portal', () => {
  it('moves the overlay + content wrapper to <body> by default', () => {
    const c = mountSheet({ defaultOpen: true });
    const wrapper = document.querySelector<HTMLElement>('[data-slot="sheet-portal"]')!;
    expect(wrapper.parentElement).toBe(document.body);
    expect(c.contains(q(document, 'sheet-content'))).toBe(false);
    expect(c.contains(q(c, 'sheet-trigger'))).toBe(true); // trigger stays put
  });

  it('portal={false} keeps the overlay + content inline', () => {
    const c = mount(
      html`${Sheet({
        defaultOpen: true,
        children: html`${SheetTrigger({ children: 'Open' })}
        ${SheetContent({ portal: false, children: SheetTitle({ children: 'T' }) })}`,
      })}`,
    );
    flush2();
    expect(document.querySelector<HTMLElement>('[data-slot="sheet-portal"]')!.parentElement).not.toBe(
      document.body,
    );
    expect(c.contains(q(document, 'sheet-content'))).toBe(true);
  });

  it('Escape + outside-pointer dismissal still work from the portaled content', () => {
    mountSheet({ defaultOpen: true });
    expect(q(document, 'sheet-content').hasAttribute('hidden')).toBe(false);
    q(document, 'sheet-overlay').dispatchEvent(
      new Event('pointerdown', { bubbles: true, cancelable: true }),
    );
    flush2();
    expect(q(document, 'sheet-content').hasAttribute('hidden')).toBe(true);
  });

  it('removes the portaled subtree when the sheet is disconnected (no leak)', async () => {
    const c = mountSheet({ defaultOpen: true });
    expect(document.querySelector('[data-slot="sheet-portal"]')).not.toBeNull();
    c.querySelector('ui-sheet')!.remove();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('[data-slot="sheet-portal"]')).toBeNull();
  });
});

describe('Sheet — attribute-as-truth (PATTERN A)', () => {
  it('does not feed the transparent host style back onto plain-HTML content', async () => {
    document.body.innerHTML =
      '<ui-sheet open>' +
      '<ui-sheet-content portal="false">' +
      '<ui-sheet-title>Title</ui-sheet-title>' +
      '</ui-sheet-content>' +
      '</ui-sheet>';
    await Promise.resolve();
    await Promise.resolve();

    const host = document.querySelector('ui-sheet-content') as HTMLElement;
    const content = q(document, 'sheet-content');
    expect(host.style.display).toBe('contents');
    expect(content.style.display).toBe('');
    expect(content.getAttribute('style')).toBeNull();
    expect(content.hasAttribute('hidden')).toBe(false);
    expect(content.classList.contains('fixed')).toBe(true);
    expect(content.classList.contains('flex')).toBe(true);
  });

  it('preserves factory-only style passthrough onto the content panel', () => {
    mount(html`${Sheet({
      defaultOpen: true,
      children: SheetContent({
        portal: false,
        style: '--sidebar-width:18rem;color:red',
        children: SheetTitle({ children: 'Title' }),
      }),
    })}`);

    const content = q(document, 'sheet-content');
    expect(content.style.getPropertyValue('--sidebar-width')).toBe('18rem');
    expect(content.style.color).toBe('red');
  });

  it('mounts open from literal `open` markup, then the close button closes it', async () => {
    // The `open` attribute is present at PARSE, so the SEED-AT-CONNECT path (not
    // attributeChangedCallback) must render the content OPEN at connect.
    document.body.innerHTML =
      '<ui-sheet open>' +
      '<ui-sheet-trigger>Open</ui-sheet-trigger>' +
      '<ui-sheet-content portal="false">' +
      '<ui-sheet-title>Title</ui-sheet-title>' +
      '</ui-sheet-content>' +
      '</ui-sheet>';
    await Promise.resolve();
    await Promise.resolve();

    const content = q(document, 'sheet-content');
    expect(content.hasAttribute('hidden')).toBe(false);
    expect(content.getAttribute('data-state')).toBe('open');

    // Close via the COMPONENT path (the built-in close button).
    content
      .querySelector<HTMLButtonElement>('[data-slot="sheet-close"][aria-label="Close"]')!
      .click();
    flush2();
    expect(content.hasAttribute('hidden')).toBe(true);
    expect(content.getAttribute('data-state')).toBe('closed');
  });

  it('plain-HTML setAttribute("open") opens; removeAttribute closes', async () => {
    document.body.innerHTML =
      '<ui-sheet>' +
      '<ui-sheet-trigger>Open</ui-sheet-trigger>' +
      '<ui-sheet-content portal="false">' +
      '<ui-sheet-title>Title</ui-sheet-title>' +
      '</ui-sheet-content>' +
      '</ui-sheet>';
    await Promise.resolve();
    await Promise.resolve();

    const host = document.querySelector('ui-sheet')!;
    const content = q(document, 'sheet-content');
    const trigger = q(document, 'sheet-trigger');
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
      '<ui-sheet default-open>' +
      '<ui-sheet-content portal="false">' +
      '<ui-sheet-title>Title</ui-sheet-title>' +
      '</ui-sheet-content>' +
      '</ui-sheet>';
    await Promise.resolve();
    await Promise.resolve();

    const host = document.querySelector('ui-sheet')!;
    expect(host.hasAttribute('open')).toBe(true); // seeded from default-open
    expect(q(document, 'sheet-content').hasAttribute('hidden')).toBe(false);
  });

  it('explicit open="false" beats default-open (stays closed)', async () => {
    document.body.innerHTML =
      '<ui-sheet default-open open="false">' +
      '<ui-sheet-content portal="false">' +
      '<ui-sheet-title>Title</ui-sheet-title>' +
      '</ui-sheet-content>' +
      '</ui-sheet>';
    await Promise.resolve();
    await Promise.resolve();
    // hasAttribute('open') is present-but-"false" → the seed is skipped, so the
    // explicit closed state wins over default-open.
    expect(q(document, 'sheet-content').hasAttribute('hidden')).toBe(true);
  });

  it('controlled (factory open signal): setOpen is guarded, the parent stays in control', () => {
    const open = signal<boolean | undefined>(true);
    const c = mountSheet({ open });
    const host = c.querySelector('ui-sheet') as HTMLElement;
    const onChange = vi.fn();
    host.addEventListener('ui-open-change', onChange as EventListener);
    flush2();
    // The reflect effect mirrors the pinned signal onto the attribute.
    expect(host.hasAttribute('open')).toBe(true);
    expect(q(document, 'sheet-content').hasAttribute('hidden')).toBe(false);

    // A close-button click calls state.setOpen(false). Because `open` is a pinned
    // factory prop (controlled), the guard skips the attribute write — the parent
    // stays in control (attr NOT cleared) and only the event fires.
    q(document, 'sheet-content')
      .querySelector<HTMLButtonElement>('[aria-label="Close"]')!
      .click();
    flush2();
    expect(host.hasAttribute('open')).toBe(true); // guard held
    expect(q(document, 'sheet-content').hasAttribute('hidden')).toBe(false);
    expect((onChange.mock.calls.at(-1)![0] as CustomEvent).detail).toEqual({ open: false });

    // The parent responds by updating the signal → reflect effect closes it.
    open.value = false;
    flush2();
    expect(host.hasAttribute('open')).toBe(false);
    expect(q(document, 'sheet-content').hasAttribute('hidden')).toBe(true);
  });
});

describe('Sheet — misuse', () => {
  it('renders the setup error boundary for a trigger outside a sheet', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = mount(html`${SheetTrigger({ children: 'x' })}`);
    expect(c.querySelector('[data-slot="sheet-trigger"]')).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
