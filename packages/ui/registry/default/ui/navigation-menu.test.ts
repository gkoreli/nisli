/**
 * navigation-menu.test.ts — menu bar: triggers, content, roving, ARIA.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from './navigation-menu.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});
afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function menuItem(value: string, label: string): TemplateResult {
  return NavigationMenuItem({
    children: html`${NavigationMenuTrigger({ value, children: label })}
    ${NavigationMenuContent({
      value,
      children: NavigationMenuLink({ href: `/${value}`, children: `${label} link` }),
    })}`,
  });
}

function mountMenu(): HTMLElement {
  return mount(
    html`${NavigationMenu({
      children: NavigationMenuList({
        children: html`${menuItem('products', 'Products')}${menuItem('company', 'Company')}`,
      }),
    })}`,
  );
}

const triggers = (r: ParentNode = document.body) =>
  Array.from(r.querySelectorAll<HTMLButtonElement>('[data-slot="navigation-menu-trigger"]'));
const contents = (r: ParentNode = document.body) =>
  Array.from(r.querySelectorAll<HTMLElement>('[data-slot="navigation-menu-content"]'));
function fire(el: Element, type: string): void {
  el.dispatchEvent(new Event(type, { bubbles: true }));
  flushEffects();
  flushEffects();
}
function key(el: Element, k: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  flushEffects();
  flushEffects();
}
function advance(ms: number): void {
  vi.advanceTimersByTime(ms);
  flushEffects();
  flushEffects();
}

describe('NavigationMenu — structure and ARIA', () => {
  it('renders a menu bar with triggers and hidden content', () => {
    const c = mountMenu();
    expect((c.querySelector('[data-slot="navigation-menu"]') as HTMLElement).getAttribute('data-viewport')).toBe('false');
    expect(c.querySelector('[data-slot="navigation-menu-list"]')!.tagName).toBe('UL');
    expect(triggers(c)).toHaveLength(2);

    const [t0] = triggers(c);
    const [ct0] = contents(c);
    expect(t0.getAttribute('aria-expanded')).toBe('false');
    expect(t0.getAttribute('aria-controls')).toBe(ct0.id);
    expect(ct0.getAttribute('aria-labelledby')).toBe(t0.id);
    expect(ct0.hasAttribute('hidden')).toBe(true);
    expect(t0.className).toContain('h-9');
  });

  it('exposes navigationMenuTriggerStyle for consumers', () => {
    expect(navigationMenuTriggerStyle()).toContain('inline-flex');
  });
});

describe('NavigationMenu — open/close', () => {
  it('opens the panel on pointerenter and reflects aria-expanded/data-state', () => {
    const c = mountMenu();
    const [t0] = triggers(c);
    fire(t0, 'pointerenter');
    expect(contents(c)[0].hasAttribute('hidden')).toBe(false);
    expect(t0.getAttribute('aria-expanded')).toBe('true');
    expect(t0.getAttribute('data-state')).toBe('open');
  });

  it('closes after a grace delay on pointerleave', () => {
    const c = mountMenu();
    const [t0] = triggers(c);
    fire(t0, 'pointerenter');
    expect(contents(c)[0].hasAttribute('hidden')).toBe(false);

    fire(t0, 'pointerleave');
    advance(149);
    expect(contents(c)[0].hasAttribute('hidden')).toBe(false);
    advance(1);
    expect(contents(c)[0].hasAttribute('hidden')).toBe(true);
  });

  it('keeps open when moving from trigger onto its content', () => {
    const c = mountMenu();
    const [t0] = triggers(c);
    fire(t0, 'pointerenter');
    fire(t0, 'pointerleave');
    fire(contents(c)[0], 'pointerenter');
    advance(150);
    expect(contents(c)[0].hasAttribute('hidden')).toBe(false);
  });

  it('switches panels when hovering another trigger', () => {
    const c = mountMenu();
    const [t0, t1] = triggers(c);
    fire(t0, 'pointerenter');
    expect(contents(c)[0].hasAttribute('hidden')).toBe(false);
    fire(t1, 'pointerenter');
    expect(contents(c)[0].hasAttribute('hidden')).toBe(true);
    expect(contents(c)[1].hasAttribute('hidden')).toBe(false);
  });

  it('toggles closed on a second click', () => {
    const c = mountMenu();
    const [t0] = triggers(c);
    fire(t0, 'click');
    expect(contents(c)[0].hasAttribute('hidden')).toBe(false);
    fire(t0, 'click');
    expect(contents(c)[0].hasAttribute('hidden')).toBe(true);
  });

  it('closes on Escape', () => {
    const c = mountMenu();
    const [t0] = triggers(c);
    fire(t0, 'pointerenter');
    expect(contents(c)[0].hasAttribute('hidden')).toBe(false);
    key(t0, 'Escape');
    expect(contents(c)[0].hasAttribute('hidden')).toBe(true);
  });
});

describe('NavigationMenu — keyboard roving', () => {
  it('moves focus between triggers with Arrow keys', () => {
    const c = mountMenu();
    const [t0, t1] = triggers(c);
    t0.focus();
    key(t0, 'ArrowRight');
    expect(document.activeElement).toBe(t1);
    key(t1, 'ArrowLeft');
    expect(document.activeElement).toBe(t0);
  });
});

describe('NavigationMenu — link + misuse', () => {
  it('renders links with data-active', () => {
    const c = mount(
      html`${NavigationMenu({
        children: NavigationMenuList({
          children: NavigationMenuItem({
            children: NavigationMenuContent({
              value: 'x',
              children: NavigationMenuLink({ href: '/x', active: true, children: 'Active' }),
            }),
          }),
        }),
      })}`,
    );
    const link = c.querySelector('[data-slot="navigation-menu-link"]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/x');
    expect(link.getAttribute('data-active')).toBe('true');
  });

  it('renders the setup error boundary for a trigger outside a menu', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = mount(html`${NavigationMenuTrigger({ value: 'x', children: 'x' })}`);
    expect(c.querySelector('[data-slot="navigation-menu-trigger"]')).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
