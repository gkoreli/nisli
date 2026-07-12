/**
 * sidebar.test.ts — provider state, frame variants, parts.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarRail,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarSeparator,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from './sidebar.js';

beforeEach(() => {
  document.body.innerHTML = '';
  document.cookie = 'sidebar_state=; max-age=0';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function mountSidebar(
  opts: {
    side?: 'left' | 'right';
    variant?: 'sidebar' | 'floating' | 'inset';
    collapsible?: 'offcanvas' | 'icon' | 'none';
    defaultOpen?: boolean;
  } = {},
): HTMLElement {
  const { side, variant, collapsible, defaultOpen } = opts;
  return mount(
    html`${SidebarProvider({
      defaultOpen,
      children: html`${SidebarTrigger({})}
      ${Sidebar({
        side,
        variant,
        collapsible,
        children: html`${SidebarHeader({ children: 'Header' })}
        ${SidebarContent({
          children: SidebarMenu({
            children: SidebarMenuItem({ children: SidebarMenuButton({ children: 'Home' }) }),
          }),
        })}
        ${SidebarFooter({ children: 'Footer' })}
        ${SidebarRail({})}`,
      })}`,
    })}`,
  );
}

const q = (root: ParentNode, slot: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
function flush2(): void {
  flushEffects();
  flushEffects();
}

describe('Sidebar — provider + frame', () => {
  it('wraps with --sidebar-width vars and exposes an expanded frame by default', () => {
    const c = mountSidebar();
    flush2();
    const wrapper = q(c, 'sidebar-wrapper');
    expect(wrapper.getAttribute('style')).toContain('--sidebar-width:16rem');
    const frame = q(c, 'sidebar');
    expect(frame.getAttribute('data-state')).toBe('expanded');
    expect(frame.getAttribute('data-collapsible')).toBe('');
    expect(frame.getAttribute('data-variant')).toBe('sidebar');
    expect(frame.getAttribute('data-side')).toBe('left');
    // Content is projected into the inner frame.
    expect(q(c, 'sidebar-inner').querySelector('[data-slot="sidebar-header"]')).not.toBeNull();
  });

  it('reflects side/variant/collapsible', () => {
    const c = mountSidebar({ side: 'right', variant: 'floating', collapsible: 'icon' });
    flush2();
    const frame = q(c, 'sidebar');
    expect(frame.getAttribute('data-side')).toBe('right');
    expect(frame.getAttribute('data-variant')).toBe('floating');
  });

  it('collapsible="none" renders a plain sidebar', () => {
    const c = mount(
      html`${SidebarProvider({
        children: Sidebar({ collapsible: 'none', children: 'X' }),
      })}`,
    );
    flush2();
    const frame = q(c, 'sidebar');
    expect(frame.getAttribute('data-state')).toBeNull(); // no data-state in the none branch
    expect(frame.className).toContain('w-(--sidebar-width)');
  });
});

describe('Sidebar — toggle', () => {
  it('the trigger collapses/expands and updates data-collapsible + the cookie', () => {
    const c = mountSidebar({ collapsible: 'offcanvas' });
    flush2();
    const frame = q(c, 'sidebar');
    const onChange = vi.fn();
    c.querySelector('ui-sidebar-provider')!.addEventListener('ui-open-change', onChange as EventListener);

    q(c, 'sidebar-trigger').click();
    flush2();
    expect(frame.getAttribute('data-state')).toBe('collapsed');
    expect(frame.getAttribute('data-collapsible')).toBe('offcanvas');
    expect((onChange.mock.calls[0]![0] as CustomEvent).detail).toEqual({ open: false });
    expect(document.cookie).toContain('sidebar_state=false');

    q(c, 'sidebar-trigger').click();
    flush2();
    expect(frame.getAttribute('data-state')).toBe('expanded');
  });

  it('the rail toggles too', () => {
    const c = mountSidebar();
    flush2();
    q(c, 'sidebar-rail').click();
    flush2();
    expect(q(c, 'sidebar').getAttribute('data-state')).toBe('collapsed');
  });

  it('Cmd/Ctrl+B toggles the sidebar', () => {
    const c = mountSidebar();
    flush2();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true }));
    flush2();
    expect(q(c, 'sidebar').getAttribute('data-state')).toBe('collapsed');
  });
});

describe('Sidebar — menu + group parts', () => {
  it('renders the menu family with data-slot/data-sidebar hooks', () => {
    const c = mount(
      html`${SidebarProvider({
        children: Sidebar({
          children: SidebarGroup({
            children: html`${SidebarGroupLabel({ children: 'Platform' })}
            ${SidebarGroupContent({
              children: SidebarMenu({
                children: SidebarMenuItem({
                  children: html`${SidebarMenuButton({ isActive: true, size: 'lg', children: 'Dashboard' })}
                  ${SidebarMenuAction({ children: '⋯' })}
                  ${SidebarMenuBadge({ children: '9' })}
                  ${SidebarMenuSub({
                    children: SidebarMenuSubItem({
                      children: SidebarMenuSubButton({ href: '#a', isActive: true, children: 'Sub' }),
                    }),
                  })}`,
                }),
              }),
            })}`,
          }),
        }),
      })}`,
    );
    flush2();
    expect(q(c, 'sidebar-menu').tagName).toBe('UL');
    expect(q(c, 'sidebar-menu-item').tagName).toBe('LI');
    const btn = q(c, 'sidebar-menu-button');
    expect(btn.getAttribute('data-active')).toBe('true');
    expect(btn.getAttribute('data-size')).toBe('lg');
    expect(btn.className).toContain('h-12'); // lg size variant
    expect(q(c, 'sidebar-menu-action')).not.toBeNull();
    expect(q(c, 'sidebar-menu-badge').textContent).toBe('9');
    const subBtn = q(c, 'sidebar-menu-sub-button');
    expect(subBtn.tagName).toBe('A');
    expect(subBtn.getAttribute('href')).toBe('#a');
    expect(subBtn.getAttribute('data-active')).toBe('true');
    expect(q(c, 'sidebar-group-label').textContent).toBe('Platform');
  });

  it('menu skeleton renders a deterministic width (SSG-safe) and optional icon', () => {
    const c = mount(
      html`${SidebarProvider({ children: SidebarMenuSkeleton({ showIcon: true, width: '60%' }) })}`,
    );
    flush2();
    const sk = q(c, 'sidebar-menu-skeleton');
    expect(sk.querySelector('[data-sidebar="menu-skeleton-icon"]')).not.toBeNull();
    const text = sk.querySelector<HTMLElement>('[data-sidebar="menu-skeleton-text"]')!;
    expect(text.getAttribute('style')).toContain('--skeleton-width:60%');
  });

  it('separator renders with the sidebar hooks', () => {
    const c = mount(html`${SidebarProvider({ children: Sidebar({ children: SidebarSeparator({}) }) })}`);
    flush2();
    expect(q(c, 'sidebar-separator').getAttribute('data-sidebar')).toBe('separator');
  });
});

describe('Sidebar — misuse', () => {
  it('the frame used outside a provider renders an error fallback', () => {
    const host = document.createElement('ui-sidebar');
    document.body.appendChild(host);
    expect(host.querySelector('[data-slot="sidebar"]')).toBeNull();
    expect(host.textContent).toContain('Error');
  });

  it('the trigger used outside a provider renders an error fallback', () => {
    const host = document.createElement('ui-sidebar-trigger');
    document.body.appendChild(host);
    expect(host.textContent).toContain('Error');
  });
});
