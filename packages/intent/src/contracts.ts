/**
 * contracts.ts — the seam every other module codes against.
 *
 * Architecture: ports and adapters. The domain (vocabulary, fit solving,
 * diagnostics) is PURE and knows nothing about the DOM; it reads geometry and
 * writes decisions through the ports below. The DOM adapters are the only code
 * allowed to touch `HTMLElement`, `getComputedStyle` or `getBoundingClientRect`.
 *
 * Why this shape, for a package whose domain may still graduate:
 *   - the solver becomes testable without a browser (drive it with a fake
 *     Metrics implementation and assert the decisions);
 *   - the diagnostic rules become a list of pure functions over an Inspector,
 *     so adding a rule is adding one file with one test;
 *   - if this graduates into @nisli/core, the domain moves unchanged and only
 *     the adapters are reviewed for byte cost.
 *
 * NOTHING in this file imports anything. It is the shared vocabulary.
 *
 * It is also why `.` never imports `./devtools`. The diagnostics TYPES live
 * here, beside the runtime, while every diagnostics IMPLEMENTATION lives behind
 * `./devtools`: a consumer shipping production drops the rules, the runner and
 * `explain()` entirely, and the entry point that survives holds no edge
 * pointing at the bytes that went away.
 *
 * WHAT THE BARREL DELIBERATELY WITHHOLDS, so that nobody helpfully re-exports
 * it. `orderCandidates`, `allowsShrink`, `needsAffordance` and
 * `truncationDegenerate` are internals of the solve loop and are NOT on `.`,
 * though the prototype's barrel carried all four. Every exported name is a
 * compatibility obligation, and these four buy none: three are read only by
 * `solveFit`, and the fourth has exactly one consumer — the N621 rule — which
 * reaches it at `../fit/strategies.js` inside the package. That is how an
 * internal is supposed to be consumed. `VOCABULARY` and `AXIS_ATTRS` ship
 * together for the opposite reason: values without their attributes are not a
 * self-describing vocabulary, and a consumer who cannot mechanically check
 * where a value is written is one wrong guess away from the N700 dead
 * selector.
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

/**
 * Cross-axis and distribution intent on a container.
 *
 * These were AUTHOR-FACING DECLARATIONS OUTSIDE THE ENUMERATED VOCABULARY
 * until the coverage guard pointed it out, which made the exclusivity claim
 * narrower than it was being stated. `data-align` and `data-clip` are written
 * by hand in components, so a typo — `data-align="stat"` — silently did
 * nothing: N610 checks values against `VOCABULARY`, and a word with no axis
 * cannot be checked against anything. That is the N700 dead-selector class one
 * level up, on the AUTHOR's side of the seam rather than the checker's.
 *
 * Engine-written attributes (`data-fit`, `data-truncate`, `data-collapsed`) are
 * deliberately still absent: the mutator is the only writer, so an illegal
 * value there would be a bug in the solver rather than a mistake an author can
 * make, and enumerating them would invite an author to write them.
 */
export type AlignKind = 'start' | 'center' | 'end' | 'between';

/** Whether a clipping box may trim its overhang. One value, and it is opt-in. */
export type ClipKind = 'trim';

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
  align: ['start', 'center', 'end', 'between'],
  clip: ['trim'],
} as const satisfies Record<string, readonly string[]>;

/**
 * Which attribute declares which axis. The vocabulary above says what the legal
 * VALUES are; this says where they are written.
 *
 * Reified because a checker that selects `[data-surface]` when the vocabulary
 * spells it `[data-appearance="surface"]` is not a failing rule — it is a rule
 * that can never fire, and nothing catches that. Unit tests over a fake
 * inspector cannot: the fixture and the selector come from the same author in
 * the same wrong assumption, so they agree with each other and pass. The 240
 * cell matrix cannot either: a rule that matches nothing produces no findings,
 * which is indistinguishable from a clean page. That is the sixth oracle bug
 * the prototype produced and the first of a new class — not measuring the
 * wrong box, but speaking a word the vocabulary does not contain.
 *
 * With the mapping as data, `src/diagnostics/reachability.test.ts` can assert
 * that every selector in every rule addresses an attribute the codebase actually
 * produces and a value the axis actually allows.
 */
export const AXIS_ATTRS = {
  'data-layout': 'layout',
  'data-appearance': 'appearance',
  'data-role': 'emphasis',
  'data-text': 'text',
  'data-density': 'density',
  'data-input': 'input',
  'data-theme': 'theme',
  'data-collapse': 'collapse',
  'data-align': 'align',
  'data-clip': 'clip',
} as const satisfies Record<string, keyof typeof VOCABULARY>;

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

/**
 * Border-box dimensions. The geometry of PRESSABILITY and visual bounds, and
 * deliberately a different type from `Box` rather than a third field on it.
 *
 * Five of the nine defects in the first run were the checker measuring the
 * wrong box, twice in a row: N650 reported 710 false hit-target failures by
 * comparing a padding box against a floor, and N690 repeated the mistake inside
 * the rule written to prevent it. The principle they cost us — *a check must
 * measure the box its claim is about* — is worth more as a type than as a
 * comment, so the two geometries cannot be confused at a call site:
 *
 *   - `Box` answers CONTAINMENT: does content fit inside its own box. It is a
 *     padding-box measure, which is what makes `contentInline > inline` a
 *     like-for-like comparison.
 *   - `Bounds` answers PRESSABILITY and visual extent: what a finger hits and
 *     what the eye sees. Borders are part of the target; transforms move it.
 *
 * There is no `contentInline` here on purpose. "What the content wanted" is a
 * containment question, so asking it of `Bounds` is a category error.
 *
 * THE ORIGIN WAS ADDED LATER, AND DELIBERATELY HERE RATHER THAN ON `Box`.
 * Two measured defects need to know not just how big a box is but WHERE it
 * sits, and neither is expressible without it:
 *
 *   - N715: a box reported `scrollHeight 36 === clientHeight 36` while a 45-pixel
 *     control painted outside it. The control was pinned to the block-end edge,
 *     so it overflowed towards block-START, and scroll extents are directional
 *     — they cannot see start-side overflow at all. The only assertion left is
 *     rect against rect.
 *   - N713: a multicolumn container held 3 columns of 101.33 pixels carrying 103 pixels
 *     of content, 6 crushed nodes, container 323/320. A column box is not an
 *     element, so no per-node predicate can ever reach it; the container's own
 *     rectangle is the only real box in the picture.
 *
 * It belongs to `Bounds` because "where does this paint" is a visual-extent
 * question, which is exactly what `Bounds` already answers. Putting it on `Box`
 * would have been the tempting move — these read as containment claims — and it
 * would have repeated the category error that cost the first run five defects:
 * a padding-box origin can only be had by adding resolved border longhands to a
 * rect, which is the precise arithmetic that shipped 710 false failures on the
 * run where two of those longhands resolved to the empty string. So the
 * comparison is border box against border box, and the residue is honest and
 * bounded: a descendant sitting inside its container's border but outside its
 * padding box is not reported. That under-reports by at most the border width
 * and never invents a defect.
 *
 * Both rectangles come from the same coordinate system in the same frame, so a
 * four-edge comparison is correct in any writing mode; only the NAMES would
 * change. `inline`/`block` already assume `horizontal-tb` — they are read from
 * `rect.width`/`rect.height` — and the origin inherits that assumption rather
 * than inventing a second one. Recorded because it IS an assumption: this
 * prototype never rendered a vertical writing mode.
 */
export interface Bounds {
  readonly inline: number;
  readonly block: number;
  /** Start edge on the inline axis, in viewport coordinates. */
  readonly inlineStart: number;
  /** Start edge on the block axis, in viewport coordinates. */
  readonly blockStart: number;
}

/**
 * What happens to content that does not fit its box. Three values, because the
 * three consequences are genuinely different and every clip test in the
 * prototype conflated them by asking one property for the answer.
 *
 *   - `visible` — content escapes and paints over whatever is next to it.
 *   - `scroll`  — content larger than the box stays REACHABLE by scrolling.
 *   - `clip`    — content larger than the box is cut off and unreachable.
 *
 * Measured, Chromium 151: `contain: paint` clips a 471-pixel child inside a 200-pixel
 * box while `overflow-x` computes to `visible`, and `contain: content` does the
 * same. Both tables that keyed on the overflow VALUE therefore classified a
 * clipper as "content paints outside its box and lands on a neighbour" — the
 * right location with a false claim, and one the solver would try to relieve by
 * degrading siblings, which can never work because nothing is colliding.
 * "Does this box clip" is a question about clipping, not about a property.
 *
 * ONE SCALAR FOR TWO AXES, with the limit measured rather than assumed.
 * css-overflow-3 forces a `visible` axis to `auto` when the other axis is not
 * `visible`, so the common case cannot disagree with itself. The cases that can,
 * measured: `overflow-x: auto; overflow-y: hidden` computes to exactly that,
 * and `overflow-x: clip; overflow-y: auto` computes x to `hidden`. There
 * `scroll` wins, because the box IS a scroll container and its overflow stays
 * reachable on at least one axis. Per-axis containment is the honest
 * refinement; no rule needs it yet, and shipping it before one does would be
 * coverage nobody has measured — the same mistake as the `overlay` entry that
 * sat in two tables for two months while being provably unreachable.
 */
export type Containment = 'visible' | 'scroll' | 'clip';

/**
 * A colour as the compositor painted it: sRGB channels in 0..255, alpha in
 * 0..1.
 *
 * Never a CSS string on this port, and that is a measured decision. A CSS
 * colour string is not a colour; it is one of a dozen syntaxes for one, and the
 * rule that tried to parse them itself went blind the moment the table started
 * deriving: 288 of 1188 measured text cells became undecidable, 31.8% of
 * derived cells against 9.1% of authored ones, because a derived foreground
 * computes to `oklab(…)`. Parsing colour is the adapter's job, and the adapter
 * does it by painting. See `Inspector.colour()`.
 */
export type Rgba = readonly [number, number, number, number];

/**
 * Why a contrast claim about a node is or is not supportable, and against what.
 *
 * A bare colour was the wrong return type: three separate measured defects all
 * came back as a confident number where no number was supportable, so the
 * reasons are enumerated instead of collapsed into `null`.
 *
 *   - `painted` — an opaque colour is behind this node. `colour` is set.
 *   - `image` — an ancestor paints a `background-image`, or is a `<video>` or
 *     `<canvas>`. There is no single colour behind the text. Today the walk
 *     skipped straight past it and reported the colour BEHIND the image.
 *   - `faded` — `opacity` below 1, or a translucent background colour, sits
 *     between the reader and the text. What is on screen is a composite of two
 *     or more layers that nobody composited. Measured: the shipped disabled
 *     action (`theme/roles.css`, the `aria-disabled` rule's `opacity`) was
 *     reported at 18.85:1 while actually painting 3.03:1 — a six-fold error in
 *     the direction of false confidence, which survived precisely because WCAG
 *     1.4.3 exempts inactive components and so nobody was looking.
 *   - `unresolvable` — a value the adapter could not resolve to a colour at all.
 *
 * `faded` is deliberately not "correct": compositing an opacity chain is real
 * work and a rushed version would be another confident wrong number. An honest
 * "I cannot decide" is worth more than a fast wrong answer, and it is the only
 * verdict the house rule allows.
 */
export type BackdropKind = 'painted' | 'image' | 'faded' | 'unresolvable';

export interface Backdrop {
  readonly kind: BackdropKind;
  /** The painted colour, set only when `kind` is `painted`. */
  readonly colour: Rgba | null;
  /** The node's own description of what defeated the claim, for the finding. */
  readonly detail: string;
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
  /**
   * Does this node's geometry mean what it says? See `Inspector.measurable()`
   * for the measurement and the argument.
   *
   * The solver needs the same question for its own reason: css-contain-2 states
   * that the skipped contents of an element never change size, and that a
   * resize observation is delivered only once they become non-skipped. So a
   * `[data-fit]` container inside a skipped subtree receives no
   * `ResizeObserver` callback at all and is never re-solved. The engine is
   * blind on exactly the same axis as the checker.
   */
  measurable(node: TNode): boolean;
  /** What happens to content that does not fit this box. */
  containment(node: TNode): Containment;
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

/**
 * These two strings are a CROSS-HALF CONTRACT, not just a type.
 *
 * The mutator writes them into `data-fit`, which no axis in `AXIS_ATTRS`
 * enumerates — deliberately, since the engine is the only writer (see
 * `AlignKind`). So the reachability guard in the diagnostics half cannot check
 * a `[data-fit="…"]` selector against the vocabulary; it searches for the VALUE
 * as a standalone token in the producing half instead, `theme/**` plus
 * `src/fit/**`, and proves the selector reachable rather than exempting it.
 *
 * The consequence is worth knowing before renaming either string: a rename here
 * silently staleifies every rule selector that names it, and that guard is the
 * only thing standing between such a rename and another rule that matches
 * nothing while every gate stays green.
 */
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

   The types, and only the types. Every implementation lives behind
   `./devtools`; this section is what makes that boundary free, because a rule
   is a shape rather than a dependency.
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
  /** Descendants of `node` matching `selector`. Scopes a claim to a subtree. */
  within(node: TNode, selector: string): readonly TNode[];
  attr(node: TNode, name: string): string | null;
  text(node: TNode): string;
  describe(node: TNode): string;
  rendered(node: TNode): boolean;
  /**
   * Does this node's geometry mean what it says?
   *
   * FALSE when the node or an ancestor is skipped by `content-visibility: auto`.
   * That case is the reason this member exists, and it is the worst-shaped
   * defect the checker has produced: a skipped subtree makes a clipper report
   * `scrollWidth 200 === clientWidth 200` while its child needs 471 pixels, so
   * `overflows()` returns false, and `rendered()` returns false as well — so
   * every measuring rule reaches its `continue` and the run is a PASS with zero
   * findings. Nothing throws, so the runner's `catch` never fires either.
   *
   * THE SIGNAL IS A CAPABILITY QUESTION, NOT A GEOMETRY ONE, and that is
   * measured rather than chosen for tidiness. `checkVisibility()` answers true
   * for a skipped node while `checkVisibility({ contentVisibilityAuto: true })`
   * answers false; that disagreement is uniquely the skipped case, since
   * `display: none` and `content-visibility: hidden` answer false to both and a
   * `visibility: hidden` node answers true to both. The tempting alternative
   * was the geometry disagreement recorded in the audit — `getBoundingClientRect()`
   * reporting 0×0 while `offsetWidth` reported 471 in the same frame — and
   * re-measuring it on the same Chromium 151 produced DIFFERENT numbers on a
   * different fixture: rect 471 and a clipper whose scroll extent did see the
   * content. Which layout API lies is fixture-dependent; that one of them does
   * is not. So the check asks the API whose answer is stable.
   *
   * THIS IS NOT A SECOND RENDERED-NESS TEST, and conflating them would put the
   * checker right back where it started. `measurable()` is TRUE for a
   * `display: none` node and for `content-visibility: hidden`: those have no box
   * at all, they report zero honestly, and `rendered()` is the predicate that
   * excludes them. It is false only for content that IS there and CANNOT be
   * measured.
   *
   * The honest verdict for a skipped subtree is therefore UNDECIDABLE, never
   * FAIL. css-contain-2 requires that the skipped contents of an `auto` element
   * remain available to find-in-page and tab order and stay focusable and
   * selectable, so the READER loses nothing. Only the PROOF is destroyed.
   * Rules reach these nodes through `declared()`, not `painted()` — `painted()`
   * filters them out by construction, which is the mechanism of the false PASS.
   */
  measurable(node: TNode): boolean;
  /** Padding box — for containment claims. See `Box`. */
  box(node: TNode): Box;
  /** Border box with origin — visual-extent and pressability claims. See `Bounds`. */
  bounds(node: TNode): Bounds;
  /** What happens to content that does not fit this box. See `Containment`. */
  containment(node: TNode): Containment;
  style(node: TNode, property: string): string;
  /**
   * A resolved style colour, as the compositor painted it. `null` when the
   * value is not a colour at all.
   *
   * The adapter resolves; the rule never parses. That split is the whole point:
   * a rule that decomposed colour strings itself understood `rgb()` and
   * `color(srgb …)` and nothing else, so the moment the table derived a
   * foreground through `color-mix()` or `contrast-color()` — both of which
   * compute to `oklab(…)` — roughly a third of the contrast surface stopped
   * reporting anything. Out-of-gamut values are clamped by the compositor, and
   * clamped is what the reader saw.
   */
  colour(node: TNode, property: string): Rgba | null;
  /** Is a contrast claim about this node supportable, and against what? */
  backdrop(node: TNode): Backdrop;
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
