/**
 * hover-card.test.ts — HoverCard pointer-hover open/close with delays.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import { HoverCard, HoverCardTrigger, HoverCardContent } from './hover-card.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
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

function mountHoverCard(
  opts: {
    openDelay?: number;
    closeDelay?: number;
    open?: ReturnType<typeof signal<boolean | undefined>>;
    portal?: boolean;
  } = {},
): HTMLElement {
  const { openDelay, closeDelay, open, portal = false } = opts;
  return mount(
    html`${HoverCard({
      openDelay,
      closeDelay,
      open: open as unknown as boolean,
      children: html`${HoverCardTrigger({ children: '@nisli' })}
      ${HoverCardContent({ portal, children: 'Preview' })}`,
    })}`,
  );
}

const q = (root: ParentNode, slot: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
const isOpen = (root: ParentNode) => !q(root, 'hover-card-content').hasAttribute('hidden');
function fire(el: Element, type: string): void {
  el.dispatchEvent(new Event(type, { bubbles: true }));
  flushEffects();
  flushEffects();
}
function advance(ms: number): void {
  vi.advanceTimersByTime(ms);
  flushEffects();
  flushEffects();
}

describe('HoverCard — structure', () => {
  it('renders trigger + content, closed initially', () => {
    const c = mountHoverCard();
    expect(q(c, 'hover-card-trigger').getAttribute('data-state')).toBe('closed');
    const content = q(c, 'hover-card-content');
    expect(content.hasAttribute('hidden')).toBe(true);
    expect(content.className).toContain('w-64');
    expect(content.className).toContain('bg-popover');
  });

  it('hosts are layout-transparent', () => {
    const c = mountHoverCard();
    expect((c.querySelector('ui-hover-card') as HTMLElement).style.display).toBe('contents');
  });
});

describe('HoverCard — hover with delays', () => {
  it('opens after openDelay on pointerenter, not before', () => {
    const c = mountHoverCard({ openDelay: 700 });
    fire(q(c, 'hover-card-trigger'), 'pointerenter');
    advance(699);
    expect(isOpen(c)).toBe(false);
    advance(1);
    expect(isOpen(c)).toBe(true);
    expect(q(c, 'hover-card-trigger').getAttribute('data-state')).toBe('open');
  });

  it('closes after closeDelay on pointerleave', () => {
    const c = mountHoverCard({ openDelay: 0, closeDelay: 300 });
    fire(q(c, 'hover-card-trigger'), 'pointerenter');
    advance(0);
    expect(isOpen(c)).toBe(true);

    fire(q(c, 'hover-card-trigger'), 'pointerleave');
    advance(299);
    expect(isOpen(c)).toBe(true);
    advance(1);
    expect(isOpen(c)).toBe(false);
  });

  it('stays open when the pointer moves from trigger onto the content', () => {
    const c = mountHoverCard({ openDelay: 0, closeDelay: 300 });
    fire(q(c, 'hover-card-trigger'), 'pointerenter');
    advance(0);
    expect(isOpen(c)).toBe(true);

    // Leaving the trigger schedules a close; entering the content cancels it.
    fire(q(c, 'hover-card-trigger'), 'pointerleave');
    fire(q(c, 'hover-card-content'), 'pointerenter');
    advance(300);
    expect(isOpen(c)).toBe(true);

    // Leaving the content finally closes it.
    fire(q(c, 'hover-card-content'), 'pointerleave');
    advance(300);
    expect(isOpen(c)).toBe(false);
  });

  it('does not open on focus (pointer-only)', () => {
    const c = mountHoverCard({ openDelay: 0 });
    fire(q(c, 'hover-card-trigger'), 'focus');
    advance(1000);
    expect(isOpen(c)).toBe(false);
  });
});

describe('HoverCard — controlled + events', () => {
  it('follows a controlled open signal', () => {
    const open = signal<boolean | undefined>(false);
    const c = mountHoverCard({ open });
    expect(isOpen(c)).toBe(false);
    open.value = true;
    flushEffects();
    flushEffects();
    expect(isOpen(c)).toBe(true);
  });

  it('dispatches a bubbling ui-open-change', () => {
    const onChange = vi.fn();
    const c = mountHoverCard({ openDelay: 0 });
    (c.querySelector('ui-hover-card') as HTMLElement).addEventListener('ui-open-change', (e) =>
      onChange((e as CustomEvent).detail),
    );
    fire(q(c, 'hover-card-trigger'), 'pointerenter');
    advance(0);
    expect(onChange).toHaveBeenCalledWith({ open: true });
  });
});

describe('HoverCard — portal', () => {
  it('moves content to body by default while the trigger stays inline', () => {
    const c = mount(
      html`${HoverCard({
        openDelay: 0,
        children: html`${HoverCardTrigger({ children: '@nisli' })}${HoverCardContent({ children: 'Preview' })}`,
      })}`,
    );
    const content = q(document, 'hover-card-content');
    expect(content.parentElement).toBe(document.body);
    expect(c.contains(content)).toBe(false);
    expect(c.contains(q(c, 'hover-card-trigger'))).toBe(true);
  });

  it('portal={false} keeps content inline', () => {
    const c = mountHoverCard({ portal: false });
    expect(c.contains(q(c, 'hover-card-content'))).toBe(true);
  });

  it('honours portal="false" in plain HTML', async () => {
    document.body.innerHTML =
      '<ui-hover-card><ui-hover-card-trigger>@nisli</ui-hover-card-trigger>' +
      '<ui-hover-card-content portal="false">Preview</ui-hover-card-content></ui-hover-card>';
    await Promise.resolve();
    await Promise.resolve();
    const host = document.querySelector('ui-hover-card')!;
    expect(host.contains(q(host, 'hover-card-content'))).toBe(true);
  });

  it('keeps pointer transit behavior through the body move', () => {
    const c = mountHoverCard({ portal: true, openDelay: 0, closeDelay: 300 });
    fire(q(c, 'hover-card-trigger'), 'pointerenter');
    advance(0);
    const content = q(document, 'hover-card-content');
    fire(q(c, 'hover-card-trigger'), 'pointerleave');
    fire(content, 'pointerenter');
    advance(300);
    expect(isOpen(document)).toBe(true);
  });

  it('removes portaled content on teardown', async () => {
    const c = mountHoverCard({ portal: true });
    expect(q(document, 'hover-card-content')).not.toBeNull();
    c.querySelector('ui-hover-card')!.remove();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('[data-slot="hover-card-content"]')).toBeNull();
  });
});

describe('HoverCard — misuse', () => {
  it('renders the setup error boundary for a trigger outside a hover card', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = mount(html`${HoverCardTrigger({ children: 'x' })}`);
    expect(c.querySelector('[data-slot="hover-card-trigger"]')).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
