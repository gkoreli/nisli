/**
 * contracts.ts — the seam every other module codes against.
 *
 * Architecture: ports and adapters. The domain (vocabulary, fit solving,
 * diagnostics) is PURE and knows nothing about the DOM; it reads geometry and
 * writes decisions through the ports below. The DOM adapters are the only code
 * allowed to touch `HTMLElement`, `getComputedStyle` or `getBoundingClientRect`.
 *
 * Why this shape, for an experiment that might graduate:
 *   - the solver becomes testable without a browser (drive it with a fake
 *     Metrics implementation and assert the decisions);
 *   - the diagnostic rules become a list of pure functions over an Inspector,
 *     so adding a rule is adding one file with one test;
 *   - if this graduates into @nisli/core, the domain moves unchanged and only
 *     the adapters are reviewed for byte cost.
 *
 * NOTHING in this file imports anything. It is the shared vocabulary.
 */

/* ══════════════════════════════════════════════════════════════════════════
   1. The closed vocabulary — value types
   ══════════════════════════════════════════════════════════════════════════ */

/** Structural composition. */
export type LayoutKind = 'row' | 'stack' | 'wrap' | 'grid';

/** What a painted element IS. */
export type AppearanceRole = 'action' | 'avatar' | 'field' | 'nav-item' | 'table' | 'surface';

/** Emphasis within a role. */
export type Emphasis = 'primary' | 'quiet' | 'danger' | 'link';

/** Semantic text level. */
export type TextRole = 'display' | 'title' | 'body' | 'meta' | 'label';

/** Context axes — the only inputs that change resolved values. */
export type Density = 'comfortable' | 'compact' | 'dense';
export type InputMode = 'pointer' | 'touch';
export type ThemeName = 'light' | 'dark';

/** Importance for fit solving. 1 survives longest, 5 degrades first. */
export type Priority = 1 | 2 | 3 | 4 | 5;

/**
 * What to do with a candidate that will not fit.
 *
 * `truncate` — clamp to one ellipsised line. Only valid for prose-like text;
 *              short atomic values degrade to garbage ("1…", "Y…"), which is
 *              finding F5 and the reason `hide` exists.
 * `hide`     — remove from the flow entirely, with no overflow affordance.
 *              Correct for decoration and for values repeated elsewhere.
 * `menu`     — move into the container's overflow trigger; the actions stay
 *              reachable, so this is the only strategy valid for controls.
 */
export type Strategy = 'truncate' | 'hide' | 'menu';

export const STRATEGIES: readonly Strategy[] = ['truncate', 'hide', 'menu'];

/** The complete legal vocabulary, as data. One page, enumerable, checkable. */
export const VOCABULARY = {
  layout: ['row', 'stack', 'wrap', 'grid'],
  appearance: ['action', 'avatar', 'field', 'nav-item', 'table', 'surface'],
  emphasis: ['primary', 'quiet', 'danger', 'link'],
  text: ['display', 'title', 'body', 'meta', 'label'],
  density: ['comfortable', 'compact', 'dense'],
  input: ['pointer', 'touch'],
  theme: ['light', 'dark'],
  collapse: ['truncate', 'hide', 'menu'],
} as const satisfies Record<string, readonly string[]>;

/* ══════════════════════════════════════════════════════════════════════════
   2. Geometry — the values the domain is allowed to know
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Logical-axis box. `contentInline` is the width the content WANTS; `inline` is
 * the width it GOT. `contentInline > inline` means the element was crushed and
 * its content is painting outside its box — the defect class that made a
 * container-only overflow test report `settled` on a visibly broken row (F8).
 */
export interface Box {
  readonly inline: number;
  readonly block: number;
  readonly contentInline: number;
}

/** Read-only geometry and style access. Implemented by the DOM adapter. */
export interface Metrics<TNode> {
  box(node: TNode): Box;
  /** Container's own overflow: content wider than its content box. */
  overflows(node: TNode): boolean;
  /** Any descendant painting outside its own box, ignoring declared truncation. */
  crushed(node: TNode): boolean;
  /** Is the node actually rendered? A precondition for every measurement (F4). */
  rendered(node: TNode): boolean;
  style(node: TNode, property: string): string;
}

/* ══════════════════════════════════════════════════════════════════════════
   3. Fit solving
   ══════════════════════════════════════════════════════════════════════════ */

export interface Candidate<TNode> {
  readonly node: TNode;
  readonly priority: Priority;
  readonly strategy: Strategy;
}

export type FitState = 'settled' | 'unsatisfiable';

export interface Degradation<TNode> {
  readonly node: TNode;
  readonly strategy: Strategy;
}

export interface FitOutcome<TNode> {
  readonly state: FitState;
  readonly applied: readonly Degradation<TNode>[];
  /** Passes taken. Diagnostic: a high count means the strategy order is poor. */
  readonly passes: number;
}

/** Write side of solving. The only code that mutates the document. */
export interface Mutator<TNode> {
  apply(node: TNode, strategy: Strategy): void;
  clear(node: TNode): void;
  markFit(container: TNode, state: FitState, collapsed: number): void;
  revealOverflow(container: TNode, reveal: boolean): void;
}

/* ══════════════════════════════════════════════════════════════════════════
   4. Diagnostics
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Three-valued, per the prior-art ruling: axe-core's shipped geometric checker
 * returns true/false/undefined because a real fraction of page geometry is
 * genuinely undecidable. A binary appearance oracle either false-positives and
 * gets muted, or false-negatives and is worthless.
 */
export type Severity = 'fail' | 'warn' | 'incomplete';

export interface Finding {
  readonly code: string;
  readonly severity: Severity;
  readonly subject: string;
  readonly detail: string;
  readonly hint?: string;
  readonly docs?: string;
}

/** Everything a rule may observe. Rules never touch the DOM directly. */
export interface Inspector<TNode> {
  all(selector: string): readonly TNode[];
  attr(node: TNode, name: string): string | null;
  text(node: TNode): string;
  describe(node: TNode): string;
  rendered(node: TNode): boolean;
  box(node: TNode): Box;
  style(node: TNode, property: string): string;
  /** Nearest painted background colour behind this node. */
  backdrop(node: TNode): string;
  viewport(): { readonly inline: number; readonly documentInline: number };
}

export interface Rule<TNode> {
  readonly code: string;
  readonly title: string;
  run(inspector: Inspector<TNode>): readonly Finding[];
}

/** Registry entry for a diagnostic code. Append-only, forever. */
export interface CodeEntry {
  readonly code: string;
  readonly title: string;
  readonly severity: Severity;
  readonly summary: string;
  readonly hint: string;
}
