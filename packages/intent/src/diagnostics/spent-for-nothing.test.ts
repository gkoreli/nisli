/**
 * spent-for-nothing.test.ts — N730, in both directions.
 *
 * The fixtures are the hostile-content sweep's measured numbers, transcribed,
 * because the value of this rule is that it distinguishes two things that look
 * identical in a screenshot: a truncation that clamped text, and a truncation
 * that was applied and did nothing.
 *
 * Measured on the real page at a 320-pixel width: the row reported
 * `data-fit="unsatisfiable"` with a client width of 318 against a scroll width
 * of 433, and the truncated author element measured 375 wide with a content
 * width of 375 — it had not shrunk by a single pixel, because `nowrap` makes a
 * single unbreakable token's minimum content width equal the whole text.
 *
 * Failing direction first in every group, on purpose.
 */
import { describe, expect, it } from 'vitest';
import { spentForNothingRule } from './rules/spent-for-nothing.js';
import { FakeInspector } from '../testing.js';
import type { InspectWorldSpec } from '../testing.js';
import type { Finding } from '../contracts.js';

function run(spec: InspectWorldSpec): readonly Finding[] {
  return spentForNothingRule<string>().run(new FakeInspector(spec));
}

/** The row the solver gave up on: 433 wanted, 318 available. */
const EXHAUSTED = { 'data-fit': 'unsatisfiable' } as const;

describe('N730 — degradation spent for nothing', () => {
  it('fires when a truncated element did not get smaller', () => {
    const findings = run({
      nodes: [
        {
          id: 'row',
          attrs: EXHAUSTED,
          box: { inline: 318, block: 36, contentInline: 433 },
          children: [
            {
              id: 'author',
              attrs: { 'data-truncate': '', 'data-text': 'title' },
              text: 'Bundesausbildungsfoerderungsgesetzaenderungsgesetz',
              // The measured case: the box IS the content. Nothing was clamped.
              box: { inline: 375, block: 18, contentInline: 375 },
            },
          ],
        },
      ],
    });
    expect(findings.map((finding) => finding.subject)).toEqual(['author']);
    expect(findings[0]?.severity).toBe('fail');
    expect(findings[0]?.detail).toContain('375');
  });

  it('stays silent when the truncation actually clamped text', () => {
    // The receipt for a working ellipsis: content wants more than the box gave.
    expect(
      run({
        nodes: [
          {
            id: 'row',
            attrs: EXHAUSTED,
            box: { inline: 318, block: 36, contentInline: 433 },
            children: [
              {
                id: 'excerpt',
                attrs: { 'data-truncate': '', 'data-text': 'body' },
                text: 'The analytical engine weaves algebraic patterns',
                box: { inline: 120, block: 18, contentInline: 240 },
              },
            ],
          },
        ],
      }),
    ).toEqual([]);
  });

  it('stays silent in a container that settled, however the child measures', () => {
    // A truncated element that happens to fit is not a defect: there was simply
    // nothing to remove. Reporting it everywhere is how an oracle gets muted,
    // so the claim is gated on the spend having actually mattered.
    expect(
      run({
        nodes: [
          {
            id: 'row',
            attrs: { 'data-fit': 'settled' },
            box: { inline: 318, block: 36, contentInline: 318 },
            children: [
              {
                id: 'short',
                attrs: { 'data-truncate': '', 'data-text': 'meta' },
                text: 'Mon',
                box: { inline: 40, block: 18, contentInline: 40 },
              },
            ],
          },
        ],
      }),
    ).toEqual([]);
  });

  it('allows half a pixel of slack, because subpixel layout is not a defect', () => {
    expect(
      run({
        nodes: [
          {
            id: 'row',
            attrs: EXHAUSTED,
            box: { inline: 318, block: 36, contentInline: 433 },
            children: [
              {
                id: 'author',
                attrs: { 'data-truncate': '', 'data-text': 'title' },
                text: 'Ada Lovelace',
                box: { inline: 200, block: 18, contentInline: 200.75 },
              },
            ],
          },
        ],
      }),
    ).toEqual([]);
  });

  it('ignores an element the solver never truncated', () => {
    // The presence of `data-truncate` is the evidence a strategy was SPENT.
    // Without it this rule has no claim to make, however the box measures.
    expect(
      run({
        nodes: [
          {
            id: 'row',
            attrs: EXHAUSTED,
            box: { inline: 318, block: 36, contentInline: 433 },
            children: [
              {
                id: 'untouched',
                attrs: { 'data-text': 'title' },
                text: 'Ada Lovelace',
                box: { inline: 375, block: 18, contentInline: 375 },
              },
            ],
          },
        ],
      }),
    ).toEqual([]);
  });

  it('does not reach across containers', () => {
    // Scoping is per exhausted container. A truncated element in a healthy row
    // is not evidence about the unsatisfiable one next to it.
    const findings = run({
      nodes: [
        {
          id: 'settled-row',
          attrs: { 'data-fit': 'settled' },
          box: { inline: 318, block: 36, contentInline: 318 },
          children: [
            {
              id: 'sibling',
              attrs: { 'data-truncate': '', 'data-text': 'title' },
              text: 'Grace Hopper',
              box: { inline: 375, block: 18, contentInline: 375 },
            },
          ],
        },
        {
          id: 'exhausted-row',
          attrs: EXHAUSTED,
          box: { inline: 318, block: 36, contentInline: 433 },
          children: [
            {
              id: 'guilty',
              attrs: { 'data-truncate': '', 'data-text': 'title' },
              text: 'Bundesausbildungsfoerderungsgesetz',
              box: { inline: 375, block: 18, contentInline: 375 },
            },
          ],
        },
      ],
    });
    expect(findings.map((finding) => finding.subject)).toEqual(['guilty']);
  });
});
