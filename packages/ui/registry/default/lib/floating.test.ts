/**
 * floating.test.ts — anchored positioning math and DOM wiring.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import {
  component,
  computed,
  flushEffects,
  html,
  ref,
  signal,
} from '@nisli/core';
import {
  computePosition,
  floatingHidden,
  positionFloating,
  transformOrigin,
} from './floating.js';

// A 100×40 anchor centered-ish in a 1000×800 viewport; a 200×100 floater.
const viewport = { width: 1000, height: 800 };
const anchor = { x: 400, y: 300, width: 100, height: 40 };
const floating = { x: 0, y: 0, width: 200, height: 100 };

describe('computePosition()', () => {
  it('places bottom/center by default', () => {
    const pos = computePosition(anchor, floating, viewport);
    expect(pos).toEqual({ x: 350, y: 340, side: 'bottom', align: 'center' });
  });

  it('places each side with sideOffset', () => {
    const opts = { sideOffset: 10 };
    expect(computePosition(anchor, floating, viewport, { ...opts, side: 'top' }).y).toBe(190);
    expect(computePosition(anchor, floating, viewport, { ...opts, side: 'bottom' }).y).toBe(350);
    expect(computePosition(anchor, floating, viewport, { ...opts, side: 'left' }).x).toBe(190);
    expect(computePosition(anchor, floating, viewport, { ...opts, side: 'right' }).x).toBe(510);
  });

  it('aligns start and end along the anchor edge', () => {
    expect(computePosition(anchor, floating, viewport, { align: 'start' }).x).toBe(400);
    expect(computePosition(anchor, floating, viewport, { align: 'end' }).x).toBe(300);
    expect(
      computePosition(anchor, floating, viewport, { align: 'start', alignOffset: 5 }).x,
    ).toBe(405);
  });

  it('flips to the opposite side when the preferred side overflows', () => {
    const nearBottom = { ...anchor, y: 720 };
    const pos = computePosition(nearBottom, floating, viewport, { side: 'bottom' });
    expect(pos.side).toBe('top');
    expect(pos.y).toBe(620);
  });

  it('keeps the preferred side when the opposite side also overflows', () => {
    const tinyViewport = { width: 1000, height: 120 };
    const middle = { x: 400, y: 40, width: 100, height: 40 };
    const pos = computePosition(middle, floating, tinyViewport, { side: 'bottom' });
    expect(pos.side).toBe('bottom');
  });

  it('does not flip when avoidCollisions is false', () => {
    const nearBottom = { ...anchor, y: 720 };
    const pos = computePosition(nearBottom, floating, viewport, {
      side: 'bottom',
      avoidCollisions: false,
    });
    expect(pos.side).toBe('bottom');
    expect(pos.y).toBe(760);
  });

  it('clamps the align axis into the viewport with collisionPadding', () => {
    const nearLeftEdge = { ...anchor, x: 0 };
    const pos = computePosition(nearLeftEdge, floating, viewport, { align: 'end' });
    expect(pos.x).toBe(8); // clamped to default padding, not -100
  });
});

describe('transformOrigin()', () => {
  it('uses the anchor-facing edge and requested cross-axis alignment', () => {
    expect(transformOrigin('bottom', 'start')).toBe('0% 0%');
    expect(transformOrigin('top', 'end')).toBe('100% 100%');
    expect(transformOrigin('right', 'center')).toBe('0% 50%');
    expect(transformOrigin('left', 'start')).toBe('100% 0%');
  });
});

describe('positionFloating()', () => {
  function mockRect(el: HTMLElement, rect: { x: number; y: number; width: number; height: number }): void {
    el.getBoundingClientRect = () =>
      ({ ...rect, top: rect.y, left: rect.x, right: rect.x + rect.width, bottom: rect.y + rect.height }) as DOMRect;
  }

  it('applies fixed position, coordinates, and data attributes', () => {
    const anchorEl = document.createElement('button');
    const floatEl = document.createElement('div');
    floatEl.dataset.slot = 'tooltip-content';
    document.body.append(anchorEl, floatEl);
    mockRect(anchorEl, anchor);
    mockRect(floatEl, floating);

    const dispose = positionFloating(anchorEl, floatEl, { side: 'top', align: 'start' });

    expect(floatEl.style.position).toBe('fixed');
    expect(floatEl.style.left).toBe('400px');
    expect(floatEl.style.top).toBe('200px');
    expect(floatEl.getAttribute('data-side')).toBe('top');
    expect(floatEl.getAttribute('data-align')).toBe('start');
    expect(floatEl.style.getPropertyValue('--radix-tooltip-content-transform-origin')).toBe('0% 100%');
    dispose();
  });

  it.each([
    ['popover-content', '--radix-popover-content-transform-origin'],
    ['hover-card-content', '--radix-hover-card-content-transform-origin'],
    ['dropdown-menu-content', '--radix-dropdown-menu-content-transform-origin'],
    ['dropdown-menu-sub-content', '--radix-dropdown-menu-content-transform-origin'],
    ['context-menu-content', '--radix-context-menu-content-transform-origin'],
    ['context-menu-sub-content', '--radix-context-menu-content-transform-origin'],
    ['menubar-content', '--radix-menubar-content-transform-origin'],
    ['menubar-sub-content', '--radix-menubar-content-transform-origin'],
  ])('sets the anchored origin variable for %s', (slot, variable) => {
    const anchorEl = document.createElement('button');
    const floatEl = document.createElement('div');
    floatEl.dataset.slot = slot;
    document.body.append(anchorEl, floatEl);
    mockRect(anchorEl, anchor);
    mockRect(floatEl, floating);

    const dispose = positionFloating(anchorEl, floatEl, { side: 'right', align: 'end' });
    expect(floatEl.style.getPropertyValue(variable)).toBe('0% 100%');
    dispose();
  });

  it('repositions on scroll and stops after dispose', () => {
    const anchorEl = document.createElement('button');
    const floatEl = document.createElement('div');
    document.body.append(anchorEl, floatEl);
    mockRect(anchorEl, anchor);
    mockRect(floatEl, floating);

    const dispose = positionFloating(anchorEl, floatEl, {});
    mockRect(anchorEl, { ...anchor, y: 100 });
    window.dispatchEvent(new Event('scroll'));
    expect(floatEl.style.top).toBe('140px');

    dispose();
    mockRect(anchorEl, { ...anchor, y: 500 });
    window.dispatchEvent(new Event('scroll'));
    expect(floatEl.style.top).toBe('140px'); // unchanged — disposed
  });
});

describe('floatingHidden()', () => {
  const open = signal(true);
  const TestLayer = component('test-floating-visibility-ui45', () => {
    const element = ref<HTMLDivElement>();
    return html`<div
      ref="${element}"
      data-state="${computed(() => (open.value ? 'open' : 'closed'))}"
      hidden="${floatingHidden(open, element)}"
    ></div>`;
  });

  function mountLayer(): { host: HTMLElement; layer: HTMLDivElement } {
    open.value = true;
    const container = document.createElement('div');
    document.body.appendChild(container);
    html`${TestLayer({})}`.mount(container);
    const host = container.querySelector('test-floating-visibility-ui45') as HTMLElement;
    flushEffects();
    return { host, layer: host.querySelector('div') as HTMLDivElement };
  }

  it('hides immediately when no closing animation is computed', () => {
    const { host, layer } = mountLayer();
    open.value = false;
    flushEffects();
    expect(layer.hidden).toBe(true);
    host.remove();
  });

  it('waits for animationend and ignores a stale close after reopening', () => {
    const { host, layer } = mountLayer();
    layer.style.animationName = 'floating-close';
    layer.style.animationDuration = '100ms';

    open.value = false;
    flushEffects();
    expect(layer.dataset.state).toBe('closed');
    expect(layer.hidden).toBe(false);

    open.value = true;
    flushEffects();
    layer.dispatchEvent(new AnimationEvent('animationend', { bubbles: true }));
    expect(layer.hidden).toBe(false);

    open.value = false;
    flushEffects();
    layer.dispatchEvent(new AnimationEvent('animationend', { bubbles: true }));
    flushEffects();
    expect(layer.hidden).toBe(true);
    host.remove();
  });

  it('also completes closing on animationcancel', () => {
    const { host, layer } = mountLayer();
    layer.style.animationName = 'floating-close';
    layer.style.animationDuration = '100ms';
    open.value = false;
    flushEffects();

    layer.dispatchEvent(new AnimationEvent('animationcancel', { bubbles: true }));
    flushEffects();
    expect(layer.hidden).toBe(true);
    host.remove();
  });

  it('removes pending animation listeners on disconnect', async () => {
    const { host, layer } = mountLayer();
    layer.style.animationName = 'floating-close';
    layer.style.animationDuration = '100ms';
    open.value = false;
    flushEffects();
    expect(layer.hidden).toBe(false);

    host.remove();
    await Promise.resolve();
    layer.dispatchEvent(new AnimationEvent('animationend', { bubbles: true }));
    expect(layer.hidden).toBe(false);
  });
});
