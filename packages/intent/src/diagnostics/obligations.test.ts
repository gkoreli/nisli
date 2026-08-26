/**
 * obligations.test.ts — the three cross-cutting obligations, asserted at the
 * seam instead of eleven times over.
 *
 * WHAT THIS FILE IS FOR, stated against what it replaces. Three obligations
 * were applied per rule by hand: the `measurable()` admission reached three of
 * eleven measuring rules, the escape exemption five of eleven, and four
 * declaration-triggered rules selected through `painted()` with neither. So
 * coverage tracked WHEN a rule was written rather than WHAT it claimed, and the
 * injection harness measured the price by seeding real defects: NINE rules
 * reported a clean page over a defect that was present. The obligations now
 * live in the constructor a measuring rule must choose, and this file asserts
 * the three properties that makes true, once each, plus the verdicts that moved
 * when nine rules acquired an obligation they never had.
 *
 * THE FIRST TEST IN THE FILE IS A COMPILE-TIME ONE, and it is the one that
 * matters most. `@ts-expect-error` fails the build when the error it names does
 * NOT occur, so a `painted()` reachable from a declaration rule breaks
 * typecheck rather than a test. This package's history is the argument for
 * preferring that: the `Box`/`Bounds` split closed one instance of this defect
 * class by making it unrepresentable and it has not recurred; three documented
 * predictions of the same class recurred anyway, once in the file that wrote the
 * prediction down.
 */
import { describe, expect, it } from 'vitest';
import { closedWorld } from './closed-world.js';
import { DEFAULT_RULES, check } from './runner.js';
import { measuringRule, rule } from './rule.js';
import { FakeInspector } from '../testing.js';
import type { InspectSpec, InspectWorldSpec } from '../testing.js';
import type { Finding } from '../contracts.js';

function codesFor(code: string, spec: InspectWorldSpec): string[] {
  const found = DEFAULT_RULES<string>().find((entry) => entry.code === code);
  if (!found) throw new Error(`no default rule allocated for ${code}`);
  return found.run(new FakeInspector(spec)).map((finding) => finding.code);
}

/* ══════════════════════════════════════════════════════════════════════════
   1. The category is a type, not a convention
   ══════════════════════════════════════════════════════════════════════════ */

describe('a declaration rule cannot reach a measurement', () => {
  it('has no painted selector and no geometry, as a compile error', () => {
    // Four ways a seventeenth rule might skip an obligation, all of them
    // rejected by the compiler rather than by a reviewer. Every line below
    // would silently work before this seam existed.
    //
    // COMPOSED AND DELIBERATELY NEVER RUN. These lines are assertions addressed
    // to `tsc`, which fails the build when a `@ts-expect-error` does not fire;
    // at runtime `painted` is not a property of a declaration lens at all, so
    // calling one would throw — which is the same claim arriving from the other
    // side and is not what this test is for.
    const composed = rule<string>('N601', (lens, out) => {
      // @ts-expect-error a declaration lens has no `painted()`: obligations are
      // discharged by the OTHER constructor, so this is the whole category
      // boundary in one line.
      lens.painted('*');
      // @ts-expect-error nor the document's own geometry, which is a measurement
      // like any other.
      lens.viewport();
      for (const el of lens.declared('[data-escaped]')) {
        // @ts-expect-error a declaration carries no box. Reaching geometry
        // through a declaration selector is how a rule would evade all three
        // obligations at once, and it does not typecheck.
        el.box();
        // @ts-expect-error nor a resolved property, because a computed value is
        // frequently a used value and `raw('inline-size')` is a layout read
        // wearing a property name.
        el.raw('display');
        out.finding(el.subject, 'reachable');
      }
    });

    expect(composed.code).toBe('N601');
  });

  it('cannot ask whether a node is measurable, in either constructor', () => {
    measuringRule<string>('N660', (lens) => {
      for (const el of lens.painted('*').items) {
        // @ts-expect-error `measurable()` is on no type a rule can reach. A
        // question every member of a category must ask is answered by the
        // category's constructor, or it is answered by three of eleven.
        el.measurable();
      }
    });
    expect(true).toBe(true);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   2. Unmeasurable is routed, never dropped
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Every defect the nine silent rules exist for, inside content skipped by
 * `content-visibility: auto`.
 *
 * `rendered: false` is what the browser reports for skipped content and
 * `measurable: false` is declared once on the subtree root, because skipping is
 * inherited. The card's own box is honest — 200 in 200 — which is the shape of
 * the measured false PASS: nothing overflows anything the checker can see while
 * a cell that needs 471 pixels sits inside a 200-pixel box.
 *
 * IT HAS TO CARRY A SELECTOR MATCH FOR EACH OF THE NINE, and getting that wrong
 * is instructive enough to record: a first version of this fixture seeded the
 * defects but not the declarations, so four rules matched nothing at all and
 * reported nothing — correctly, since a document with no truncation and no row
 * gives N621 and N740 nothing to be undecided about. An admission is owed for a
 * node a rule ASKED FOR and could not measure, which is narrower and better
 * than "anything unmeasurable anywhere": it keeps every N680 attached to a
 * claim someone was actually making.
 */
const SEEDED_IN_SKIPPED: InspectWorldSpec = {
  viewport: { inline: 320, documentInline: 320 },
  nodes: [
    {
      id: 'feed',
      attrs: { 'data-layout': 'stack' },
      box: { inline: 320, block: 200, contentInline: 320 },
      bounds: { inline: 320, block: 200, inlineStart: 0, blockStart: 0 },
      children: [
        {
          id: 'card',
          rendered: false,
          measurable: false,
          box: { inline: 200, block: 200, contentInline: 200 },
          children: [
            {
              // N620's declaration, N715's container, N730's exhausted host and
              // N740's single-line row, all in one element, because they are all
              // claims about the same failed fit.
              id: 'row',
              attrs: { 'data-layout': 'row', 'data-fit': 'unsatisfiable' },
              rendered: false,
              box: { inline: 200, block: 60, contentInline: 471 },
              children: [
                {
                  // N621, N640, N690, N730's spent truncation, and one of
                  // N670's row children.
                  id: 'cell',
                  attrs: { 'data-text': 'body', 'data-truncate': '' },
                  text: 'Service',
                  rendered: false,
                  lines: 3,
                  styles: { color: 'rgb(230, 230, 230)', '--intent-min-contrast': '4.5' },
                  backdrop: 'rgb(255, 255, 255)',
                  box: { inline: 40, block: 54, contentInline: 40 },
                },
                {
                  // N650, and the last child of the row so N670 has a non-final
                  // sibling to judge.
                  id: 'confirm',
                  attrs: { 'data-appearance': 'action' },
                  text: 'Confirm',
                  rendered: false,
                  styles: { '--intent-min-target': '44px' },
                  box: { inline: 12, block: 12, contentInline: 60 },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('a defect the checker cannot measure is admitted, never passed', () => {
  it('turns every one of the nine silent rules into N680', () => {
    // The nine that reported a clean page over a present defect, from the
    // injection harness's measurement. One assertion, because the obligation is
    // one thing now: each of them admits because it chose the constructor, not
    // because someone remembered it.
    const silent = ['N620', 'N621', 'N640', 'N650', 'N660', 'N670', 'N690', 'N730', 'N740'];
    const verdicts = silent.map((code) => `${code}: ${codesFor(code, SEEDED_IN_SKIPPED).join()}`);

    expect(verdicts).toEqual(silent.map((code) => `${code}: N680`));
  });

  it('says incomplete, never fail — the reader loses nothing', () => {
    // css-contain-2 keeps skipped content focusable, findable and selectable,
    // so the page is fine and only the proof is destroyed. A FAIL here would be
    // the mirror image of the silence being removed.
    const findings = check(new FakeInspector(SEEDED_IN_SKIPPED), DEFAULT_RULES<string>());

    expect(findings.every((finding: Finding) => finding.severity === 'incomplete')).toBe(true);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('names the asking rule, so an admission is actionable', () => {
    const findings = codesFor('N660', SEEDED_IN_SKIPPED);
    const [only] = DEFAULT_RULES<string>()
      .filter((entry) => entry.code === 'N660')
      .flatMap((entry) => entry.run(new FakeInspector(SEEDED_IN_SKIPPED))) as [Finding];

    expect(findings).toEqual(['N680']);
    expect(only.detail).toContain('N660');
    expect(only.detail).toContain('skipped by content-visibility');
    // The document, because this rule scans every painted box: what it lost was
    // the ability to assess part of the page, not a verdict about one node.
    expect(only.subject).toBe('document');
  });

  it('admits once per scope, however many times the rule asks', () => {
    // N710 queries its clipper's subtree, its scrollers and its focusable set.
    // Three queries, one admission — a repeat question is not new evidence, and
    // the recorded judgement is that enumerating skipped descendants would bury
    // the finding they belong to.
    expect(
      codesFor('N710', {
        nodes: [
          {
            id: 'clip',
            containment: 'clip',
            box: { inline: 200, block: 100, contentInline: 200 },
            bounds: { inline: 200, block: 100, inlineStart: 0, blockStart: 0 },
            children: [
              {
                id: 'lazy',
                rendered: false,
                measurable: false,
                text: 'hidden row',
                bounds: { inline: 400, block: 40, inlineStart: 0, blockStart: 0 },
              },
            ],
          },
        ],
      }),
    ).toEqual(['N680']);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   3. An escape is honoured by every rule whose guarantee it forfeits
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The same defects, inside a subtree the author took back.
 *
 * Every one of these nodes carries a real defect: unreadable contrast, a target
 * under its floor, a shredded word, a crush, an unsatisfiable fit, a truncation
 * that bought nothing. All of it is inside `[data-escaped]`.
 */
const SEEDED_IN_ESCAPE: InspectWorldSpec = {
  viewport: { inline: 320, documentInline: 320 },
  nodes: [
    {
      id: 'vendor',
      attrs: { 'data-escaped': 'third-party embed' },
      box: { inline: 320, block: 200, contentInline: 320 },
      children: [
        {
          id: 'vendor-row',
          attrs: { 'data-layout': 'row', 'data-fit': 'unsatisfiable' },
          box: { inline: 320, block: 40, contentInline: 900 },
          children: [
            {
              id: 'vendor-label',
              attrs: { 'data-text': 'body', 'data-truncate': '' },
              text: 'Unreadable',
              styles: {
                color: 'rgb(200, 200, 200)',
                'font-size': '14px',
                'font-weight': '400',
                '--intent-min-contrast': '4.5',
              },
              backdrop: 'rgb(255, 255, 255)',
              lines: 4,
              box: { inline: 40, block: 60, contentInline: 40 },
            },
            {
              id: 'vendor-button',
              attrs: { 'data-appearance': 'action' },
              text: 'Go',
              styles: { '--intent-min-target': '44px' },
              box: { inline: 12, block: 12, contentInline: 12 },
            },
          ],
        },
      ],
    },
  ],
};

describe('an escaped subtree forfeits exactly the guarantees N601 names', () => {
  it('is judged by nothing that measures it', () => {
    // The authority is a sentence already in the codebase rather than symmetry:
    // N601 reports that an escape forfeits "the rhythm, fit, contrast and
    // hit-target guarantees". Those four families are the claims about painted
    // output, and every rule making one selects through `painted()` — so
    // honouring the sentence and choosing the constructor are the same act.
    // Seven of these twelve reported inside escaped subtrees before this seam,
    // including the contrast and hit-target rules the sentence names.
    const measuring = [
      'N620',
      'N621',
      'N630',
      'N640',
      'N650',
      'N660',
      'N670',
      'N690',
      'N710',
      'N713',
      'N715',
      'N730',
      'N740',
    ];
    const spoke = measuring.filter((code) => codesFor(code, SEEDED_IN_ESCAPE).length > 0);

    expect(spoke).toEqual([]);
  });

  it('is still judged on what it declared', () => {
    // The other half, and the reason this is not applied uniformly: an escape
    // buys different styling, not a licence to misspell an attribute. N610 and
    // N700 are declaration claims, they select through `declared()`, and they
    // go on reporting inside an escape. N601 itself must SEE the escape to
    // report it at all, which is why it was never a candidate for the exemption.
    expect(codesFor('N601', SEEDED_IN_ESCAPE)).toEqual(['N601']);
    expect(
      codesFor('N610', {
        nodes: [
          {
            id: 'vendor',
            attrs: { 'data-escaped': 'embed' },
            children: [{ id: 'inner', attrs: { 'data-layout': 'diagonal' } }],
          },
        ],
      }),
    ).toEqual(['N610']);
  });

  it('owes no admission when it is also unmeasurable', () => {
    // Forfeited is tested before measurable, and the order is the claim: there
    // is nothing to admit about a guarantee nobody was making. An escaped
    // subtree that is ALSO skipped produces silence, not N680 — the one place
    // where two obligations meet and the answer is not the union of both.
    const escapedAndSkipped: InspectSpec = {
      id: 'vendor',
      attrs: { 'data-escaped': 'embed' },
      rendered: false,
      measurable: false,
      box: { inline: 200, block: 200, contentInline: 471 },
    };

    expect(
      check(new FakeInspector({ nodes: [escapedAndSkipped] }), DEFAULT_RULES<string>()).map(
        (finding) => finding.code,
      ),
    ).toEqual(['N601']);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   4. The closed world
   ══════════════════════════════════════════════════════════════════════════ */

describe('a fixture names every finding, from every rule', () => {
  it('accounts for the whole output of a seeded document', () => {
    // The net the migration needed: every fixture in this package asserted that
    // one rule fires and is silent on a clean twin, and none of them could see
    // a SECOND rule firing. Eleven rules gaining three obligations is exactly
    // the change that produces one. Stated as the whole output, in the shape
    // clang-tidy, compiletest, Biome and axe all use.
    expect(
      closedWorld(SEEDED_IN_SKIPPED, [
        { code: 'N680', subject: 'document' }, // N620
        { code: 'N680', subject: 'document' }, // N621
        { code: 'N680', subject: 'document' }, // N640
        { code: 'N680', subject: 'document' }, // N650
        { code: 'N680', subject: 'document' }, // N660
        { code: 'N680', subject: 'document' }, // N670
        { code: 'N680', subject: 'document' }, // N690
        { code: 'N680', subject: 'document' }, // N710
        { code: 'N680', subject: 'document' }, // N713
        { code: 'N680', subject: 'feed' }, //     N715, scoped to its container
        { code: 'N680', subject: 'document' }, // N730
        { code: 'N680', subject: 'document' }, // N740
      ]),
    ).toEqual({ unexpected: [], missing: [] });
  });

  it('fails on a finding no expectation named', () => {
    // The falsification. A helper that reported no difference whatever happened
    // would be this file's own failure mode, and it is the failure mode that
    // shipped a vacuous green in this repository before.
    const difference = closedWorld(SEEDED_IN_ESCAPE, []);

    expect(difference.unexpected.map((finding) => finding.code)).toEqual(['N601']);
    expect(difference.missing).toEqual([]);
  });

  it('fails on an expectation nothing produced', () => {
    const difference = closedWorld(
      { nodes: [{ id: 'quiet' }] },
      [{ code: 'N660', subject: 'quiet' }],
    );

    expect(difference.missing).toEqual([{ code: 'N660', subject: 'quiet' }]);
    expect(difference.unexpected).toEqual([]);
  });
});
