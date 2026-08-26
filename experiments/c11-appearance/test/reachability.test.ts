/**
 * reachability.test.ts — the framework checks the checker.
 *
 * A rule can fail in two ways. It can report a defect that is not there, which
 * is loud: someone reads the finding, disagrees, and the oracle gets fixed or
 * muted. Or it can select something that cannot exist, which is SILENT — it
 * reports nothing, and nothing distinguishes "no defects" from "no rule".
 *
 * N700 shipped in the second state. Its scope selector said `[data-surface]`
 * while the vocabulary spells a surface `[data-appearance="surface"]`, so it
 * matched no surfaces at all and reported a clean page. Every existing safety
 * net agreed with it:
 *
 *   - the unit tests passed, because the fixtures were invented from the same
 *     wrong assumption as the selector, so they were consistent with each other
 *     and wrong together;
 *   - the 240-cell browser matrix passed, because a rule that matches nothing
 *     produces no findings, which is exactly what a clean page produces;
 *   - `tsc` passed, because a selector is a string.
 *
 * It surfaced only when a human asked the live DOM how many elements the
 * selector matched. That is not a net. This file is the net.
 *
 * The check is a reachability argument, not a style rule: every attribute a
 * rule selects on must be an attribute this codebase actually PRODUCES, and
 * every value it selects for must be one the axis actually ALLOWS. Both halves
 * are decidable from source, so this costs milliseconds and no browser.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AXIS_ATTRS, VOCABULARY } from '../src/appearance/contracts.js';

const SRC = join(import.meta.dirname, '..', 'src');
const RULES = join(SRC, 'appearance', 'diagnostics', 'rules');

/** Everything that WRITES declarations: components, theme, pages, the solver. */
const PRODUCERS = [
  join(SRC, 'ui'),
  join(SRC, 'theme'),
  join(SRC, 'app'),
  join(SRC, 'appearance', 'fit'),
];

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

/**
 * Comments MUST be stripped before extraction, and this is not a nicety: the
 * rule files deliberately record the selectors that were wrong, so a naive scan
 * would read `[data-surface]` out of the very comment explaining that
 * `[data-surface]` does not exist, and the guard would fail on its own
 * documentation. Institutional memory has to stay quotable.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

const ATTR = /\[(data-[a-z-]+)(?:="([^"]*)")?\]/g;

interface Use {
  readonly file: string;
  readonly attr: string;
  readonly value?: string;
}

function uses(dir: string): Use[] {
  return filesUnder(dir)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .flatMap((file) =>
      [...code(readFileSync(file, 'utf8')).matchAll(ATTR)].map((match) => ({
        file: file.slice(SRC.length + 1),
        attr: match[1] as string,
        value: match[2],
      })),
    );
}

/** Attribute names anywhere in the producing half, selector syntax or not. */
function producedAttributes(): ReadonlySet<string> {
  const found = new Set<string>();
  for (const dir of PRODUCERS) {
    for (const file of filesUnder(dir)) {
      if (file.endsWith('.test.ts')) continue;
      // Cannot end in a dash, so `data-table-caption-${id}` yields the
      // attribute and not a fragment of the template that built it.
      for (const match of readFileSync(file, 'utf8').matchAll(/data-[a-z]+(?:-[a-z]+)*/g)) {
        found.add(match[0]);
      }
    }
  }
  return found;
}

describe('rule selectors are reachable', () => {
  const ruleUses = uses(RULES);
  const produced = producedAttributes();

  it('finds selectors to check at all, so this guard cannot pass vacuously', () => {
    // A guard that silently stops finding anything is the same failure mode it
    // exists to catch. If the extractor breaks, this is the assertion that says
    // so rather than reporting universal success.
    expect(ruleUses.length).toBeGreaterThan(10);
    expect(produced.size).toBeGreaterThan(5);
  });

  it('selects only attributes this codebase actually produces', () => {
    const unreachable = ruleUses
      .filter((use) => !produced.has(use.attr))
      .map((use) => `${use.file} selects [${use.attr}], which nothing writes`);
    expect(unreachable).toEqual([]);
  });

  it('selects only values the vocabulary allows on that axis', () => {
    const illegal: string[] = [];
    for (const use of ruleUses) {
      const axis = AXIS_ATTRS[use.attr as keyof typeof AXIS_ATTRS];
      if (axis === undefined || use.value === undefined) continue;
      const legal: readonly string[] = VOCABULARY[axis];
      if (legal.includes(use.value)) continue;
      illegal.push(
        `${use.file} selects [${use.attr}="${use.value}"], but ${axis} allows ${legal.join('|')}`,
      );
    }
    expect(illegal).toEqual([]);
  });

  it('would have caught the N700 defect', () => {
    // The regression this file exists for, asserted directly rather than
    // trusted: `data-surface` is not a declaration anything writes, so a rule
    // selecting it is unreachable and must be reported as such.
    expect(produced.has('data-surface')).toBe(false);
    expect(produced.has('data-appearance')).toBe(true);
  });
});

/**
 * The vocabulary is the DENOMINATOR of the third reachability direction, and
 * that direction does not live here — it lives in `proof/declaration-guard.mjs`
 * as class D, which asks the live DOM whether every legal value is carried by
 * an element in some exercised context.
 *
 * WHY NOT HERE. This file could grep the pages for each value in milliseconds
 * with no browser, and it would be answering a weaker question. The components
 * write `data-layout=${layout}`, so which value reaches an element is decided
 * at runtime by a page, a prop default, a computed or the solver; a grep finds
 * the spelling in whichever module mentions it and cannot tell a branch that
 * renders from a branch that never runs. "A rule has had a chance to run
 * against this value" is a claim about elements that existed, so the DOM is the
 * box that claim is about — and a check must measure the box its claim is
 * about. Two homes for one claim is worse than one: the cheap one gets trusted.
 *
 * WHAT DOES BELONG HERE is everything about the vocabulary that is decidable
 * from source and that class D's numbers depend on. Class D can only be as
 * complete as the seam it reads, so this is where the seam is held to it.
 */
describe('the vocabulary can be exercised at all', () => {
  const produced = producedAttributes();
  const axes = Object.keys(VOCABULARY);
  const addressed: string[] = Object.values(AXIS_ATTRS);

  it('addresses every axis with exactly one attribute, and no attribute twice', () => {
    // An axis no attribute addresses is a set of values that cannot be written
    // and therefore cannot be exercised, which would make class D's count a
    // number about nothing. Two attributes on one axis would double-count it.
    expect([...addressed].sort()).toEqual([...axes].sort());
    expect(new Set(addressed).size).toBe(addressed.length);
  });

  it('is written by something, so the values have somewhere to land', () => {
    const orphans = Object.keys(AXIS_ATTRS).filter((attr) => !produced.has(attr));
    expect(orphans).toEqual([]);
  });

  it('keeps a denominator that cannot silently shrink', () => {
    // Class D reports "N values checked, M found". Deleting an axis or a value
    // makes it quieter, and a quieter guard reads exactly like a healthier
    // codebase — the failure mode the guard exists to catch, one level up. A
    // deliberate shrink edits these floors and says why; an accidental one
    // fails here.
    const values = axes.flatMap((axis) => VOCABULARY[axis as keyof typeof VOCABULARY]);
    expect(axes.length).toBeGreaterThanOrEqual(8);
    expect(values.length).toBeGreaterThanOrEqual(25);
  });
});

/**
 * Declarations whose VALUES no axis enumerates. Class D is structurally unable
 * to say anything about these, so naming them is the difference between an
 * honest denominator and a count that implies coverage it does not have. Two of
 * the four selectors the demo has never exercised are exactly here — `wrap` is
 * a `VOCABULARY.layout` value and class D fails on it, while `data-align`'s
 * `start` and `end` are outside every claim class D makes.
 *
 * Checked in both directions, because an unstated blind spot and a stale one
 * are the same defect: each entry must still be produced, and must still be
 * outside `AXIS_ATTRS`. Giving one of them an axis therefore FAILS this test,
 * and the fix is to delete the entry — which is the point. `contracts.ts` is
 * the frozen seam, so whether the first two SHOULD become axes is a decision
 * recorded here rather than taken here.
 */
const UNENUMERATED = [
  {
    attr: 'data-fit',
    why: 'written by the solver rather than an author, so it is deliberately outside the author vocabulary — and equally outside class D. Enumerating it would invite an author to write it.',
  },
  {
    attr: 'data-truncate',
    why: 'the mutator stamps it to record a spent degradation; an illegal value would be a bug in the solver rather than a mistake an author can make',
  },
  {
    attr: 'data-component',
    why: 'written by the component factory from the tag name, so its value space is the registry rather than a vocabulary axis',
  },
];

/*
 * DELETED ON 2026-08-25, and the deletion is the record: `data-align` and
 * `data-clip` were listed here as author-facing declarations that no axis
 * enumerated. That was a real gap — N610 checks values against `VOCABULARY`, so
 * a word with no axis could not be checked against anything and
 * `data-align="stat"` silently did nothing. It is the N700 dead-selector class
 * on the AUTHOR's side of the seam. Both now have axes (`align`, `clip`), this
 * test failed because the entries had gone false, and honouring it rather than
 * relaxing it is the whole reason it was written in both directions.
 */

describe('the vocabulary states what it does not cover', () => {
  const produced = producedAttributes();

  it('names every value-bearing declaration that no axis enumerates', () => {
    const stale = UNENUMERATED.filter((entry) => !produced.has(entry.attr)).map(
      (entry) => `${entry.attr} is named as unenumerated but nothing writes it`,
    );
    const covered = UNENUMERATED.filter((entry) => entry.attr in AXIS_ATTRS).map(
      (entry) => `${entry.attr} now has an axis, so delete this entry: ${entry.why}`,
    );
    expect([...stale, ...covered]).toEqual([]);
  });

  it('is not an empty gesture', () => {
    // If this list ever empties legitimately, the assertion below is what makes
    // somebody delete the suite rather than leave a check over nothing.
    expect(UNENUMERATED.length).toBeGreaterThan(0);
    expect(UNENUMERATED.every((entry) => entry.why.length > 20)).toBe(true);
  });
});
