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

  await page.goto(`${base}/ui/tooltip`, { waitUntil: 'networkidle' });
  const tooltipFrame = page.locator('[data-preview="tooltip"]');
  await tooltipFrame.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('[data-preview="tooltip"]')?.hasAttribute('data-hydrated'));
  const tooltipTrigger = tooltipFrame.getByRole('button', { name: 'Hover me' });
  // Force the preferred right side to collide with the viewport edge. The
  // floating helper must flip left and rotate the actual polygon tip right,
  // toward the trigger.
  await tooltipFrame.locator('ui-tooltip-content').evaluate((host) => host.setAttribute('side', 'right'));
  await tooltipTrigger.evaluate((trigger) => {
    trigger.style.position = 'fixed';
    trigger.style.right = '0';
    trigger.style.top = '200px';
  });
  await tooltipTrigger.hover();
  const tooltipContent = page.locator('[data-slot="tooltip-content"]');
  const tooltipArrow = tooltipContent.locator('[data-slot="tooltip-arrow"]');
  await tooltipContent.waitFor({ state: 'visible' });
  await tooltipArrow.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('[data-slot="tooltip-arrow"]')?.hasAttribute('data-side'));
  const arrowProof = await tooltipArrow.evaluate((arrow, trigger) => {
    const content = arrow.closest('[data-slot="tooltip-content"]');
    if (!content) throw new Error('tooltip arrow is not inside tooltip content');
    const arrowStyle = getComputedStyle(arrow);
    const contentStyle = getComputedStyle(content);
    const arrowRect = arrow.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const matrix = arrow.getScreenCTM();
    if (!matrix) throw new Error('tooltip arrow has no screen transform');
    const baseStart = new DOMPoint(0, 0).matrixTransform(matrix);
    const baseEnd = new DOMPoint(30, 0).matrixTransform(matrix);
    const tip = new DOMPoint(15, 10).matrixTransform(matrix);
    const base = { x: (baseStart.x + baseEnd.x) / 2, y: (baseStart.y + baseEnd.y) / 2 };
    const tipVector = { x: tip.x - base.x, y: tip.y - base.y };
    const anchorVector = {
      x: triggerRect.left + triggerRect.width / 2 - base.x,
      y: triggerRect.top + triggerRect.height / 2 - base.y,
    };
    const tipDotAnchor = tipVector.x * anchorVector.x + tipVector.y * anchorVector.y;
    const side = content.getAttribute('data-side');
    const edgeDistance = side === 'top'
      ? Math.abs(arrowRect.bottom - contentRect.bottom)
      : side === 'bottom'
        ? Math.abs(arrowRect.top - contentRect.top)
        : side === 'left'
          ? Math.abs(arrowRect.right - contentRect.right)
          : Math.abs(arrowRect.left - contentRect.left);
    const pointsTowardAnchor = side === 'top' || side === 'bottom'
      ? arrowRect.left + arrowRect.width / 2 >= triggerRect.left && arrowRect.left + arrowRect.width / 2 <= triggerRect.right
      : arrowRect.top + arrowRect.height / 2 >= triggerRect.top && arrowRect.top + arrowRect.height / 2 <= triggerRect.bottom;
    return {
      side,
      arrowSide: arrow.getAttribute('data-side'),
      width: arrowStyle.width,
      height: arrowStyle.height,
      background: arrowStyle.backgroundColor,
      contentBackground: contentStyle.backgroundColor,
      rotate: arrowStyle.rotate,
      translate: arrowStyle.translate,
      wrapperTransform: arrowStyle.transform,
      edgeDistance,
      pointsTowardAnchor,
      tipVector,
      tipDotAnchor,
      inlineTop: arrow.style.top,
      arrowRect: { top: arrowRect.top, right: arrowRect.right, bottom: arrowRect.bottom, left: arrowRect.left },
      contentRect: { top: contentRect.top, right: contentRect.right, bottom: contentRect.bottom, left: contentRect.left },
    };
  }, await tooltipTrigger.elementHandle());
  if (
    arrowProof.side !== 'left' ||
    arrowProof.arrowSide !== arrowProof.side ||
    arrowProof.width !== '10px' || arrowProof.height !== '10px' ||
    arrowProof.background !== arrowProof.contentBackground ||
    arrowProof.rotate === 'none' || arrowProof.translate === 'none' ||
    arrowProof.wrapperTransform === 'none' || arrowProof.edgeDistance > 12 ||
    !arrowProof.pointsTowardAnchor || arrowProof.tipDotAnchor <= 0 || arrowProof.tipVector.x <= 0
  ) {
    throw new Error(`tooltip arrow did not resolve visually: ${JSON.stringify(arrowProof)}`);
  }
  console.log(`tooltip arrow: side=${arrowProof.side}, size=${arrowProof.width}, edge=${arrowProof.edgeDistance.toFixed(2)}px`);
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
