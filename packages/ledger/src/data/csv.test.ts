import { describe, it, expect } from 'vitest';
import { parseCsv, parseDate, parseAmount } from './csv.js';

describe('csv', () => {
  it('reads quotes, escaped quotes, CRLF and a BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"']]);
  });
  it('parses dates in three orders', () => {
    expect(parseDate('2026-08-03', 'YMD')).toBe('2026-08-03');
    expect(parseDate('03/08/2026', 'DMY')).toBe('2026-08-03');
    expect(parseDate('8/3/26', 'MDY')).toBe('2026-08-03');
    expect(parseDate('nope', 'YMD')).toBeUndefined();
  });
  it('parses amounts in the shapes banks export', () => {
    expect(parseAmount('-1,234.56')).toBe(-123456);
    expect(parseAmount('(12.00)')).toBe(-1200);
    expect(parseAmount('1 234,56 ₾')).toBe(123456);
    expect(parseAmount('$42')).toBe(4200);
    expect(parseAmount('')).toBeUndefined();
  });
});
