/**
 * N640 — text contrast against the nearest painted backdrop.
 *
 * This is finding F3, and it is the moment the thesis worked on its author: the
 * first dark-mode run set `--fg` without painting `--s1` on the same node, and
 * this rule reported 1.10:1 (light text on white) before any human looked at the
 * screen. Nobody wrote that assertion for that component — it is derivable
 * because both colours came out of the resolution table.
 *
 * WCAG 2.x relative luminance, floors 4.5:1 normal and 3:1 large text.
 * Alpha is not composited: a semi-transparent foreground is reported as
 * undecidable (N680) rather than guessed at, because a wrong contrast number
 * is how a checker gets muted. The way out of an undecidable node is to resolve
 * the colour to an opaque sRGB value, or to accept that it needs a human.
 *
 * WHICH GEOMETRY THIS CLAIM IS ABOUT: none. Contrast is a colour claim, so this
 * rule asks for neither `box()` nor `bounds()`. It still selects through
 * `painted()`, because rendered-ness is a precondition of the claim rather than
 * a measurement: a `display: none` node has no painted colours at all, and the
 * backdrop walk above it would report whatever an invisible node happens to
 * inherit. `painted()` is the lens's way of saying that once, in the selector.
 */

import type { Rule } from '../../contracts.js';
import { rule } from '../rule.js';

/** Channel triple in 0..255, or null when the syntax is not decomposable here. */
function channels(colour: string): [number, number, number] | null {
  const numbers = (colour.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const [first, second, third] = numbers;
  if (first === undefined || second === undefined || third === undefined) return null;
  // `color(srgb 0.5 0.5 0.5)` and friends carry 0..1 components.
  if (colour.startsWith('color(')) {
    if (!colour.includes('srgb')) return null; // another space; converting it is not this rule's job
    return [first * 255, second * 255, third * 255];
  }
  if (!colour.startsWith('rgb')) return null; // oklch(), lab(), a named keyword the adapter did not resolve
  const alpha = numbers[3];
  if (alpha !== undefined && alpha < 1) return null; // would need compositing against the backdrop
  return [first, second, third];
}

function luminance(rgb: readonly [number, number, number]): number {
  const linear = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRule<TNode>(): Rule<TNode> {
  return rule<TNode>('N640', (lens, out) => {
    // F4: an unrendered node has no painted colours at all, and measuring
    // collapsed candidates is what produced the first run's false failures.
    // The seam enforces that now — `painted()` is the only selector here.
    for (const el of lens.painted('[data-text], [data-appearance="action"]')) {
      if (el.text().trim() === '') continue;

      // `raw()`, not `px()`: a colour is a syntax this rule parses itself, and
      // `channels()` decides what it can and cannot decompose.
      const foreground = el.raw('color');
      const background = el.backdrop();
      const front = channels(foreground);
      const back = channels(background);
      if (!front || !back) {
        out.undecidable(
          el.subject,
          `contrast undecidable: cannot composite ${foreground} on ${background}`,
        );
        continue;
      }

      const [bright, dim] = [luminance(front), luminance(back)].sort((a, b) => b - a) as [
        number,
        number,
      ];
      const ratio = (bright + 0.05) / (dim + 0.05);
      // Both thresholds are numeric comparisons against a floor, so both reads
      // want `px()`: a keyword weight (`bold`) and an unresolvable font-size
      // are alike "not a number at or above the threshold", and the `|| 0` says
      // so without a NaN leaking into the branch. This rule never has to tell
      // "zero" from "unresolvable" — a 0px font paints nothing to read either
      // way — so it does not reach for `raw()` here.
      const size = el.px('font-size');
      const weight = el.px('font-weight');
      const large = size >= 18.66 || (size >= 14 && weight >= 700);
      const floor = large ? 3 : 4.5;
      if (ratio >= floor) continue;
      out.finding(
        el.subject,
        `contrast ${ratio.toFixed(2)}:1 below the ${floor}:1 floor for ${large ? 'large' : 'normal'} text (${foreground} on ${background})`,
      );
    }
  });
}
