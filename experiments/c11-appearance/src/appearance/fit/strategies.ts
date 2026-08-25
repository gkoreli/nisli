/**
 * strategies.ts — what each strategy means to the solver. Pure: no DOM.
 */

import type { Box, Strategy } from '../contracts.js';

/**
 * Below this many visible characters, a truncated value carries no information:
 * "1…", "Y…", "M". Four is the smallest count at which a truncated word is
 * still recognisable ("Mess…", "Rece…"); see the derivation in
 * `truncationDegenerate`.
 */
const MIN_VISIBLE_CHARS = 4;

/** Only `menu` relocates content, so only `menu` needs the trigger revealed. */
export function needsAffordance(strategy: Strategy): boolean {
  return strategy === 'menu';
}

/**
 * Only a truncated element may be narrower than its content: the ellipsis is
 * the whole point. Everything else shrinking below its content width is the F8
 * crush, where content paints over the neighbour while the container still
 * measures as fitting.
 */
export function allowsShrink(strategy: Strategy): boolean {
  return strategy === 'truncate';
}

/**
 * Did truncating this element leave so little text that the result is useless?
 * This is the F5 signal: at the narrowest demo width the timestamps clamped to
 * "1…", "Y…", "M" — the engine did exactly what it was told, and the author had
 * chosen the wrong strategy for a short atomic value. `hide` exists for those;
 * this function is how the checker says so (N621, a warning) instead of the
 * author discovering it in a screenshot.
 *
 * Heuristic: the visible fraction of the box is assumed to be the visible
 * fraction of the string, so `textLength * inline / contentInline` estimates
 * the characters that survived.
 *
 * Its limits, which are why this is a warning and not a failure:
 *   - it assumes a uniform character advance, so proportional fonts skew it in
 *     both directions ("WWWW" overestimates, "illi" underestimates);
 *   - it ignores the ellipsis glyph, which eats roughly one character of the
 *     visible width, so the estimate is slightly optimistic;
 *   - it says nothing about whether the surviving prefix is *meaningful*; a
 *     long truncated sentence is fine, a long truncated URL may not be.
 * A wrong warning is worse than no warning, so every case where the geometry
 * does not clearly say "clamped" returns false: unmeasured or collapsed nodes
 * (F4: never measure what is not rendered) and nodes that are not clamped at
 * all cannot be degenerate.
 */
export function truncationDegenerate(box: Box, textLength: number): boolean {
  if (textLength <= 0) return false;
  if (box.inline <= 0 || box.contentInline <= 0) return false;
  if (box.contentInline <= box.inline) return false;
  return textLength * (box.inline / box.contentInline) < MIN_VISIBLE_CHARS;
}
