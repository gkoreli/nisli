/**
 * observe.ts — how a rule SEES, and what it is structurally unable to see.
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
 * THE SPLIT IS NOW A TYPE SPLIT AND NOT A NAMING CONVENTION, which is the
 * change this file records. `declared()` yields a `Declaration`, which has no
 * geometry on it at all — no box, no bounds, no line count, and no `raw()`,
 * because `getComputedStyle` answers a USED value for a great many properties
 * and a resolved `width` is a measurement wearing a property name. `painted()`
 * yields a `Measurement`, which has all of it. A rule that wants a rectangle
 * therefore cannot get one from a declaration selector even by mistake, and the
 * three obligations below can be attached to `painted()` once instead of to
 * eleven rules by hand.
 *
 * `declared()` HAD A SECOND, LOAD-BEARING PURPOSE, and it is worth stating in
 * full because the mechanism has moved and the measurement has not. `painted()`
 * filters out content skipped by `content-visibility: auto` — the adapter's
 * `rendered()` answers false for it — and that filtering is itself a measured
 * false PASS: a skipped subtree disappears from every measuring rule, nothing
 * throws, and the report says clean while a child that needs 471 pixels sits
 * inside a 200-pixel box. Three rules used to reach those nodes through
 * `declared()` and ask `measurable()` themselves. Nine did not, and the
 * injection harness proved what that cost: nine rules reporting a CLEAN PAGE
 * over a defect that is present, because `content-visibility` does not change
 * computed `contain`, so such a box is not a clipper and nothing routes it
 * anywhere. `measurable()` is therefore no longer something a rule can ask —
 * it is not on `Declaration` or on `Measurement` — because a question every
 * member of a category must ask is a question the category's constructor
 * should answer.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE THREE OBLIGATIONS, discharged here so a rule cannot omit one.
 * ══════════════════════════════════════════════════════════════════════════
 * `painted()` does not filter. It ROUTES, and the difference is the entire
 * point: two of the three cases below look identical from inside a rule and
 * mean opposite things.
 *
 *   1. NOT RENDERED — `display: none`, `content-visibility: hidden`, a
 *      `display: contents` host. These have no box at all and report zero
 *      honestly. Dropped, silently, because there is nothing to say.
 *   2. NOT MEASURABLE — content that IS there and whose geometry does not mean
 *      what it says. Dropped from the sample AND reported as N680, never
 *      silently: "I cannot decide" is a verdict, and collapsing it into "I have
 *      nothing to report" is the exact class this seam exists to close.
 *   3. FORFEITED — inside a `[data-escaped]` subtree. Dropped, silently, and
 *      that silence is the guarantee rather than a gap: an escape says the
 *      author took this subtree back. Order matters — forfeited is tested
 *      BEFORE measurable, so an escaped subtree that is also skipped produces
 *      no admission. There is nothing to admit about a claim nobody made.
 *
 * WHY THE ESCAPE EXEMPTION LIVES ON `painted()` AND NOT ON EVERY RULE, and the
 * authority for it is a sentence already in the codebase rather than symmetry:
 * N601 reports that an escaped subtree "forfeits the rhythm, fit, contrast and
 * hit-target guarantees". Those four families are exactly the claims that are
 * about PAINTED OUTPUT, and every rule that makes one selects through
 * `painted()`. The claims the sentence does not name — N610's vocabulary check,
 * N700's competing primaries — are declaration claims, they select through
 * `declared()`, and they go on reporting inside an escaped subtree, which is
 * correct: an escape buys different styling, not a licence to misspell an
 * attribute. The split the sentence describes and the split between the two
 * constructors are the same split, which is why one is allowed to enforce the
 * other.
 *
 * Geometry is exposed as two named methods rather than one bag, because `Box`
 * and `Bounds` answer different questions and the last run cost five defects to
 * that confusion. See the type comments in contracts.ts.
 *
 * Nothing here is lazy for cleverness, but geometry IS lazy for cost: `box()`
 * and `bounds()` are calls, not fields, so selecting 200 nodes to check one
 * attribute does not force 200 layout reads. The escaped set is lazy for the
 * same reason: a rule that never reaches a measurement never pays for the
 * query that finds the escapes.
 */

import type { Backdrop, Bounds, Box, Containment, Inspector, Rgba } from '../contracts.js';

/**
 * A subtree the author took back, and everything inside it.
 *
 * One literal, one place. It was six copies in six rules, which is six chances
 * to be the rule that does not have it — and five of eleven measuring rules
 * were exactly that. The blast radius of the single copy is now twelve rules
 * instead of one, so `reachability.test.ts` scans this file as well as `rules/`
 * to prove the attribute is one the engine actually gives meaning to.
 */
const FORFEITED = '[data-escaped], [data-escaped] *';

/** The scope of a document-wide query. Not a node, so it cannot collide. */
const DOCUMENT = Symbol('document');

/** How a document-wide admission names itself. Matches N630's subject. */
const DOCUMENT_SUBJECT = 'document';

/**
 * Where the lens sends a node it refused to hand over because nothing about it
 * can be measured. `Report.undecidable`, passed in rather than imported, so the
 * lens owes nothing to the rule constructor that owns the voice.
 */
export type Admit = (subject: string, detail: string) => void;

/** One node, as the author DECLARED it. Carries no geometry: see the header. */
export interface Declaration<TNode> {
  /** The underlying node, for the rare rule that must pass it on. */
  readonly node: TNode;
  /** Human-readable identity, resolved once. Every finding names this. */
  readonly subject: string;
  /** A declared attribute, verbatim. `null` when absent. */
  attr(name: string): string | null;
  /** Text content, verbatim. */
  text(): string;
  /** All descendants matching `selector`, painted or not. Scopes a declaration. */
  declared(selector: string): readonly Declaration<TNode>[];
}

/**
 * One node, as the browser PAINTED it. Every geometry in the package hangs off
 * this type and nothing else, which is what makes "you may only measure what is
 * painted" a compile error rather than a review comment.
 */
export interface Measurement<TNode> extends Declaration<TNode> {
  /** Padding box — containment claims. */
  box(): Box;
  /** Border box with origin — visual-extent and pressability claims. */
  bounds(): Bounds;
  /**
   * How many line boxes this node's own text occupies. A measurement, so it is
   * reachable only from here like every other one. See `Inspector.lines` for
   * what it deliberately cannot answer.
   */
  lines(): number;
  /** What happens to content that does not fit this box. */
  containment(): Containment;
  /**
   * A resolved style value, verbatim.
   *
   * On this type and not on `Declaration`, and the reason is not tidiness: a
   * computed value is frequently a USED value, so `raw('inline-size')` is a
   * layout read with a property name on it. A rule that may not measure may not
   * reach one by that door either.
   */
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
  /**
   * A resolved style colour, as the compositor painted it, or `null` when the
   * value is not a colour. Never parse a colour in a rule: the adapter owns
   * every syntax, and the one that did not cost 288 of 1188 measured cells.
   */
  colour(property: string): Rgba | null;
  /** Is a contrast claim about this node supportable, and against what? */
  backdrop(): Backdrop;
  /** Painted descendants matching `selector`. Scopes a measurement. */
  painted(selector: string): Sample<TNode>;
}

/**
 * The result of a measuring query: the evidence, and whether it is all of it.
 *
 * A plain array would have been shorter and it would have hidden the one thing
 * a rule sometimes has to know. `items` is every node matching the selector
 * that could be measured and was not forfeited. `whole` is false when at least
 * one matching node could not be measured — in which case an N680 naming this
 * scope has ALREADY been reported, so a rule consulting `whole` is deciding
 * what else to say, never whether to admit.
 *
 * WHICH RULES MUST CONSULT IT, stated as the property rather than as a list: a
 * rule whose finding AGGREGATES over the sample — a count of lost nodes, a
 * worst-case overhang — must not speak on a partial one, because a count over
 * evidence with a hole in it reads to the author as complete. N710 records
 * exactly this decision about itself. A rule that judges each item on its own
 * may speak about the items it got, because each of those verdicts is sound
 * whatever happened to the others.
 *
 * Forfeited nodes do NOT make a sample partial. An escaped subtree is not
 * missing evidence, it is evidence nobody asked for.
 */
export interface Sample<TNode> {
  /** The measurable, non-forfeited matches, in document order. */
  readonly items: readonly Measurement<TNode>[];
  /** False when a matching node could not be measured. See above. */
  readonly whole: boolean;
}

/** How a rule about DECLARATIONS addresses the document. */
export interface Lens<TNode> {
  /** Every node matching `selector`. For declaration claims only. */
  declared(selector: string): readonly Declaration<TNode>[];
}

/**
 * How a rule about PAINTED OUTPUT addresses the document.
 *
 * `viewport()` is here rather than on `Lens` because the two numbers it returns
 * are a measurement — N630 is the one rule that measures without selecting —
 * and putting it here makes the statement total: every geometry in this package,
 * including the document's own width, is reachable only from the measuring
 * constructor.
 */
export interface MeasuringLens<TNode> extends Lens<TNode> {
  /** Painted nodes matching `selector`, and whether that is all of them. */
  painted(selector: string): Sample<TNode>;
  viewport(): { readonly inline: number; readonly documentInline: number };
}

function declaration<TNode>(inspector: Inspector<TNode>, node: TNode): Declaration<TNode> {
  return {
    node,
    subject: inspector.describe(node),
    attr: (name) => inspector.attr(node, name),
    text: () => inspector.text(node),
    declared: (selector) =>
      inspector.within(node, selector).map((found) => declaration(inspector, found)),
  };
}

export function observe<TNode>(inspector: Inspector<TNode>): Lens<TNode> {
  return {
    declared: (selector) => inspector.all(selector).map((node) => declaration(inspector, node)),
  };
}

/**
 * Compose the measuring lens, run `body` through it, and settle what the run
 * held back.
 *
 * A body rather than a returned lens, because the settling MUST happen and a
 * returned lens can be used and never settled. The one thing held back is the
 * admission for a node denied to a DOCUMENT-WIDE query, and the reason is that
 * such a query is a SCAN rather than a claim: `painted('*')` means "show me the
 * candidates", so naming the document in an admission is the weakest true thing
 * available. If a later scoped query is denied the same node it admits
 * immediately, naming its own scope, and the held entry is dropped — a claim
 * about a subtree beats a scan of the page. Whatever no scoped claim covered is
 * emitted at the end, because a skipped box that no rule ever looked inside is
 * still a box nobody could assess.
 *
 * This is a two-tier rule and not an ordering heuristic: the tier is a property
 * of the query, so the result does not depend on which loop ran first. It is
 * what keeps N710, N713 and N715 emitting the one admission per container they
 * emitted before this file owned the obligation.
 */
export function measure<TNode>(
  inspector: Inspector<TNode>,
  admit: Admit,
  body: (lens: MeasuringLens<TNode>) => void,
): void {
  let forfeited: ReadonlySet<TNode> | null = null;
  const escaped = (node: TNode): boolean => {
    forfeited ??= new Set(inspector.all(FORFEITED));
    return forfeited.has(node);
  };

  /** Nodes a document-wide scan was denied, pending a narrower claim. */
  const held = new Set<TNode>();
  /** Nodes already admitted, per scope, so repeat queries do not repeat N680. */
  const admitted = new Map<TNode | typeof DOCUMENT, Set<TNode>>();
  /** Nodes some scoped claim has admitted, which supersedes the held scan. */
  const settled = new Set<TNode>();

  const detail = (count: number): string =>
    `${count} node(s) here are skipped by content-visibility, so their geometry is not the geometry on screen and no verdict about them is supportable. The reader loses nothing — skipped content stays focusable and findable — but nothing about them can be proven`;

  const sample = (
    scope: TNode | typeof DOCUMENT,
    subject: string,
    candidates: readonly TNode[],
  ): Sample<TNode> => {
    const items: Measurement<TNode>[] = [];
    const denied: TNode[] = [];
    for (const node of candidates) {
      // Forfeited first: an escaped subtree that is also skipped owes nobody an
      // admission, because no guarantee was in force inside it.
      if (escaped(node)) continue;
      // BOTH questions, for every candidate, and the extra call is bought
      // deliberately. Asking `measurable()` only of nodes `rendered()` already
      // refused would be cheaper and would rest on the two answers agreeing in
      // scope; the fake's `measurable()` is ancestor-aware while its
      // `rendered()` is per node, so a fixture can express a shape where they
      // do not, and the direction that shape fails in is silence.
      if (!inspector.measurable(node)) {
        denied.push(node);
        continue;
      }
      if (!inspector.rendered(node)) continue;
      items.push(measurement(node));
    }
    if (denied.length > 0) route(scope, subject, denied);
    return { items, whole: denied.length === 0 };
  };

  const route = (
    scope: TNode | typeof DOCUMENT,
    subject: string,
    denied: readonly TNode[],
  ): void => {
    if (scope === DOCUMENT) {
      for (const node of denied) held.add(node);
      return;
    }
    const seen = admitted.get(scope) ?? new Set<TNode>();
    admitted.set(scope, seen);
    const fresh = denied.filter((node) => !seen.has(node));
    if (fresh.length === 0) return;
    for (const node of fresh) {
      seen.add(node);
      settled.add(node);
    }
    admit(subject, detail(fresh.length));
  };

  /**
   * Built rather than spread over a `Declaration`, so `describe()` is called
   * once per painted node and no intermediate object is allocated. `painted('*')`
   * on a real page is thousands of these.
   */
  const measurement = (node: TNode): Measurement<TNode> => {
    const subject = inspector.describe(node);
    return {
      node,
      subject,
      attr: (name) => inspector.attr(node, name),
      text: () => inspector.text(node),
      declared: (selector) =>
        inspector.within(node, selector).map((found) => declaration(inspector, found)),
      box: () => inspector.box(node),
      bounds: () => inspector.bounds(node),
      lines: () => inspector.lines(node),
      containment: () => inspector.containment(node),
      raw: (property) => inspector.style(node, property),
      px: (property) => Number.parseFloat(inspector.style(node, property)) || 0,
      colour: (property) => inspector.colour(node, property),
      backdrop: () => inspector.backdrop(node),
      painted: (selector) => sample(node, subject, inspector.within(node, selector)),
    };
  };

  body({
    declared: (selector) => inspector.all(selector).map((node) => declaration(inspector, node)),
    painted: (selector) => sample(DOCUMENT, DOCUMENT_SUBJECT, inspector.all(selector)),
    viewport: () => inspector.viewport(),
  });

  const unclaimed = [...held].filter((node) => !settled.has(node));
  if (unclaimed.length > 0) admit(DOCUMENT_SUBJECT, detail(unclaimed.length));
}
