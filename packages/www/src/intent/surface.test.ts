/**
 * intent/surface.test.ts — THE NO-VALUES GUARD.
 *
 * The claim `@nisli/intent` makes is mechanically checkable, so this checks it:
 * the surfaces authored in the vocabulary contain no pixel value, no colour, no
 * breakpoint, no media query and no class name. Not "we were careful" — grepped.
 *
 * THE EXEMPTIONS ARE NAMED, NOT SKIPPED, and that is the load-bearing part. The
 * prototype's own guard reported that it still matched 120 length and 34 colour
 * literals inside the theme, specifically so it could not pass vacuously. The
 * same standard applies here: every file in `src/intent/**` is classified, the
 * classification is asserted to be TOTAL, and the two categories that are
 * allowed literals are asserted to actually CONTAIN them — so a guard that
 * silently stopped matching anything fails instead of reporting success.
 *
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('.', import.meta.url).pathname;

/**
 * Files authored IN the vocabulary. These carry the claim, and every pattern
 * below is forbidden in them.
 */
const DECLARED = ['surface.ts', 'snippet-row.ts'] as const;

/**
 * The harness: the ONE file allowed a length, because the ruler is an
 * instrument and a width is not a design intent the vocabulary can express.
 */
const HARNESS = ['harness.ts'] as const;

/** The control, and the page chrome. Tailwind by design; this site is Tailwind. */
const CHROME = [
  'tailwind-surface.ts',
  'prose.ts',
  'bodies.ts',
  'checker.ts',
  'recorded.ts',
  'pitch.ts',
  'playground.ts',
  'comparison.ts',
] as const;

/** Neither: no markup at all. */
const NEUTRAL = ['feed.ts', 'island.ts', 'index.ts', 'surface.test.ts'] as const;

/**
 * Patterns applied to CODE ONLY — comments are stripped first. A comment that
 * records a measurement ("the grow region collapsed to 86.3px") is the evidence
 * this project runs on, and a guard that forbade it would forbid the honesty.
 */
const FORBIDDEN: readonly { name: string; re: RegExp }[] = [
  { name: 'length literal', re: /\d(?:\.\d+)?\s*(?:px|rem|em|ch|vh|vw|dvi|cqi|%)\b/ },
  // `(?<!&)` so an HTML character reference (`&#9679;` — the unread dot) is not
  // read as a colour. Found by this guard failing on its first run, which is the
  // only evidence that it is looking at anything.
  { name: 'hex colour', re: /(?<!&)#[0-9a-fA-F]{3,8}\b/ },
  { name: 'media query', re: /@media\b/ },
  { name: 'container query', re: /@container\b/ },
  { name: 'tailwind breakpoint variant', re: /\b(?:sm|md|lg|xl|2xl):[a-z[]/ },
  { name: 'class attribute', re: /\bclass=/ },
  { name: 'style attribute', re: /\bstyle=/ },
];

/** `//` and `/* *\/` removed; template literals and strings are kept. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function read(file: string): string {
  return readFileSync(join(DIR, file), 'utf8');
}

describe('@nisli/intent surfaces: the no-values guard', () => {
  it('classifies every file in src/intent — no file escapes the guard by being forgotten', () => {
    const onDisk = readdirSync(DIR)
      .filter((f) => f.endsWith('.ts'))
      .sort();
    const classified = [...DECLARED, ...HARNESS, ...CHROME, ...NEUTRAL].sort();
    expect(classified).toEqual(onDisk);
  });

  for (const file of DECLARED) {
    it(`${file} contains no value, colour, breakpoint, query or class name`, () => {
      const code = stripComments(read(file));
      for (const { name, re } of FORBIDDEN) {
        const hit = re.exec(code);
        expect(hit === null, `${file} contains a ${name}: ${hit?.[0]}`).toBe(true);
      }
    });
  }

  it('harness.ts is the ONLY declared-side file carrying a number, and it really carries one', () => {
    // Non-vacuity in the honest direction: if the ruler ever stopped carrying a
    // number, this guard would be asserting nothing and reporting success. The
    // numbers live in `RULER_WIDTHS` as bare integers and reach the document
    // through one interpolated `inline-size`, which is why the length-literal
    // pattern above does not match here and this assertion is spelled directly.
    const code = stripComments(read(HARNESS[0]));
    expect(/RULER_WIDTHS[^=]*=\s*\[\s*\d{3,4}/.test(code), 'the ruler has no widths').toBe(true);
    expect(/inline-size:\$\{/.test(code), 'the ruler writes no inline-size').toBe(true);
    // And it is still forbidden a class name, a colour and a breakpoint: the
    // exemption is one pattern wide, not a licence.
    for (const { name, re } of FORBIDDEN) {
      if (name === 'length literal' || name === 'style attribute') continue;
      const hit = re.exec(code);
      expect(hit === null, `harness.ts contains a ${name}: ${hit?.[0]}`).toBe(true);
    }
  });

  it('the Tailwind control really is authored in classes, values and a breakpoint', () => {
    // The control is the other half of non-vacuity. A comparison whose control
    // stopped being a Tailwind surface would make the guard above meaningless.
    const code = stripComments(read('tailwind-surface.ts'));
    expect(/\bclass=/.test(code), 'control has no class attribute').toBe(true);
    expect(/\bsm:inline\b/.test(code), 'control has no viewport breakpoint').toBe(true);
    expect(/\bh-8\b/.test(code), 'control has no hand-picked control height').toBe(true);
  });

  it('the declared surface uses only vocabulary attributes and the four structural ones', () => {
    const source = stripComments(read('surface.ts'));
    const attributes = new Set(
      [...source.matchAll(/(?:^|[\s`])(data-[a-z-]+)/g)].map((m) => m[1]!),
    );
    const ALLOWED = new Set([
      // AXIS_ATTRS
      'data-appearance',
      'data-role',
      'data-text',
      'data-layout',
      'data-align',
      'data-collapse',
      'data-density',
      'data-input',
      'data-theme',
      'data-clip',
      // structural declarations the package documents
      'data-fit',
      'data-grow',
      'data-priority',
      // the overflow affordance contract (theme/states.css)
      'data-overflow',
      'data-overflow-anchor',
      'data-overflow-menu',
      'data-flush',
    ]);
    const unknown = [...attributes].filter((a) => !ALLOWED.has(a));
    expect(unknown, `surface.ts writes attributes outside the contract: ${unknown.join(', ')}`).toEqual([]);
  });
});
