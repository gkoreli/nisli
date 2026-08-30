import { el, each, signal, computed, effect, onCleanup, ref } from '@nisli/core';
import { buttonBox } from '../style.js';
import { shellMode } from '../engine/space.js';
import { block, focusables } from './kernel.js';
import { toList, type Children } from './types.js';

export interface NavItem {
  readonly label: string;
  readonly href: string;
}

export interface AppProps {
  brand: string;
  nav: readonly NavItem[];
  /** The current pathname; the engine marks the matching nav item. */
  location: string;
  children: Children;
}

const isActive = (href: string, location: string) =>
  href === '/' ? location === '/' : location === href || location.startsWith(href + '/');

let nextId = 1;

/**
 * The shell. With room for a sidebar beside a useful content column it is a
 * sidebar; otherwise it is a top bar with a menu. The app never says which.
 *
 * One `<nav aria-label="Primary">`: the sticky column in sidebar mode, and in
 * bar mode the surface of a popover layer (`ctx.overlay`) — the APG disclosure
 * navigation pattern: the toggle is `aria-expanded` + `aria-controls`, the
 * engine moves focus in, closes on Escape or an outside pointer, returns focus
 * to the toggle; arrows and Home/End walk the links, Tab leaves and closes. A
 * `location` change closes it without touching focus — the router owns that.
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
    const id = `nisli-app-${nextId++}`;
    const mode = computed(() => shellMode(ctx.width.value, metrics.layout));
    const menuOpen = signal(false);
    const open = computed(() => mode.value === 'bar' && menuOpen.value);
    const nav = computed(() => [...props.nav.value]);
    const navEl = ref<HTMLElement>();
    const toggle = ref<HTMLElement>();

    let from: 'first' | 'last' = 'first';   // ArrowUp on the toggle opens on the last link
    let leaving = false;                     // Tab or navigation left the sheet: focus is not returned to the toggle
    const openMenu = (at: 'first' | 'last' = 'first') => { from = at; leaving = false; menuOpen.value = true; };
    const links = () => [...(navEl.current?.querySelectorAll<HTMLElement>('a[href]') ?? [])];

    // Navigation closes the menu; the router owns where focus goes next.
    const stopNav = effect(() => { props.location.value; if (menuOpen.peek()) { leaving = true; menuOpen.value = false; } });
    onCleanup(stopNav);

    const overlay = ctx.overlay({
      kind: 'popover',
      open,
      onDismiss: () => { menuOpen.value = false; },
      within: () => navEl.current,
      anchor: () => toggle.current,
      size: () => ({ width: ctx.width.value, height: metrics.control.height }),
      initialFocus: () => (from === 'last' ? links().at(-1) : links()[0]) ?? navEl.current,
      restoreFocus: () => !leaving && mode.peek() === 'bar',   // never to a toggle the sidebar just hid
    });

    const focusLink = (link: HTMLElement | undefined) => link?.focus();
    const onNavKey = (ev: Event) => {
      if (!open.value) return;
      const e = ev as KeyboardEvent;
      const list = links();
      const i = list.indexOf(document.activeElement as HTMLElement);
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); focusLink(list[(i + 1) % list.length]); break;
        case 'ArrowUp': e.preventDefault(); focusLink(list[(i - 1 + list.length) % list.length]); break;
        case 'Home': e.preventDefault(); focusLink(list[0]); break;
        case 'End': e.preventDefault(); focusLink(list[list.length - 1]); break;
        case 'Tab': {
          // Leave forwards (or backwards): to the tabbable after (before) the toggle, as if the sheet were not there.
          e.preventDefault();
          leaving = true;
          menuOpen.value = false;
          const order = focusables(document.body).filter((c) => !navEl.current?.contains(c));
          const at = toggle.current ? order.indexOf(toggle.current) : -1;
          (order[at + (e.shiftKey ? -1 : 1)] ?? toggle.current)?.focus();
          break;
        }
      }
    };
    const onToggleKey = (ev: Event) => {
      const e = ev as KeyboardEvent;
      if (e.key === 'ArrowDown') { e.preventDefault(); openMenu('first'); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); openMenu('last'); }
    };

    const link = (item: { value: NavItem }) =>
      el('a', {
        href: computed(() => item.value.href),
        'aria-current': computed(() => (isActive(item.value.href, props.location.value) ? 'page' : false)),
        style: ctx.part(
          () => (isActive(item.value.href, props.location.value) ? ['nav.link', 'nav.link.active'] : 'nav.link'),
          { display: 'block', padding: `${metrics.space[2]}px ${metrics.space[3]}px` },
        ),
      }, computed(() => item.value.label));

    return [
      // The one navigation landmark: a sidebar with room, the menu's sheet without.
      el('nav', {
        ref: navEl,
        id: `${id}-nav`,
        'aria-label': 'Primary',
        style: ctx.part(() => (mode.value === 'sidebar' ? ['surface', 'bar', 'nav.side'] : ['surface', 'bar']), () => (mode.value === 'sidebar'
          ? {
            display: 'flex',
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
          }
          : {
            display: open.value ? 'flex' : 'none',
            // Unseen until the engine has placed it: no first paint at the corner.
            visibility: overlay.placement.value ? 'visible' : 'hidden',
            flexDirection: 'column',
            gap: metrics.space[1],
            padding: metrics.space[3],
            boxSizing: 'border-box',
            position: 'fixed',
            top: overlay.placement.value?.top ?? 0,
            left: 0,
            right: 0,
            zIndex: overlay.z.value,
          })),
        on: { keydown: onNavKey },
      }, [
        el('div', { style: ctx.part('brand', () => ({ display: mode.value === 'sidebar' ? 'block' : 'none', padding: `0 ${metrics.space[3]}px`, marginBottom: metrics.space[4], whiteSpace: 'nowrap' })) }, props.brand),
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
          ref: toggle,
          type: 'button',
          'aria-label': 'Menu',
          'aria-controls': `${id}-nav`,
          'aria-expanded': computed(() => String(open.value)),
          style: ctx.part(['button', 'button.plain'], buttonBox()),
          on: { click: () => { if (menuOpen.value) menuOpen.value = false; else openMenu(); }, keydown: onToggleKey },
        }, computed(() => (open.value ? 'Close' : 'Menu'))),
      ]),
      // Content
      el('div', { style: ctx.part([], { flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }) }, computed(() => toList(props.children.value))),
    ];
  },
});
