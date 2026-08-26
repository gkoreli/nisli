/**
 * dom.ts — the ONLY DOM reader in the diagnostics half.
 *
 * Everything the rules are allowed to know arrives through here, which is why
 * `grep -n 'document\.\|window\.\|getComputedStyle' rules/*.ts` finds no DOM
 * access at all. Verified after the move into this package: the grep's only hit
 * across all fifteen rule files is the word "document" ending a sentence in one
 * of N715's comments, which is the same single hit it produced in the
 * prototype. Stated as "no DOM access" rather than "returns nothing", because a
 * claim that is off by one prose match is a claim a reader stops running.
 *
 * The rules stay here rather than graduating. ADR 0032 §1 makes this package a
 * PERMANENT peer and keeps `@nisli/core` barebones with no CSS and no
 * appearance surface, so "the pure domain eventually moves into core" — which
 * the prototype wrote down as its plan — is not the plan any more. What the
 * split still buys is unchanged and is the reason to keep it: every rule is
 * testable with no browser, and this file is the only part anyone has to review
 * for byte cost and browser quirks.
 */

import type { Backdrop, Bounds, Box, Containment, Inspector, Rgba } from '../contracts.js';

/**
 * `contain` keywords that include PAINT containment, and therefore clip.
 *
 * Measured, Chromium 151: with `contain: paint`, `contain: content`,
 * `contain: strict` or `contain: layout paint`, a 471-pixel child inside a 200-pixel box
 * is clipped while `overflow-x` and `overflow-y` both compute to `visible`.
 * `contain: size layout` does NOT clip, which is why this is a keyword test
 * rather than "is `contain` set".
 *
 * A substring test on the computed value is enough and is not a shortcut:
 * `contain` serialises as the canonical keyword list, so `paint` appears iff
 * paint containment applies, and `content` and `strict` are the two shorthands
 * that imply it.
 */
const PAINT_CONTAINING = /\b(?:paint|content|strict)\b/;

/**
 * Computed overflow values whose content stays REACHABLE, and values that CUT
 * IT OFF. Enumerated rather than spelled as `!== 'visible'` for the same reason
 * the solver's table is: happy-dom does not expand the `overflow` shorthand and
 * does not default the longhand, so the computed value is the empty string
 * there, and a negative spelling would classify every element as containing its
 * content and go vacuously quiet in exactly the environment the unit tests run
 * in. An unknown value must fail safe to `visible`.
 *
 * `overlay` is absent from both by measurement, not oversight: css-overflow-3
 * makes it a legacy alias that computes to `auto`, confirmed here in Chromium
 * 151, so no computed value can ever equal it. It sat in two tables for two
 * months; a dead branch in a fail-safe table is worse than a gap, because it
 * reads as coverage.
 */
const SCROLLING: Readonly<Record<string, true>> = { auto: true, scroll: true };
const CLIPPING: Readonly<Record<string, true>> = { hidden: true, clip: true };

/**
 * Elements that paint their own content, so no ancestor colour is behind text
 * drawn over them.
 *
 * `IMG` is deliberately absent: it is a void element and can never be an
 * ancestor of anything, so a branch for it would read as coverage while being
 * unreachable — the same mistake as `overlay` above.
 */
const PAINTS_ITS_OWN: Readonly<Record<string, true>> = { VIDEO: true, CANVAS: true };

/**
 * Human-readable identity. Module level because two members need it in lockstep:
 * `describe()` names the subject of a finding, and `backdrop()` names the
 * ancestor that defeated a contrast claim. Two spellings of "which element is
 * this" would eventually disagree in a report.
 */
function describeNode(node: HTMLElement): string {
  const owner = node.closest('[data-component]')?.getAttribute('data-component');
  const tag = node.tagName.toLowerCase();
  return owner && owner !== tag ? `${owner} › ${tag}` : tag;
}

/**
 * Resolve any CSS colour string to sRGB by PAINTING it, one pixel at a time.
 *
 * This replaces a regex that accepted `rgb…` and `color(srgb …)` and returned
 * null for everything else. The regex was fine for an authored table and went
 * blind the moment the table derived: `color-mix()` and `contrast-color()` both
 * compute to `oklab(…)` in Chromium, and 288 of 1188 measured text cells —
 * 31.8% of derived cells against 9.1% of authored ones — stopped producing a
 * contrast number at all. Roughly a third of the contrast surface went from
 * checked to undecidable, which is exactly how a checker gets muted.
 *
 * The compositor is the right authority, not a parser, because the question is
 * not "what does this string mean" but "what did the reader see". Measured
 * through this path in Chromium 151: `oklab(0.379998 …)` → 66,66,66;
 * `oklch(0.7 0.1 200)` → 64,177,183; `color-mix(in oklab, white 88%, black)`
 * → 215,215,215; `color(display-p3 0.1 0.55 0.35)` → 0,143,84; and the
 * out-of-gamut `oklch(0.9 0.4 140)` → 0,255,0, gamut-clamped, which is what was
 * on screen.
 *
 * TWO SENTINELS, because a rejected value is silent. Assigning an invalid
 * colour to `fillStyle` leaves the previous value in place, so painting after a
 * rejection would report the sentinel as if it were the answer — a confident
 * wrong colour, the failure direction this whole change exists to remove.
 * Assigning the value over two DIFFERENT sentinels and comparing distinguishes
 * "resolved" from "ignored" with no guessing: measured `null` for `''` and for
 * `not-a-colour`, and a real triple for every syntax above.
 *
 * NO STRING-PARSING FALLBACK, ever. happy-dom has no 2D canvas context, so
 * `resolver()` returns null there and every colour reads as unresolvable. That
 * is deliberate and it is the fail-safe direction: an undecidable finding is
 * loud, whereas a hand-rolled parser in the one environment the unit tests run
 * in would mean the tests exercise a definition of "colour" the browser does
 * not share — precisely the trap `rendered()` documents two members below about
 * polyfilling `checkVisibility`. Domain tests resolve colour through
 * `FakeInspector`, which is given triples.
 */
function resolver(): (value: string) => Rgba | null {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  // One cache per inspector: a page has a handful of distinct colours and a
  // rule asks for them once per element. `getImageData` is the expensive call.
  const cache = new Map<string, Rgba | null>();

  return (value: string): Rgba | null => {
    if (context === null) return null;
    const hit = cache.get(value);
    if (hit !== undefined) return hit;

    context.fillStyle = 'black';
    context.fillStyle = value;
    const first = context.fillStyle;
    context.fillStyle = 'white';
    context.fillStyle = value;
    if (context.fillStyle !== first) {
      cache.set(value, null);
      return null;
    }

    context.clearRect(0, 0, 1, 1);
    context.fillRect(0, 0, 1, 1);
    const [red = 0, green = 0, blue = 0, opacity = 0] = context.getImageData(0, 0, 1, 1).data;
    const alpha = opacity / 255;
    // The pixel is premultiplied, so un-premultiply to recover the authored
    // channels. A fully transparent pixel carries no channels to recover.
    const resolved: Rgba =
      alpha === 0
        ? [0, 0, 0, 0]
        : [
            Math.min(255, red / alpha),
            Math.min(255, green / alpha),
            Math.min(255, blue / alpha),
            alpha,
          ];
    cache.set(value, resolved);
    return resolved;
  };
}

export function domInspector(root: ParentNode): Inspector<HTMLElement> {
  // The crush rule asks every element in the document for two properties. The
  // declaration object is live and resolves lazily per property, so keeping it
  // costs one WeakMap entry and saves a lookup per question.
  const declarations = new WeakMap<HTMLElement, CSSStyleDeclaration>();
  const resolve = resolver();

  function styles(node: HTMLElement): CSSStyleDeclaration {
    let declaration = declarations.get(node);
    if (!declaration) {
      declaration = getComputedStyle(node);
      declarations.set(node, declaration);
    }
    return declaration;
  }

  return {
    all(selector: string): readonly HTMLElement[] {
      return [...root.querySelectorAll<HTMLElement>(selector)];
    },

    within(node: HTMLElement, selector: string): readonly HTMLElement[] {
      return [...node.querySelectorAll<HTMLElement>(selector)];
    },

    attr(node: HTMLElement, name: string): string | null {
      return node.getAttribute(name);
    },

    text(node: HTMLElement): string {
      return node.textContent ?? '';
    },

    describe(node: HTMLElement): string {
      return describeNode(node);
    },

    rendered(node: HTMLElement): boolean {
      // `display: contents` is the trap, and it is the single precondition for
      // every measuring rule in this set. Component hosts are layout-transparent
      // (app-text, app-button, …), so a host has NO box: clientWidth,
      // scrollWidth and every rect read 0. `checkVisibility()` nonetheless
      // returns TRUE for it — the round-2 corpus recorded exactly this
      // false-PASS ("checkVisibility on display:contents hosts fooled the
      // preview sweep"), and 0/0 geometry would otherwise surface as a crush or
      // a failed hit target. Answering "not rendered" here is honest for a
      // measurement question and keeps all nine rules free of the special case;
      // nothing is lost, because every declaration lives on the inner element
      // that IS the flex child. Rules that read declarations rather than
      // geometry (N601, N610) never ask this question.
      if (styles(node).display === 'contents') return false;
      // Otherwise the browser's own answer, which covers ancestors,
      // `visibility` and content-visibility in one call. Deliberately NOT
      // feature-detected: happy-dom v20 has no `checkVisibility`, and quietly
      // substituting a hand-rolled ancestor walk there would mean the unit
      // tests exercise a different definition of rendered-ness than the browser
      // does. A test environment that needs this polyfills it in its setup.
      return node.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true });
    },

    measurable(node: HTMLElement): boolean {
      // The disagreement, and nothing else: visible to `checkVisibility()` but
      // NOT visible once `content-visibility: auto` is taken into account means
      // "this content is there, and its geometry is stale". Measured on the same
      // Chromium 151 the audit used: a skipped node answers true / false, a
      // `content-visibility: hidden` node answers false / false, a
      // `visibility: hidden` node answers true / true, and a normal node answers
      // true / true. Only the skipped case splits.
      //
      // Not `visibilityProperty: true` on either call, deliberately: adding it
      // would make a `visibility: hidden` node answer true / false and read as
      // unmeasurable, which it is not — it has an honest box and honest
      // geometry, it simply is not painted. `rendered()` is the member that
      // owns that question, and this one must not become a second, subtly
      // different copy of it.
      return !(node.checkVisibility() && !node.checkVisibility({ contentVisibilityAuto: true }));
    },

    box(node: HTMLElement): Box {
      // `clientWidth` is the space the box GOT, `scrollWidth` the space its
      // content WANTS. Both are zero on a non-replaced inline element, so a
      // crush inside pure inline text is invisible to every measured rule —
      // the layout vocabulary produces flex and grid items, which do report.
      return { inline: node.clientWidth, block: node.clientHeight, contentInline: node.scrollWidth };
    },

    bounds(node: HTMLElement): Bounds {
      // `getBoundingClientRect()` IS the pressable rectangle: it includes
      // borders and it follows transforms, which is exactly what a pointer
      // hits. The rule this replaces reconstructed the same number by adding
      // four resolved border longhands to a padding box — arithmetic that was
      // correct only while no ancestor was transformed, and that shipped 710
      // false failures on the run where two of those longhands resolved to the
      // empty string.
      //
      // It is also the rectangle's ORIGIN, which is what makes N713 and N715
      // expressible at all: a scroll extent cannot see start-side overflow and
      // a column box is not an element, so both had to become rect-against-rect
      // comparisons. Viewport coordinates, so two rects read in the same frame
      // are directly comparable; `x`/`y` rather than `left`/`top` because they
      // are the ones defined to follow a flipped rectangle.
      //
      // Fractional by design. A floor derived from a fractional unit lands on
      // values like 44.5, and rounding here would hide a real shortfall or
      // invent one; the caller owns its own tolerance.
      const rect = node.getBoundingClientRect();
      return { inline: rect.width, block: rect.height, inlineStart: rect.x, blockStart: rect.y };
    },

    containment(node: HTMLElement): Containment {
      const declaration = styles(node);
      const { overflowX, overflowY } = declaration;
      // Reachability wins over clipping when the two axes disagree: the box IS
      // a scroll container, so its overflow is reachable on at least one axis.
      // Measured combinations that reach here: `auto`/`hidden` stays as spelled,
      // and `clip`/`auto` computes the clipped axis to `hidden`.
      if (SCROLLING[overflowX] || SCROLLING[overflowY]) return 'scroll';
      if (CLIPPING[overflowX] || CLIPPING[overflowY]) return 'clip';
      // Paint containment clips while BOTH overflow axes compute to `visible`.
      // This branch is the whole reason `containment()` exists rather than a
      // property read at each call site; measured 523/200 and 540/200 for
      // `contain: paint` and `contain: content` respectively.
      if (PAINT_CONTAINING.test(declaration.contain)) return 'clip';
      return 'visible';
    },

    style(node: HTMLElement, property: string): string {
      return styles(node).getPropertyValue(property).trim();
    },

    colour(node: HTMLElement, property: string): Rgba | null {
      return resolve(styles(node).getPropertyValue(property).trim());
    },

    backdrop(node: HTMLElement): Backdrop {
      // One walk, three ways to lose the claim, checked in the order the reader
      // meets them: anything that fades the stack defeats the number before the
      // question of WHICH colour is even reached.
      for (let current: HTMLElement | null = node; current; current = current.parentElement) {
        const declaration = styles(current);

        const opacity = Number.parseFloat(declaration.opacity);
        if (opacity < 1) {
          return {
            kind: 'faded',
            colour: null,
            detail: `opacity ${declaration.opacity} on ${describeNode(current)} composites the text with what is behind it`,
          };
        }

        if (declaration.backgroundImage !== 'none' || PAINTS_ITS_OWN[current.tagName]) {
          return {
            kind: 'image',
            colour: null,
            detail: `${describeNode(current)} paints ${declaration.backgroundImage === 'none' ? 'its own content' : declaration.backgroundImage}, so no single colour is behind this text`,
          };
        }

        const raw = declaration.backgroundColor;
        const painted = resolve(raw);
        if (painted === null) {
          return { kind: 'unresolvable', colour: null, detail: `cannot resolve ${raw || '<empty>'}` };
        }
        const alpha = painted[3];
        if (alpha === 0) continue; // paints nothing; keep walking outward
        if (alpha < 1) {
          return {
            kind: 'faded',
            colour: null,
            detail: `${raw} on ${describeNode(current)} is translucent, so the text sits on a composite of two layers`,
          };
        }
        return { kind: 'painted', colour: painted, detail: raw };
      }
      // Nothing in the ancestry paints, so the canvas shows through. Naming the
      // UA default beats reporting "transparent", which would make every
      // contrast ratio meaningless.
      return { kind: 'painted', colour: [255, 255, 255, 1], detail: 'canvas' };
    },

    viewport(): { readonly inline: number; readonly documentInline: number } {
      return { inline: window.innerWidth, documentInline: document.documentElement.scrollWidth };
    },
  };
}
