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
      for (const match of readFileSync(file, 'utf8').matchAll(/data-[a-z-]+/g)) {
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
