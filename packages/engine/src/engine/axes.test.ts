/**
 * The axes (ADR 0046): detected for real (happy-dom evaluates `(pointer:
 * coarse)` from `navigator.maxTouchPoints` and fires `change` on resize),
 * `'system'` resolutions, overrides, the pure table, and the live door.
 * @vitest-environment happy-dom
 */
import { describe, it, expect, afterEach } from 'vitest';
import { computed, flushEffects } from '@nisli/core';
import { axes, scheme, density, input, sizing, setScheme, setDensity, setInput } from './axes.js';
import { metrics, metricsFor } from '../metrics.js';

/** happy-dom's device seam: the readings its media queries evaluate. */
const device = () => (window as unknown as { happyDOM: { settings: { navigator: { maxTouchPoints: number }; device: { prefersColorScheme: string } } } }).happyDOM.settings;
/** A media query fires `change` in happy-dom when a resize finds its answer moved. */
const platformChanged = () => window.dispatchEvent(new Event('resize'));

/** The 0.9.0 constant, number for number, plus `hit: 24` — the oracle the default table must equal. */
const V090 = {
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32 },
  control: { height: 32, padX: 12, check: 16, hit: 24 },
  charWidth: 7.2,
  layer: { sticky: 10, bar: 20, modal: 100, popover: 150, passive: 200 },
  layout: {
    sidebarWidth: 232, contentMin: 560, contentMax: 1120, minField: 240, minLabel: 64,
    dialogMin: 640, dialogWidth: 520, minTextColumn: 96, minTitle: 80, menuWidth: 160, tablePage: 60,
    dateChars: 8, figureChars: 12, textColumnCap: 320, labelChars: 20, axisChars: 8,
  },
};

afterEach(() => {
  setScheme('system'); setDensity('system'); setInput('system');
  device().navigator.maxTouchPoints = 0; device().device.prefersColorScheme = 'light';
  platformChanged();
});

describe('axes', () => {
  it("'system' resolves to the platform: light, comfortable, pointer here", () => {
    expect(axes.value).toEqual({ scheme: 'light', density: 'comfortable', input: 'pointer' });
  });

  it('setDensity and setInput override, and system restores', () => {
    setDensity('compact'); setInput('touch');
    expect(density.value).toBe('compact');
    expect(input.value).toBe('touch');
    expect(axes.value).toEqual({ scheme: 'light', density: 'compact', input: 'touch' });
    setDensity('system'); setInput('system');
    expect(axes.value).toEqual({ scheme: 'light', density: 'comfortable', input: 'pointer' });
  });

  it('input is detected from (pointer: coarse), live: a coarse pointer appearing flips it to touch, and back', () => {
    expect(input.value).toBe('pointer');
    device().navigator.maxTouchPoints = 5; platformChanged();
    expect(input.value).toBe('touch');
    expect(axes.value.input).toBe('touch');
    device().navigator.maxTouchPoints = 0; platformChanged();
    expect(input.value).toBe('pointer');
  });

  it('a preference wins over the platform; system hands back to it', () => {
    device().navigator.maxTouchPoints = 5; platformChanged();
    setInput('pointer');
    expect(input.value).toBe('pointer');
    setInput('system');
    expect(input.value).toBe('touch');
  });

  it('scheme follows prefers-color-scheme, live, as before the move', () => {
    expect(scheme.value).toBe('light');
    device().device.prefersColorScheme = 'dark'; platformChanged();
    expect(scheme.value).toBe('dark');
    setScheme('light');
    expect(scheme.value).toBe('light');
  });

  it("density has no platform signal: 'system' is comfortable whatever the input", () => {
    device().navigator.maxTouchPoints = 5; platformChanged();
    expect(density.value).toBe('comfortable');
  });
});

describe('metricsFor', () => {
  it('comfortable + pointer is the 0.9.0 constant, deeply, with hit 24', () => {
    expect(metricsFor({ density: 'comfortable', input: 'pointer' })).toEqual(V090);
  });

  it('is pure: the current axes do not enter it', () => {
    setDensity('compact'); setInput('touch');
    expect(metricsFor({ density: 'comfortable', input: 'pointer' })).toEqual(V090);
  });

  it('compact: space 4 6 8 12 16 24, height 28, padX 8; check, hit, charWidth, layer and layout unchanged', () => {
    expect(metricsFor({ density: 'compact', input: 'pointer' })).toEqual({
      ...V090,
      space: { 1: 4, 2: 6, 3: 8, 4: 12, 5: 16, 6: 24 },
      control: { height: 28, padX: 8, check: 16, hit: 24 },
    });
  });

  it('touch: height max(32, 44), check 24, hit 44; space, padX, charWidth, layer and layout unchanged', () => {
    expect(metricsFor({ density: 'comfortable', input: 'touch' })).toEqual({
      ...V090,
      control: { height: 44, padX: 12, check: 24, hit: 44 },
    });
  });

  it('compact + touch: the floor wins, the rhythm stays — 44 / 8 / 24 / 44 with compact spacing', () => {
    expect(metricsFor({ density: 'compact', input: 'touch' })).toEqual({
      ...V090,
      space: { 1: 4, 2: 6, 3: 8, 4: 12, 5: 16, 6: 24 },
      control: { height: 44, padX: 8, check: 24, hit: 44 },
    });
  });
});

describe('the door is live', () => {
  it('a computed over metrics.control.height flips 32 → 44 on setInput(touch)', () => {
    const height = computed(() => metrics.control.height);
    expect(height.value).toBe(32);
    setInput('touch');
    expect(height.value).toBe(44);
    expect(metrics.control.hit).toBe(44);
    setDensity('compact');
    expect(metrics.space[2]).toBe(6);
    expect(height.value).toBe(44);
  });

  it('a scheme flip does not re-decide the table: sizing keeps its identity, the computed does not re-run', () => {
    let runs = 0;
    const table = computed(() => { runs++; return metricsFor(sizing.value); });
    const before = sizing.value;
    expect(table.value.control.height).toBe(32);
    expect(runs).toBe(1);
    setScheme('dark'); flushEffects();
    expect(axes.value.scheme).toBe('dark');
    expect(sizing.value).toBe(before);
    expect(table.value.control.height).toBe(32);
    expect(runs).toBe(1);
    setInput('touch');
    expect(sizing.value).not.toBe(before);
    expect(table.value.control.height).toBe(44);
    expect(runs).toBe(2);
  });
});
