/** Real Tailwind v4 + Chromium geometry proof for ButtonGroup cohesion. */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const uiDir = dirname(dirname(fileURLToPath(import.meta.url)));
const wwwDir = resolve(uiDir, '../www');
const theme = join(uiDir, 'registry/default/styles/theme.css');
const source = readFileSync(join(uiDir, 'registry/default/ui/button-group.ts'), 'utf8');
const tailwind = join(wwwDir, 'node_modules/.bin/tailwindcss');
const { chromium } = createRequire(join(wwwDir, 'package.json'))('playwright');

const cleanupAfterRun = async ({ browser, scratch, primaryFailure, remove = rmSync }) => {
  const failures = [];
  const [browserClose] = await Promise.allSettled([browser?.close()]);
  if (browserClose.status === 'rejected') failures.push(browserClose.reason);
  try { remove(scratch, { recursive: true, force: true }); } catch (error) { failures.push(error); }
  if (!primaryFailure && failures.length) throw failures[0];
};

if (process.argv.includes('--self-test-cleanup')) {
  const primary = new Error('injected primary button-group proof failure');
  const cleanup = new Error('injected cleanup failure');
  let primaryFailure;
  let caughtPrimary;
  try {
    try { throw primary; } catch (error) { primaryFailure = error; throw error; }
    finally {
      await cleanupAfterRun({
        browser: { close: async () => { throw cleanup; } },
        scratch: '/injected',
        primaryFailure,
        remove: () => { throw cleanup; },
      });
    }
  } catch (error) { caughtPrimary = error; }
  let caughtCleanup;
  try {
    await cleanupAfterRun({ browser: { close: async () => {} }, scratch: '/injected', remove: () => { throw cleanup; } });
  } catch (error) { caughtCleanup = error; }
  if (caughtPrimary !== primary || caughtCleanup !== cleanup) throw new Error('button-group cleanup self-test failed');
  console.log('button-group cleanup self-test OK');
  process.exit(0);
}

const translated = [
  'has-[>ui-button-group>[data-slot=button-group]]:gap-2',
  '[&>ui-button:not(:first-child)>[data-slot=button]]:border-l-0',
  '[&>ui-button:not(:last-child)>[data-slot=button]]:rounded-r-none',
  '[&>ui-button:not(:first-child)>[data-slot=button]]:border-t-0',
];
for (const token of translated) {
  if (!source.includes(token)) throw new Error(`registry ButtonGroup is missing translated selector: ${token}`);
}

const groupClass = "flex w-fit items-stretch [&>ui-button>[data-slot=button]]:focus-visible:relative [&>ui-button>[data-slot=button]]:focus-visible:z-10 [&>ui-button:not(:first-child)>[data-slot=button]]:rounded-l-none [&>ui-button:not(:first-child)>[data-slot=button]]:border-l-0 [&>ui-button:not(:last-child)>[data-slot=button]]:rounded-r-none";
const buttonClass = 'inline-flex shrink-0 items-center justify-center rounded-md border bg-background h-9 px-4 py-2 text-sm';
const separatorClass = 'relative m-0! self-stretch shrink-0 bg-input data-[orientation=vertical]:h-auto data-[orientation=vertical]:w-px';
const button = (label) => `<ui-button style="display:contents"><button data-slot="button" class="${buttonClass}">${label}</button></ui-button>`;
const fixture = `<main class="p-4">
  <div id="joined" role="group" data-slot="button-group" class="${groupClass}">${button('Cut')}${button('Copy')}${button('Paste')}</div>
  <div id="split" role="group" data-slot="button-group" class="mt-4 ${groupClass}">${button('Save')}<ui-button-group-separator style="display:contents"><div data-slot="button-group-separator" data-orientation="vertical" class="${separatorClass}"></div></ui-button-group-separator>${button('More')}</div>
  <output id="status">none</output>
</main>`;

const scratch = mkdtempSync(join(tmpdir(), 'nisli-ui-button-group-e2e-'));
const input = join(scratch, 'input.css');
const fixturePath = join(scratch, 'fixture.html');
const output = join(scratch, 'output.css');
let browser;
let primaryFailure;

try {
  writeFileSync(fixturePath, fixture);
  writeFileSync(input, `@import "tailwindcss";\n@import ${JSON.stringify(theme)};\n@source "./fixture.html";\n`);
  execFileSync(tailwind, ['-i', input, '-o', output, '--minify'], { cwd: wwwDir, stdio: ['ignore', 'pipe', 'pipe'] });
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`<style>${readFileSync(output, 'utf8')}</style>${fixture}`);
  await page.evaluate(() => {
    for (const button of document.querySelectorAll('#joined button')) {
      button.addEventListener('click', () => { document.getElementById('status').textContent = button.textContent; });
    }
  });

  const measure = () => page.evaluate(() => {
    const group = document.getElementById('joined');
    const buttons = [...group.querySelectorAll('button')];
    const rects = buttons.map((button) => button.getBoundingClientRect());
    const styles = buttons.map((button) => getComputedStyle(button));
    const split = document.getElementById('split');
    const splitButtons = [...split.querySelectorAll('button')];
    const splitChildren = [splitButtons[0], split.querySelector('[data-slot=button-group-separator]'), splitButtons[1]];
    const splitRects = splitChildren.map((element) => element.getBoundingClientRect());
    return {
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      gaps: [rects[1].left - rects[0].right, rects[2].left - rects[1].right],
      borderLeft: styles.map((style) => style.borderLeftWidth),
      radii: styles.map((style) => [style.borderTopLeftRadius, style.borderTopRightRadius]),
      outer: { left: rects[0].left, right: rects[2].right },
      split: { gaps: [splitRects[1].left - splitRects[0].right, splitRects[2].left - splitRects[1].right], separatorWidth: splitRects[1].width },
    };
  });

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 720 });
    const result = await measure();
    if (result.gaps.some((gap) => Math.abs(gap) > 0.01)) throw new Error(`joined group has gaps at ${width}: ${JSON.stringify(result)}`);
    if (result.borderLeft.slice(1).some((value) => value !== '0px')) throw new Error(`shared borders did not collapse at ${width}: ${JSON.stringify(result)}`);
    if (result.radii[0][0] === '0px' || result.radii[0][1] !== '0px' || result.radii[1].some((value) => value !== '0px') || result.radii[2][0] !== '0px' || result.radii[2][1] === '0px') {
      throw new Error(`only outer corners must remain rounded at ${width}: ${JSON.stringify(result)}`);
    }
    if (result.documentWidth > width || result.outer.right > width) throw new Error(`group overflows ${width}px viewport: ${JSON.stringify(result)}`);
    if (result.split.gaps.some((gap) => Math.abs(gap) > 0.01) || Math.abs(result.split.separatorWidth - 1) > 0.01) throw new Error(`separator composition broke at ${width}: ${JSON.stringify(result)}`);
  }
  await page.locator('#joined button').nth(1).click();
  if (await page.locator('#status').textContent() !== 'Copy') throw new Error('button-group click did not remain observable');
  console.log('button-group geometry proof: joined borders/corners + separator + click pass at 1280px and 390px');
} catch (error) {
  primaryFailure = error;
  throw error;
} finally {
  await cleanupAfterRun({ browser, scratch, primaryFailure });
}
