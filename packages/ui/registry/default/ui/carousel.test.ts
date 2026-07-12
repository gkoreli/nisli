/**
 * carousel.test.ts — slide navigation, edge disable, keyboard, drag.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flush, flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from './carousel.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function itemsTemplate(count: number): TemplateResult {
  let t: TemplateResult = html``;
  for (let i = 0; i < count; i++) {
    t = html`${t}${CarouselItem({ children: `Slide ${i + 1}` })}`;
  }
  return t;
}

function mountCarousel(
  opts: { count?: number; orientation?: 'horizontal' | 'vertical' } = {},
): HTMLElement {
  const { count = 3, orientation } = opts;
  return mount(
    html`${Carousel({
      orientation,
      children: html`${CarouselContent({ children: itemsTemplate(count) })}
      ${CarouselPrevious({})}${CarouselNext({})}`,
    })}`,
  );
}

const q = (root: ParentNode, slot: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
const prev = (c: ParentNode) => q(c, 'carousel-previous') as HTMLButtonElement;
const next = (c: ParentNode) => q(c, 'carousel-next') as HTMLButtonElement;
function flush2(): void {
  flush();
}
function pointer(target: EventTarget, type: string, x: number, y: number, pointerId = 1): void {
  const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    isPrimary: { value: true },
    pointerType: { value: 'touch' },
  });
  target.dispatchEvent(event);
  flush2();
}

describe('Carousel — structure and ARIA', () => {
  it('is a carousel region with slide items and labeled nav buttons', () => {
    const c = mountCarousel();
    flush2();
    const region = q(c, 'carousel');
    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('aria-roledescription')).toBe('carousel');
    const items = c.querySelectorAll('[data-slot="carousel-item"]');
    expect(items).toHaveLength(3);
    expect(items[0]!.getAttribute('aria-roledescription')).toBe('slide');
    expect(items[0]!.hasAttribute('data-active')).toBe(true);
    expect(items[0]!.getAttribute('aria-hidden')).toBe('false');
    expect(items[0]!.getAttribute('aria-current')).toBe('true');
    expect(items[1]!.getAttribute('aria-hidden')).toBe('true');
    expect(items[1]!.hasAttribute('aria-current')).toBe(false);
    expect(prev(c).getAttribute('aria-label')).toBe('Previous slide');
    expect(next(c).getAttribute('aria-label')).toBe('Next slide');
  });
});

describe('Carousel — navigation + edges', () => {
  it('starts at the first slide: prev disabled, next enabled', () => {
    const c = mountCarousel();
    flush2();
    expect(prev(c).disabled).toBe(true);
    expect(next(c).disabled).toBe(false);
  });

  it('next/prev move through slides and disable at the ends (no loop)', () => {
    const c = mountCarousel();
    flush2();
    const onSelect = vi.fn();
    c.querySelector('ui-carousel')!.addEventListener('ui-select', onSelect as EventListener);

    next(c).click();
    flush2();
    expect((onSelect.mock.calls[0]![0] as CustomEvent).detail).toEqual({ index: 1 });
    expect(prev(c).disabled).toBe(false);

    next(c).click();
    flush2();
    expect(next(c).disabled).toBe(true); // last slide (index 2 of 3)

    next(c).click(); // no-op at the end
    flush2();
    expect(next(c).disabled).toBe(true);

    prev(c).click();
    flush2();
    expect(next(c).disabled).toBe(false);
  });
});

describe('Carousel — keyboard', () => {
  it('ArrowRight/ArrowLeft navigate', () => {
    const c = mountCarousel();
    flush2();
    const region = q(c, 'carousel');
    region.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    flush2();
    expect(prev(c).disabled).toBe(false);
    region.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    flush2();
    expect(prev(c).disabled).toBe(true); // back to the first slide
  });
});

describe('Carousel — drag', () => {
  it('dragging past the threshold settles to the next/previous slide', () => {
    const c = mountCarousel();
    flush2();
    const viewport = q(c, 'carousel-content');

    // Drag left → next slide.
    viewport.dispatchEvent(new MouseEvent('pointerdown', { clientX: 200, bubbles: true }));
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 80 }));
    document.dispatchEvent(new MouseEvent('pointerup', { clientX: 80 }));
    flush2();
    expect(prev(c).disabled).toBe(false); // moved off the first slide

    // Drag right → previous slide.
    viewport.dispatchEvent(new MouseEvent('pointerdown', { clientX: 80, bubbles: true }));
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 220 }));
    document.dispatchEvent(new MouseEvent('pointerup', { clientX: 220 }));
    flush2();
    expect(prev(c).disabled).toBe(true); // back to the first slide
  });

  it('a small drag settles back (no slide change)', () => {
    const c = mountCarousel();
    flush2();
    const viewport = q(c, 'carousel-content');
    viewport.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, bubbles: true }));
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 90 })); // 10px < threshold
    document.dispatchEvent(new MouseEvent('pointerup', { clientX: 90 }));
    flush2();
    expect(prev(c).disabled).toBe(true); // still on the first slide
  });

  it('tap and cross-axis touch yield without moving the selected slide', () => {
    const c = mountCarousel();
    const viewport = q(c, 'carousel-content');
    pointer(viewport, 'pointerdown', 200, 100);
    pointer(document, 'pointerup', 200, 100);
    expect(prev(c).disabled).toBe(true);

    pointer(viewport, 'pointerdown', 200, 100);
    pointer(document, 'pointermove', 196, 120);
    pointer(document, 'pointerup', 196, 120);
    expect(prev(c).disabled).toBe(true);
    expect(q(c, 'carousel-content').firstElementChild?.getAttribute('style')).toContain('translate3d(0px');
  });

  it('ignores competing pointer ids and clamps edge overscroll', () => {
    const c = mountCarousel();
    const viewport = q(c, 'carousel-content');
    const track = viewport.firstElementChild as HTMLElement;
    pointer(viewport, 'pointerdown', 200, 100, 1);
    pointer(document, 'pointermove', 20, 100, 2); // competing contact
    expect(track.style.transform).toContain('translate3d(0px');
    pointer(document, 'pointermove', 260, 100, 1); // overscroll before first
    expect(track.style.transform).toContain('translate3d(0px');
    pointer(document, 'pointerup', 260, 100, 1);
    expect(prev(c).disabled).toBe(true);
  });

  it('disconnect mid-drag settles and removes document listeners', async () => {
    const c = mountCarousel();
    const root = c.querySelector('ui-carousel') as HTMLElement;
    const viewport = q(c, 'carousel-content');
    pointer(viewport, 'pointerdown', 200, 100);
    pointer(document, 'pointermove', 100, 100);
    root.remove();
    await Promise.resolve();
    pointer(document, 'pointermove', 20, 100);
    pointer(document, 'pointerup', 20, 100);
    expect(root.hasAttribute('open')).toBe(false);
  });

  it('vertical orientation locks to Y and snaps active/ARIA state atomically', () => {
    const c = mountCarousel({ orientation: 'vertical' });
    const viewport = q(c, 'carousel-content');
    pointer(viewport, 'pointerdown', 100, 200);
    pointer(document, 'pointermove', 100, 80);
    pointer(document, 'pointerup', 100, 80);
    const slides = c.querySelectorAll('[data-slot="carousel-item"]');
    expect(slides[0]!.getAttribute('aria-hidden')).toBe('true');
    expect(slides[1]!.hasAttribute('data-active')).toBe(true);
    expect(slides[1]!.getAttribute('aria-hidden')).toBe('false');
  });
});

describe('Carousel — single slide', () => {
  it('disables both nav buttons and ignores drag', () => {
    const c = mountCarousel({ count: 1 });
    flush2();
    expect(prev(c).disabled).toBe(true);
    expect(next(c).disabled).toBe(true);
    const viewport = q(c, 'carousel-content');
    viewport.dispatchEvent(new MouseEvent('pointerdown', { clientX: 200, bubbles: true }));
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 20 }));
    document.dispatchEvent(new MouseEvent('pointerup', { clientX: 20 }));
    flush2();
    expect(next(c).disabled).toBe(true);
  });
});

describe('Carousel — misuse', () => {
  it('content used outside <ui-carousel> renders an error fallback', () => {
    const __err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const host = document.createElement('ui-carousel-content');
    document.body.appendChild(host);
    expect(host.querySelector('[data-slot="carousel-content"]')).toBeNull();
    expect(host.textContent).toContain('Error');
    expect(String(__err.mock.calls.flat())).toContain('must be used inside <ui-carousel>');
    __err.mockRestore();
  });
});
