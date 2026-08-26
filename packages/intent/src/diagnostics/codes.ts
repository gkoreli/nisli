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
 *
 * ══════════════════════════════════════════════════════════════════════════
 * KNOWN DEBT — THESE NUMBERS ARE NOT YET ALLOCATED, AND THE RANGE IS WRONG.
 * ══════════════════════════════════════════════════════════════════════════
 * Recorded by ADR 0032 §7 and repeated here because a reader meets the numbers
 * before they meet the ADR. `@nisli/core` pre-allocates diagnostic ranges BY
 * OWNER MODULE in `packages/core/src/diagnostics.ts`, and this table was
 * numbered in a prototype that never consulted it. Three separate faults:
 *
 *   - `N601`–`N690` sit inside the `N6xx` block core reserves for "async:
 *     query/resource/settle diagnostics", so two owners write into one range.
 *     Core already has `N602` and `N603` live in it.
 *   - `N601` is a number core EXPLICITLY RETIRED — "N601 (mixed QueryClients)
 *     was retired before release: N501 makes that state unrepresentable at its
 *     cause. The number is not reused." Rule 2 above forbids exactly this, and
 *     this registry is currently breaking it against a neighbouring package
 *     rather than against itself, which is the same defect with a wider blast
 *     radius: a reader who greps `N601` finds two unrelated answers.
 *   - `N7xx` is claimed with no entry in core's owner table at all — the
 *     ranges there stop at `N6xx`.
 *
 * THE FIX IS TO ALLOCATE A PEER RANGE IN CORE'S REGISTRY AND RENUMBER, BEFORE
 * ANYTHING PUBLISHES. It is deliberately NOT done in this port: renumbering
 * every code while every file also changes path would make the port
 * unreviewable, and rule 1 above means the renumber is a one-shot that has to
 * happen while the numbers are still private. `private: true` in package.json
 * is what buys the time — the append-only clock starts at first publish, not
 * at first commit.
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
      'Text fails the contrast floor this context declared against the nearest painted backdrop.',
    hint: 'A context axis that sets a foreground colour must paint its own backdrop on the same node; inheriting one from an ancestor of the other theme is how this happens. The floor itself comes from the context (`--intent-min-contrast`, or `--intent-min-contrast-large` for large text), not from this rule — so raising the bar is a theme edit, and a document that declares neither gets N680 rather than a verdict.',
  },
  N650: {
    code: 'N650',
    title: 'hit target below the context floor',
    severity: 'fail',
    summary:
      'An interactive element is smaller than the minimum target this context declared for itself.',
    hint: 'The floor comes from the context (`--intent-min-target`), not from the component. Read the axis: one axis short while the other is comfortable means the floor was expressed as a SIZE and a parent then squeezed it, so express it as a minimum (or refuse to stretch) — a floor any parent can shrink is not a floor. Both axes short means the control never reached the floor at all.',
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
  N690: {
    code: 'N690',
    title: 'word shredded to fit its box',
    severity: 'warn',
    summary:
      'A word was broken inside itself so the text would fit a box that could not hold it. The geometry is satisfied and the prose is damaged.',
    hint: "Floor the bound instead of shredding the content: a box that cannot hold its own minimum is the defect, and `overflow-wrap: anywhere` only hides it. This is N621's sibling — one covers the solver destroying a value, this covers the table doing it.",
  },
  N700: {
    code: 'N700',
    title: 'competing primary actions',
    severity: 'fail',
    summary:
      'Two or more actions in one surface each declare themselves the thing to do. The declarations contradict each other, so the reader is asked to spend the same attention twice.',
    hint: 'Keep one primary or danger action per surface and demote the rest to quiet, or split them into separate surfaces if they really are separate decisions. Normative source: the GNOME HIG allows a single suggested-or-destructive button per view.',
  },
  /* ── Measurement truth ──────────────────────────────────────────────────
     Three codes for defects the checker was PASSING silently. Each was found
     by measuring a CSS feature the prototype had never met, and each is a
     false-PASS rather than a false-FAIL, which is the worse currency: nobody
     reads a finding that is not there. */
  N710: {
    code: 'N710',
    title: 'clipped content lost',
    severity: 'fail',
    summary:
      'A box clips, its content is larger than the box, and nothing declared that the clipped material was expendable. Measured worst case in this prototype: a 772-pixel table in a 358-pixel flush surface deleted 414 pixels and 30 nodes entirely, in silence.',
    hint: 'Either let the region scroll, so the rest stays reachable, or declare `data-clip="trim"` to say the overhang is decoration. Scrolling is a promise to the reader; clipping without a declaration is a deletion.',
  },
  N713: {
    code: 'N713',
    title: 'content lost in a multicolumn box',
    severity: 'fail',
    summary:
      'A multicolumn container overflowed. A column box is not an element, so the per-node crush test can never see this: measured 3 columns of 101.33 pixels holding 103 pixels of content, 6 crushed nodes and a 323/320 container, invisible to every per-element predicate.',
    hint: 'This one must be measured with rectangles rather than element geometry. Derive the column count instead of declaring a column width.',
  },
  N715: {
    code: 'N715',
    title: 'overflow before the box',
    severity: 'fail',
    summary:
      'Content painted above or to the logical start of its container. `scrollHeight`/`scrollWidth` are directional and cannot see it: measured a box reporting scrollHeight 36 === clientHeight 36 with a 45-pixel control sitting outside it.',
    hint: 'Compare rectangles, not scroll extents. Any container whose block-start or inline-start overflow matters needs the rect pass, because the scroll extent is structurally blind to it.',
  },
  /* ── The table's own strategies ─────────────────────────────────────────
     F9 was the resolution table stating an IMPOSSIBLE constraint. F11
     established that priority orders WHEN a strategy is spent and never
     WHETHER. This is the third direction: a strategy whose IMPLEMENTATION
     cannot pay out on the content it was applied to, with no channel through
     which the solver or the author could discover that. */
  N730: {
    code: 'N730',
    title: 'degradation spent for nothing',
    severity: 'fail',
    summary:
      'The solver applied a declared degradation to this element and the element did not get smaller, inside a container that still does not fit. Measured case: a single unbreakable token, where truncation resolves to nowrap plus an ellipsis and nowrap makes the minimum content width equal the whole text — so the strategy was spent and bought zero pixels while the container reported unsatisfiable.',
    hint: 'The strategy is wrong for this content, not merely insufficient. A token that cannot break needs `hide` or a scroll region; an ellipsis can only clamp text that was already allowed to be narrower than itself.',
  },
  /* ── The axis nothing was measuring ─────────────────────────────────────
     F8 was a container reporting `settled` while its children were crushed,
     because a container-only overflow test cannot see a child's crush. This is
     the same sentence with one word changed: a container reports `settled`
     while its content grows without bound in the BLOCK axis, because an
     inline-axis test cannot see block-axis growth. Both were false PASSes, and
     the second one survived every rule above it. */
  N740: {
    code: 'N740',
    title: 'content reflowed inside a single-line container',
    severity: 'fail',
    summary:
      'Text inside a container declared as a row was broken onto more than one line box. A row puts its children on one line — `wrap` is the value that asks for a second — so the inline space this text needed and did not get was paid for in the block axis, where no overflow and no crush can see it. Measured case: a grow region collapsed to the width of one word, ten words rendered down a column, a row over ten times its declared height, and the container reporting scrollWidth 346 === clientWidth 346 with a settled fit and nothing collapsed.',
    hint: 'Reflow is not a fit. Either declare a degradation the solver can spend on this content (`data-collapse="truncate"` clamps it to one line, `hide` removes it), or say that a second line is wanted by declaring `data-layout="wrap"` instead of `row`. A grow region absorbs slack on the INLINE axis only; it was never granted the block axis to spend.',
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
