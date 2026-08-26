/**
 * hit-target.test.ts — N650's FLOOR READ, in all three directions.
 *
 * The rectangle N650 measures has been right since `bounds()` existed. What had
 * never been tested is the other half of the comparison: the number it measures
 * that rectangle AGAINST.
 *
 * THE DEFECT THESE FIXTURES CLOSE. The floor was read with `px()`, which
 * coerces an unresolvable property to zero, and the rule's next line was
 * `if (!(floor > 0)) continue`. So every way of failing to read the floor —
 * a renamed token, a document carrying intent markup with no resolution table,
 * a floor derived through `calc()` — made this rule skip every control on the
 * page and report a clean document FOREVER. `namespace.test.ts` records that
 * hazard in prose and guards it by asserting the property name is declared
 * somewhere in `theme/`, which is a fact about this repository and says nothing
 * about a consumer's document.
 *
 * That is the worst shape a rule in this set can take, and it is why the file
 * exists: the tally this experiment keeps is that three of its four oracle bugs
 * were SILENT rather than noisy, and a rule that always passes is the limit of
 * silence. The three-way split — verdict, declined promise, admitted defeat —
 * is what `raw()` is for, and it is the split the most widely deployed
 * accessibility checker on the web ships as violation / pass / incomplete.
 *
 * WHY DECLARED ZERO IS NOT THE SAME ANSWER, and this is the whole reason the
 * fix is `raw()` rather than "treat zero as undecidable". The resolution table
 * declares this floor twice: zero in the pointer context and a real length in
 * the touch context. An explicit zero is a context saying "I make no promise
 * about target size here", which is a legitimate declaration and must stay
 * silent. An empty string is nobody having said anything at all. `px()` maps
 * both onto the same number; `raw()` is the accessor that keeps them apart, and
 * that distinction is the entire content of its doc comment.
 *
 * Failing direction first in every group.
 */
import { describe, expect, it } from 'vitest';
import { hitTargetRule } from './rules/hit-target.js';
import { FakeInspector } from '../testing.js';
import type { InspectWorldSpec } from '../testing.js';
import type { Finding } from '../contracts.js';

function run(spec: InspectWorldSpec): readonly Finding[] {
  return hitTargetRule<string>().run(new FakeInspector(spec));
}

/**
 * One control, too small on both axes, with whatever floor declaration the test
 * is about. The geometry is constant across every case here on purpose: the
 * only thing that varies is the string the floor resolves to, so any change in
 * the verdict is attributable to that read and to nothing else.
 */
function control(styles: Readonly<Record<string, string>>): InspectWorldSpec {
  return {
    nodes: [
      {
        id: 'star',
        attrs: { 'data-appearance': 'action' },
        text: 'Star',
        styles,
        box: { inline: 24, block: 24, contentInline: 24 },
        bounds: { inline: 24, block: 24, inlineStart: 0, blockStart: 0 },
      },
    ],
  };
}

describe('N650 admits it cannot read its floor, rather than passing', () => {
  it('reports N680 when the floor property does not resolve at all', () => {
    // The silent false pass, in full. `px()` returned zero here, every
    // rectangle clears zero, and this rule reported a clean page for every
    // control in the document — no error, no finding, nothing to notice.
    const findings = run(control({}));
    expect(findings.map((finding) => finding.code)).toEqual(['N680']);
    expect(findings[0]?.severity).toBe('incomplete');
    expect(findings[0]?.detail).toContain('N650');
    expect(findings[0]?.detail).toContain('--intent-min-target');
  });

  it('reports N680 for a floor that resolves to something no parse can read', () => {
    // The case a consumer reaches without doing anything unusual. An
    // unregistered custom property computes to its SUBSTITUTED TOKEN STREAM,
    // not to a length: a floor derived from the inherited unit the way every
    // other value in the table is derived resolves to a `calc(…)` expression,
    // and no parse of that is a number. The shipped table declares this one
    // token as a plain length, which is the only reason the deployed rule works
    // — a fact worth a fixture rather than a coincidence worth relying on.
    const findings = run(control({ '--intent-min-target': 'calc(4px * 11)' }));
    expect(findings.map((finding) => finding.code)).toEqual(['N680']);
    expect(findings[0]?.detail).toContain('calc(4px * 11)');
  });
});

describe('N650 respects a context that declined to promise', () => {
  it('says nothing when the floor is declared and is zero', () => {
    // A DECLARATION, not a failure to read one: the pointer context sets this
    // token to zero on purpose, because a mouse needs no target floor. The
    // whole reason the fix is `raw()` and not "zero is undecidable" is that
    // this case and the empty string above must produce different verdicts.
    expect(run(control({ '--intent-min-target': '0px' }))).toEqual([]);
  });
});

describe('N650 still reaches a verdict where the floor is real', () => {
  it('fails a control short of a declared floor on both axes', () => {
    // The falsification the two groups above depend on. If the admission arm
    // had swallowed the class rather than one read, this would be N680 too.
    const findings = run(control({ '--intent-min-target': '44px' }));
    expect(findings.map((finding) => finding.code)).toEqual(['N650']);
    expect(findings[0]?.severity).toBe('fail');
    expect(findings[0]?.detail).toContain('both axes');
  });

  it('passes a control that stands exactly on its floor', () => {
    const findings = run({
      nodes: [
        {
          id: 'reply',
          attrs: { 'data-appearance': 'action' },
          text: 'Reply',
          styles: { '--intent-min-target': '44px' },
          box: { inline: 40, block: 40, contentInline: 40 },
          // The border box is what a finger presses, and it is what clears the
          // floor here while the padding box does not. This is the pair of
          // numbers that produced 710 false failures when the comparison was
          // made against `box()`.
          bounds: { inline: 44, block: 44, inlineStart: 0, blockStart: 0 },
        },
      ],
    });
    expect(findings).toEqual([]);
  });
});
