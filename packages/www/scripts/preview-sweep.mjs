/**
 * preview-sweep.mjs — real-browser verification of every /ui/<name> preview.
 *
 * Drives headless chromium over all component pages and asserts each
 * data-preview frame contains an UPGRADED, visibly-rendered <ui-*> element;
 * for hydrate-set items it also asserts the trigger OPENS an overlay. Captures
 * per-page console/page errors and emits a failing list (exit 1 if any fail).
 *
 * Build once, use thrice (WS1):
 *   node scripts/preview-sweep.mjs                 # serves local dist/, verifies the prod build
 *   node scripts/preview-sweep.mjs --base=https://nisli.dev   # verifies the live deploy
 *
 * Seed of the permanent post-hydration guard (ADR 0024). The component list is
 * read from the built dist/ui/ tree so it stays correct-by-construction.
 *
 * COLD-EDGE NOTE (do not "fix" this): the FIRST sweep run immediately after a
 * deploy may fail a page whose brand-new code-split chunk is still propagating
 * to the CDN edge (observed once on alert-dialog, WS1). This is a real signal —
 * the guard catching a cold edge — not a false positive. Settle ~30s and
 * re-sweep before treating a lone post-deploy failure as a regression.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, '..', 'dist');

// hydrate-set = the curated interactive examples (glob source of truth in
// src/hydrate-set.ts); mirrored here so the sweep can run standalone.
const hydrateFiles = await readdir(join(HERE, '..', 'src', 'hydrate-examples')).catch(() => []);
const HYDRATE = new Set(hydrateFiles.filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\.ts$/, '')));

const arg = process.argv.find((a) => a.startsWith('--base='));
let base = arg ? arg.slice('--base='.length).replace(/\/$/, '') : null;

// enumerate /ui/<name> pages from the built tree (canonical component list)
const uiDir = join(DIST, 'ui');
const entries = await readdir(uiDir, { withFileTypes: true }).catch(() => { throw new Error(`no dist at ${uiDir} — run pnpm build first`); });
const names = [];
for (const e of entries) {
  if (e.isDirectory() && existsSync(join(uiDir, e.name, 'index.html'))) names.push(e.name);
}
names.sort();

// serve local dist/ when no --base was given
let server;
if (!base) {
  const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  server = createServer(async (req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    let fp = join(DIST, p);
    try { if ((await stat(fp)).isDirectory()) fp = join(fp, 'index.html'); } catch { fp = join(DIST, p, 'index.html'); }
    if (!existsSync(fp)) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'content-type': MIME[extname(fp)] || 'application/octet-stream' });
    res.end(await readFile(fp));
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
}

console.log(`sweeping ${names.length} /ui pages against ${base}\n`);
const browser = await chromium.launch();
const results = [];
for (const name of names) {
  const page = await browser.newPage();
  const errors = [];
  const artifacts = []; // full diagnostic record per console/page error (UI-47 addendum)
  const assetFails = []; // req 1: any preview asset (script/style/font/chunk) that fails
  let phase = 'load'; // timing marker: load -> hydrate -> open (which step threw)
  page.on('pageerror', (e) => {
    errors.push(String(e).split('\n')[0]);
    artifacts.push({ kind: 'pageerror', phase, url: page.url(), text: String(e).split('\n')[0], stack: e.stack });
  });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    errors.push(`console: ${m.text().slice(0, 80)}`);
    // Capture the FULL stack + URL + timing so an intermittent (e.g. the UI-47
    // combobox ghost) is diagnostic on FIRST recurrence, not lost to truncation.
    const loc = m.location();
    Promise.all(m.args().map((a) => a.evaluate((x) => (x && x.stack) ? x.stack : String(x)).catch(() => null)))
      .then((stacks) => artifacts.push({ kind: 'console', phase, url: page.url(), text: m.text(), loc, stacks: stacks.filter(Boolean) }))
      .catch(() => {});
  });
  // Track EVERY failed sub-resource, not just /ui-preview/* — the RC4 regression
  // requested chunks at /chunks/* (no /ui-preview/ prefix), so a prefix filter
  // would miss the exact bug this guard exists to catch. Scope to script/style/
  // font/chunk requests so an unrelated favicon miss doesn't red the page.
  const isPreviewAsset = (req) =>
    ['script', 'stylesheet', 'font'].includes(req.resourceType()) ||
    /\/(chunks|ui-preview|assets)\//.test(req.url());
  const noteFail = (req, why) => { if (isPreviewAsset(req)) assetFails.push(`${why} ${new URL(req.url()).pathname}`); };
  page.on('response', (r) => { if (r.status() >= 400) noteFail(r.request(), `HTTP${r.status()}`); });
  page.on('requestfailed', (r) => noteFail(r, 'REQFAIL'));
  let upgrade = 'NO-FRAME', open = 'n/a', hydrated = 'n/a';
  try {
    await page.goto(`${base}/ui/${name}`, { waitUntil: 'networkidle', timeout: 20000 });
    phase = 'hydrate';
    // scroll the preview into view so the IntersectionObserver hydration fires
    await page.locator(`[data-preview="${name}"]`).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);
    const frame = page.locator(`[data-preview="${name}"]`);
    if (!(await frame.count())) {
      // ui-component pages render data-preview only for type=ui; a lib primitive
      // page legitimately has no preview frame. Cross-check the page's own type
      // badge so a ui component that FAILED to emit its frame is caught, not
      // silently skipped as if it were a primitive.
      const isPrimitive = await page.getByText('Primitive', { exact: true }).count() > 0;
      upgrade = isPrimitive ? 'SKIP-primitive' : 'NO-FRAME(ui!)';
    } else {
      const info = await frame.first().evaluate((el) => {
        const uiEl = [...el.querySelectorAll('*')].find((n) => n.tagName.toLowerCase().startsWith('ui-'));
        // ui-* hosts are display:contents (transparentHost) so their own box is
        // 0×0 by design — measure whether ANY descendant actually painted a box.
        const painted = [...el.querySelectorAll('*')].some((n) => {
          const r = n.getBoundingClientRect();
          return r.height > 1 && r.width > 1;
        });
        return { hasUi: !!uiEl, painted, text: el.textContent.trim().length };
      });
      upgrade = info.hasUi && info.painted ? 'OK' : `WEAK ${JSON.stringify(info)}`;
    }
    if (HYDRATE.has(name)) {
      open = 'FAIL';
      phase = 'open';
      // Count OPEN OVERLAY CONTENT only — an element whose data-slot ends in
      // "-content" (never a "-trigger", so a trigger's state change can't count)
      // AND whose data-state is "open" (the content's own open assertion, set by
      // every overlay family — dialog/sheet/drawer/popover/menu/tooltip/hover-
      // card content; layout slots like sidebar-content have no data-state=open,
      // so they're excluded for free) AND that actually RENDERS a painted box.
      // The painted-box requirement rejects a mounted-but-"open"-yet-hidden
      // content (rev's present-but-hidden false open) while tolerating the
      // display:contents content HOSTS (e.g. sheet) whose child panel paints.
      const openOverlayCount = () =>
        page.evaluate(() =>
          [...document.querySelectorAll('[data-slot$="-content"][data-state="open"]')].filter((el) =>
            [el, ...el.querySelectorAll('*')].some((n) => {
              const r = n.getBoundingClientRect();
              return r.width > 1 && r.height > 1 && getComputedStyle(n).visibility !== 'hidden';
            }),
          ).length,
        );
      try {
        const trigger = frame.locator('button, [data-slot*="trigger"], [aria-haspopup]').first();
        const before = await openOverlayCount();
        // interaction model differs per family: context-menu opens on right-click,
        // tooltip/hover-card on hover (with open-delay), the rest on click.
        if (name === 'context-menu') await trigger.click({ button: 'right', timeout: 3000 });
        else if (name === 'tooltip' || name === 'hover-card') { await trigger.hover({ timeout: 3000 }); await page.waitForTimeout(900); }
        else await trigger.click({ timeout: 3000 });
        await page.waitForTimeout(500);
        const after = await openOverlayCount();
        open = after > before ? 'OK' : `FAIL(${before}->${after})`;
      } catch (e) { open = `ERR ${String(e.message).slice(0, 36)}`; }
      // req 2: the success marker must be set — a silent chunk failure leaves it off
      hydrated = (await page.locator(`[data-preview="${name}"]`).first().getAttribute('data-hydrated')) ? 'OK' : 'MISSING';
    }
  } catch (e) {
    upgrade = `LOAD-ERR ${String(e.message).slice(0, 40)}`;
  }
  await page.waitForTimeout(50); // let any pending console-arg evaluations resolve
  results.push({ name, upgrade, open, hydrated, assetFails: assetFails.slice(0, 3), err: errors[0] || '', artifacts });
  await page.close();
}

// WWW-13: the DocsLayout mobile drawer must OPEN on a narrow viewport. The
// desktop sidebar works with zero JS (real anchors), but the mobile off-canvas
// drawer is a portaled Sheet (client-only, ADR 0025 item-6) that only works if
// the page injects the runtime AND the sidebar chrome registers. Drive it for
// real: 390px, click the SidebarTrigger, require a VISIBLE open sheet-content
// plus the sidebar in data-mobile mode.
{
  const mpage = await browser.newPage({ viewport: { width: 390, height: 800 } });
  const mErrors = [];
  mpage.on('pageerror', (e) => mErrors.push(String(e).split('\n')[0]));
  let open = 'FAIL';
  try {
    await mpage.goto(`${base}/docs`, { waitUntil: 'networkidle', timeout: 20000 });
    await mpage.waitForTimeout(400);
    await mpage.locator('[data-slot="sidebar-trigger"]').first().click({ timeout: 3000 });
    await mpage.waitForTimeout(600);
    const opened = await mpage.evaluate(() => {
      const sheet = [...document.querySelectorAll('[data-slot="sheet-content"][data-state="open"]')]
        .some((e) => e.getBoundingClientRect().width > 1);
      const mobile = !!document.querySelector('[data-slot="sidebar"][data-mobile="true"]');
      return { sheet, mobile };
    });
    open = opened.sheet && opened.mobile ? 'OK' : `FAIL(sheet=${opened.sheet},mobile=${opened.mobile})`;
  } catch (e) {
    open = `ERR ${String(e.message).slice(0, 36)}`;
  }
  results.push({ name: 'mobile-drawer', upgrade: 'OK', open, hydrated: 'n/a', assetFails: [], err: mErrors[0] || '', artifacts: [] });
  await mpage.close();
}

await browser.close();
server?.close();

const bad = (r) =>
  (!r.upgrade.startsWith('OK') && !r.upgrade.startsWith('SKIP')) ||
  (r.open !== 'n/a' && !r.open.startsWith('OK')) ||
  (r.hydrated === 'MISSING') ||           // req 2: hydration success marker absent
  (r.assetFails && r.assetFails.length);  // req 1: a /ui-preview/* asset failed
for (const r of results) {
  const af = r.assetFails?.length ? ` asset-fails=[${r.assetFails.join(', ')}]` : '';
  console.log(`${r.name.padEnd(18)} upgrade=${r.upgrade.slice(0, 40).padEnd(42)} open=${r.open.padEnd(12)} hydrated=${String(r.hydrated).padEnd(8)}${af} ${r.err}${bad(r) ? '  <== FAIL' : ''}`);
}
const failing = results.filter(bad);
console.log(`\n${results.length - failing.length}/${results.length} pass. FAILING: ${failing.map((r) => r.name).join(', ') || '(none)'}`);

// Full diagnostic artifacts for any page that logged a console/page error —
// captured even when the page still PASSED, so an intermittent (e.g. the UI-47
// combobox ghost) is diagnosable on first recurrence rather than lost.
const withErrors = results.filter((r) => r.artifacts?.length);
if (withErrors.length) {
  console.log(`\n=== error artifacts (${withErrors.length} page(s) logged errors) ===`);
  for (const r of withErrors) {
    for (const a of r.artifacts) {
      console.log(`\n[${r.name}] ${a.kind} @phase=${a.phase} url=${a.url}`);
      console.log(`  text: ${a.text}`);
      if (a.loc?.url) console.log(`  loc:  ${a.loc.url}:${a.loc.lineNumber}:${a.loc.columnNumber}`);
      for (const s of a.stack ? [a.stack] : (a.stacks || [])) console.log(`  stack: ${String(s).replace(/\n/g, '\n         ')}`);
    }
  }
}
process.exit(failing.length ? 1 : 0);
