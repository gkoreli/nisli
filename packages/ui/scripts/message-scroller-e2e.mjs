/** Replace-hydrated MessageScroller + compiled Tailwind Chromium proof (UI-66). */
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
const tailwind = join(wwwDir, 'node_modules/.bin/tailwindcss');
const { chromium } = createRequire(join(wwwDir, 'package.json'))('playwright');
let scratch;
let browser;
let server;
let primary;
const cleanup = async ({ browserValue = browser, serverValue = server, primaryFailure = primary, scratchPath = scratch, remove = rmSync } = {}) => {
  const failures = [];
  const tasks = [Promise.resolve().then(() => browserValue?.close()), serverValue && new Promise((done) => { try { serverValue.close((error) => done(error)); } catch (error) { done(error); } })];
  for (const result of await Promise.allSettled(tasks)) if (result.status === 'rejected' || result.value) failures.push(result.reason ?? result.value);
  try { if (scratchPath) remove(scratchPath, { recursive: true, force: true }); } catch (error) { failures.push(error); }
  if (!primaryFailure && failures.length) throw failures[0];
};
if (process.argv.includes('--self-test-cleanup')) {
  const staged = mkdtempSync(join(tmpdir(), 'nisli-ui-message-scroller-cleanup-test-'));
  const primaryFailure = new Error('injected primary message-scroller failure');
  const asyncBrowserFailure = new Error('injected async browser close failure');
  const syncBrowserFailure = new Error('injected sync browser close failure');
  const serverFailure = new Error('injected server close failure');
  const removalFailure = new Error('injected removal failure');
  let caughtPrimary;
  let caughtCleanup;
  let caughtServerOnly;
  let primaryBrowserClosed = false;
  let primaryServerClosed = false;
  let primaryRemovalRan = false;
  let cleanupServerClosed = false;
  let cleanupRemovalRan = false;
  let successServerClosed = false;
  let successRemovalRan = false;
  try {
    try {
      try { throw primaryFailure; } finally {
        await cleanup({
          browserValue: { close: async () => { await Promise.resolve(); primaryBrowserClosed = true; throw asyncBrowserFailure; } },
          serverValue: { close: (done) => setTimeout(() => { primaryServerClosed = true; done(serverFailure); }, 0) },
          primaryFailure,
          scratchPath: staged,
          remove: () => { primaryRemovalRan = true; throw removalFailure; },
        });
      }
    } catch (error) { caughtPrimary = error; }
    if (!existsSync(staged)) throw new Error('injected evidence disappeared');
    try {
      await cleanup({
        browserValue: { close: () => { throw syncBrowserFailure; } },
        serverValue: { close: (done) => setTimeout(() => { cleanupServerClosed = true; done(serverFailure); }, 0) },
        primaryFailure: undefined,
        scratchPath: staged,
        remove: () => { cleanupRemovalRan = true; },
      });
    } catch (error) { caughtCleanup = error; }
    try {
      await cleanup({ browserValue: null, serverValue: { close: (done) => setTimeout(() => done(serverFailure), 0) }, primaryFailure: undefined, scratchPath: staged, remove: () => {} });
    } catch (error) { caughtServerOnly = error; }
    await cleanup({
      browserValue: null,
      serverValue: { close: (done) => setTimeout(() => { successServerClosed = true; done(); }, 0) },
      primaryFailure: undefined,
      scratchPath: staged,
      remove: () => { successRemovalRan = true; },
    });
    if (
      caughtPrimary !== primaryFailure || caughtCleanup !== syncBrowserFailure ||
      caughtServerOnly !== serverFailure || !primaryBrowserClosed ||
      !primaryServerClosed || !primaryRemovalRan || !cleanupServerClosed ||
      !cleanupRemovalRan || !successServerClosed || !successRemovalRan
    ) throw new Error('UI-66 cleanup self-test failed');
  } finally { rmSync(staged, { recursive: true, force: true }); }
  if (existsSync(staged)) throw new Error('UI-66 cleanup self-test leaked');
  console.log('UI-66 cleanup self-test OK');
  process.exit(0);
}

scratch = mkdtempSync(join(tmpdir(), 'nisli-ui-message-scroller-e2e-'));
try {
  const componentPath = join(uiDir, 'registry/default/ui/message-scroller.ts');
  const theme = join(uiDir, 'registry/default/styles/theme.css');
  writeFileSync(join(scratch, 'index.html'), '<link rel="stylesheet" href="/styles.css"><div id="frame"><p>server preview</p></div><script type="module" src="/main.ts"></script>');
  writeFileSync(join(scratch, 'main.ts'), `
import { html } from '@nisli/core';
import { MessageScroller, MessageScrollerViewport, MessageScrollerContent, MessageScrollerItem, MessageScrollerButton } from ${JSON.stringify(componentPath)};
const rows = html\`${'${'}MessageScrollerItem({ className: 'h-28 border', children: 'One' })}${'${'}MessageScrollerItem({ className: 'h-28 border', children: 'Two' })}${'${'}MessageScrollerItem({ className: 'h-28 border', children: 'Three' })}\`;
const mounted = document.createElement('div'); mounted.className = 'h-40 w-72';
html\`${'${'}MessageScroller({ children: html\`${'${'}MessageScrollerViewport({ children: MessageScrollerContent({ children: rows }) })}${'${'}MessageScrollerButton({ direction: 'end' })}\` })}\`.mount(mounted);
document.getElementById('frame').replaceChildren(mounted);
window.appendMessage = (text = 'Late') => { const row = document.createElement('div'); row.dataset.slot = 'message-scroller-item'; row.className = 'h-28 shrink-0 border'; row.textContent = text; document.querySelector('[data-slot=message-scroller-content]').append(row); };
`);
  writeFileSync(join(scratch, 'input.css'), `@import "tailwindcss";\n@import ${JSON.stringify(theme)};\n@source ${JSON.stringify(componentPath)};\n@source "./main.ts";\n`);
  execFileSync(tailwind, ['-i', join(scratch, 'input.css'), '-o', join(scratch, 'styles.css'), '--minify'], { cwd: wwwDir });
  writeFileSync(join(scratch, 'vite.config.mjs'), `export default { resolve: { preserveSymlinks: true, alias: { '@nisli/core': ${JSON.stringify(resolve(uiDir, '../core/src/index.ts'))} } } };`);
  execFileSync(vite, ['build', '--config', join(scratch, 'vite.config.mjs')], { cwd: scratch, stdio: ['ignore', 'pipe', 'pipe'] });
  const dist = join(scratch, 'dist');
  server = createServer((request, response) => { const path = join(dist, request.url === '/' ? 'index.html' : request.url); response.setHeader('content-type', extname(path) === '.js' ? 'text/javascript' : extname(path) === '.css' ? 'text/css' : 'text/html'); response.end(readFileSync(path)); });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 720 } });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const viewport = page.locator('[data-slot=message-scroller-viewport]');
  await viewport.waitFor({ state: 'visible' });
  await page.waitForTimeout(100);
  const measure = () => viewport.evaluate((el) => ({ top: el.scrollTop, distance: el.scrollHeight - el.clientHeight - el.scrollTop, height: el.scrollHeight }));
  let result = await measure();
  if (result.distance > 2 || result.top <= 0) throw new Error(`replace hydration did not pin bottom: ${JSON.stringify(result)}`);
  await page.evaluate(() => window.appendMessage('Pinned late row'));
  await page.waitForTimeout(100);
  result = await measure(); if (result.distance > 2) throw new Error(`late row lost bottom pin: ${JSON.stringify(result)}`);
  await page.evaluate(() => { document.querySelector('[data-slot=message-scroller-item]:last-child').style.height = '180px'; });
  await page.waitForTimeout(100);
  result = await measure(); if (result.distance > 2) throw new Error(`resize lost bottom pin: ${JSON.stringify(result)}`);
  await viewport.evaluate((el) => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll')); });
  const userTop = (await measure()).top;
  await page.evaluate(() => window.appendMessage('User must stay up'));
  await page.waitForTimeout(100);
  result = await measure(); if (result.top !== userTop || result.distance <= 2) throw new Error(`user was yanked after scrolling up: ${JSON.stringify(result)}`);
  await page.locator('[data-slot=message-scroller-button][data-direction=end]').click();
  result = await measure(); if (result.distance > 2) throw new Error('scroll-to-end button regressed');
  console.log('UI-66 replace-hydration MessageScroller geometry proof OK at 390px');
} catch (error) { primary = error; throw error; }
finally { await cleanup(); }
