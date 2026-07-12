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

const triggers = (r: ParentNode = document.body): [HTMLButtonElement, HTMLButtonElement, ...HTMLButtonElement[]] =>
  Array.from(r.querySelectorAll<HTMLButtonElement>('[data-slot="navigation-menu-trigger"]')) as [
    HTMLButtonElement,
    HTMLButtonElement,
    ...HTMLButtonElement[],
  ];
const contents = (r: ParentNode = document.body): [HTMLElement, HTMLElement, ...HTMLElement[]] =>
  Array.from(r.querySelectorAll<HTMLElement>('[data-slot="navigation-menu-content"]')) as [
    HTMLElement,
    HTMLElement,
    ...HTMLElement[],
  ];
// Pointer events carry a `pointerType` so the trigger's mouse-only hover gate
// (UI-64 `whenMouse`) sees a real mouse vs touch; non-pointer events (click,
// pointerdown-outside uses this too) fall back to a plain Event. Hover call
// sites default to 'mouse' — the desktop path they were written for.
function fire(el: Element, type: string, pointerType: 'mouse' | 'touch' | 'pen' = 'mouse'): void {
  const event = type.startsWith('pointer')
    ? new PointerEvent(type, { bubbles: true, pointerType })
    : new Event(type, { bubbles: true });
  el.dispatchEvent(event);
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

  // value-state regression: the root's open-submenu value drives a bubbling
  // ui-value-change event with the correct detail on open and on close.
  it('dispatches ui-value-change with the open item value', () => {
    const c = mountMenu();
    const rootEl = c.querySelector('[data-slot="navigation-menu"]')!.closest('ui-navigation-menu') ??
      c.querySelector('ui-navigation-menu')!;
    const seen: unknown[] = [];
    rootEl.addEventListener('ui-value-change', (e) => seen.push((e as CustomEvent).detail.value));
    const [t0] = triggers(c);
    fire(t0, 'pointerenter');
    expect(seen).toContain('products');
    key(t0, 'Escape');
    expect(seen[seen.length - 1]).toBe('');
  });
});

describe('NavigationMenu — tap/click activation parity (UI-64)', () => {
  // A touch tap emits a synthetic pointerenter[touch] THEN a click. Hover is
  // gated to mouse (whenMouse), so the pointerenter is ignored and the click
  // opens — the panel must END OPEN, not open-then-toggle-shut back to 0->0
  // (the reported real390 defect).
  it('opens on a touch tap (pointerenter[touch] + click)', () => {
    const c = mountMenu();
    const [t0] = triggers(c);
    fire(t0, 'pointerenter', 'touch'); // ignored by the mouse-only hover gate
    fire(t0, 'click');
    expect(contents(c)[0].hasAttribute('hidden')).toBe(false);
    expect(t0.getAttribute('aria-expanded')).toBe('true');
    expect(t0.getAttribute('data-state')).toBe('open');
  });

  it('closes on a second touch tap', () => {
    const c = mountMenu();
    const [t0] = triggers(c);
    fire(t0, 'pointerenter', 'touch');
    fire(t0, 'click');
    fire(t0, 'pointerenter', 'touch');
    fire(t0, 'click');
    expect(contents(c)[0].hasAttribute('hidden')).toBe(true);
    expect(t0.getAttribute('aria-expanded')).toBe('false');
  });

  // A mouse click always arrives as pointerenter[mouse] (hover-open) THEN click.
  // The click rides in on the SAME gesture, so it keeps the panel open instead
  // of toggling it shut: a single mouse click ends OPEN, matching the tap.
  it('opens on a single mouse click (pointerenter[mouse] + click)', () => {
    const c = mountMenu();
    const [t0] = triggers(c);
    fire(t0, 'pointerenter'); // mouse hover opens, arms the same-gesture flag
    fire(t0, 'click'); // rides in on that hover — stays open, not toggled shut
    expect(contents(c)[0].hasAttribute('hidden')).toBe(false);
    expect(t0.getAttribute('aria-expanded')).toBe('true');
  });

  // ...but an INDEPENDENT second click (the gesture flag already consumed)
  // toggles closed — the panel stays user-dismissable by click.
  it('closes on an independent second mouse click', () => {
    const c = mountMenu();
    const [t0] = triggers(c);
    fire(t0, 'pointerenter');
    fire(t0, 'click'); // opened; same-gesture flag consumed
    fire(t0, 'click'); // genuine toggle → close
    expect(contents(c)[0].hasAttribute('hidden')).toBe(true);
  });

  it('dismisses the open panel on a pointerdown outside the menu', () => {
    const c = mountMenu();
    const [t0] = triggers(c);
    fire(t0, 'pointerenter');
    expect(contents(c)[0].hasAttribute('hidden')).toBe(false);

    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }),
    );
    flushEffects();
    flushEffects();
    expect(contents(c)[0].hasAttribute('hidden')).toBe(true);
  });

  it('does NOT dismiss on a pointerdown inside the menu', () => {
    const c = mountMenu();
    const [t0] = triggers(c);
    fire(t0, 'pointerenter', 'touch');
    fire(t0, 'click'); // open via tap
    t0.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
    flushEffects();
    flushEffects();
    expect(contents(c)[0].hasAttribute('hidden')).toBe(false);
  });

  it('removes the document pointerdown listener on disconnect', async () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const c = mountMenu();
    c.remove();
    await Promise.resolve(); // teardown runs one microtask after disconnect
    expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    remove.mockRestore();
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

  // active regression: `active` is a declared boolean attribute — its presence
  // on the host IS the truth, so toggling it live flips data-active.
  it('reflects the active attribute live onto data-active', () => {
    const c = mount(
      html`${NavigationMenuLink({ href: '/x', children: 'Item' })}`,
    );
    const hostEl = c.querySelector('ui-navigation-menu-link') as HTMLElement;
    const link = c.querySelector('[data-slot="navigation-menu-link"]') as HTMLAnchorElement;
    expect(link.hasAttribute('data-active')).toBe(false);
    hostEl.setAttribute('active', '');
    flushEffects();
    flushEffects();
    expect(link.getAttribute('data-active')).toBe('true');
    hostEl.removeAttribute('active');
    flushEffects();
    flushEffects();
    expect(link.hasAttribute('data-active')).toBe(false);
  });

  it('renders the setup error boundary for a trigger outside a menu', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = mount(html`${NavigationMenuTrigger({ value: 'x', children: 'x' })}`);
    expect(c.querySelector('[data-slot="navigation-menu-trigger"]')).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
