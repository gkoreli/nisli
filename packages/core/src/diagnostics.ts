/**
 * diagnostics.ts — coded diagnostics leaf + the dev-mode gate (ADR 0030.2, Wave 1)
 *
 * The shared foundation every core layer reports through. Two rules keep it a
 * LEAF (ADR 0030.2 §7): zero imports from other core modules (so signal.ts,
 * template.ts, component.ts, injector.ts can all use it without cycles), and
 * codes + a minimal payload emitter only — no docs prose.
 *
 * Contract:
 * - Every diagnostic carries a stable machine code `N<range><nn>` and renders
 *   as ONE console.error line: `[nisli CODE] message` (+ structured detail as
 *   the second console argument when given). Thrown coded errors reuse the
 *   same `[nisli CODE]` prefix via {@link formatDiag} so `grep '\[nisli '`
 *   finds every framework-reported failure, logged or thrown.
 * - `diag()` itself is NOT dev-gated: gating is the CALL SITE's policy. Some
 *   diagnostics are production facts (T6 containment N401/N402 — parity with
 *   the pre-T6 unconditional console.error); others are dev-only attribution
 *   (N201/N202/N501) and their callers guard with {@link isDev}.
 *
 * Availability belongs to the artifact (ADR 0048). Bundler ESM leaves standard
 * NODE_ENV guards at each optional work site; the native browser artifacts
 * resolve them at publication. No process global is needed in either browser
 * artifact. The runtime override controls available diagnostics only: it cannot
 * resurrect instrumentation removed from a production artifact.
 */

// ── Code registry ───────────────────────────────────────────────────
//
// The minimal central code table (0030.1 B2, landed as part of T6 per §8).
// `Nxyz` = concrete code; `Nxxx` range keys document ownership so parallel
// waves allocate without collision. Ranges owned by other Wave-1 worktrees
// (template, reactivity, async) are seeded here as placeholders only — their
// concrete codes land with their waves.
export const codes: Record<string, string> = {
  // Range placeholders — owner module in parentheses.
  N1xx: 'template: parse/static-audit diagnostics (template.ts — template wave)',
  N2xx: 'define/props: registration and prop-contract diagnostics (component.ts)',
  N3xx: 'reactivity: scheduler/purity diagnostics (signal.ts — scheduler wave)',
  N4xx: 'lifecycle: setup/mount containment (component.ts, lifecycle.ts)',
  N5xx: 'dependency injection (injector.ts)',
  N6xx: 'async: query/resource/settle diagnostics (query.ts, resource.ts — async wave)',
  // Assigned codes.
  N201: 'duplicate component definition — tag already defined; first definition stays live',
  N202: 'unknown-prop echo — prop written after mount but never read by setup()',
  N401: 'setup failed — scope contained, host stamped data-nisli-error="N401"',
  N402: 'onMount failed — scope contained, host stamped data-nisli-error="N402"',
  N501: 'provide() after the token was already instantiated — resetInjector() first',
  N101: 'template audit — dash-tag never defined (misspelled or unimported component?)',
  N102: 'template audit — unknown @event name',
  N103: 'template audit — unknown event modifier',
  N104: 'template audit — undeclared attribute on a component with declared attrs',
  N105: 'template — remounting a live bound TemplateResult (shared-binding corruption)',
  N106: 'template — html:inner requires a branded value: raw(), sanitized(), or TrustedHTML',
  N107: 'template — html:inner sanitized() has no sink: no native Element.setHTML() and no setSanitizerFallback() hook',
  N301: 'reactivity — effect exceeded the consecutive re-schedule cap (loop); disposed',
  N302: 'reactivity — effect wrote a signal in its own dependency set (attribution)',
  N303: 'reactivity — flush()/tick() iteration cap reached before quiescence',
  N310: 'reactivity — effect callback returned a Promise; use resource() for async',
  N602: 'query — invalid key element (flat primitives only; null is the optional sentinel)',
  N603: 'settle() — no quiescence within the iteration cap; returning anyway',
  // N601 (mixed QueryClients) was retired before release: N501 makes that
  // state unrepresentable at its cause. The number is not reused.
};

// ── Dev gate ────────────────────────────────────────────────────────

let override: boolean | null = null;

/** Runtime preference within this artifact's development capability. */
export function isDev(): boolean {
  return process.env.NODE_ENV !== 'production' && (override ?? true);
}

/**
 * Enable/suppress available development diagnostics, or restore the artifact's
 * default (`null`). A production artifact cannot re-enable removed diagnostics.
 */
export function setDevMode(on: boolean | null): void {
  if (process.env.NODE_ENV !== 'production') override = on;
}

// ── Emission ────────────────────────────────────────────────────────

/** The shared `[nisli CODE] message` line, for both logged and thrown paths. */
export function formatDiag(code: string, message: string): string {
  return `[nisli ${code}] ${message}`;
}

/**
 * Emit one coded diagnostic: a single console.error line
 * `[nisli CODE] message`, with `detail` attached as structured payload.
 * NOT dev-gated here — the caller owns the policy (see module doc).
 */
export function diag(code: string, message: string, detail?: Record<string, unknown>): void {
  if (detail === undefined) {
    console.error(formatDiag(code, message));
  } else {
    console.error(formatDiag(code, message), detail);
  }
}
