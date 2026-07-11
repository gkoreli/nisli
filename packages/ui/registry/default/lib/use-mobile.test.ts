/**
 * use-mobile.test.ts — reactive viewport-width signal.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { component, html } from '@nisli/core';
import { useIsMobile, MOBILE_BREAKPOINT } from './use-mobile.js';

// A controllable matchMedia stand-in.
function fakeMql(initial: boolean) {
  const listeners = new Set<() => void>();
  return {
    matches: initial,
    media: '',
    addEventListener: (_type: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_type: string, cb: () => void) => listeners.delete(cb),
    set(next: boolean) {
      this.matches = next;
      for (const cb of [...listeners]) cb();
    },
    count() {
      return listeners.size;
    },
  };
}

let mql: ReturnType<typeof fakeMql>;
let lastQuery = '';
const realMatchMedia = window.matchMedia;

beforeEach(() => {
  document.body.innerHTML = '';
  mql = fakeMql(false);
  (window as unknown as { matchMedia: unknown }).matchMedia = (q: string) => {
    lastQuery = q;
    return mql as unknown as MediaQueryList;
  };
});
afterEach(() => {
  (window as unknown as { matchMedia: unknown }).matchMedia = realMatchMedia;
});

describe('useIsMobile', () => {
  it('queries the breakpoint below MOBILE_BREAKPOINT', () => {
    useIsMobile();
    expect(lastQuery).toBe(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  });

  it('reflects the initial match state', () => {
    mql.matches = true;
    const { isMobile } = useIsMobile();
    expect(isMobile.value).toBe(true);
  });

  it('updates the signal when the media query changes', () => {
    const { isMobile } = useIsMobile();
    expect(isMobile.value).toBe(false);
    mql.set(true);
    expect(isMobile.value).toBe(true);
    mql.set(false);
    expect(isMobile.value).toBe(false);
  });

  it('removes the listener on dispose (idempotent)', () => {
    const { isMobile, dispose } = useIsMobile();
    expect(mql.count()).toBe(1);
    dispose();
    dispose(); // idempotent
    expect(mql.count()).toBe(0);
    // No further updates after dispose.
    mql.set(true);
    expect(isMobile.value).toBe(false);
  });

  it('auto-disposes when created during component setup', async () => {
    const Probe = component('use-mobile-probe', () => {
      useIsMobile();
      return html`<div></div>`;
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    html`${Probe({})}`.mount(container);
    expect(mql.count()).toBe(1);

    // Disconnect; deferred teardown (ADR 0023) runs across microtasks.
    container.remove();
    await Promise.resolve();
    await Promise.resolve();
    expect(mql.count()).toBe(0);
  });

  it('is SSR/SSG-safe when matchMedia is unavailable', () => {
    (window as unknown as { matchMedia: unknown }).matchMedia = undefined;
    const { isMobile, dispose } = useIsMobile();
    expect(isMobile.value).toBe(false);
    expect(() => dispose()).not.toThrow();
  });
});
