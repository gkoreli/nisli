/**
 * typeahead.test.ts — menu typeahead search behavior.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { typeahead } from './typeahead.js';

const labels = ['Apple', 'Avocado', 'Banana', 'Blueberry', 'Cherry'];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('typeahead()', () => {
  it('matches the first label starting with a typed character', () => {
    const t = typeahead();
    expect(t.onKey('b', labels, -1)).toBe(2); // Banana
    vi.advanceTimersByTime(1100); // buffer reset — fresh search
    expect(t.onKey('c', labels, 2)).toBe(4); // Cherry
  });

  it('cycles items sharing a first letter on repeated presses', () => {
    const t = typeahead();
    expect(t.onKey('a', labels, -1)).toBe(0); // Apple
    expect(t.onKey('a', labels, 0)).toBe(1); // Avocado
    expect(t.onKey('a', labels, 1)).toBe(0); // wraps to Apple
  });

  it('refines with multi-character prefixes, including the current item', () => {
    const t = typeahead();
    expect(t.onKey('b', labels, -1)).toBe(2); // Banana
    expect(t.onKey('l', labels, 2)).toBe(3); // "bl" → Blueberry
    expect(t.onKey('u', labels, 3)).toBe(3); // "blu" stays on Blueberry
  });

  it('matches case-insensitively and returns -1 when nothing matches', () => {
    const t = typeahead();
    expect(t.onKey('A', labels, -1)).toBe(0);
    const t2 = typeahead();
    expect(t2.onKey('z', labels, -1)).toBe(-1);
  });

  it('ignores non-printable keys and a leading space', () => {
    const t = typeahead();
    expect(t.onKey('ArrowDown', labels, -1)).toBe(-1);
    expect(t.onKey('Enter', labels, -1)).toBe(-1);
    expect(t.onKey(' ', labels, -1)).toBe(-1);
  });

  it('space refines an in-progress search', () => {
    const withSpaces = ['Dark mode', 'Dashboard'];
    const t = typeahead();
    expect(t.onKey('d', withSpaces, -1)).toBe(0);
    expect(t.onKey('a', withSpaces, 0)).toBe(0); // "da" — includes current
    expect(t.onKey('r', withSpaces, 0)).toBe(0); // "dar"
    expect(t.onKey('k', withSpaces, 0)).toBe(0);
    expect(t.onKey(' ', withSpaces, 0)).toBe(0); // "dark " still matches
    expect(t.onKey('m', withSpaces, 0)).toBe(0); // "dark m"
  });

  it('resets the buffer after the inactivity window', () => {
    const t = typeahead({ resetMs: 500 });
    expect(t.onKey('b', labels, -1)).toBe(2);
    vi.advanceTimersByTime(600);
    // Buffer reset: "a" is a fresh single-char search, not "ba".
    expect(t.onKey('a', labels, 2)).toBe(0);
  });

  it('reset() clears immediately', () => {
    const t = typeahead();
    t.onKey('b', labels, -1);
    t.reset();
    expect(t.onKey('a', labels, 2)).toBe(0);
  });

  it('returns -1 for an empty label list', () => {
    const t = typeahead();
    expect(t.onKey('a', [], -1)).toBe(-1);
  });
});
