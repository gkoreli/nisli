/**
 * esbuild-hmr/runtime.ts — Browser dev client for Nisli HMR.
 *
 * DEV-ONLY. Reachable only via the `@nisli/core/esbuild-hmr/runtime` subpath,
 * which the esbuild plugin injects on the `--watch` path. It is NEVER imported
 * by the `@nisli/core` runtime `.` entry, so it contributes zero production
 * bytes (ADR 0021, Ruling 1 & 5).
 *
 * Responsibilities (ADR 0021):
 *  - A tag -> setup registry with a STABLE indirection thunk (Ruling 2).
 *  - remount() of live elements through the existing custom-element lifecycle:
 *    disconnectedCallback() -> replaceChildren() -> connectedCallback() (Ruling 3).
 *  - An EventSource client that classifies an esbuild `change` payload and
 *    escalates: CSS hot-swap -> component re-mount -> full reload (Ruling 4).
 *
 * The class is NEVER swapped and the tag is NEVER re-defined; we swap only the
 * `setup` behind the registry, working *with* the `customElements.get` guard in
 * component.ts rather than against it.
 */

// ── Types ───────────────────────────────────────────────────────────

/** The author's setup function, kept opaque here (props proxy, host). */
export type HmrSetup = (props: unknown, host: HTMLElement) => unknown;

/** esbuild's `change` event payload shape (added/removed/updated paths). */
export interface EsbuildChangePayload {
  added: string[];
  removed: string[];
  updated: string[];
}

/** What to do with a change, decided from the output diff (Ruling 4). */
export type HmrAction = 'css' | 'js' | 'reload';

/** Minimal structural EventSource (avoids depending on DOM lib EventSource). */
interface EventSourceLike {
  addEventListener(type: string, listener: (ev: { data?: string }) => void): void;
  close?(): void;
}

/** Options for {@link connect}. Seams kept injectable for tests. */
export interface ConnectOptions {
  /** SSE endpoint. Defaults to esbuild's `/esbuild`. */
  path?: string;
  /**
   * Factory for the EventSource. Defaults to the global `EventSource`.
   * Injectable so the client logic is testable without a live SSE server.
   */
  eventSourceFactory?: (url: string) => EventSourceLike;
  /**
   * Re-import the rebuilt JS so the wrapper re-runs `__register` for changed
   * tags. Defaults to a cache-busted dynamic import of the page's module
   * scripts. Returns a promise resolving when re-evaluation is done.
   */
  reimport?: () => Promise<void>;
  /** Force a full reload. Defaults to `location.reload()`. */
  reload?: () => void;
}

// ── Tag -> setup registry (Ruling 2) ────────────────────────────────

const registry = new Map<string, HmrSetup>();

/** Tags whose setup changed since the last drain — pending a re-mount. */
const pendingRemounts = new Set<string>();
let remountScheduled = false;
/**
 * When true, `__register` accumulates pending tags but does NOT auto-schedule a
 * microtask drain — `applyChange` owns the drain so it can wait for a full
 * module re-eval to register ALL changed tags first.
 */
let suppressAutoDrain = false;

/**
 * Register (or update) the setup for a tag and return a STABLE indirection
 * thunk that always reads the *current* setup from the registry.
 *
 * On the first registration for a tag (initial page load) no re-mount is
 * scheduled. On a subsequent registration with a *different* setup reference
 * (a watch rebuild re-evaluating the module) the tag is queued for re-mount.
 *
 * The returned thunk is what `component()` hands to the real
 * `FrameworkComponent`; because it reads `registry.get(tag)` lazily, the live
 * element picks up new setup without any class swap or tag re-definition.
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

interface CustomElementLike extends HTMLElement {
  connectedCallback?: () => void;
  disconnectedCallback?: () => void;
}

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

// ── Change classification + escalation (Ruling 4) ───────────────────

const CSS_RE = /\.css($|\?)/;

/**
 * Decide the action for an esbuild output diff:
 *  - every changed output is CSS  -> 'css'   (hot-swap, preserves everything)
 *  - any JS output changed        -> 'js'    (re-import; re-mount changed tags
 *                                             or escalate to reload if none)
 *  - nothing actionable           -> 'reload'
 */
export function classifyChange(payload: EsbuildChangePayload): HmrAction {
  const touched = [...payload.added, ...payload.removed, ...payload.updated];
  if (touched.length === 0) return 'reload';
  if (touched.every((p) => CSS_RE.test(p))) return 'css';
  if (touched.some((p) => /\.[mc]?js($|\?)/.test(p))) return 'js';
  return 'reload';
}

/**
 * Hot-swap stylesheets in place by re-pointing matching `<link>` hrefs with a
 * cache-busting query — no reload, no state loss (esbuild's documented CSS
 * technique). Returns the number of links swapped.
 */
export function hotSwapCss(updated: string[]): number {
  let swapped = 0;
  const links = document.querySelectorAll('link[rel="stylesheet"]');
  links.forEach((node) => {
    const link = node as HTMLLinkElement;
    const href = link.getAttribute('href');
    if (!href) return;
    const base = href.split('?')[0] ?? href;
    const matches = updated.some((u) => {
      const uBase = (u.split('?')[0] ?? u).replace(/^\.?\//, '');
      return uBase.endsWith(base.replace(/^\.?\//, ''));
    });
    if (matches) {
      link.setAttribute('href', `${base}?t=${Date.now()}`);
      swapped++;
    }
  });
  return swapped;
}

// ── EventSource client (transport) ──────────────────────────────────

let connected: EventSourceLike | null = null;

/**
 * Connect to the SSE change channel and apply updates with escalation.
 * Safe to call once from the dev client; injected by the plugin in watch builds.
 */
export function connect(options: ConnectOptions = {}): EventSourceLike {
  // Idempotency guard (critical for the bundled re-import model). The plugin
  // injects `connect()` at the entry's top level, and a JS update re-evaluates
  // the entry (so `__register` re-runs for changed tags). That re-eval also
  // re-runs this `connect()` call. Because `connected` lives in the persistent
  // HMR runtime chunk (re-imported entries reuse it by name, un-busted), the
  // guard survives across re-imports and keeps EXACTLY ONE EventSource + change
  // listener alive — otherwise listeners stack and each edit fans out into N
  // compounding re-imports.
  if (connected) return connected;

  const path = options.path ?? '/esbuild';
  const reload = options.reload ?? (() => location.reload());
  const reimport = options.reimport ?? defaultReimport;
  const factory =
    options.eventSourceFactory ??
    ((url: string) => new (globalThis as { EventSource: new (u: string) => EventSourceLike }).EventSource(url));

  const source = factory(path);
  connected = source;
  source.addEventListener('change', (ev) => {
    let payload: EsbuildChangePayload;
    try {
      payload = ev.data ? (JSON.parse(ev.data) as EsbuildChangePayload) : { added: [], removed: [], updated: [] };
    } catch {
      reload();
      return;
    }
    void applyChange(payload, { reimport, reload });
  });
  return source;
}

/** Close the active SSE connection (test/teardown). */
export function disconnect(): void {
  connected?.close?.();
  connected = null;
}

/**
 * Apply a classified change. Exposed for tests so the escalation ladder is
 * verifiable without a live EventSource.
 *
 * For a JS change we re-import (re-runs the wrapper's `__register` calls); if no
 * tag's setup actually changed, the edit was a non-component module (util/
 * service) and we escalate to a full reload — the correct, safe fallback.
 */
export async function applyChange(
  payload: EsbuildChangePayload,
  deps: { reimport: () => Promise<void>; reload: () => void },
): Promise<HmrAction> {
  const action = classifyChange(payload);
  if (action === 'css') {
    hotSwapCss(payload.updated);
    return 'css';
  }
  if (action === 'js') {
    // Own the drain: suppress the auto microtask so ALL changed tags register
    // during re-import before any re-mount runs.
    suppressAutoDrain = true;
    remountScheduled = false;
    try {
      await deps.reimport();
    } finally {
      suppressAutoDrain = false;
    }
    if (pendingRemountCount() > 0) {
      drainRemounts();
      return 'js';
    }
    // JS changed but no component setup changed -> non-component edit -> reload.
    deps.reload();
    return 'reload';
  }
  deps.reload();
  return 'reload';
}

/**
 * Default re-import: re-fetch every module `<script type="module">` with a
 * cache-busting query so the bundle re-evaluates and the wrapper re-runs
 * `__register` for changed tags.
 */
async function defaultReimport(): Promise<void> {
  const scripts = document.querySelectorAll('script[type="module"][src]');
  const imports: Promise<unknown>[] = [];
  scripts.forEach((node) => {
    const src = (node as HTMLScriptElement).getAttribute('src');
    if (src) imports.push(import(/* @vite-ignore */ `${src.split('?')[0]}?t=${Date.now()}`));
  });
  await Promise.all(imports);
}
