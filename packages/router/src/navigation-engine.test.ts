import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushEffects, html, inject, provide, resetInjector } from '@nisli/core';
import { defineRouter } from './application.js';
import { HistoryEngine } from './history-engine.js';
import { installNavigationDouble, uninstallNavigationDouble, type NavigationDouble } from './navigation-double.js';
import { NavigationApiEngine, supportsNavigationApi } from './navigation-engine.js';
import { notFound, redirect, route } from './route.js';
import { createEngine, Router } from './router.js';

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function mount(AppRouter: ReturnType<typeof defineRouter>): HTMLElement {
  const shell = document.createElement('div');
  html`${AppRouter({})}`.mount!(shell);
  document.body.appendChild(shell);
  return shell;
}

/** The catalog every engine-behaviour test below routes against. */
function catalog() {
  return {
    home: route('/', { render: () => html`<p>home</p>` }),
    a: route('/a', { render: () => html`<p>a</p>` }),
    b: route('/b', { render: () => html`<p>b</p>` }),
    user: route('/users/:id', { render: ({ params }) => html`<p>user ${params.id}</p>` }),
    legacyUser: redirect('/u/:id', ({ params }) => `/users/${params.id}`),
    notFound: notFound({ render: ({ url }) => html`<p>missing ${url.pathname}</p>` }),
  };
}

beforeEach(() => {
  resetInjector();
  document.body.replaceChildren();
  document.title = '';
  history.replaceState(null, '', '/');
  uninstallNavigationDouble();
});

afterEach(() => {
  vi.restoreAllMocks();
  uninstallNavigationDouble();
  document.body.replaceChildren();
});

describe('engine selection', () => {
  it('falls back to the History engine where the platform has no Navigation API', () => {
    expect(supportsNavigationApi()).toBe(false);
    expect(createEngine()).toBeInstanceOf(HistoryEngine);
    expect(createEngine('auto')).toBeInstanceOf(HistoryEngine);
    // The explicit request still falls back rather than leaving the app unrouted.
    expect(createEngine('navigation')).toBeInstanceOf(HistoryEngine);
  });

  it('detects the Navigation API and selects the Navigation engine', () => {
    installNavigationDouble();
    expect(supportsNavigationApi()).toBe(true);
    expect(createEngine()).toBeInstanceOf(NavigationApiEngine);
    expect(createEngine('navigation')).toBeInstanceOf(NavigationApiEngine);
  });

  it('treats engine: history as the kill switch even where the API exists', () => {
    installNavigationDouble();
    expect(createEngine('history')).toBeInstanceOf(HistoryEngine);
  });

  it('requires an actually usable navigation object, not just the property', () => {
    Object.defineProperty(globalThis, 'navigation', { value: {}, configurable: true, writable: true });
    expect(supportsNavigationApi()).toBe(false);
    expect(createEngine()).toBeInstanceOf(HistoryEngine);
  });

  it('honours an explicitly injected engine over the defineRouter preference', async () => {
    const double = installNavigationDouble();
    provide(Router, () => new Router(new HistoryEngine()));
    mount(defineRouter(catalog(), { engine: 'navigation' }));
    await settle();
    const router = inject(Router);
    await router.navigate('/a');
    expect(double.intercepts).toHaveLength(0);
    expect(location.pathname).toBe('/a');
  });
});

describe('defineRouter engine option', () => {
  it('routes through the Navigation API by default when it is available', async () => {
    const double = installNavigationDouble();
    const shell = mount(defineRouter(catalog()));
    await settle();
    const router = inject(Router);

    await router.navigate('/a');
    flushEffects();
    expect(double.intercepts.map((record) => record.url)).toEqual([new URL('/a', location.href).href]);
    expect(shell.textContent).toContain('a');
  });

  it('keeps the History engine when asked, with the Navigation API present', async () => {
    const double = installNavigationDouble();
    const shell = mount(defineRouter(catalog(), { engine: 'history' }));
    await settle();
    const router = inject(Router);

    await router.navigate('/a');
    flushEffects();
    expect(double.intercepts).toHaveLength(0);
    expect(double.native).toHaveLength(0);
    expect(location.pathname).toBe('/a');
    expect(shell.textContent).toContain('a');
  });
});

describe('NavigationApiEngine', () => {
  let double: NavigationDouble;

  beforeEach(() => {
    double = installNavigationDouble();
  });

  async function connectApp(): Promise<{ shell: HTMLElement; router: Router }> {
    const shell = mount(defineRouter(catalog(), { engine: 'navigation' }));
    await settle();
    flushEffects();
    return { shell, router: inject(Router) };
  }

  it('renders the initial entry without a navigate event', async () => {
    const { shell, router } = await connectApp();
    expect(shell.textContent).toContain('home');
    expect(router.current.value?.name).toBe('home');
    expect(double.intercepts).toHaveLength(0);
  });

  it('intercepts a push, hands scroll to the browser, and keeps the outlet focus contract', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const { shell, router } = await connectApp();
    const host = shell.querySelector('[role="main"]') as HTMLElement;
    const focus = vi.spyOn(host, 'focus');

    await router.navigate('/a');
    await settle();
    flushEffects();

    expect(shell.textContent).toContain('a');
    expect(location.pathname).toBe('/a');
    expect(router.url.value.pathname).toBe('/a');
    expect(double.intercepts).toEqual([expect.objectContaining({
      navigationType: 'push',
      scroll: 'after-transition',
      focusReset: 'manual',
    })]);
    // Browser-owned scroll: the router applies none of its manual effects.
    expect(scrollTo).not.toHaveBeenCalled();
    // Focus stays the router's, which is why focusReset is manual.
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('asks the browser to leave scroll alone when the navigation preserves it', async () => {
    const { router } = await connectApp();

    await router.navigate('/a', { scroll: 'preserve' });
    await router.replace('/b');
    await router.replace('/a', { scroll: 'top' });

    expect(double.intercepts.map((record) => `${record.navigationType}:${record.scroll}`)).toEqual([
      'push:manual',            // scroll: 'preserve'
      'replace:manual',         // replace preserves by default
      'replace:after-transition', // replace opting into the top
    ]);
  });

  it('lets the browser restore scroll on a traversal', async () => {
    const { shell, router } = await connectApp();
    await router.navigate('/a');
    await router.navigate('/b');
    flushEffects();
    expect(shell.textContent).toContain('b');

    double.back();
    await settle();
    flushEffects();

    expect(shell.textContent).toContain('a');
    expect(location.pathname).toBe('/a');
    expect(double.intercepts.at(-1)).toEqual(expect.objectContaining({
      navigationType: 'traverse',
      scroll: 'after-transition',
    }));

    double.forward();
    await settle();
    flushEffects();
    expect(shell.textContent).toContain('b');
  });

  it('round-trips navigation state through the entry, leaving history.state alone', async () => {
    const { router } = await connectApp();

    expect(router.state()).toBeNull();
    await router.navigate('/a', { state: { source: 'user-menu' } });
    expect(router.state()).toEqual({ source: 'user-menu' });
    // No `__nisli_router` wrapper: per-entry keys are a History-engine detail.
    expect(history.state).toBeNull();
    await router.navigate('/b');
    expect(router.state()).toBeNull();
  });

  it('follows a redirect with replace semantics and resolves after the target renders', async () => {
    const { shell, router } = await connectApp();
    const before = double.length;

    await router.navigate('/u/42');
    flushEffects();

    expect(location.pathname).toBe('/users/42');
    expect(router.current.value?.name).toBe('user');
    expect(shell.textContent).toContain('user 42');
    // One new entry for the hop, not two: the redirect source left none.
    expect(double.length).toBe(before + 1);
  });

  it('intercepts page-initiated navigations the matcher owns', async () => {
    const { shell } = await connectApp();

    // `location.href = '/a'`, a link click, a third-party navigation: all the
    // same event, none of them carrying router info.
    await double.page('/a').finished;
    flushEffects();
    expect(shell.textContent).toContain('a');
    expect(double.native).toHaveLength(0);

    // A configured notFound owns the URL, so the click is still the router's.
    await double.page('/nope').finished;
    flushEffects();
    expect(shell.textContent).toContain('missing /nope');
  });

  it('resolves the match once for a page-initiated navigation', async () => {
    const metadata = vi.fn(() => ({ title: 'Next' }));
    const shell = mount(defineRouter({
      home: route('/', { render: () => html`<p>home</p>` }),
      next: route('/next', { render: () => html`<p>next</p>`, metadata }),
    }, { engine: 'navigation' }));
    await settle();

    await double.page('/next').finished;
    flushEffects();

    expect(shell.textContent).toContain('next');
    // Eligibility needs a match before intercepting; the core must reuse it
    // rather than re-run codecs, redirect resolvers, and metadata functions.
    expect(metadata).toHaveBeenCalledTimes(1);
  });

  it('declines the navigations that belong to the browser', async () => {
    // No configured notFound here: an unmatched same-origin URL must stay the
    // server's document, exactly as the delegated click listener leaves it.
    const shell = mount(defineRouter({
      home: route('/', { render: () => html`<p>home</p>` }),
      a: route('/a', { render: () => html`<p>a</p>` }),
    }, { engine: 'navigation' }));
    await settle();
    flushEffects();
    const ignored = document.createElement('a');
    ignored.href = '/a';
    ignored.setAttribute('data-router-ignore', '');
    document.body.appendChild(ignored);

    const declined = [
      // Unmatched same-origin URL: a server document or a static asset.
      double.page('/server-page'),
      double.page('/assets/report.pdf'),
      // Download, cross-origin, form submission.
      double.page('/a', { downloadRequest: 'report.pdf' }),
      double.page('https://example.com/', { canIntercept: false }),
      double.page('/a', { formData: new FormData() }),
      // Same-document fragment keeps its native jump.
      double.page('/#section'),
      // data-router-ignore, reported through sourceElement.
      double.page('/a', { sourceElement: ignored }),
    ];
    await Promise.all(declined.map((result) => result.finished));
    flushEffects();

    expect(double.intercepts).toHaveLength(0);
    expect(double.native).toHaveLength(declined.length);
    expect(shell.textContent).toContain('home');
    expect(location.pathname).toBe('/');
  });

  it('falls back to a recorded click when NavigateEvent has no sourceElement', async () => {
    const { shell } = await connectApp();
    double.reportsSourceElement = false;
    const ignored = document.createElement('a');
    ignored.href = '/a';
    ignored.setAttribute('data-router-ignore', '');
    const plain = document.createElement('a');
    plain.href = '/b';
    document.body.append(ignored, plain);

    // The capture-phase recorder is the only thing that sees the anchor.
    document.addEventListener('click', (event) => event.preventDefault(), { once: true });
    ignored.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await double.page('/a').finished;
    flushEffects();
    expect(double.intercepts).toHaveLength(0);
    expect(shell.textContent).toContain('home');

    document.addEventListener('click', (event) => event.preventDefault(), { once: true });
    plain.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await double.page('/b').finished;
    flushEffects();
    expect(double.intercepts).toHaveLength(1);
    expect(shell.textContent).toContain('b');
  });

  it('aborts a superseded navigation and discards its render', async () => {
    let release!: () => void;
    const slow = new Promise<void>((resolve) => { release = resolve; });
    const engine = new NavigationApiEngine();
    provide(Router, () => new Router(engine));
    const shell = mount(defineRouter({
      home: route('/', { render: () => html`<p>home</p>` }),
      slow: route('/slow', { render: async () => { await slow; return html`<p>slow</p>`; } }),
      fast: route('/fast', { render: () => html`<p>fast</p>` }),
    }));
    await settle();
    const router = inject(Router);

    const slowNavigation = router.navigate('/slow');
    await settle();
    const superseded = engine.currentSignal();
    expect(superseded?.aborted).toBe(false);

    await router.navigate('/fast');
    expect(superseded?.aborted).toBe(true);
    expect(double.outcomes).toContain('error');

    release();
    await slowNavigation;
    flushEffects();
    expect(shell.textContent).toContain('fast');
    expect(shell.textContent).not.toContain('slow');
    // navigatesuccess closed the lifecycle out.
    expect(engine.currentSignal()).toBeNull();
    expect(double.outcomes.at(-1)).toBe('success');
  });

  it('reports a navigation before connect the same way the History engine does', async () => {
    const router = new Router(new NavigationApiEngine());
    await expect(router.navigate('/a')).rejects.toThrow(/before an AppRouter outlet is connected/);
  });

  it('leaves cross-origin navigation to the browser', async () => {
    const { router } = await connectApp();
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});

    await router.navigate('https://example.com/away');

    expect(assign).toHaveBeenCalledWith('https://example.com/away');
    expect(double.intercepts).toHaveLength(0);
    expect(location.pathname).toBe('/');
  });

  it('traverses past the ends of the stack without throwing', async () => {
    const { router } = await connectApp();
    expect(() => router.back()).not.toThrow();
    expect(() => router.forward()).not.toThrow();
    await settle();
  });

  it('stops listening after the outlet disconnects', async () => {
    const shell = mount(defineRouter(catalog(), { engine: 'navigation' }));
    await settle();
    shell.replaceChildren();
    await settle();

    await double.page('/a').finished;
    expect(double.intercepts).toHaveLength(0);
    expect(double.native).toEqual([new URL('/a', location.href).href]);
  });
});

describe('engine parity', () => {
  const engines = ['history', 'navigation'] as const;

  for (const engine of engines) {
    describe(engine, () => {
      let double: NavigationDouble | null = null;

      beforeEach(() => {
        double = engine === 'navigation' ? installNavigationDouble() : null;
      });

      async function connectApp(): Promise<{ shell: HTMLElement; router: Router }> {
        const shell = mount(defineRouter(catalog(), { engine }));
        await settle();
        flushEffects();
        return { shell, router: inject(Router) };
      }

      /**
       * Back reaches each engine the way its browser drives it: a traversal on
       * the Navigation API, a `popstate` on the History API (happy-dom does not
       * run a real back/forward stack, so the pop is simulated as the existing
       * suite simulates it).
       */
      async function goBack(previous: { url: string; state: unknown }): Promise<void> {
        if (double) double.back();
        else {
          history.replaceState(previous.state, '', previous.url);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
        await settle();
        flushEffects();
      }

      it('renders the initial entry', async () => {
        const { shell, router } = await connectApp();
        expect(shell.textContent).toContain('home');
        expect(router.current.value?.name).toBe('home');
      });

      it('pushes, replaces, and keeps url/isActive in step', async () => {
        const { shell, router } = await connectApp();

        await router.navigate('/users/42');
        flushEffects();
        expect(shell.textContent).toContain('user 42');
        expect(location.pathname).toBe('/users/42');
        expect(router.url.value.pathname).toBe('/users/42');
        expect(router.isActive('/users')).toBe(true);

        await router.replace('/b');
        flushEffects();
        expect(shell.textContent).toContain('b');
        expect(location.pathname).toBe('/b');
        expect(router.isActive('/users')).toBe(false);
      });

      it('renders the configured notFound for an unmatched URL', async () => {
        const { shell, router } = await connectApp();
        await router.navigate('/nope');
        flushEffects();
        expect(router.current.value?.notFound).toBe(true);
        expect(shell.textContent).toContain('missing /nope');
      });

      it('follows a redirect with replace semantics', async () => {
        const { shell, router } = await connectApp();
        await router.navigate('/u/42');
        await settle();
        flushEffects();
        expect(location.pathname).toBe('/users/42');
        expect(router.current.value?.name).toBe('user');
        expect(shell.textContent).toContain('user 42');
      });

      it('renders the previous entry on back', async () => {
        const { shell, router } = await connectApp();
        await router.navigate('/a');
        const previous = { url: '/a', state: history.state };
        await router.navigate('/b');
        flushEffects();
        expect(shell.textContent).toContain('b');

        await goBack(previous);
        expect(shell.textContent).toContain('a');
        expect(location.pathname).toBe('/a');
        expect(router.url.value.pathname).toBe('/a');
      });

      it('round-trips navigation state through router.state()', async () => {
        const { router } = await connectApp();
        expect(router.state()).toBeNull();
        await router.navigate('/a', { state: { source: 'user-menu' } });
        expect(router.state()).toEqual({ source: 'user-menu' });
        await router.navigate('/b');
        expect(router.state()).toBeNull();
      });
    });
  }
});
