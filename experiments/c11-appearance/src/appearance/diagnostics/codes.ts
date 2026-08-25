/**
 * codes.ts — the diagnostic code registry.
 *
 * Three rules govern this file and they are not negotiable:
 *
 *   1. APPEND-ONLY, FOREVER. A code becomes a public identifier the moment it
 *      ships: it lands in CI logs, in suppression comments, in bug reports and
 *      in other people's dashboards. A new check takes the next free number; it
 *      never renumbers a neighbour to make the list tidy.
 *   2. NEVER REUSED. A retired check keeps its entry here (with its rule file
 *      deleted). Recycling a number would silently repoint every existing
 *      suppression at an unrelated failure, which is worse than a gap.
 *   3. EVERY CODE HAS A DOCS SLUG. A finding the reader cannot look up gets
 *      muted, so the slug is derived from the code itself (`DOCS_BASE` plus the
 *      lowercased code, stamped by the runner) rather than typed per call site:
 *      a code physically cannot ship without its anchor.
 *
 * `severity` below is the code's DECLARED severity — what this class of defect
 * means. A rule reports its own findings at that severity; N680 is the one
 * escape, and it exists because a checker that dies on an undecidable node is
 * indistinguishable from a checker that found nothing.
 */

import type { CodeEntry } from '../contracts.js';

/** Prefix for the docs anchor of every code. */
export const DOCS_BASE = 'docs/check/';

const REGISTRY = {
  N601: {
    code: 'N601',
    title: 'escaped subtree',
    severity: 'warn',
    summary:
      'A subtree declared `data-escaped` and styles itself directly, so it sits outside the resolution table.',
    hint: 'Intentional escapes are legitimate; they are counted, not forbidden. Remove the escape once the vocabulary can express what the subtree needs.',
  },
  N610: {
    code: 'N610',
    title: 'value outside the vocabulary',
    severity: 'fail',
    summary:
      'A declaration carries a value the vocabulary does not define, so no rule in the table resolves it and the element renders unstyled.',
    hint: 'Use one of the legal values for that axis. If none fits, the vocabulary is missing a case — extend the table, do not invent a value at the call site.',
  },
  N620: {
    code: 'N620',
    title: 'fit unsatisfiable',
    severity: 'fail',
    summary:
      'A container promised to fit and still overflows after every declared degradation was applied.',
    hint: 'Give the container more degradable content: raise a `data-priority`, or add `data-collapse` to a candidate that currently has none.',
  },
  N621: {
    code: 'N621',
    title: 'truncation degenerate',
    severity: 'warn',
    summary:
      'A truncated node has so little text left that what survives carries no meaning — the strategy fit the box and lost the value.',
    hint: 'Short atomic values (timestamps, counts, codes) want `data-collapse="hide"`: absent is honest, "1…" is not. Reserve `truncate` for prose.',
  },
  N630: {
    code: 'N630',
    title: 'document exceeds viewport',
    severity: 'fail',
    summary: 'The document is wider than the viewport, so the page scrolls sideways.',
    hint: 'Find the widest unfittable subtree first: a purely relative fit check cannot see this, which is exactly why the assertion is absolute.',
  },
  N640: {
    code: 'N640',
    title: 'text contrast below floor',
    severity: 'fail',
    summary:
      'Text fails the WCAG 2.x contrast floor against the nearest painted backdrop (4.5:1 normal, 3:1 large).',
    hint: 'A context axis that sets a foreground colour must paint its own backdrop on the same node; inheriting one from an ancestor of the other theme is how this happens.',
  },
  N650: {
    code: 'N650',
    title: 'hit target below the context floor',
    severity: 'fail',
    summary:
      'An interactive element is smaller than the minimum target this context declared for itself.',
    hint: 'The floor comes from the context (`--min-target`), not from the component. Read the axis: one axis short while the other is comfortable means the floor was expressed as a SIZE and a parent then squeezed it, so express it as a minimum (or refuse to stretch) — a floor any parent can shrink is not a floor. Both axes short means the control never reached the floor at all.',
  },
  N660: {
    code: 'N660',
    title: 'element crushed',
    severity: 'fail',
    summary:
      'An element got less inline space than its content needs, so the content paints outside its own box.',
    hint: 'Nothing may shrink below its content except a declared `data-grow` node and an actually-truncated one. A crushed element means something is shrinking that was never allowed to.',
  },
  N670: {
    code: 'N670',
    title: 'sibling boxes overlap',
    severity: 'fail',
    summary:
      'Children of a single-line row need more inline space than the row has, so their painted content collides.',
    hint: 'Overlap is the visible half of a crush: fix the crush (N660) and the collision disappears. Never buy the fit by letting boxes shrink under their content.',
  },
  N680: {
    code: 'N680',
    title: 'measurement impossible',
    severity: 'incomplete',
    summary:
      'A rule could not reach a verdict — it threw, or the geometry it needed was undecidable.',
    hint: 'Incomplete is a real answer, not a pass. Read the rule and the message: a genuinely undecidable node needs a human, a throwing rule needs a fix.',
  },
} as const satisfies Record<string, CodeEntry>;

/**
 * The registry. Deliberately typed wide (`Record<string, CodeEntry>`): callers
 * iterate it, and tooling looks codes up by strings that arrive from findings.
 */
export const CODES: Readonly<Record<string, CodeEntry>> = REGISTRY;

/**
 * Registry lookup that refuses to be vague. Every rule resolves its own entry
 * through this at construction, so a code that is not registered is an import-
 * time crash rather than a finding nobody can look up.
 */
export function codeEntry(code: string): CodeEntry {
  const entry = CODES[code];
  if (!entry) throw new Error(`diagnostics: ${code} is not in the code registry`);
  return entry;
}
