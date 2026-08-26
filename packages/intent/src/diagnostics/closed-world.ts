/**
 * closed-world.ts — a fixture that names what it expects, and nothing else.
 *
 * WHAT THIS PACKAGE'S FIXTURES ASSERTED BEFORE THIS FILE, and the hole in it:
 * every one of them says "this rule fires on this defect" and "this rule is
 * silent on a clean document". Both are open-world assertions. Neither can see
 * a SECOND rule firing on the same fixture, so a rule that gains an obligation
 * and starts reporting something new inside a fixture written for a different
 * rule changes the output of the checker and no test in the package notices.
 * That is precisely the failure mode of the migration this file was written to
 * cover — eleven rules gaining three obligations at once.
 *
 * EVERY MATURE CHECKER HAS THIS AND WE DID NOT, which is why it is worth the
 * file rather than a habit:
 *   - clang-tidy runs FileCheck with `-implicit-check-not={{warning|error}}:`,
 *     so an unexpected diagnostic fails the test rather than passing unseen;
 *   - rustc's compiletest collects every unmatched diagnostic into `unexpected`
 *     and fails on it;
 *   - Biome's rule check bails on "an unexpected diagnostic";
 *   - axe-core's rule-integration harness fails if any node is found that is
 *     not accounted for in one of its three arrays.
 * The shape is the same in all four: the expectation is the WHOLE output, not a
 * subset of it.
 *
 * IT RETURNS A DIFFERENCE RATHER THAN ASSERTING ONE, on purpose. This module
 * lives in `src/`, so it must not import a test framework; and a helper that
 * throws its own error hides the two lists a reader needs when it fails. The
 * caller writes `expect(closedWorld(...)).toEqual({ unexpected: [], missing: [] })`
 * and the framework prints both halves in the terms of whatever it was testing.
 *
 * WHY THE EXPECTATION IS A CODE AND A SUBJECT and not a whole `Finding`. Detail
 * prose is the one part of a finding that is meant to be rewritten — it carries
 * numbers and explanations that improve — and a closed-world assertion over
 * prose would fail on every improvement to a message, which is how a guard gets
 * commented out. Code and subject are the two fields a reader routes on: WHICH
 * claim, about WHAT. Severity comes from the registry, so asserting it here
 * would be asserting the registry twice.
 */

import type { Finding, Rule } from '../contracts.js';
import { FakeInspector } from '../testing.js';
import type { InspectWorldSpec } from '../testing.js';
import { DEFAULT_RULES, check } from './runner.js';

/** One finding a fixture claims the whole rule set should produce. */
export interface Expectation {
  readonly code: string;
  readonly subject: string;
}

/**
 * What the run produced that no expectation named, and what was named and did
 * not appear. Both empty is the only passing result.
 *
 * `unexpected` carries the full finding rather than the pair, because the
 * detail is what tells a reader whether a new finding is a defect in the rule
 * or a fixture that needs a new line.
 */
export interface Difference {
  readonly unexpected: readonly Finding[];
  readonly missing: readonly Expectation[];
}

/**
 * Run `rules` over `spec` and compare the output to `expected` in both
 * directions.
 *
 * Duplicates are counted, not collapsed: two findings with the same code and
 * subject need two expectations. A rule that starts reporting the same subject
 * twice is a defect, and a set would hide it.
 */
export function closedWorld(
  spec: InspectWorldSpec,
  expected: readonly Expectation[],
  rules: readonly Rule<string>[] = DEFAULT_RULES<string>(),
): Difference {
  const findings = check(new FakeInspector(spec), rules);
  const outstanding = expected.map((want) => ({ want, matched: false }));
  const unexpected: Finding[] = [];

  for (const finding of findings) {
    const slot = outstanding.find(
      (entry) =>
        !entry.matched && entry.want.code === finding.code && entry.want.subject === finding.subject,
    );
    if (slot === undefined) {
      unexpected.push(finding);
      continue;
    }
    slot.matched = true;
  }

  return {
    unexpected,
    missing: outstanding.filter((entry) => !entry.matched).map((entry) => entry.want),
  };
}
