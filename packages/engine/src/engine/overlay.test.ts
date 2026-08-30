/** The overlay decisions, pure: what a kind means, who an Escape reaches, where a menu goes. */
import { describe, it, expect } from 'vitest';
import { metrics } from '../metrics.js';
import { defaults, layer, push, pop, top, reach, locks, escapeTarget, pointerTarget, zIndexOf, placeMenu, EMPTY_STACK } from './overlay.js';

describe('overlay — the vocabulary as data', () => {
  it('defaults: a modal dismisses, traps, locks and restores; a popover dismisses and restores; a passive layer does nothing', () => {
    expect(defaults('modal')).toEqual({ kind: 'modal', dismiss: { escape: true, outside: true }, trap: true, lock: true, restoreFocus: true });
    expect(defaults('popover')).toEqual({ kind: 'popover', dismiss: { escape: true, outside: true }, trap: false, lock: false, restoreFocus: true });
    expect(defaults('passive')).toEqual({ kind: 'passive', dismiss: { escape: false, outside: false }, trap: false, lock: false, restoreFocus: false });
    expect(layer(7, 'modal').id).toBe(7);
  });

  it('stack: push makes the top, pop removes by id, top names the last', () => {
    const a = layer(1, 'modal'), b = layer(2, 'popover');
    let s = push(push(EMPTY_STACK, a), b);
    expect(top(s)).toBe(b);
    expect(top(s)?.id).toBe(2);
    s = pop(s, 2);
    expect(top(s)).toBe(a);
    expect(pop(s, 99)).toBe(s);
    expect(top(pop(s, 1))).toBeNull();
    expect(push(s, a)).toEqual([a]);        // re-pushing does not duplicate
  });

  it('routing: Escape and an outside pointer reach the topmost non-passive layer only, and only when it dismisses that way', () => {
    const dialog = layer(1, 'modal'), menu = layer(2, 'popover'), notice = layer(3, 'passive');
    const s = push(push(EMPTY_STACK, dialog), menu);
    expect(escapeTarget(s)).toBe(menu);
    expect(escapeTarget(pop(s, 2))).toBe(dialog);
    expect(reach(push(s, notice))).toBe(menu);             // a passive top is transparent: it neither swallows nor dismisses
    expect(escapeTarget(push(s, notice))).toBe(menu);
    expect(escapeTarget(push(EMPTY_STACK, notice))).toBeNull();
    expect(escapeTarget(EMPTY_STACK)).toBeNull();
    expect(pointerTarget(s, false)).toBe(menu);           // outside the menu: the menu closes, the dialog does not
    expect(pointerTarget(s, true)).toBeNull();            // inside the reachable layer or anything above it: nothing closes
    expect(pointerTarget(push(s, notice), false)).toBe(menu);
    expect(pointerTarget(push(EMPTY_STACK, notice), false)).toBeNull();
  });

  it('scroll lock: while any modal is open', () => {
    expect(locks(EMPTY_STACK)).toBe(false);
    expect(locks(push(EMPTY_STACK, layer(1, 'popover')))).toBe(false);
    expect(locks(push(push(EMPTY_STACK, layer(1, 'modal')), layer(2, 'popover')))).toBe(true);
  });

  it('z-order: the kind base from metrics plus the stack position is the paint order — chrome below modals below popovers below notices', () => {
    const s = push(push(EMPTY_STACK, layer(1, 'modal')), layer(2, 'modal'));
    expect(zIndexOf(s, 1, 'modal')).toBe(metrics.layer.modal);
    expect(zIndexOf(s, 2, 'modal')).toBe(metrics.layer.modal + 1);
    expect(zIndexOf(s, 9, 'popover')).toBe(metrics.layer.popover);
    expect(metrics.layer.sticky).toBeLessThan(metrics.layer.bar);
    expect(metrics.layer.bar).toBeLessThan(metrics.layer.modal);
    expect(metrics.layer.popover).toBeGreaterThan(metrics.layer.modal + 10);
    expect(metrics.layer.passive).toBeGreaterThan(metrics.layer.popover + 10);
    expect(zIndexOf(s, 1, 'modal', { modal: 5, popover: 1, passive: 9 })).toBe(5);
  });

  describe('placeMenu', () => {
    const viewport = { width: 1000, height: 800 };
    const menu = { width: 160, height: 120 };
    it('below and leading-aligned when everything fits', () => {
      expect(placeMenu({ top: 100, left: 100, width: 40, height: 32 }, menu, viewport)).toEqual({ top: 132, left: 100 });
      expect(placeMenu({ top: 100, left: 100, width: 40, height: 32 }, menu, viewport, { gap: 4 })).toEqual({ top: 136, left: 100 });
    });
    it('rtl swaps the edges: leading is the right edge, trailing the left; the flip and the clamp still hold', () => {
      const anchor = { top: 100, left: 500, width: 40, height: 32 };
      expect(placeMenu(anchor, menu, viewport, { dir: 'rtl' })).toEqual({ top: 132, left: 380 });                       // leading = right-aligned
      expect(placeMenu(anchor, menu, viewport, { dir: 'rtl', align: 'trailing' })).toEqual({ top: 132, left: 500 });   // trailing = left-aligned
      expect(placeMenu({ ...anchor, left: 20 }, menu, viewport, { dir: 'rtl' })).toEqual({ top: 132, left: 20 });      // would leave at the left: flips
      expect(placeMenu({ ...anchor, left: 980 }, menu, viewport, { dir: 'rtl', align: 'trailing' })).toEqual({ top: 132, left: 840 }); // flips, then clamps
    });
    it('flips above when there is no room below and there is above', () => {
      expect(placeMenu({ top: 700, left: 100, width: 40, height: 32 }, menu, viewport)).toEqual({ top: 580, left: 100 });
    });
    it('stays below, clamped, when it fits neither below nor above', () => {
      expect(placeMenu({ top: 100, left: 0, width: 40, height: 32 }, { width: 160, height: 790 }, viewport)).toEqual({ top: 10, left: 0 });
    });
    it('trailing alignment flips to the anchor’s right edge at the right viewport edge; trailing preference flips to leading at the left edge', () => {
      expect(placeMenu({ top: 10, left: 950, width: 40, height: 32 }, menu, viewport)).toEqual({ top: 42, left: 830 });
      expect(placeMenu({ top: 10, left: 950, width: 40, height: 32 }, menu, viewport, { align: 'trailing' })).toEqual({ top: 42, left: 830 });
      expect(placeMenu({ top: 10, left: 10, width: 40, height: 32 }, menu, viewport, { align: 'trailing' })).toEqual({ top: 42, left: 10 });
    });
    it('never leaves the viewport: a menu wider than it is clamped to 0', () => {
      expect(placeMenu({ top: 10, left: 500, width: 40, height: 32 }, { width: 2000, height: 100 }, viewport)).toEqual({ top: 42, left: 0 });
      expect(placeMenu({ top: -50, left: -50, width: 40, height: 32 }, menu, viewport)).toEqual({ top: 0, left: 0 });
    });
  });
});
