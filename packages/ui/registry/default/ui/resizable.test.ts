/**
 * resizable.test.ts — panel-group sizing, handle drag + keyboard, min-size.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from './resizable.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function mountGroup(
  opts: {
    direction?: 'horizontal' | 'vertical';
    aDefault?: number;
    bDefault?: number;
    aMin?: number;
    bMin?: number;
    withHandle?: boolean;
  } = {},
): HTMLElement {
  const { direction, aDefault = 50, bDefault = 50, aMin = 20, bMin = 20, withHandle } = opts;
  return mount(
    html`${ResizablePanelGroup({
      direction,
      children: html`${ResizablePanel({ defaultSize: aDefault, minSize: aMin, children: 'A' })}
      ${ResizableHandle({ withHandle })}
      ${ResizablePanel({ defaultSize: bDefault, minSize: bMin, children: 'B' })}`,
    })}`,
  );
}

const q = (root: ParentNode, slot: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
const panels = (root: ParentNode) =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-slot="resizable-panel"]'));
const handle = (root: ParentNode) => q(root, 'resizable-handle');
function flush2(): void {
  flushEffects();
  flushEffects();
}
const grow = (el: HTMLElement) => Math.round(parseFloat(el.style.flexGrow || '0'));

describe('Resizable — structure', () => {
  it('renders a group with role=separator handle and aria wiring', () => {
    const c = mountGroup();
    flush2();
    const group = q(c, 'resizable-panel-group');
    expect(group.getAttribute('aria-orientation')).toBe('horizontal');
    const h = handle(c);
    expect(h.getAttribute('role')).toBe('separator');
    // A horizontal group has a vertical divider.
    expect(h.getAttribute('aria-orientation')).toBe('vertical');
    expect(h.getAttribute('tabindex')).toBe('0');
    expect(h.getAttribute('aria-valuenow')).toBe('50');
    expect(h.getAttribute('aria-valuemin')).toBe('20');
    expect(h.getAttribute('aria-valuemax')).toBe('80'); // 100 - bMin
  });

  it('applies default sizes as flex-grow', () => {
    const c = mountGroup({ aDefault: 30, bDefault: 70 });
    flush2();
    const [a, b] = panels(c);
    expect(grow(a)).toBe(30);
    expect(grow(b)).toBe(70);
  });

  it('splits evenly when no default sizes are given', () => {
    const c = mount(
      html`${ResizablePanelGroup({
        children: html`${ResizablePanel({ children: 'A' })}
        ${ResizableHandle({})}
        ${ResizablePanel({ children: 'B' })}`,
      })}`,
    );
    flush2();
    const [a, b] = panels(c);
    expect(grow(a)).toBe(50);
    expect(grow(b)).toBe(50);
  });
});

describe('Resizable — keyboard resize', () => {
  it('ArrowRight/ArrowLeft move size between the adjacent panels', () => {
    const c = mountGroup();
    flush2();
    const h = handle(c);
    const [a, b] = panels(c);

    h.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    flush2();
    expect(grow(a)).toBe(60);
    expect(grow(b)).toBe(40);
    expect(h.getAttribute('aria-valuenow')).toBe('60');

    h.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    flush2();
    expect(grow(a)).toBe(50);
  });

  it('respects min-size (cannot shrink a panel below its minimum)', () => {
    const c = mountGroup({ aMin: 40 });
    flush2();
    const h = handle(c);
    const [a] = panels(c);
    // 50 → 40 (one step), then clamped at 40.
    h.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    flush2();
    h.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    flush2();
    expect(grow(a)).toBe(40);
  });

  it('dispatches ui-resize with the layout on a keyboard step', () => {
    const c = mountGroup();
    flush2();
    const onResize = vi.fn();
    c.querySelector('ui-resizable-panel-group')!.addEventListener('ui-resize', onResize as EventListener);
    handle(c).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    flush2();
    const layout = (onResize.mock.calls[0][0] as CustomEvent).detail.layout as number[];
    expect(layout.map(Math.round)).toEqual([60, 40]);
  });
});

describe('Resizable — pointer drag', () => {
  it('dragging the handle resizes the adjacent panels', () => {
    // groupSize falls back to 100 under happy-dom, so 1px ≈ 1%.
    const c = mountGroup();
    flush2();
    const h = handle(c);
    const [a, b] = panels(c);

    h.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, bubbles: true }));
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 15 }));
    document.dispatchEvent(new MouseEvent('pointerup', { clientX: 15 }));
    flush2();
    expect(grow(a)).toBe(65);
    expect(grow(b)).toBe(35);
  });
});

describe('Resizable — vertical direction', () => {
  it('a vertical group has a horizontal divider and resizes on ArrowDown', () => {
    const c = mountGroup({ direction: 'vertical' });
    flush2();
    expect(q(c, 'resizable-panel-group').getAttribute('aria-orientation')).toBe('vertical');
    const h = handle(c);
    expect(h.getAttribute('aria-orientation')).toBe('horizontal');
    h.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    flush2();
    expect(grow(panels(c)[0])).toBe(60);
  });
});

describe('Resizable — with-handle grip + misuse', () => {
  it('renders the grip when withHandle is set', () => {
    const c = mountGroup({ withHandle: true });
    flush2();
    expect(handle(c).querySelector('svg')).not.toBeNull();
  });

  it('a panel outside a group renders an error fallback', () => {
    const host = document.createElement('ui-resizable-panel');
    document.body.appendChild(host);
    expect(host.querySelector('[data-slot="resizable-panel"]')).toBeNull();
    expect(host.textContent).toContain('Error');
  });
});
