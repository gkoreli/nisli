import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushEffects, html, inject, resetInjector } from '@nisli/core';
import { defineRouter } from './application.js';
import { notFound, redirect, route } from './route.js';
import { Router } from './router.js';

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Router browser service and outlet', () => {
  beforeEach(() => {
    resetInjector();
    document.body.replaceChildren();
    document.head.querySelectorAll('meta').forEach((node) => node.remove());
    history.replaceState(null, '', '/');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('registers the outlet once, lazily on first factory invocation', () => {
    const define = vi.spyOn(customElements, 'define');
    const AppRouter = defineRouter({ home: route('/', { render: () => html`` }) });
    expect(define).not.toHaveBeenCalled();
    AppRouter({});
    expect(define).toHaveBeenCalledOnce();
    AppRouter({});
    expect(define).toHaveBeenCalledOnce();
  });

  it('implicitly connects, renders direct loads, and applies metadata', async () => {
    const AppRouter = defineRouter({
      home: route('/', { render: () => html`<p>home</p>`, metadata: { title: 'Home', meta: { description: 'start' } } }),
      notFound: notFound({ render: () => html`<p>missing</p>` }),
    });
    const shell = document.createElement('div');
    html`${AppRouter({})}`.mount!(shell);
    document.body.appendChild(shell);
    await settle();
    flushEffects();
    expect(shell.textContent).toContain('home');
    expect(document.title).toBe('Home');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('start');
    expect(inject(Router).current.value?.name).toBe('home');
  });

  it('sets, updates, and removes OpenGraph, canonical, and hreflang across navigations', async () => {
    const AppRouter = defineRouter({
      en: route('/en', {
        render: () => html`<p>en</p>`,
        metadata: {
          title: 'EN',
          meta: { description: 'english' },
          property: { 'og:title': 'EN OG', 'og:type': 'website' },
          canonical: 'https://nisli.dev/en',
          alternates: [
            { hreflang: 'en', href: 'https://nisli.dev/en' },
            { hreflang: 'ka', href: 'https://nisli.dev/ka' },
          ],
        },
      }),
      plain: route('/plain', { render: () => html`<p>plain</p>`, metadata: { title: 'Plain' } }),
    });
    const shell = document.createElement('div');
    html`${AppRouter({})}`.mount!(shell);
    document.body.appendChild(shell);
    const router = inject(Router);

    await router.navigate('/en');
    flushEffects();
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('EN OG');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://nisli.dev/en');
    expect(document.querySelectorAll('link[rel="alternate"]')).toHaveLength(2);
    expect(document.querySelector('link[rel="alternate"][hreflang="ka"]')?.getAttribute('href'))
      .toBe('https://nisli.dev/ka');

    // Navigating to a route that omits SEO tags must REMOVE the stale ones.
    await router.navigate('/plain');
    flushEffects();
    expect(document.querySelector('meta[property="og:title"]')).toBeNull();
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelectorAll('link[rel="alternate"]')).toHaveLength(0);
    expect(document.querySelector('meta[name="description"]')).toBeNull();
  });

  it('navigates, replaces, handles popstate, and renders not-found', async () => {
    const AppRouter = defineRouter({
      home: route('/', { render: () => html`<p>home</p>` }),
      user: route('/users/:id', { render: ({ params }) => html`<p>user ${params.id}</p>` }),
      notFound: notFound({ render: ({ url }) => html`<p>missing ${url.pathname}</p>` }),
    });
    const shell = document.createElement('div');
    html`${AppRouter({})}`.mount!(shell);
    document.body.appendChild(shell);
    await settle();
    const router = inject(Router);
    await router.navigate('/users/42');
    flushEffects();
    expect(location.pathname).toBe('/users/42');
    expect(shell.textContent).toContain('user 42');
    await router.replace('/nope');
    flushEffects();
    expect(router.current.value?.notFound).toBe(true);
    expect(shell.textContent).toContain('missing /nope');
    history.replaceState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await settle();
    expect(router.current.value?.name).toBe('home');
  });

  it('intercepts eligible anchors but preserves native exceptions', async () => {
    const AppRouter = defineRouter({
      home: route('/', { render: () => html`` }),
      next: route('/next', { render: () => html`<p>next</p>` }),
    });
    const shell = document.createElement('div');
    html`${AppRouter({})}`.mount!(shell);
    document.body.appendChild(shell);
    await settle();
    const anchor = document.createElement('a');
    anchor.href = '/next';
    document.body.appendChild(anchor);
    expect(anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))).toBe(false);
    await settle();
    expect(location.pathname).toBe('/next');
    const selfTarget = document.createElement('a');
    selfTarget.href = '/';
    selfTarget.target = '_self';
    document.body.appendChild(selfTarget);
    expect(selfTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))).toBe(false);
    await settle();
    expect(location.pathname).toBe('/');
    const blankTarget = document.createElement('a');
    blankTarget.href = '/next';
    blankTarget.target = '_blank';
    document.body.appendChild(blankTarget);
    // Cancel happy-dom's native page load after Router has declined the click.
    document.addEventListener('click', (event) => event.preventDefault(), { once: true });
    expect(blankTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))).toBe(false);
    await settle();
    expect(location.pathname).toBe('/');
    const external = document.createElement('a');
    external.href = 'https://example.com/';
    document.body.appendChild(external);
    expect(external.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))).toBe(true);
  });

  it('discards stale asynchronous page renders', async () => {
    let release!: () => void;
    const slow = new Promise<void>((resolve) => { release = resolve; });
    const AppRouter = defineRouter({
      home: route('/', { render: () => html`<p>home</p>` }),
      slow: route('/slow', { render: async () => { await slow; return html`<p>slow</p>`; } }),
      fast: route('/fast', { render: () => html`<p>fast</p>` }),
    });
    const shell = document.createElement('div');
    html`${AppRouter({})}`.mount!(shell);
    document.body.appendChild(shell);
    await settle();
    const router = inject(Router);
    const slowNavigation = router.navigate('/slow');
    await router.navigate('/fast');
    release();
    await slowNavigation;
    flushEffects();
    expect(shell.textContent).toContain('fast');
    expect(shell.textContent).not.toContain('slow');
  });

  it('follows client-side redirect routes with replace semantics', async () => {
    const AppRouter = defineRouter({
      home: route('/', { render: () => html`<p>home</p>` }),
      user: route('/users/:id', { render: ({ params }) => html`<p>user ${params.id}</p>` }),
      legacyUser: redirect('/u/:id', ({ params }) => `/users/${params.id}`),
      legacyHome: redirect('/start', '/'),
    });
    const shell = document.createElement('div');
    html`${AppRouter({})}`.mount!(shell);
    document.body.appendChild(shell);
    await settle();
    const router = inject(Router);

    await router.navigate('/u/42');
    await settle();
    flushEffects();
    expect(location.pathname).toBe('/users/42');
    expect(router.current.value?.name).toBe('user');
    expect(shell.textContent).toContain('user 42');

    await router.navigate('/start');
    await settle();
    flushEffects();
    expect(location.pathname).toBe('/');
    expect(router.current.value?.name).toBe('home');
  });

  it('bails out of a redirect cycle instead of hanging', async () => {
    const AppRouter = defineRouter({
      home: route('/', { render: () => html`<p>home</p>` }),
      a: redirect('/a', '/b'),
      b: redirect('/b', '/a'),
    });
    const shell = document.createElement('div');
    html`${AppRouter({})}`.mount!(shell);
    document.body.appendChild(shell);
    await settle();
    const router = inject(Router);

    await router.navigate('/a');
    await settle();
    flushEffects();
    expect(router.error.value).toBeInstanceOf(Error);
    expect(String((router.error.value as Error).message)).toContain('Redirect loop');
  });

  it('resets the document title to the connect default when a route omits it', async () => {
    document.title = 'Original';
    const AppRouter = defineRouter({
      titled: route('/titled', { render: () => html``, metadata: { title: 'Titled' } }),
      plain: route('/plain', { render: () => html`` }),
    });
    const shell = document.createElement('div');
    html`${AppRouter({})}`.mount!(shell);
    document.body.appendChild(shell);
    await settle();
    const router = inject(Router);

    await router.navigate('/titled');
    flushEffects();
    expect(document.title).toBe('Titled');
    await router.navigate('/plain');
    flushEffects();
    expect(document.title).toBe('Original');
  });

  it('reports the active link for aria-current', async () => {
    const AppRouter = defineRouter({
      home: route('/', { render: () => html`` }),
      docs: route('/docs', { render: () => html`` }),
      topic: route('/docs/:topic', { render: () => html`` }),
    });
    const shell = document.createElement('div');
    html`${AppRouter({})}`.mount!(shell);
    document.body.appendChild(shell);
    await settle();
    const router = inject(Router);

    await router.navigate('/docs/routing');
    expect(router.isActive('/docs')).toBe(true);           // prefix match
    expect(router.isActive('/docs', { exact: true })).toBe(false);
    expect(router.isActive('/docs/routing', { exact: true })).toBe(true);
    expect(router.isActive('/')).toBe(false);              // root is exact-only
    await router.navigate('/');
    expect(router.isActive('/')).toBe(true);
  });

  it('restores per-entry scroll position on back/forward', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    let scrollY = 0;
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY });
    Object.defineProperty(window, 'scrollX', { configurable: true, get: () => 0 });
    try {
      const AppRouter = defineRouter({
        a: route('/a', { render: () => html`<p>a</p>` }),
        b: route('/b', { render: () => html`<p>b</p>` }),
      });
      const shell = document.createElement('div');
      html`${AppRouter({})}`.mount!(shell);
      document.body.appendChild(shell);
      await settle();
      const router = inject(Router);

      expect(history.scrollRestoration).toBe('manual');

      await router.navigate('/a');
      const stateA = history.state;
      scrollY = 500;                       // user scrolls page /a down
      await router.navigate('/b');         // leaving /a records {0, 500}
      scrollY = 0;
      scrollTo.mockClear();

      // Simulate the browser popping back to /a.
      history.replaceState(stateA, '', '/a');
      window.dispatchEvent(new PopStateEvent('popstate'));
      await settle();
      flushEffects();
      expect(scrollTo).toHaveBeenCalledWith(0, 500);
    } finally {
      scrollTo.mockRestore();
      delete (window as unknown as Record<string, unknown>).scrollY;
      delete (window as unknown as Record<string, unknown>).scrollX;
    }
  });

  it('rejects a second root outlet on one Router singleton', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const AppRouter = defineRouter({ home: route('/', { render: () => html`` }) });
    const first = document.createElement('div');
    const second = document.createElement('div');
    html`${AppRouter({})}`.mount!(first);
    html`${AppRouter({})}`.mount!(second);
    document.body.append(first, second);
    await settle();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('setup error'), expect.objectContaining({ message: expect.stringContaining('already') }));
  });
});
