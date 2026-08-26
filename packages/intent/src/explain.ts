/**
 * explain.ts — provenance: why is this element this size, this colour, this tall.
 *
 * This file only exists because appearance is DERIVED. When a value comes from
 * one resolution table applied to a declaration and a context, the chain that
 * produced it is a fact the engine already has: declaration in, context axes,
 * resolved value out. A codebase where the same button gets its height from a
 * hand-picked class cannot answer this question at all — the answer is "someone
 * chose it", and the chain ends at a person who has left.
 *
 * Dev-only in spirit. The output is JSON-serializable on purpose: it goes into
 * a devtools panel, a snapshot test or a bug report unchanged.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A DEAD SELECTOR LIVES IN THIS FILE. FOUND DURING THE PORT, NOT REPAIRED.
 * ══════════════════════════════════════════════════════════════════════════
 * `surfaceDepth` below walks `[data-surface]`, and `emphasis` falls back to
 * `data-emphasis`. NEITHER IS A DECLARATION ANYTHING WRITES. The vocabulary
 * spells a surface as `data-appearance="surface"` and emphasis as `data-role`;
 * `AXIS_ATTRS` in contracts.ts says so, and the resolution table selects
 * accordingly. So `surfaceDepth` is a field that reports zero for every
 * element in every document, forever, and the `data-emphasis` arm of that
 * fallback can never be taken.
 *
 * THIS IS THE N700 DEFECT, THE SAME ONE, STILL SHIPPED — the rule that matched
 * `[data-surface]`, found nothing, and reported a clean page. It was repaired
 * in the rule and left standing here, which is precisely the defect class
 * N715's comment names: a fix applied to one call site and not to the one
 * beside it. And it survived here for the reason it always survives: nothing
 * measures a provenance report, so a field that reads zero reads like a fact.
 *
 * WHY IT IS RECORDED RATHER THAN FIXED. `surfaceDepth` is not a typo with an
 * obvious correction. Nested surfaces are real — the table paints `s1`/`s2`/
 * `s3` by nesting depth — so the field is asking a question the table answers,
 * and repairing it means deciding what counts as a surface for provenance
 * (every `[data-appearance="surface"]`? the region too, as N700 scopes it?).
 * That is a vocabulary decision and this port does not take vocabulary
 * decisions. The reachability guard cannot see it either: it scans
 * `diagnostics/rules/`, because in the prototype that was where selectors that
 * could go dead lived. This file proves that scope was too narrow.
 */

export interface Explanation {
  /** The owning component and the element, as the diagnostics name it. */
  readonly element: string;
  /** What the author declared. Nothing here is an appearance decision. */
  readonly declared: {
    readonly appearance: string | null;
    /** The emphasis axis, authored as `data-role`. */
    readonly emphasis: string | null;
    readonly text: string | null;
    readonly layout: string | null;
    readonly align: string | null;
    readonly grow: boolean;
    readonly priority: string | null;
    readonly collapse: string | null;
    readonly escaped: string | null;
  };
  /** The only inputs that change a resolved value. */
  readonly context: {
    readonly density: string;
    readonly input: string;
    readonly theme: string;
    readonly surfaceDepth: number;
    readonly unit: string;
    readonly minTarget: string;
  };
  /** What the table produced. Every one of these is an output, never an input. */
  readonly resolved: {
    readonly blockSize: string;
    readonly inlineSize: string;
    readonly paddingInline: string;
    readonly gap: string;
    readonly fontSize: string;
    readonly fontWeight: string;
    readonly color: string;
    readonly background: string;
  };
  /** The table entry that produced the values above. */
  readonly rule: string;
}

export function explain(el: HTMLElement): Explanation {
  // Ask this of the element that carries the declarations, not of its component
  // host: hosts are layout-transparent (`display: contents`), so their rect is
  // 0×0 and the resolved sizes below would all read zero.
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const unit = style.getPropertyValue('--intent-unit').trim();

  const appearance = el.getAttribute('data-appearance');
  const emphasis = el.getAttribute('data-role') ?? el.getAttribute('data-emphasis');
  const text = el.getAttribute('data-text');
  const layout = el.getAttribute('data-layout');

  let surfaceDepth = 0;
  for (
    let surface = el.closest('[data-surface]');
    surface;
    surface = surface.parentElement?.closest('[data-surface]') ?? null
  ) {
    surfaceDepth += 1;
  }

  let rule = `inherited only, --intent-unit=${unit}`;
  if (appearance) {
    const emphasisSelector = emphasis ? `[data-role="${emphasis}"]` : '';
    rule = `theme/roles.css [data-appearance="${appearance}"]${emphasisSelector} × --intent-unit=${unit}`;
  } else if (text) {
    rule = `theme/roles.css [data-text="${text}"] × --intent-unit=${unit}`;
  } else if (layout) {
    rule = `theme/structure.css [data-layout="${layout}"] × --intent-unit=${unit}`;
  }

  const owner = el.closest('[data-component]')?.getAttribute('data-component');
  const tag = el.tagName.toLowerCase();

  return {
    element: owner && owner !== tag ? `${owner} › ${tag}` : tag,
    declared: {
      appearance,
      emphasis,
      text,
      layout,
      align: el.getAttribute('data-align'),
      grow: el.hasAttribute('data-grow'),
      priority: el.getAttribute('data-priority'),
      collapse: el.getAttribute('data-collapse'),
      escaped: el.getAttribute('data-escaped'),
    },
    context: {
      // Each axis is resolved by the nearest ancestor that declares it, self
      // included — the same cascade the theme itself relies on.
      density: el.closest('[data-density]')?.getAttribute('data-density') ?? 'comfortable',
      input: el.closest('[data-input]')?.getAttribute('data-input') ?? 'pointer',
      theme: el.closest('[data-theme]')?.getAttribute('data-theme') ?? 'light',
      surfaceDepth,
      unit,
      minTarget: style.getPropertyValue('--intent-min-target').trim(),
    },
    resolved: {
      blockSize: `${Math.round(rect.height)}px`,
      inlineSize: `${Math.round(rect.width)}px`,
      paddingInline: style.paddingInline || style.paddingLeft,
      gap: style.gap,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      color: style.color,
      background: style.backgroundColor,
    },
    rule,
  };
}
