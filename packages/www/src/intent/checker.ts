/**
 * intent/checker.ts — running `@nisli/intent/devtools` in the page, over both
 * halves of the comparison, and printing what it found.
 *
 * ── WHY THIS WORKS AT ALL, AND WHERE IT STOPS WORKING ──────────────────────
 * A rule addresses the DOM through a selector, so whether a rule can see a
 * Tailwind-authored surface is decided by that selector and nothing else. Four
 * of the fifteen shipped rules select `*` or the document, and those four are
 * genuinely stack-neutral. The rest select intent vocabulary and are structurally
 * blind to any other authoring style. The table is in `STACK_NEUTRAL` below,
 * with the source line for every entry, because this is the single most
 * misreadable thing about the comparison and an unsourced claim here would be
 * worthless.
 *
 * ── ONE PASS THIS CANNOT RUN, STATED RATHER THAN OMITTED ───────────────────
 * The prototype's proof also swept every overflow panel OPEN and re-ran the
 * whole rule set inside it, and that pass is what found 24 of 240 cells failing
 * N710 — a closed overlay is in no geometry at all, so every rule was blind to
 * it. Its driver (`sweepOverlays`) lives in the prototype's UI layer and is NOT
 * exported from `@nisli/intent/devtools`, so a consumer cannot reproduce that
 * pass from the package's public surface. What runs below is the CLOSED
 * document, and it says so in its own output rather than letting a clean result
 * imply more than it measured.
 */
import {
  computed,
  html,
  signal,
  type ReadonlySignal,
  type Signal,
  type TemplateResult,
} from '@nisli/core';
import type { Finding } from '@nisli/intent';
import { solveAll } from '@nisli/intent';
import { check, codeEntry, domInspector, formatFindings, summarize } from '@nisli/intent/devtools';

/** The attribute a checkable region declares about itself. One per half. */
export const SCOPE_ATTR = 'data-check-scope';

export type ScopeId = 'intent' | 'tailwind';

export const SCOPES: readonly ScopeId[] = ['intent', 'tailwind'];

/**
 * `null` until the first run; an empty array is a genuine CLEAN result, and the
 * two must never collapse into each other — "the checker found nothing" and
 * "the checker has not looked" are the exact pair this project keeps paying for.
 */
const RESULTS: Record<ScopeId, Signal<Finding[] | null>> = {
  intent: signal<Finding[] | null>(null),
  tailwind: signal<Finding[] | null>(null),
};

/**
 * Which of the fifteen rules can see a surface that was never authored in the
 * vocabulary. Derived by READING THE SELECTOR of each rule, with the file and
 * line recorded, because "stack-neutral" is a claim about source and a reader
 * has to be able to check it in one click.
 */
export const STACK_NEUTRAL: readonly {
  code: string;
  selector: string;
  source: string;
  neutral: boolean;
}[] = [
  { code: 'N601', selector: '[data-escaped]', source: 'rules/escaped.ts:22', neutral: false },
  { code: 'N610', selector: '[data-<axis>]', source: 'rules/vocabulary.ts:34', neutral: false },
  { code: 'N620', selector: '[data-fit]', source: 'rules/fit-state.ts:26', neutral: false },
  { code: 'N621', selector: '[data-truncate]', source: 'rules/truncation.ts:27', neutral: false },
  { code: 'N630', selector: 'the viewport', source: 'rules/viewport.ts:22', neutral: true },
  {
    code: 'N640',
    selector: '[data-text], [data-appearance="action"]',
    source: 'rules/contrast.ts:88',
    neutral: false,
  },
  {
    code: 'N650',
    selector: '[data-appearance="action"], [data-appearance="nav-item"]',
    source: 'rules/hit-target.ts:72',
    neutral: false,
  },
  { code: 'N660', selector: '*', source: 'rules/crushed.ts:108', neutral: true },
  {
    code: 'N670',
    selector: '[data-layout="row"] > *',
    source: 'rules/overlap.ts:80',
    neutral: false,
  },
  { code: 'N690', selector: '[data-text]', source: 'rules/shredded.ts:80', neutral: false },
  {
    code: 'N700',
    selector: '[data-appearance="surface"]',
    source: 'rules/competing-primaries.ts:88',
    neutral: false,
  },
  { code: 'N710', selector: '*', source: 'rules/clipped-loss.ts:154', neutral: true },
  { code: 'N713', selector: '*', source: 'rules/multicolumn.ts:108', neutral: true },
  {
    code: 'N715',
    selector: '[data-layout], [data-fit]',
    source: 'rules/directional-overflow.ts:108',
    neutral: false,
  },
  {
    code: 'N730',
    selector: '[data-fit="unsatisfiable"]',
    source: 'rules/spent-for-nothing.ts:67',
    neutral: false,
  },
];

export const NEUTRAL_CODES: readonly string[] = STACK_NEUTRAL.filter((r) => r.neutral).map(
  (r) => r.code,
);

/**
 * Solve, then look. Fit is a MEASURED tier, so a finding is only true of the
 * geometry on screen at the moment it was taken: the ruler changes what fits
 * without changing a single declaration, so a check run against stale solved
 * state is a check of a page nobody is looking at.
 */
export function runChecks(root: ParentNode = document): void {
  solveAll(root);
  for (const scope of SCOPES) {
    const region = root.querySelector(`[${SCOPE_ATTR}="${scope}"]`);
    // A region that is not on the page is NOT a clean region. Reporting `[]`
    // for a missing subject is the "silence read as success" failure this
    // package exists to delete, so it stays `null` — "not measured".
    RESULTS[scope].value = region === null ? null : check(domInspector(region));
  }
}

/** The headline: three severities, never collapsed to a boolean. */
function headline(found: readonly Finding[]): string {
  const { fail, warn, incomplete } = summarize(found);
  return `fail ${fail} · warn ${warn} · incomplete ${incomplete} · closed document only`;
}

/** Findings grouped by code, so a reader meets the CODE before the prose. */
function byCode(found: readonly Finding[]): { code: string; title: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const finding of found) counts.set(finding.code, (counts.get(finding.code) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, count]) => ({ code, title: codeEntry(code).title, count }));
}

/**
 * The report for one half. `incomplete` gets its own column rather than being
 * folded into a pass: a measurement the checker could not make is an unanswered
 * question, and three of the four silent oracle bugs in this project's history
 * were a rule quietly returning nothing.
 */
export function CheckReport(scope: ScopeId, label: string): TemplateResult {
  const found: ReadonlySignal<Finding[] | null> = RESULTS[scope];
  const summary = computed(() => (found.value === null ? 'not run yet' : headline(found.value)));
  const codes = computed(() => (found.value === null ? [] : byCode(found.value)));
  const text = computed(() =>
    found.value === null ? 'Press "Run the checker" above.' : formatFindings(found.value),
  );

  return html`<div class="rounded-xl border">
    <div class="flex flex-wrap items-baseline justify-between gap-2 border-b bg-muted/40 px-4 py-2">
      <span class="text-sm font-semibold">${label}</span>
      <span class="font-mono text-xs text-muted-foreground">${summary}</span>
    </div>
    <div class="flex flex-wrap gap-2 px-4 pt-3">
      ${computed(() =>
        codes.value.map(
          (entry) => html`<span class="rounded-md border px-2 py-1 font-mono text-xs">
            ${entry.code} · ${entry.title} × ${String(entry.count)}
          </span>`,
        ),
      )}
    </div>
    <pre
      class="overflow-x-auto px-4 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
    >${text}</pre>
  </div>`;
}

/** The button. One write path, so the page and a headless run agree. */
export function RunChecksButton(): TemplateResult {
  return html`<button
    type="button"
    data-appearance="action"
    data-role="primary"
    @click=${() => runChecks()}
  >
    Run the checker
  </button>`;
}

/**
 * The stack-neutrality table, rendered from `STACK_NEUTRAL` so the page and the
 * runner cannot disagree about which rules could possibly have fired.
 */
export function NeutralityTable(): TemplateResult {
  return html`<div class="mt-6 overflow-x-auto rounded-xl border">
    <table class="w-full text-sm">
      <thead class="bg-muted/50">
        <tr>
          <th class="px-4 py-2 text-left font-medium">code</th>
          <th class="px-4 py-2 text-left font-medium">what it measures</th>
          <th class="px-4 py-2 text-left font-medium">selector</th>
          <th class="px-4 py-2 text-left font-medium">sees non-intent markup?</th>
        </tr>
      </thead>
      <tbody class="divide-y">
        ${STACK_NEUTRAL.map(
          (row) => html`<tr>
            <td class="px-4 py-2 font-mono text-xs">${row.code}</td>
            <td class="px-4 py-2 text-muted-foreground">${codeEntry(row.code).title}</td>
            <td class="px-4 py-2 font-mono text-xs">
              ${row.selector}
              <span class="block text-muted-foreground">${row.source}</span>
            </td>
            <td class="px-4 py-2 font-medium">${row.neutral ? 'yes' : 'no'}</td>
          </tr>`,
        )}
      </tbody>
    </table>
  </div>`;
}
