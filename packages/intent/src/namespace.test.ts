/**
 * namespace.test.ts — the theme does not write into a consumer's namespace.
 *
 * `reachability.test.ts` asserts that a rule's selector addresses something
 * that can exist, because a rule matching nothing reports a clean page and
 * nothing distinguishes "no defects" from "no rule". THIS FILE IS THE SAME BUG
 * POINTED OUTWARD: a theme that declares `--radius` addresses something that
 * already exists in somebody else's document, and shadows it.
 *
 * It shipped, and it was measured. Wiring `theme.css` into a Tailwind +
 * shadcn-derived site changed 5,762 computed properties across 9 pages and
 * 3,584 elements, with zero bounding-box changes — the signature of a token
 * collision rather than a layout bug. One declaration did nearly all of it:
 * `* { --radius: calc(var(--unit) * 2) }` = 8px. The site owned `--radius:
 * 0.625rem` = 10px on `:root` and derived its whole ramp from it, so because
 * this package re-declared the name on EVERY element the inherited `:root`
 * value was shadowed everywhere and the ramp collapsed — sm 6→4, md 8→6,
 * lg 10→8, xl 14→12, on buttons, inputs, cards, `pre`, `li`, `a` and `div`.
 * That is every rounded corner on the site, and `--radius` was only the name
 * that site happened to own. `--text`, `--accent`, `--line`, `--danger`,
 * `--link` and `--motion` were all sitting in the same shared namespace
 * waiting for a different consumer.
 *
 * The fix was a mechanical prefix — every property this package declares is
 * `--intent-…` — and the fix is not what this file is for. A rename is a
 * one-time event; the invariant is permanent, and it has to be checked by
 * something other than the memory of the person who did the rename. Three
 * directions, and the second and third are the ones that bite:
 *
 *   1. EVERY DECLARATION IS PREFIXED. The defect itself, refused. A bare
 *      declaration is loud in a consumer's document and silent in this repo,
 *      which is why it needs a test here rather than a code review there.
 *
 *   2. EVERY REFERENCE RESOLVES. This is the dangerous half of a rename and
 *      the reason the guard is not just a lint on the left of the colon. A
 *      `var(--unit)` left behind after `--intent-unit` was declared is not a
 *      fallback to anything: an unresolved `var()` with no fallback is invalid
 *      at computed-value time, so the property becomes unset and the value
 *      QUIETLY DISAPPEARS. No error, no warning, no failing selector — the
 *      exact class this project has recorded eight times, success by silence.
 *      Style queries count as references for the same reason: `@container
 *      style(--density-name: dense)` after the rename is a query that can
 *      never match, and a rule inside it that never applies looks identical to
 *      a rule that had nothing to do.
 *
 *   3. THE TYPESCRIPT HALF READS THE SAME NAMES. `hit-target.ts` resolves its
 *      floor from `--intent-min-target` and skips the element when the floor is
 *      absent, on purpose — a context that declares no floor makes no promise.
 *      So a stale name there does not throw: it reads the empty string, the
 *      floor is 0, `if (!(floor > 0)) continue` fires on every element, and
 *      N650 reports a clean page forever. That is N700 again, in a property
 *      instead of a selector, which is precisely why the check has to quantify
 *      over the string constants and not over the diff.
 *
 * The theme is the AUTHORITY in all three directions: it is the resolution
 * table, it ships in this package (`files`, exported as `./theme.css`), and it
 * is the only thing that gives one of these names a value. A name nothing in
 * `theme/` declares is a name nothing resolves.
 *
 * WHAT THIS FILE DOES NOT COVER, named so it is not mistaken for a proof that
 * the package collides with nothing. A custom property is one of two shared
 * namespaces a theme writes into; the other is ATTRIBUTES, and a collision was
 * measured there too — then fixed somewhere this file cannot see, which is why
 * the paragraph stays rather than being deleted with it.
 *
 * `theme/structure.css` painted `[data-align='start'|'center'|'end'|'between']`
 * bare, and `@nisli/ui` writes those same values as a pure animation and
 * variant hook at 22 call sites. Intent's rule therefore reached elements that
 * never opted into intent, and won the cascade on them, because layers beat
 * specificity and intent's layers are declared after the application's:
 * swept over 92 built pages with scripting disabled, 11 changed properties on 8
 * elements across 3 pages and ZERO changed bounding boxes, blame-tested to zero
 * by stripping those four declarations alone. Zero boxes is this defect class's
 * signature in both namespaces: nothing screenshot-shaped finds it.
 *
 * Prefixing properties did not touch it and no prefix could: an attribute
 * selector is a claim about somebody else's markup rather than about a name
 * this package owns. The fix was to state the rule's real scope —
 * `[data-layout][data-align='…']` — which removes no capability, since both
 * properties it resolves into are inert outside a flex or grid box. The
 * standing consequence for anything added here: this guard quantifies over
 * PROPERTY names and would have stayed green through the whole collision, so a
 * new bare `[data-*]` selector in `theme/` is still unchecked by it.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** `theme/` is a shipped asset one level above `src/`. */
const ROOT = join(import.meta.dirname, '..');
const THEME = join(ROOT, 'theme');
const SRC = import.meta.dirname;

/** The prefix, in one place, because it is the whole claim. */
const PREFIX = '--intent-';

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

/**
 * Comments MUST be stripped before extraction, for the reason `reachability`
 * strips them: this package records the declarations that were wrong. The
 * measured `--radius` finding is written into `tokens.css`, this file's own
 * header quotes `* { --radius: … }`, and a naive scan would fail on the
 * documentation explaining the bug it is checking for. Institutional memory
 * has to stay quotable.
 *
 * CSS has only block comments. `//` is deliberately NOT stripped — it is not a
 * comment in CSS, and stripping it would eat the rest of any line holding a
 * `url(https://…)`.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/** A custom property name, which is the only thing this file is about. */
const NAME = '--[A-Za-z0-9_-]+';
const DECLARED = new RegExp(`(${NAME})\\s*:`, 'g');
const REGISTERED = new RegExp(`@property\\s+(${NAME})`, 'g');
const SUBSTITUTED = new RegExp(`var\\(\\s*(${NAME})`, 'g');
const QUERIED = new RegExp(`style\\(\\s*(${NAME})\\s*:`, 'g');
const ANY = new RegExp(NAME, 'g');

/**
 * An at-rule PRELUDE: everything from the `@` to the brace that opens its body
 * or the semicolon that ends it. Separated from the body because a prelude is
 * the one place `--x:` appears without declaring anything — `@container fitbox
 * style(--intent-density-name: dense)` READS a property in syntax that is
 * indistinguishable from a declaration by shape alone. Treating that as a
 * declaration would let the guard pass on a query nobody can satisfy, which is
 * the failure mode in direction 2.
 */
const PRELUDE = /@[^{;]*[{;]/g;

/**
 * Declarations only, which is the whole distinction this guard turns on. A
 * `var()` reference to a property this package does not declare is a
 * deliberate integration point — a consumer's token, read on purpose. A
 * DECLARATION into that same namespace is the defect. There are no such
 * integration points today, and direction 2 below is what would make one
 * visible rather than accidental.
 *
 * `@property` is included because it declares a custom property too, in a
 * prelude rather than a block. Nothing uses it yet; the day something does,
 * registering a bare `--radius` with an initial value would be the original
 * defect with a stronger claim attached to it, and stripping preludes without
 * reading this back would have hidden it.
 */
function declarationsIn(source: string): string[] {
  const css = code(source);
  const preludes = [...css.matchAll(PRELUDE)].map((match) => match[0]).join('\n');
  return [
    ...[...css.replace(PRELUDE, ' ').matchAll(DECLARED)].map((match) => match[1] as string),
    ...[...preludes.matchAll(REGISTERED)].map((match) => match[1] as string),
  ];
}

/**
 * Every custom property whose VALUE is read: `var()` anywhere, and the
 * property a style query interrogates. Both are unresolvable in exactly the
 * same silent way when a rename misses one.
 */
function referencesIn(source: string): string[] {
  const css = code(source);
  const preludes = [...css.matchAll(PRELUDE)].map((match) => match[0]).join('\n');
  return [
    ...[...css.matchAll(SUBSTITUTED)].map((match) => match[1] as string),
    ...[...preludes.matchAll(QUERIED)].map((match) => match[1] as string),
  ];
}

/** Any custom-property name appearing in shipped TypeScript, comments aside. */
function namesIn(source: string): string[] {
  const ts = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  return [...ts.matchAll(ANY)].map((match) => match[0]);
}

interface Site {
  readonly file: string;
  readonly name: string;
}

function sites(
  files: readonly string[],
  extract: (source: string) => string[],
  from: number,
): Site[] {
  return files.flatMap((file) =>
    extract(readFileSync(file, 'utf8')).map((name) => ({ file: file.slice(from + 1), name })),
  );
}

const themeFiles = filesUnder(THEME).filter((file) => file.endsWith('.css'));
const tsFiles = filesUnder(SRC).filter((file) => file.endsWith('.ts'));

/**
 * THIS FILE IS EXEMPT FROM DIRECTION 3, and it is the only one. Every other
 * file's `--…` literal is a name it expects the theme to resolve; this file's
 * are the negative controls of the falsification block below — `--radius`,
 * `--shadcn-radius` and `--density-name` are here precisely BECAUSE the theme
 * must not declare them. Scanning them would make the guard fail on its own
 * test fixtures, which is the same hazard as scanning comments, one level up.
 *
 * Held to exactly one file so the exemption cannot grow in silence, and
 * self-correcting if this file is renamed: the exclusion stops matching, the
 * count assertion fails, and nobody has to remember.
 */
const SELF = 'namespace.test.ts';
const scanned = tsFiles.filter((file) => !file.endsWith(SELF));

const declared = sites(themeFiles, declarationsIn, ROOT.length);
const referenced = sites(themeFiles, referencesIn, ROOT.length);
const read = sites(scanned, namesIn, SRC.length);

/** The set every other direction is judged against. */
const NAMES: ReadonlySet<string> = new Set(declared.map((site) => site.name));

describe('the theme declares nothing into a consumer namespace', () => {
  it('finds declarations to check at all, so this guard cannot pass vacuously', () => {
    // A guard that quietly stops finding anything is the failure mode it exists
    // to catch, and this package has recorded that three times. The counts are
    // printed rather than only asserted, because "31 names, 77 declarations"
    // read out loud is what makes a reviewer notice the day it says 3.
    console.log(
      `namespace guard: ${declared.length} declarations of ${NAMES.size} distinct properties, ` +
        `${referenced.length} references across ${themeFiles.length} theme files, ` +
        `${read.length} names read from ${scanned.length} TypeScript files`,
    );
    expect(themeFiles.length).toBeGreaterThanOrEqual(4);
    expect(declared.length).toBeGreaterThan(60);
    expect(NAMES.size).toBeGreaterThan(25);
    expect(referenced.length).toBeGreaterThan(100);
    expect(read.length).toBeGreaterThan(5);
    // The blind spot, capped: exactly this file is exempt from direction 3.
    expect(tsFiles.length - scanned.length).toBe(1);
  });

  it('declares every custom property under the --intent- prefix', () => {
    const bare = declared
      .filter((site) => !site.name.startsWith(PREFIX))
      .map(
        (site) =>
          `${site.file} declares ${site.name}, a name the consumer's document may already own`,
      );
    expect(bare).toEqual([]);
  });

  it('would have caught the measured --radius collision', () => {
    // The regression this file exists for, asserted directly rather than
    // trusted: the site's ramp collapsed because this name was declared on the
    // universal selector. Held in both directions so it cannot go stale by the
    // property simply disappearing.
    expect(NAMES.has('--radius')).toBe(false);
    expect(NAMES.has('--intent-radius')).toBe(true);
  });

  it('keeps the six universal-selector properties namespaced', () => {
    // These are the acute half: declared on `*`, so they beat an inherited
    // `:root` value on every element in the document rather than racing it on
    // document order. Named individually because "all of them are prefixed" is
    // also true of an empty set.
    for (const name of [
      '--intent-unit',
      '--intent-text',
      '--intent-text-meta',
      '--intent-text-title',
      '--intent-text-display',
      '--intent-radius',
    ]) {
      expect(NAMES.has(name)).toBe(true);
    }
  });
});

describe('every reference resolves to something the theme declares', () => {
  it('references only properties this theme declares', () => {
    const dangling = referenced
      .filter((site) => !NAMES.has(site.name))
      .map(
        (site) =>
          `${site.file} reads ${site.name}, which nothing in theme/ declares — an unresolved ` +
          `var() is invalid at computed-value time, so the value disappears silently`,
      );
    expect(dangling).toEqual([]);
  });

  it('reads the density axis by a name the axis actually sets', () => {
    // The one style query in the package, called out because a query is the
    // quietest possible place for a stale name: it matches nothing, the rules
    // inside it never apply, and that is indistinguishable from a context
    // where they had nothing to do.
    expect(referenced.map((site) => site.name)).toContain('--intent-density-name');
  });
});

describe('the TypeScript half reads the names the theme declares', () => {
  it('names only properties this theme declares', () => {
    const stale = read
      .filter((site) => !NAMES.has(site.name))
      .map(
        (site) =>
          `src/${site.file} names ${site.name}, which nothing in theme/ declares — ` +
          `getPropertyValue returns the empty string and the rule reports a clean page`,
      );
    expect(stale).toEqual([]);
  });

  it('still resolves the floor N650 is about', () => {
    // Held explicitly because this is the read whose stale form is silent
    // rather than wrong: no floor means "this context makes no promise", so a
    // renamed-away `--min-target` retires the rule instead of breaking it.
    expect(read.some((site) => site.name === '--intent-min-target')).toBe(true);
  });
});

/**
 * The guard, falsified. Both directions on synthetic sources, so the claim is
 * that the extractor DISTINGUISHES the defect rather than that today's files
 * happen to pass — a check that cannot fail is the thing this file is about.
 */
describe('the extractor separates the defect from its documentation', () => {
  it('fails a bare declaration and passes the prefixed one', () => {
    const bare = '* { --radius: calc(var(--intent-unit) * 2); }';
    expect(declarationsIn(bare).filter((name) => !name.startsWith(PREFIX))).toEqual(['--radius']);

    const prefixed = '* { --intent-radius: calc(var(--intent-unit) * 2); }';
    expect(declarationsIn(prefixed).filter((name) => !name.startsWith(PREFIX))).toEqual([]);
    expect(declarationsIn(prefixed)).toEqual(['--intent-radius']);
  });

  it('does not mistake a reference for a declaration', () => {
    // Reading a consumer's token would be an integration point, not a defect.
    const source = '[data-appearance] { border-radius: var(--shadcn-radius, 8px); }';
    expect(declarationsIn(source)).toEqual([]);
    expect(referencesIn(source)).toEqual(['--shadcn-radius']);
  });

  it('does not read a declaration out of its own history', () => {
    const source = '/* was `* { --radius: 8px }`, which shadowed the site. */\n:root { }';
    expect(declarationsIn(source)).toEqual([]);
  });

  it('sees a declaration registered by @property', () => {
    const source = '@property --radius { syntax: "<length>"; inherits: true; initial-value: 8px; }';
    expect(declarationsIn(source)).toEqual(['--radius']);
  });

  it('sees the property a style query interrogates, and does not call it a declaration', () => {
    const source = '@container fitbox style(--density-name: dense) { a { color: red; } }';
    expect(referencesIn(source)).toEqual(['--density-name']);
    expect(declarationsIn(source)).toEqual([]);
  });

  it('does not mistake an ordinary CSS property for a custom one', () => {
    // `shredded.ts` reads `line-height`, which is a real property and stays
    // exactly as it is; only the `--`-prefixed half is this guard's business.
    expect(declarationsIn('a { line-height: 1.3; margin: 0; }')).toEqual([]);
    expect(namesIn("el.raw('line-height')")).toEqual([]);
  });
});
