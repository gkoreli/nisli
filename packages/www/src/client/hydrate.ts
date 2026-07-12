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
import { component, html, onMount, ref } from '@nisli/core';
import { hydrateFrame, type ExampleLoader } from './hydrate-frame.js';
import { primaryTag } from '../preview-tags.js';

// Component modules keyed by name — for the auto-default fallback (register on load).
const components = import.meta.glob('../nisli-ui/ui/*.js');

// The curated compositions live in the examples registry (examples.ts). Load it
// as ONE code-split chunk (per /ui page) and mount getExample(<name>) — this
// preserves the SSG-identical curated content while staying fully name-DERIVED,
// no allowlist (WWW-15 option 2; WWW-16 splits examples into per-component
// modules and this monolith import self-destructs).
const loadExamples = () => import('../examples.js');

// Client auto-default: register the component (so its <ui-*> upgrades) and mount
// its primary tag live. A DISTINCT tag from the SSG `www-auto-preview` so that
// defining it never upgrades the prerendered fallback in place.
const AutoHydrate = component<{ tag: string }>('www-auto-hydrate', (props) => {
  const host = ref<HTMLDivElement>();
  onMount(() => {
    if (host.current) host.current.appendChild(document.createElement(props.tag.value));
  });
  return html`<div ref="${host}"></div>`;
});

/**
 * The loader for a preview frame, DERIVED from its name: the curated example if
 * the registry has one (getExample), else the component's live auto-default
 * (import the module by name → register → mount the primary tag). Loading
 * examples.js also registers every component the examples compose, so the
 * curated mount is live.
 */
function loaderFor(name: string): ExampleLoader {
  return async () => {
    const { getExample } = await loadExamples();
    const example = getExample(name);
    if (example) return { default: example };
    await components[`../nisli-ui/ui/${name}.js`]?.(); // no curated example → auto-default (derived)
    return { default: () => AutoHydrate({ tag: primaryTag(name) }) };
  };
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
