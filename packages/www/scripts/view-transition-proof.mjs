/**
 * Real-browser proof for BET04's two view-transition lanes as this site
 * consumes them. Neither lane is observable under happy-dom: there is no
 * `document.startViewTransition`, no `:active-view-transition-type()`, no
 * `view-transition-name`, and no cross-document `pagereveal`.
 *
 *   pnpm --filter @nisli/www proof:view-transitions
 *
 * Requires a built dist/ (`pnpm run render`, the Tailwind CLI, and
 * `pnpm run build:hydrate`) for the static half.
 *
 * SPA lane — the real AppRouter (`viewTransitions: { enabled: true, types:
 * navTypes }`) is bundled in memory from scripts/view-transition-proof-fixture.js
 * and served as a single-document SPA against dist/assets/site.css, the
 * stylesheet the Tailwind CLI actually ships. Asserted:
 *   1. An in-app navigation calls `startViewTransition({ types })`, and the
 *      root pseudo-elements animate this site's direction keyframes.
 *   2. The docs-order override: clicking BACK up the sidebar is a history push
 *      (`direction: 'forward'`) yet types as `back`, because app-router.ts
 *      derives the reader's direction from DOC_SECTIONS order.
 *   3. The each() recipe: a sort lifts every row into its own snapshot group
 *      (`view-transition-name: match-element` on the painted <li>, scoped to the
 *      `reorder` type) and the group animation carries the recipe's duration.
 *   4. Under `prefers-reduced-motion: reduce` the transition STILL runs, the
 *      list has already swapped when it starts, and no animation exists.
 *
 * Static lane — dist/ is served as it deploys. Asserted:
 *
 *   5. Every built page's head carries `@view-transition { navigation: auto }`
 *      plus the speculation rules.
 *   6. A real click between two built pages produces a cross-document
 *      transition (the outgoing `pageswap` carries a `viewTransition`).
 *   7. The demo's production path — replace-mount hydration — reorders with the
 *      same per-row snapshots as the SPA lane.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build } from 'vite';

const wwwDir = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(wwwDir, 'dist');
for (const required of ['docs/view-transitions/index.html', 'assets/site.css', 'ui-preview/hydrate.js']) {
  if (!existsSync(join(dist, required))) {
    throw new Error(`missing dist/${required} — run \`pnpm run render\`, the Tailwind CLI, and \`pnpm run build:hydrate\` first`);
  }
}

/** Recorded from inside the page: every transition, its types, and what animated. */
function instrument() {
  window.__vt = { calls: [], swap: null, reveal: null };
  const previousSwap = sessionStorage.getItem('__vtSwap');
  if (previousSwap) {
    window.__vt.swap = JSON.parse(previousSwap);
    sessionStorage.removeItem('__vtSwap');
  }
  // Cross-document: the outgoing document sees `pageswap`, the incoming one
  // `pagereveal`, and each carries a ViewTransition only if the transition ran.
  addEventListener('pageswap', (event) => {
    sessionStorage.setItem('__vtSwap', JSON.stringify({ hasTransition: Boolean(event.viewTransition) }));
  });
  addEventListener('pagereveal', (event) => {
    window.__vt.reveal = { hasTransition: Boolean(event.viewTransition) };
  });

  const start = document.startViewTransition?.bind(document);
  if (!start) return;
  document.startViewTransition = (argument) => {
    const types = argument && typeof argument === 'object' && argument.types ? [...argument.types] : [];
    const transition = start(argument);
    const record = { types, matched: [], animations: [], order: [] };
    window.__vt.calls.push(record);
    transition.ready.then(
      () => {
        // `ready` resolves once the pseudo-element tree exists and the update
        // has been applied — so this samples the animations that will play AND
        // the already-swapped DOM.
        record.matched = ['forward', 'back', 'reorder'].filter((type) =>
          document.documentElement.matches(`:active-view-transition-type(${type})`),
        );
        record.animations = document
          .getAnimations()
          .filter((animation) => String(animation.effect?.pseudoElement ?? '').startsWith('::view-transition'))
          .map((animation) => ({
            pseudo: animation.effect.pseudoElement,
            name: animation.animationName ?? null,
            duration: animation.effect.getComputedTiming().duration,
          }));
        record.order = [...document.querySelectorAll('[data-vt-list-item] .font-mono')].map((node) =>
          node.textContent.trim(),
        );
      },
      () => { record.skipped = true; },
    );
    return transition;
  };
}

// The root's `::view-transition-group(root)` carries the UA's own
// `-ua-view-transition-group-anim-root`; the author-supplied direction
// keyframes land on the old/new image pair.
const rootAnimations = (record) =>
  record.animations.filter((a) => /^::view-transition-(old|new)\(root\)/.test(a.pseudo));

/**
 * `pseudo | animation-name | duration` → count. This is the whole shape of the
 * pseudo-element tree the browser built, and it is what the list assertions read.
 *
 * Two details it makes visible. `view-transition-name: match-element` serialises
 * in `pseudoElement` as the literal `match-element` for every row, so rows are
 * NOT distinguishable by pseudo — the identity is in the generated animation
 * name (`-ua-view-transition-group-anim--ua-auto-<hash>-<n>`), and counting
 * those distinct names is what counts the rows. And each snapshot image carries
 * two animations (a crossfade plus the plus-lighter blend), so image counts come
 * from the crossfade rows of the histogram alone.
 *
 * The UA animation names are implementation detail. That is deliberate: if a
 * future engine renames them the assertion fails loudly with this histogram
 * printed, which is the outcome you want from a proof.
 */
function histogram(record) {
  const counts = {};
  for (const a of record.animations) {
    const key = `${a.pseudo} | ${a.name} | ${a.duration}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

const rowGroupNames = (record) => [...new Set(record.animations
  .filter((a) => a.pseudo === '::view-transition-group(match-element)')
  .map((a) => a.name))];

/** Resolves once the page has recorded `count` transitions and sampled the last. */
const settled = (page, count) =>
  page.waitForFunction(
    (expected) => window.__vt.calls.length >= expected
      && (window.__vt.calls[expected - 1].matched.length > 0 || window.__vt.calls[expected - 1].skipped),
    count,
    { timeout: 5000 },
  );
const calls = (page) => page.evaluate(() => window.__vt.calls);

// ── SPA lane server: the real AppRouter, bundled in memory ─────────────────
const bundled = await build({
  configFile: false,
  logLevel: 'silent',
  root: wwwDir,
  build: {
    write: false,
    target: 'es2022',
    rollupOptions: {
      input: join(wwwDir, 'scripts', 'view-transition-proof-fixture.js'),
      output: { format: 'es', inlineDynamicImports: true },
    },
  },
});
const script = bundled.output.find((item) => item.type === 'chunk')?.code;
assert.ok(script, 'vite produced no SPA proof bundle');
const style = await readFile(join(dist, 'assets', 'site.css'), 'utf8');

const spaDocument = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>view transition proof</title>
<link rel="stylesheet" href="/__proof/app.css"></head>
<body class="bg-background text-foreground antialiased">
<div id="app"></div>
<script type="module" src="/__proof/app.js"></script>
</body>
</html>
`;

const spaServer = createServer((request, response) => {
  const pathname = request.url.split('?')[0];
  const send = (type, body) => {
    response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    response.end(body);
  };
  if (pathname === '/__proof/app.js') return send('text/javascript; charset=utf-8', script);
  if (pathname === '/__proof/app.css') return send('text/css; charset=utf-8', style);
  return send('text/html; charset=utf-8', spaDocument);
});

// ── Static lane server: dist/ exactly as it deploys ─────────────────────────
const MIME = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const distServer = createServer(async (request, response) => {
  const pathname = decodeURIComponent(request.url.split('?')[0]);
  let file = join(dist, pathname);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(dist, pathname, 'index.html');
  }
  if (!existsSync(file)) {
    response.writeHead(404);
    response.end('not found');
    return;
  }
  response.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  response.end(await readFile(file));
});

await new Promise((resolve) => spaServer.listen(0, resolve));
await new Promise((resolve) => distServer.listen(0, resolve));
const spaBase = `http://127.0.0.1:${spaServer.address().port}`;
const distBase = `http://127.0.0.1:${distServer.address().port}`;

const observed = {};
let browser;
try {
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(instrument);
  const page = await context.newPage();

  // ── 1 + 2. In-app navigation, and the docs-order direction override ───────
  await page.goto(`${spaBase}/docs/signals`, { waitUntil: 'load' });
  // [data-sidebar="menu-button"] is the desktop sidebar's own anchor; the mobile
  // drawer renders a second link to the same href.
  const sidebar = (href) => page.locator(`a[data-sidebar="menu-button"][href="${href}"]`);
  await sidebar('/docs/templates').click();
  await settled(page, 1);
  await sidebar('/docs/signals').click();
  await settled(page, 2);
  const [down, up] = await calls(page);

  observed.navForward = { types: down.types, matched: down.matched, root: rootAnimations(down) };
  observed.navBack = { types: up.types, matched: up.matched, root: rootAnimations(up) };
  assert.deepEqual(down.types, ['forward'], 'signals -> templates should type as forward');
  assert.deepEqual(down.matched, ['forward'], ':active-view-transition-type(forward) should match');
  assert.deepEqual(
    rootAnimations(down).map((a) => a.name).sort(),
    ['nisli-vt-enter-right', 'nisli-vt-exit-left'],
    'forward should animate the site direction keyframes on the root pseudos',
  );
  // The override: history says forward (this is a push), docs order says back.
  assert.deepEqual(up.types, ['back'], 'templates -> signals should type as back despite being a history push');
  assert.deepEqual(
    rootAnimations(up).map((a) => a.name).sort(),
    ['nisli-vt-enter-left', 'nisli-vt-exit-right'],
    'back should animate the mirrored keyframes',
  );

  // ── 3. The each() list recipe ─────────────────────────────────────────────
  await sidebar('/docs/view-transitions').click();
  await settled(page, 3);
  const demo = page.locator('[data-vt-list-demo]');
  const before = await demo.locator('[data-vt-list-item] .font-mono').allTextContents();
  await demo.getByRole('button', { name: 'A–Z' }).click();
  await settled(page, 4);
  const reorder = (await calls(page))[3];

  const pseudoTree = histogram(reorder);
  observed.listReorder = {
    types: reorder.types,
    matched: reorder.matched,
    identityNamedRows: rowGroupNames(reorder).length,
    pseudoTree,
    orderBefore: before,
    orderAfter: reorder.order,
  };
  assert.deepEqual(reorder.types, ['reorder'], 'a sort should carry the reorder type');
  assert.deepEqual(reorder.matched, ['reorder'], ':active-view-transition-type(reorder) should match');
  assert.equal(rowGroupNames(reorder).length, before.length,
    'every row should get its own identity-generated name from match-element');
  for (const name of rowGroupNames(reorder)) {
    assert.match(name, /-ua-auto-/, 'row names should be UA-generated identities, not authored');
  }
  assert.equal(pseudoTree[`::view-transition-group(match-element) | ${rowGroupNames(reorder)[0]} | 300`], 1,
    'row groups should take the recipe duration');
  assert.equal(pseudoTree['::view-transition-old(match-element) | -ua-view-transition-fade-out | 160'], before.length,
    'the browser should hold an old image for every row, at the recipe duration');
  assert.equal(pseudoTree['::view-transition-new(match-element) | -ua-view-transition-fade-in | 160'], before.length,
    'and a new image for every row — both frames coexist while it plays');
  assert.notDeepEqual(reorder.order, before, 'the list should have reordered');
  assert.deepEqual(reorder.order, [...before].sort(), 'A–Z should sort the rows');

  // No screenshot is taken here. Both stills that could be captured lie: a
  // paused view transition stops the page producing frames, so CDP returns the
  // frame composited BEFORE the pause, and shooting while one is settling
  // captures the pseudo overlay mid-crossfade over stale content. The pseudo
  // tree above — nine identity-named groups, nine old images and nine new
  // images, at the authored durations — is the honest evidence.
  await page.close();

  // ── 4. Reduced motion: still a transition, no motion ─────────────────────
  const reduced = await context.newPage();
  await reduced.emulateMedia({ reducedMotion: 'reduce' });
  await reduced.goto(`${spaBase}/docs/view-transitions`, { waitUntil: 'load' });
  const reducedDemo = reduced.locator('[data-vt-list-demo]');
  const reducedBefore = await reducedDemo.locator('[data-vt-list-item] .font-mono').allTextContents();
  await reducedDemo.getByRole('button', { name: 'Z–A' }).click();
  await settled(reduced, 1);
  const [quiet] = await calls(reduced);

  observed.reducedMotion = {
    transitionRan: true,
    types: quiet.types,
    matched: quiet.matched,
    animations: quiet.animations.length,
    orderBefore: reducedBefore,
    orderAfter: quiet.order,
  };
  assert.deepEqual(quiet.types, ['reorder'], 'reduced motion must not skip the transition');
  assert.deepEqual(quiet.matched, ['reorder'], 'type-scoped styles must stay active under reduced motion');
  assert.equal(quiet.animations.length, 0, 'reduced motion must neutralise every ::view-transition animation');
  assert.deepEqual(quiet.order, [...reducedBefore].sort().reverse(),
    'the DOM must still have swapped atomically inside the transition');
  await reduced.close();

  // ── 5 + 6 + 7. The static lane, from dist/ ───────────────────────────────
  const staticPage = await context.newPage();
  await staticPage.goto(`${distBase}/docs`, { waitUntil: 'load' });
  observed.builtHead = await staticPage.evaluate(() => ({
    optIn: [...document.querySelectorAll('head style')].some((s) => s.textContent.includes('@view-transition')),
    speculationRules: document.querySelector('head script[type="speculationrules"]')?.textContent ?? null,
  }));
  assert.ok(observed.builtHead.optIn, 'a built page must carry the cross-document opt-in in its head');
  assert.match(observed.builtHead.speculationRules, /"prefetch"/, 'speculation rules should prefetch');
  assert.doesNotMatch(observed.builtHead.speculationRules, /"prerender"/,
    'this site declines prerendering (shell.ts explains why)');

  await staticPage.locator('a[data-sidebar="menu-button"][href="/docs/view-transitions"]').click();
  await staticPage.waitForURL(`${distBase}/docs/view-transitions`);
  // `pageswap.viewTransition` is the outgoing document's own answer: the object
  // exists only when the UA decided to run a cross-document transition, i.e.
  // only when BOTH documents carried the opt-in. It is stored through
  // sessionStorage because the observing document is the one being replaced.
  //
  // `pagereveal` on the incoming side is reported, not asserted: it fires before
  // an injected document-start listener exists, so a null here is a probe
  // artefact rather than a missing transition.
  await staticPage.waitForFunction(() => window.__vt?.swap !== null, null, { timeout: 5000 });
  observed.crossDocument = await staticPage.evaluate(() => ({ swap: window.__vt.swap, reveal: window.__vt.reveal }));
  assert.equal(observed.crossDocument.swap?.hasTransition, true,
    'a click between two built pages must produce a cross-document view transition');

  // A separate page for the hydration check, reached by `goto` rather than a
  // click. This is not tidiness: in Playwright's Chromium 149 the document that
  // a cross-document view transition navigates INTO never produces a rendering
  // frame — `requestAnimationFrame` never fires, `document.timeline.currentTime`
  // stays 0, and any action needing element stability (or a screenshot) hangs.
  // It reproduces with a two-page fixture carrying nothing but
  // `@view-transition { navigation: auto }`, so it is an automation-environment
  // artefact, not a site or framework defect — and the `pageswap` assertion
  // above is exactly the evidence that survives it. Scripts that drive this
  // site's built pages should navigate with `goto`, not by clicking links.
  await staticPage.close();
  const hydrated = await context.newPage();
  await hydrated.goto(`${distBase}/docs/view-transitions`, { waitUntil: 'load' });
  // The frame hydrates unconditionally at module scope (no IntersectionObserver
  // gate), so waiting for the runtime is enough — no scrolling required.
  const staticDemo = hydrated.locator('[data-hydrate="list-transition"]');
  await hydrated.waitForFunction(
    () => document.querySelector('[data-hydrate="list-transition"]')?.hasAttribute('data-hydrated'),
    null,
    { timeout: 10_000 },
  );
  const staticBefore = await staticDemo.locator('[data-vt-list-item] .font-mono').allTextContents();
  await staticDemo.getByRole('button', { name: 'A–Z' }).click();
  await settled(hydrated, 1);
  const [staticReorder] = await calls(hydrated);

  observed.hydratedReorder = {
    types: staticReorder.types,
    identityNamedRows: rowGroupNames(staticReorder).length,
    orderBefore: staticBefore,
    orderAfter: staticReorder.order,
  };
  assert.deepEqual(staticReorder.types, ['reorder'], 'the hydrated demo should carry the reorder type');
  assert.equal(rowGroupNames(staticReorder).length, staticBefore.length,
    'the hydrated demo should snapshot every row');
  assert.deepEqual(staticReorder.order, [...staticBefore].sort(), 'the hydrated demo should sort');

  console.log(JSON.stringify(observed, null, 2));
  console.log('\nview transitions proof: PASS');
} finally {
  await browser?.close();
  spaServer.close();
  distServer.close();
}
