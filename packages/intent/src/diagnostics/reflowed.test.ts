/**
 * reflowed.test.ts — N740, in both directions.
 *
 * The fixtures are the measured numbers transcribed. At a 346-pixel container:
 * a grow region collapsed to 86 pixels — the width of the single word
 * "appearance" — the title inside it rendered ten words across ten line boxes,
 * the row stood 371 pixels tall where 36 was intended, and the container
 * reported `data-fit="settled"`, `data-collapsed-count="0"` and
 * `scrollWidth 346 === clientWidth 346`. Every inline instrument agreed the row
 * was fine.
 *
 * The silent-on-clean direction carries the weight here, because this rule
 * measures something that is CORRECT nearly everywhere: prose wraps. The
 * fixtures that must stay quiet are therefore the interesting half — a stack
 * whose text wraps, a truncated node, an open overflow panel — and each of them
 * is a shape that exists in the demo pages today.
 *
 * Failing direction first in every group, on purpose.
 */
import { describe, expect, it } from 'vitest';
import { reflowedRule } from './rules/reflowed.js';
import { FakeInspector } from '../testing.js';
import type { InspectSpec, InspectWorldSpec } from '../testing.js';
import type { Finding } from '../contracts.js';

function run(spec: InspectWorldSpec): readonly Finding[] {
  return reflowedRule<string>().run(new FakeInspector(spec));
}

/** The row that reported success while standing ten lines tall. */
const SETTLED_ROW = {
  'data-fit': 'settled',
  'data-layout': 'row',
  'data-collapsed-count': '0',
} as const;

/** The title as it was measured: ten words, ten line boxes, an 86-pixel box. */
const REFLOWED_TITLE: InspectSpec = {
  id: 'title',
  attrs: { 'data-text': 'title' },
  text: 'Appearance derived from declared meaning and context in real components',
  box: { inline: 86, block: 131, contentInline: 86 },
  lines: 10,
};

describe('N740 — content reflowed inside a single-line container', () => {
  it('fires on the measured row, which every inline predicate calls settled', () => {
    const findings = run({
      nodes: [
        {
          id: 'row',
          attrs: SETTLED_ROW,
          // The false PASS itself: the content made itself exactly as wide as
          // the box, so there is no overflow and no crush to find.
          box: { inline: 346, block: 371, contentInline: 346 },
          children: [
            { id: 'mark', attrs: { 'data-appearance': 'avatar' }, box: { inline: 36, block: 36 } },
            {
              id: 'identity',
              attrs: { 'data-grow': '' },
              box: { inline: 86, block: 131, contentInline: 86 },
              children: [REFLOWED_TITLE],
            },
          ],
        },
      ],
    });

    expect(findings.map((finding) => finding.subject)).toEqual(['title']);
    expect(findings[0]?.severity).toBe('fail');
    expect(findings[0]?.detail).toContain('10 line boxes');
    expect(findings[0]?.detail).toContain('86px');
  });

  it('stays silent on the identical geometry in a stack', () => {
    // One word changed and nothing else. A stack flows down the block axis by
    // declaration, so ten line boxes there are the layout working — which is
    // exactly why this rule reads a declaration before it reads a rectangle,
    // and why no height or ratio could have told these two fixtures apart.
    expect(
      run({
        nodes: [
          {
            id: 'column',
            attrs: { 'data-fit': 'settled', 'data-layout': 'stack' },
            box: { inline: 346, block: 371, contentInline: 346 },
            children: [REFLOWED_TITLE],
          },
        ],
      }),
    ).toEqual([]);
  });

  it('stays silent on a row whose text sits on one line', () => {
    expect(
      run({
        nodes: [
          {
            id: 'row',
            attrs: SETTLED_ROW,
            box: { inline: 346, block: 36, contentInline: 346 },
            children: [
              {
                id: 'title',
                attrs: { 'data-text': 'title' },
                text: 'Appearance derived from meaning',
                box: { inline: 210, block: 18, contentInline: 210 },
                lines: 1,
              },
            ],
          },
        ],
      }),
    ).toEqual([]);
  });

  it('stays silent on a node the solver truncated', () => {
    // `[data-truncate]` resolves to one clamped line with an ellipsis, so a
    // count above one is stale geometry rather than a defect. Counting it would
    // make every working truncation a failure.
    expect(
      run({
        nodes: [
          {
            id: 'row',
            attrs: SETTLED_ROW,
            box: { inline: 346, block: 36, contentInline: 346 },
            children: [
              {
                id: 'title',
                attrs: { 'data-text': 'title', 'data-truncate': '' },
                text: 'Appearance derived from declared meaning and context',
                box: { inline: 120, block: 18, contentInline: 240 },
                lines: 2,
              },
            ],
          },
        ],
      }),
    ).toEqual([]);
  });

  it('stays silent inside an open overflow panel, and inside its items', () => {
    // The panel is out of flow, so its height is not the row's, and its items
    // are MEANT to reflow — measured wrapping to two lines in a 320-pixel
    // container with the panel open. Exempting the panel and then walking into
    // its children is the defect N715 shipped; this asserts the whole subtree.
    expect(
      run({
        nodes: [
          {
            id: 'row',
            attrs: SETTLED_ROW,
            box: { inline: 320, block: 36, contentInline: 320 },
            children: [
              {
                id: 'panel',
                attrs: { 'data-overflow-menu': '' },
                box: { inline: 180, block: 72, contentInline: 180 },
                text: 'Reply all',
                lines: 2,
                children: [
                  {
                    id: 'panel-item',
                    attrs: { 'data-appearance': 'action' },
                    text: 'Reply all',
                    box: { inline: 160, block: 36, contentInline: 160 },
                    lines: 2,
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toEqual([]);
  });

  it('stays silent when the node absorbs its own growth', () => {
    // A scroller keeps the growth reachable inside itself and a clipper deletes
    // it, which is N710's claim. In neither case did the ROW pay for it.
    expect(
      run({
        nodes: [
          {
            id: 'row',
            attrs: SETTLED_ROW,
            box: { inline: 346, block: 36, contentInline: 346 },
            children: [
              {
                id: 'region',
                attrs: { 'data-grow': '' },
                styles: { 'overflow-x': 'auto' },
                text: 'Appearance derived from declared meaning and context',
                box: { inline: 86, block: 36, contentInline: 86 },
                lines: 4,
              },
            ],
          },
        ],
      }),
    ).toEqual([]);
  });

  it('speaks about a row that already admitted it cannot fit', () => {
    // `admitted.ts` makes the exemption LOCAL to the node that admitted, and
    // says its descendants stay in scope because a defect inside an
    // unsatisfiable row is a different defect from the row's own shortfall.
    // N620 names the container and what it spent; this names the element that
    // reflowed and how far. Without this the rule would be near-decoration
    // after the solver change, since a solver that can now see the block axis
    // turns most of these rows into admissions.
    const findings = run({
      nodes: [
        {
          id: 'row',
          attrs: { 'data-fit': 'unsatisfiable', 'data-layout': 'row' },
          box: { inline: 346, block: 371, contentInline: 346 },
          children: [REFLOWED_TITLE],
        },
      ],
    });

    expect(findings.map((finding) => finding.subject)).toEqual(['title']);
  });

  it('does not reach into a row it is not measuring', () => {
    // Two rows, one broken. The finding names the element inside the broken one
    // and the scan does not leak across containers.
    const findings = run({
      nodes: [
        {
          id: 'clean-row',
          attrs: SETTLED_ROW,
          box: { inline: 346, block: 36, contentInline: 346 },
          children: [
            {
              id: 'clean-title',
              attrs: { 'data-text': 'title' },
              text: 'Short',
              box: { inline: 60, block: 18, contentInline: 60 },
              lines: 1,
            },
          ],
        },
        {
          id: 'broken-row',
          attrs: SETTLED_ROW,
          box: { inline: 346, block: 371, contentInline: 346 },
          children: [REFLOWED_TITLE],
        },
      ],
    });

    expect(findings.map((finding) => finding.subject)).toEqual(['title']);
  });

  it('stays silent on a container that never declared a layout at all', () => {
    // `data-fit` alone claims a fit; it does not say what fitting MEANS. With
    // no `data-layout` there is no declared flow axis to violate, so there is
    // nothing here this rule is entitled to an opinion about.
    expect(
      run({
        nodes: [
          {
            id: 'box',
            attrs: { 'data-fit': 'settled' },
            box: { inline: 346, block: 371, contentInline: 346 },
            children: [REFLOWED_TITLE],
          },
        ],
      }),
    ).toEqual([]);
  });
});
