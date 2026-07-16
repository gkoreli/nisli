/**
 * hmr/registry.ts — Transport-agnostic HMR core for Nisli (ADR 0021, ADR 0110).
 *
 * The tag→setup registry, the stable indirection thunk, and the in-place
 * re-mount through the custom-element lifecycle. This is the part that is
 * IDENTICAL regardless of how change notifications arrive — change
 * (`../esbuild-hmr/*`) or Vite `import.meta.hot` (`../vite-hmr/*`) both drive
 * the same registry. Keeping it here means one implementation, one set of
 * correctness guarantees (ADR 0008.1 disposal), and no duplication.
 *
 * DEV-ONLY: reachable only via the dev subpaths, never from the `@nisli/core`
 * `.` entry, so it contributes zero production bytes.
 */

// ── Types ───────────────────────────────────────────────────────────

/** The author's setup function, kept opaque here (props proxy, host). */
export type HmrSetup = (props: unknown, host: HTMLElement) => unknown;

interface CustomElementLike extends HTMLElement {
  connectedCallback?: () => void;
  disconnectedCallback?: () => void;
  _remount?: () => void;
}

// ── Tag → setup registry (Ruling 2) ─────────────────────────────────

const registry = new Map<string, HmrSetup>();

/** Tags whose setup changed since the last drain — pending a re-mount. */
const pendingRemounts = new Set<string>();
let remountScheduled = false;

/**
 * When true, `__register` accumulates pending tags but does NOT auto-schedule a
 * microtask drain — the caller owns the drain so it can wait for a full module
 * re-eval to register ALL changed tags first.
 * The Vite path leaves this false and drains explicitly from its accept hook.
 */
let suppressAutoDrain = false;

/**
 * Begin a caller-owned drain window: suppress auto-scheduling AND cancel any
 * pending microtask drain, so the caller can re-evaluate a whole bundle and
 * register ALL changed tags before a single explicit `drainRemounts()`. Used by
 * the Vite path drains per-module.
 */
export function beginManualDrain(): void {
  suppressAutoDrain = true;
  remountScheduled = false;
}

/** End a caller-owned drain window (re-enable auto-scheduling). */
export function endManualDrain(): void {
  suppressAutoDrain = false;
}

/**
 * Register (or update) the setup for a tag and return a STABLE indirection
 * thunk that always reads the *current* setup from the registry.
 *
 * First registration for a tag (initial load) schedules no re-mount. A
 * subsequent registration with a *different* setup reference (a rebuild
 * re-evaluating the module) queues the tag for re-mount.
 *
 * The returned thunk is what `component()` hands to the real
 * `FrameworkComponent`; because it reads `registry.get(tag)` lazily, the live
 * element picks up new setup with no class swap or tag re-definition.
 */
export function __register(tag: string, setup: HmrSetup): HmrSetup {
  const prev = registry.get(tag);
  registry.set(tag, setup);
  if (prev !== undefined && prev !== setup) {
    pendingRemounts.add(tag);
    if (!suppressAutoDrain) scheduleRemount();
  }
  return (props: unknown, host: HTMLElement) => {
    const current = registry.get(tag);
    if (!current) throw new Error(`[nisli-hmr] no setup registered for <${tag}>`);
    return current(props, host);
  };
}

/** Number of tags awaiting a re-mount (for orchestration/tests). */
export function pendingRemountCount(): number {
  return pendingRemounts.size;
}

/** Drain and re-mount every pending tag. Returns the tags that were remounted. */
export function drainRemounts(): string[] {
  const tags = [...pendingRemounts];
  pendingRemounts.clear();
  remountScheduled = false;
  for (const tag of tags) remount(tag);
  return tags;
}

function scheduleRemount(): void {
  if (remountScheduled) return;
  remountScheduled = true;
  // Defer so a full module re-eval can register *all* changed tags first.
  queueMicrotask(() => {
    if (remountScheduled) drainRemounts();
  });
}

// ── Re-mount through the existing lifecycle (Ruling 3) ──────────────

/**
 * Re-mount every live element of `tag` in place, on the SAME instance:
 *
 *   disconnectedCallback()  — resets `_mounted`, disposes effects + template
 *                             (the ADR 0008.1 disposal contract)
 *   replaceChildren()       — clears old DOM, firing nested custom elements'
 *                             disconnectedCallback so their disposers run too
 *   connectedCallback()     — re-runs the NEW setup (via the registry thunk)
 *                             inside the same `untrack(...)` mount path
 *
 * Props survive because `_propsProxy` is constructor-owned (component.ts), and
 * the element node identity is preserved — siblings, scroll, route, and global
 * stores are untouched.
 */
export function remount(tag: string): void {
  const elements = document.querySelectorAll(tag);
  elements.forEach((node) => {
    const el = node as CustomElementLike;
    if (el._remount) {
      el._remount();
      return;
    }
    // Dispose first: must run BEFORE clearing DOM or effects/subscriptions
    // leak across reloads (ADR 0008.1 hazard).
    el.disconnectedCallback?.();
    // Clear old DOM — removal fires nested children's disconnectedCallback.
    el.replaceChildren();
    // Re-run setup + re-mount on the same instance.
    el.connectedCallback?.();
  });
}

/** Test-only: clear the registry and pending state between cases. */
export function __resetRegistry(): void {
  registry.clear();
  pendingRemounts.clear();
  remountScheduled = false;
  suppressAutoDrain = false;
}
