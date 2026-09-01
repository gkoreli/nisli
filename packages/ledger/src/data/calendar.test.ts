import { describe, expect, it } from 'vitest';
import { localDate, localMonth } from './calendar.js';

describe('local calendar', () => {
  it('uses local calendar fields rather than the UTC ISO date', () => {
    const localEvening = { getFullYear: () => 2026, getMonth: () => 7, getDate: () => 31 };
    expect(localDate(localEvening)).toBe('2026-08-31');
    expect(localMonth(localEvening)).toBe('2026-08');
  });

  it('pads single-digit months and days', () => {
    expect(localDate(new Date(2026, 0, 2, 8))).toBe('2026-01-02');
  });
});
