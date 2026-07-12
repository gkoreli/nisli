/** Actual Nisli ContextMenu + Chromium CDP touch proof for UI-63. */
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const uiDir = dirname(dirname(fileURLToPath(import.meta.url)));
const wwwDir = resolve(uiDir, '../www');
const vite = join(wwwDir, 'node_modules/.bin/vite');
const { chromium } = createRequire(join(wwwDir, 'package.json'))('playwright');
let scratch;
let browser;
let server;
let primary;

const cleanup = async ({ browserValue = browser, serverValue = server, primaryFailure = primary, scratchPath = scratch, remove = rmSync } = {}) => {
  const failures = [];
  const tasks = [
    Promise.resolve().then(() => browserValue?.close()),
    serverValue && new Promise((done) => {
      try { serverValue.close((error) => done(error)); } catch (error) { done(error); }
    }),
  ];
  for (const result of await Promise.allSettled(tasks)) if (result.status === 'rejected' || result.value) failures.push(result.reason ?? result.value);
  try { if (scratchPath) remove(scratchPath, { recursive: true, force: true }); } catch (error) { failures.push(error); }
  if (!primaryFailure && failures.length) throw failures[0];
};

if (process.argv.includes('--self-test-cleanup')) {
  const staged = mkdtempSync(join(tmpdir(), 'nisli-ui-context-touch-cleanup-test-'));
  const primaryFailure = new Error('injected primary context-touch failure');
  const cleanupFailure = new Error('injected cleanup failure');
  let caughtPrimary;
  let caughtCleanup;
  try {
    try {
      try { throw primaryFailure; } catch (error) { throw error; }
      finally { await cleanup({ browserValue: { close: () => { throw cleanupFailure; } }, serverValue: null, primaryFailure, scratchPath: staged, remove: () => { throw cleanupFailure; } }); }
    } catch (error) { caughtPrimary = error; }
    if (!existsSync(staged)) throw new Error('injected retained evidence disappeared');
    try { await cleanup({ browserValue: null, serverValue: null, primaryFailure: undefined, scratchPath: staged, remove: () => { throw cleanupFailure; } }); }
    catch (error) { caughtCleanup = error; }
    if (caughtPrimary !== primaryFailure || caughtCleanup !== cleanupFailure) throw new Error('UI-63 cleanup self-test failed');
  } finally {
    rmSync(staged, { recursive: true, force: true });
  }
  if (existsSync(staged)) throw new Error('UI-63 cleanup self-test leaked staged evidence');
  console.log('UI-63 cleanup self-test OK');
  process.exit(0);
}

scratch = mkdtempSync(join(tmpdir(), 'nisli-ui-context-touch-e2e-'));
try {
  const componentPath = join(uiDir, 'registry/default/ui/context-menu.ts');
  writeFileSync(join(scratch, 'index.html'), '<div id="app"></div><script type="module" src="/main.ts"></script>');
  writeFileSync(join(scratch, 'main.ts'), `
import { html } from '@nisli/core';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from ${JSON.stringify(componentPath)};
const view = html\`${'${'}ContextMenu({ children: html\`${'${'}ContextMenuTrigger({ className: 'h-40 w-72 border', children: 'Long press here' })}${'${'}ContextMenuContent({ children: html\`${'${'}ContextMenuItem({ value: 'edit', children: 'Edit' })}${'${'}ContextMenuItem({ value: 'copy', children: 'Copy' })}\` })}\` })}\`;
view.mount(document.getElementById('app'));
`);
  writeFileSync(join(scratch, 'vite.config.mjs'), `export default { resolve: { preserveSymlinks: true, alias: { '@nisli/core': ${JSON.stringify(resolve(uiDir, '../core/src/index.ts'))} } } };`);
  execFileSync(vite, ['build', '--config', join(scratch, 'vite.config.mjs')], { cwd: scratch, stdio: ['ignore', 'pipe', 'pipe'] });
  const dist = join(scratch, 'dist');
  server = createServer((request, response) => {
    const path = join(dist, request.url === '/' ? 'index.html' : request.url);
    response.setHeader('content-type', extname(path) === '.js' ? 'text/javascript' : 'text/html');
    response.end(readFileSync(path));
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const port = server.address().port;
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 720 }, hasTouch: true, isMobile: true });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.goto(`http://127.0.0.1:${port}/`);
  const trigger = page.locator('[data-slot=context-menu-trigger]');
  const content = page.locator('[data-slot=context-menu-content]');
  await trigger.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
    throw pageErrors[0] ?? new Error('actual ContextMenu trigger did not render');
  });
  const box = await trigger.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, tx = x, ty = y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x: tx, y: ty }] });
  const closed = async (label) => { if (await content.getAttribute('data-state') === 'open') throw new Error(`${label} unexpectedly opened`); };
  const dismiss = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(50); };

  await touch('touchStart'); await page.waitForTimeout(300); await touch('touchEnd'); await page.waitForTimeout(500); await closed('short tap');
  await touch('touchStart'); await page.waitForTimeout(750); await content.waitFor({ state: 'visible' });
  if (await content.getAttribute('data-state') !== 'open') throw new Error('750ms touch did not open');
  const rect = await content.boundingBox();
  if (Math.abs(rect.x - x) > 40 || Math.abs(rect.y - y) > 40) throw new Error(`touch anchor drifted: ${JSON.stringify({ x, y, rect })}`);
  await touch('touchEnd'); await dismiss();

  await touch('touchStart'); await page.waitForTimeout(200); await touch('touchMove', x + 20, y); await page.waitForTimeout(650); await touch('touchEnd', x + 20, y); await closed('moved touch');
  await touch('touchStart'); await page.waitForTimeout(200); await touch('touchCancel'); await page.waitForTimeout(650); await closed('cancelled touch');

  await trigger.click({ button: 'right' });
  await content.waitFor({ state: 'visible' });
  if (await content.getAttribute('data-state') !== 'open') throw new Error('desktop right-click regressed');
  console.log('UI-63 actual ContextMenu touch/right-click proof OK at 390px');
} catch (error) { primary = error; throw error; }
finally { await cleanup(); }
