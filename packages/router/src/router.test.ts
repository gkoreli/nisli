import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushEffects, html, inject, resetInjector } from '@nisli/core';
import { defineRouter } from './application.js';
import { notFound, route } from './route.js';
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
