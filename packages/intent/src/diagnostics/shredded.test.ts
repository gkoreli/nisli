/**
 * shredded.test.ts — N690 measures TEXT, not the element around it.
 *
 * THE DEFECT THESE FIXTURES CLOSE, and it was live rather than doctrinal. N690
 * derived its line count as `(box.block - padding-block) / line-height`, which
 * is an ELEMENT geometry standing in for a TEXT one, and every term of it fails
 * somewhere:
 *
 *   - the padding subtraction is read with `px()`, which coerces an unresolved
 *     longhand to zero. happy-dom resolves `padding-block-start` to the EMPTY
 *     STRING, so in this package's own unit environment a padded single-line
 *     heading measured as two lines and reported a shredded word that does not
 *     exist. That is the rule's recorded first-run defect — every table header
 *     reporting "1 word across 2 lines" — reopened through the coercion;
 *   - the divisor needs `line-height` to be a length, so `normal` cost a
 *     verdict and produced N680 instead;
 *   - and the padding is not the only reason an element's box is taller than
 *     its text. A stretched row child, a `min-block-size`, and a control's
 *     target floor all add block size that no padding read subtracts. The last
 *     of those is exactly why widening this rule to control labels fired on a
 *     clean icon button, which the rule's header records as the seventh oracle
 *     bug in the experiment.
 *
 * `Inspector.lines()` counts the line boxes the browser actually produced, so
 * there is no divisor, no padding term and nothing to get wrong. contracts.ts
 * states the consequence directly: the derivation is the APPROXIMATION, and
 * where the two differ the derivation is the one that is wrong.
 *
 * WHAT THE MOVE COSTS, named rather than discovered later. `lines()` counts a
 * node's OWN text runs while `text()` returns the whole subtree's text, so a
 * `[data-text]` node whose words live inside a nested element reports zero lines
 * against a positive word count and is not measured. That is an under-report,
 * it never invents a defect, and it is the same shape as the border-width
 * residue N710 accepts and the column-gap residue N713 accepts. The old
 * derivation did not cover that case correctly either — it measured the
 * wrapper's box against the subtree's words — so nothing decidable was lost.
 *
 * Failing direction first in every group.
 */
import { describe, expect, it } from 'vitest';
import { shreddedRule } from './rules/shredded.js';
import { FakeInspector } from '../testing.js';
import type { InspectWorldSpec } from '../testing.js';
import type { Finding } from '../contracts.js';

function run(spec: InspectWorldSpec): readonly Finding[] {
  return shreddedRule<string>().run(new FakeInspector(spec));
}

describe('N690 no longer reads an element box for a text claim', () => {
  it('does not invent a shredded word in a box taller than its text', () => {
    // THE REPRODUCTION. One word, a line height of eighteen, a padding box of
    // thirty-six, and padding longhands this engine resolves to the empty
    // string. The old arithmetic subtracted zero, divided thirty-six by
    // eighteen, and reported one word across two lines. `lines()` says one.
    expect(
      run({
        nodes: [
          {
            id: 'column-header',
            attrs: { 'data-text': 'meta' },
            text: 'Density',
            styles: { 'line-height': '18px' },
            box: { inline: 90, block: 36, contentInline: 90 },
            lines: 1,
          },
        ],
      }),
    ).toEqual([]);
  });

  it('does not invent one in a box made tall by something other than padding', () => {
    // The generalisation, and the reason the padding subtraction was never the
    // fix. This element is stretched to its row's height and declares padding
    // that resolves perfectly well; the old derivation still counted the slack
    // as three extra lines because block size is not a line count.
    expect(
      run({
        nodes: [
          {
            id: 'stretched-label',
            attrs: { 'data-text': 'label' },
            text: 'Comfortable',
            styles: {
              'line-height': '18px',
              'padding-block-start': '0px',
              'padding-block-end': '0px',
            },
            box: { inline: 90, block: 72, contentInline: 90 },
            lines: 1,
          },
        ],
      }),
    ).toEqual([]);
  });

  it('reaches a verdict where the divisor used to cost one', () => {
    // `line-height: normal` is not a length, so the derivation could not run
    // and the honest answer was N680. There is no divisor now, so the same
    // node gets the verdict it always deserved. This is the assertion that
    // replaces the rule's undecidable arm rather than deleting it quietly.
    const findings = run({
      nodes: [
        {
          id: 'keyword-line-height',
          attrs: { 'data-text': 'body' },
          text: 'Comfortable',
          styles: { 'line-height': 'normal' },
          box: { inline: 40, block: 54, contentInline: 40 },
          lines: 3,
        },
      ],
    });
    expect(findings.map((finding) => finding.code)).toEqual(['N690']);
    // `warn`, from the registry: N690's declared severity, not this file's
    // opinion. What matters is that it is a VERDICT where it used to be N680.
    expect(findings[0]?.severity).toBe('warn');
    expect(findings[0]?.detail).toContain('3 line boxes');
  });
});

describe('N690 still witnesses an intra-word break', () => {
  it('fires when one word occupies more line boxes than there are words', () => {
    // The falsification the group above depends on: if `lines()` had made this
    // rule silent rather than accurate, every assertion here would pass by
    // reporting nothing.
    const findings = run({
      nodes: [
        {
          id: 'shredded-title',
          attrs: { 'data-text': 'title' },
          text: 'Comfortable',
          styles: { 'line-height': '18px' },
          box: { inline: 40, block: 54, contentInline: 40 },
          lines: 3,
        },
      ],
    });
    expect(findings.map((finding) => finding.subject)).toEqual(['shredded-title']);
    expect(findings[0]?.detail).toContain('1 word');
  });

  it('stays silent on prose that broke at its spaces', () => {
    expect(
      run({
        nodes: [
          {
            id: 'wrapped-prose',
            attrs: { 'data-text': 'body' },
            text: 'A larger hit target arrives with the input mode',
            styles: { 'line-height': '18px' },
            box: { inline: 120, block: 54, contentInline: 120 },
            lines: 3,
          },
        ],
      }),
    ).toEqual([]);
  });

  it('declines on a script that wraps between characters', () => {
    // The inference does not hold where a paragraph legitimately reports one
    // word and many lines, so the rule declines rather than accusing.
    expect(
      run({
        nodes: [
          {
            id: 'unspaced',
            attrs: { 'data-text': 'body' },
            text: '快速的棕色狐狸跳过了那只懒狗',
            styles: { 'line-height': '18px' },
            box: { inline: 40, block: 90, contentInline: 40 },
            lines: 5,
          },
        ],
      }),
    ).toEqual([]);
  });

  it('says nothing about a node whose words belong to a descendant', () => {
    // The named under-report. `lines()` counts this node's own runs and there
    // are none, so there is no text here for this rule to have an opinion
    // about — an honest zero rather than an unresolvable one, which is why it
    // is a `continue` and not an admission.
    expect(
      run({
        nodes: [
          {
            id: 'wrapper',
            attrs: { 'data-text': 'body' },
            text: 'Comfortable',
            styles: { 'line-height': '18px' },
            box: { inline: 40, block: 54, contentInline: 40 },
            lines: 0,
          },
        ],
      }),
    ).toEqual([]);
  });
});
