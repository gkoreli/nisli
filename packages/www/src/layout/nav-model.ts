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

/** The ordered nav sources, before active-state resolution: framework doc
 * sections first (catalog order), then registry Components and Primitives. */
const NAV_SOURCES: ReadonlyArray<{ title: string; links: ReadonlyArray<{ label: string; href: string }> }> = [
  ...DOC_SECTIONS.map((section) => ({
    title: section.title,
    links: section.pages.map((page) => ({ label: page.title, href: docPath(page.slug) })),
  })),
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
