/**
 * resizable.test.ts — panel-group sizing, handle drag + keyboard, min-size.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flush, flushEffects, html, type TemplateResult } from '@nisli/core';
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
const panels = (root: ParentNode): [HTMLElement, HTMLElement, ...HTMLElement[]] =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-slot="resizable-panel"]')) as [
    HTMLElement,
    HTMLElement,
    ...HTMLElement[],
  ];
const handle = (root: ParentNode) => q(root, 'resizable-handle');
function flush2(): void {
  flush();
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
    const layout = (onResize.mock.calls[0]![0] as CustomEvent).detail.layout as number[];
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
    const __err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const host = document.createElement('ui-resizable-panel');
    document.body.appendChild(host);
    expect(host.querySelector('[data-slot="resizable-panel"]')).toBeNull();
    expect(host.textContent).toContain('Error');
    expect(String(__err.mock.calls.flat())).toContain('must be used inside <ui-resizable-panel-group>');
    __err.mockRestore();
  });
});

// Post ADR 0025 items 1 + 3 (+ the v1.1 'number' kind), the panel/handle parts
// declare their attribute fallbacks via component()'s `attrs` option and
// register with the group as LIVE prop SIGNALS. On a plain-HTML host (nothing
// pinned by a factory), setAttribute() AFTER mount writes the prop signal, so
// default-size reflows the layout, min-size re-clamps + updates the handle's
// aria bounds, and with-handle toggles the grip. Under the old parse-time-only
// numAttr()/hasAttribute() reads these assertions would all fail.

describe('Resizable — live attribute reactivity', () => {
  /** Mount a plain-HTML group (A | handle | B) and return the container. */
  function mountPlain(a = '', b = '', handle = ''): ParentNode {
    document.body.innerHTML =
      '<ui-resizable-panel-group>' +
      `<ui-resizable-panel ${a}>A</ui-resizable-panel>` +
      `<ui-resizable-handle ${handle}></ui-resizable-handle>` +
      `<ui-resizable-panel ${b}>B</ui-resizable-panel>` +
      '</ui-resizable-panel-group>';
    flush2();
    flush2();
    return document.body;
  }

  it('default-size attribute flows through the number declaration to the layout', () => {
    const c = mountPlain('default-size="30" min-size="10"', 'default-size="70" min-size="10"');
    const [a, b] = panels(c);
    expect(grow(a)).toBe(30);
    expect(grow(b)).toBe(70);
  });

  it('setAttribute(default-size) after mount reflows the panels (live number)', () => {
    const c = mountPlain('default-size="50"', 'default-size="50"');
    let [a, b] = panels(c);
    expect(grow(a)).toBe(50);
    expect(grow(b)).toBe(50);

    const hosts = Array.from(c.querySelectorAll<HTMLElement>('ui-resizable-panel'));
    hosts[0]!.setAttribute('default-size', '30');
    hosts[1]!.setAttribute('default-size', '70');
    flush2();
    flush2();
    [a, b] = panels(c);
    expect(grow(a)).toBe(30);
    expect(grow(b)).toBe(70);
  });

  it('setAttribute(min-size) after mount re-clamps and updates the handle aria bounds', () => {
    const c = mountPlain('default-size="50" min-size="20"', 'default-size="50" min-size="20"');
    const h = handle(c);
    expect(h.getAttribute('aria-valuemax')).toBe('80'); // 100 - bMin(20)

    // Raise panel B's min-size live → aria max tightens and the drag clamps.
    Array.from(c.querySelectorAll<HTMLElement>('ui-resizable-panel'))[1]!
      .setAttribute('min-size', '40');
    flush2();
    flush2();
    expect(h.getAttribute('aria-valuemax')).toBe('60'); // 100 - bMin(40)

    // A big keyboard step is now clamped so B never drops below 40 (A ≤ 60).
    h.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    flush2();
    expect(grow(panels(c)[0])).toBe(60);
  });

  it('a garbage default-size attribute falls to the even-split default (number semantics)', () => {
    const c = mountPlain('default-size="oops"', 'default-size="70"');
    const [a, b] = panels(c);
    // "oops" → NaN → undefined (no declared default) → even-split of the 30 left.
    expect(grow(a)).toBe(30);
    expect(grow(b)).toBe(70);
  });

  it('setAttribute(with-handle) after mount toggles the grip (live boolean)', () => {
    const c = mountPlain();
    const h = document.body.querySelector('ui-resizable-handle') as HTMLElement;
    expect(handle(c).querySelector('svg')).toBeNull();

    h.setAttribute('with-handle', ''); // bare → true
    flush2();
    flush2();
    expect(handle(c).querySelector('svg')).not.toBeNull();

    h.setAttribute('with-handle', 'false'); // our boolean semantics → false
    flush2();
    flush2();
    expect(handle(c).querySelector('svg')).toBeNull();
  });
});
