/**
 * view-transitions.test.ts — the router's opt-in View Transitions surface.
 *
 * happy-dom implements neither `document.startViewTransition` nor the
 * `ViewTransition` interface, so the no-support path is exercised natively (it
 * is the default here) and the supported path runs against a stub, the way
 * `packages/core/src/view-transition.test.ts` does. The stub proves ORDERING —
 * that the whole commit lands inside the update callback — and the
 * skip-on-late-navigation policy. It proves nothing about real capture,
 * animation, or engine behaviour; that is the Playwright harness's job.
 *
 * Direction is engine-answered, so every direction assertion runs against both
 * engines, matching this package's parity convention.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushEffects, html, inject, resetInjector, settle } from '@nisli/core';
import { defineRouter } from './application.js';
import { installNavigationDouble, uninstallNavigationDouble, type NavigationDouble } from './navigation-double.js';
import { route } from './route.js';
import { Router, type EngineOption, type NavInfo, type RouterViewTransitions } from './router.js';

// ── Stub harness ────────────────────────────────────────────────────

/**
 * A `ViewTransition`-shaped handle whose `finished` stays pending until the
 * animation is completed or skipped — which is what makes "a navigation landing
 * while the previous transition is still animating" reproducible.
 */
class FakeTransition implements ViewTransition {
  skipped = false;
  readonly ready = Promise.resolve();
  readonly updateCallbackDone = Promise.resolve();
  readonly finished: Promise<void>;
  readonly types = new Set<string>() as unknown as ViewTransitionTypeSet;
  private readonly finish: () => void;

  /** The types this transition was started with, `null` for the callback form. */
  constructor(readonly requested: string[] | null) {
    let resolve!: () => void;
    this.finished = new Promise<void>((r) => { resolve = r; });
    this.finish = resolve;
  }

  skipTransition(): void {
    this.skipped = true;
    this.finish();   // the platform finishes a skipped transition immediately
  }

  /** Settle it the way a completed animation would. */
  complete(): void {
    this.finish();
  }
}

type StartArg = ViewTransitionUpdateCallback | StartViewTransitionOptions;

/**
 * Install a `document.startViewTransition` stub (plus the `ViewTransition`
 * global core probes for `types` support) and return the handles it hands out,
 * in order. `around` observes the DOM on both sides of the update callback.
 */
function stubViewTransitions(around?: (phase: 'before' | 'after') => void): FakeTransition[] {
  const started: FakeTransition[] = [];
  vi.stubGlobal('ViewTransition', { prototype: { types: undefined } });
  (document as Document).startViewTransition = (arg?: StartArg): ViewTransition => {
    const update = typeof arg === 'function' ? arg : arg?.update;
    const types = typeof arg === 'function' ? null : arg?.types ?? null;
    const handle = new FakeTransition(types === null ? null : [...types]);
    started.push(handle);
    around?.('before');
    update?.();
    around?.('after');
    return handle;
  };
  return started;
}

// ── Application under test ──────────────────────────────────────────

function routes() {
  return {
    home: route('/', { render: () => html`<p>home</p>` }),
    a: route('/a', { render: () => html`<p>a</p>`, metadata: { title: 'A' } }),
    b: route('/b', { render: () => html`<p>b</p>`, metadata: { title: 'B' } }),
  };
}

interface AppOptions {
  readonly engine?: EngineOption;
  readonly viewTransitions?: RouterViewTransitions;
}

async function connect(options: AppOptions = {}): Promise<{ shell: HTMLElement; router: Router }> {
  const AppRouter = defineRouter(routes(), options);
  const shell = document.createElement('div');
  html`${AppRouter({})}`.mount!(shell);
  document.body.appendChild(shell);
  await settle();
  flushEffects();
  return { shell, router: inject(Router) };
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
  vi.unstubAllGlobals();
  delete (document as Partial<Document>).startViewTransition;
  uninstallNavigationDouble();
  document.body.replaceChildren();
});

// ── Opt-in ──────────────────────────────────────────────────────────

describe('router View Transitions opt-in', () => {
  it('never transitions without configuration, and still commits', async () => {
    const started = stubViewTransitions();
    const { shell, router } = await connect();

    await router.navigate('/a');
    flushEffects();

    expect(started).toHaveLength(0);
    expect(shell.textContent).toContain('a');
    expect(document.title).toBe('A');
  });

  it('transitions every navigation when enabled is true', async () => {
    const started = stubViewTransitions();
    const { shell, router } = await connect({ viewTransitions: { enabled: true } });

    await router.navigate('/a');

    expect(started).toHaveLength(1);
    expect(shell.textContent).toContain('a');
  });

  it('asks the enabled callback per navigation and obeys its answer', async () => {
    const started = stubViewTransitions();
    const seen: NavInfo[] = [];
    const { shell, router } = await connect({
      viewTransitions: {
        enabled: (nav) => { seen.push(nav); return nav.to.pathname === '/b'; },
      },
    });

    await router.navigate('/a');
    expect(started).toHaveLength(0);

    await router.navigate('/b');
    expect(started).toHaveLength(1);
    expect(shell.textContent).toContain('b');

    // The initial render never reaches the policy at all.
    expect(seen.map((nav) => `${nav.from.pathname}→${nav.to.pathname}:${nav.kind}`))
      .toEqual(['/→/a:push', '/a→/b:push']);
  });
});

// ── Per-navigation override ─────────────────────────────────────────

describe('NavigateOptions.viewTransition', () => {
  it('turns a transition on for one navigation while the policy is off', async () => {
    const started = stubViewTransitions();
    const { shell, router } = await connect();

    await router.navigate('/a', { viewTransition: true });
    await router.navigate('/b');

    expect(started).toHaveLength(1);
    expect(shell.textContent).toContain('b');
  });

  it('turns a transition off for one navigation while the policy is on', async () => {
    const started = stubViewTransitions();
    const { shell, router } = await connect({ viewTransitions: { enabled: true } });

    await router.navigate('/a', { viewTransition: false });
    expect(started).toHaveLength(0);
    expect(shell.textContent).toContain('a');

    await router.navigate('/b');
    expect(started).toHaveLength(1);
  });

  it('overrides the policy types for one navigation', async () => {
    const started = stubViewTransitions();
    const { router } = await connect({
      viewTransitions: { enabled: true, types: () => ['policy'] },
    });

    await router.navigate('/a', { viewTransition: { types: ['zoom'] } });
    await router.navigate('/b');

    expect(started.map((handle) => handle.requested)).toEqual([['zoom'], ['policy']]);
  });

  it('carries the override through a replace as well as a push', async () => {
    const started = stubViewTransitions();
    const { router } = await connect();

    await router.replace('/a', { viewTransition: { types: ['swap'] } });

    expect(started.map((handle) => handle.requested)).toEqual([['swap']]);
  });
});

// ── Unconditional suppression ───────────────────────────────────────

describe('suppressed navigations', () => {
  it('never transitions the initial render', async () => {
    const started = stubViewTransitions();
    const { shell } = await connect({ viewTransitions: { enabled: true } });

    expect(started).toHaveLength(0);
    expect(shell.textContent).toContain('home');
  });

  it('never transitions a hash-only move', async () => {
    const started = stubViewTransitions();
    const { router } = await connect({ viewTransitions: { enabled: true } });

    await router.navigate('/a');
    expect(started).toHaveLength(1);

    // Same route, same query, different fragment: the browser's own jump.
    await router.navigate('/a#section');
    await router.navigate('/a');
    expect(started).toHaveLength(1);
  });

  it('never transitions a hidden document, but still commits', async () => {
    const started = stubViewTransitions();
    const { shell, router } = await connect({ viewTransitions: { enabled: true } });
    // An own property shadowing happy-dom's prototype getter, deleted below.
    // `vi.spyOn(document, 'hidden', 'get')` cannot be used here: its restore
    // leaves a self-recursive accessor behind that breaks every later test.
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    try {
      await router.navigate('/a');
      flushEffects();

      expect(started).toHaveLength(0);
      expect(shell.textContent).toContain('a');
      expect(document.title).toBe('A');
    } finally {
      delete (document as unknown as Record<string, unknown>).hidden;
    }
  });
});

// ── Ordering: the commit is what gets snapshotted ───────────────────

describe('commit ordering', () => {
  it('renders, swaps the head, and runs effects INSIDE the update callback', async () => {
    const { shell, router } = await connect({ viewTransitions: { enabled: true } });
    const observed: string[] = [];
    stubViewTransitions((phase) => observed.push(`${phase}:${shell.textContent}:${document.title}`));

    await router.navigate('/a');

    // The whole commit — rendered output and managed head alike — happened
    // strictly between callback entry and callback exit, which is the window
    // the browser captures the new frame in.
    expect(observed).toEqual(['before:home:', 'after:a:A']);
  });

  it('wraps only the commit: a slow render happens before the transition starts', async () => {
    let release!: () => void;
    const slow = new Promise<void>((resolve) => { release = resolve; });
    const AppRouter = defineRouter({
      home: route('/', { render: () => html`<p>home</p>` }),
      slow: route('/slow', { render: async () => { await slow; return html`<p>slow</p>`; } }),
    }, { viewTransitions: { enabled: true } });
    const shell = document.createElement('div');
    html`${AppRouter({})}`.mount!(shell);
    document.body.appendChild(shell);
    await settle();
    const started = stubViewTransitions();

    const navigation = inject(Router).navigate('/slow');
    await settle();
    // The loader is still pending, so nothing has been handed to the platform:
    // a slow route must never freeze the page inside a capture window.
    expect(started).toHaveLength(0);

    release();
    await navigation;
    expect(started).toHaveLength(1);
    expect(shell.textContent).toContain('slow');
  });
});

// ── Late navigation wins ────────────────────────────────────────────

describe('late navigation', () => {
  it('skips a transition still animating instead of queueing behind it', async () => {
    const started = stubViewTransitions();
    const { shell, router } = await connect({ viewTransitions: { enabled: true } });

    await router.navigate('/a');
    expect(started).toHaveLength(1);
    expect(started[0]!.skipped).toBe(false);

    // /a's animation has not finished when /b commits.
    await router.navigate('/b');

    expect(started).toHaveLength(2);
    expect(started[0]!.skipped).toBe(true);
    expect(started[1]!.skipped).toBe(false);
    expect(shell.textContent).toContain('b');
  });

  it('releases a finished transition rather than skipping it later', async () => {
    const started = stubViewTransitions();
    const { router } = await connect({ viewTransitions: { enabled: true } });

    await router.navigate('/a');
    started[0]!.complete();
    await settle();

    await router.navigate('/b');

    expect(started[0]!.skipped).toBe(false);
    expect(started[1]!.skipped).toBe(false);
  });
});

// ── Progressive enhancement ─────────────────────────────────────────

describe('without platform support', () => {
  it('happy-dom really has no startViewTransition (the PE path is native here)', () => {
    expect((document as Partial<Document>).startViewTransition).toBeUndefined();
  });

  it('commits plainly and synchronously with transitions enabled', async () => {
    const { shell, router } = await connect({
      viewTransitions: { enabled: true, types: () => ['slide'] },
    });

    await router.navigate('/a');

    // No flushEffects(): the commit flushed itself, exactly as it does today.
    expect(shell.textContent).toContain('a');
    expect(document.title).toBe('A');
    expect(inject(Router).current.value?.name).toBe('a');
  });
});

// ── Direction, per engine ───────────────────────────────────────────

describe('NavInfo.direction', () => {
  for (const engine of ['history', 'navigation'] as const) {
    describe(engine, () => {
      let double: NavigationDouble | null = null;

      beforeEach(() => {
        double = engine === 'navigation' ? installNavigationDouble() : null;
      });

      /**
       * Traversal reaches each engine the way its browser drives it: a real
       * traversal on the Navigation API, a simulated `popstate` on the History
       * API (happy-dom runs no back/forward stack), as the engine suite does.
       */
      async function traverse(to: { url: string; state: unknown }): Promise<void> {
        if (double) to.url === '/a' ? double.back() : double.forward();
        else {
          history.replaceState(to.state, '', to.url);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
        await settle();
        flushEffects();
      }

      it('reports forward on push, back and forward on traversal', async () => {
        const started = stubViewTransitions();
        const seen: NavInfo[] = [];
        const { shell, router } = await connect({
          engine,
          viewTransitions: { enabled: (nav) => { seen.push(nav); return true; } },
        });

        await router.navigate('/a');
        const entryA = { url: '/a', state: history.state };
        await router.navigate('/b');
        const entryB = { url: '/b', state: history.state };
        flushEffects();
        expect(shell.textContent).toContain('b');

        await traverse(entryA);
        expect(shell.textContent).toContain('a');
        await traverse(entryB);
        expect(shell.textContent).toContain('b');

        expect(seen.map((nav) => `${nav.kind}:${nav.direction}`)).toEqual([
          'push:forward',
          'push:forward',
          'pop:back',
          'pop:forward',
        ]);
        // Direction is the default transition type, so type-scoped CSS works
        // with no configuration; `unknown` is never emitted as a type.
        expect(started.map((handle) => handle.requested)).toEqual([
          ['forward'],
          ['forward'],
          ['back'],
          ['forward'],
        ]);
      });

      it('reports unknown for a replace, which still transitions untyped', async () => {
        const started = stubViewTransitions();
        const seen: NavInfo[] = [];
        const { router } = await connect({
          engine,
          viewTransitions: { enabled: (nav) => { seen.push(nav); return true; } },
        });

        await router.replace('/a');

        expect(seen.map((nav) => `${nav.kind}:${nav.direction}`)).toEqual(['replace:unknown']);
        expect(started.map((handle) => handle.requested)).toEqual([null]);
      });

      it('feeds direction to the types callback', async () => {
        const started = stubViewTransitions();
        const { router } = await connect({
          engine,
          viewTransitions: { enabled: true, types: (nav) => [`nav-${nav.direction}`] },
        });

        await router.navigate('/a');

        expect(started.map((handle) => handle.requested)).toEqual([['nav-forward']]);
      });
    });
  }
});
