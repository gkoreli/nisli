import { describe, it, expect } from 'vitest';
import { metrics } from '../metrics.js';
import { shellMode, dialogMode, labelColumn, labelEvery, labelWidth, pageSize, fit, columnsFor } from './space.js';

const L = metrics.layout;

describe('space — decisions from a width', () => {
  it('re-exports the fit and columns decisions', () => {
    expect(typeof fit).toBe('function');
    expect(columnsFor(928, 4, 220, 16)).toBe(4);
  });

  it('shellMode: a sidebar iff a useful content column fits beside it; unmeasured is roomy', () => {
    const edge = L.sidebarWidth + L.contentMin;
    expect(shellMode(0)).toBe('sidebar');
    expect(shellMode(edge)).toBe('sidebar');
    expect(shellMode(edge - 1)).toBe('bar');
    expect(shellMode(360)).toBe('bar');
  });

  it('dialogMode: a sheet below dialogMin, a card at it and above; unmeasured is a card', () => {
    expect(dialogMode(0)).toBe('card');
    expect(dialogMode(L.dialogMin)).toBe('card');
    expect(dialogMode(L.dialogMin - 1)).toBe('sheet');
    expect(dialogMode(360)).toBe('sheet');
  });

  it('labelWidth: characters by glyph width plus a breath; padding and glyph width may be passed', () => {
    expect(labelWidth('')).toBe(metrics.space[2]);
    expect(labelWidth('abcd')).toBe(4 * metrics.charWidth + metrics.space[2]);
    expect(labelWidth('abcd', 24)).toBe(4 * metrics.charWidth + 24);
    expect(labelWidth('abcd', 0, 8)).toBe(32);
  });

  it('every threshold decision takes an explicit layout, so a density axis can move it', () => {
    const tight = { ...L, sidebarWidth: 100, contentMin: 100, dialogMin: 300, minLabel: 10 };
    expect(shellMode(200, tight)).toBe('sidebar');
    expect(shellMode(199, tight)).toBe('bar');
    expect(dialogMode(299, tight)).toBe('sheet');
    expect(dialogMode(300, tight)).toBe('card');
    expect(labelColumn(120, 200, tight)).toBe(40);
    expect(pageSize(0, 100, 25)).toEqual({ remaining: 100, next: 25 });
  });

  it('labelColumn: natural when unmeasured, else at most a third, never below the minimum', () => {
    expect(labelColumn(0, 200)).toBe(200);
    expect(labelColumn(900, 200)).toBe(200);           // a third (300) has room
    expect(labelColumn(300, 200)).toBe(100);           // a third
    expect(labelColumn(120, 200)).toBe(L.minLabel);    // a third (40) is below the floor
    expect(labelColumn(120, 50)).toBe(50);             // shorter than the floor: natural
  });

  it('labelEvery: one label per slot when they fit, every nth otherwise, never below 1', () => {
    expect(labelEvery(100, 60)).toBe(1);
    expect(labelEvery(60, 60)).toBe(1);
    expect(labelEvery(59, 60)).toBe(2);
    expect(labelEvery(33.3, 60)).toBe(2);
    expect(labelEvery(30, 60)).toBe(2);
    expect(labelEvery(29, 60)).toBe(3);
    expect(labelEvery(0, 60)).toBe(60);                // a zero slot is treated as one px
  });

  it('pageSize: how many remain and how many the next request reveals', () => {
    expect(pageSize(60, 150)).toEqual({ remaining: 90, next: L.tablePage });
    expect(pageSize(120, 150)).toEqual({ remaining: 30, next: 30 });
    expect(pageSize(150, 150)).toEqual({ remaining: 0, next: 0 });
    expect(pageSize(200, 150)).toEqual({ remaining: 0, next: 0 });
  });
});
