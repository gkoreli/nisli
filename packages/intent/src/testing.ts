/**
 * testing.ts — the reason the domain takes ports.
 *
 * Lives in `src/` beside the code it doubles, and `tsconfig.build.json`
 * excludes it from the published output. That is the router's precedent with
 * `navigation-double.ts`: a test double the default exclude list would happily
 * ship. It is source rather than a test file because both halves of the package
 * need it — the fit domain wants `FakeWorld`, the diagnostics domain wants
 * `FakeInspector` — and a shared double that lives under `test/` cannot be
 * imported by tests that live beside their source.
 *
 * `Metrics`, `Mutator` and `Inspector` exist so that every appearance DECISION
 * can be exercised without a layout engine. happy-dom has no layout: asking it
 * for `scrollWidth` returns 0, so a "DOM" test of the solver would assert
 * nothing at all. These fakes model geometry explicitly instead, which makes
 * the three layout regimes that matter reproducible on demand:
 *
 *   crush: false — children keep their content width, the container overflows.
 *   crush: true  — children are squeezed below their content width, so the
 *                  container reports no overflow whatsoever while its children
 *                  paint over each other. That is defect F8, and it is simply
 *                  not reachable through a container-only overflow test.
 *   a child with  — the child SHEDS inline space instead of overflowing, down
 *   `minimum`      to its own min-content floor, and pays for what it shed in
 *                  the block axis by reflowing onto more line boxes. The
 *                  container then reports no overflow AND no crush, because
 *                  the content made itself exactly as wide as the box it was
 *                  given, while the row stands many times the height it was
 *                  declared for. That is the block-axis half of F8, and it is
 *                  unreachable through EITHER inline predicate.
 *
 * The third regime is a property of a CHILD rather than of the world, because
 * that is where it is a property in the real table: `[data-layout] *` resolves
 * to `flex: none`, so the only element in a row that may shed inline space at
 * all is one that declared `data-grow` — and `min-inline-size: 0` is
 * deliberately NOT granted with it, so the shedding stops at min-content.
 * min-content for a run of prose is its LONGEST WORD, which is what turns a
 * "floor" into a licence to reflow a sentence down a one-word column.
 *
 * Nodes are plain string ids; the world holds all the state.
 */
import type {
  Backdrop,
  Bounds,
  Box,
  Containment,
  FitState,
  Inspector,
  LayoutKind,
  Metrics,
  Mutator,
  Rgba,
  Strategy,
} from './contracts.js';

/* ══════════════════════════════════════════════════════════════════════════
   1. A fake layout world, for Metrics and Mutator
   ══════════════════════════════════════════════════════════════════════════ */

export interface ChildSpec {
  readonly id: string;
  /** Inline size the content wants at full fidelity. */
  readonly intrinsic: number;
  /**
   * Inline size the content wants once clamped to one line. Defaults to
   * `intrinsic` — truncation that buys nothing, i.e. the no-op strategy that
   * a solver must survive without spinning.
   */
  readonly clamped?: number;
  /**
   * Inline size below which this child's CONTENT cannot reflow — its
   * min-content, which for a run of prose is the width of its longest word.
   *
   * Declaring it turns the child into a reflowing one, and that is the third
   * regime this file exists to make reachable. A reflowing child absorbs the
   * container's deficit by shedding inline space down to this floor INSTEAD of
   * overflowing, and pays for every unit it shed in the block axis: its content
   * is exactly as wide as the box it ended up with, so nothing overflows and
   * nothing is crushed, and it is correspondingly taller. Omit it and the child
   * is rigid, which is every fixture written before this existed.
   *
   * Squeezed BELOW the floor — only reachable with `crush`, which models the
   * table granting `min-inline-size: 0` — the content stops reflowing and
   * starts overflowing again, because there is nowhere left to break.
   */
  readonly minimum?: number;
  readonly text?: string;
  /** Collapsed before solving ever starts, e.g. an inactive tab panel (F4). */
  readonly rendered?: boolean;
  /**
   * Geometry that cannot be trusted, because this child or an ancestor is
   * skipped by `content-visibility: auto`. Defaults to measurable.
   *
   * The solver needs this modelled rather than assumed: css-contain-2 states
   * that skipped contents never change size and that the resize observation is
   * delivered only once they stop being skipped, so a container inside a skipped
   * subtree is never re-solved at all.
   */
  readonly measurable?: boolean;
  /**
   * What happens to this child's own overflow. Defaults to `visible`, which is
   * the only value that lets content paint over a neighbour and therefore the
   * only one the crush model reacts to.
   */
  readonly containment?: Containment;
}

export interface WorldSpec {
  readonly container?: string;
  /** Inline size the container is given. Never changes. */
  readonly available: number;
  readonly children: readonly ChildSpec[];
  /**
   * What the container DECLARED about how its children relate. Defaults to
   * `row`, which is what every fixture written before this assumed.
   *
   * It is here because one predicate is gated on it and must be: block-axis
   * growth is a defect in a `row`, which resolves to one line of children, and
   * is the entire purpose of a `stack`. The fake models the declaration rather
   * than a height so a fixture can prove the distinction is made by the
   * DECLARATION — the same geometry, twice, with two verdicts.
   */
  readonly layout?: LayoutKind;
  /**
   * Inline size the container's overflow trigger occupies once revealed. The
   * `menu` strategy is not free: it removes a child and adds a button, so a
   * solver that measures before revealing can settle on geometry that stops
   * being true a moment later. Defaults to 0, which models a trigger that is
   * always present in the flow.
   */
  readonly trigger?: number;
  readonly crush?: boolean;
  /** The container's own geometry cannot be trusted. See `ChildSpec.measurable`. */
  readonly measurable?: boolean;
  /** What happens to the container's own overflow. Defaults to `visible`. */
  readonly containment?: Containment;
}

const BLOCK = 10;

/** One mutation the solver performed, in order. */
export interface Mutation {
  readonly kind: 'apply' | 'clear';
  readonly node: string;
  readonly strategy?: Strategy;
}

export class FakeWorld {
  readonly container: string;
  readonly metrics: Metrics<string>;
  readonly mutator: Mutator<string>;

  readonly mutations: Mutation[] = [];
  readonly marks: { state: FitState; collapsed: number }[] = [];
  readonly reveals: boolean[] = [];

  private readonly available: number;
  private readonly crush: boolean;
  private readonly trigger: number;
  private readonly children: readonly ChildSpec[];
  private triggerShown = false;
  private readonly applied = new Map<string, Strategy>();
  private readonly boxes = new Map<string, Box>();
  private readonly lines = new Map<string, number>();
  private readonly declaredLayout: LayoutKind;
  private readonly containerMeasurable: boolean;
  private readonly containerContainment: Containment;

  constructor(spec: WorldSpec) {
    this.container = spec.container ?? 'container';
    this.available = spec.available;
    this.crush = spec.crush === true;
    this.trigger = spec.trigger ?? 0;
    this.children = spec.children;
    this.containerMeasurable = spec.measurable !== false;
    this.containerContainment = spec.containment ?? 'visible';
    this.declaredLayout = spec.layout ?? 'row';
    this.layout();

    this.metrics = {
      box: (node) => this.boxOf(node),
      overflows: (node) => {
        const box = this.boxOf(node);
        return box.contentInline > box.inline + 1;
      },
      // Descendants only. Three exemptions, mirroring the adapter so a solver
      // decision is reproducible without a browser: a node that declared
      // truncation asked to be clipped, and a node whose containment is not
      // `visible` either scrolls its overflow (reachable) or clips it (deleted)
      // — neither paints over a neighbour, so neither is something the solver
      // can relieve by degrading siblings.
      crushed: (node) =>
        node === this.container &&
        this.children.some((child) => {
          if (!this.inFlow(child) || this.applied.get(child.id) === 'truncate') return false;
          if ((child.containment ?? 'visible') !== 'visible') return false;
          const box = this.boxOf(child.id);
          return box.contentInline > box.inline + 1;
        }),
      // Gated on the DECLARATION first, exactly as the adapter is: the same
      // reflowed child is a defect in a `row`, which put its children on one
      // line, and is unremarkable in a `stack`, which flows down the block axis
      // on purpose. A fixture proves that by changing one word and nothing else.
      //
      // The two exemptions mirror `crushed` above for the same reasons: a
      // truncated node was clamped to one line by the table and cannot wrap,
      // and a node whose containment is not `visible` absorbed its own growth,
      // so the container never paid for it.
      wrapped: (node) =>
        node === this.container &&
        this.declaredLayout === 'row' &&
        this.children.some((child) => {
          if (!this.inFlow(child) || this.applied.get(child.id) === 'truncate') return false;
          if ((child.containment ?? 'visible') !== 'visible') return false;
          return (this.lines.get(child.id) ?? 1) > 1;
        }),
      rendered: (node) => {
        if (node === this.container) return true;
        return this.inFlow(this.spec(node));
      },
      measurable: (node) => {
        if (node === this.container) return this.containerMeasurable;
        return this.spec(node).measurable !== false;
      },
      containment: (node) => {
        if (node === this.container) return this.containerContainment;
        return this.spec(node).containment ?? 'visible';
      },
      style: (node, property) => (property === '--intent-unit' ? '4px' : `${node}:${property}`),
    };

    this.mutator = {
      apply: (node, strategy) => {
        this.mutations.push({ kind: 'apply', node, strategy });
        this.applied.set(node, strategy);
        this.layout();
      },
      clear: (node) => {
        this.mutations.push({ kind: 'clear', node });
        this.applied.delete(node);
        this.layout();
      },
      markFit: (_container, state, collapsed) => {
        this.marks.push({ state, collapsed });
      },
      revealOverflow: (_container, reveal) => {
        this.reveals.push(reveal);
        this.triggerShown = reveal;
        this.layout();
      },
    };
  }

  /** What ended up applied to each child — the decision, without the log. */
  outcome(): Record<string, Strategy | 'none'> {
    const out: Record<string, Strategy | 'none'> = {};
    for (const child of this.children) out[child.id] = this.applied.get(child.id) ?? 'none';
    return out;
  }

  private spec(id: string): ChildSpec {
    const found = this.children.find((c) => c.id === id);
    if (!found) throw new Error(`FakeWorld: unknown node "${id}"`);
    return found;
  }

  private boxOf(id: string): Box {
    const box = this.boxes.get(id);
    if (!box) throw new Error(`FakeWorld: unknown node "${id}"`);
    return box;
  }

  private inFlow(child: ChildSpec): boolean {
    if (child.rendered === false) return false;
    const strategy = this.applied.get(child.id);
    return strategy !== 'hide' && strategy !== 'menu';
  }

  /** Inline size this child asks for under the strategy currently applied. */
  private wants(child: ChildSpec): number {
    if (this.applied.get(child.id) !== 'truncate') return child.intrinsic;
    return Math.min(child.intrinsic, child.clamped ?? child.intrinsic);
  }

  /**
   * Inline size this child can shed down to without its content overflowing.
   *
   * A rigid child cannot shed at all, so its floor IS what it wants. A
   * reflowing one stops at min-content. Truncation ends the reflow: the table
   * resolves it to one clamped line with an ellipsis, so a truncated child is
   * rigid again at its clamped width — which is what makes the strategy pay out
   * against this defect rather than being spent for nothing.
   */
  private floor(child: ChildSpec): number {
    const wants = this.wants(child);
    if (child.minimum === undefined) return wants;
    if (this.applied.get(child.id) === 'truncate') return wants;
    return Math.min(child.minimum, wants);
  }

  private layout(): void {
    this.boxes.clear();
    this.lines.clear();
    const inFlow = this.children.filter((c) => this.inFlow(c));
    const trigger = this.triggerShown ? this.trigger : 0;
    let total = trigger;
    for (const child of inFlow) total += this.wants(child);

    // First the shed, because it happens BEFORE anything overflows: a child
    // that can reflow gives up inline space to relieve the container, in
    // declaration order and never past its own floor. This is the grow region
    // absorbing the row's deficit, and the deficit it absorbs is the overflow
    // the container would otherwise have reported.
    const given = new Map<string, number>();
    let deficit = total - this.available;
    for (const child of inFlow) {
      const wants = this.wants(child);
      const shed = deficit > 0 ? Math.min(deficit, wants - this.floor(child)) : 0;
      deficit -= shed;
      given.set(child.id, wants - shed);
    }

    let used = trigger;
    for (const child of inFlow) used += given.get(child.id) ?? 0;

    // Then the squeeze, which is what the browser applied before the theme
    // forbade shrinking: everything scales down so the row "fits", regardless
    // of how much space the content actually needs. It stacks on top of the
    // shed rather than replacing it, because a table that grants
    // `min-inline-size: 0` takes a reflowing child below its floor too.
    const squeeze = this.crush && used > this.available ? this.available / used : 1;

    let tallest = BLOCK;
    for (const child of this.children) {
      if (!this.inFlow(child)) {
        this.boxes.set(child.id, { inline: 0, block: 0, contentInline: 0 });
        this.lines.set(child.id, 0);
        continue;
      }
      const wants = this.wants(child);
      const inline = Math.round((given.get(child.id) ?? wants) * squeeze);
      // Content narrower than the box it wanted either reflows or overflows,
      // and the floor is what decides which. Above the floor the content is
      // exactly as wide as the box — no overflow, no crush, and one more line
      // box for every multiple of the box the content would have needed.
      // Below it there is nothing left to break, so it overflows again and the
      // inline predicates can see it.
      const held = Math.max(inline, this.floor(child));
      const reflowed = held < wants && held > 0;
      const lines = reflowed ? Math.ceil(wants / held) : 1;
      this.boxes.set(child.id, {
        inline,
        block: BLOCK * lines,
        contentInline: reflowed ? held : wants,
      });
      this.lines.set(child.id, lines);
      tallest = Math.max(tallest, BLOCK * lines);
    }

    // A row is as tall as its tallest child, so reflow is what makes the
    // container itself grow — the measurement the false PASS was hiding.
    this.boxes.set(this.container, {
      inline: this.available,
      block: tallest,
      contentInline: squeeze === 1 ? used : this.available,
    });
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   2. A fake Inspector, for diagnostics
   ══════════════════════════════════════════════════════════════════════════ */

export interface InspectSpec {
  readonly id: string;
  /**
   * Element name, for the rules that exclude document furniture by tag. Nodes
   * without one match no tag selector, which is what a bare fake node is: an
   * anonymous box in the appearance tree.
   */
  readonly tag?: string;
  readonly attrs?: Readonly<Record<string, string>>;
  readonly styles?: Readonly<Record<string, string>>;
  readonly text?: string;
  readonly rendered?: boolean;
  /**
   * Content that IS there and whose geometry cannot be trusted, because this
   * node or an ancestor is skipped by `content-visibility: auto`. Defaults to
   * measurable.
   *
   * Deliberately independent of `rendered`, exactly as the adapter is. A skipped
   * node is not rendered AND not measurable, and the two answers are needed
   * separately: `rendered: false` alone is how a rule gets to `continue`, which
   * is the false PASS. Reach these nodes with `declared()`.
   */
  readonly measurable?: boolean;
  /**
   * What happens to content that does not fit this node.
   *
   * Derived from `styles['overflow-x']` and `styles['overflow-y']` when absent,
   * because that is what a fixture can honestly know from what it declared, and
   * because twenty recorded fixtures already spell a scroller that way.
   *
   * Declare it explicitly for a clipper that does not spell itself in
   * `overflow` at all — measured, Chromium 151: `contain: paint` and
   * `contain: content` clip while BOTH overflow axes compute to `visible`. That
   * case is exactly why the port answers this question itself instead of letting
   * each call site read a property, and it is the one case a fixture cannot
   * derive.
   */
  readonly containment?: Containment;
  readonly box?: Partial<Box>;
  /**
   * Border box AND its origin. Omitted in almost every fixture on purpose: the
   * default derives the extent from `box` plus the declared border longhands and
   * puts the origin at 0/0, so a fixture that says nothing about borders gets
   * `bounds === box` and reads the way a reviewer expects. Set it explicitly to
   * test a transform, a fractional rect, or a rect-against-rect claim — N713 and
   * N715 are entirely about where rectangles SIT, so their fixtures always do.
   */
  readonly bounds?: Partial<Bounds>;
  /**
   * How many line boxes this node's own text occupies. Defaults to 0 — no text
   * of its own — which is what a bare fixture node is.
   *
   * DECLARED, never derived from `box` and a line height, and the difference is
   * the point: deriving it here would make the fake agree with the arithmetic
   * N690 uses precisely where that arithmetic is known to be wrong (a padded
   * box, a hit-target floor, `line-height: normal`), so every fixture would
   * confirm the approximation instead of the browser. The adapter counts
   * rectangles; a fixture states the count it wants to model.
   */
  readonly lines?: number;
  /** Nearest painted background behind the node, as a colour string. */
  readonly backdrop?: string;
  /**
   * Colours already resolved to sRGB, keyed by property. This is how the fake
   * models the browser adapter, which resolves by painting on a canvas: a
   * fixture that wants a DERIVED foreground declares
   * `styles: { color: 'oklab(0.7 0 0)' }` for the message and
   * `colours: { color: [178, 178, 178, 1] }` for the number. An explicit `null`
   * models a value the adapter could not resolve at all.
   */
  readonly colours?: Readonly<Record<string, Rgba | null>>;
  /**
   * `opacity` on this node. Below 1 it fades everything inside it, so no
   * contrast claim about descendant text is supportable — the shipped disabled
   * action was reported at 18.85:1 while painting 3.03:1 through exactly this.
   */
  readonly opacity?: number;
  /**
   * A `background-image` (or "this element paints its own content", for a video
   * or canvas). Any non-empty value means no single colour is behind the text.
   */
  readonly backdropImage?: string;
  readonly children?: readonly InspectSpec[];
}

export interface InspectWorldSpec {
  readonly nodes: readonly InspectSpec[];
  readonly viewport?: { readonly inline: number; readonly documentInline: number };
}

const ZERO_BOX: Box = { inline: 0, block: 0, contentInline: 0 };
const ZERO_BOUNDS: Bounds = { inline: 0, block: 0, inlineStart: 0, blockStart: 0 };

/**
 * Read a colour out of a FIXTURE string. Understands `#rgb`, `#rrggbb`, `rgb()`
 * and `rgba()` — the two spellings the recorded fixtures already use — and
 * returns null for everything else.
 *
 * THIS IS NOT A MODEL OF THE BROWSER, and the difference is the whole point of
 * the change it accompanies. The DOM adapter resolves colour by PAINTING on a
 * 1×1 canvas, because a derived table computes to `oklab(…)` and the parser that
 * did not know that syntax took 288 of 1188 measured text cells from checked to
 * undecidable. happy-dom has no 2D canvas context, so a reader here is the only
 * way a fixture can carry a colour at all — and it deliberately understands
 * LESS than the browser rather than more. A fixture that wants to model a
 * derived colour supplies the resolved triple in `colours`, which is exactly
 * what the compositor hands the adapter; a fixture that supplies `oklab(…)` and
 * no triple models an adapter that could not resolve it, and gets N680. Both
 * directions are testable without this pretending to understand colour.
 */
function fixtureColour(value: string): Rgba | null {
  const text = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const digits = hex[1] as string;
    const pairs =
      digits.length === 3
        ? [...digits].map((digit) => digit + digit)
        : [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)];
    const [red = 0, green = 0, blue = 0] = pairs.map((pair) => Number.parseInt(pair, 16));
    return [red, green, blue, 1];
  }
  const functional = /^rgba?\(([^)]*)\)$/i.exec(text);
  if (!functional) return null;
  const numbers = (functional[1] as string)
    .split(/[\s,/]+/)
    .filter((part) => part !== '')
    .map(Number);
  const [red, green, blue, alpha] = numbers;
  if (red === undefined || green === undefined || blue === undefined) return null;
  if (numbers.some(Number.isNaN)) return null;
  return [red, green, blue, alpha ?? 1];
}

/* ── A selector engine just wide enough for the rules ───────────────────────
   The rules address the document through tag names, attribute selectors, `*`,
   the child and descendant combinators and `:last-child`. Supporting exactly
   that — and throwing on anything else — keeps the fake honest: a rule that
   grows a new selector shape fails here loudly instead of quietly matching
   nothing, which is how an oracle turns into decoration. */

interface Compound {
  readonly any: boolean;
  readonly tag?: string;
  readonly attrs: readonly { readonly name: string; readonly value?: string }[];
  readonly lastChild: boolean;
}

const ATTR_PART = /^\[([-\w]+)(?:="([^"]*)")?\]$/;

function parseCompound(source: string): Compound {
  let rest = source.trim();
  let any = false;
  let tag: string | undefined;
  if (rest.startsWith('*')) {
    any = true;
    rest = rest.slice(1);
  } else {
    const name = /^[a-zA-Z][-\w]*/.exec(rest);
    if (name) {
      tag = name[0].toLowerCase();
      rest = rest.slice(name[0].length);
    }
  }
  const attrs: { name: string; value?: string }[] = [];
  let lastChild = false;
  while (rest.length > 0) {
    if (rest.startsWith(':last-child')) {
      lastChild = true;
      rest = rest.slice(':last-child'.length);
      continue;
    }
    const close = rest.indexOf(']');
    if (!rest.startsWith('[') || close < 0) {
      throw new Error(`FakeInspector: unsupported selector fragment "${source}"`);
    }
    const parsed = ATTR_PART.exec(rest.slice(0, close + 1));
    if (!parsed) throw new Error(`FakeInspector: unsupported selector fragment "${source}"`);
    const name = parsed[1] as string;
    attrs.push(parsed[2] === undefined ? { name } : { name, value: parsed[2] });
    rest = rest.slice(close + 1);
  }
  if (!any && tag === undefined && attrs.length === 0 && !lastChild) {
    throw new Error(`FakeInspector: empty selector fragment in "${source}"`);
  }
  return { any, tag, attrs, lastChild };
}

/** A compound sequence plus the combinator that joins it to the previous one. */
interface Step {
  readonly combinator: ' ' | '>';
  readonly compound: Compound;
}

function parseGroup(group: string): Step[] {
  const tokens = group.trim().split(/\s+/);
  const steps: Step[] = [];
  let combinator: ' ' | '>' = ' ';
  for (const token of tokens) {
    if (token === '>') {
      combinator = '>';
      continue;
    }
    steps.push({ combinator, compound: parseCompound(token) });
    combinator = ' ';
  }
  if (steps.length === 0) throw new Error(`FakeInspector: empty selector group "${group}"`);
  return steps;
}

export class FakeInspector implements Inspector<string> {
  private readonly order: InspectSpec[] = [];
  private readonly byId = new Map<string, InspectSpec>();
  private readonly parents = new Map<string, string | null>();
  private readonly lastChildren = new Set<string>();
  private readonly port: { readonly inline: number; readonly documentInline: number };

  constructor(spec: InspectWorldSpec) {
    this.port = spec.viewport ?? { inline: 1024, documentInline: 1024 };
    const visit = (nodes: readonly InspectSpec[], parent: string | null): void => {
      nodes.forEach((node, index) => {
        if (this.byId.has(node.id)) throw new Error(`FakeInspector: duplicate node "${node.id}"`);
        this.order.push(node);
        this.byId.set(node.id, node);
        this.parents.set(node.id, parent);
        if (index === nodes.length - 1) this.lastChildren.add(node.id);
        if (node.children) visit(node.children, node.id);
      });
    };
    visit(spec.nodes, null);
  }

  private node(id: string): InspectSpec {
    const found = this.byId.get(id);
    if (!found) throw new Error(`FakeInspector: unknown node "${id}"`);
    return found;
  }

  private matchesCompound(id: string, compound: Compound): boolean {
    if (compound.lastChild && !this.lastChildren.has(id)) return false;
    const node = this.byId.get(id);
    if (compound.tag !== undefined && node?.tag?.toLowerCase() !== compound.tag) return false;
    const attrs = node?.attrs;
    return compound.attrs.every((want) => {
      const value = attrs?.[want.name];
      if (value === undefined) return false;
      return want.value === undefined || value === want.value;
    });
  }

  private matchesGroup(id: string, steps: readonly Step[]): boolean {
    const last = steps[steps.length - 1];
    if (!last || !this.matchesCompound(id, last.compound)) return false;
    let current: string | null = id;
    for (let i = steps.length - 1; i > 0; i--) {
      const step = steps[i] as Step;
      const previous = steps[i - 1] as Step;
      if (step.combinator === '>') {
        current = this.parents.get(current as string) ?? null;
        if (current === null || !this.matchesCompound(current, previous.compound)) return false;
        continue;
      }
      let ancestor: string | null = this.parents.get(current as string) ?? null;
      while (ancestor !== null && !this.matchesCompound(ancestor, previous.compound)) {
        ancestor = this.parents.get(ancestor) ?? null;
      }
      if (ancestor === null) return false;
      current = ancestor;
    }
    return true;
  }

  all(selector: string): readonly string[] {
    const groups = selector.split(',').map(parseGroup);
    return this.order
      .filter((node) => groups.some((steps) => this.matchesGroup(node.id, steps)))
      .map((node) => node.id);
  }

  /**
   * `querySelectorAll` semantics, deliberately: the selector is matched against
   * the whole document and the results are then narrowed to this subtree. A
   * scoped selector that happens to match an ancestor must not leak in.
   */
  within(node: string, selector: string): readonly string[] {
    this.node(node);
    return this.all(selector).filter((id) => {
      for (let up = this.parents.get(id) ?? null; up !== null; up = this.parents.get(up) ?? null) {
        if (up === node) return true;
      }
      return false;
    });
  }

  attr(node: string, name: string): string | null {
    return this.node(node).attrs?.[name] ?? null;
  }

  text(node: string): string {
    return this.node(node).text ?? '';
  }

  describe(node: string): string {
    return node;
  }

  rendered(node: string): boolean {
    return this.node(node).rendered !== false;
  }

  measurable(node: string): boolean {
    // Ancestor-aware, like the browser's `checkVisibility()`: skipping is
    // inherited by the whole subtree, so a fixture declares it once on the
    // container and every descendant answers false. Declaring it per node would
    // let a fixture describe a shape the browser cannot produce.
    for (let up: string | null = node; up !== null; up = this.parents.get(up) ?? null) {
      if (this.node(up).measurable === false) return false;
    }
    return true;
  }

  containment(node: string): Containment {
    const spec = this.node(node);
    if (spec.containment !== undefined) return spec.containment;
    // Derived from what the fixture declared, with the same polarity and the
    // same precedence as the adapter: reachability wins over clipping, and an
    // unknown or absent value fails safe to `visible` so a rule stays LOUD
    // rather than going vacuously quiet.
    const axes = [this.style(node, 'overflow-x'), this.style(node, 'overflow-y')];
    if (axes.some((value) => value === 'auto' || value === 'scroll')) return 'scroll';
    if (axes.some((value) => value === 'hidden' || value === 'clip')) return 'clip';
    return 'visible';
  }

  box(node: string): Box {
    return { ...ZERO_BOX, ...this.node(node).box };
  }

  private edge(node: string, property: string): number {
    return Number.parseFloat(this.style(node, property)) || 0;
  }

  bounds(node: string): Bounds {
    const declared = this.node(node).bounds;
    if (declared) return { ...ZERO_BOUNDS, ...declared };
    const box = this.box(node);
    return {
      inline:
        box.inline +
        this.edge(node, 'border-inline-start-width') +
        this.edge(node, 'border-inline-end-width'),
      block:
        box.block +
        this.edge(node, 'border-block-start-width') +
        this.edge(node, 'border-block-end-width'),
      // A fixture that says nothing about position gets the origin the reviewer
      // expects. Every rect-against-rect fixture declares `bounds` in full.
      inlineStart: 0,
      blockStart: 0,
    };
  }

  lines(node: string): number {
    return this.node(node).lines ?? 0;
  }

  style(node: string, property: string): string {
    return this.node(node).styles?.[property] ?? '';
  }

  colour(node: string, property: string): Rgba | null {
    const supplied = this.node(node).colours?.[property];
    if (supplied !== undefined) return supplied;
    return fixtureColour(this.style(node, property));
  }

  backdrop(node: string): Backdrop {
    // The same walk the DOM adapter performs, over fixture data, in the same
    // order: anything that fades or covers the stack defeats the claim before
    // the question of WHICH colour is reached.
    for (let up: string | null = node; up !== null; up = this.parents.get(up) ?? null) {
      const spec = this.node(up);
      if (spec.opacity !== undefined && spec.opacity < 1) {
        return {
          kind: 'faded',
          colour: null,
          detail: `opacity ${spec.opacity} on ${up} composites the text with what is behind it`,
        };
      }
      if (spec.backdropImage !== undefined && spec.backdropImage !== '') {
        return {
          kind: 'image',
          colour: null,
          detail: `${up} paints ${spec.backdropImage}, so no single colour is behind this text`,
        };
      }
      if (spec.backdrop === undefined) continue;
      const painted = fixtureColour(spec.backdrop);
      if (painted === null) {
        return {
          kind: 'unresolvable',
          colour: null,
          detail: `cannot resolve ${spec.backdrop || '<empty>'}`,
        };
      }
      if (painted[3] === 0) continue; // paints nothing; keep walking outward
      if (painted[3] < 1) {
        return {
          kind: 'faded',
          colour: null,
          detail: `${spec.backdrop} on ${up} is translucent, so the text sits on a composite of two layers`,
        };
      }
      return { kind: 'painted', colour: painted, detail: spec.backdrop };
    }
    return { kind: 'painted', colour: [255, 255, 255, 1], detail: 'canvas' };
  }

  viewport(): { readonly inline: number; readonly documentInline: number } {
    return this.port;
  }
}
