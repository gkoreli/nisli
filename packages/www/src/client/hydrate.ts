/**
 * client/hydrate.ts — the site's single client bundle. Strict progressive
 * enhancement. It does two things on the DocsLayout pages that inject it:
 *
 *  1. WWW-13 chrome: registers the DocsLayout sidebar family so its custom
 *     elements (ui-sidebar-provider/…/ui-sidebar-trigger + the mobile Sheet)
 *     UPGRADE the SSG-rendered markup in place — that is what makes the mobile
 *     off-canvas drawer open (the portaled Sheet is client-only, ADR 0025
 *     item-6). Desktop needs no JS (real anchors + a fixed frame); this is the
 *     mobile drawer + the theme toggle's peer.
 *  2. WWW-10 previews: upgrades each [data-preview] frame to a LIVE component
 *     when it scrolls into view. import.meta.glob gives Vite a per-file lazy
 *     map, so each example is its own code-split chunk. The failure-safe mount
 *     lives in hydrate-frame.ts (unit-tested). A page with no interactive
 *     preview (e.g. /docs) simply finds no frames — a safe no-op.
 */
import '../nisli-ui/ui/sidebar.js'; // WWW-13: upgrade the sidebar chrome (mobile drawer)
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
