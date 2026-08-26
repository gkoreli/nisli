/**
 * observe.ts — how a rule SEES.
 *
 * Every rule used to open with the same eleven lines: iterate a selector, skip
 * what is not rendered, parse a length out of a computed style with a `|| 0`
 * because one NaN silences a whole rule, sum two border widths, assemble a
 * finding. Eleven copies of a precondition is eleven chances to omit it, and
 * the first run omitted it once and produced ten false failures (F4).
 *
 * So the precondition moves into the type. There are exactly two ways to select:
 *
 *   - `painted(selector)` — nodes that actually render. The ONLY way to reach a
 *     measurement, because measuring an unpainted node is how an oracle invents
 *     defects. A `display: contents` component host has no box at all: every
 *     rect reads 0 while `checkVisibility()` still answers true, which is the
 *     exact false-PASS shape the round-2 corpus recorded three times.
 *   - `declared(selector)` — every match, painted or not. For claims about what
 *     the author WROTE rather than what the browser DID: the escape hatch (N601)
 *     and the vocabulary check (N610) are true or false regardless of layout.
 *
 * The split is the domain rule stated in a signature: **you may only measure
 * what is painted; you may inspect a declaration on anything.**
 *
 * `declared()` LATER ACQUIRED A SECOND, LOAD-BEARING PURPOSE, and it is worth
 * stating because it inverts the reading above. `painted()` filters out content
 * skipped by `content-visibility: auto` — the adapter's `rendered()` answers
 * false for it — and that filtering is itself a measured false PASS: a skipped
 * subtree disappears from every measuring rule, nothing throws, and the report
 * says clean while a child that needs 471 pixels sits inside a 200-pixel box. So
 * `declared()` is now also the only route to a node the checker CANNOT measure,
 * and `measurable()` is how a rule asks. The rule then owes an
 * `out.undecidable()`, never a `continue`.
 *
 * Geometry is exposed as two named methods rather than one bag, because `Box`
 * and `Bounds` answer different questions and the last run cost five defects to
 * that confusion. See the type comments in contracts.ts.
 *
 * Nothing here is lazy for cleverness, but geometry IS lazy for cost: `box()`
 * and `bounds()` are calls, not fields, so selecting 200 nodes to check one
 * attribute does not force 200 layout reads.
 */

import type { Backdrop, Bounds, Box, Containment, Inspector, Rgba } from '../contracts.js';

/** One node, seen. The unit every rule reasons over. */
export interface Observation<TNode> {
  /** The underlying node, for the rare rule that must pass it on. */
  readonly node: TNode;
  /** Human-readable identity, resolved once. Every finding names this. */
  readonly subject: string;
  /** Padding box — containment claims. */
  box(): Box;
  /** Border box with origin — visual-extent and pressability claims. */
  bounds(): Bounds;
  /**
   * How many line boxes this node's own text occupies. A measurement, so it is
   * reachable only through `painted()` like every other one. See
   * `Inspector.lines` for what it deliberately cannot answer.
   */
  lines(): number;
  /**
   * Does this node's geometry mean what it says? FALSE for content skipped by
   * `content-visibility: auto`.
   *
   * The one accessor here that must be reached through `declared()` rather than
   * `painted()`, and the reason is the defect it exists for: `painted()` filters
   * skipped nodes OUT, because the adapter's `rendered()` answers false for
   * them. That filtering IS the false PASS — a whole subtree vanishes from every
   * measuring rule and the run reports clean. A rule that wants to know whether
   * its subtree contained anything it could not measure has to ask about the
   * nodes `painted()` refused to hand it.
   */
  measurable(): boolean;
  /** What happens to content that does not fit this box. */
  containment(): Containment;
  /** A declared attribute, verbatim. `null` when absent. */
  attr(name: string): string | null;
  /** A resolved style value, verbatim. */
  raw(property: string): string;
  /**
   * A resolved style value as a length in px, or 0.
   *
   * The `|| 0` is load-bearing rather than lazy: an engine that does not resolve
   * a logical longhand returns the empty string, and a single NaN propagated
   * into a sum silences the rule that depended on it. A rule that needs to
   * distinguish "zero" from "unresolvable" asks `raw()` and decides for itself.
   */
  px(property: string): number;
  /** Text content, verbatim. */
  text(): string;
  /**
   * A resolved style colour, as the compositor painted it, or `null` when the
   * value is not a colour. Never parse a colour in a rule: the adapter owns
   * every syntax, and the one that did not cost 288 of 1188 measured cells.
   */
  colour(property: string): Rgba | null;
  /** Is a contrast claim about this node supportable, and against what? */
  backdrop(): Backdrop;
  /** Painted descendants matching `selector`. Scopes a measurement. */
  painted(selector: string): readonly Observation<TNode>[];
  /** All descendants matching `selector`, painted or not. Scopes a declaration. */
  declared(selector: string): readonly Observation<TNode>[];
}

/** How a rule addresses the document. */
export interface Lens<TNode> {
  /** Painted nodes matching `selector`. The only route to a measurement. */
  painted(selector: string): readonly Observation<TNode>[];
  /** Every node matching `selector`. For declaration claims only. */
  declared(selector: string): readonly Observation<TNode>[];
  viewport(): { readonly inline: number; readonly documentInline: number };
}

function observation<TNode>(inspector: Inspector<TNode>, node: TNode): Observation<TNode> {
  return {
    node,
    subject: inspector.describe(node),
    box: () => inspector.box(node),
    bounds: () => inspector.bounds(node),
    lines: () => inspector.lines(node),
    measurable: () => inspector.measurable(node),
    containment: () => inspector.containment(node),
    attr: (name) => inspector.attr(node, name),
    raw: (property) => inspector.style(node, property),
    px: (property) => Number.parseFloat(inspector.style(node, property)) || 0,
    text: () => inspector.text(node),
    colour: (property) => inspector.colour(node, property),
    backdrop: () => inspector.backdrop(node),
    painted: (selector) =>
      inspector
        .within(node, selector)
        .filter((found) => inspector.rendered(found))
        .map((found) => observation(inspector, found)),
    declared: (selector) =>
      inspector.within(node, selector).map((found) => observation(inspector, found)),
  };
}

export function observe<TNode>(inspector: Inspector<TNode>): Lens<TNode> {
  return {
    painted: (selector) =>
      inspector
        .all(selector)
        .filter((node) => inspector.rendered(node))
        .map((node) => observation(inspector, node)),
    declared: (selector) => inspector.all(selector).map((node) => observation(inspector, node)),
    viewport: () => inspector.viewport(),
  };
}
