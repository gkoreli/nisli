/**
 * diagnostics.test.ts — the coded-diagnostics leaf + dev gate (ADR 0030.2 Wave 1).
 * Pure logic — no DOM needed.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { codes, diag, formatDiag, isDev, setDevMode } from './diagnostics.js';

afterEach(() => {
  setDevMode(null); // restore the probed default between cases
});

describe('diag()', () => {
  it('emits ONE console.error line in the [nisli CODE] message format', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    diag('N999', 'something happened');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[nisli N999] something happened');
    errorSpy.mockRestore();
  });

  it('attaches structured detail as the second console argument', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    diag('N999', 'with detail', { tag: 'x-thing', phase: 'setup' });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      '[nisli N999] with detail',
      { tag: 'x-thing', phase: 'setup' },
    );
    errorSpy.mockRestore();
  });

  it('formatDiag() is the shared prefix for logged AND thrown coded errors', () => {
    expect(formatDiag('N201', 'msg')).toBe('[nisli N201] msg');
  });
});

describe('dev gate', () => {
  it('defaults to dev under the test runner (probe sees a non-production env)', () => {
    expect(isDev()).toBe(true);
  });

  it('setDevMode() overrides the probe; setDevMode(null) restores it', () => {
    setDevMode(false);
    expect(isDev()).toBe(false);
    setDevMode(true);
    expect(isDev()).toBe(true);
    setDevMode(null);
    expect(isDev()).toBe(true); // back to the probed default
  });
});

describe('code registry (0030.1 B2 minimal table)', () => {
  it('carries the Wave-1 assigned codes', () => {
    for (const code of ['N201', 'N202', 'N401', 'N402', 'N501']) {
      expect(codes[code], code).toBeTruthy();
    }
  });

  it('seeds every assigned range as a placeholder (N1xx–N6xx)', () => {
    for (const range of ['N1xx', 'N2xx', 'N3xx', 'N4xx', 'N5xx', 'N6xx']) {
      expect(codes[range], range).toBeTruthy();
    }
  });

  it('every key is a concrete code or a range placeholder', () => {
    for (const key of Object.keys(codes)) {
      expect(key).toMatch(/^N\d(?:\d\d|xx)$/);
    }
  });
});
