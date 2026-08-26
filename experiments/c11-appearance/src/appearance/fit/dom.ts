/**
 * dom.ts — the adapter. The only file in `fit/` allowed to know that a node is
 * an `HTMLElement` living in a document.
 */

import type { Box, Candidate, FitState, Metrics, Mutator, Priority, Strategy } from '../contracts.js';
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
 * Overflow values whose content cannot paint outside the box: it either scrolls
 * or is cut off. Enumerated rather than tested as `!== 'visible'` so that an
 * unresolved computed value fails safe — a node whose overflow cannot be read
 * is treated as able to paint outside, which is also the browser default.
 */
const CONTAINED_OVERFLOW: Readonly<Record<string, true>> = {
  hidden: true,
  clip: true,
  auto: true,
  scroll: true,
  // `overlay` is deliberately absent: it computes to `auto` per css-overflow-3,
  // so it can never arrive here as a computed value. It was listed for two
  // months and measured as unreachable. A dead branch in a fail-safe table is
  // worse than a gap, because it reads as coverage.
};

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
   *   - a box that does not overflow visibly. Only `overflow-x: visible` lets
   *     content escape and paint over a neighbour; `auto` and `scroll` mean it
   *     scrolls, `hidden` and `clip` mean it is cut off. This is the one
   *     exemption that needs a computed value, so it is resolved lazily, for a
   *     descendant that already failed the geometric test: a settled subtree
   *     costs zero style resolutions and a broken one costs at most one before
   *     this returns.
   *
   * That last exemption is deliberately wider than the checker's N660, which
   * also fails clipped content. Both are right for their question. The
   * checker asks "is anything unreadable", and clipped content is; the solver
   * asks "can this container settle", and clipping is not something it can
   * relieve by degrading siblings — chasing it would collapse every action in
   * a row because a table two levels down is cut off by a flush surface.
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
      if (CONTAINED_OVERFLOW[getComputedStyle(descendant).overflowX]) continue;
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
