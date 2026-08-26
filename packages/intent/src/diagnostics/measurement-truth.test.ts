/**
 * measurement-truth.test.ts — the five false-PASS classes, each proven to fire.
 *
 * Every case in this file was a measured SILENCE before the change it defends.
 * Not a wrong number: no number at all, which is the worse currency, because
 * nobody reads a finding that is not there. The five, and the measurement that
 * exposed each:
 *
 *   1. `content-visibility: auto` — a skipped subtree makes a clipper report
 *      `scrollWidth 200 === clientWidth 200` while its child needs 471px. Every
 *      measuring rule reaches its `continue`, nothing throws, and the run is a
 *      PASS with zero findings. Verdict must be UNDECIDABLE, never FAIL: the
 *      reader loses nothing, only the proof is destroyed.
 *   2. `contain: paint` / `contain: content` — clip while `overflow-x` computes
 *      to `visible` (523/200 and 540/200), so every clip test keyed on the
 *      property misattributed them as crushes.
 *   3. N715 — a box reporting `scrollHeight 36 === clientHeight 36` with a 45px
 *      control painting outside it, because scroll extents only grow towards the
 *      end edges.
 *   4. N713 — 3 columns of 101.33px holding 103px, container 323/320, and a
 *      column box that is not an element for any predicate to ask about.
 *   5. N640 — a colour parser that could not read `oklab(…)`, so 288 of 1188
 *      measured text cells went from checked to undecidable the moment the table
 *      started deriving.
 *
 * Both directions for each, in that order: it FIRES on the defect, and it is
 * SILENT on `CLEAN`. A rule that has never been observed to fail is decoration,
 * and a rule that fires on a clean document gets muted — the round-2 corpus
 * records both endings.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, check } from './runner.js';
import { contrastRule } from './rules/contrast.js';
import { crushedRule } from './rules/crushed.js';
import { directionalOverflowRule } from './rules/directional-overflow.js';
import { multicolumnRule } from './rules/multicolumn.js';
import { solveFit } from '../fit/solver.js';
import { FakeInspector, FakeWorld } from '../testing.js';
import type { InspectWorldSpec } from '../testing.js';
import type { Finding, Rule } from '../contracts.js';

function run(rule: Rule<string>, spec: InspectWorldSpec): readonly Finding[] {
  return rule.run(new FakeInspector(spec));
}

// `--intent-min-contrast` is here for the same reason every other property is:
// it is what the checker would see. N640's floor is the theme's now, read off
// the element, so a node with no declared floor is undecidable rather than
// clean. A browser inherits the token from `:root`; this fake resolves per node
// with no inheritance, so every node that wants a verdict declares it.
const READABLE = {
  color: 'rgb(24, 24, 27)',
  'font-size': '14px',
  'font-weight': '400',
  'line-height': '18px',
  '--intent-min-contrast': '4.5',
};

/**
 * A clean document, with every rectangle placed explicitly.
 *
 * That last part is the difference between a fixture and a decoration here. Two
 * of the rules under test compare rects against rects, so a fixture that left
 * every origin at the default 0/0 would satisfy them vacuously — every box would
 * share one corner and nothing could ever be outside anything. Every `bounds`
 * below therefore carries a real position, and the containment relationships are
 * the ones a browser would produce: `row` sits inside `shell`, its children sit
 * inside `row`, and the three column items sit inside `columns`.
 */
const CLEAN: InspectWorldSpec = {
  viewport: { inline: 1024, documentInline: 1024 },
  nodes: [
    {
      id: 'shell',
      attrs: { 'data-layout': 'stack' },
      box: { inline: 1024, block: 600, contentInline: 1024 },
      bounds: { inline: 1024, block: 600, inlineStart: 0, blockStart: 0 },
      backdrop: 'rgb(255, 255, 255)',
      children: [
        {
          id: 'row',
          attrs: { 'data-layout': 'row', 'data-fit': 'settled' },
          box: { inline: 320, block: 60, contentInline: 300 },
          bounds: { inline: 320, block: 60, inlineStart: 8, blockStart: 8 },
          children: [
            {
              id: 'sender',
              attrs: { 'data-text': 'title' },
              text: 'Ada Lovelace',
              styles: READABLE,
              box: { inline: 120, block: 18, contentInline: 118 },
              bounds: { inline: 120, block: 18, inlineStart: 16, blockStart: 24 },
            },
            {
              id: 'reply',
              attrs: { 'data-appearance': 'action', 'data-emphasis': 'primary' },
              text: 'Reply',
              styles: { ...READABLE, '--intent-min-target': '44px' },
              box: { inline: 44, block: 44, contentInline: 40 },
              bounds: { inline: 44, block: 44, inlineStart: 200, blockStart: 16 },
            },
          ],
        },
        {
          id: 'columns',
          attrs: { 'data-layout': 'stack' },
          styles: { display: 'block', 'column-width': '176px', 'column-count': 'auto' },
          box: { inline: 320, block: 100, contentInline: 320 },
          bounds: { inline: 320, block: 100, inlineStart: 8, blockStart: 100 },
          children: [
            {
              id: 'note-a',
              attrs: { 'data-text': 'body' },
              text: 'Ambient context',
              styles: READABLE,
              box: { inline: 170, block: 18, contentInline: 168 },
              bounds: { inline: 170, block: 18, inlineStart: 10, blockStart: 105 },
            },
            {
              id: 'note-b',
              attrs: { 'data-text': 'body' },
              text: 'Derived values',
              styles: READABLE,
              box: { inline: 170, block: 18, contentInline: 166 },
              bounds: { inline: 170, block: 18, inlineStart: 10, blockStart: 130 },
            },
          ],
        },
      ],
    },
  ],
};

/* ══════════════════════════════════════════════════════════════════════════
   1. content-visibility: auto — the measured false PASS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The audit's §G fixture, as the checker sees it. `rendered: false` is what the
 * browser reports for skipped content — `checkVisibility({contentVisibilityAuto:
 * true})` answers false — and `measurable: false` is the new admission, declared
 * once on the subtree root because skipping is inherited.
 *
 * The clipper's own box is the whole point: `contentInline === inline`, so
 * `overflows()` reads settled, exactly as measured, while a 471px child sits
 * inside it.
 */
const SKIPPED: InspectWorldSpec = {
  nodes: [
    {
      id: 'list',
      attrs: { 'data-layout': 'stack', 'data-fit': 'settled' },
      box: { inline: 200, block: 200, contentInline: 200 },
      bounds: { inline: 200, block: 200, inlineStart: 0, blockStart: 6000 },
      children: [
        {
          id: 'offscreen-card',
          rendered: false,
          measurable: false,
          box: { inline: 200, block: 200, contentInline: 200 },
          bounds: { inline: 200, block: 200, inlineStart: 0, blockStart: 6000 },
          children: [
            {
              id: 'wide-table',
              attrs: { 'data-text': 'body' },
              text: 'Service',
              rendered: false,
              box: { inline: 200, block: 40, contentInline: 471 },
              bounds: { inline: 471, block: 40, inlineStart: 0, blockStart: 6000 },
            },
          ],
        },
      ],
    },
  ],
};

describe('content-visibility: auto — a rule that cannot measure must say so', () => {
  it('reports N680 rather than passing on a skipped subtree', () => {
    // THE DEFECT, precisely: without `measurable()` this fixture produces ZERO
    // findings from every rule in the set, because `painted()` returns nothing
    // inside the skipped subtree and no rule throws, so the runner's `catch` —
    // the only N680 path that used to exist — never fires either. A PASS on
    // content the checker never looked at.
    const findings = run(directionalOverflowRule<string>(), SKIPPED);

    expect(findings).toHaveLength(1);
    const [finding] = findings as [Finding];
    expect(finding.code).toBe('N680');
    expect(finding.severity).toBe('incomplete');
    expect(finding.subject).toBe('list');
    // N680 carries the ASKING rule's code, so the reader knows which claim went
    // unproven rather than just that something did.
    expect(finding.detail).toContain('N715');
    expect(finding.detail).toContain('skipped by content-visibility');
  });

  it('says incomplete, never fail — the reader loses nothing', () => {
    // css-contain-2 requires skipped `auto` content to stay available to
    // find-in-page and tab order and to remain focusable and selectable. The
    // page is fine; the proof is worthless. Reporting a failure here would be
    // the mirror image of the lie this rule exists to remove.
    const findings = check(new FakeInspector(SKIPPED), DEFAULT_RULES<string>());

    expect(findings.some((finding) => finding.severity === 'fail')).toBe(false);
  });

  it('is silent on a document it can measure', () => {
    expect(run(directionalOverflowRule<string>(), CLEAN)).toEqual([]);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   2. contain: paint — clipping is not a property value
   ══════════════════════════════════════════════════════════════════════════ */

describe('containment — a clipper is a clipper whatever overflow says', () => {
  it('N660 no longer claims a paint-contained box that overflow calls visible', () => {
    // Measured, Chromium 151: `contain: paint` clips a 471px child inside a
    // 200px box while BOTH overflow axes compute to `visible`. The old table
    // read `overflow-x`, so this node was reported as "content paints outside
    // its box and lands on a neighbour" — the right location with a false claim.
    // N710 owns clipped loss; N660 keeps genuine crushes.
    const findings = run(crushedRule<string>(), {
      nodes: [
        {
          id: 'paint-contained',
          containment: 'clip',
          styles: { 'overflow-x': 'visible', 'overflow-y': 'visible' },
          box: { inline: 200, block: 100, contentInline: 471 },
        },
      ],
    });

    expect(findings).toEqual([]);
  });

  it('still fires on the same geometry when nothing contains it', () => {
    // The falsification: identical numbers, no containment. If the exemption
    // above were swallowing the whole class rather than one claim, this would be
    // silent too.
    const findings = run(crushedRule<string>(), {
      nodes: [
        {
          id: 'escaping',
          styles: { 'overflow-x': 'visible', 'overflow-y': 'visible' },
          box: { inline: 200, block: 100, contentInline: 471 },
        },
      ],
    });

    expect(findings.map((finding) => finding.subject)).toEqual(['escaping']);
  });

  it('does not let the solver chase a clipped child it can never relieve', () => {
    // The solver's half of the same defect. A clipped child's overflow is not a
    // collision, so degrading anything can never relieve it — chasing it would
    // collapse every action in a row because a table two levels down is cut off
    // by a flush surface.
    //
    // ONE child, and that is a property of the fake rather than of the claim:
    // `crush: true` squeezes every in-flow child by the same factor, so a
    // sibling in this world is always crushed too and would be a real crush
    // rather than a misattributed one. The measured shape — a block-level table
    // taking the full inline size while its siblings keep theirs — is not
    // expressible in a proportional model, so the fixture states the part that
    // is: a clipped child's own overflow is not something to spend a strategy on.
    const clipped = new FakeWorld({
      available: 200,
      crush: true,
      children: [{ id: 'table', intrinsic: 400, containment: 'clip' }],
    });

    const outcome = solveFit(
      clipped.container,
      [{ node: 'table', priority: 5, strategy: 'menu' }],
      clipped.metrics,
      clipped.mutator,
    );

    expect(outcome.state).toBe('settled');
    expect(clipped.outcome()).toEqual({ table: 'none' });
  });

  it('still degrades the same child when nothing contains it', () => {
    // The falsification: identical geometry, containment `visible`. Now the
    // overflow really does escape and land on something, and the solver spends
    // its declared strategy. If the exemption above were swallowing the class
    // rather than one claim, this would settle untouched too.
    const escaping = new FakeWorld({
      available: 200,
      crush: true,
      children: [{ id: 'table', intrinsic: 400 }],
    });

    solveFit(
      escaping.container,
      [{ node: 'table', priority: 5, strategy: 'menu' }],
      escaping.metrics,
      escaping.mutator,
    );

    expect(escaping.outcome()).toEqual({ table: 'menu' });
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   3. N715 — scroll extents are directional
   ══════════════════════════════════════════════════════════════════════════ */

describe('N715 — overflow before the box', () => {
  it('sees a control painting above a box that reports itself settled', () => {
    // The recorded measurement, reproduced: a `16/9` box with `min-block-size: 0`
    // whose 45px control is pinned by `align-content: end`, so it overflows
    // towards block-START. `scrollHeight 36 === clientHeight 36` — the box is
    // settled by every extent-based test that exists — and the control is 9px
    // outside it.
    const findings = run(directionalOverflowRule<string>(), {
      nodes: [
        {
          id: 'ratio-box',
          attrs: { 'data-layout': 'stack' },
          box: { inline: 64, block: 36, contentInline: 64 },
          bounds: { inline: 64, block: 36, inlineStart: 0, blockStart: 100 },
          children: [
            {
              id: 'control',
              attrs: { 'data-appearance': 'action' },
              box: { inline: 45, block: 45, contentInline: 45 },
              bounds: { inline: 45, block: 45, inlineStart: 0, blockStart: 91 },
            },
          ],
        },
      ],
    });

    expect(findings).toHaveLength(1);
    const [finding] = findings as [Finding];
    expect(finding.code).toBe('N715');
    expect(finding.severity).toBe('fail');
    expect(finding.subject).toBe('control');
    expect(finding.detail).toContain('9px above its block-start edge');
  });

  it('reports inline-start escape on the same evidence', () => {
    const findings = run(directionalOverflowRule<string>(), {
      nodes: [
        {
          id: 'pinned-row',
          attrs: { 'data-layout': 'row' },
          box: { inline: 200, block: 40, contentInline: 200 },
          bounds: { inline: 200, block: 40, inlineStart: 100, blockStart: 0 },
          children: [
            {
              id: 'label',
              attrs: { 'data-text': 'body' },
              box: { inline: 60, block: 18, contentInline: 60 },
              bounds: { inline: 60, block: 18, inlineStart: 88, blockStart: 10 },
            },
          ],
        },
      ],
    });

    expect(findings.map((finding) => finding.detail)).toEqual([
      expect.stringContaining('12px before its inline-start edge'),
    ]);
  });

  it('exempts an out-of-flow panel, which is meant to paint outside its row', () => {
    const findings = run(directionalOverflowRule<string>(), {
      nodes: [
        {
          id: 'row',
          attrs: { 'data-layout': 'row' },
          box: { inline: 200, block: 40, contentInline: 200 },
          bounds: { inline: 200, block: 40, inlineStart: 0, blockStart: 100 },
          children: [
            {
              id: 'panel',
              attrs: { 'data-overflow-menu': '' },
              styles: { position: 'absolute' },
              box: { inline: 160, block: 80, contentInline: 160 },
              bounds: { inline: 160, block: 80, inlineStart: 0, blockStart: 20 },
            },
          ],
        },
      ],
    });

    expect(findings).toEqual([]);
  });

  it('exempts a scroll container, because the port carries no scroll offset', () => {
    // Not a hidden pass: a scrolled container genuinely moves its content out of
    // its own rect, and "scrolled away" is indistinguishable from "overflowing
    // start-side" without an offset this port does not expose. Named as a limit
    // in the rule rather than guessed at.
    const findings = run(directionalOverflowRule<string>(), {
      nodes: [
        {
          id: 'scroller',
          attrs: { 'data-layout': 'row' },
          styles: { 'overflow-x': 'auto' },
          box: { inline: 200, block: 40, contentInline: 400 },
          bounds: { inline: 200, block: 40, inlineStart: 100, blockStart: 0 },
          children: [
            {
              id: 'first-column',
              attrs: { 'data-text': 'body' },
              box: { inline: 60, block: 18, contentInline: 60 },
              bounds: { inline: 60, block: 18, inlineStart: 0, blockStart: 10 },
            },
          ],
        },
      ],
    });

    expect(findings).toEqual([]);
  });

  it('is silent on CLEAN', () => {
    expect(run(directionalOverflowRule<string>(), CLEAN)).toEqual([]);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   4. N713 — a column box is not an element
   ══════════════════════════════════════════════════════════════════════════ */

describe('N713 — content lost in a multicolumn box', () => {
  it('catches the escape when NOTHING is crushed — the shrink-to-fit case', () => {
    // This is the case that makes a separate code honest. The measured dense
    // cell had 3 columns of 101.33px holding 103px and a container measuring
    // 323/320, and the per-node crush predicate saw it only because the stack
    // stretched its children to the column width. Here every item is
    // shrink-to-fit — `contentInline === inline`, nothing crushed, N660 silent
    // by construction — and the third column's content is still 3px outside a
    // container it can never fit, past a column edge no element represents.
    const findings = run(multicolumnRule<string>(), {
      nodes: [
        {
          id: 'multicol',
          attrs: { 'data-layout': 'stack' },
          styles: { display: 'block', 'column-width': '88px', 'column-count': 'auto' },
          box: { inline: 320, block: 60, contentInline: 320 },
          bounds: { inline: 320, block: 60, inlineStart: 0, blockStart: 0 },
          children: [
            {
              id: 'item-1',
              attrs: { 'data-text': 'body' },
              box: { inline: 103, block: 18, contentInline: 103 },
              bounds: { inline: 103, block: 18, inlineStart: 0, blockStart: 10 },
            },
            {
              id: 'item-2',
              attrs: { 'data-text': 'body' },
              box: { inline: 103, block: 18, contentInline: 103 },
              bounds: { inline: 103, block: 18, inlineStart: 109, blockStart: 10 },
            },
            {
              id: 'item-3',
              attrs: { 'data-text': 'body' },
              box: { inline: 103, block: 18, contentInline: 103 },
              bounds: { inline: 103, block: 18, inlineStart: 220, blockStart: 10 },
            },
          ],
        },
      ],
    });

    expect(findings).toHaveLength(1);
    const [finding] = findings as [Finding];
    expect(finding.code).toBe('N713');
    expect(finding.severity).toBe('fail');
    expect(finding.subject).toBe('item-3');
    expect(finding.detail).toContain('3px past inline-end');
  });

  it('confirms N660 really is silent on that same fixture', () => {
    // The falsification the claim above depends on. If the crush rule spoke
    // here, N713 would be a duplicate rather than a new class.
    const findings = run(crushedRule<string>(), {
      nodes: [
        {
          id: 'multicol',
          attrs: { 'data-layout': 'stack' },
          styles: { display: 'block', 'column-width': '88px' },
          box: { inline: 320, block: 60, contentInline: 320 },
          children: [
            {
              id: 'item-3',
              attrs: { 'data-text': 'body' },
              box: { inline: 103, block: 18, contentInline: 103 },
            },
          ],
        },
      ],
    });

    expect(findings).toEqual([]);
  });

  it('refuses to evaluate an inert columns declaration instead of passing it', () => {
    // The audit's own first self-inflicted bug: `[data-layout="columns"]` was
    // shadowed by a shared `display: flex`, so the first "multicolumn"
    // measurement was a flex row. Multicol does not apply to a flex container
    // and the computed `column-width` keeps reporting the declared length
    // anyway, so the declaration alone proves nothing.
    const findings = run(multicolumnRule<string>(), {
      nodes: [
        {
          id: 'shadowed',
          attrs: { 'data-layout': 'stack' },
          styles: { display: 'flex', 'column-width': '88px', 'column-count': 'auto' },
          box: { inline: 320, block: 60, contentInline: 320 },
          bounds: { inline: 320, block: 60, inlineStart: 0, blockStart: 0 },
        },
      ],
    });

    expect(findings).toHaveLength(1);
    const [finding] = findings as [Finding];
    expect(finding.code).toBe('N680');
    expect(finding.detail).toContain('N713');
    expect(finding.detail).toContain('display: flex');
  });

  it('reports N680 for a skipped multicolumn subtree', () => {
    const findings = run(multicolumnRule<string>(), {
      nodes: [
        {
          id: 'multicol',
          attrs: { 'data-layout': 'stack' },
          styles: { display: 'block', 'column-width': '88px' },
          box: { inline: 320, block: 60, contentInline: 320 },
          bounds: { inline: 320, block: 60, inlineStart: 0, blockStart: 0 },
          children: [
            {
              id: 'skipped-item',
              rendered: false,
              measurable: false,
              box: { inline: 103, block: 18, contentInline: 400 },
              bounds: { inline: 400, block: 18, inlineStart: 0, blockStart: 10 },
            },
          ],
        },
      ],
    });

    expect(findings.map((finding) => finding.code)).toEqual(['N680']);
  });

  it('is silent on CLEAN', () => {
    expect(run(multicolumnRule<string>(), CLEAN)).toEqual([]);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   5. N640 — the parser that could not read a derived colour
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A derived foreground, as Chromium actually computes it. `styles` carries the
 * computed string the checker would see; `colours` carries the sRGB the
 * compositor paints, which is what the adapter's canvas returns — measured,
 * `oklab(0.696745 0.000843457 -0.00287951)` paints rgb(157, 157, 159).
 */
const DERIVED_LOW_CONTRAST: InspectWorldSpec = {
  nodes: [
    {
      id: 'muted',
      attrs: { 'data-text': 'meta' },
      text: 'Updated 4 minutes ago',
      styles: {
        color: 'oklab(0.696745 0.000843457 -0.00287951)',
        'font-size': '12px',
        'font-weight': '400',
        '--intent-min-contrast': '4.5',
      },
      colours: { color: [157, 157, 159, 1] },
      backdrop: '#ffffff',
    },
  ],
};

describe('N640 — derived colour, resolved by the adapter', () => {
  it('produces a real ratio for a colour the old parser could not read', () => {
    // 288 of 1188 measured text cells were undecidable to the regex this
    // replaces — 31.8% of derived cells against 9.1% of authored ones — because
    // `color-mix()` and `contrast-color()` both compute to `oklab(…)`. This is
    // that exact value, and it is now a FINDING with a number in it.
    const findings = run(contrastRule<string>(), DERIVED_LOW_CONTRAST);

    expect(findings).toHaveLength(1);
    const [finding] = findings as [Finding];
    expect(finding.code).toBe('N640');
    expect(finding.severity).toBe('fail');
    expect(finding.detail).toMatch(/contrast 2\.7\d:1 below the 4\.5:1 floor/);
    // The painted colour, not the authored string: `oklab(0.696745 …)` tells a
    // reader nothing about what is on screen, and a derived table produces
    // almost nothing else.
    expect(finding.detail).toContain('painted rgb(157, 157, 159)');
  });

  it('reports N680 for the same colour when the adapter cannot resolve it', () => {
    // The other direction, and the one that names the old behaviour: drop the
    // resolved triple and the fixture models an adapter with no way to paint —
    // happy-dom has no 2D canvas context, which is exactly why the fake supplies
    // triples rather than parsing. An unresolvable colour is loud, not silent.
    const findings = run(contrastRule<string>(), {
      nodes: [
        {
          id: 'muted',
          attrs: { 'data-text': 'meta' },
          text: 'Updated 4 minutes ago',
          styles: {
            color: 'oklab(0.696745 0.000843457 -0.00287951)',
            'font-size': '12px',
            'font-weight': '400',
          },
          // No `colours`. The fake's fixture reader understands `rgb()` and hex
          // and nothing else, deliberately — see `fixtureColour` — so this is
          // the same document with the resolution step removed.
          backdrop: '#ffffff',
        },
      ],
    });

    expect(findings.map((finding) => finding.code)).toEqual(['N680']);
    expect(findings[0]?.detail).toContain('cannot resolve the text colour');
  });

  it('refuses a number when opacity fades the stack', () => {
    // The sixth oracle bug, and the worst of the three colour blind spots: the
    // shipped disabled action (`roles.css:130`, `opacity: 0.45`) was reported at
    // 18.85:1 while it actually paints 3.03:1 — a six-fold error in the
    // direction of false confidence. WCAG 1.4.3 exempts inactive components, so
    // it was never a conformance failure, which is precisely why it survived.
    const findings = run(contrastRule<string>(), {
      nodes: [
        {
          id: 'disabled-action',
          attrs: { 'data-appearance': 'action', 'aria-disabled': 'true' },
          text: 'Archive',
          styles: { ...READABLE },
          opacity: 0.45,
          backdrop: '#ffffff',
        },
      ],
    });

    expect(findings.map((finding) => finding.code)).toEqual(['N680']);
    expect(findings[0]?.detail).toContain('opacity 0.45');
  });

  it('refuses a number when the backdrop is an image', () => {
    // `backdrop()` was a background-COLOUR walk, so an ancestor carrying
    // `background-image` contributed nothing and the rule silently measured the
    // colour BEHIND the image — a confident number about pixels it never looked
    // at.
    const findings = run(contrastRule<string>(), {
      nodes: [
        {
          id: 'hero',
          backdropImage: 'linear-gradient(rgb(255, 255, 255), rgb(0, 0, 0))',
          children: [
            {
              id: 'headline',
              attrs: { 'data-text': 'display' },
              text: 'Derived appearance',
              styles: { ...READABLE, 'font-size': '32px' },
            },
          ],
        },
      ],
    });

    expect(findings.map((finding) => finding.code)).toEqual(['N680']);
    expect(findings[0]?.detail).toContain('no single colour is behind this text');
  });

  it('is silent on CLEAN', () => {
    expect(run(contrastRule<string>(), CLEAN)).toEqual([]);
  });
});
