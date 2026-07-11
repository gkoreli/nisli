/**
 * sheet.test.ts — Sheet rendering, side variants, ARIA, dismissal, interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
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
  flushEffects();
  flushEffects();
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
    expect(q(c, 'sheet-overlay').hasAttribute('hidden')).toBe(true);
    expect(q(c, 'sheet-content').hasAttribute('hidden')).toBe(true);
  });

  it('wires content ARIA to the title/description ids', () => {
    const c = mountSheet({ defaultOpen: true });
    const content = q(c, 'sheet-content');
    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.getAttribute('aria-modal')).toBe('true');
    expect(content.getAttribute('aria-labelledby')).toBe(q(c, 'sheet-title').id);
    expect(content.getAttribute('aria-describedby')).toBe(q(c, 'sheet-description').id);
  });
});

describe('Sheet — open/close', () => {
  it('opens via the trigger', async () => {
    const c = mountSheet();
    await openViaTrigger(c);

    expect(q(c, 'sheet-trigger').getAttribute('aria-expanded')).toBe('true');
    expect(q(c, 'sheet-content').hasAttribute('hidden')).toBe(false);
    expect(q(c, 'sheet-content').getAttribute('data-state')).toBe('open');
  });

  it('closes via the built-in close button', () => {
    const c = mountSheet({ defaultOpen: true });
    expect(q(c, 'sheet-content').hasAttribute('hidden')).toBe(false);

    q(c, 'sheet-content')
      .querySelector<HTMLButtonElement>('[data-slot="sheet-close"][aria-label="Close"]')!
      .click();
    flush2();

    expect(q(c, 'sheet-content').hasAttribute('hidden')).toBe(true);
  });

  it('closes via a composed SheetClose button', () => {
    const c = mountSheet({ defaultOpen: true });
    // The footer "Cancel" close (not the top-right one).
    const cancel = [...c.querySelectorAll<HTMLButtonElement>('[data-slot="sheet-close"]')].find(
      (b) => b.textContent === 'Cancel',
    )!;
    cancel.click();
    flush2();
    expect(q(c, 'sheet-content').hasAttribute('hidden')).toBe(true);
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
    expect(q(c, 'sheet-content').hasAttribute('hidden')).toBe(false);

    // A user close dispatches the change event with open:false.
    q(c, 'sheet-content')
      .querySelector<HTMLButtonElement>('[aria-label="Close"]')!
      .click();
    flush2();
    expect(onChange).toHaveBeenCalledWith({ open: false });
  });
});

describe('Sheet — side variants', () => {
  it('defaults to the right side', () => {
    const c = mountSheet({ defaultOpen: true });
    expect(q(c, 'sheet-content').className).toContain('inset-y-0');
    expect(q(c, 'sheet-content').className).toContain('right-0');
    expect(q(c, 'sheet-content').className).toContain('border-l');
  });

  it('applies the left/top/bottom side classes', () => {
    for (const [side, tokens] of [
      ['left', ['left-0', 'border-r']],
      ['top', ['inset-x-0', 'top-0', 'border-b']],
      ['bottom', ['bottom-0', 'border-t']],
    ] as const) {
      document.body.innerHTML = '';
      const c = mountSheet({ defaultOpen: true, side });
      const cls = q(c, 'sheet-content').className;
      for (const t of tokens) expect(cls).toContain(t);
    }
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
