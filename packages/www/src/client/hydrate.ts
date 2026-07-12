/**
 * client/hydrate.ts — WWW-10 preview hydration bootstrap (the site's only client
 * bundle). Strict progressive enhancement: the SSG static preview frame is the
 * baseline; this upgrades it to a LIVE nisli component when it scrolls into view.
 * Scope is the [data-preview] frame on /ui pages and nothing else.
 *
 * import.meta.glob gives Vite an auto-generated, per-file lazy map — so each
 * component's example is its own code-split chunk, loaded only when needed. The
 * failure-safe mount itself lives in hydrate-frame.ts (unit-tested).
 */
import { hydrateFrame, type ExampleLoader } from './hydrate-frame.js';

const examples = import.meta.glob('../hydrate-examples/*.ts');

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const frame = entry.target;
      observer.unobserve(frame);
      const name = frame.getAttribute('data-preview');
      const load = name ? examples[`../hydrate-examples/${name}.ts`] : undefined;
      if (!load) continue; // no interactive example — leave the static frame
      void hydrateFrame(frame, load as ExampleLoader).then(() => {
        // Load failed (baseline intact, lock cleared): re-observe so a later
        // delivery — e.g. after a redeploy — retries when it next scrolls in.
        if (!frame.hasAttribute('data-hydrated')) observer.observe(frame);
      });
    }
  },
  { rootMargin: '128px' },
);

for (const frame of document.querySelectorAll('[data-preview]')) observer.observe(frame);
