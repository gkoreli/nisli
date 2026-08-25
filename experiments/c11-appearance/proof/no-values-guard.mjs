#!/usr/bin/env node
/**
 * no-values-guard.mjs — the exclusivity invariant, as a script.
 *
 * The claim this experiment makes is not "the components are tidy". It is that
 * a component author CANNOT make an appearance decision, because no channel
 * exists through which to make one. That claim is only true while:
 *
 *   1. no length, colour or media query exists outside `src/theme/**`;
 *   2. no `className` and no `size` prop exists in `src/ui/**`;
 *   3. `src/theme/**` itself contains no width breakpoint.
 *
 * A README sentence saying so decays in a week. This does not.
 *
 *   node proof/no-values-guard.mjs
 *
 * Exits non-zero on the first violation found, listing every one of them.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Where appearance decisions are forbidden. */
const SCANNED = ['src/ui', 'src/app', 'src/appearance'];

/** The one place any number, colour or radius is allowed to exist. */
const THEME = 'src/theme';

/**
 * The complete allowlist. Two entries, both deliberate, both documented — the
 * moment this list grows a third the bet needs re-arguing, not a new entry.
 */
const ALLOWLIST = [
  {
    file: 'src/ui/primitives/escaped.ts',
    lines: 'all',
    why: 'the escape hatch. It exists to be raw, is outlined in the UI, and reports itself as N601 (F7).',
  },
  {
    file: 'src/app/state.ts',
    lines: 'comments',
    why: 'the harness viewport widths, named in comments as harness geometry rather than styling.',
  },
];

const VALUE_RULES = [
  {
    name: 'length',
    pattern: /(?<![\w.$])\d*\.?\d+(?:px|rem|em|vw|vh|vmin|vmax|ch|ex|pt|pc|cm|mm|in)\b/g,
    why: 'a length literal. Every length is derived from the one inherited --unit, in the theme.',
  },
  {
    name: 'colour',
    pattern: /#[0-9a-fA-F]{3,8}\b/g,
    why: 'a colour literal. Colour is resolved by the theme as a function of the context axes.',
  },
  {
    name: 'media',
    pattern: /@media\b/g,
    why: 'a media query. Appearance adapts through declared meaning and measured fit, not breakpoints.',
  },
];

const UI_RULES = [
  {
    name: 'className',
    pattern: /(?<![\w.$])className\b/g,
    why: 'a className channel. One exists and the caller can style anything; the exclusivity claim is over.',
  },
  {
    name: 'size prop',
    pattern: /(?<![\w.$])size\s*[?:,)]/g,
    why: 'a size prop. Size is derived from role and context; a prop makes it an authoring decision again.',
  },
  {
    name: 'class attribute',
    pattern: /(?<![\w.$-])class\s*=/g,
    why: 'a class attribute in a template — the same escape channel as a className prop, spelled differently.',
  },
];

/** A width breakpoint hiding in the theme would be the bet quietly conceded. */
const BREAKPOINT = /@media[^{]*\b(?:min-width|max-width|inline-size|width)\b/g;

/* ══════════════════════════════════════════════════════════════════════════ */

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort();
}

const COMMENT = /^\s*(?:\/\/|\/\*|\*)/;

function allowanceFor(relative) {
  return ALLOWLIST.find((entry) => entry.file === relative);
}

function scan(relative, source, rules, { codeOnly = false } = {}) {
  const allowance = allowanceFor(relative);
  if (allowance?.lines === 'all') return [];
  const violations = [];
  const lines = source.split('\n');
  for (const [index, line] of lines.entries()) {
    if (allowance?.lines === 'comments' && COMMENT.test(line)) continue;
    // A value in a comment is a value on its way into code, so those are
    // scanned. A PROP, by contrast, only exists in code: a doc comment that
    // says "there is no className prop" must not be the thing that fails the
    // guard asserting there is no className prop.
    if (codeOnly && COMMENT.test(line)) continue;
    for (const rule of rules) {
      rule.pattern.lastIndex = 0;
      let match;
      while ((match = rule.pattern.exec(line)) !== null) {
        violations.push({
          file: relative,
          line: index + 1,
          column: match.index + 1,
          rule: rule.name,
          text: match[0],
          why: rule.why,
          source: line.trim(),
        });
      }
    }
  }
  return violations;
}

function countMatches(source, pattern) {
  pattern.lastIndex = 0;
  let total = 0;
  while (pattern.exec(source) !== null) total += 1;
  return total;
}

/* ══════════════════════════════════════════════════════════════════════════ */

const violations = [];
const scannedFiles = [];
const missingRoots = [];

for (const root of SCANNED) {
  const files = await walk(path.join(ROOT, root));
  if (files.length === 0) missingRoots.push(root);
  for (const file of files) {
    const relative = path.relative(ROOT, file);
    const source = await readFile(file, 'utf8');
    scannedFiles.push(relative);
    violations.push(...scan(relative, source, VALUE_RULES));
    if (relative.startsWith(`src${path.sep}ui${path.sep}`)) {
      violations.push(...scan(relative, source, UI_RULES, { codeOnly: true }));
    }
  }
}

/* ── the guard on the guard ────────────────────────────────────────────────
   A scan that matches nothing because it looked nowhere is a false PASS, and
   this repository has three of those on record. So: the roots must exist, and
   the value patterns must demonstrably still match real values — in the one
   place values are supposed to live. */

const themeFiles = await walk(path.join(ROOT, THEME));
let themeLengths = 0;
let themeColours = 0;
const breakpoints = [];
for (const file of themeFiles) {
  const relative = path.relative(ROOT, file);
  const source = await readFile(file, 'utf8');
  themeLengths += countMatches(source, VALUE_RULES[0].pattern);
  themeColours += countMatches(source, VALUE_RULES[1].pattern);
  for (const [index, line] of source.split('\n').entries()) {
    BREAKPOINT.lastIndex = 0;
    if (BREAKPOINT.test(line)) {
      breakpoints.push({
        file: relative,
        line: index + 1,
        column: 1,
        rule: 'breakpoint',
        text: line.trim(),
        why: 'a width breakpoint in the theme. "Zero breakpoints" is the claim; this would be it conceded.',
        source: line.trim(),
      });
    }
  }
}
violations.push(...breakpoints);

const selfChecks = [
  {
    name: 'roots scanned',
    ok: missingRoots.length === 0,
    detail:
      missingRoots.length === 0
        ? `${scannedFiles.length} files across ${SCANNED.join(', ')}`
        : `no files found under ${missingRoots.join(', ')} — the scan proved nothing`,
  },
  {
    name: 'theme reachable',
    ok: themeFiles.length > 0,
    detail: themeFiles.length > 0 ? `${themeFiles.length} files under ${THEME}` : `no files under ${THEME}`,
  },
  {
    name: 'patterns still bite',
    ok: themeLengths > 0 && themeColours > 0,
    detail: `${themeLengths} length literals and ${themeColours} colour literals matched inside ${THEME}, where they belong`,
  },
];

/* ── report ───────────────────────────────────────────────────────────────── */

console.log('c11 exclusivity guard\n');
for (const entry of ALLOWLIST) {
  console.log(`allowlisted  ${entry.file} (${entry.lines})`);
  console.log(`             ${entry.why}`);
}
console.log('');
for (const check of selfChecks) {
  console.log(`${check.ok ? 'ok  ' : 'FAIL'}  ${check.name}: ${check.detail}`);
}
console.log('');

if (violations.length > 0) {
  console.log(`violations (${violations.length})\n──────────`);
  let current = '';
  for (const violation of violations) {
    if (violation.file !== current) {
      current = violation.file;
      console.log(`\n${current}`);
    }
    console.log(`  ${violation.file}:${violation.line}:${violation.column}  ${violation.rule}  "${violation.text}"`);
    console.log(`      ${violation.source}`);
    console.log(`      ${violation.why}`);
  }
  console.log('');
}

const brokenChecks = selfChecks.filter((check) => !check.ok).length;
const pass = violations.length === 0 && brokenChecks === 0;
console.log(
  pass
    ? `PASS — ${scannedFiles.length} files carry no length, no colour, no media query, no className and no size prop. Every value in the rendered UI comes from ${THEME}/.`
    : `FAIL — ${violations.length} violations, ${brokenChecks} broken self-checks.`,
);
process.exitCode = pass ? 0 : 1;
