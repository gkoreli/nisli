import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mount, prove, estimator } from '@nisli/engine/test';
import { EmittedImportScreen } from './emitted-screen.js';

const widths = [1280, 1024, 768, 480, 360] as const;

describe('visual-source compiler probe', () => {
  for (const phase of ['empty', 'populated'] as const) {
    it(`${phase} state satisfies the Engine proof at all declared widths`, async () => {
      const result = await prove(() => EmittedImportScreen({ phase }), {
        widths,
        scheme: 'light',
      });
      expect(result.claims).toEqual([]);
      expect(result.reports).toEqual([]);
    });
  }

  it('the populated observation preserves the contract at wide and narrow widths', () => {
    for (const width of [1280, 360]) {
      const mounted = mount(() => EmittedImportScreen({ phase: 'populated' }), {}, {
        width,
        scheme: 'light',
        measure: estimator(width),
      });
      try {
        expect(mounted.frame.textContent).toContain('Import transactions');
        expect(mounted.frame.textContent).toContain('1. File');
        expect(mounted.frame.textContent).toContain('2. Columns');
        expect(mounted.frame.textContent).toContain('3. Preview');
        expect(mounted.frame.textContent).toContain('Ready to import');
        expect(mounted.frame.textContent).toContain('Grocery Store');
        expect(mounted.frame.textContent).toContain('Import 3 transactions');
        expect(mounted.frame.textContent).not.toContain('Reset mapping');
        expect(mounted.frame.textContent).not.toContain('Drag and drop');
      } finally {
        mounted.unmount();
      }
    }
  });

  it('the empty observation does not expose the conditional workflow or action', () => {
    const mounted = mount(() => EmittedImportScreen({ phase: 'empty' }), {}, {
      width: 360,
      scheme: 'light',
      measure: estimator(360),
    });
    try {
      expect(mounted.frame.textContent).toContain('1. File');
      expect(mounted.frame.textContent).not.toContain('2. Columns');
      expect(mounted.frame.textContent).not.toContain('3. Preview');
      expect(mounted.frame.textContent).not.toContain('Import 3 transactions');
    } finally {
      mounted.unmount();
    }
  });

  it('the emitted application source contains no appearance escape hatch', () => {
    const source = readFileSync(resolve(
      process.cwd(),
      'docs/research/visual-programming/experiments/visual-source-to-engine/emitted-screen.ts',
    ), 'utf8');
    const forbidden = ['className', 'style:', 'data-', 'px', 'rem', 'breakpoint', 'tailwind', 'metrics', 'look(', 'fit('];
    expect(forbidden.filter((word) => source.includes(word))).toEqual([]);
  });
});
