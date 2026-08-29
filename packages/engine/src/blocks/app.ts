import { component, el, each, signal, computed, effect, onCleanup } from '@nisli/core';
import { metrics } from '../metrics.js';
import { css, apply, buttonStyle } from '../style.js';
import { look } from '../skin.js';
import { useWidth } from '../engine/measure.js';
import type { Content } from './types.js';

export interface NavItem {
  readonly label: string;
  readonly href: string;
}

export interface AppProps {
  brand: string;
  nav: readonly NavItem[];
  /** The current pathname; the engine marks the matching nav item. */
  location: string;
  content: Content;
}

const isActive = (href: string, location: string) =>
  href === '/' ? location === '/' : location === href || location.startsWith(href + '/');

/**
 * The shell. With room for a sidebar beside a useful content column it is a
 * sidebar; otherwise it is a top bar with a menu. The app never says which.
 */
export const App = component<AppProps>('nisli-app', (props, host) => {
  const width = useWidth(host);
  const mode = computed<'sidebar' | 'bar'>(() =>
    width.value === 0 || width.value >= metrics.layout.sidebarWidth + metrics.layout.contentMin ? 'sidebar' : 'bar',
  );
  const menuOpen = signal(false);
  const nav = computed(() => [...props.nav.value]);

  const stopHost = effect(() => apply(host, {
    display: 'flex',
    flexDirection: mode.value === 'sidebar' ? 'row' : 'column',
    minHeight: '100vh',
    boxSizing: 'border-box',
    ...look('surface', 'surface.sunken'),
  }));
  onCleanup(stopHost);
  // Navigation closes the menu.
  const stopNav = effect(() => { props.location.value; menuOpen.value = false; });
  onCleanup(stopNav);

  const link = (item: { value: NavItem }) =>
    el('a', {
      href: computed(() => item.value.href),
      'aria-current': computed(() => (isActive(item.value.href, props.location.value) ? 'page' : false)),
      style: computed(() => css({
        display: 'block',
        padding: `${metrics.space[2]}px ${metrics.space[3]}px`,
        ...look('nav.link'),
        ...(isActive(item.value.href, props.location.value) ? look('nav.link.active') : {}),
      })),
    }, computed(() => item.value.label));

  const barHeight = metrics.control.height + 2 * metrics.space[2] + 1;

  return el('div', { style: 'display:contents' }, [
    // Sidebar
    el('nav', {
      'aria-label': 'Primary',
      style: computed(() => css({
        display: mode.value === 'sidebar' ? 'flex' : 'none',
        flexDirection: 'column',
        gap: metrics.space[1],
        width: metrics.layout.sidebarWidth,
        flex: 'none',
        padding: metrics.space[4],
        boxSizing: 'border-box',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
        ...look('surface', 'bar'),
        borderBottom: 'none',
        borderRight: look('bar').borderBottom,
      })),
    }, [
      el('div', { style: computed(() => css({ padding: `0 ${metrics.space[3]}px`, marginBottom: metrics.space[4], whiteSpace: 'nowrap', ...look('brand') })) }, props.brand),
      each(nav, (n) => n.href, link),
    ]),
    // Top bar
    el('header', {
      style: computed(() => css({
        display: mode.value === 'bar' ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${metrics.space[2]}px ${metrics.space[3]}px`,
        position: 'sticky',
        top: 0,
        zIndex: 20,
        ...look('surface', 'bar'),
      })),
    }, [
      el('div', { style: computed(() => css(look('brand'))) }, props.brand),
      el('button', {
        type: 'button',
        'aria-label': 'Menu',
        'aria-expanded': computed(() => String(menuOpen.value)),
        style: computed(() => css(buttonStyle('plain'))),
        on: { click: () => { menuOpen.value = !menuOpen.value; } },
      }, computed(() => (menuOpen.value ? 'Close' : 'Menu'))),
    ]),
    // Menu sheet (narrow only)
    el('nav', {
      'aria-label': 'Primary',
      style: computed(() => css({
        display: mode.value === 'bar' && menuOpen.value ? 'flex' : 'none',
        flexDirection: 'column',
        gap: metrics.space[1],
        padding: metrics.space[3],
        position: 'sticky',
        top: barHeight,
        zIndex: 19,
        ...look('surface', 'bar'),
      })),
    }, [each(nav, (n) => n.href, link)]),
    // Content
    el('div', { style: css({ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }) }, [props.content.value as Content]),
  ]);
});
