/** Actual Nisli Carousel + compiled Tailwind + Chromium CDP touch proof (UI-65). */
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
  const staged = mkdtempSync(join(tmpdir(), 'nisli-ui-carousel-touch-cleanup-test-'));
  const primaryFailure = new Error('injected primary carousel-touch failure');
  const cleanupFailure = new Error('injected cleanup failure');
  let caughtPrimary;
  let caughtCleanup;
  try {
    try { try { throw primaryFailure; } finally { await cleanup({ browserValue: { close: () => { throw cleanupFailure; } }, serverValue: null, primaryFailure, scratchPath: staged, remove: () => { throw cleanupFailure; } }); } } catch (error) { caughtPrimary = error; }
    if (!existsSync(staged)) throw new Error('injected evidence disappeared');
    try { await cleanup({ browserValue: null, serverValue: null, primaryFailure: undefined, scratchPath: staged, remove: () => { throw cleanupFailure; } }); } catch (error) { caughtCleanup = error; }
    if (caughtPrimary !== primaryFailure || caughtCleanup !== cleanupFailure) throw new Error('UI-65 cleanup self-test failed');
  } finally { rmSync(staged, { recursive: true, force: true }); }
  if (existsSync(staged)) throw new Error('UI-65 cleanup self-test leaked');
  console.log('UI-65 cleanup self-test OK');
  process.exit(0);
}

scratch = mkdtempSync(join(tmpdir(), 'nisli-ui-carousel-touch-e2e-'));
try {
  const componentPath = join(uiDir, 'registry/default/ui/carousel.ts');
  const theme = join(uiDir, 'registry/default/styles/theme.css');
  writeFileSync(join(scratch, 'index.html'), '<link rel="stylesheet" href="/styles.css"><div id="app"></div><script type="module" src="/main.ts"></script>');
  writeFileSync(join(scratch, 'main.ts'), `
import { html } from '@nisli/core';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from ${JSON.stringify(componentPath)};
const slides = html\`${'${'}CarouselItem({ children: html\`<div class="h-32 border">One</div>\` })}${'${'}CarouselItem({ children: html\`<div class="h-32 border">Two</div>\` })}${'${'}CarouselItem({ children: html\`<div class="h-32 border">Three</div>\` })}\`;
html\`${'${'}Carousel({ className: 'mx-12 w-[294px]', children: html\`${'${'}CarouselContent({ children: slides })}${'${'}CarouselPrevious({ className: 'left-0' })}${'${'}CarouselNext({ className: 'right-0' })}\` })}\`.mount(document.getElementById('app'));
`);
  writeFileSync(join(scratch, 'input.css'), `@import "tailwindcss";\n@import ${JSON.stringify(theme)};\n@source ${JSON.stringify(componentPath)};\n@source "./main.ts";\n`);
  execFileSync(tailwind, ['-i', join(scratch, 'input.css'), '-o', join(scratch, 'styles.css'), '--minify'], { cwd: wwwDir });
  writeFileSync(join(scratch, 'vite.config.mjs'), `export default { resolve: { preserveSymlinks: true, alias: { '@nisli/core': ${JSON.stringify(resolve(uiDir, '../core/src/index.ts'))} } } };`);
  execFileSync(vite, ['build', '--config', join(scratch, 'vite.config.mjs')], { cwd: scratch, stdio: ['ignore', 'pipe', 'pipe'] });
  const dist = join(scratch, 'dist');
  server = createServer((request, response) => { const path = join(dist, request.url === '/' ? 'index.html' : request.url); response.setHeader('content-type', extname(path) === '.js' ? 'text/javascript' : extname(path) === '.css' ? 'text/css' : 'text/html'); response.end(readFileSync(path)); });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 720 }, hasTouch: true, isMobile: true });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const viewport = page.locator('[data-slot=carousel-content]');
  await viewport.waitFor({ state: 'visible' });
  const box = await viewport.boundingBox();
  const y = box.y + box.height / 2;
  const startX = box.x + box.width * 0.75;
  const endX = box.x + box.width * 0.25;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, ty = y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y: ty }] });
  const activeInside = async () => page.evaluate(() => { const viewportEl = document.querySelector('[data-slot=carousel-content]'); const v = viewportEl.getBoundingClientRect(); const activeEl = document.querySelector('[data-slot=carousel-item][data-active]'); const painted = (activeEl.firstElementChild ?? activeEl).getBoundingClientRect(); const slides = [...document.querySelectorAll('[data-slot=carousel-item]')]; const step = Math.abs(slides[1].getBoundingClientRect().left - slides[0].getBoundingClientRect().left); const transform = viewportEl.firstElementChild.style.transform; const translated = Number(transform.match(/translate3d\(([-\d.]+)px/)?.[1]); const activeIndex = slides.indexOf(activeEl); return { inside: painted.left >= v.left - 1 && painted.right <= v.right + 1, clamped: Math.abs(translated + activeIndex * step) <= 1, activeText: activeEl.textContent, viewport: { left: v.left, right: v.right }, painted: { left: painted.left, right: painted.right }, transform, activeCount: document.querySelectorAll('[data-slot=carousel-item][data-active]').length }; });

  await touch('touchStart', startX); await page.waitForTimeout(80); await touch('touchMove', (startX + endX) / 2); await page.waitForTimeout(100); await touch('touchMove', endX); await page.waitForTimeout(40); await touch('touchEnd', endX); await page.waitForTimeout(400);
  let result = await activeInside();
  if (!result.inside || !result.clamped || result.activeText !== 'Two' || result.activeCount !== 1) throw new Error(`swipe did not settle coherently: ${JSON.stringify(result)}`);

  await touch('touchStart', startX); await page.waitForTimeout(80); await touch('touchEnd', startX); await page.waitForTimeout(250);
  result = await activeInside(); if (result.activeText !== 'Two') throw new Error('tap changed slide');
  await touch('touchStart', startX); await page.waitForTimeout(50); await touch('touchMove', startX - 4, y + 30); await page.waitForTimeout(80); await touch('touchEnd', startX - 4, y + 30); await page.waitForTimeout(250);
  result = await activeInside(); if (result.activeText !== 'Two' || !result.inside) throw new Error('cross-axis scroll changed slide');

  await page.locator('[data-slot=carousel-next]').click();
  result = await activeInside(); if (result.activeText !== 'Three' || !result.inside) throw new Error('desktop next regressed');
  await page.locator('[data-slot=carousel]').dispatchEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
  result = await activeInside(); if (result.activeText !== 'Two' || !result.inside) throw new Error('desktop keyboard regressed');
  console.log('UI-65 actual Carousel CDP swipe/snap proof OK at 390px');
} catch (error) { primary = error; throw error; }
finally { await cleanup(); }
