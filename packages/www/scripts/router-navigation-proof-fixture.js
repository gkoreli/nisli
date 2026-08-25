/**
 * Fixture app for the BET03 Navigation-API router proof (router-navigation-proof.mjs).
 *
 * Real `@nisli/core` + `@nisli/router` sources, bundled by the driver and served
 * over HTTP so navigation has real URLs and real history entries. The engine is
 * NOT read from the URL: the driver serves one origin per engine and stamps
 * `window.__proofEngine` into the document, so a FULL page load (the History
 * engine's `location.href =` behaviour) keeps the same engine.
 *
 * Nav links live in a `position: fixed` bar so Playwright can click them at any
 * scroll offset without auto-scrolling the element into view — which would
 * destroy the very scroll offset under test.
 */
import { component, flushEffects, html, inject } from '../../core/src/index.js';
import { defineRouter, notFound, route, Router } from '../../router/src/index.js';

/**
 * Unique per document. A same-document transition preserves it; a full document
 * load replaces it. Together with `window.__unloadProbe` this is how the proof
 * distinguishes an intercepted `location.href =` from a real page load.
 */
const docId = `doc-${Math.random().toString(36).slice(2, 10)}`;

/** Which engine the served document asked `defineRouter` for. */
const requestedEngine = window.__proofEngine;

const AppRouter = defineRouter(
  {
    home: route('/', {
      metadata: { title: 'proof / home' },
      render: () => html`
        <div data-route="home">
          <nav class="proof-nav">
            <a id="to-second" href="/second">second</a>
            <a id="to-second-hash" href="/second#anchor">second#anchor</a>
            <button id="home-nested" type="button">home nested</button>
          </nav>
          <h1 id="home-title">home</h1>
          <div class="tall"></div>
        </div>
      `,
    }),
    second: route('/second', {
      metadata: { title: 'proof / second' },
      render: () => html`
        <div data-route="second">
          <nav class="proof-nav">
            <a id="to-home" href="/">home</a>
            <a id="to-anchor" href="#anchor">#anchor</a>
            <button id="second-nested" type="button">second nested</button>
          </nav>
          <h1 id="second-title">second</h1>
          <div class="gap-before-anchor"></div>
          <div id="anchor">anchor</div>
          <div class="gap-after-anchor"></div>
        </div>
      `,
    }),
    notFound: notFound({
      render: ({ url }) => html`<div data-route="not-found">${url.pathname}</div>`,
    }),
  },
  { engine: requestedEngine },
);

// Registering the shell defines its custom element; createElement then upgrades
// it, which runs the outlet's setup and connects the Router to the definition.
component('proof-shell', () => html`
  <div id="page-header">header</div>
  ${AppRouter({})}
`);
document.body.append(document.createElement('proof-shell'));
flushEffects();

// Same instance the outlet injected: `inject` caches app-global singletons, and
// the outlet's setup already ran above.
const router = inject(Router);

/** The router outlet host — the managed `role="main"` / `tabindex="-1"` landmark. */
const outlet = () => document.querySelector('[role="main"][tabindex="-1"]');

const describeActive = () => {
  const active = document.activeElement;
  if (!active) return { activeId: null, activeTag: null, activeIsOutlet: false };
  return {
    activeId: active.id || null,
    activeTag: active.tagName.toLowerCase(),
    activeIsOutlet: active === outlet(),
  };
};

window.__routerProof = {
  ready: true,
  docId,
  requestedEngine,
  snapshot: () => ({
    docId,
    requestedEngine,
    // Feature detection as the engine itself does it (navigation-engine.ts:82-88).
    hasNavigationApi: typeof window.navigation !== 'undefined'
      && typeof window.navigation?.navigate === 'function',
    // Engine discriminators, both observable: only the History engine claims
    // manual scroll restoration (history-engine.ts:105-110) and only it wraps
    // `history.state` with its per-entry key (history-engine.ts:133-135).
    scrollRestoration: history.scrollRestoration,
    historyStateKeys: history.state !== null && typeof history.state === 'object'
      ? Object.keys(history.state)
      : null,
    href: location.href,
    pathname: location.pathname,
    hash: location.hash,
    routerPathname: router.url.value.pathname,
    routerHash: router.url.value.hash,
    routeName: router.current.value?.name ?? null,
    routeMarker: document.querySelector('[data-route]')?.getAttribute('data-route') ?? null,
    pending: router.pending.value,
    error: router.error.value === null ? null : String(router.error.value),
    title: document.title,
    scrollY: Math.round(window.scrollY),
    anchorTop: (() => {
      const el = document.getElementById('anchor');
      return el === null ? null : Math.round(el.getBoundingClientRect().top);
    })(),
    state: router.state() ?? null,
    unloadProbe: window.__unloadProbe ?? null,
    ...describeActive(),
  }),
  navigate: (href, options) => router.navigate(href, options),
  focus: (id) => {
    document.getElementById(id).focus();
    return describeActive();
  },
  /**
   * Direct focusability probe for the outlet host itself, so a failed
   * push→outlet focus contract is self-evidencing rather than inferred: it
   * reports the host's computed `display` alongside the outcome of calling
   * `focus({ preventScroll: true })` on it exactly as router.ts:366 does.
   */
  probeOutletFocus: () => {
    const host = outlet();
    if (host === null) return { present: false };
    host.focus({ preventScroll: true });
    return {
      present: true,
      tag: host.tagName.toLowerCase(),
      role: host.getAttribute('role'),
      tabindex: host.getAttribute('tabindex'),
      display: getComputedStyle(host).display,
      focused: document.activeElement === host,
      activeTag: document.activeElement?.tagName.toLowerCase() ?? null,
    };
  },
};
