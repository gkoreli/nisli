import { describe, it, expect } from 'vitest';
import { columnsFor } from './columns.js';

describe('columnsFor', () => {
  it('never returns fewer than one or more than the item count', () => {
    expect(columnsFor(100, 4, 220, 16)).toBe(1);
    expect(columnsFor(5000, 3, 220, 16)).toBe(3);
    expect(columnsFor(500, 0, 220, 16)).toBe(1);
  });
  it('counts gaps: 4 columns need 4*220 + 3*16 = 928', () => {
    expect(columnsFor(927, 4, 220, 16)).toBe(3);
    expect(columnsFor(928, 4, 220, 16)).toBe(4);
  });
});
