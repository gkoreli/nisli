/**
 * strategies.test.ts — what each degradation strategy means.
 *
 * The strategy set is the authored vocabulary for "what to do when space runs
 * out". F5 is the record of getting it wrong: `truncate` was applied to
 * timestamps and they degraded to `1…`, `Y…`, `M` — technically fitting,
 * visually useless. `hide` exists because of that, and `truncationDegenerate`
 * is the derived feedback that tells an author they picked the wrong one.
 */
import { describe, expect, it } from 'vitest';
import {
  allowsShrink,
  needsAffordance,
  truncationDegenerate,
} from '../src/appearance/fit/strategies.js';
import { STRATEGIES } from '../src/appearance/contracts.js';
import type { Box } from '../src/appearance/contracts.js';

function box(inline: number, contentInline: number): Box {
  return { inline, block: 10, contentInline };
}

describe('needsAffordance', () => {
  it('is true only for menu, the one strategy that keeps the node reachable', () => {
    // `menu` moves a control into an overflow trigger, so the container must
    // paint that trigger. `truncate` carries its own ellipsis and `hide`
    // deliberately leaves nothing behind, so neither needs one.
    expect(needsAffordance('menu')).toBe(true);
    expect(needsAffordance('truncate')).toBe(false);
    expect(needsAffordance('hide')).toBe(false);
  });

  it('answers for every strategy in the vocabulary', () => {
    for (const strategy of STRATEGIES) expect(typeof needsAffordance(strategy)).toBe('boolean');
  });
});

describe('allowsShrink', () => {
  it('is true only for truncate', () => {
    // F8: flex children default to shrinking, which let the browser satisfy an
    // overflowing row by crushing children below their content width. Only a
    // node that declared truncation may give up inline space, because only it
    // clips its content on purpose.
    expect(allowsShrink('truncate')).toBe(true);
    expect(allowsShrink('hide')).toBe(false);
    expect(allowsShrink('menu')).toBe(false);
  });
});

describe('truncationDegenerate', () => {
  it('flags a clamped timestamp — the F5 "1…, Y…, M" case', () => {
    // 70 units of content squeezed into 14: about a fifth of "3 years ago"
    // survives, which is one character and an ellipsis.
    expect(truncationDegenerate(box(14, 70), '3 years ago'.length)).toBe(true);
  });

  it('leaves clamped prose alone — half a sentence still reads', () => {
    expect(truncationDegenerate(box(240, 480), 96)).toBe(false);
  });

  it('is false when the node is not actually clamped', () => {
    expect(truncationDegenerate(box(120, 120), 8)).toBe(false);
    expect(truncationDegenerate(box(120, 40), 8)).toBe(false);
  });

  it('is false when there is no text to lose', () => {
    expect(truncationDegenerate(box(14, 70), 0)).toBe(false);
  });

  it('refuses to guess from an unmeasurable box (F4)', () => {
    // A collapsed node measures 0×0. Reporting on it is exactly the mistake
    // that produced ten false failures on the first run.
    expect(truncationDegenerate(box(0, 0), 11)).toBe(false);
    expect(truncationDegenerate(box(0, 70), 11)).toBe(false);
  });

  it('draws the line at four surviving characters', () => {
    // Half the content width, so half the characters survive.
    expect(truncationDegenerate(box(50, 100), 8)).toBe(false);
    expect(truncationDegenerate(box(50, 100), 7)).toBe(true);
  });
});
