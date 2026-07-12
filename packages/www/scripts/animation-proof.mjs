/**
 * Real-browser proof that the first @nisli/ui consumer compiles and runs the
 * tw-animate-css overlay utilities. Run after `pnpm build`:
 *
 *   pnpm --filter @nisli/www proof:animations
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
if (!existsSync(join(dist, 'ui', 'popover', 'index.html'))) {
  throw new Error('missing built /ui/popover page — run `pnpm --filter @nisli/www build` first');
}

const mime = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};
const server = createServer(async (request, response) => {
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
  response.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' });
  response.end(await readFile(file));
});

await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
let primaryFailure;

try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${base}/ui/popover`, { waitUntil: 'networkidle' });
  const frame = page.locator('[data-preview="popover"]');
  await frame.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('[data-preview="popover"]')?.hasAttribute('data-hydrated'));

  const trigger = frame.getByRole('button', { name: 'Open popover' });
  await trigger.click();
  const content = page.locator('[data-slot="popover-content"]');
  await content.waitFor({ state: 'visible' });
  const entering = await content.evaluate((element) => {
    const style = getComputedStyle(element);
    return { name: style.animationName, duration: style.animationDuration, state: element.getAttribute('data-state') };
  });
  if (entering.state !== 'open' || !entering.name.split(',').includes('enter') || entering.duration === '0s') {
    throw new Error(`popover enter animation did not resolve: ${JSON.stringify(entering)}`);
  }

  await trigger.click();
  const exiting = await content.evaluate((element) => {
    const style = getComputedStyle(element);
    return { name: style.animationName, duration: style.animationDuration, state: element.getAttribute('data-state') };
  });
  if (exiting.state !== 'closed' || !exiting.name.split(',').includes('exit') || exiting.duration === '0s') {
    throw new Error(`popover exit animation did not resolve: ${JSON.stringify(exiting)}`);
  }

  console.log(`popover animations: open=${entering.name}/${entering.duration}, closed=${exiting.name}/${exiting.duration}`);
} catch (error) {
  primaryFailure = error;
  throw error;
} finally {
  const cleanup = await Promise.allSettled([
    browser?.close(),
    new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  ]);
  const cleanupFailure = cleanup.find((result) => result.status === 'rejected');
  if (!primaryFailure && cleanupFailure?.status === 'rejected') throw cleanupFailure.reason;
}
