/**
 * appearance.ts — the framework-side half of C11.
 *
 * Three things live here, and nothing else:
 *   1. `fit()`          — the measured tier: an ordered loop over declared
 *                         degradations. ~30 lines. The only novel runtime code.
 *   2. `check()`        — verification as a byproduct: because the engine knows
 *                         the rules that produced every value, it can audit the
 *                         result with no author writing a single assertion.
 *   3. `explain()`      — provenance: why is this element this size.
 *
 * In a real implementation 1 lives in @nisli/core, 2 lives in `nisli check`,
 * and 3 is dev-only. This file is the experiment's stand-in for all three.
 */

import { onCleanup, onMount } from '@nisli/core';

/* ═══════════════════════════════════════════════════════════════════════════
   1. The measured tier — fit solving
   ═══════════════════════════════════════════════════════════════════════════
   Contract, declared by the author in markup:
     data-fit                  on the container that must not overflow
     data-priority="1..5"      lower survives longer (1 = most important)
     data-collapse="menu"      move into the overflow trigger when it will not fit
     data-collapse="truncate"  clamp to a single ellipsised line instead
     data-overflow             the trigger the engine reveals when it collapses

   Everything below is the whole algorithm. It is NOT a constraint solver: it
   sorts declared candidates by ascending importance and degrades until the
   container stops overflowing.
*/

function candidates(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-collapse]')]
    .filter((el) => el.closest('[data-fit]') === container)
    .sort((a, b) => Number(b.dataset.priority ?? 3) - Number(a.dataset.priority ?? 3));
}

function degrade(container: HTMLElement, el: HTMLElement): void {
  if (el.dataset.collapse === 'truncate') {
    el.dataset.truncate = '';
    return;
  }
  el.dataset.collapsed = '';
  const overflowTrigger = container.querySelector<HTMLElement>('[data-overflow]');
  if (overflowTrigger) overflowTrigger.dataset.shown = '';
}

function restore(container: HTMLElement): void {
  for (const el of candidates(container)) {
    delete el.dataset.collapsed;
    delete el.dataset.truncate;
  }
  const overflowTrigger = container.querySelector<HTMLElement>('[data-overflow]');
  if (overflowTrigger) delete overflowTrigger.dataset.shown;
}

/** Solve one container. Idempotent: always re-solves from the undegraded state. */
export function solve(container: HTMLElement): void {
  restore(container);
  const items = candidates(container);
  let i = 0;
  while (container.scrollWidth > container.clientWidth + 1 && i < items.length) {
    degrade(container, items[i++]!);
  }
  container.dataset.fit =
    container.scrollWidth > container.clientWidth + 1 ? 'unsatisfiable' : 'settled';
  container.dataset.collapsedCount = String(items.filter((el) => 'collapsed' in el.dataset).length);
}

/**
 * Attach the measured tier to a component's own subtree. Call in setup; it
 * observes on mount and disposes on cleanup, so the lifecycle is the
 * framework's, not the author's.
 */
export function fit(host: HTMLElement): void {
  // Both hooks MUST be registered synchronously in setup: onCleanup() inside an
  // onMount() callback throws N402 (the framework's own boundary caught exactly
  // that while this experiment was being written).
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) solve(entry.target as HTMLElement);
  });

  onMount(() => {
    const containers = host.matches('[data-fit]')
      ? [host]
      : [...host.querySelectorAll<HTMLElement>('[data-fit]')];
    for (const container of containers) {
      solve(container);
      observer.observe(container);
    }
  });

  onCleanup(() => observer.disconnect());
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. Verification as a byproduct
   ═══════════════════════════════════════════════════════════════════════════
   No author writes any of these. They are derivable because the engine owns
   the resolution table: it knows the legal vocabulary, the scale, and which
   containers promised to fit.
*/

export type Finding = {
  code: string;
  severity: 'fail' | 'warn' | 'incomplete';
  subject: string;
  detail: string;
};

const LEGAL = {
  layout: ['row', 'stack', 'wrap', 'grid'],
  appearance: ['action', 'avatar', 'field', 'nav-item', 'table', 'surface'],
  role: ['primary', 'quiet', 'danger', 'link'],
  text: ['display', 'title', 'body', 'meta', 'label'],
  density: ['comfortable', 'compact', 'dense'],
  input: ['pointer', 'touch'],
} as const;

function describe(el: Element): string {
  const owner = el.closest('[data-component]')?.getAttribute('data-component');
  const tag = el.tagName.toLowerCase();
  return owner ? `${owner} › ${tag}` : tag;
}

/** Contrast ratio of two rgb() strings, WCAG 2.x relative luminance. */
function contrast(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = (c.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0']).map(Number) as [number, number, number];
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

export function check(root: ParentNode = document): Finding[] {
  const out: Finding[] = [];

  // N601 — escaped subtrees are excluded from every guarantee below.
  for (const el of root.querySelectorAll('[data-escaped]')) {
    out.push({
      code: 'N601',
      severity: 'warn',
      subject: describe(el),
      detail: `escaped appearance: ${el.getAttribute('data-escaped')} — this subtree is excluded from rhythm, fit and contrast guarantees`,
    });
  }

  // N610 — a value outside the declared vocabulary. Only possible because the
  // vocabulary is closed and enumerable.
  for (const [attr, legal] of Object.entries(LEGAL)) {
    for (const el of root.querySelectorAll(`[data-${attr}]`)) {
      const v = el.getAttribute(`data-${attr}`);
      if (v && !(legal as readonly string[]).includes(v)) {
        out.push({
          code: 'N610',
          severity: 'fail',
          subject: describe(el),
          detail: `data-${attr}="${v}" is not in the vocabulary (${legal.join(' | ')})`,
        });
      }
    }
  }

  // N620 — a container that promised to fit and could not.
  for (const el of root.querySelectorAll<HTMLElement>('[data-fit]')) {
    if (el.dataset.fit === 'unsatisfiable') {
      out.push({
        code: 'N620',
        severity: 'fail',
        subject: describe(el),
        detail: `unsatisfiable at ${Math.round(el.clientWidth)}px: content needs ${Math.round(el.scrollWidth)}px after all declared degradations`,
      });
    }
  }

  // N630 — anything escaping the viewport. The one absolute assertion, per
  // ROUND2 evidence (relational-only checks passed a 704px page at 704px).
  const doc = document.documentElement;
  if (doc.scrollWidth > window.innerWidth + 1) {
    out.push({
      code: 'N630',
      severity: 'fail',
      subject: 'document',
      detail: `page scrollWidth ${doc.scrollWidth}px exceeds viewport ${window.innerWidth}px`,
    });
  }

  // N640 — text contrast. Derivable because colour came from the table.
  for (const el of root.querySelectorAll<HTMLElement>('[data-text], [data-appearance="action"]')) {
    if (!el.textContent?.trim()) continue;
    // A collapsed candidate is display:none — measuring it produced a wave of
    // false failures on the first run. The round-2 corpus records the same
    // hazard three times ("the oracle itself was wrong"): a check that reports
    // on unrendered nodes gets muted, so rendered-ness is a precondition, and
    // it is asserted before every measurement below.
    if (!el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true })) continue;
    const cs = getComputedStyle(el);
    let backdrop: HTMLElement | null = el;
    let bg = cs.backgroundColor;
    while (backdrop && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) {
      backdrop = backdrop.parentElement;
      bg = backdrop ? getComputedStyle(backdrop).backgroundColor : 'rgb(255, 255, 255)';
    }
    const ratio = contrast(cs.color, bg);
    const large =
      parseFloat(cs.fontSize) >= 18.66 ||
      (parseFloat(cs.fontSize) >= 14 && Number(cs.fontWeight) >= 700);
    const floor = large ? 3 : 4.5;
    if (ratio < floor) {
      out.push({
        code: 'N640',
        severity: 'fail',
        subject: describe(el),
        detail: `contrast ${ratio.toFixed(2)}:1 below ${floor}:1 (${cs.color} on ${bg})`,
      });
    }
  }

  // N650 — hit target, in contexts that declared a floor.
  for (const el of root.querySelectorAll<HTMLElement>(
    '[data-appearance="action"], [data-appearance="nav-item"]',
  )) {
    const target = parseFloat(getComputedStyle(el).getPropertyValue('--min-target')) || 0;
    if (target <= 0) continue;
    if (!el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true })) continue;
    const rect = el.getBoundingClientRect();
    if (rect.height + 0.5 < target || rect.width + 0.5 < target) {
      out.push({
        code: 'N650',
        severity: 'fail',
        subject: describe(el),
        detail: `hit target ${Math.round(rect.width)}×${Math.round(rect.height)} below the ${target}px floor declared by this context`,
      });
    }
  }

  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. Provenance
   ═══════════════════════════════════════════════════════════════════════════ */

export function explain(el: HTMLElement): Record<string, unknown> {
  const cs = getComputedStyle(el);
  const ctx = el.closest('[data-density]') as HTMLElement | null;
  const input = el.closest('[data-input]') as HTMLElement | null;
  return {
    element: describe(el),
    declared: {
      appearance: el.dataset.appearance ?? null,
      role: el.dataset.role ?? null,
      text: el.dataset.text ?? null,
      priority: el.dataset.priority ?? null,
      collapse: el.dataset.collapse ?? null,
    },
    context: {
      density: ctx?.dataset.density ?? '(root)',
      input: input?.dataset.input ?? 'pointer',
      surfaceDepth: el.closest('[data-surface]')
        ? [...document.querySelectorAll('[data-surface]')].filter((s) => s.contains(el)).length
        : 0,
      unit: cs.getPropertyValue('--unit').trim(),
      minTarget: cs.getPropertyValue('--min-target').trim(),
    },
    resolved: {
      blockSize: `${Math.round(el.getBoundingClientRect().height)}px`,
      paddingInline: cs.paddingInline || cs.paddingLeft,
      gap: cs.gap,
      fontSize: cs.fontSize,
      background: cs.backgroundColor,
      color: cs.color,
    },
    rule: el.dataset.appearance
      ? `theme.css [data-appearance="${el.dataset.appearance}"] × --unit=${cs.getPropertyValue('--unit').trim()}`
      : 'inherited only',
  };
}
