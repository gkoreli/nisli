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
 * The dev gate (a named Wave-1 deliverable — core had NO dev/prod mechanism):
 * a runtime probe, layered for the three environments core must serve without
 * a bundler assumption (ADR 0019):
 *   1. `import.meta.env.DEV` / `.PROD` when an injector (Vite serve/build,
 *      vitest) provides them — statically replaced in Vite builds, so a prod
 *      build resolves prod even in the browser where `process` is absent.
 *   2. `globalThis.process?.env?.NODE_ENV` — Node scripts, test runners, SSG.
 *   3. Neither present (raw buildless ESM in a browser): DEV — loud by
 *      default, matching the framework's no-build posture; `setDevMode(false)`
 *      is the explicit opt-out for buildless production pages.
 * The probe runs once at module load; `setDevMode()` overrides it (tests,
 * bundler-less prod), `setDevMode(null)` restores the probed default.
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
};

// ── Dev gate ────────────────────────────────────────────────────────

function probeDevMode(): boolean {
  // 1) import.meta.env injectors (Vite, vitest). Read the OBJECT (not the
  // dotted key) so Vite's define replacement works through the optional
  // access, and a missing env is just `undefined` in Node/raw ESM.
  const env = (import.meta as ImportMeta & {
    env?: { DEV?: unknown; PROD?: unknown };
  }).env;
  if (env && typeof env.DEV === 'boolean') return env.DEV;
  if (env && typeof env.PROD === 'boolean') return !env.PROD;
  // 2) Node / test runners / bundlers that define process.env.NODE_ENV.
  const nodeEnv = (globalThis as {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.NODE_ENV;
  if (typeof nodeEnv === 'string') return nodeEnv !== 'production';
  // 3) No signal at all (raw buildless ESM): loud by default.
  return true;
}

const probed = probeDevMode();
let override: boolean | null = null;

/** Whether dev-only diagnostics are active. See the module doc for the probe. */
export function isDev(): boolean {
  return override ?? probed;
}

/**
 * Override the probed dev mode (`true`/`false`), or restore the probed
 * default (`null`). For tests and for buildless pages deployed to production.
 */
export function setDevMode(on: boolean | null): void {
  override = on;
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
