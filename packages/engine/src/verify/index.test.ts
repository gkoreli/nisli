/** The pure parts of the browser runner: the table and the terminal format. The runner itself needs Chromium and is exercised by `bin/nisli-verify.mjs` against a served app. */
import { describe, it, expect } from 'vitest';
import { table, format, type FindingCode } from './index.js';

describe('verify output', () => {
  it('table: one row per route, one column per width, ok or the codes', () => {
    const cells = new Map<string, Set<FindingCode>>([['/@360', new Set<FindingCode>(['HORIZONTAL_SCROLL', 'NAME_MISSING'])]]);
    expect(table(['/', '/transactions'], [1280, 360], cells)).toBe([
      'route          1280                             360',
      '-------------  ----  ------------------------------',
      '/                ok  HORIZONTAL_SCROLL,NAME_MISSING',
      '/transactions    ok                              ok',
    ].join('\n'));
  });

  it('format: the table, every finding, then the verdict', () => {
    const out = format({ ok: false, checked: 2, table: 'T', findings: [{ route: '/', width: 360, code: 'NAME_MISSING', detail: '<button> has no accessible name' }] });
    expect(out).toBe('T\n\n/ @ 360: NAME_MISSING — <button> has no accessible name\n1 finding over 2 loads');
    expect(format({ ok: true, checked: 4, table: 'T', findings: [] })).toBe('T\n\nok: 4 loads, no findings');
  });
});
