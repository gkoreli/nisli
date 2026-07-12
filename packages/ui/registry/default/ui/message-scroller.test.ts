/**
 * message-scroller.test.ts — stick-to-bottom + scroll-position-aware button.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from './message-scroller.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}
const q = (root: ParentNode, slot: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
function flush2(): void {
  flushEffects();
  flushEffects();
}
/** Give the viewport a fake layout so the at-edge math is meaningful. */
function fakeLayout(el: HTMLElement, scrollHeight: number, clientHeight: number): void {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => scrollHeight });
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clientHeight });
}

function mountScroller(): HTMLElement {
  return mount(
    html`${MessageScroller({
      children: html`${MessageScrollerButton({ direction: 'start' })}
      ${MessageScrollerButton({ direction: 'end' })}
      ${MessageScrollerViewport({
        children: MessageScrollerContent({
          children: html`${MessageScrollerItem({ children: 'One' })}
          ${MessageScrollerItem({ children: 'Two' })}`,
        }),
      })}`,
    })}`,
  );
}

const endBtn = (c: ParentNode) =>
  c.querySelector<HTMLElement>('[data-slot="message-scroller-button"][data-direction="end"]')!;
const startBtn = (c: ParentNode) =>
  c.querySelector<HTMLElement>('[data-slot="message-scroller-button"][data-direction="start"]')!;

describe('MessageScroller — structure', () => {
  it('renders viewport/content/item/button parts', () => {
    const c = mountScroller();
    flush2();
    expect(q(c, 'message-scroller').className).toContain('flex-col');
    expect(q(c, 'message-scroller-viewport').className).toContain('overflow-y-auto');
    expect(q(c, 'message-scroller-content').className).toContain('flex-col');
    expect(c.querySelectorAll('[data-slot="message-scroller-item"]')).toHaveLength(2);
    // The default button reuses the canonical button variant (secondary /
    // icon-sm) and labels itself with an sr-only span, matching upstream.
    const end = endBtn(c);
    expect(end.getAttribute('data-variant')).toBe('secondary');
    expect(end.getAttribute('data-size')).toBe('icon-sm');
    expect(end.className).toContain('bg-secondary'); // buttonVariants(secondary)
    expect(end.querySelector('.sr-only')?.textContent).toBe('Scroll to end');
    expect(startBtn(c).querySelector('.sr-only')?.textContent).toBe('Scroll to start');
    // Default glyph present (an <svg>) since no children were supplied.
    expect(end.querySelector('svg')).not.toBeNull();
  });

  it('custom children REPLACE the default arrow icon + label', () => {
    const c = mount(
      html`${MessageScroller({
        children: MessageScrollerButton({ direction: 'end', children: html`<span>go</span>` }),
      })}`,
    );
    flush2();
    const btn = endBtn(c);
    expect(btn.textContent).toBe('go');
    expect(btn.querySelector('svg')).toBeNull(); // default glyph gone
    expect(btn.querySelector('.sr-only')).toBeNull(); // default label gone
  });

  it('honours variant/size overrides on the button', () => {
    const c = mount(
      html`${MessageScroller({
        children: MessageScrollerButton({ direction: 'end', variant: 'outline', size: 'icon' }),
      })}`,
    );
    flush2();
    const btn = endBtn(c);
    expect(btn.getAttribute('data-variant')).toBe('outline');
    expect(btn.getAttribute('data-size')).toBe('icon');
  });

  it('at the bottom by default, both buttons are inactive', () => {
    const c = mountScroller();
    flush2();
    expect(endBtn(c).getAttribute('data-active')).toBe('false');
    expect(startBtn(c).getAttribute('data-active')).toBe('false');
  });
});

describe('MessageScroller — scroll position', () => {
  it('activates the end button when scrolled up, and the start button once scrolled', () => {
    const c = mountScroller();
    flush2();
    const vp = q(c, 'message-scroller-viewport');
    fakeLayout(vp, 1000, 200);

    vp.scrollTop = 0; // top: far from the end
    vp.dispatchEvent(new Event('scroll'));
    flush2();
    expect(endBtn(c).getAttribute('data-active')).toBe('true'); // more below
    expect(startBtn(c).getAttribute('data-active')).toBe('false'); // at the start

    vp.scrollTop = 500; // middle
    vp.dispatchEvent(new Event('scroll'));
    flush2();
    expect(endBtn(c).getAttribute('data-active')).toBe('true');
    expect(startBtn(c).getAttribute('data-active')).toBe('true');

    vp.scrollTop = 800; // bottom (1000-200-800 = 0)
    vp.dispatchEvent(new Event('scroll'));
    flush2();
    expect(endBtn(c).getAttribute('data-active')).toBe('false');
  });

  it('clicking the end/start buttons scrolls the viewport', () => {
    const c = mountScroller();
    flush2();
    const vp = q(c, 'message-scroller-viewport');
    fakeLayout(vp, 1000, 200);
    vp.scrollTop = 0;
    vp.dispatchEvent(new Event('scroll'));
    flush2();

    endBtn(c).click();
    flush2();
    expect(vp.scrollTop).toBe(1000); // scrolled to scrollHeight

    startBtn(c).click();
    flush2();
    expect(vp.scrollTop).toBe(0);
  });
});

describe('MessageScroller — stick to bottom', () => {
  it('a new message autoscrolls only while pinned to the bottom', async () => {
    const c = mountScroller();
    flush2();
    const vp = q(c, 'message-scroller-viewport');
    const content = q(c, 'message-scroller-content');
    fakeLayout(vp, 1000, 200);
    vp.scrollTop = 800; // at the bottom
    vp.dispatchEvent(new Event('scroll'));
    flush2();

    // New message arrives while pinned → autoscroll to the (grown) bottom.
    fakeLayout(vp, 1400, 200);
    content.appendChild(document.createElement('div'));
    await Promise.resolve();
    await Promise.resolve();
    flush2();
    expect(vp.scrollTop).toBe(1400);

    // Now scroll up (not pinned); a new message must NOT yank the view down.
    fakeLayout(vp, 1400, 200);
    vp.scrollTop = 0;
    vp.dispatchEvent(new Event('scroll'));
    flush2();
    fakeLayout(vp, 1800, 200);
    content.appendChild(document.createElement('div'));
    await Promise.resolve();
    await Promise.resolve();
    flush2();
    expect(vp.scrollTop).toBe(0);
  });
});

describe('MessageScroller — disposal', () => {
  it('disconnects the MutationObserver on teardown and stops autoscrolling', async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    try {
      const c = mountScroller();
      flush2();
      const vp = q(c, 'message-scroller-viewport');
      const content = q(c, 'message-scroller-content');
      fakeLayout(vp, 1000, 200);
      vp.scrollTop = 800; // pinned to the bottom
      vp.dispatchEvent(new Event('scroll'));
      flush2();

      const before = disconnect.mock.calls.length;
      const host = c.querySelector('ui-message-scroller')!;
      host.remove();
      // ADR 0023 defers disconnect teardown one microtask.
      await Promise.resolve();
      await Promise.resolve();
      expect(disconnect.mock.calls.length).toBeGreaterThan(before);

      // A content mutation after disposal must drive NO scroll — the
      // observer is dead, so the stick-to-bottom callback never fires.
      vp.scrollTop = 400;
      fakeLayout(vp, 2000, 200);
      content.appendChild(document.createElement('div'));
      await Promise.resolve();
      await Promise.resolve();
      flush2();
      expect(vp.scrollTop).toBe(400);
    } finally {
      disconnect.mockRestore();
    }
  });
});

describe('MessageScroller — plain custom elements', () => {
  it('transparent host, attr fallback, and parser-projected children', async () => {
    document.body.innerHTML = `
      <ui-message-scroller>
        <ui-message-scroller-button direction="start"></ui-message-scroller-button>
        <ui-message-scroller-viewport>
          <ui-message-scroller-content>
            <ui-message-scroller-item>Hello</ui-message-scroller-item>
          </ui-message-scroller-content>
        </ui-message-scroller-viewport>
      </ui-message-scroller>`;
    flush2();
    await Promise.resolve();
    flush2();

    // Transparent host: display:contents, no host-level class, inner root present.
    const host = document.querySelector('ui-message-scroller') as HTMLElement;
    expect(host.style.display).toBe('contents');
    expect(host.className).toBe('');
    expect(host.querySelector('[data-slot="message-scroller"]')).not.toBeNull();

    // Attr fallback: the `direction` attribute drives the inner button.
    expect(startBtn(document.body).getAttribute('data-direction')).toBe('start');

    // Parser-projected light children land inside the inner item root.
    const item = q(document.body, 'message-scroller-item');
    expect(item.textContent).toContain('Hello');
  });

  it('explicit prop wins over the host attribute (direction)', () => {
    const c = mount(html`${MessageScroller({ children: '' })}`);
    flush2();
    const host = document.createElement('ui-message-scroller-button');
    host.setAttribute('direction', 'end');
    (host as unknown as { _setProp(k: string, v: unknown): void })._setProp('direction', 'start');
    q(c, 'message-scroller').appendChild(host);
    flush2();
    expect(host.querySelector('[data-slot="message-scroller-button"]')!.getAttribute('data-direction')).toBe(
      'start',
    );
  });
});

describe('MessageScroller — misuse', () => {
  it('a viewport outside <ui-message-scroller> renders an error fallback', () => {
    const host = document.createElement('ui-message-scroller-viewport');
    document.body.appendChild(host);
    expect(host.querySelector('[data-slot="message-scroller-viewport"]')).toBeNull();
    expect(host.textContent).toContain('Error');
  });
});
