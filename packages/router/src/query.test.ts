import { describe, expect, it } from 'vitest';
import { booleanParam, enumParam, numberParam, optional, stringParam } from './query.js';

describe('query codecs', () => {
  it('parse and serialize values deterministically', () => {
    expect(stringParam().parse('hello')).toBe('hello');
    expect(numberParam().parse('2.5')).toBe(2.5);
    expect(booleanParam().parse('1')).toBe(true);
    expect(booleanParam().serialize(false)).toBe('false');
    expect(enumParam(['profile', 'activity'] as const).parse('activity')).toBe('activity');
  });

  it('rejects invalid untrusted values', () => {
    expect(() => numberParam().parse('NaN')).toThrow('Invalid number');
    expect(() => booleanParam().parse('yes')).toThrow('Invalid boolean');
    expect(() => enumParam(['a', 'b'] as const).parse('c')).toThrow('Expected one of');
  });

  it('supports optional and defaulted values', () => {
    expect(optional(stringParam()).parse(null)).toBeUndefined();
    expect(optional(stringParam()).serialize(undefined)).toBeUndefined();
    const page = numberParam().default(1);
    expect(page.parse(null)).toBe(1);
    expect(page.serialize(1)).toBeUndefined();
    expect(page.serialize(2)).toBe('2');
  });
});
