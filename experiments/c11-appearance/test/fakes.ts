/**
 * fakes.ts — the reason the domain takes ports.
 *
 * `Metrics`, `Mutator` and `Inspector` exist so that every appearance DECISION
 * can be exercised without a layout engine. happy-dom has no layout: asking it
 * for `scrollWidth` returns 0, so a "DOM" test of the solver would assert
 * nothing at all. These fakes model geometry explicitly instead, which makes
 * the two layout regimes that matter reproducible on demand:
 *
 *   crush: false — children keep their content width, the container overflows.
 *   crush: true  — children are squeezed below their content width, so the
 *                  container reports no overflow whatsoever while its children
 *                  paint over each other. That is defect F8, and it is simply
 *                  not reachable through a container-only overflow test.
 *
 * Nodes are plain string ids; the world holds all the state.
 */
import type {
  Box,
  FitState,
  Inspector,
  Metrics,
  Mutator,
  Strategy,
} from '../src/appearance/contracts.js';

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
  readonly text?: string;
  /** Collapsed before solving ever starts, e.g. an inactive tab panel (F4). */
  readonly rendered?: boolean;
}

export interface WorldSpec {
  readonly container?: string;
  /** Inline size the container is given. Never changes. */
  readonly available: number;
  readonly children: readonly ChildSpec[];
  /**
   * Inline size the container's overflow trigger occupies once revealed. The
   * `menu` strategy is not free: it removes a child and adds a button, so a
   * solver that measures before revealing can settle on geometry that stops
   * being true a moment later. Defaults to 0, which models a trigger that is
   * always present in the flow.
   */
  readonly trigger?: number;
  readonly crush?: boolean;
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

  constructor(spec: WorldSpec) {
    this.container = spec.container ?? 'container';
    this.available = spec.available;
    this.crush = spec.crush === true;
    this.trigger = spec.trigger ?? 0;
    this.children = spec.children;
    this.layout();

    this.metrics = {
      box: (node) => this.boxOf(node),
      overflows: (node) => {
        const box = this.boxOf(node);
        return box.contentInline > box.inline + 1;
      },
      // Descendants only, and a node that declared truncation is exempt: it
      // asked to be clipped, so content wider than its box is intentional.
      crushed: (node) =>
        node === this.container &&
        this.children.some((child) => {
          if (!this.inFlow(child) || this.applied.get(child.id) === 'truncate') return false;
          const box = this.boxOf(child.id);
          return box.contentInline > box.inline + 1;
        }),
      rendered: (node) => {
        if (node === this.container) return true;
        return this.inFlow(this.spec(node));
      },
      style: (node, property) => (property === '--unit' ? '4px' : `${node}:${property}`),
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

  private layout(): void {
    this.boxes.clear();
    const inFlow = this.children.filter((c) => this.inFlow(c));
    let total = this.triggerShown ? this.trigger : 0;
    for (const child of inFlow) total += this.wants(child);

    // The squeeze factor is what the browser applied before the theme forbade
    // shrinking: everything scales down so the row "fits", regardless of how
    // much space the content actually needs.
    const squeeze = this.crush && total > this.available ? this.available / total : 1;

    for (const child of this.children) {
      const wants = this.wants(child);
      this.boxes.set(
        child.id,
        this.inFlow(child)
          ? { inline: Math.round(wants * squeeze), block: BLOCK, contentInline: wants }
          : { inline: 0, block: 0, contentInline: 0 },
      );
    }

    this.boxes.set(this.container, {
      inline: this.available,
      block: BLOCK,
      contentInline: squeeze === 1 ? total : this.available,
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
  readonly box?: Partial<Box>;
  /** Nearest painted background behind the node. */
  readonly backdrop?: string;
  readonly children?: readonly InspectSpec[];
}

export interface InspectWorldSpec {
  readonly nodes: readonly InspectSpec[];
  readonly viewport?: { readonly inline: number; readonly documentInline: number };
}

const ZERO_BOX: Box = { inline: 0, block: 0, contentInline: 0 };

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

  box(node: string): Box {
    return { ...ZERO_BOX, ...this.node(node).box };
  }

  style(node: string, property: string): string {
    return this.node(node).styles?.[property] ?? '';
  }

  backdrop(node: string): string {
    return this.node(node).backdrop ?? 'rgb(255, 255, 255)';
  }

  viewport(): { readonly inline: number; readonly documentInline: number } {
    return this.port;
  }
}
