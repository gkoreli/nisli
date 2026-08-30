import { el, each, signal, computed, effect, onCleanup } from '@nisli/core';
import { buttonBox } from '../style.js';
import { shellMode } from '../engine/space.js';
import { block } from './kernel.js';
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
export const App = block<AppProps>('nisli-app', {
  measure: 'width',
  host: (ctx) => ({
    display: 'flex',
    flexDirection: shellMode(ctx.width.value, ctx.metrics.layout) === 'sidebar' ? 'row' : 'column',
    minHeight: '100vh',
    boxSizing: 'border-box',
  }),
  hostParts: ['surface', 'surface.sunken'],
  render: (props, ctx) => {
    const { metrics } = ctx;
    const mode = computed(() => shellMode(ctx.width.value, metrics.layout));
    const menuOpen = signal(false);
    const nav = computed(() => [...props.nav.value]);

    // Navigation closes the menu.
    const stopNav = effect(() => { props.location.value; menuOpen.value = false; });
    onCleanup(stopNav);

    const link = (item: { value: NavItem }) =>
      el('a', {
        href: computed(() => item.value.href),
        'aria-current': computed(() => (isActive(item.value.href, props.location.value) ? 'page' : false)),
        style: ctx.part(
          () => (isActive(item.value.href, props.location.value) ? ['nav.link', 'nav.link.active'] : 'nav.link'),
          { display: 'block', padding: `${metrics.space[2]}px ${metrics.space[3]}px` },
        ),
      }, computed(() => item.value.label));

    const barHeight = metrics.control.height + 2 * metrics.space[2] + 1;

    return [
      // Sidebar
      el('nav', {
        'aria-label': 'Primary',
        style: ctx.part(['surface', 'bar', 'nav.side'], () => ({
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
        })),
      }, [
        el('div', { style: ctx.part('brand', { padding: `0 ${metrics.space[3]}px`, marginBottom: metrics.space[4], whiteSpace: 'nowrap' }) }, props.brand),
        each(nav, (n) => n.href, link),
      ]),
      // Top bar
      el('header', {
        style: ctx.part(['surface', 'bar'], () => ({
          display: mode.value === 'bar' ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${metrics.space[2]}px ${metrics.space[3]}px`,
          position: 'sticky',
          top: 0,
          zIndex: metrics.layer.bar,
        })),
      }, [
        el('div', { style: ctx.part('brand') }, props.brand),
        el('button', {
          type: 'button',
          'aria-label': 'Menu',
          'aria-expanded': computed(() => String(menuOpen.value)),
          style: ctx.part(['button', 'button.plain'], buttonBox()),
          on: { click: () => { menuOpen.value = !menuOpen.value; } },
        }, computed(() => (menuOpen.value ? 'Close' : 'Menu'))),
      ]),
      // Menu sheet (narrow only)
      el('nav', {
        'aria-label': 'Primary',
        style: ctx.part(['surface', 'bar'], () => ({
          display: mode.value === 'bar' && menuOpen.value ? 'flex' : 'none',
          flexDirection: 'column',
          gap: metrics.space[1],
          padding: metrics.space[3],
          position: 'sticky',
          top: barHeight,
          zIndex: metrics.layer.bar - 1,
        })),
      }, [each(nav, (n) => n.href, link)]),
      // Content
      el('div', { style: ctx.part([], { flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }) }, [props.content.value as Content]),
    ];
  },
});
