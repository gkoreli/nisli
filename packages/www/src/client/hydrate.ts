/**
 * client/hydrate.ts — the site's single client runtime. Strict progressive
 * enhancement via REPLACE-based framing (the only path that doesn't
 * double-render prerendered custom elements — WWW-14/15; the naive
 * upgrade-in-place path re-mounts on top of the SSG children).
 *
 * DERIVED, not curated (WWW-15). There is no hydrate-set allowlist: EVERY
 * preview and the docs sidebar chrome hydrate, and WHAT they load is derived
 * from the registry item / route:
 *
 *  1. Preview frames `[data-preview=<name>]` — the live mount is derived from
 *     <name> (= the registry item): its curated example module if one exists,
 *     else the component's live auto-default (register the module, mount its
 *     primary tag). So an interactive component is interactive by DERIVATION —
 *     the "curated a side-effectful example as static → inert" class (the old
 *     toast) is structurally impossible.
 *  2. Chrome `[data-hydrate="sidebar"]` — the DocsLayout sidebar re-mounts live
 *     (SidebarProvider + nav + mobile trigger), so the mobile drawer works
 *     without the WWW-13 upgrade-in-place duplication that left it unpainted.
 *
 * hydrate-frame.ts holds the failure-safe replace+mount (unit-tested) and is the
 * clean/bounded corpus for the possible @nisli/core adopt-in-place graduation
 * (ADR 0025 item 17).
 */
import { html } from '@nisli/core';
import { hydrateFrame, type ExampleLoader } from './hydrate-frame.js';
import { resolveLoader } from './loader.js';

// Component modules keyed by name — for the auto-default fallback (register on
// load). Recursive: domain sets (ui/acp/*) live in subfolders, and the item
// name maps to the file's basename, not its path.
const componentGlob = import.meta.glob('../nisli-ui/ui/**/*.js');
const components = Object.fromEntries(
  Object.entries(componentGlob).map(([path, load]) => [
    path.split('/').pop()!.replace(/\.js$/, ''),
    load,
  ]),
);

// The curated compositions live in the examples registry (examples.ts). Load it
// as ONE code-split chunk (per /ui page) and mount getExample(<name>) — this
// preserves the SSG-identical curated content while staying fully name-DERIVED,
// no allowlist (WWW-15 option 2; WWW-16 splits examples into per-component
// modules and this monolith import self-destructs).
const loadExamples = () => import('../examples.js');

/**
 * The loader for a preview frame, DERIVED from its name — the production wiring
 * of the injectable {@link resolveLoader} seam: the examples chunk + the
 * component-module glob. Loading examples.js also registers every component the
 * examples compose, so the curated mount is live.
 */
function loaderFor(name: string): ExampleLoader {
  return resolveLoader(name, {
    loadExamples,
    registerComponent: (n) => components[n]?.(),
  });
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const frame = entry.target;
      observer.unobserve(frame);
      const name = frame.getAttribute('data-preview');
      if (!name) continue;
      void hydrateFrame(frame, loaderFor(name)).then(() => {
        // Load failed (baseline intact, lock cleared): re-observe so a later
        // delivery — e.g. after a redeploy — retries when it next scrolls in.
        if (!frame.hasAttribute('data-hydrated')) observer.observe(frame);
      });
    }
  },
  { rootMargin: '128px' },
);

for (const frame of document.querySelectorAll('[data-preview]')) observer.observe(frame);

// WWW-15 (B): the mobile docs drawer is a www-local chrome unit — replace-mount
// it live (registry Sheet + nav-model links). NOT the registry Sidebar's mobile
// branch (upgrading that over prerendered DOM double-renders — the empty-drawer
// P0); desktop keeps the registry Sidebar as static anchors. Replace-based, so
// no ui-sidebar-* family is registered on docs pages.
const mobileNavLoader: ExampleLoader = async () => {
  const { MobileNav } = await import('../layout/mobile-nav.js');
  return { default: () => MobileNav(location.pathname) };
};
for (const chrome of document.querySelectorAll('[data-hydrate="mobile-nav"]')) {
  void hydrateFrame(chrome, mobileNavLoader);
}

// The /docs/view-transitions each() recipe demo — a www-local island, same
// replace-mount contract: SSG paints the list in its default order and this
// brings the sort/filter controls (and their viewTransition() calls) alive.
// Dynamic import for the same reason as every loader in this file: the demo is
// its own chunk, fetched only on the one page that carries the frame.
const listTransitionLoader: ExampleLoader = async () => {
  const { ListTransitionDemo } = await import('../components/list-transition-demo.js');
  return { default: ListTransitionDemo };
};
for (const frame of document.querySelectorAll('[data-hydrate="list-transition"]')) {
  void hydrateFrame(frame, listTransitionLoader);
}

// The @nisli/intent surfaces — same replace-mount contract, one frame per
// island. The SSG paints intent's DECLARED tiers (custom properties and
// container queries, tier 1; the browser's own flex/grid/clamp solvers, tier 2),
// which is a correct page with JS off; this brings the MEASURED tier alive —
// `fit()`'s resize observer and its bounded degradation pass over the declared
// priority list. Until it runs, a container too small for its content shows the
// flash of unfit, which is the honest cost of having no SSG pre-solve and is
// what scripts/intent-ssg-proof.mjs measures.
//
// The surface id travels on the frame, so this stays name-DERIVED with no
// allowlist here: the pages own which islands exist, and an id this build does
// not know THROWS, which leaves hydrateFrame's static baseline standing and
// warns rather than replacing real content with an empty frame.
// Dynamic import for the same reason as every loader in this file — the islands
// are their own chunk, fetched only on the pages that carry a frame — and
// island.js is deliberately NOT re-exported from src/intent/index.ts, so the
// router's lazy page import never evaluates `component()` during the static
// build (ADR 0026 §8).
const intentLoader = (frame: Element): ExampleLoader => async () => {
  const { intentSurface } = await import('../intent/island.js');
  return { default: () => intentSurface(frame.getAttribute('data-intent')) };
};
for (const frame of document.querySelectorAll('[data-hydrate="intent"]')) {
  void hydrateFrame(frame, intentLoader(frame));
}
