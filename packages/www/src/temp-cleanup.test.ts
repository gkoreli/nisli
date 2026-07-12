/**
 * temp-cleanup.test.ts — substantiates every clause of the harness-hygiene
 * contract for createTempCleanup (fleet rule). Uses an injected `remove` so the
 * failure branches run without a real filesystem fault. Seed coverage for
 * cdx1's HARNESS-2 shared lifecycle lib.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import { createTempCleanup } from './temp-cleanup.js';

describe('createTempCleanup — harness cleanup contract', () => {
  it('ALL-ATTEMPT: a rm that throws does not skip later roots', () => {
    const c = createTempCleanup();
    c.track('/a');
    c.track('/b');
    c.track('/c');
    const attempted: string[] = [];
    const remove = vi.fn((root: string) => {
      attempted.push(root);
      if (root === '/a') throw new Error('rm /a failed');
    });
    // no primary → the first cleanup error surfaces, but every root is attempted
    expect(() => c.finalize(remove)).toThrowError('rm /a failed');
    expect(attempted).toEqual(['/a', '/b', '/c']);
  });

  it('CLEANUP-ONLY: with no primary, the FIRST cleanup failure surfaces', () => {
    const c = createTempCleanup();
    c.track('/x');
    c.track('/y');
    const remove = vi.fn((root: string) => {
      if (root === '/x') throw new Error('first');
      if (root === '/y') throw new Error('second');
    });
    expect(() => c.finalize(remove)).toThrowError('first');
    expect(remove).toHaveBeenCalledTimes(2); // both attempted despite /x throwing
  });

  it('PRIMARY PRECEDENCE: a captured setup primary is preserved — a cleanup error never masks it', () => {
    const c = createTempCleanup();
    c.track('/a');
    c.track('/b');
    c.capturePrimary(new Error('the real (setup) failure'));
    const attempted: string[] = [];
    const remove = vi.fn((root: string) => {
      attempted.push(root);
      throw new Error(`cleanup blew up on ${root}`);
    });
    // finalize must NOT throw the cleanup error over the primary (which already
    // surfaced at the failing hook) — yet it must still attempt EVERY root.
    expect(() => c.finalize(remove)).not.toThrow();
    expect(attempted).toEqual(['/a', '/b']);
  });

  it('CLEAN PATH: successful removal throws nothing, attempts each root once, and drains the registry', () => {
    const c = createTempCleanup();
    c.track('/a');
    c.track('/b');
    const remove = vi.fn();
    expect(() => c.finalize(remove)).not.toThrow();
    expect(remove.mock.calls.map((args) => args[0])).toEqual(['/a', '/b']);
    // registry drained: a second finalize is a no-op (roots consumed by splice)
    remove.mockClear();
    c.finalize(remove);
    expect(remove).not.toHaveBeenCalled();
  });

  it('track returns the root so mkdtempSync can be wrapped inline', () => {
    const c = createTempCleanup();
    expect(c.track('/tmp/xyz')).toBe('/tmp/xyz');
  });
});
