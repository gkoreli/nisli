import { describe, it, expect } from 'vitest';
import { comparisonWindow, delta } from './delta.js';
import { monthPeriod } from './period.js';

describe('comparisonWindow (finance §6)', () => {
  it('a finished month compares whole-to-whole', () => {
    expect(comparisonWindow(monthPeriod('2026-07'), '2026-08-30')).toEqual({
      current: monthPeriod('2026-07'),
      previous: monthPeriod('2026-06'),
      complete: true,
    });
  });

  it('a partial month compares against the previous month truncated to the same elapsed days', () => {
    expect(comparisonWindow(monthPeriod('2026-08'), '2026-08-10')).toEqual({
      current: { start: '2026-08-01', end: '2026-08-10' },
      previous: { start: '2026-07-01', end: '2026-07-10' },
      complete: false,
    });
  });

  it('the last day of the month is a complete comparison', () => {
    expect(comparisonWindow(monthPeriod('2026-08'), '2026-08-31').complete).toBe(true);
  });

  it('a period that has not begun compares one day against one day, never an inverted window', () => {
    const w = comparisonWindow(monthPeriod('2026-09'), '2026-08-30');
    expect(w.current).toEqual({ start: '2026-09-01', end: '2026-09-01' });
    expect(w.previous).toEqual({ start: '2026-08-01', end: '2026-08-01' });
    expect(w.complete).toBe(false);
  });
});

describe('delta', () => {
  it('shows the subtraction and a whole percent', () => {
    expect(delta(11000, 10000)).toEqual({ diff: 1000, pct: 10 });
    expect(delta(9000, 10000)).toEqual({ diff: -1000, pct: -10 });
  });

  it('has no percent when the previous window held nothing — never a division by zero', () => {
    expect(delta(11000, 0)).toEqual({ diff: 11000 });
  });

  it('uses the magnitude of the previous value so a negative baseline keeps the sign honest', () => {
    expect(delta(-500, -1000)).toEqual({ diff: 500, pct: 50 });
  });
});
