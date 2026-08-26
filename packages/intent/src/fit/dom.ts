/**
 * dom.ts — the adapter. The only file in `fit/` allowed to know that a node is
 * an `HTMLElement` living in a document.
 */

import type {
  Box,
  Candidate,
  Containment,
  FitState,
  Metrics,
  Mutator,
  Priority,
  Strategy,
} from '../contracts.js';
import { STRATEGIES } from '../contracts.js';

/**
 * Layout is fractional and `clientWidth`/`scrollWidth` are rounded integers, so
 * a one-unit difference is rounding, not overflow. Same tolerance the naive
 * version used; keeping it means the fixed engine is not merely noisier.
 */
const TOLERANCE = 1;

/** Strategy -> the attribute the theme's resolution table keys off. */
const STRATEGY_ATTRIBUTE: Readonly<Record<Strategy, string>> = {
  truncate: 'data-truncate',
  hide: 'data-hidden',
  menu: 'data-collapsed',
};

const STRATEGY_ATTRIBUTES: readonly string[] = Object.values(STRATEGY_ATTRIBUTE);

const DEFAULT_PRIORITY: Priority = 3;

/**
 * Computed overflow values whose content stays REACHABLE, and values that CUT
 * IT OFF. Enumerated rather than tested as `!== 'visible'` so that an
 * unresolved computed value fails safe — a node whose overflow cannot be read
 * is treated as able to paint outside, which is also the browser default.
 *
 * These two tables REPLACE a single `CONTAINED_OVERFLOW` table that lumped all
 * four values together under "content cannot paint outside the box". The lump
 * was not wrong for the solver, which treats scrolling and clipping alike, but
 * it was the wrong SHAPE: asking one property's string value for the answer
 * meant the table could not see a clipper that does not spell itself in
 * `overflow` at all. Measured, Chromium 151: `contain: paint` clips a 471-pixel
 * child inside a 200-pixel box (523/200 in the audit's fixture) while `overflow-x`
 * AND `overflow-y` both compute to `visible`. See `containment()` below.
 *
 * `overlay` is absent from both by measurement, not oversight: it computes to
 * `auto` per css-overflow-3, confirmed again here, so it can never arrive as a
 * computed value. It was listed for two months and measured as unreachable. A
 * dead branch in a fail-safe table is worse than a gap, because it reads as
 * coverage.
 */
const SCROLLING: Readonly<Record<string, true>> = { auto: true, scroll: true };
const CLIPPING: Readonly<Record<string, true>> = { hidden: true, clip: true };

/**
 * `contain` keywords that include PAINT containment, and therefore clip while
 * saying nothing in `overflow`. `contain: size layout` is measured NOT to clip,
 * which is why this tests keywords rather than "is `contain` set", and
 * `content` and `strict` are the two shorthands that imply `paint`.
 */
const PAINT_CONTAINING = /\b(?:paint|content|strict)\b/;

/**
 * Does this box let content escape, keep it reachable, or cut it off?
 *
 * Module level because `crushed()` needs the same answer for a descendant and
 * the two must never drift: a crush exemption that disagreed with the port's
 * own containment answer would be a silent hole exactly where this change is
 * closing one.
 */
function containmentOf(node: HTMLElement): Containment {
  const declaration = getComputedStyle(node);
  const { overflowX, overflowY } = declaration;
  // Reachability wins when the axes disagree: the box IS a scroll container, so
  // its overflow is reachable on at least one axis and the solver has nothing to
  // relieve. Measured combinations that reach here: `auto`/`hidden` stays as
  // spelled, and `clip`/`auto` computes the clipped axis to `hidden`.
  if (SCROLLING[overflowX] || SCROLLING[overflowY]) return 'scroll';
  if (CLIPPING[overflowX] || CLIPPING[overflowY]) return 'clip';
  if (PAINT_CONTAINING.test(declaration.contain)) return 'clip';
  return 'visible';
}

/**
 * How many line boxes this element's OWN text occupies, counted from the
 * rectangles the browser produced rather than derived from a line height.
 *
 * `Range.getClientRects()` returns one rectangle per line box a run was broken
 * across, so the count is the measurement and there is no arithmetic to get
 * wrong. The alternatives were all measured wrong before this: a box height
 * divided by a line height counts padding as extra lines and reports two lines
 * for a clean icon button (N690's reverted widening), and `line-height: normal`
 * is not a length, so half the surface would be undecidable rather than
 * counted.
 *
 * DIRECT TEXT CHILDREN ONLY. Selecting the whole subtree would fold a nested
 * element's rectangles into this element's answer and count one line twice, so
 * text sitting inside an inline child is not counted here — it is counted when
 * the walk reaches that child. The residue is honest and one-directional: a
 * node whose text is entirely inside a nested element reports zero and stays
 * silent, which under-reports and never invents.
 *
 * The early return is what keeps this affordable on a subtree walk: an element
 * with no text of its own costs a `childNodes` scan and no layout at all.
 */
function lineCount(node: HTMLElement): number {
  const runs: Text[] = [];
  for (const child of node.childNodes) {
    if (child.nodeType !== 3) continue;
    if ((child.nodeValue ?? '').trim() === '') continue;
    runs.push(child as Text);
  }
  if (runs.length === 0) return 0;

  // One entry per distinct block-start edge: two runs sharing a line box share
  // an edge, and a run broken across lines contributes one edge per line.
  const edges = new Set<number>();
  const range = node.ownerDocument.createRange();
  for (const run of runs) {
    range.selectNodeContents(run);
    for (const rect of range.getClientRects()) {
      if (rect.width === 0 && rect.height === 0) continue;
      edges.add(Math.round(rect.top));
    }
  }
  return edges.size;
}

/**
 * Did something between `node` and `container` absorb this node's block growth,
 * so that the container never paid for it?
 *
 * Inclusive of `node` and exclusive of `container`: a text run that scrolls its
 * own overflow answers for itself, and the container's own containment is not
 * an excuse for its contents — a row that clips is a row whose content is being
 * deleted, which is N710's claim and not a licence.
 */
function absorbed(node: HTMLElement, container: HTMLElement): boolean {
  for (let up: HTMLElement | null = node; up !== null && up !== container; up = up.parentElement) {
    if (up.hasAttribute('data-truncate')) return true;
    if (up.hasAttribute('data-overflow-menu')) return true;
    if (containmentOf(up) !== 'visible') return true;
  }
  return false;
}

export const domMetrics: Metrics<HTMLElement> = {
  box(node: HTMLElement): Box {
    return {
      inline: node.clientWidth,
      block: node.clientHeight,
      contentInline: node.scrollWidth,
    };
  },

  overflows(node: HTMLElement): boolean {
    return node.scrollWidth > node.clientWidth + TOLERANCE;
  },

  /**
   * F8: a descendant whose content is wider than the box it was given is
   * painting over its neighbour, even when the container itself measures as
   * fitting.
   *
   * Four exemptions:
   *   - an element the solver has actually truncated: `[data-truncate]` clips
   *     with an ellipsis, so `scrollWidth > clientWidth` is the feature
   *     working. Declaring `data-collapse="truncate"` is not enough; the
   *     exemption is the *applied* attribute, which is also the only thing the
   *     theme acts on;
   *   - the open overflow panel, which is absolutely positioned. It is out of
   *     flow, so it has no neighbour to paint over and cannot crush anything;
   *     the theme bounds its inline size, and a clipped panel would otherwise
   *     report as a crush for the whole container;
   *   - a field. A text control scrolls its own value, so content wider than
   *     its box is the control working, exactly like a scroller;
   *   - a box that does not let content escape. Only a box whose containment is
   *     `visible` lets content paint over a neighbour; `scroll` means the
   *     overflow is reachable and `clip` means it is cut off. This is the one
   *     exemption that needs a computed value, so it is resolved lazily, for a
   *     descendant that already failed the geometric test: a settled subtree
   *     costs zero style resolutions and a broken one costs at most one before
   *     this returns.
   *
   * That last exemption used to read the `overflow-x` string, and that was a
   * measured hole rather than a stylistic one: `contain: paint` and
   * `contain: content` clip while both overflow axes compute to `visible`, so
   * two real clippers were classified as "content escapes and lands on a
   * neighbour" and the solver would have tried to relieve them by degrading
   * siblings — which can never work, because nothing is colliding. It asks
   * `containment()` now.
   *
   * That exemption used to be described here as "deliberately wider than the
   * checker's N660, which also fails clipped content". That is no longer true,
   * and the reason is worth keeping: N660 fails clipped content NO MORE, because
   * "content paints outside its box and lands on a neighbour" is a false claim
   * about a clipper, and N710 now owns clipped loss with the accurate one. So
   * the solver and the checker agree on this exemption for the first time —
   * arrived at from opposite directions. The solver's reason has not changed:
   * clipping is not something it can relieve by degrading siblings, and chasing
   * it would collapse every action in a row because a table two levels down is
   * cut off by a flush surface.
   *
   * Boxless nodes need no exemption. A collapsed or hidden node is
   * `display: none` and a layout-transparent component host is
   * `display: contents`; neither generates a CSS layout box, so both report
   * 0/0 and cannot pass the geometric test. A node crushed to zero width is a
   * different case and is still caught: its content still has a width, so
   * `scrollWidth` is non-zero.
   */
  crushed(node: HTMLElement): boolean {
    for (const descendant of node.querySelectorAll<HTMLElement>('*')) {
      if (descendant.hasAttribute('data-truncate')) continue;
      if (descendant.hasAttribute('data-overflow-menu')) continue;
      if (descendant.scrollWidth <= descendant.clientWidth + TOLERANCE) continue;
      if (descendant.getAttribute('data-appearance') === 'field') continue;
      if (containmentOf(descendant) !== 'visible') continue;
      return true;
    }
    return false;
  },

  /**
   * The block-axis half of F8, and the one predicate here that starts by
   * reading a DECLARATION instead of a rectangle.
   *
   * `data-layout="row"` resolves to `flex-flow: row nowrap` — one line — and
   * `wrap` is the separate value an author writes to ask for a second one. So a
   * row's block extent is a consequence of how tall its children intrinsically
   * are, never a place to put content that would not fit inline. Every other
   * layout value declares the opposite (a stack flows in the block axis, a grid
   * places rows in it), which is why the gate is the declaration and not a
   * height: the same ten line boxes are a defect in one container and the whole
   * point of the next one, and only the author can say which.
   *
   * WHAT IT COSTS THE ROW, measured: the grow region collapsed to the width of
   * the single word "appearance" — which is what min-content means for text
   * that may wrap — the title reflowed to ten line boxes, and the row stood
   * over ten times the height it was declared for while reporting
   * `scrollWidth 346 === clientWidth 346`. Nothing overflowed, so nothing here
   * saw it; the row simply GREW. That is also why a `scrollHeight` test would
   * have been just as blind, and blind for a second reason on top of the
   * directional one N715 records: there is no block overflow to find when the
   * container absorbs the growth into its own height.
   *
   * THE EXEMPTIONS ARE AN UPWARD WALK rather than a test on the descendant,
   * because every one of them is about what sits BETWEEN the reflowed text and
   * the row:
   *   - a node the solver actually truncated. The table resolves truncation to
   *     `nowrap` plus an ellipsis, so a truncated node cannot wrap at all;
   *   - the open overflow panel AND ITS CONTENTS. It is out of flow, so its
   *     block extent is not the row's, and its items are MEANT to reflow —
   *     measured wrapping to two lines in a 320-unit container with the panel
   *     open. Exempting the panel element alone and then walking into its
   *     children is exactly the defect N715 shipped, so the walk covers the
   *     subtree;
   *   - any box on the way up that does not let content escape. A scroller
   *     keeps the growth reachable inside itself and a clipper cuts it off,
   *     which N710 owns. In neither case did the ROW pay for it, and in neither
   *     case could the solver relieve it by degrading a sibling.
   * The walk runs only for a descendant that already failed the line-box test,
   * so a settled row costs zero style resolutions — the same laziness
   * `crushed()` applies to `containmentOf` and for the same reason.
   */
  wrapped(node: HTMLElement): boolean {
    if (node.getAttribute('data-layout') !== 'row') return false;
    for (const descendant of node.querySelectorAll<HTMLElement>('*')) {
      if (lineCount(descendant) < 2) continue;
      if (absorbed(descendant, node)) continue;
      return true;
    }
    return false;
  },

  /**
   * "Rendered" means "has a layout box you may measure", which is the F4
   * precondition: measuring `display: none` candidates as 0x0 is how the first
   * run produced ten false hit-target failures.
   *
   * `checkVisibility()` alone is not that test. It returns TRUE for a
   * `display: contents` element — and every component host is one, because
   * nisli renders a component's template inside its host and the host must be
   * layout-transparent for the declarations on the inner element to be what
   * flex sizes. A boxless host measures 0x0 while being perfectly visible,
   * which is the false-PASS shape the prior-art corpus recorded.
   */
  rendered(node: HTMLElement): boolean {
    if (!node.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true })) {
      return false;
    }
    return getComputedStyle(node).display !== 'contents';
  },

  /**
   * The solver's half of the `content-visibility: auto` blindness, and it is
   * the same blindness: css-contain-2 states that the skipped contents of an
   * element never change their size and that the resize observation arrives
   * only once they become non-skipped, so a `[data-fit]` container inside a
   * skipped subtree gets no `ResizeObserver` callback and is never re-solved.
   * Measuring it anyway means solving against geometry that is not the
   * geometry on screen.
   *
   * The signal is the capability disagreement, not a geometry one — see
   * `Inspector.measurable()` in the diagnostics adapter for the measurement and
   * for why the geometry disagreement turned out to be fixture-dependent on the
   * same Chromium build.
   */
  measurable(node: HTMLElement): boolean {
    return !(node.checkVisibility() && !node.checkVisibility({ contentVisibilityAuto: true }));
  },

  containment(node: HTMLElement): Containment {
    return containmentOf(node);
  },

  style(node: HTMLElement, property: string): string {
    return getComputedStyle(node).getPropertyValue(property);
  },
};

export const domMutator: Mutator<HTMLElement> = {
  apply(node: HTMLElement, strategy: Strategy): void {
    node.setAttribute(STRATEGY_ATTRIBUTE[strategy], '');
  },

  clear(node: HTMLElement): void {
    for (const attribute of STRATEGY_ATTRIBUTES) node.removeAttribute(attribute);
  },

  markFit(container: HTMLElement, state: FitState, collapsed: number): void {
    container.setAttribute('data-fit', state);
    container.setAttribute('data-collapsed-count', String(collapsed));
  },

  revealOverflow(container: HTMLElement, reveal: boolean): void {
    for (const trigger of container.querySelectorAll<HTMLElement>('[data-overflow]')) {
      if (trigger.parentElement?.closest('[data-fit]') !== container) continue;
      trigger.toggleAttribute('data-shown', reveal);
    }
  },
};

/**
 * Read the candidates a container declares.
 *
 * Ownership is by nearest `[data-fit]` *ancestor*: a nested container solves
 * its own subtree, and stealing its candidates would let two solvers degrade
 * the same node in opposite directions on alternating resize passes.
 *
 * An unknown `data-collapse` value is skipped in silence on purpose. Guessing a
 * strategy would hide the mistake; the checker reports it as N610, which is
 * where an author should learn about it.
 */
export function discoverCandidates(container: HTMLElement): Candidate<HTMLElement>[] {
  const candidates: Candidate<HTMLElement>[] = [];
  for (const node of container.querySelectorAll<HTMLElement>('[data-collapse]')) {
    if (node.parentElement?.closest('[data-fit]') !== container) continue;
    const declared = node.getAttribute('data-collapse');
    if (declared === null || !(STRATEGIES as readonly string[]).includes(declared)) continue;
    candidates.push({
      node,
      priority: readPriority(node.getAttribute('data-priority')),
      strategy: declared as Strategy,
    });
  }
  return candidates;
}

/** The host itself when it is a container, otherwise the containers it holds. */
export function fitContainers(host: HTMLElement): HTMLElement[] {
  return host.matches('[data-fit]') ? [host] : [...host.querySelectorAll<HTMLElement>('[data-fit]')];
}

/**
 * Priority is authored markup, so it can be anything. Absent, blank and
 * unparseable all mean "no opinion" (3); out-of-range values are clamped rather
 * than rejected, since `data-priority="9"` unambiguously means "first to go".
 */
function readPriority(raw: string | null): Priority {
  if (raw === null || raw.trim() === '') return DEFAULT_PRIORITY;
  const value = Number(raw);
  if (!Number.isFinite(value)) return DEFAULT_PRIORITY;
  return Math.min(5, Math.max(1, Math.round(value))) as Priority;
}
