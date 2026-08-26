/**
 * layout/nav-model.ts — the site's single source of navigation truth.
 *
 * The docs sidebar groups are DERIVED, never hand-maintained (ADR 0024 WWW-12
 * amendment, ADR 0026 spirit): doc sections come from the docs catalog
 * (`pages/docs.ts`), the Components and Primitives groups from the registry
 * (`registry.ts`) — the same sources the router expands its routes from. Adding
 * a registry item or a docs page yields its nav entry with zero edits here; a
 * nav entry whose href has no route (or vice versa) is a coverage-test failure.
 *
 * `buildNav(current)` is the one builder both consumers call: SidebarNav (this
 * package's layout) renders it, and the router passes the active path so
 * `active` is computed in one place.
 */
import { DOC_SECTIONS, docPath } from '../pages/docs.js';
import { components, primitives, itemPath } from '../registry.js';

export interface NavItem {
  label: string;
  href: string;
  active: boolean;
}

export interface NavGroup {
  title: string;
  items: readonly NavItem[];
}

export interface NavModel {
  groups: readonly NavGroup[];
}

/**
 * The @nisli/intent surfaces — the one catalog `app-router.ts` expands its
 * `/intent*` routes from and this file derives their nav entries from.
 *
 * It lives here, beside the other nav sources, for the reason the module doc
 * gives: a page nobody can navigate to is a page nobody sees, and the way that
 * happens is a route table and a nav table drifting apart. The docs catalog and
 * the registry already work this way; this is the third source, not a special
 * case. It also has to be DOM-FREE (ADR 0026 §8) because `app-router.ts`
 * imports it eagerly — hence label/href/description only, with the templates
 * behind the router's lazy `import('./intent/index.js')`.
 *
 * `chrome` is what decides sidebar membership, and it is honoured in exactly two
 * places: the route's own render (which wraps `'docs'` surfaces in DocsLayout)
 * and `sidebarLeaves` below. `nav-coverage.test.ts` asserts the two agree
 * against the REAL emitted HTML, so a surface declared `'docs'` here and
 * rendered without the sidebar fails rather than shipping unreachable.
 *
 * `href` values are literal types on purpose: `route()` infers its path params
 * from the literal, so widening these to `string` would erase that inference.
 */
export const INTENT_SURFACES = [
  {
    label: 'Derived appearance',
    href: '/intent',
    title: 'Derived appearance — nisli',
    description:
      'Appearance derived from declared meaning: a component says what a thing is, and one inherited unit plus container queries derive every pixel, colour and radius. No breakpoints, no class names, no values in component source.',
    // Marketing-shaped, like /themes: full width, no sidebar, top-bar entry.
    chrome: 'shell',
  },
  {
    label: 'Playground',
    href: '/intent/playground',
    title: 'Playground — derived appearance — nisli',
    description:
      'Resize a container and watch @nisli/intent degrade the least important thing until the content fits — a measured pass over a declared priority list, not a constraint solver. Density, input mode and theme are context axes you can switch live.',
    chrome: 'docs',
  },
  {
    label: 'What it costs',
    href: '/intent/comparison',
    title: 'What it costs — derived appearance — nisli',
    description:
      'The same surface built twice — declared meaning versus hand-written utilities — plus the honest limits: the flash of unfit before hydration, the deferred clipping case, and Chromium-only testing.',
    chrome: 'docs',
  },
] as const;

/** The intent surfaces that render the docs sidebar, and so belong IN it. */
const intentLeaves = INTENT_SURFACES.filter((surface) => surface.chrome === 'docs');

/** The ordered nav sources, before active-state resolution: framework doc
 * sections first (catalog order), then the derived-appearance surfaces, then
 * registry Components and Primitives. */
const NAV_SOURCES: ReadonlyArray<{ title: string; links: ReadonlyArray<{ label: string; href: string }> }> = [
  ...DOC_SECTIONS.map((section) => ({
    title: section.title,
    links: section.pages.map((page) => ({ label: page.title, href: docPath(page.slug) })),
  })),
  {
    title: 'Derived appearance',
    links: intentLeaves.map((surface) => ({ label: surface.label, href: surface.href })),
  },
  {
    title: 'Components',
    links: components.map((item) => ({ label: item.name, href: itemPath(item.name) })),
  },
  {
    title: 'Primitives',
    links: primitives.map((item) => ({ label: item.name, href: itemPath(item.name) })),
  },
];

/**
 * Build the nav model with `active` resolved against `current` (exact-path
 * match — the docs nav highlights one leaf at a time). Pass the router's
 * current path; omit for a static (all-inactive) model.
 */
export function buildNav(current?: string): NavModel {
  return {
    groups: NAV_SOURCES.map((source) => ({
      title: source.title,
      items: source.links.map((link) => ({
        label: link.label,
        href: link.href,
        active: current != null && current === link.href,
      })),
    })),
  };
}

/** Every href reachable from the nav — the coverage-test surface. */
export const navHrefs: readonly string[] = NAV_SOURCES.flatMap((source) =>
  source.links.map((link) => link.href),
);
