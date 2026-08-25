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
 * is how a checker gets muted.
 */

import type { Finding, Inspector, Rule } from '../../contracts.js';
import { codeEntry } from '../codes.js';

const CODE = codeEntry('N640');
const UNDECIDABLE = codeEntry('N680');

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
  return {
    code: CODE.code,
    title: CODE.title,
    run(inspector: Inspector<TNode>): readonly Finding[] {
      const findings: Finding[] = [];
      for (const node of inspector.all('[data-text], [data-appearance="action"]')) {
        // F4: an unrendered node has no painted colours at all, and measuring
        // collapsed candidates is what produced the first run's false failures.
        if (!inspector.rendered(node)) continue;
        if (inspector.text(node).trim() === '') continue;

        const foreground = inspector.style(node, 'color');
        const background = inspector.backdrop(node);
        const front = channels(foreground);
        const back = channels(background);
        if (!front || !back) {
          findings.push({
            code: UNDECIDABLE.code,
            severity: UNDECIDABLE.severity,
            subject: inspector.describe(node),
            detail: `contrast undecidable: cannot composite ${foreground} on ${background}`,
            hint: 'Resolve the colour to an opaque sRGB value, or accept that this node needs a human.',
          });
          continue;
        }

        const [bright, dim] = [luminance(front), luminance(back)].sort((a, b) => b - a) as [
          number,
          number,
        ];
        const ratio = (bright + 0.05) / (dim + 0.05);
        const size = Number.parseFloat(inspector.style(node, 'font-size'));
        const weight = Number(inspector.style(node, 'font-weight'));
        const large = size >= 18.66 || (size >= 14 && weight >= 700);
        const floor = large ? 3 : 4.5;
        if (ratio >= floor) continue;
        findings.push({
          code: CODE.code,
          severity: CODE.severity,
          subject: inspector.describe(node),
          detail: `contrast ${ratio.toFixed(2)}:1 below the ${floor}:1 floor for ${large ? 'large' : 'normal'} text (${foreground} on ${background})`,
          hint: CODE.hint,
        });
      }
      return findings;
    },
  };
}
