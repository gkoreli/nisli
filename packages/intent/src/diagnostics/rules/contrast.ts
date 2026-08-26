/**
 * N640 — text contrast against the nearest painted backdrop.
 *
 * This is finding F3, and it is the moment the thesis worked on its author: the
 * first dark-mode run set `--intent-fg` without painting `--intent-s1` on the
 * same node, and this rule reported 1.10:1 (light text on white) before any
 * human looked at the screen. Nobody wrote that assertion for that component —
 * it is derivable because both colours came out of the resolution table.
 *
 * WCAG 2.x relative luminance. The FLOORS ARE THE THEME'S, not this file's:
 * `--intent-min-contrast` and `--intent-min-contrast-large`, read off the
 * element the claim is about. This rule still decides which of the two applies,
 * because that is a question about the text and not about the palette, but it
 * holds no ratio of its own — so a consumer raises the bar to AAA by editing a
 * theme instead of forking a rule, and can do it for one subtree, because a
 * custom property inherits and this reads per element.
 *
 * THIS RULE NO LONGER PARSES COLOUR, and that is the most expensive thing this
 * file has to say. It used to decompose the computed value with a regex that
 * accepted `rgb…` and `color(srgb …)` and returned nothing for anything else.
 * That was adequate for an authored palette and it went blind the moment the
 * table started DERIVING: `color-mix()` and `contrast-color()` both compute to
 * `oklab(…)` in Chromium, and a full sweep measured **288 of 1188 text cells
 * undecidable — 31.8% of derived cells against 9.1% of authored ones.** Adopting
 * derivation without touching this rule would have converted roughly a third of
 * the contrast surface from checked to undecidable, which is exactly how a
 * checker gets muted, and the failure was SELF-INFLICTED: the fix that deletes
 * the contrast defect class (a swept `contrast-color()` foreground held a
 * 4.584:1 floor across 4,913 surfaces with zero failures) is the very thing that
 * blinds the checker verifying it.
 *
 * So colour resolution moved into the adapter, which resolves by PAINTING —
 * a 1×1 canvas and one pixel read. The rule asks for a colour and gets sRGB
 * back. It cannot go blind on a syntax again, because it no longer knows that
 * syntax exists.
 *
 * FOUR WAYS TO LOSE THE CLAIM, all routed through `out.undecidable()` rather
 * than a `continue`, because a rule that cannot decide MUST say so:
 *
 *   1. A colour the adapter could not resolve at all. After the canvas path this
 *      should be unreachable in a browser — every syntax measured resolves,
 *      including out-of-gamut values, which the compositor clamps, and clamped
 *      is what the reader saw. It remains reachable in a DOM without a 2D
 *      context, and reachable-but-loud is the correct failure direction.
 *   2. A backdrop that is an IMAGE. `backdrop()` was a background-COLOUR walk,
 *      so an ancestor carrying `background-image` contributed nothing and the
 *      rule silently measured the colour BEHIND the image — a confident number
 *      about pixels it never looked at. The honest verdict is that no single
 *      colour is behind the text.
 *   3. A FADED stack: `opacity` below 1, or a translucent background colour,
 *      between the reader and the text. This was the worst of the three and the
 *      sixth oracle bug in this family. The shipped disabled action
 *      (`roles.css:130`, `opacity: 0.45`) was reported at **18.85:1 while it
 *      actually paints 3.03:1** — 4.22:1 in dark — a six-fold error in the
 *      direction of false confidence. WCAG 1.4.3 exempts inactive components, so
 *      it was never a conformance failure; that is precisely why it survived.
 *      The checker was wrong in the one place nobody was looking, and being
 *      right there is the whole product.
 *   4. NO FLOOR DECLARED — the theme that owns the threshold is not loaded, so
 *      the custom property resolves to nothing. The argument for admitting this
 *      rather than falling back to WCAG's constant is at the read itself; the
 *      short version is that a fallback would put the number back in this file,
 *      which is the defect the theme tokens were introduced to delete.
 *
 * Compositing an opacity chain would make (3) a NUMBER rather than an
 * admission, and it is deliberately not attempted here. A rushed composite is
 * another confident wrong number, which is the thing this file is being repaired
 * for. The remedy the audit measured is in the table, not the checker: derived
 * muted ink takes the same control from 3.03:1 to 10.05:1 and keeps the state
 * visible under forced colors. Until that lands, N680 names it.
 *
 * A translucent FOREGROUND stays undecidable for the same reason it always did,
 * now stated by the adapter's alpha rather than by a regex branch.
 *
 * WHICH GEOMETRY THIS CLAIM IS ABOUT: none. Contrast is a colour claim, so this
 * rule asks for neither `box()` nor `bounds()`. It still selects through
 * `painted()`, because rendered-ness is a precondition of the claim rather than
 * a measurement: a `display: none` node has no painted colours at all, and the
 * backdrop walk above it would report whatever an invisible node happens to
 * inherit. `painted()` is the lens's way of saying that once, in the selector.
 */

import type { Rgba, Rule } from '../../contracts.js';
import { rule } from '../rule.js';

function luminance(colour: Rgba): number {
  const linear = [colour[0], colour[1], colour[2]].map((value) => {
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

      const backdrop = el.backdrop();
      if (backdrop.colour === null) {
        // The adapter already knows WHY, in the reader's terms, and it names the
        // ancestor responsible. Restating that inference here would be a second
        // place for it to drift.
        out.undecidable(el.subject, `contrast undecidable: ${backdrop.detail}`);
        continue;
      }

      const front = el.colour('color');
      if (front === null) {
        out.undecidable(
          el.subject,
          `contrast undecidable: cannot resolve the text colour ${el.raw('color') || '<empty>'} to an sRGB value`,
        );
        continue;
      }
      if (front[3] < 1) {
        out.undecidable(
          el.subject,
          `contrast undecidable: the text colour ${el.raw('color')} is translucent, so it composites with ${backdrop.detail}`,
        );
        continue;
      }

      const [bright, dim] = [luminance(front), luminance(backdrop.colour)].sort((a, b) => b - a) as [
        number,
        number,
      ];
      const ratio = (bright + 0.05) / (dim + 0.05);
      // Both BRANCH reads want `px()`: a keyword weight (`bold`) and an
      // unresolvable font-size are alike "not a number at or above the
      // threshold", and the `|| 0` says so without a NaN leaking into the
      // branch. Neither has to tell "zero" from "unresolvable" — a font sized 0
      // paints nothing to read either way — so neither reaches for `raw()`.
      // The FLOOR below is the read that does, and the difference between the
      // two cases is the whole reason both accessors exist.
      const size = el.px('font-size');
      const weight = el.px('font-weight');
      const large = size >= 18.66 || (size >= 14 && weight >= 700);
      // The floor is the THEME'S, resolved from this element, so both
      // thresholds WCAG names sit in the table beside every other value the
      // reader can see — and so a consumer can raise them without forking this
      // file. `raw()` and an explicit parse, never `px()`: `px()` coerces an
      // absent property to zero, a zero floor is cleared by every ratio a
      // contrast can have, and the check would pass on everything, silently and
      // forever. An explicit zero is refused for the same reason; a floor no
      // ratio can fail is not a check.
      const threshold = large ? '--intent-min-contrast-large' : '--intent-min-contrast';
      const resolved = el.raw(threshold);
      const floor = Number.parseFloat(resolved);
      if (!(Number.isFinite(floor) && floor > 0)) {
        // WHY THIS IS UNDECIDABLE AND NOT A FALLBACK TO WCAG'S CONSTANT. The
        // other answer is defensible and was the first instinct, so both sides
        // belong here rather than only the one that won.
        //
        // FOR the fallback: WCAG's floor is not a matter of local opinion, and
        // a checker that applies the standard beats one that goes quiet because
        // a stylesheet is missing.
        //
        // AGAINST, on three counts. First, this does not go quiet — N680 is a
        // finding with a severity, naming the asking rule and the property that
        // failed to resolve, which is a repair instruction. The quiet outcome
        // is the zero floor above, and it is the one being refused. Second, a
        // fallback constant puts the ratio back in this file, which is the
        // defect the tokens were introduced to delete, and it makes the theme's
        // declaration UNFALSIFIABLE: delete the token and every test still
        // passes, so nothing ever notices it died again — which is precisely
        // how a comment claiming the threshold lived in the theme survived
        // beside two literals here. Third, the selector above is this package's
        // own vocabulary, so a document reaching this line without the theme is
        // not a page missing one stylesheet; it is intent markup with no
        // resolution table at all, no type ramp and no colour table included.
        // A WCAG verdict about a palette this package did not resolve is a
        // confident number about something nobody configured.
        //
        // THE COST, NAMED: a consumer who ships their own colour table and not
        // these tokens gets N680 on every text node instead of a verdict. That
        // is loud, and one declaration ends it. The error in the other
        // direction is silent and permanent, and the tally this experiment
        // already keeps — three of its four oracle bugs silent rather than
        // noisy — is why that trade is not close.
        out.undecidable(
          el.subject,
          `contrast undecidable: ${threshold} resolves to ${resolved || '<empty>'}, so no floor is declared for ${large ? 'large' : 'normal'} text here`,
        );
        continue;
      }
      if (ratio >= floor) continue;
      // The painted colours, not the authored strings: `oklab(0.696745 …)` tells
      // the reader nothing about what is on screen, and a derived table produces
      // almost nothing else.
      const [red, green, blue] = front;
      out.finding(
        el.subject,
        `contrast ${ratio.toFixed(2)}:1 below the ${floor}:1 floor for ${large ? 'large' : 'normal'} text (painted rgb(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)}) on ${backdrop.detail})`,
      );
    }
  });
}
