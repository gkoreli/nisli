/**
 * message-scroller.test.ts — stick-to-bottom + scroll-position-aware button.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
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
    expect(endBtn(c).getAttribute('aria-label')).toBe('Scroll to end');
    expect(startBtn(c).getAttribute('aria-label')).toBe('Scroll to start');
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

describe('MessageScroller — misuse', () => {
  it('a viewport outside <ui-message-scroller> renders an error fallback', () => {
    const host = document.createElement('ui-message-scroller-viewport');
    document.body.appendChild(host);
    expect(host.querySelector('[data-slot="message-scroller-viewport"]')).toBeNull();
    expect(host.textContent).toContain('Error');
  });
});
