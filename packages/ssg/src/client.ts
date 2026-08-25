/**
 * `@nisli/ssg/client` — the browser-side half of the SSG feature set.
 *
 * Deliberately dependency-free and side-effect-free: no `node:*`, no happy-dom,
 * no DOM globals touched at module scope. Importing this from a client bundle
 * must not pull in any build-only code, and importing it from a Worker or a
 * Node build script must not throw.
 */

// `Document.prerendering` and the `prerenderingchange` event are not in the
// TypeScript DOM lib yet, and this module must not assume a DOM exists at all.
interface PrerenderingDocument {
  prerendering?: boolean;
  addEventListener?: (
    type: 'prerenderingchange',
    listener: () => void,
    options?: { once?: boolean },
  ) => void;
}

/**
 * Runs `fn` once the document is actually being presented to the user.
 *
 * Speculation-rules prerendering executes a page fully in a hidden document, so
 * DOM wiring (listeners, component upgrades) may run eagerly, but anything
 * *observable* — analytics, timers, autofocus, media playback — has to wait for
 * activation. That is what this guard is for.
 *
 * Degradation is the no-op direction: without `document.prerendering` (every
 * non-Chromium engine) and without a document at all, `fn` runs immediately.
 */
export function whenActive(fn: () => void): void {
  // Read through a widened global rather than the DOM lib's `document`: this
  // module has to compile without DOM types and run where none exists.
  const globalObject = globalThis as { document?: PrerenderingDocument };
  const document = globalObject.document;
  if (!document?.prerendering || !document.addEventListener) {
    fn();
    return;
  }
  document.addEventListener('prerenderingchange', () => { fn(); }, { once: true });
}
