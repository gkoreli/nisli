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
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT "PRODUCES" MEANS IN A LIBRARY, AND WHAT THIS GUARD CAN NO LONGER SEE.
 * ══════════════════════════════════════════════════════════════════════════
 * In the prototype the producers were the components, the pages, the theme and
 * the solver — an app, so the whole world that could ever write a declaration
 * was in one tree and the guard could quantify over all of it. This is a
 * library. Components and pages belong to a consumer under ADR 0032 §3, and a
 * library cannot enumerate its consumers. Dropping those two roots and keeping
 * the same sentence would make the guard QUIETER WITHOUT MAKING IT TRUER,
 * which is the exact failure mode it exists to catch, one level up.
 *
 * So the definition changes rather than the scope shrinking. THE AUTHORITY ON
 * WHETHER A DECLARATION EXISTS IS NO LONGER WHOEVER WRITES THE MARKUP; IT IS
 * THE RESOLUTION TABLE THAT RESOLVES IT, PLUS THE MUTATOR THAT STAMPS IT.
 * `theme/` and `src/fit/` both ship in this package, both are readable from
 * here, and between them they are the complete set of things that give a
 * declaration meaning:
 *
 *   - an attribute the table does not resolve produces no value, so a rule
 *     selecting it is judging appearance nothing derived;
 *   - an attribute the mutator does not stamp and the table does not resolve
 *     is not part of this engine's contract with anyone.
 *
 * That is a STRICTLY STRONGER claim than the prototype's, and worth saying
 * plainly because "smaller producer set" reads like a weakening. The old guard
 * accepted an attribute because some component wrote it, whether or not the
 * table did anything with it. This one does not: a rule may only select what
 * the engine itself gives meaning to.
 *
 * THE BLIND SPOT, NAMED. What genuinely goes away is the VALUE side of any
 * attribute no axis enumerates. `AXIS_ATTRS` values are still fully checked —
 * `VOCABULARY` travels with the package — but a value written only by a
 * consumer cannot be verified against anything, because the thing that would
 * produce it is not in this tree and never will be. There is exactly one such
 * value in the rule set today; `CONSUMER_WRITTEN` below names it, holds it in
 * both directions so it cannot go stale, and caps its own size so the blind
 * spot cannot grow in silence.
 *
 * WHAT SURVIVES INTACT is the thing this file was written for. `data-surface`
 * is nowhere in `theme/` or `src/fit/`, so a rule selecting it still fails
 * here, exactly as it did in the app — asserted directly in "would have caught
 * the N700 defect" below rather than assumed.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AXIS_ATTRS, VOCABULARY } from '../contracts.js';

/**
 * The package root, because one producer (`theme/`) is a shipped asset outside
 * `src/` — it is listed in `files` and exported as `./theme.css`.
 */
const ROOT = join(import.meta.dirname, '..', '..');
const SRC = join(ROOT, 'src');
const RULES = join(SRC, 'diagnostics', 'rules');

/**
 * The seam, scanned as if it were a rule, because it now holds a selector on
 * behalf of all thirteen measuring rules.
 *
 * `[data-escaped]` used to be spelled in six rule files and is now spelled once
 * in `observe.ts`, which is the whole point of that change — and it moved the
 * selector out of the only directory this guard reads. The blast radius went the
 * wrong way at the same time: a typo in one rule used to cost that rule its
 * exemption, and a typo here costs thirteen rules theirs, silently, in the
 * direction that reports defects inside subtrees the author took back. So the
 * file is added to the scanned set rather than trusted. `uses()` strips comments
 * before extracting, which matters more here than in `rules/`: this file's
 * header quotes the attribute several times while explaining it.
 */
const SEAM = join(SRC, 'diagnostics', 'observe.ts');

/**
 * Everything in this package that gives a declaration meaning: the resolution
 * table that resolves it, and the fit engine that stamps it. See the header for
 * why this is the whole set inside a library and why it is not a weakening.
 */
const PRODUCERS = [join(ROOT, 'theme'), join(SRC, 'fit')];

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

/**
 * Every selector use under `roots`, which may name a directory or a single
 * file. The seam is one file among the rules' directory, and a guard that could
 * only be pointed at a directory would have invited moving the seam into
 * `rules/` — where it does not belong — to stay covered.
 */
function uses(...roots: string[]): Use[] {
  return roots
    .flatMap((root) => (root.endsWith('.ts') ? [root] : filesUnder(root)))
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .flatMap((file) =>
      [...code(readFileSync(file, 'utf8')).matchAll(ATTR)].map((match) => ({
        file: file.slice(SRC.length + 1),
        attr: match[1] as string,
        value: match[2],
      })),
    );
}

/**
 * Attribute names anywhere the engine gives a declaration meaning — the
 * resolution table and the fit mutator — in selector syntax or not.
 */
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

/**
 * Every producing file's source, concatenated, for the one question the
 * attribute set cannot answer: is a VALUE real?
 *
 * Needed because `AXIS_ATTRS` does not enumerate every attribute a rule
 * selects. `data-fit` is stamped by the mutator and carries `unsatisfiable`,
 * which is a `FitState` and not a vocabulary value, so the axis check skips it
 * entirely — and a rule selecting `[data-fit="unsatisfiible"]` would be as
 * dead as N700 was and as silent. Searching the producing half for the literal
 * is the same reachability argument as the attribute check, one level down,
 * and it is decidable for everything this package writes itself.
 */
function producedSource(): string {
  const parts: string[] = [];
  for (const dir of PRODUCERS) {
    for (const file of filesUnder(dir)) {
      if (file.endsWith('.test.ts')) continue;
      parts.push(readFileSync(file, 'utf8'));
    }
  }
  return parts.join('\n');
}

describe('rule selectors are reachable', () => {
  const ruleUses = uses(RULES, SEAM);
  const produced = producedAttributes();

  it('finds selectors to check at all, so this guard cannot pass vacuously', () => {
    // A guard that silently stops finding anything is the same failure mode it
    // exists to catch. If the extractor breaks, this is the assertion that says
    // so rather than reporting universal success.
    expect(ruleUses.length).toBeGreaterThan(10);
    expect(produced.size).toBeGreaterThan(5);
  });

  it('covers the one selector the seam holds for every measuring rule', () => {
    // Widening a scanned root is invisible if nothing from the new root is ever
    // extracted, which is this file's own failure mode. So the moved selector
    // is named: the escape hatch must be reached from the seam, and it must be
    // an attribute the engine gives meaning to like any other.
    const fromSeam = ruleUses.filter((use) => use.file.endsWith('observe.ts'));
    expect(fromSeam.map((use) => use.attr)).toContain('data-escaped');
    expect(produced.has('data-escaped')).toBe(true);
  });

  it('selects only attributes this engine gives meaning to', () => {
    const unreachable = ruleUses
      .filter((use) => !produced.has(use.attr))
      .map(
        (use) =>
          `${use.file} selects [${use.attr}], which neither the resolution table resolves nor the fit engine stamps`,
      );
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
    // trusted: `data-surface` is a word the vocabulary does not contain, so
    // nothing in the table resolves it and a rule selecting it is unreachable.
    // This assertion is the reason the producer set could be redefined rather
    // than merely shrunk — the original catch still fires.
    expect(produced.has('data-surface')).toBe(false);
    expect(produced.has('data-appearance')).toBe(true);
  });
});

/**
 * VALUES OF ATTRIBUTES NO AXIS ENUMERATES — the direction the library move
 * both forced and made possible.
 *
 * `AXIS_ATTRS` does not cover every attribute a rule selects, and the ones it
 * misses are the engine's own: `data-fit` is stamped by the mutator and carries
 * a `FitState`, not a vocabulary value. So the axis check above skips
 * `[data-fit="unsatisfiable"]` entirely, and a rule that misspelled it would be
 * exactly as dead as N700 was and exactly as silent. In the app that gap was
 * covered by nothing; the app was simply large enough that nobody noticed.
 *
 * It is coverable here because the producing half is small, self-contained and
 * readable: the value has to stand as its own token somewhere in the resolution
 * table or the fit engine, which is the same reachability argument as the
 * attribute check one level down. Redefining PRODUCERS is what made this cheap
 * — there are two roots to search and both ship in the package.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * AND THIS IS WHERE THE REMAINING BLIND SPOT IS, so it is stated at the place
 * that would otherwise be mistaken for closing it.
 * ══════════════════════════════════════════════════════════════════════════
 * The guard proves the ENGINE gives a selector meaning. It cannot prove any
 * CONSUMER ever writes it, because a library has no consumers to read. Those
 * were the same question in the app and they are not the same question here.
 *
 * The live example is in this very rule set, and it passes: N700 scopes on
 * `[data-component="app-region"]`. Both halves are reachable — the table
 * addresses `[data-component]` and names `app-region` among the hosts it makes
 * layout-transparent — so the engine plainly gives that selector meaning. No
 * component in this repository renders one, because ADR 0032 §3 puts components
 * in a copy-in registry the consumer owns. That limb is therefore live by this
 * guard's reckoning and dead in practice until a consumer declares such a
 * component, and NOTHING INSIDE THIS PACKAGE CAN TELL THE DIFFERENCE.
 *
 * The consequence is worth stating plainly rather than filing as a caveat: this
 * guard has stopped being able to catch the N700 defect in its ORIGINAL form —
 * a rule that matches nothing on a running page. It catches the form it can
 * still decide — a rule that names something the engine never gives meaning to
 * — which is where the N700 selector's actual mistake lived. Catching the
 * original form needs elements, so it belongs to the same missing home as class
 * D: a consumer's rendered DOM, or the prototype's proof scripts.
 */
describe('values outside the vocabulary are reachable too', () => {
  const ruleUses = uses(RULES, SEAM);
  const source = producedSource();

  /**
   * A bare `includes` would let `end` match `legend`. The value has to stand
   * alone in the source the way it stands alone in an attribute.
   */
  const stands = (value: string): boolean =>
    new RegExp(`(?<![\\w-])${value}(?![\\w-])`).test(source);

  it('selects only unenumerated values the engine itself writes', () => {
    const unreachable = ruleUses
      .filter((use) => use.value !== undefined && !(use.attr in AXIS_ATTRS))
      .filter((use) => !stands(use.value as string))
      .map(
        (use) =>
          `${use.file} selects [${use.attr}="${use.value}"], no axis enumerates ${use.attr}, and nothing in the resolution table or the fit engine writes that value — the N700 shape one level down`,
      );
    expect(unreachable).toEqual([]);
  });

  it('finds unenumerated values to check at all', () => {
    // Two today: `unsatisfiable` and `app-region`. If this reaches zero the
    // check above is passing over nothing, which reads identically to passing.
    const checked = ruleUses.filter(
      (use) => use.value !== undefined && !(use.attr in AXIS_ATTRS),
    );
    expect(checked.length).toBeGreaterThan(0);
  });

  it('can tell a real value from a typo', () => {
    // The check only means something if the search discriminates. A pattern
    // that matched everything would report universal reachability, which is
    // this file's own failure mode wearing a different hat.
    expect(stands('unsatisfiable')).toBe(true);
    expect(stands('unsatisfiible')).toBe(false);
    expect(stands('data-surface')).toBe(false);
  });
});

/**
 * The vocabulary is the DENOMINATOR of the third reachability direction, and
 * that direction does not live here — it lives in the prototype's
 * `experiments/c11-appearance/proof/declaration-guard.mjs` as class D, which
 * asks the live DOM whether every legal value is carried by an element in some
 * exercised context.
 *
 * WHERE IT LIVES NOW IS ITSELF AN OPEN ITEM. Class D needs rendered elements,
 * and a library renders none: the demo it swept was the prototype's four pages.
 * So the third direction currently has no home inside this package, and the
 * committed evidence for it is the prototype run rather than a gate here. That
 * is a gap, not a claim — the assertions below hold the SEAM class D reads to
 * its side of the bargain regardless of who eventually runs it.
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

  it('is resolved by something, so the values have somewhere to land', () => {
    // In an app this asked whether a component wrote the attribute. Here it
    // asks whether the resolution table resolves it or the fit engine stamps
    // it, which is the stronger question: an axis nothing resolves is a set of
    // legal values that derive no appearance at all.
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
 * this package's public seam, so whether the first two SHOULD become axes is a
 * decision recorded here rather than taken here.
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
