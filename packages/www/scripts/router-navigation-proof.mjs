/**
 * Real-browser proof for BET03's Navigation API router engine — the RTR-6 gap
 * ADR 0026 left open ("real-browser automation of scroll/focus/hash effects").
 *
 * `defineRouter(catalog, { engine })` defaults to `'auto'`, so Chromium and
 * Firefox users now run `navigation.intercept()`, and because
 * `NavigationApiEngine.ownsScrollRestoration = false`
 * (packages/router/src/navigation-engine.ts:133) the router SKIPS its own scroll
 * work (packages/router/src/router.ts:364) and trusts the browser. Until this
 * script that swap was verified only under happy-dom, which has no Navigation
 * API at all.
 *
 * Vite bundles the actual core + router sources in memory; a node http server
 * serves the same SPA document for every path (one origin per engine, so a full
 * page load keeps its engine); Playwright drives chromium, firefox and webkit
 * against BOTH engines forced explicitly.
 *
 *   pnpm --filter @nisli/www proof:router-navigation
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { build } from 'vite';

const wwwDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = join(wwwDir, '..', '..');

/** Scroll assertions tolerate sub-pixel/rounding drift, not a wrong offset. */
const SCROLL_TOLERANCE = 3;
/** Scroll offsets the proof parks entries at before traversing. */
const HOME_OFFSET = 900;
const SECOND_OFFSET = 400;

const bundleResult = await build({
  configFile: false,
  logLevel: 'silent',
  root: repoRoot,
  build: {
    write: false,
    rollupOptions: {
      input: join(wwwDir, 'scripts', 'router-navigation-proof-fixture.js'),
      output: { format: 'es', inlineDynamicImports: true },
    },
  },
});
const bundle = bundleResult.output.find((item) => item.type === 'chunk')?.code;
assert.ok(bundle, 'Vite did not produce the router navigation proof bundle');

const documentHtml = (engine) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>router navigation proof</title>
<style>
  html { scroll-behavior: auto }
  html, body { margin: 0 }
  body { font: 14px/1.4 monospace }
  #page-header { height: 60px; background: #eef }
  .proof-nav { position: fixed; top: 0; right: 0; z-index: 9; background: #fff; padding: 4px }
  .proof-nav a, .proof-nav button { display: block }
  .tall { height: 4000px; background: linear-gradient(#fafafa, #dddddd) }
  .gap-before-anchor { height: 1600px }
  #anchor { height: 40px; background: #ffdd00 }
  .gap-after-anchor { height: 2400px }
</style>
</head>
<body>
<script>window.__proofEngine = ${JSON.stringify(engine)};</script>
<script type="module" src="/__proof-bundle.js"></script>
</body>
</html>
`;

/** One origin per engine: the engine survives the History engine's full reloads. */
async function startServer(engine) {
  const html = documentHtml(engine);
  const server = createServer((request, response) => {
    const pathname = request.url.split('?')[0];
    if (pathname === '/__proof-bundle.js') {
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      response.end(bundle);
      return;
    }
    if (pathname === '/favicon.ico') {
      response.writeHead(404, { 'cache-control': 'no-store' });
      response.end();
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

const snapshot = (page) => page.evaluate(() => window.__routerProof.snapshot());

/** Wait for a page-side predicate, failing with the measured snapshot on timeout. */
async function waitFor(page, predicate, arg, label) {
  try {
    await page.waitForFunction(predicate, arg, { timeout: 5000, polling: 25 });
  } catch {
    let measured;
    try {
      measured = await snapshot(page);
    } catch (error) {
      measured = { snapshotUnavailable: String(error) };
    }
    assert.fail(`${label}: timed out — measured ${JSON.stringify(measured)}`);
  }
}

/** Settled router state: location, router signals and the rendered route agree. */
const waitRouter = (page, pathname, hash, label) => waitFor(
  page,
  (want) => {
    const proof = window.__routerProof;
    if (proof?.ready !== true) return false;
    const s = proof.snapshot();
    return s.pathname === want.pathname
      && s.routerPathname === want.pathname
      && s.routerHash === want.hash
      && s.pending === false;
  },
  { pathname, hash },
  label,
);

async function waitScroll(page, expected, label) {
  await waitFor(
    page,
    (want) => Math.abs(window.scrollY - want.expected) <= want.tolerance,
    { expected, tolerance: SCROLL_TOLERANCE },
    `${label} (wanted scrollY ≈ ${expected})`,
  );
  return page.evaluate(() => Math.round(window.scrollY));
}

/** The fragment target sitting flush with the top of the viewport. */
async function waitAnchorAtTop(page, label) {
  await waitFor(
    page,
    (tolerance) => {
      const el = document.getElementById('anchor');
      return el !== null && Math.abs(el.getBoundingClientRect().top) <= tolerance;
    },
    SCROLL_TOLERANCE,
    label,
  );
  return snapshot(page).then((s) => ({ anchorTop: s.anchorTop, scrollY: s.scrollY }));
}

async function scrollTo(page, y, label) {
  await page.evaluate((target) => { window.scrollTo(0, target); }, y);
  const measured = await waitScroll(page, y, label);
  // Give the browser's per-entry scroll bookkeeping a task boundary to record
  // the offset before the navigation that must restore it.
  await page.waitForTimeout(50);
  return measured;
}

const traverse = (page, direction) => page.evaluate((d) => {
  // Raw history traversal, not router.back()/forward(): under the Navigation
  // engine this must still surface as an intercepted `traverse` navigate event.
  if (d === 'back') history.back(); else history.forward();
}, direction);

async function runProof(page, base, requested, label) {
  const measured = {};

  // ── P0 · initial load ────────────────────────────────────────────────
  await page.goto(`${base}/`, { waitUntil: 'load' });
  await waitFor(page, () => window.__routerProof?.ready === true, null, `${label}: fixture never became ready`);
  await waitRouter(page, '/', '', `${label}: initial transition`);
  const initial = await snapshot(page);

  const effective = requested === 'history'
    ? 'history'
    : initial.hasNavigationApi ? 'navigation' : 'history';
  measured.engine = effective;
  measured.hasNavigationApi = initial.hasNavigationApi;

  if (requested === 'navigation' && !initial.hasNavigationApi) {
    // The fallback IS the assertion here: `createEngine('navigation')` still
    // returns a HistoryEngine when the platform has no `navigation`
    // (packages/router/src/router.ts:32-35), so the page stays routed.
    assert.equal(
      initial.scrollRestoration,
      'manual',
      `${label}: engine:'navigation' without window.navigation must fall back to HistoryEngine (manual scrollRestoration)`,
    );
  }
  if (effective === 'history') {
    assert.equal(initial.scrollRestoration, 'manual', `${label}: HistoryEngine must claim manual scroll restoration`);
    assert.deepEqual(
      initial.historyStateKeys,
      ['__nisli_router', 'state'],
      `${label}: HistoryEngine must stamp its per-entry key into history.state`,
    );
  } else {
    assert.equal(
      initial.scrollRestoration,
      'auto',
      `${label}: NavigationApiEngine must leave scroll restoration to the browser`,
    );
    assert.equal(
      initial.historyStateKeys,
      null,
      `${label}: NavigationApiEngine must not wrap history.state`,
    );
  }
  assert.equal(initial.routeName, 'home', `${label}: initial route`);
  assert.equal(initial.routeMarker, 'home', `${label}: initial rendered route`);
  assert.equal(initial.title, 'proof / home', `${label}: initial document title`);
  assert.equal(initial.scrollY, 0, `${label}: initial scroll offset`);
  assert.equal(initial.error, null, `${label}: initial transition error`);

  // ── P1 · push scrolls to top and focuses the outlet host ─────────────
  measured.pushFromOffset = await scrollTo(page, HOME_OFFSET, `${label}: park home at ${HOME_OFFSET}`);
  await page.click('#to-second');
  await waitRouter(page, '/second', '', `${label}: push to /second`);
  measured.pushScrollY = await waitScroll(page, 0, `${label}: push must land at scroll top`);
  const afterPush = await snapshot(page);
  measured.pushFocus = afterPush.activeIsOutlet ? 'outlet' : `${afterPush.activeTag}#${afterPush.activeId}`;
  assert.equal(afterPush.routeName, 'second', `${label}: push route signal`);
  assert.equal(afterPush.routeMarker, 'second', `${label}: push rendered route`);
  assert.equal(afterPush.title, 'proof / second', `${label}: push document title`);
  const outletProbe = await page.evaluate(() => window.__routerProof.probeOutletFocus());
  measured.outletFocusable = outletProbe.focused;
  measured.outletDisplay = outletProbe.display;
  // The first run of this proof found this unreachable: the outlet host was
  // `display: contents`, and a box-less element cannot hold focus, so the
  // documented a11y focus reset was a silent no-op in all three engines while
  // happy-dom — which has no layout — reported it working.
  assert.notEqual(
    outletProbe.display,
    'contents',
    `${label}: the outlet host must generate a box to be focusable and to be a valid skip-link target`,
  );
  assert.equal(outletProbe.focused, true, `${label}: direct focus() on the outlet host must take`);
  assert.equal(
    afterPush.activeIsOutlet,
    true,
    `${label}: a push must move focus to the outlet host, measured <${afterPush.activeTag} id="${afterPush.activeId}">`,
  );

  // ── P2 · traversal scroll restoration (the property that moved from
  //         nisli's scrollPositions map to the browser) ────────────────
  // Stack: [ / @900, /second @400, / @0 ] with the last one current.
  measured.secondFromOffset = await scrollTo(page, SECOND_OFFSET, `${label}: park /second at ${SECOND_OFFSET}`);
  await page.click('#to-home');
  await waitRouter(page, '/', '', `${label}: push back to /`);
  assert.equal((await snapshot(page)).scrollY, 0, `${label}: second push must land at scroll top`);

  await traverse(page, 'back');
  await waitRouter(page, '/second', '', `${label}: back to /second`);
  measured.backScrollY = await waitScroll(page, SECOND_OFFSET, `${label}: back must restore the /second offset`);

  await traverse(page, 'back');
  await waitRouter(page, '/', '', `${label}: back to /`);
  measured.backBackScrollY = await waitScroll(page, HOME_OFFSET, `${label}: back must restore the / offset`);

  await traverse(page, 'forward');
  await waitRouter(page, '/second', '', `${label}: forward to /second`);
  measured.forwardScrollY = await waitScroll(page, SECOND_OFFSET, `${label}: forward must re-restore the /second offset`);

  // ── P3 · cross-page #hash link, and traversal across it ──────────────
  await page.click('#to-home');
  await waitRouter(page, '/', '', `${label}: reset to / before the hash leg`);
  await waitScroll(page, 0, `${label}: reset to / lands at top`);

  await page.click('#to-second-hash');
  await waitRouter(page, '/second', '#anchor', `${label}: push to /second#anchor`);
  const hashLanding = await waitAnchorAtTop(page, `${label}: cross-page #hash must scroll the anchor into view after the async render`);
  measured.hashScrollY = hashLanding.scrollY;
  measured.hashAnchorTop = hashLanding.anchorTop;
  const afterHash = await snapshot(page);
  // Documented (packages/router/src/router.ts:365-366): a hash carries its own
  // destination, so the push→outlet focus effect is deliberately skipped.
  // Non-vacuous since the outlet became focusable: P1 above proves a push DOES
  // move focus there, so a hash push failing to is a real, distinguishable skip.
  assert.equal(
    afterHash.activeIsOutlet,
    false,
    `${label}: a hash push must NOT steal focus to the outlet, measured <${afterHash.activeTag} id="${afterHash.activeId}">`,
  );

  await traverse(page, 'back');
  await waitRouter(page, '/', '', `${label}: back across the hash entry`);
  measured.hashBackScrollY = await waitScroll(page, 0, `${label}: back across the hash entry restores / at top`);

  await traverse(page, 'forward');
  await waitRouter(page, '/second', '#anchor', `${label}: forward across the hash entry`);
  const hashForward = await waitAnchorAtTop(page, `${label}: forward across the hash entry re-lands on the fragment`);
  measured.hashForwardScrollY = hashForward.scrollY;

  // ── P4 · same-document fragment: the §6 "parity" the brief assumed ───
  await page.click('#to-home');
  await waitRouter(page, '/', '', `${label}: reset to / before the fragment leg`);
  await page.click('#to-second');
  await waitRouter(page, '/second', '', `${label}: push to /second before the fragment leg`);
  await waitScroll(page, 0, `${label}: /second at top before the fragment click`);

  await page.click('#to-anchor');
  await waitFor(page, () => location.hash === '#anchor', null, `${label}: same-document fragment must navigate natively`);
  const fragment = await waitAnchorAtTop(page, `${label}: native fragment jump`);
  measured.fragmentScrollY = fragment.scrollY;
  const afterFragment = await snapshot(page);
  measured.fragmentRouterHash = afterFragment.routerHash;
  assert.equal(afterFragment.routerPathname, '/second', `${label}: same-document fragment must not change the router path`);
  // Both engines must report the same thing, and this is the assertion that
  // locks it. A fragment link click fires, in order, `navigate(push,
  // hashChange:true)` → `popstate` → `hashchange` in all three browsers (the
  // post-2022 session-history spec: a fragment navigation is a same-document
  // navigation and so runs "apply the history step"). Both engines route it to
  // the same URL-only sync — `router.url` tracks the fragment, nothing
  // re-renders — so `isActive`/`aria-current` cannot depend on which engine
  // happens to be connected. This replaced the measured divergence the first
  // run of this proof found (History adopted it as kind:'traverse', Navigation
  // dropped it entirely).
  assert.equal(
    afterFragment.routerHash,
    '#anchor',
    `${label}: a same-document fragment must reach router.url on BOTH engines`,
  );

  await traverse(page, 'back');
  await waitRouter(page, '/second', '', `${label}: back across the native fragment entry`);
  measured.fragmentBackScrollY = (await snapshot(page)).scrollY;
  // Both engines: the fragment entry's predecessor was at the top, so back must
  // land at the top. The History engine reaches this by NOT remembering scroll
  // on the fragment path (its old spurious traverse overwrote the pre-fragment
  // offset while the page was still parked at the anchor — Chromium measured 0
  // there, Firefox and WebKit ~1736, from the same code).
  assert.equal(
    measured.fragmentBackScrollY,
    0,
    `${label}: back across a native fragment entry must restore the pre-fragment offset`,
  );

  await traverse(page, 'forward');
  await waitRouter(page, '/second', '#anchor', `${label}: forward across the native fragment entry`);
  const fragmentForward = await waitAnchorAtTop(page, `${label}: forward re-lands on the native fragment`);
  measured.fragmentForwardScrollY = fragmentForward.scrollY;
  // A traversal ACROSS a fragment entry IS intercepted/observed, unlike the
  // push that created it — navigation-engine.ts:240-244 documents the asymmetry.
  assert.equal(
    (await snapshot(page)).routerHash,
    '#anchor',
    `${label}: traversal onto a fragment entry must reach the router URL`,
  );

  // ── P5 · outlet focus from a nested element + state round-trip ───────
  const focused = await page.evaluate(() => window.__routerProof.focus('second-nested'));
  assert.equal(focused.activeId, 'second-nested', `${label}: nested focusable must accept focus`);

  const token = `state-${Math.random().toString(36).slice(2, 8)}`;
  await page.evaluate((value) => window.__routerProof.navigate('/', { state: { probe: value } }), token);
  await waitRouter(page, '/', '', `${label}: programmatic push to / with state`);
  const withState = await snapshot(page);
  measured.programmaticFocus = withState.activeIsOutlet
    ? 'outlet'
    : `${withState.activeTag}#${withState.activeId}`;
  // Isolated from any click-focus side effect: focus was provably on
  // #second-nested immediately before this programmatic push.
  assert.equal(
    withState.activeIsOutlet,
    true,
    `${label}: a programmatic push must move focus to the outlet, measured <${withState.activeTag} `
    + `id="${withState.activeId}">`,
  );
  assert.equal(withState.scrollY, 0, `${label}: programmatic push lands at scroll top`);
  assert.deepEqual(withState.state, { probe: token }, `${label}: router.state() after the push that set it`);

  await page.evaluate(() => window.__routerProof.navigate('/second'));
  await waitRouter(page, '/second', '', `${label}: push away from the stateful entry`);
  assert.equal((await snapshot(page)).state, null, `${label}: a push without state must not inherit the previous entry's state`);

  await traverse(page, 'back');
  await waitRouter(page, '/', '', `${label}: back onto the stateful entry`);
  const traversedState = (await snapshot(page)).state;
  measured.stateRoundTrip = traversedState;
  assert.deepEqual(
    traversedState,
    { probe: token },
    `${label}: router.state() must round-trip NavigateOptions.state across a traversal`,
  );

  // ── P6 · `location.href =` document continuity ────────────────────────
  const beforeAssign = await snapshot(page);
  assert.equal(beforeAssign.pathname, '/', `${label}: location.href leg must start at /`);
  await page.evaluate(() => {
    window.__unloadProbe = 'alive';
    // Deferred so the evaluate() round-trip cannot be torn down mid-call by the
    // real document unload the History engine produces here.
    setTimeout(() => { window.location.href = '/second'; }, 0);
  });
  await waitRouter(page, '/second', '', `${label}: location.href = '/second' must settle at /second`);
  const afterAssign = await snapshot(page);
  measured.locationHrefSameDocument = afterAssign.docId === beforeAssign.docId;
  measured.locationHrefUnloadProbe = afterAssign.unloadProbe;

  if (effective === 'navigation') {
    assert.equal(
      afterAssign.unloadProbe,
      'alive',
      `${label}: location.href = must be intercepted into a same-document transition (window stamp survived?)`,
    );
    assert.equal(afterAssign.docId, beforeAssign.docId, `${label}: location.href = must not unload the document`);
  } else {
    assert.equal(
      afterAssign.unloadProbe,
      null,
      `${label}: HistoryEngine cannot intercept location.href =, so the window stamp must be gone`,
    );
    assert.notEqual(afterAssign.docId, beforeAssign.docId, `${label}: HistoryEngine must produce a full document load`);
    assert.equal(
      afterAssign.scrollRestoration,
      'manual',
      `${label}: the reloaded document must reconnect the HistoryEngine`,
    );
  }
  assert.equal(afterAssign.routeName, 'second', `${label}: route signal after location.href =`);
  assert.equal(afterAssign.routeMarker, 'second', `${label}: rendered route after location.href =`);
  assert.equal(afterAssign.error, null, `${label}: no transition error across the whole run`);

  return { measured };
}

const servers = new Map();
for (const engine of ['history', 'navigation']) servers.set(engine, await startServer(engine));

// ── non-vacuity self-test ────────────────────────────────────────────
// The Navigation engine's whole bet is `ownsScrollRestoration = false`: the
// router applies NO scroll effects and trusts the browser. A proof of that must
// be able to detect the browser not delivering, so `--self-test-vacuity` runs
// the exact counterfactual: patch `NavigateEvent.prototype.intercept`
// page-side to force `scroll: 'manual'`, i.e. the browser stops restoring while
// the router still applies nothing, and REQUIRE the run to fail. If it passes,
// the traversal-scroll assertions are measuring nothing.
//
// (Measured, and the reason this is the right lever: setting
// `history.scrollRestoration = 'manual'` does NOT suppress the Navigation
// engine's restoration — `intercept({ scroll: 'after-transition' })` restores
// unconditionally. Only the intercept option decides.)
//
//   node scripts/router-navigation-proof.mjs --self-test-vacuity
if (process.argv.includes('--self-test-vacuity')) {
  const browser = await chromium.launch();
  let caught = null;
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
    await page.addInitScript(() => {
      const original = NavigateEvent.prototype.intercept;
      NavigateEvent.prototype.intercept = function intercept(options) {
        return original.call(this, { ...options, scroll: 'manual' });
      };
    });
    await runProof(page, servers.get('navigation').base, 'navigation', 'self-test/engine:navigation');
  } catch (error) {
    caught = error;
  } finally {
    await browser.close();
    for (const { server } of servers.values()) await new Promise((resolve) => server.close(resolve));
  }
  assert.ok(
    caught,
    'self-test: the proof PASSED with intercept scroll forced to manual — its traversal assertions are vacuous',
  );
  console.log(`self-test: PASS — a browser that stops restoring scroll is caught: ${caught.message.split('\n')[0]}`);
  process.exit(0);
}

const failures = [];
try {
  for (const [browserName, browserType] of [
    ['chromium', chromium],
    ['firefox', firefox],
    ['webkit', webkit],
  ]) {
    // Every Playwright 1.61.1 engine — including WebKit — ships the Navigation
    // API, so the third variant is the only way to exercise the fallback that
    // pre-147 Firefox ESR / Safari ≤ 26.1 users still hit: shadow
    // `globalThis.navigation` (what navigation-engine.ts:92 reads) with
    // `undefined` before the fixture module evaluates, then demand that
    // `engine:'navigation'` still routes the page through the History engine.
    for (const { requested, suppressNavigationApi } of [
      { requested: 'history', suppressNavigationApi: false },
      { requested: 'navigation', suppressNavigationApi: false },
      { requested: 'navigation', suppressNavigationApi: true },
    ]) {
      const label = `${browserName}/engine:${requested}${suppressNavigationApi ? '/no-navigation-api' : ''}`;
      let browser;
      try {
        browser = await browserType.launch();
        const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
        if (suppressNavigationApi) {
          await page.addInitScript(() => {
            Object.defineProperty(globalThis, 'navigation', {
              value: undefined,
              configurable: true,
              writable: true,
            });
          });
        }
        const consoleErrors = [];
        page.on('console', (message) => {
          if (message.type() === 'error') consoleErrors.push(message.text());
        });
        page.on('pageerror', (error) => consoleErrors.push(String(error)));
        const { measured } = await runProof(page, servers.get(requested).base, requested, label);
        assert.deepEqual(consoleErrors, [], `${label}: page errors leaked to the console`);
        if (suppressNavigationApi) {
          assert.equal(measured.hasNavigationApi, false, `${label}: the Navigation API must be hidden for this variant`);
          assert.equal(measured.engine, 'history', `${label}: engine:'navigation' must fall back to the History engine`);
        }

        console.log(`${label} → ${measured.engine}: PASS ${JSON.stringify(measured)}`);
      } catch (error) {
        failures.push(new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`));
      } finally {
        await browser?.close();
      }
    }
  }
} finally {
  for (const { server } of servers.values()) await new Promise((resolve) => server.close(resolve));
}

if (failures.length) throw new AggregateError(failures, 'router navigation browser proof failed');
