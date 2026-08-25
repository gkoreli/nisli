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
  const unit = style.getPropertyValue('--unit').trim();

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

  let rule = `inherited only, --unit=${unit}`;
  if (appearance) {
    const emphasisSelector = emphasis ? `[data-role="${emphasis}"]` : '';
    rule = `theme/roles.css [data-appearance="${appearance}"]${emphasisSelector} × --unit=${unit}`;
  } else if (text) {
    rule = `theme/roles.css [data-text="${text}"] × --unit=${unit}`;
  } else if (layout) {
    rule = `theme/structure.css [data-layout="${layout}"] × --unit=${unit}`;
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
      minTarget: style.getPropertyValue('--min-target').trim(),
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
