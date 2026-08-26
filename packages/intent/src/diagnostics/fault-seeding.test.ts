/**
 * fault-seeding.test.ts — the sweep that replaces "somebody happened to look".
 *
 * Every oracle bug this experiment has recorded was found opportunistically: a
 * page happened to trip it, or a human happened to look at a screenshot. Six of
 * the ten were one mistake in six costumes — the rule measured a geometry that
 * does not answer the claim it makes — and the sixth was written INSIDE the rule
 * whose header records the fifth. Nothing in the suite asks the question
 * systematically, so this file asks it: for every defect class the registry
 * claims to detect, put that defect into a document and require the owning rule
 * to say so; put it back the way it was and require silence.
 *
 * WHAT THIS IS CALLED, because the name matters more than the metaphor. This is
 * FAULT SEEDING — mutation analysis in which the rendered document is the
 * program under test and the rule set is the suite under evaluation. It is not
 * an inversion of mutation testing; it is mutation testing with the roles named
 * correctly, and the artefact it produces is a bug benchmark. The canonical
 * instances are NIST's Juliet suite (synthetic flawed programs built to score
 * static analysers, each shipped beside a near-identical NON-flawed twin
 * specifically to test tool discrimination), LAVA, whose headline property is
 * that an injected bug is always triggerable because it is injected along a
 * known-feasible path, and Bug-Injector, which injects only where a trace shows
 * the template's precondition already satisfied. All three exist because of the
 * failure this file has to avoid: an injection that did not take, scored as a
 * blind checker.
 *
 * THE ARGUMENT FOR THIS FILE, MADE BY SOMEBODY ELSE, AS AN ADMISSION. ReDeCheck
 * (ISSTA 2017) is an academic responsive-layout checker that detects element
 * collision, element protrusion, viewport protrusion, small-range layouts and
 * incongruous wrapping — five of the sixteen rules here under different names,
 * over the same DOM geometry. Its authors' own closing appraisal:
 *
 *     "Our appraisal of the prototype tool does not include the possibility of
 *      false negatives: We do not know if, for the pages studied, ReDeCheck
 *      missed failures."
 *
 * They could not manufacture a known defect and confirm the check caught it, so
 * they could not speak about false negatives at all — the direction of error
 * that gets a checker deleted, and the direction three of this experiment's four
 * silent oracle bugs went. That is the hole this file fills.
 *
 * AND THE SHAPE TO COPY IS THE BORING ONE. `axe-core` — a rule-based DOM checker
 * with almost this architecture, at roughly sixty-eight million downloads a week
 * — ships eighty-six per-rule fixtures asserting a couple of thousand individual
 * node verdicts. ReDeCheck, with the better theoretical fit, has seventeen stars
 * and last saw a commit in 2023. A table of fixtures with expected verdicts, one
 * per rule, is what survives contact with users; nothing here is cleverer than
 * that on purpose.
 *
 * FOUR MECHANISMS, and three of them are the literature's rather than this
 * author's.
 *
 *   1. DIFFERENTIAL FIRING. A kill is scored on the SET DIFFERENCE between the
 *      clean run and the seeded run, never on the seeded run alone. A finding
 *      that was already there before the injection is not evidence about the
 *      injection. One seed depends on this outright — the N730 pair carries
 *      `data-fit="unsatisfiable"` in both twins, so N620 speaks in both, and
 *      only the difference is about N730.
 *   2. IDENTITY-MATCHED KILLS. A kill must carry the owning code AND name the
 *      seeded subject. The right code on the wrong subject fails this harness as
 *      loudly as silence does, because that is exactly what the first N670 did:
 *      it fired reliably, on the opposite condition to its own defect, and a
 *      code-only assertion would have called that a pass.
 *   3. DISCRIMINATIVE PAIRS. Each seed is one builder called twice, so the clean
 *      twin and the seeded twin differ only in the perturbed state and silence
 *      on the clean twin is evidence about the RULE rather than about a second
 *      fixture somebody wrote differently.
 *   4. AN INDEPENDENT WITNESS. Every seed states the defect a second time, as a
 *      predicate over the document, in the vocabulary of the CLAIM rather than
 *      of the rule. The witness must be false on the clean twin and true on the
 *      seeded one before a single rule runs. This is the whole reason the harness
 *      can tell "I could not build the defect" from "the rule cannot see the
 *      defect", and that distinction is not hypothetical: a self-test in this
 *      experiment reported a check as blind when what had actually failed was
 *      its own injection.
 *
 * WHY THE FAKE INSPECTOR AND NOT A BROWSER. The fake models geometry
 * explicitly, so a document that could not be produced by hand-authored markup
 * at some unknown viewport can still be stated in one literal — and the whole
 * sweep runs in milliseconds, which is what makes it a gate rather than a
 * nightly job. The cost is named rather than hidden: a seed can only carry a
 * defect the fake can model, and the fake cannot lay anything out. Every number
 * below is therefore a claim about geometry the browser is trusted to produce,
 * and the browser-side proofs in the appearance experiment are what check that
 * trust. This file checks the rules, not the adapter.
 *
 * WHY THE MATRIX IS DERIVED. `CODES` is append-only and `DEFAULT_RULES` ships
 * one rule per code, so the sweep is built by iterating the registry: a code
 * with no seed and no stated reason is a FAILURE, not a silence. A hand-written
 * list of seventeen would go stale the moment somebody allocates an eighteenth,
 * and this project has already paid for exactly that — two duplicated
 * hard-coded path lists agreed with each other, so a new page made both answer
 * false, the test passed green, and the feature shipped dead.
 *
 * ONE INJECTION PER CLASS, AIMED AT A NODE THE RULE CAN REACH, and that is a
 * borrowed economy rather than laziness. The one large deployment with published
 * numbers found developers calling eighty-five percent of generated mutants
 * unproductive; what took that to eleven was SUPPRESSION — mutate only covered
 * lines, at most one mutant per line, and a hundred-odd hand-curated rules for
 * nodes not worth mutating. Generation was never the constraint. A harness that
 * enumerates variants of an injection nobody asked about gets muted, and muting
 * is this project's most-recorded failure mode.
 *
 * FOUR AXES, because the recurring defect class turned out to be wider than
 * wrong geometry. Three cross-cutting obligations are hand-applied per rule and
 * unevenly held, so each is injected in its own right, over the SAME seed table:
 * the defect itself; the defect inside content the checker cannot measure, where
 * the contract is an admission rather than a pass; the defect inside a subtree
 * that declared `data-escaped`; and the defect with the declaration the rule
 * reads made unresolvable, which is where a `px()` coercion turns a check into
 * decoration. All three obligations are modellable in the fake, and the one
 * asymmetry worth naming is that `measurable()` is inherited there while
 * `rendered()` is per node — so a skipped subtree has to be spelled on every
 * node of it, exactly as the recorded browser fixtures spell it.
 *
 * WHAT IT PRINTS, AND THE ONE THING IT REFUSES TO PRINT. Rules are named, never
 * scored: the largest published mutation-testing deployment deliberately does
 * not compute a mutant-detection ratio because it "is neither concrete nor
 * actionable, and it does not guide testing", and a percentage here would read
 * as a grade while hiding the only actionable fact — WHICH rule. So every block
 * prints codes, and the absolute counts exist to catch a harness that has
 * quietly stopped injecting.
 *
 * The falsification block removes one rule from the set and requires the report
 * to name it unexercised, then restores it and requires silence. A second block
 * hands the sweep four deliberately BROKEN seeds and requires it to name its own
 * failure as its own. A sweep that cannot fail when a check is deleted, or that
 * blames a rule for its own bad fixture, is decoration.
 */
import { describe, expect, it } from 'vitest';
import type { Finding, Inspector, Rgba, Rule } from '../contracts.js';
import { VOCABULARY } from '../contracts.js';
import { FakeInspector } from '../testing.js';
import type { InspectSpec, InspectWorldSpec } from '../testing.js';
import { CODES } from './codes.js';
import { DEFAULT_RULES, check } from './runner.js';

/* ══════════════════════════════════════════════════════════════════════════
   Fixture vocabulary
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The styles a node needs before a verdict about its TEXT is decidable: a
 * resolvable colour, a length line-height, and the floor N640 reads off the
 * element. A fixture that omits any of them gets N680 instead of the silence it
 * meant, which would arrive here as collateral and fail the sweep — loudly,
 * which is correct. The fake resolves styles per node with no inheritance, so
 * every node that wants a verdict declares them.
 */
const READABLE: Readonly<Record<string, string>> = {
  color: 'rgb(24, 24, 27)',
  'font-size': '14px',
  'font-weight': '400',
  'line-height': '18px',
  '--intent-min-contrast': '4.5',
};

/** Widened once, because the vocabulary's tuples are literal types. */
const LAYOUTS: readonly string[] = VOCABULARY.layout;

/**
 * The contrast formula, written a second time on purpose.
 *
 * This is WCAG's relative-luminance ratio, which is the standard rather than
 * the rule, and a witness that called the rule would be no witness at all: it
 * would agree with N640 about a document N640 was wrong about. The floor stays
 * the theme's — read off the element, never a constant here — so this predicate
 * answers "is the claim true" while the rule answers "does the checker say so".
 */
function luminance(colour: Rgba): number {
  const linear = [colour[0], colour[1], colour[2]].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(front: Rgba, back: Rgba): number {
  const [bright, dim] = [luminance(front), luminance(back)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (bright + 0.05) / (dim + 0.05);
}

/** Words, counted the way a reader counts them. */
function words(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/* ══════════════════════════════════════════════════════════════════════════
   The seed table — one witnessed defect per registered code
   ══════════════════════════════════════════════════════════════════════════ */

interface Seed {
  /** The code this defect class belongs to. Must be registered. */
  readonly code: string;
  /** The node the finding must NAME. Right code, wrong subject is a failure. */
  readonly subject: string;
  /**
   * The rule expected to speak, when it is not the owner of `code`. Only N680
   * needs it: "measurement impossible" is a class no rule owns, and every
   * admission is made BY some other rule about its own claim.
   */
  readonly by?: string;
  /** The defect, in one phrase, for the failure message. */
  readonly defect: string;
  /** What the seeded twin changes. Prose, for the reader of a failure. */
  readonly perturbs: string;
  /**
   * Codes legitimately woken by the same physical fact. A whitelist, never a
   * requirement: one geometry can be two true claims, and N660/N670 are the
   * recorded case — a crush and the collision it causes, which the rule set
   * itself calls one root cause with two names. Anything NOT listed here that
   * wakes up is reported, because a perturbation that changes more than one
   * claim cannot tell which claim the rule answered.
   */
  readonly alsoFires?: readonly string[];
  /**
   * The node whose GEOMETRY carries the defect, when that is not the node the
   * finding names. Used by the skipped-content sweep at the end of this file:
   * the interesting question there is what happens when the defect-bearing
   * content becomes unmeasurable while the container that owns the claim stays
   * measurable, and for a containment rule those are two different nodes.
   */
  readonly bearer?: string;
  /** The document, clean or seeded. One builder, so the twins differ in one state. */
  document(seeded: boolean): InspectWorldSpec;
  /** Is the defect PRESENT? Asked of both twins before any rule runs. */
  present(world: Inspector<string>): boolean;
}

const SEEDS: readonly Seed[] = [
  {
    code: 'N601',
    subject: 'panel',
    defect: 'a subtree that declares itself outside the resolution table',
    perturbs: 'the presence of the escape declaration',
    document: (seeded) => ({
      nodes: [
        {
          id: 'panel',
          attrs: seeded ? { 'data-escaped': 'vendor marketing panel' } : {},
          box: { inline: 320, block: 40, contentInline: 320 },
        },
      ],
    }),
    present: (world) => world.attr('panel', 'data-escaped') !== null,
  },
  {
    code: 'N610',
    subject: 'odd',
    defect: 'a declared value no rule in the table resolves',
    perturbs: 'the value on the layout axis',
    document: (seeded) => ({
      nodes: [{ id: 'odd', attrs: { 'data-layout': seeded ? 'flexbox' : 'row' } }],
    }),
    present: (world) => {
      const value = world.attr('odd', 'data-layout');
      return value !== null && !LAYOUTS.includes(value);
    },
  },
  {
    code: 'N620',
    subject: 'row',
    defect: 'a container that promised to fit and gave up',
    perturbs: 'the fit state the solver stamped',
    document: (seeded) => ({
      nodes: [
        {
          id: 'row',
          attrs: { 'data-fit': seeded ? 'unsatisfiable' : 'settled' },
          box: { inline: 320, block: 40, contentInline: 300 },
        },
      ],
    }),
    present: (world) => world.attr('row', 'data-fit') === 'unsatisfiable',
  },
  {
    code: 'N621',
    subject: 'stamp',
    defect: 'a truncated value clamped past the point of meaning',
    perturbs: 'the inline space the timestamp was left with',
    document: (seeded) => ({
      nodes: [
        {
          id: 'stamp',
          attrs: { 'data-truncate': '' },
          text: 'Yesterday 14:03',
          box: { inline: seeded ? 12 : 96, block: 18, contentInline: 96 },
        },
      ],
    }),
    present: (world) => {
      // The claim, not the rule's formula's provenance: how much of the string
      // is still on screen. Four characters is the floor the strategy module
      // derives; below it a truncated value carries no information.
      const box = world.box('stamp');
      const length = world.text('stamp').trim().length;
      if (box.contentInline <= box.inline) return false;
      return length * (box.inline / box.contentInline) < 4;
    },
  },
  {
    code: 'N630',
    subject: 'document',
    defect: 'a document wider than the window it is shown in',
    perturbs: 'the document width',
    document: (seeded) => ({
      nodes: [],
      viewport: { inline: 1024, documentInline: seeded ? 1200 : 1024 },
    }),
    present: (world) => {
      const port = world.viewport();
      return port.documentInline > port.inline + 1;
    },
  },
  {
    code: 'N640',
    subject: 'greeting',
    defect: 'text below the contrast floor its context declared',
    perturbs: 'the painted text colour',
    document: (seeded) => ({
      nodes: [
        {
          id: 'greeting',
          attrs: { 'data-text': 'body' },
          text: 'Ada Lovelace',
          styles: { ...READABLE, color: seeded ? 'rgb(200, 200, 200)' : 'rgb(24, 24, 27)' },
          box: { inline: 200, block: 18, contentInline: 180 },
        },
      ],
    }),
    present: (world) => {
      const front = world.colour('greeting', 'color');
      const back = world.backdrop('greeting').colour;
      const floor = Number.parseFloat(world.style('greeting', '--intent-min-contrast'));
      if (front === null || back === null || !Number.isFinite(floor)) return false;
      return contrastRatio(front, back) < floor;
    },
  },
  {
    code: 'N650',
    subject: 'reply',
    defect: 'a control below the target floor its context declared',
    perturbs: 'the inline extent of the control',
    document: (seeded) => ({
      nodes: [
        {
          id: 'reply',
          attrs: { 'data-appearance': 'action' },
          text: 'Reply',
          styles: { ...READABLE, '--intent-min-target': '44px' },
          box: { inline: seeded ? 28 : 44, block: 44, contentInline: 24 },
        },
      ],
    }),
    present: (world) => {
      // BOUNDS, because the claim is about what a finger can press, and the
      // border box is what a finger presses. This witness is the one place the
      // harness restates the distinction that cost this experiment five
      // defects, and it restates it deliberately.
      const pressable = world.bounds('reply');
      const floor = Number.parseFloat(world.style('reply', '--intent-min-target'));
      if (!(floor > 0)) return false;
      return pressable.inline + 0.5 < floor || pressable.block + 0.5 < floor;
    },
  },
  {
    code: 'N660',
    subject: 'label',
    defect: 'an element given less inline space than its content needs',
    perturbs: 'the inline space the content wants',
    document: (seeded) => ({
      nodes: [
        {
          id: 'label',
          box: { inline: 120, block: 18, contentInline: seeded ? 320 : 118 },
        },
      ],
    }),
    present: (world) => {
      // BOX, because the claim is containment: what the content wanted against
      // what the box gave it, both padding-box measures, which is the only
      // comparison that is like for like.
      const box = world.box('label');
      return box.contentInline > box.inline + 1 && world.containment('label') === 'visible';
    },
  },
  {
    code: 'N670',
    subject: 'first',
    defect: 'a row child painting into the sibling beside it',
    // A crush and the collision it causes are one physical fact, and the rule
    // set says so in overlap.ts: "overlap is the visible half of a crush". The
    // whitelist records that rather than hiding it.
    alsoFires: ['N660'],
    perturbs: 'the inline space the first child\u2019s content wants',
    document: (seeded) => ({
      nodes: [
        {
          id: 'row',
          attrs: { 'data-layout': 'row' },
          box: { inline: 200, block: 40, contentInline: 200 },
          children: [
            { id: 'first', box: { inline: 100, block: 18, contentInline: seeded ? 200 : 96 } },
            { id: 'second', box: { inline: 100, block: 18, contentInline: 96 } },
          ],
        },
      ],
    }),
    present: (world) => {
      const box = world.box('first');
      const inRow = world.all('[data-layout="row"] > *').includes('first');
      const last = world.all('[data-layout="row"] > *:last-child').includes('first');
      return inRow && !last && box.contentInline > box.inline + 1;
    },
  },
  {
    code: 'N680',
    subject: 'derived',
    by: 'N640',
    defect: 'a text colour the adapter cannot resolve to a painted value',
    perturbs: 'whether the compositor handed back a colour at all',
    document: (seeded) => ({
      nodes: [
        {
          id: 'derived',
          attrs: { 'data-text': 'body' },
          text: 'Ada Lovelace',
          styles: { ...READABLE, color: 'oklab(0.7 0 0)' },
          colours: { color: seeded ? null : [24, 24, 27, 1] },
          box: { inline: 200, block: 18, contentInline: 180 },
        },
      ],
    }),
    present: (world) =>
      world.text('derived').trim() !== '' && world.colour('derived', 'color') === null,
  },
  {
    code: 'N690',
    subject: 'shredded',
    defect: 'a single word broken inside itself to fit its box',
    perturbs: 'the line boxes the word occupies, and the text height that follows',
    document: (seeded) => ({
      nodes: [
        {
          id: 'shredded',
          attrs: { 'data-text': 'title' },
          text: 'Internationalization',
          styles: READABLE,
          box: { inline: 60, block: seeded ? 36 : 18, contentInline: 60 },
          lines: seeded ? 2 : 1,
        },
      ],
    }),
    present: (world) => {
      // `lines()`, which is what the port added for this claim: a text
      // measurement for a text claim. The seeded twin states BOTH facets of one
      // physical state — two line boxes, and the text height that follows from
      // them — because a browser cannot produce one without the other, and the
      // witness reads only the facet the claim is about.
      const rendered = world.lines('shredded');
      return rendered > words(world.text('shredded'));
    },
  },
  {
    code: 'N700',
    subject: 'card',
    defect: 'two actions in one surface each declaring themselves the thing to do',
    perturbs: 'the emphasis on the second action',
    document: (seeded) => ({
      nodes: [
        {
          id: 'card',
          attrs: { 'data-appearance': 'surface' },
          children: [
            {
              id: 'save',
              attrs: { 'data-appearance': 'action', 'data-role': 'primary' },
              text: 'Save',
              // The floor is declared on every action fixture in this file, and
              // for the same reason `READABLE` carries a contrast floor: an
              // action whose context declares no target floor is a claim N650
              // must REFUSE rather than pass, and an admission arriving here as
              // collateral would say nothing about N700.
              styles: { ...READABLE, '--intent-min-target': '44px' },
              box: { inline: 80, block: 44, contentInline: 60 },
            },
            {
              id: 'discard',
              attrs: { 'data-appearance': 'action', 'data-role': seeded ? 'danger' : 'quiet' },
              text: 'Discard',
              styles: { ...READABLE, '--intent-min-target': '44px' },
              box: { inline: 90, block: 44, contentInline: 70 },
            },
          ],
        },
      ],
    }),
    present: (world) =>
      world.within(
        'card',
        '[data-appearance="action"][data-role="primary"], [data-appearance="action"][data-role="danger"]',
      ).length >= 2,
  },
  {
    code: 'N710',
    subject: 'strip',
    // The clipper is what the finding names; the chip is what carries the loss.
    bearer: 'chip',
    defect: 'a clipping box that deletes content nobody said was expendable',
    perturbs: 'where the chip sits along the inline axis',
    document: (seeded) => ({
      nodes: [
        {
          id: 'strip',
          containment: 'clip',
          box: { inline: 200, block: 40, contentInline: 200 },
          bounds: { inline: 200, block: 40, inlineStart: 0, blockStart: 0 },
          children: [
            {
              id: 'chip',
              text: 'Archive',
              box: { inline: 80, block: 24, contentInline: 80 },
              bounds: { inline: 80, block: 24, inlineStart: seeded ? 240 : 40, blockStart: 8 },
            },
          ],
        },
      ],
    }),
    present: (world) => {
      // Rect against rect, which is the only measurement that can answer a
      // visual-extent claim. `Box` cannot: a clipper's padding box is exactly
      // the size that hides the loss.
      const clip = world.bounds('strip');
      const rect = world.bounds('chip');
      return (
        world.containment('strip') === 'clip' &&
        world.text('chip').trim() !== '' &&
        rect.inlineStart + rect.inline > clip.inlineStart + clip.inline + 1
      );
    },
  },
  {
    code: 'N713',
    subject: 'item',
    defect: 'content lying outside the multicolumn container that fragmented it',
    perturbs: 'where the item sits along the inline axis',
    document: (seeded) => ({
      nodes: [
        {
          id: 'columns',
          styles: { 'column-count': '3', display: 'block' },
          box: { inline: 300, block: 100, contentInline: 300 },
          bounds: { inline: 300, block: 100, inlineStart: 0, blockStart: 0 },
          children: [
            {
              id: 'item',
              text: 'Ada Lovelace',
              box: { inline: 90, block: 20, contentInline: 90 },
              bounds: { inline: 90, block: 20, inlineStart: seeded ? 260 : 10, blockStart: 10 },
            },
          ],
        },
      ],
    }),
    present: (world) => {
      const outer = world.bounds('columns');
      const inner = world.bounds('item');
      const fragmenting = world.style('columns', 'column-count') !== '';
      return (
        fragmenting && inner.inlineStart + inner.inline > outer.inlineStart + outer.inline + 1
      );
    },
  },
  {
    code: 'N715',
    subject: 'stray',
    defect: 'content painted above the block-start edge of its container',
    perturbs: 'where the badge sits along the block axis',
    document: (seeded) => ({
      nodes: [
        {
          id: 'panel',
          attrs: { 'data-layout': 'stack' },
          box: { inline: 300, block: 60, contentInline: 300 },
          bounds: { inline: 300, block: 60, inlineStart: 0, blockStart: 100 },
          children: [
            {
              id: 'stray',
              text: 'Badge',
              box: { inline: 40, block: 20, contentInline: 40 },
              bounds: { inline: 40, block: 20, inlineStart: 10, blockStart: seeded ? 60 : 110 },
            },
          ],
        },
      ],
    }),
    present: (world) => {
      // The defect scroll extents are structurally blind to: they only ever
      // grow towards the end edges, so this one has to be a rect comparison.
      const outer = world.bounds('panel');
      const inner = world.bounds('stray');
      return outer.blockStart - inner.blockStart > 1;
    },
  },
  {
    code: 'N730',
    subject: 'stamp',
    defect: 'a degradation the solver spent that bought no space',
    perturbs: 'whether truncating the stamp made it narrower',
    document: (seeded) => ({
      nodes: [
        {
          id: 'row',
          attrs: { 'data-fit': 'unsatisfiable' },
          box: { inline: 200, block: 40, contentInline: 200 },
          children: [
            {
              id: 'stamp',
              attrs: { 'data-truncate': '' },
              text: 'Yesterday at three in the afternoon',
              box: { inline: 100, block: 18, contentInline: seeded ? 100 : 200 },
            },
          ],
        },
      ],
    }),
    present: (world) => {
      // Both twins admit the container failed, which is what makes this pair
      // the one that proves differential scoring: N620 speaks in both, and only
      // the difference between the runs is about this claim.
      const box = world.box('stamp');
      return (
        world.attr('row', 'data-fit') === 'unsatisfiable' &&
        world.attr('stamp', 'data-truncate') !== null &&
        box.contentInline <= box.inline + 0.5
      );
    },
  },
  {
    code: 'N740',
    subject: 'sentence',
    defect: 'text reflowed onto a second line inside a container declared as a row',
    perturbs: 'the line boxes the sentence occupies, and the block extent that follows',
    document: (seeded) => ({
      nodes: [
        {
          id: 'row',
          attrs: { 'data-fit': 'settled', 'data-layout': 'row' },
          box: { inline: 200, block: 60, contentInline: 200 },
          children: [
            {
              id: 'sentence',
              attrs: { 'data-text': 'body' },
              text: 'Ten words down a column',
              styles: READABLE,
              box: { inline: 60, block: seeded ? 54 : 18, contentInline: 60 },
              lines: seeded ? 3 : 1,
            },
          ],
        },
      ],
    }),
    present: (world) => world.lines('sentence') >= 2,
  },
];

/**
 * Classes that cannot be seeded here, each with the reason, because "no seed"
 * and "no rule" are different facts and only one of them is a gap in a rule.
 *
 * Empty today, and that is a finding rather than a convenience: every one of the
 * seventeen registered classes turned out to be expressible in the fake,
 * including N680, whose seed is an unresolvable colour and whose kill is made BY
 * N640 rather than by any rule of its own.
 */
const UNSEEDABLE: Readonly<Record<string, string>> = {};

/**
 * The rule codes this table claims to exercise, derived from the seeds rather
 * than from the rule set: the sweep is scored against what the registry says
 * ought to be checked, not against whatever happens to be shipping.
 */
const OWNERS: readonly string[] = [...new Set(SEEDS.map((seed) => seed.by ?? seed.code))].sort();

/* ══════════════════════════════════════════════════════════════════════════
   The sweep
   ══════════════════════════════════════════════════════════════════════════ */

/** One finding, plus the rule that made it. `check` does not carry that. */
interface Spoke {
  readonly by: string;
  readonly finding: Finding;
}

/**
 * Run each rule in isolation, so every finding is attributable. The runner
 * already isolates a throwing rule into N680, which means a rule that dies on a
 * seeded document arrives here as collateral and fails the sweep by name.
 */
function fire(world: Inspector<string>, rules: readonly Rule<string>[]): readonly Spoke[] {
  return rules.flatMap((rule) => check(world, [rule]).map((finding) => ({ by: rule.code, finding })));
}

const identity = (spoke: Spoke): string =>
  `${spoke.by}|${spoke.finding.code}|${spoke.finding.subject}|${spoke.finding.detail}`;

/** What the injection ADDED. Anything the clean run already said is not evidence. */
function fresh(before: readonly Spoke[], after: readonly Spoke[]): readonly Spoke[] {
  const said = new Set(before.map(identity));
  return after.filter((spoke) => !said.has(identity(spoke)));
}

interface SweepReport {
  /** Defect classes actually built and witnessed in a document. */
  readonly injected: number;
  /** Rule codes that spoke about their own seeded defect, by name. */
  readonly exercised: readonly string[];
  /** Rules that did not, each with why. */
  readonly unexercised: readonly string[];
  /** The harness's own failures: an injection that did not take. */
  readonly faults: readonly string[];
  /** A rule firing on the clean twin, where its own claim is not true. */
  readonly noise: readonly string[];
  /** A new finding that was not the seeded class and was not whitelisted. */
  readonly collateral: readonly string[];
  /** A kill made by a rule other than the one the seed named. */
  readonly misattributed: readonly string[];
}

/**
 * The sweep. `seeds` is a parameter rather than a closed-over constant so the
 * harness can be run against a DELIBERATELY BROKEN table and asked what it
 * says — the block at the end of this file does exactly that, because a sweep
 * whose own failure reporting is untested is a sweep that will one day report a
 * working rule as blind.
 */
function sweep(rules: readonly Rule<string>[], seeds: readonly Seed[] = SEEDS): SweepReport {
  const exercised = new Set<string>();
  const blind = new Map<string, string>();
  const faults: string[] = [];
  const noise: string[] = [];
  const collateral: string[] = [];
  const misattributed: string[] = [];
  let injected = 0;

  for (const seed of seeds) {
    const clean = seed.document(false);
    const seeded = seed.document(true);

    /* Injection self-check, in three steps, before any rule is consulted. Each
       failure here is the HARNESS's defect and is reported as one: a sweep that
       cannot tell a failed injection from a blind rule reports a working check
       as broken, which is how a self-test loses its authority. */
    if (JSON.stringify(clean) === JSON.stringify(seeded)) {
      faults.push(`${seed.code}: the seeded document equals its twin — nothing was injected`);
      continue;
    }
    const before = new FakeInspector(clean);
    const after = new FakeInspector(seeded);
    if (seed.present(before)) {
      faults.push(
        `${seed.code}: the CLEAN twin already carries ${seed.defect}, so the pair cannot discriminate — fix the fixture, not the rule`,
      );
      continue;
    }
    if (!seed.present(after)) {
      faults.push(
        `${seed.code}: injection did not take — ${seed.defect} is absent from the seeded document (perturbed: ${seed.perturbs}), so this says NOTHING about the rule`,
      );
      continue;
    }
    injected += 1;

    const said = fire(before, rules);
    const heard = fire(after, rules);

    for (const spoke of said) {
      if (spoke.finding.code !== seed.code) continue;
      if (spoke.finding.subject !== seed.subject) continue;
      noise.push(
        `${seed.code} fired on ${seed.subject} in the CLEAN twin, where its own claim is false: ${spoke.finding.detail}`,
      );
    }

    const added = fresh(said, heard);
    const kills = added.filter(
      (spoke) => spoke.finding.code === seed.code && spoke.finding.subject === seed.subject,
    );
    if (kills.length === 0) {
      const nearby = added.filter((spoke) => spoke.finding.code === seed.code);
      blind.set(
        seed.by ?? seed.code,
        nearby.length > 0
          ? `${seed.code} fired but named ${nearby
              .map((spoke) => spoke.finding.subject)
              .join(', ')} rather than ${seed.subject} — right code, wrong subject`
          : `${seed.defect} was injected into ${seed.subject} and witnessed, and nothing said so`,
      );
    }
    for (const kill of kills) {
      exercised.add(kill.by);
      const owner = seed.by ?? seed.code;
      if (kill.by !== owner) {
        misattributed.push(`${seed.code} on ${seed.subject} was reported by ${kill.by}, not ${owner}`);
      }
    }

    for (const spoke of added) {
      if (spoke.finding.code === seed.code) continue;
      if ((seed.alsoFires ?? []).includes(spoke.finding.code)) continue;
      collateral.push(
        `${seed.code}: injecting ${seed.defect} also woke ${spoke.finding.code} on ${spoke.finding.subject} — the perturbation is not confined to one claim (${spoke.finding.detail})`,
      );
    }
  }

  /* Scored against the owners THE SEED TABLE DECLARES, never against the rule
     array that was passed in, and the difference is the whole falsification
     story. A rule dropped from `DEFAULT_RULES` leaves its code registered and
     its check gone — the recorded silent-death shape, where every finding it
     would have made simply stops — and iterating the supplied array would make
     a dropped rule VANISH from this report rather than appear in it. So the
     expected set is derived, and a code no rule in the set carries is reported
     more loudly than a rule that merely said nothing, because it is worse:
     nothing is running at all.
   */
  const owners = [...new Set(seeds.map((seed) => seed.by ?? seed.code))].sort();
  const unexercised = owners.filter((code) => !exercised.has(code)).map((code) => {
    if (!rules.some((rule) => rule.code === code)) {
      return `${code}: no rule in this set carries this code — the check is not running at all`;
    }
    return `${code}: ${blind.get(code) ?? 'no seed in this table names this rule as its owner'}`;
  });

  return {
    injected,
    exercised: [...exercised].sort(),
    unexercised,
    faults,
    noise,
    collateral,
    misattributed,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   The matrix comes from the registry
   ══════════════════════════════════════════════════════════════════════════ */

describe('the seed table is derived from the registry, not from a list', () => {
  it('seeds every registered code, or states why it cannot', () => {
    const seeded = new Set(SEEDS.map((seed) => seed.code));
    const missing = Object.keys(CODES).filter(
      (code) => !seeded.has(code) && UNSEEDABLE[code] === undefined,
    );
    // An eighteenth code with no seed is a FAILURE, not a silence. This is the
    // shape that cost this project a dead feature: two hard-coded lists agreed
    // with each other, a new page made both answer false, and the suite passed.
    expect(
      missing,
      'a registered defect class with no seeded fixture and no stated reason — add one or say why it cannot be built',
    ).toEqual([]);
  });

  it('seeds nothing the registry does not allocate', () => {
    const unregistered = SEEDS.map((seed) => seed.code).filter(
      (code) => CODES[code] === undefined,
    );
    expect(unregistered).toEqual([]);
  });

  it('names an owner for every shipped rule', () => {
    // The other direction, and the one that goes quiet: a rule can be exercised
    // only if some seed claims it. Asserting ownership here separates "nobody
    // wrote a fixture" from "the fixture ran and the rule said nothing", which
    // are the same green without it.
    const owners = new Set(SEEDS.map((seed) => seed.by ?? seed.code));
    const unowned = DEFAULT_RULES<string>()
      .map((rule) => rule.code)
      .filter((code) => !owners.has(code));
    expect(unowned, 'shipped rules that no seed claims as owner').toEqual([]);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   The sweep itself
   ══════════════════════════════════════════════════════════════════════════ */

describe('fault seeding over the whole rule set', () => {
  const rules = DEFAULT_RULES<string>();
  const report = sweep(rules);

  it('built every defect it claims to have built', () => {
    // Reported FIRST and separately, because "I could not create the defect"
    // and "the rule cannot see the defect" are different facts and conflating
    // them is how a self-test in this experiment reported a working check as
    // blind.
    expect(report.faults, 'the harness failed to construct these defects').toEqual([]);
  });

  it('is not vacuous, and says so out loud', () => {
    /* NAMES, AND ABSOLUTE COUNTS, AND DELIBERATELY NO RATIO.

       The largest mutation-testing deployment on record — fourteen and a half
       million mutants over six years, across a thousand-odd projects — refuses
       to compute a mutant-detection score, on the grounds that it "is neither
       concrete nor actionable, and it does not guide testing". A percentage here
       would be worse than useless: it would be flattering. Ninety-four percent
       of rules exercised reads like a grade, and the only actionable fact in it
       is WHICH rule the missing six percent is. So this prints the codes. */
    console.log(
      `fault seeding — ${report.injected} defect class(es) seeded and witnessed: ${SEEDS.map(
        (seed) => seed.code,
      ).join(', ')}\n` +
        `  rules exercised by their own defect: ${report.exercised.join(', ')}\n` +
        `  rules NOT exercised: ${
          report.unexercised.length === 0 ? 'none' : report.unexercised.join('; ')
        }\n` +
        `  injection faults: ${report.faults.length}; false failures on a clean twin: ${report.noise.length}; ` +
        `unwhitelisted collateral: ${report.collateral.length}`,
    );
    // A harness that silently stops injecting is the failure mode it exists to
    // catch, so the counts are asserted rather than printed and admired. Against
    // the REGISTRY, so an eighteenth code moves this number and somebody has to
    // look at it.
    expect(report.injected).toBe(Object.keys(CODES).length - Object.keys(UNSEEDABLE).length);
    expect(report.exercised).toEqual([...OWNERS]);
    expect(report.exercised.length).toBe(rules.length);
  });

  it('exercises every shipped rule with the defect that rule was allocated for', () => {
    expect(report.unexercised, 'rules no seeded defect could make speak').toEqual([]);
  });

  it('is silent on every clean twin', () => {
    // The twin differs from the seeded document in one state, so a finding here
    // is a false failure by the rule rather than a difference between two
    // fixtures somebody wrote at different times.
    expect(report.noise).toEqual([]);
  });

  it('kills are identity-matched, so nothing passes for firing on the wrong node', () => {
    expect(report.misattributed).toEqual([]);
  });

  it('confines each injection to the claim it is about', () => {
    // Kill-reason filtering, in the local dialect: a finding woken by the same
    // perturbation but belonging to another class means the sweep cannot tell
    // which claim the rule answered. The one accepted case is whitelisted at
    // its seed with the reason, and the rule set states that reason itself.
    expect(report.collateral).toEqual([]);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   Falsification — a sweep that cannot fail is decoration
   ══════════════════════════════════════════════════════════════════════════ */

describe('the sweep can fail', () => {
  it('reports a deleted rule as unexercised, and names the defect it stopped seeing', () => {
    const crushed = 'N660';
    const without = DEFAULT_RULES<string>().filter((rule) => rule.code !== crushed);
    const report = sweep(without);
    expect(report.unexercised.join('\n')).toContain(crushed);
    expect(report.exercised).not.toContain(crushed);
    // And the reason must be the RULE's absence, not the harness's failure: the
    // seed still built its defect and the witness still saw it.
    expect(report.faults).toEqual([]);
    expect(report.injected).toBe(SEEDS.length);
  });

  it('goes quiet again when the rule is restored', () => {
    const report = sweep(DEFAULT_RULES<string>());
    expect(report.unexercised).toEqual([]);
    expect(report.faults).toEqual([]);
  });
});

/**
 * A crush, stated four wrong ways. Each of these tables is a seed that is
 * BROKEN ON PURPOSE, and the assertions below are about what the sweep SAYS
 * about it — not about N660, which is sound and fires on all four documents that
 * carry the defect.
 *
 * This is the requirement that has already been paid for once: a self-test in
 * this experiment reported a check as blind when what had actually failed was
 * its own injection, and the two conclusions point at opposite files. So the
 * sweep is required to name its own failure as its own, and to keep saying
 * "blind rule" only for the case where the defect really is in the document.
 */
const CRUSHED = (contentInline: number, block = 18): InspectWorldSpec => ({
  nodes: [{ id: 'label', box: { inline: 120, block, contentInline } }],
});

const crushWitness = (world: Inspector<string>): boolean => {
  const box = world.box('label');
  return box.contentInline > box.inline + 1;
};

describe('the sweep tells its own failure from a blind rule', () => {
  const rules = DEFAULT_RULES<string>();
  const broken = (over: Partial<Seed>): readonly Seed[] => [
    {
      code: 'N660',
      subject: 'label',
      defect: 'an element given less inline space than its content needs',
      perturbs: 'the inline space the content wants',
      document: (seeded) => CRUSHED(seeded ? 320 : 118),
      present: crushWitness,
      ...over,
    },
  ];

  it('calls an injection that changed nothing its own fault', () => {
    const report = sweep(rules, broken({ document: () => CRUSHED(118) }));
    expect(report.faults.join('\n')).toContain('nothing was injected');
    expect(report.injected).toBe(0);
  });

  it('calls a clean twin that already carries the defect its own fault', () => {
    const report = sweep(rules, broken({ document: (seeded) => CRUSHED(seeded ? 321 : 320) }));
    expect(report.faults.join('\n')).toContain('cannot discriminate');
    expect(report.injected).toBe(0);
  });

  it('calls a perturbation that did not create the defect its own fault, never a blind rule', () => {
    // The document changed, the rule was consulted, and the defect is simply
    // not there: block extent is not inline space. A sweep that scored this as
    // silence would indict N660 for the harness's mistake.
    const report = sweep(rules, broken({ document: (seeded) => CRUSHED(118, seeded ? 36 : 18) }));
    expect(report.faults.join('\n')).toContain('injection did not take');
    expect(report.injected).toBe(0);
    expect(report.unexercised.join('\n')).not.toContain('nothing said so');
  });

  it('refuses a firing that names the wrong node, however right its code is', () => {
    // The recorded shape: the first N670 fired reliably, on the opposite
    // condition to its own defect. A code-only assertion calls that a pass.
    const report = sweep(rules, broken({ subject: 'nobody' }));
    expect(report.faults).toEqual([]);
    expect(report.injected).toBe(1);
    expect(report.unexercised.join('\n')).toContain('right code, wrong subject');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   The same defects, in content the checker cannot measure
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ONE TRANSFORM, APPLIED TO EVERY SEED, and it costs no new fixtures — which is
 * the whole argument for a derived matrix. Each seeded defect is moved into
 * content the browser SKIPPED (`content-visibility: auto`), and the rule that
 * owns the claim is asked what it says now.
 *
 * There are only three answers, and the middle one is the contract:
 *
 *   - it FIRES, because its claim is about what the author declared and layout
 *     was never part of it. N601, N610 and N700 are immune by construction.
 *   - it ADMITS — N680, naming itself — because it noticed that the content it
 *     would have measured is not measurable. This is what `measurable()` and
 *     `declared()` were added for.
 *   - it goes SILENT, which is a FALSE PASS: the defect is in the document, the
 *     checker reports a clean page, and nobody reads a finding that is not
 *     there. Three of this experiment's four silent oracle bugs were exactly
 *     this shape.
 *
 * The skipped subtree is spelled the way the rest of this package spells it:
 * `rendered: false` on every node, because `checkVisibility({
 * contentVisibilityAuto: true })` answers false for skipped content, plus
 * `measurable: false` on the subtree root, because skipping is inherited.
 */
function unrendered(node: InspectSpec): InspectSpec {
  return { ...node, rendered: false, children: node.children?.map(unrendered) };
}

function shroud(nodes: readonly InspectSpec[], bearer: string): readonly InspectSpec[] | null {
  let found = false;
  const walk = (list: readonly InspectSpec[]): InspectSpec[] =>
    list.map((node) => {
      if (node.id === bearer) {
        found = true;
        return { ...unrendered(node), measurable: false };
      }
      return node.children ? { ...node, children: walk(node.children) } : node;
    });
  const mapped = walk(nodes);
  return found ? mapped : null;
}

/**
 * Rules that go silent when their defect is skipped, each with the reason.
 *
 * THIS TABLE IS THE FINDING, not a configuration. NINE of the sixteen shipped
 * rules report a clean page when the defect they own is inside skipped content,
 * while N710, N713 and N715 — which own the same kind of containment claim —
 * admit. That asymmetry is the defect class N715's own header names: "a fix
 * applied to one rule and not to the rule beside it is its own defect class".
 * The three that admit were written after the skipped-content measurement; the
 * nine below were written before it and were never revisited. Three more —
 * N601, N610 and N700 — are immune by construction, because their claims are
 * about what the author declared and `declared()` reaches skipped nodes.
 *
 * Recorded rather than repaired, because every rule belongs to another file this
 * round. The assertion is the same polarity as the decoy quarantine: a rule that
 * goes silent and is NOT recorded here fails this file, and a rule that has since
 * learnt to admit is printed as a stale entry to delete. Nothing here excuses a
 * silence; it dates it.
 */
const SILENT_WHEN_SKIPPED: Readonly<Record<string, string>> = {
  N620: 'the trigger is a declaration the mutator wrote, but the selector is painted(), so an unsatisfiable container inside skipped content is never reported',
  N621: 'no measurable() arm: a truncated value clamped past meaning is unreported while it is skipped',
  N640: 'no measurable() arm on the SELECTOR — the four undecidable arms are all about colour, so unreadable text inside skipped content is silence rather than an admission',
  N650: 'no measurable() arm: a control below its floor is unreported while it is skipped',
  N660: 'no measurable() arm, closed only by accident when N710, N713 or N715 happen to own the same container',
  N670: 'no measurable() arm: a collision inside skipped content is unreported, and the crush behind it (N660) is silent for the same reason',
  N690: 'no measurable() arm: a shredded word inside skipped content is unreported',
  N730: 'no measurable() arm, and no escaped-subtree exemption either',
  N740: 'no measurable() arm and no escaped-subtree exemption, alone among its three siblings, which have both',
};

describe('a defect the checker cannot measure must be admitted, never passed', () => {
  const rules = DEFAULT_RULES<string>();

  it('names every rule that reports a clean page instead', () => {
    const fires: string[] = [];
    const admits: string[] = [];
    const silent: string[] = [];
    const notApplicable: string[] = [];

    for (const seed of SEEDS) {
      const owner = seed.by ?? seed.code;
      const document = seed.document(true);
      const bearer = seed.bearer ?? seed.subject;
      const nodes = shroud(document.nodes, bearer);
      if (nodes === null) {
        // Reported, not skipped over: "there is no node to make unmeasurable"
        // is a fact about the claim, and N630's claim is about the viewport.
        notApplicable.push(`${seed.code}: no node named ${bearer} — this claim is not about a node`);
        continue;
      }
      const world = new FakeInspector({ ...document, nodes });
      const spoke = fire(world, rules).filter((found) => found.by === owner);
      if (spoke.some((found) => found.finding.code === seed.code)) {
        fires.push(`${owner}: still fires — the claim never depended on layout`);
      } else if (spoke.some((found) => found.finding.code === 'N680')) {
        admits.push(`${owner}: admits it cannot measure ${bearer}`);
      } else {
        silent.push(
          `${owner}: ${seed.defect} is in the document, ${bearer} is not measurable, and the report is CLEAN — ${
            SILENT_WHEN_SKIPPED[owner] ?? 'unrecorded'
          }`,
        );
      }
    }

    const codes = (entries: readonly string[]): string[] => [
      ...new Set(entries.map((entry) => entry.slice(0, entry.indexOf(':')))),
    ];
    const quiet = codes(silent);
    const unrecorded = quiet.filter((code) => SILENT_WHEN_SKIPPED[code] === undefined);
    const stale = Object.keys(SILENT_WHEN_SKIPPED).filter((code) => !quiet.includes(code));
    console.log(
      `fault seeding in skipped content — admit: ${codes(admits).join(', ') || 'none'}; ` +
        `immune by declaration: ${codes(fires).join(', ') || 'none'}; ` +
        `SILENT FALSE PASS: ${quiet.join(', ') || 'none'}; ` +
        `not about a node: ${codes(notApplicable).join(', ') || 'none'}` +
        (stale.length > 0 ? `; DELETE these repaired entries: ${stale.join(', ')}` : ''),
    );
    expect(
      unrecorded,
      'rules that report a clean page over a defect they cannot measure, and are not recorded as doing so',
    ).toEqual([]);
    // Non-vacuity in both directions: the transform must reach every seed, and
    // the three rules that DO admit must still admit, or the numbers below move
    // and this assertion moves with them.
    expect(fires.length + admits.length + silent.length + notApplicable.length).toBe(SEEDS.length);
    expect(admits.length).toBeGreaterThan(0);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   The same defects, inside a subtree that opted out
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * THE THIRD OBLIGATION, and the one where the rule set contradicts its own
 * registry.
 *
 * `data-escaped` is the opt-out, and N601's registry entry says such a subtree
 * "forfeits the rhythm, fit, contrast and hit-target guarantees". Four rules
 * implement that by building an escaped set and skipping it. The rest do not —
 * including the two the registry names by name, contrast and hit target — so the
 * same seeded defect inside the same escape hatch is exempted by some rules and
 * reported by others.
 *
 * WHICH ANSWER IS RIGHT IS NOT DECIDED HERE, deliberately: a checker that goes
 * quiet over a third of a page because somebody wrote one attribute is a
 * defensible position, and so is refusing to. What is not defensible is the
 * split being ACCIDENTAL, which is the class N715's header already names — a fix
 * applied to one rule and not to the rule beside it. So the split is recorded as
 * data and this fails when it moves without anybody saying so.
 */
const REPORTS_INSIDE_AN_ESCAPE: Readonly<Record<string, true>> = {
  N620: true,
  N621: true,
  N640: true,
  // Defensible, and the only entry in this table that reads like a decision
  // somebody would make on purpose: a value outside the vocabulary is illegal as
  // WRITTEN, and an escape hatch is a promise to style the subtree by hand, not
  // a licence to feed the resolution table words it does not have.
  N610: true,
  N650: true,
  N690: true,
  N700: true,
  N730: true,
  N740: true,
};

describe('the escape hatch is honoured by some rules and not others', () => {
  const rules = DEFAULT_RULES<string>();

  it('records which, so the split cannot move in silence', () => {
    const reports: string[] = [];
    const exempts: string[] = [];
    const notApplicable: string[] = [];

    for (const seed of SEEDS) {
      const owner = seed.by ?? seed.code;
      const document = seed.document(true);
      const [root, ...rest] = document.nodes;
      if (root === undefined || rest.length > 0 || root.attrs?.['data-escaped'] !== undefined) {
        // No single subtree to opt out, or one that already opted out: reported
        // rather than quietly dropped, because "the transform did not apply" and
        // "the rule said nothing" are the two answers this whole file exists to
        // keep apart.
        notApplicable.push(seed.code);
        continue;
      }
      const escaped = { ...root, attrs: { ...root.attrs, 'data-escaped': 'vendor subtree' } };
      const world = new FakeInspector({ ...document, nodes: [escaped] });
      const spoke = fire(world, rules).filter(
        (found) => found.by === owner && found.finding.code === seed.code,
      );
      (spoke.length > 0 ? reports : exempts).push(owner);
    }

    const unrecorded = reports.filter((code) => REPORTS_INSIDE_AN_ESCAPE[code] !== true);
    const stale = Object.keys(REPORTS_INSIDE_AN_ESCAPE).filter((code) => !reports.includes(code));
    const named = (codes: readonly string[]): string => [...new Set(codes)].join(', ') || 'none';
    console.log(
      `fault seeding inside an escape hatch — exempt the subtree: ${named(exempts)}; ` +
        `report anyway: ${named(reports)}; ` +
        `no single un-escaped subtree to opt out: ${named(notApplicable)}` +
        (stale.length > 0 ? `; DELETE these repaired entries: ${stale.join(', ')}` : ''),
    );
    expect(
      unrecorded,
      'rules reporting inside an escaped subtree without being recorded as doing so — decide the policy, then write it down',
    ).toEqual([]);
    expect(exempts.length).toBeGreaterThan(0);
    expect(reports.length + exempts.length + notApplicable.length).toBe(SEEDS.length);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   The same defects, with the declaration the rule reads unresolvable
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * THE FOURTH OBLIGATION: `raw()` versus `px()`, which is the accessor question
 * one level down from `Box` versus `Bounds`. `px()` coerces an unresolvable
 * property to zero; a zero floor is cleared by every measurement there is; the
 * rule then reports a clean page forever, in silence, with no fixture able to
 * notice. This axis injects the missing declaration and asks what the rule says.
 *
 * There are three answers and only one of them is acceptable. It ADMITS (N680,
 * naming the property), or it REPORTS anyway — which means the property was
 * never load-bearing — or it PASSES, which is the vacuous quiet: the defect is
 * in the document, the rule ran, and it checked nothing.
 *
 * One case per obligation, aimed at a property the rule genuinely reads. This is
 * the suppression discipline the large deployments arrived at — one injection
 * per class, at a node the rule can reach — rather than enumerating every
 * property in every fixture, which is how a harness earns the mute button.
 */
interface Dissolved {
  /** The rule whose reading is being dissolved. */
  readonly code: string;
  /** The node the declaration is removed from. */
  readonly on: string;
  /** The declaration made unresolvable, as the engine leaves it: empty. */
  readonly property: string;
  /** What the rule is recorded as answering. */
  readonly answer: 'admits' | 'passes';
  readonly why: string;
}

const DISSOLVED: readonly Dissolved[] = [
  {
    code: 'N640',
    on: 'greeting',
    property: '--intent-min-contrast',
    answer: 'admits',
    why: 'the floor is read with raw() and an explicit parse, and an unparseable floor is refused rather than coerced to a zero every ratio clears',
  },
  {
    code: 'N650',
    on: 'reply',
    property: '--intent-min-target',
    answer: 'admits',
    why: 'the same reading, arrived at the same way and for the same stated reason — this one only stopped being a silent pass when the floor moved from px() to raw()',
  },
  {
    code: 'N713',
    on: 'columns',
    property: 'column-count',
    answer: 'passes',
    why: 'the multicolumn discriminator maps an unresolvable column-count and column-width onto the same branch as "no multicolumn was requested" and continues, so in an engine that does not resolve them this rule is vacuously silent over the whole document — the shape crushed.ts enumerates its exemptions positively to avoid',
  },
];

function withoutProperty(
  nodes: readonly InspectSpec[],
  on: string,
  property: string,
): readonly InspectSpec[] {
  return nodes.map((node) => {
    if (node.id === on) return { ...node, styles: { ...node.styles, [property]: '' } };
    return node.children ? { ...node, children: withoutProperty(node.children, on, property) } : node;
  });
}

describe('a declaration a rule reads must not be able to silence it', () => {
  const rules = DEFAULT_RULES<string>();

  it('records what each rule answers when the property does not resolve', () => {
    const regressions: string[] = [];
    const stale: string[] = [];
    const observed: string[] = [];

    for (const dissolved of DISSOLVED) {
      const seed = SEEDS.find((candidate) => (candidate.by ?? candidate.code) === dissolved.code);
      expect(seed, `no seed owns ${dissolved.code}`).toBeDefined();
      if (seed === undefined) continue;
      const document = seed.document(true);
      const world = new FakeInspector({
        ...document,
        nodes: withoutProperty(document.nodes, dissolved.on, dissolved.property),
      });
      const spoke = fire(world, rules).filter((found) => found.by === dissolved.code);
      const answer = spoke.some((found) => found.finding.code === dissolved.code)
        ? 'reports'
        : spoke.some((found) => found.finding.code === 'N680')
          ? 'admits'
          : 'passes';
      observed.push(`${dissolved.code} ${answer} without ${dissolved.property}`);
      if (answer === dissolved.answer) continue;
      if (answer === 'admits' && dissolved.answer === 'passes') {
        stale.push(`${dissolved.code}|${dissolved.property}`);
        continue;
      }
      regressions.push(
        `${dissolved.code} ${answer} when ${dissolved.property} does not resolve on ${dissolved.on}, and is recorded as answering ${dissolved.answer} — ${dissolved.why}`,
      );
    }

    console.log(
      `fault seeding with a dissolved declaration: ${observed.join('; ')}` +
        (stale.length > 0 ? `; DELETE these repaired entries: ${stale.join(', ')}` : ''),
    );
    expect(regressions, 'a rule whose verdict changed when a declaration stopped resolving').toEqual(
      [],
    );
    expect(observed.length).toBe(DISSOLVED.length);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   Decoys — the other polarity, where seeding found what nobody was looking for
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A document that carries NO defect of the named class, chosen because it is the
 * shape most likely to look like one. Seeding proves a rule can see; a decoy
 * proves it can decline, and this experiment's own history says the second is
 * the harder half — a rule that cries wolf gets muted, and a muted rule is worth
 * nothing whatever it can see.
 */
interface Decoy {
  readonly code: string;
  readonly subject: string;
  readonly why: string;
  document(): InspectWorldSpec;
  present(world: Inspector<string>): boolean;
}

const DECOYS: readonly Decoy[] = [
  {
    code: 'N650',
    subject: 'icon',
    why: 'a control whose padding box is under the floor and whose BORDER box is exactly on it — the border is pressable, so the claim is satisfied',
    document: () => ({
      nodes: [
        {
          id: 'icon',
          attrs: { 'data-appearance': 'action' },
          text: 'Reply',
          styles: {
            ...READABLE,
            '--intent-min-target': '44px',
            'border-inline-start-width': '1px',
            'border-inline-end-width': '1px',
            'border-block-start-width': '1px',
            'border-block-end-width': '1px',
          },
          box: { inline: 42, block: 42, contentInline: 40 },
        },
      ],
    }),
    present: (world) => {
      const pressable = world.bounds('icon');
      const floor = Number.parseFloat(world.style('icon', '--intent-min-target'));
      return pressable.inline + 0.5 < floor || pressable.block + 0.5 < floor;
    },
  },
  {
    code: 'N690',
    subject: 'stretched',
    why: 'one word on one line box inside an element box two line-heights tall for a reason other than block padding — a stretched row child, a min-height, an inline-block sharing a taller line box',
    document: () => ({
      nodes: [
        {
          id: 'stretched',
          attrs: { 'data-text': 'label' },
          text: 'Reply',
          styles: READABLE,
          box: { inline: 80, block: 36, contentInline: 60 },
          lines: 1,
        },
      ],
    }),
    present: (world) => world.lines('stretched') > words(world.text('stretched')),
  },
];

/**
 * Decoys the rule set is known to fail, each with the reason, keyed
 * `code|subject`.
 *
 * EMPTY, AND IT HAS ALREADY BEEN USED ONCE. When this sweep first ran, the
 * `N690|stretched` decoy fired: N690 derived its line count by dividing an
 * element box, minus the DECLARED block padding, by a line height, so any box
 * taller than its text for any other reason — a stretched row child, a
 * min-block-size, an inline-block sharing a taller line box — read as extra
 * lines. That was the third recurrence of one mistake in one family, in the rule
 * whose own header records the second, and neither the written principle nor the
 * `Box`/`Bounds` split had stopped it: both readings are a `Box`. The rule now
 * calls `lines()` and the decoy is silent, so the entry is deleted and the
 * assertion below is a hard gate rather than a tolerated exception.
 *
 * The mechanism stays because the next one will need it, and its polarity is
 * deliberate: a NEW unsound firing fails this file, while an entry whose defect
 * has since been repaired is printed as stale rather than failed. Every rule
 * belongs to another file, and a harness that goes red the moment somebody fixes
 * what it reported teaches people to delete the harness. Deleting the stale
 * entry is part of the fix, and the printed line names it.
 */
const QUARANTINE: Readonly<Record<string, string>> = {};

describe('decoys — a rule must be able to decline', () => {
  const rules = DEFAULT_RULES<string>();

  it('never fires on a document that does not carry its defect', () => {
    const unsound: string[] = [];
    const stale: string[] = [];
    for (const decoy of DECOYS) {
      const world = new FakeInspector(decoy.document());
      // The decoy is only a decoy while the defect really is absent: a witness
      // that says otherwise means the fixture drifted into a genuine defect and
      // the rule was right to speak.
      expect(decoy.present(world), `${decoy.code} decoy ${decoy.subject} is no longer clean`).toBe(
        false,
      );
      const key = `${decoy.code}|${decoy.subject}`;
      const spoke = fire(world, rules).filter(
        (found) => found.finding.code === decoy.code && found.finding.subject === decoy.subject,
      );
      if (spoke.length === 0) {
        if (QUARANTINE[key] !== undefined) stale.push(key);
        continue;
      }
      if (QUARANTINE[key] !== undefined) continue;
      unsound.push(
        `${decoy.code} fired on ${decoy.subject}, which does not carry its defect (${decoy.why}): ${spoke
          .map((found) => found.finding.detail)
          .join('; ')}`,
      );
    }
    const live = Object.keys(QUARANTINE).filter((key) => !stale.includes(key));
    console.log(
      `fault seeding decoys: ${DECOYS.length} clean look-alikes, ${live.length} known-unsound firing(s) still live` +
        (stale.length > 0
          ? `; DELETE these repaired quarantine entries: ${stale.join(', ')}`
          : ''),
    );
    expect(unsound, 'rules firing on a document that does not carry their defect').toEqual([]);
  });
});
