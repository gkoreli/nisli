/**
 * barrel.test.ts — the public surface, asserted.
 *
 * Every name on an entry point is a permanent compatibility obligation, and a
 * barrel that silently LOSES one is the same failure class this package's
 * diagnostics exist to catch: nothing breaks, nothing is reported, and a
 * consumer's import resolves to `undefined` at runtime. `tsc` does not catch it
 * either, because a barrel that exports fewer names is still a valid module.
 *
 * So the surface is pinned here rather than described in a README. Two
 * directions, both deliberate:
 *
 *   - Every name listed MUST be exported. Removing one fails this test, which
 *     is the point: it should require a decision, not a refactor.
 *   - The runtime entry MUST NOT reach the checker. That is the whole reason
 *     there are two entry points, and it is asserted by import rather than
 *     trusted, because the boundary is invisible in the source of either half.
 */
import { describe, expect, it } from 'vitest';
import * as runtime from './index.js';
import * as devtools from './devtools.js';

/**
 * The runtime half. Small on purpose: four solver internals that the prototype
 * exported are deliberately absent, because three are read only by `solveFit`
 * and the fourth has one in-package consumer.
 */
const RUNTIME = [
  // The vocabulary, as data. These three travel together: `VOCABULARY` says
  // what the legal values are, `AXIS_ATTRS` says which attribute carries each
  // axis, and either alone leaves a consumer unable to check their own markup.
  'AXIS_ATTRS',
  'STRATEGIES',
  'VOCABULARY',
  // The measured tier.
  'discoverCandidates',
  'domMetrics',
  'domMutator',
  'fitContainers',
  'fit',
  'solveAll',
  'solveFit',
  // The engine (thing #1).
  'allocate',
  'declareItem',
  'declareTrigger',
  'planOf',
  'Row',
  'RowContext',
];

/** The checker. Dev-only weight, reachable only through the subpath. */
const DEVTOOLS = [
  'check',
  'DEFAULT_RULES',
  'domInspector',
  'formatFindings',
  'summarize',
  'CODES',
  'codeEntry',
  'DOCS_BASE',
  'observe',
  'rule',
  // The second constructor. On the surface because a consumer's measuring rule
  // must be able to inherit the three obligations rather than restate them.
  'measuringRule',
  'isAdmittedFailure',
  'explain',
];

describe('the public surface', () => {
  it('exports every documented runtime name', () => {
    expect(RUNTIME.filter((name) => !(name in runtime))).toEqual([]);
  });

  it('exports every documented devtools name', () => {
    expect(DEVTOOLS.filter((name) => !(name in devtools))).toEqual([]);
  });

  it('keeps the runtime entry free of the checker', () => {
    // The load-bearing invariant of the two-entry split: a consumer shipping
    // production imports `.` and pays nothing for the fifteen rules. Asserted
    // by absence on the barrel, which is the observable a consumer actually
    // sees; the import graph is verified separately at build time.
    for (const name of DEVTOOLS) expect(runtime, `runtime leaks ${name}`).not.toHaveProperty(name);
  });

  it('does not grow a surface without a decision', () => {
    // A tripwire, not a style rule. New exports are fine; new exports nobody
    // noticed are not, and this is the line that makes someone notice.
    expect(Object.keys(runtime).sort()).toEqual([...RUNTIME].sort());
    expect(Object.keys(devtools).sort()).toEqual([...DEVTOOLS].sort());
  });
});

describe('the vocabulary is self-describing', () => {
  it('names an axis that exists for every attribute', () => {
    const orphans = Object.entries(runtime.AXIS_ATTRS).filter(
      ([, axis]) => !(axis in runtime.VOCABULARY),
    );
    expect(orphans).toEqual([]);
  });

  it('carries a non-trivial vocabulary, so the checks above cannot pass vacuously', () => {
    const values = Object.values(runtime.VOCABULARY).flat();
    expect(Object.keys(runtime.VOCABULARY).length).toBeGreaterThanOrEqual(8);
    expect(values.length).toBeGreaterThanOrEqual(30);
    // No duplicates across axes would be a nice property but is not one we
    // hold: `truncate` is legally both a collapse strategy and, historically, a
    // stamped attribute value. Asserting uniqueness here would encode a
    // constraint the design does not actually make.
    expect(new Set(values).size).toBeGreaterThan(0);
  });
});

describe('the rule set is addressable by code', () => {
  it('registers every rule it ships', () => {
    const rules = devtools.DEFAULT_RULES<string>();
    expect(rules.filter((entry) => !(entry.code in devtools.CODES)).map((e) => e.code)).toEqual([]);
    expect(rules.length).toBeGreaterThanOrEqual(15);
  });

  it('supports the documented composition idiom', () => {
    // The reason the fifteen rule factories are NOT individually exported:
    // subtractive and additive composition already work through the code, which
    // is append-only and stable, rather than through an import name that a
    // refactor could rename.
    const all = devtools.DEFAULT_RULES<string>();
    const dropped = all.filter((entry) => entry.code !== 'N650');
    expect(dropped.length).toBe(all.length - 1);
    expect(dropped.some((entry) => entry.code === 'N650')).toBe(false);
  });

  it('hands out fresh instances, so a caller cannot poison the defaults', () => {
    expect(devtools.DEFAULT_RULES<string>()).not.toBe(devtools.DEFAULT_RULES<string>());
  });
});
