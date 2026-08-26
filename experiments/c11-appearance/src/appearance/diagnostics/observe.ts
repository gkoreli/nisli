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
 * Geometry is exposed as two named methods rather than one bag, because `Box`
 * and `Bounds` answer different questions and the last run cost five defects to
 * that confusion. See the type comments in contracts.ts.
 *
 * Nothing here is lazy for cleverness, but geometry IS lazy for cost: `box()`
 * and `bounds()` are calls, not fields, so selecting 200 nodes to check one
 * attribute does not force 200 layout reads.
 */

import type { Bounds, Box, Inspector } from '../contracts.js';

/** One node, seen. The unit every rule reasons over. */
export interface Observation<TNode> {
  /** The underlying node, for the rare rule that must pass it on. */
  readonly node: TNode;
  /** Human-readable identity, resolved once. Every finding names this. */
  readonly subject: string;
  /** Padding box — containment claims. */
  box(): Box;
  /** Border box — pressability and visual-extent claims. */
  bounds(): Bounds;
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
  /** Nearest painted background colour behind this node. */
  backdrop(): string;
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
    attr: (name) => inspector.attr(node, name),
    raw: (property) => inspector.style(node, property),
    px: (property) => Number.parseFloat(inspector.style(node, property)) || 0,
    text: () => inspector.text(node),
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
