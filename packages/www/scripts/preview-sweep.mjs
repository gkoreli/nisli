/**
 * preview-sweep.mjs — real-browser verification of every /ui/<name> preview.
 *
 * Drives headless chromium over all component pages and asserts each
 * data-preview frame contains an UPGRADED, visibly-rendered <ui-*> element;
 * for audited interactive items it also asserts observable desktop/touch state. Captures
 * per-page console/page errors and emits a failing list (exit 1 if any fail).
 *
 * Build once, use thrice (WS1):
 *   node scripts/preview-sweep.mjs                 # serves local dist/, verifies the prod build
 *   node scripts/preview-sweep.mjs --base=https://nisli.dev   # verifies the live deploy
 *   node scripts/preview-sweep.mjs --only=calendar,toggle     # focused local diagnosis
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
import { existsSync, readdirSync } from 'node:fs';
import { extname, join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INTERACTIONS, assertInteractionCoverage, cleanupSweepResources, drawerIsUseful, isSweepFailure, phoneFit } from './preview-interactions.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, '..', 'dist');

const DESKTOP_STATE = new Set([
  'alert-dialog', 'combobox', 'context-menu', 'dialog', 'drawer',
  'dropdown-menu', 'hover-card', 'menubar', 'navigation-menu', 'popover',
  'scroll-area', 'sheet', 'toast', 'tooltip',
]);

const openOverlayCount = (page) => page.evaluate(() =>
  [...document.querySelectorAll('[data-slot$="-content"][data-state="open"]')].filter((el) =>
    [el, ...el.querySelectorAll('*')].some((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1 && getComputedStyle(node).visibility !== 'hidden';
    }),
  ).length,
);

async function longPress(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('touch target has no box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  // Radix's authoritative touch long-press threshold is 700ms; hold with a
  // small margin while staying stationary inside its 10px movement tolerance.
  await page.waitForTimeout(750);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

async function touchScroll(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('scroll target has no box');
  const x = box.x + box.width / 2;
  const startY = box.y + box.height * 0.75;
  const endY = box.y + box.height * 0.25;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
  for (let step = 1; step <= 4; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: startY + (endY - startY) * step / 4 }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

async function swipe(page, locator, { horizontal }) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('swipe target has no box');
  const start = horizontal
    ? { x: box.x + box.width * 0.75, y: box.y + box.height / 2 }
    : { x: box.x + box.width / 2, y: box.y + box.height * 0.75 };
  const end = horizontal
    ? { x: box.x + box.width * 0.25, y: start.y }
    : { x: start.x, y: box.y + box.height * 0.25 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  await page.waitForTimeout(40);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: start.x + (end.x - start.x) * 0.45, y: start.y + (end.y - start.y) * 0.45 }],
  });
  await page.waitForTimeout(80);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] });
  await page.waitForTimeout(100);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

async function runTouchInteraction(page, frame, name, outcomes) {
  const contract = INTERACTIONS[name];
  if (!contract) throw new Error(`missing touch contract for ${name}`);
  if (contract.kind === 'alias') {
    const source = outcomes.get(contract.target);
    return source?.startsWith('OK') ? `OK(alias=${contract.target})` : `FAIL(alias ${contract.target}=${source ?? 'missing'})`;
  }
  const target = frame.locator(contract.target).first();
  await target.waitFor({ state: 'visible', timeout: 3000 });

  if (contract.kind === 'overlay' || contract.kind === 'context-menu') {
    const before = await openOverlayCount(page);
    if (contract.kind === 'context-menu') await longPress(page, target);
    else await target.tap({ timeout: 3000 });
    await page.waitForTimeout(900);
    const after = await openOverlayCount(page);
    if (after > before) return `OK(${before}->${after})`;
    if (contract.kind === 'context-menu') await target.click({ button: 'right', timeout: 3000 });
    else await target.click({ timeout: 3000 });
    await page.waitForTimeout(900);
    const clickProbe = await openOverlayCount(page);
    return `FAIL(overlay ${before}->${after},clickProbe=${clickProbe})`;
  }
  if (contract.kind === 'toast') {
    const before = await page.locator('[data-slot="toast"]').count();
    await target.tap({ timeout: 3000 });
    await page.waitForTimeout(300);
    const after = await page.locator('[data-slot="toast"]').count();
    return after > before ? `OK(${before}->${after})` : `FAIL(toast ${before}->${after})`;
  }
  if (contract.kind === 'expanded') {
    const before = await target.getAttribute('aria-expanded');
    const contentSlot = name === 'accordion' ? 'accordion-content' : 'collapsible-content';
    const content = frame.locator(`[data-slot="${contentSlot}"]`).first();
    await target.tap({ timeout: 3000 });
    await page.waitForTimeout(200);
    const after = await target.getAttribute('aria-expanded');
    const state = await content.getAttribute('data-state');
    const contentHandle = await content.elementHandle();
    let painted = false;
    if (contentHandle) {
      try {
        await page.waitForFunction((element) =>
          [element, ...element.querySelectorAll('*')].some((node) => {
            const rect = node.getBoundingClientRect();
            return rect.width > 1 && rect.height > 1 && getComputedStyle(node).visibility !== 'hidden';
          }), contentHandle, { timeout: 600 });
        painted = true;
      } catch { /* bounded animation visibility failure is reported below */ }
    }
    return before !== after && after === 'true' && state === 'open' && painted
      ? `OK(${before}->${after})` : `FAIL(expanded ${before}->${after},state=${state},painted=${painted})`;
  }
  if (contract.kind === 'calendar') {
    const candidate = await frame.locator(`${contract.target}:not([aria-selected="true"]):not([aria-disabled="true"])`).first().elementHandle();
    if (!candidate) return 'FAIL(calendar candidate missing)';
    const before = await candidate.getAttribute('aria-selected');
    await candidate.tap({ timeout: 3000 });
    await page.waitForTimeout(200);
    const after = await candidate.getAttribute('aria-selected');
    if (before !== after && after === 'true') return `OK(${before}->${after})`;
    await candidate.click({ timeout: 3000 });
    await page.waitForTimeout(200);
    return `FAIL(selected ${before}->${after},clickProbe=${await candidate.getAttribute('aria-selected')})`;
  }
  if (contract.kind === 'carousel') {
    const viewport = frame.locator('[data-slot="carousel-content"]').first();
    await swipe(page, viewport, { horizontal: true });
    await page.waitForTimeout(400);
    const items = frame.locator('[data-slot="carousel-item"]');
    const activeItems = frame.locator('[data-slot="carousel-item"][data-active]');
    const activeCount = await activeItems.count();
    const activeItem = activeItems.first();
    const activeIndex = activeCount === 1
      ? await items.evaluateAll((nodes, active) => nodes.indexOf(active), await activeItem.elementHandle())
      : -1;
    const activeBox = activeCount === 1 ? await activeItem.locator(':scope > *').first().boundingBox() : null;
    const bounds = await viewport.boundingBox();
    const activeInViewport = activeBox && bounds && activeBox.x >= bounds.x - 1 &&
      activeBox.x + activeBox.width <= bounds.x + bounds.width + 1;
    const ariaHidden = activeCount === 1 ? await activeItem.getAttribute('aria-hidden') : null;
    const ariaCurrent = activeCount === 1 ? await activeItem.getAttribute('aria-current') : null;
    const track = viewport.locator(':scope > div').first();
    const transform = await track.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41);
    const boxes = await items.evaluateAll((nodes) => nodes.slice(0, 2).map((node) => node.getBoundingClientRect().x));
    const step = boxes.length === 2 ? boxes[1] - boxes[0] : NaN;
    const coherent = activeIndex >= 0 && Number.isFinite(step) && Math.abs(transform - (-activeIndex * step)) <= 1;
    const beforeVertical = { activeIndex, transform };
    await swipe(page, viewport, { horizontal: false });
    await page.waitForTimeout(400);
    const afterVerticalCount = await activeItems.count();
    const afterVerticalIndex = afterVerticalCount === 1
      ? await items.evaluateAll((nodes, active) => nodes.indexOf(active), await activeItems.first().elementHandle())
      : -1;
    const afterVerticalTransform = await track.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41);
    const crossAxisStable = afterVerticalIndex === beforeVertical.activeIndex &&
      Math.abs(afterVerticalTransform - beforeVertical.transform) <= 1;
    return activeCount === 1 && ariaHidden === 'false' && ariaCurrent === 'true' && activeInViewport && coherent && crossAxisStable
      ? `OK(index=${activeIndex},transform=${transform},step=${step})`
      : `FAIL(carousel active=${activeCount}/${activeIndex},hidden=${ariaHidden},current=${ariaCurrent},bounds=${Boolean(activeInViewport)},coherent=${coherent},crossAxis=${crossAxisStable})`;
  }
  if (contract.kind === 'button-group') {
    const copy = frame.getByRole('button', { name: 'Copy', exact: true });
    const status = frame.locator('[data-slot="button-group-status"]');
    const before = (await status.innerText()).trim();
    await copy.tap({ timeout: 3000 });
    await page.waitForTimeout(100);
    const after = (await status.innerText()).trim();
    return before !== after && after.endsWith('Copy') ? `OK(${before}->${after})` : `FAIL(status ${before}->${after})`;
  }
  if (contract.kind === 'tabs') {
    const second = frame.locator(contract.target).nth(1);
    const before = await second.getAttribute('aria-selected');
    await second.tap({ timeout: 3000 });
    const after = await second.getAttribute('aria-selected');
    const panel = frame.locator('[data-slot="tabs-content"]:not([hidden])');
    return before !== after && after === 'true' && await panel.count() > 0
      ? `OK(${before}->${after})` : `FAIL(tabs ${before}->${after},panel=${await panel.count()})`;
  }
  if (contract.kind === 'toggle') {
    const candidate = await frame.locator(`${contract.target}[aria-pressed="false"]`).first().elementHandle();
    if (!candidate) return 'FAIL(toggle candidate missing)';
    const before = await candidate.getAttribute('aria-pressed');
    await candidate.tap({ timeout: 3000 });
    await page.waitForTimeout(150);
    const after = await candidate.getAttribute('aria-pressed');
    const state = await candidate.getAttribute('data-state');
    if (before !== after && after === 'true' && (name === 'toggle-group' || state === 'on')) return `OK(${before}->${after})`;
    await candidate.click({ timeout: 3000 });
    await page.waitForTimeout(150);
    return `FAIL(toggle ${before}->${after},state=${state},clickProbe=${await candidate.getAttribute('aria-pressed')})`;
  }
  if (contract.kind === 'native-check') {
    const candidateLocator = name === 'radio-group'
      ? frame.locator(`${contract.target}:not(:checked)`).first()
      : target;
    const candidate = await candidateLocator.elementHandle();
    if (!candidate) return 'FAIL(native-check candidate missing)';
    const before = await candidate.isChecked();
    await candidate.tap({ timeout: 3000 });
    await page.waitForTimeout(100);
    const after = await candidate.isChecked();
    if (before !== after) return `OK(${before}->${after})`;
    await candidate.click({ timeout: 3000 });
    await page.waitForTimeout(100);
    return `FAIL(native-check ${before}->${after},clickProbe=${await candidate.isChecked()})`;
  }
  if (contract.kind === 'native-focus') {
    await target.tap({ timeout: 3000 });
    const focused = await target.evaluate((element) => document.activeElement === element);
    return focused ? 'OK(focused)' : 'FAIL(native control did not focus from tap)';
  }
  if (contract.kind === 'native-select') {
    const options = target.locator('option');
    const count = await options.count();
    if (count < 2) return `FAIL(select options=${count})`;
    const before = await target.inputValue();
    await target.tap({ timeout: 3000 });
    await target.selectOption({ index: 1 });
    const after = await target.inputValue();
    return before !== after ? `OK(${before}->${after})` : `FAIL(select ${before}->${after})`;
  }
  if (contract.kind === 'slider') {
    const before = Number(await target.inputValue());
    const box = await target.boundingBox();
    if (!box) return 'FAIL(slider no box)';
    await page.touchscreen.tap(box.x + box.width * 0.8, box.y + box.height / 2);
    const after = Number(await target.inputValue());
    return after > before ? `OK(${before}->${after})` : `FAIL(slider ${before}->${after})`;
  }
  if (contract.kind === 'resizable') {
    const panel = frame.locator('[data-slot="resizable-panel"]').first();
    const beforeValue = Number(await target.getAttribute('aria-valuenow'));
    const beforeWidth = (await panel.boundingBox())?.width;
    await target.focus();
    await target.press('ArrowRight');
    await page.waitForTimeout(200);
    const afterValue = Number(await target.getAttribute('aria-valuenow'));
    const afterWidth = (await panel.boundingBox())?.width;
    return afterValue > beforeValue && Number.isFinite(beforeWidth) && Number.isFinite(afterWidth) && afterWidth > beforeWidth + 1
      ? `OK(value=${beforeValue}->${afterValue},width=${beforeWidth}->${afterWidth})`
      : `FAIL(resizable value=${beforeValue}->${afterValue},width=${beforeWidth}->${afterWidth})`;
  }
  if (contract.kind === 'scroll') {
    const before = await target.evaluate((element) => element.scrollTop);
    await touchScroll(page, target);
    await page.waitForTimeout(150);
    const after = await target.evaluate((element) => element.scrollTop);
    return after > before ? `OK(${before}->${after})` : `FAIL(scroll ${before}->${after})`;
  }
  throw new Error(`unsupported touch contract ${contract.kind}`);
}

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
assertInteractionCoverage(names);
const onlyArg = process.argv.find((value) => value.startsWith('--only='));
if (onlyArg) {
  const selected = new Set(onlyArg.slice('--only='.length).split(',').filter(Boolean));
  names.splice(0, names.length, ...names.filter((name) => selected.has(name)));
}

// serve local dist/ when no --base was given
let server;
let browser;
let phone;
let primaryFailure;
try {
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
browser = await chromium.launch();
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
  let upgrade = 'NO-FRAME', open = 'n/a', hydrated = 'n/a', fit = 'FAIL';
  try {
    await page.goto(`${base}/ui/${name}`, { waitUntil: 'networkidle', timeout: 20000 });
    const desktopWidth = await page.evaluate(() => ({
      scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      viewport: window.innerWidth,
    }));
    fit = desktopWidth.scroll <= desktopWidth.viewport + 1
      ? `OK(${desktopWidth.scroll}/${desktopWidth.viewport})`
      : `FAIL(${desktopWidth.scroll}/${desktopWidth.viewport})`;
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
      await page.waitForFunction(
        (component) => document.querySelector(`[data-preview="${component}"]`)?.hasAttribute('data-hydrated'),
        name,
        { timeout: 5000 },
      );
      hydrated = 'OK';
      const info = await frame.first().evaluate((el) => {
        const uiEls = [...el.querySelectorAll('*')].filter((n) => n.tagName.toLowerCase().startsWith('ui-'));
        // ui-* hosts are display:contents (transparentHost) so their own box is
        // 0×0 by design — measure whether ANY descendant actually painted a box.
        const painted = [...el.querySelectorAll('*')].some((n) => {
          const r = n.getBoundingClientRect();
          return r.height > 1 && r.width > 1;
        });
        // Every universally hydrated ui-* element must be registered. A
        // repeated full sequence of outer roots is the upgrade-in-place double
        // render signature; legitimate repeated children remain nested.
        const undefinedTags = [...new Set(
          uiEls.map((n) => n.tagName.toLowerCase()).filter((t) => customElements.get(t) === undefined),
        )];
        const outer = uiEls.filter((node) => {
          let parent = node.parentElement;
          while (parent && parent !== el) {
            if (parent.tagName.toLowerCase().startsWith('ui-')) return false;
            parent = parent.parentElement;
          }
          return true;
        });
        const signatures = outer.map((node) => `${node.tagName}:${node.textContent?.trim() ?? ''}`);
        const half = signatures.length / 2;
        const doubled = Number.isInteger(half) && half > 0 &&
          signatures.slice(0, half).every((signature, index) => signature === signatures[index + half]);
        return { hasUi: uiEls.length > 0, painted, undefinedTags, doubled, text: el.textContent.trim().length };
      });
      const inert = info.undefinedTags.length || info.doubled;
      upgrade =
        inert ? `INERT/DOUBLE ${JSON.stringify(info)}`
        : info.hasUi && info.painted ? 'OK'
        : `WEAK ${JSON.stringify(info)}`;
    }
    if (DESKTOP_STATE.has(name)) {
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
        if (name === 'scroll-area') {
          // Not an overlay — universal hydration supplies its runtime scrollbar
          // stylesheet injects. Being hydrated + not-INERT (checked below/above)
          // is the success signal; there is nothing to "open".
          open = 'OK-nostate';
        } else if (name === 'toast') {
          // Side-effectful: clicking a trigger button must actually PUSH a toast
          // (the RC3 static version was inert). Assert a toast item appears.
          const before = await page.evaluate(() => document.querySelectorAll('[data-slot="toast"]').length);
          await frame.locator('button').first().click({ timeout: 3000 });
          await page.waitForTimeout(500);
          const after = await page.evaluate(() => document.querySelectorAll('[data-slot="toast"]').length);
          open = after > before ? 'OK' : `FAIL(no toast ${before}->${after})`;
        } else {
          const trigger = frame.locator('button, [data-slot*="trigger"], [aria-haspopup]').first();
          const before = await openOverlayCount();
          // interaction model differs per family: context-menu opens on right-click,
          // tooltip/hover-card/navigation-menu on hover (with open-delay), the rest on click.
          if (name === 'context-menu') await trigger.click({ button: 'right', timeout: 3000 });
          else if (name === 'tooltip' || name === 'hover-card' || name === 'navigation-menu') { await trigger.hover({ timeout: 3000 }); await page.waitForTimeout(900); }
          else await trigger.click({ timeout: 3000 });
          await page.waitForTimeout(500);
          const after = await openOverlayCount();
          open = after > before ? 'OK' : `FAIL(${before}->${after})`;
        }
      } catch (e) { open = `ERR ${String(e.message).slice(0, 36)}`; }
      // req 2: the success marker must be set — a silent chunk failure leaves it off
      hydrated = (await page.locator(`[data-preview="${name}"]`).first().getAttribute('data-hydrated')) ? 'OK' : 'MISSING';
    }
  } catch (e) {
    upgrade = `LOAD-ERR ${String(e.message).slice(0, 40)}`;
  }
  await page.waitForTimeout(50); // let any pending console-arg evaluations resolve
  results.push({ name, mode: 'desktop', upgrade, open, hydrated, fit, touch: 'n/a', assetFails: assetFails.slice(0, 3), err: errors[0] || '', artifacts });
  await page.close();
}

// WWW-15 phone dimension: every page gets a real mobile/touch rendering pass,
// not a desktop page with its width changed after load. Hydrated previews must
// prove a manifest-owned state transition from a touchscreen action.
phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const interactionOutcomes = new Map();
for (const name of names) {
  const page = await phone.newPage();
  const errors = [];
  const assetFails = [];
  page.on('pageerror', (error) => errors.push(String(error).split('\n')[0]));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text().slice(0, 80)}`); });
  const isPreviewAsset = (request) =>
    ['script', 'stylesheet', 'font'].includes(request.resourceType()) || /\/(chunks|ui-preview|assets)\//.test(request.url());
  const noteFail = (request, why) => { if (isPreviewAsset(request)) assetFails.push(`${why} ${new URL(request.url()).pathname}`); };
  page.on('response', (response) => { if (response.status() >= 400) noteFail(response.request(), `HTTP${response.status()}`); });
  page.on('requestfailed', (request) => noteFail(request, 'REQFAIL'));
  let upgrade = 'NO-FRAME', hydrated = 'n/a', fit = 'FAIL', touch = 'n/a';
  try {
    await page.goto(`${base}/ui/${name}`, { waitUntil: 'networkidle', timeout: 20000 });
    const widths = await page.evaluate((deviceWidth) => {
      const scroll = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      const viewport = window.innerWidth;
      // Attribution, collected ONLY when the fit is already wrong. `fit=FAIL(407/407)`
      // names a number and no cause, and a number without a cause costs a CI round
      // trip per hypothesis — two of mine were wrong before this existed.
      //
      // MEASURED AGAINST THE DEVICE WIDTH, NOT `innerWidth`, and that is the whole
      // subtlety: shrink-to-fit has ALREADY widened the layout viewport by the time
      // this runs, so relative to `innerWidth` nothing is ever too wide and the
      // blame list comes back empty on a page that plainly failed. Verified: the
      // first version of this reported no cause for a 485px home page.
      const blame = [];
      if (scroll > viewport + 1 || viewport !== deviceWidth) {
        const over = [];
        for (const el of document.querySelectorAll('body *')) {
          const box = el.getBoundingClientRect();
          if (box.width < 1) continue;
          if (box.right <= deviceWidth + 1 && box.width <= deviceWidth + 1) continue;
          over.push({ el, box });
        }
        // An offender containing another offender is a container, not the cause.
        const causes = over.filter(({ el }) => !over.some((other) => other.el !== el && el.contains(other.el)));
        for (const { el, box } of (causes.length ? causes : over).slice(0, 3)) {
          const id = el.getAttribute('data-slot') || el.getAttribute('data-preview') ||
            (el.className || '').toString().split(/\s+/).slice(0, 2).join('.') || '';
          const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 18);
          blame.push(`${el.tagName.toLowerCase()}${id ? `[${id}]` : ''}=${Math.round(box.width)}w@${Math.round(box.right)}r${text ? `"${text}"` : ''}`);
        }
      }
      return { scroll, viewport, blame };
    }, 390);
    fit = phoneFit(widths.scroll, widths.viewport, 390, widths.blame);
    const frame = page.locator(`[data-preview="${name}"]`).first();
    if (!(await frame.count())) {
      const primitive = await page.getByText('Primitive', { exact: true }).count() > 0;
      upgrade = primitive ? 'SKIP-primitive' : 'NO-FRAME(ui!)';
    } else {
      await frame.scrollIntoViewIfNeeded();
      await page.waitForFunction(
        (component) => document.querySelector(`[data-preview="${component}"]`)?.hasAttribute('data-hydrated'),
        name,
        { timeout: 5000 },
      );
      const info = await frame.evaluate((element) => {
        const ui = [...element.querySelectorAll('*')].filter((node) => node.tagName.toLowerCase().startsWith('ui-'));
        const outer = ui.filter((node) => {
          let parent = node.parentElement;
          while (parent && parent !== element) {
            if (parent.tagName.toLowerCase().startsWith('ui-')) return false;
            parent = parent.parentElement;
          }
          return true;
        });
        const undefinedTags = [...new Set(ui.map((node) => node.tagName.toLowerCase()).filter((tag) => !customElements.get(tag)))];
        const painted = [...element.querySelectorAll('*')].some((node) => {
          const rect = node.getBoundingClientRect();
          return rect.width > 1 && rect.height > 1 && getComputedStyle(node).visibility !== 'hidden';
        });
        const signatures = outer.map((node) => `${node.tagName}:${node.textContent?.trim() ?? ''}`);
        const half = signatures.length / 2;
        const doubled = Number.isInteger(half) && half > 0 &&
          signatures.slice(0, half).every((signature, index) => signature === signatures[index + half]);
        return { hasUi: ui.length > 0, painted, undefinedTags, doubled, hydrating: element.hasAttribute('data-hydrating') };
      });
      const hydratedProblem = info.undefinedTags.length || info.hydrating || info.doubled;
      upgrade = hydratedProblem
        ? `INERT/DOUBLE ${JSON.stringify(info)}`
        : info.hasUi && info.painted ? 'OK'
        : `WEAK ${JSON.stringify(info)}`;
      hydrated = 'OK';
      if (INTERACTIONS[name] && !INTERACTIONS[name].desktopOnly) {
        touch = await runTouchInteraction(page, frame, name, interactionOutcomes);
        interactionOutcomes.set(name, touch);
      }
    }
  } catch (error) {
    upgrade = `LOAD-ERR ${String(error.message).slice(0, 40)}`;
  }
  results.push({
    name: `phone:${name}`,
    mode: 'phone',
    upgrade,
    open: 'n/a',
    hydrated,
    fit,
    touch,
    assetFails: assetFails.slice(0, 3),
    err: errors[0] || '',
    artifacts: [],
  });
  await page.close();
}

// WWW-13: the DocsLayout mobile drawer must OPEN on a narrow viewport. The
// desktop sidebar works with zero JS (real anchors), but the mobile off-canvas
// drawer is a portaled Sheet (client-only, ADR 0025 item-6) that only works if
// the page injects the runtime AND the sidebar chrome registers. Drive it for
// real: 390px, click the SidebarTrigger, require a VISIBLE open sheet-content
// plus the sidebar in data-mobile mode.
{
  const mpage = await phone.newPage();
  const mErrors = [];
  mpage.on('pageerror', (e) => mErrors.push(String(e).split('\n')[0]));
  let open = 'FAIL', fit = 'FAIL';
  try {
    await mpage.goto(`${base}/docs`, { waitUntil: 'networkidle', timeout: 20000 });
    await mpage.waitForTimeout(400);
    await mpage.waitForFunction(() => document.querySelector('[data-hydrate="mobile-nav"]')?.hasAttribute('data-hydrated'));
    await mpage.locator('[data-hydrate="mobile-nav"] [data-slot="sheet-trigger"]').first().tap({ timeout: 3000 });
    await mpage.waitForTimeout(600);
    const opened = await mpage.evaluate(() => {
      const sheet = [...document.querySelectorAll('[data-slot="sheet-content"][data-state="open"]')]
        .some((e) => e.getBoundingClientRect().width > 1);
      const drawer = [...document.querySelectorAll('[data-slot="sheet-content"][data-state="open"]')]
        .find((element) => element.getBoundingClientRect().width > 1);
      const mobile = !!document.querySelector('[data-hydrate="mobile-nav"][data-hydrated]');
      const navItems = drawer?.querySelectorAll('nav li').length ?? 0;
      const links = [...(drawer?.querySelectorAll('a[href]') ?? [])];
      const validLinks = links.filter((link) => {
        const href = link.getAttribute('href');
        return href && href !== '#' && !href.startsWith('javascript:');
      }).length;
      const scroll = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      const viewport = window.innerWidth;
      return { sheet: !!drawer, mobile, navItems, links: links.length, validLinks, overflow: scroll - viewport, scroll, viewport };
    });
    fit = phoneFit(opened.scroll, opened.viewport);
    open = drawerIsUseful(opened)
      ? `OK(items=${opened.navItems},links=${opened.links})`
      : `FAIL(${JSON.stringify(opened)})`;
  } catch (e) {
    open = `ERR ${String(e.message).slice(0, 36)}`;
  }
  results.push({ name: 'phone:docs-drawer', mode: 'phone', upgrade: 'OK', open, hydrated: 'n/a', fit, touch: open, assetFails: [], err: mErrors[0] || '', artifacts: [] });
  await mpage.close();
}

// PAGE-LEVEL ROUTES AT PHONE WIDTH. The lanes above visit only
// `/ui/<component>`, and that blind spot is why three page-level overflows
// shipped in one day: `/ui` blew out a grid track to 619px, and two `/intent`
// pages held a 435px switcher row. Every one of them was reachable from the top
// bar and none was reachable by this script.
//
// DERIVED FROM THE BUILD, not typed here: every emitted `index.html` is a route,
// minus the component pages already covered above. A route that cannot drift
// from the pages is the same argument the nav model and the intent surface
// catalog already make in this package.
{
  const componentPaths = new Set(names.map((name) => `/ui/${name}`));
  const routes = readdirSync(DIST, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name === 'index.html')
    .map((entry) => `/${relative(DIST, join(entry.parentPath ?? entry.path, entry.name)).replace(/index\.html$/, '')}`)
    .map((route) => (route.length > 1 ? route.replace(/\/$/, '') : route))
    .filter((route) => !componentPaths.has(route))
    .sort();
  for (const route of routes) {
    const rpage = await phone.newPage();
    const rErrors = [];
    rpage.on('pageerror', (error) => rErrors.push(String(error).split('\n')[0]));
    let fit = 'FAIL';
    try {
      await rpage.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 20000 });
      const widths = await rpage.evaluate((deviceWidth) => {
        const scroll = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
        const viewport = window.innerWidth;
        const blame = [];
        if (scroll > viewport + 1 || viewport !== deviceWidth) {
          const over = [];
          for (const el of document.querySelectorAll('body *')) {
            const box = el.getBoundingClientRect();
            if (box.width < 1) continue;
            if (box.right <= deviceWidth + 1 && box.width <= deviceWidth + 1) continue;
            over.push({ el, box });
          }
          const causes = over.filter(({ el }) => !over.some((other) => other.el !== el && other.el.contains(el)));
          for (const { el, box } of (causes.length ? causes : over).slice(0, 3)) {
            const id = el.getAttribute('data-slot') ||
              (el.className || '').toString().split(/\s+/).slice(0, 2).join('.') || '';
            const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 18);
            blame.push(`${el.tagName.toLowerCase()}${id ? `[${id}]` : ''}=${Math.round(box.width)}w@${Math.round(box.right)}r${text ? `"${text}"` : ''}`);
          }
        }
        return { scroll, viewport, blame };
      }, 390);
      fit = phoneFit(widths.scroll, widths.viewport, 390, widths.blame);
    } catch (error) {
      fit = `LOAD-ERR ${String(error.message).slice(0, 36)}`;
    }
    results.push({
      name: `route:${route}`,
      mode: 'phone',
      upgrade: 'OK',
      open: 'n/a',
      hydrated: 'n/a',
      fit,
      touch: 'n/a',
      assetFails: [],
      err: rErrors[0] || '',
      artifacts: [],
    });
    await rpage.close();
  }
}

const bad = isSweepFailure;
for (const r of results) {
  const af = r.assetFails?.length ? ` asset-fails=[${r.assetFails.join(', ')}]` : '';
  console.log(`${r.name.padEnd(24)} upgrade=${r.upgrade.slice(0, 40).padEnd(42)} open=${r.open.padEnd(12)} touch=${r.touch.padEnd(22)} fit=${r.fit.padEnd(14)} hydrated=${String(r.hydrated).padEnd(8)}${af} ${r.err}${bad(r) ? '  <== FAIL' : ''}`);
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
process.exitCode = failing.length ? 1 : 0;
} catch (error) {
  primaryFailure = error;
  throw error;
} finally {
  await cleanupSweepResources({ phone, browser, server, primaryFailure });
}
