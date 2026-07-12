/** Tailwind v4 + Chromium proof for UI-62 toast icon/title row layout. */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const uiDir = dirname(dirname(fileURLToPath(import.meta.url)));
const wwwDir = resolve(uiDir, '../www');
const tailwind = join(wwwDir, 'node_modules/.bin/tailwindcss');
const theme = join(uiDir, 'registry/default/styles/theme.css');
const { chromium } = createRequire(join(wwwDir, 'package.json'))('playwright');
const cleanup = async ({ browser, scratch, primary, remove = rmSync }) => {
  const failures = [];
  const [closed] = await Promise.allSettled([browser?.close()]);
  if (closed.status === 'rejected') failures.push(closed.reason);
  try { remove(scratch, { recursive: true, force: true }); } catch (error) { failures.push(error); }
  if (!primary && failures.length) throw failures[0];
};

if (process.argv.includes('--self-test-cleanup')) {
  const primary = new Error('injected primary toast-row failure');
  const cleanupFailure = new Error('injected cleanup failure');
  let caughtPrimary;
  try {
    try { throw primary; } catch (error) { throw error; }
    finally { await cleanup({ browser: { close: async () => { throw cleanupFailure; } }, scratch: '/injected', primary, remove: () => { throw cleanupFailure; } }); }
  } catch (error) { caughtPrimary = error; }
  let caughtCleanup;
  try { await cleanup({ scratch: '/injected', remove: () => { throw cleanupFailure; } }); }
  catch (error) { caughtCleanup = error; }
  if (caughtPrimary !== primary || caughtCleanup !== cleanupFailure) throw new Error('UI-62 cleanup self-test failed');
  console.log('UI-62 cleanup self-test OK');
  process.exit(0);
}

const toastClass = 'pointer-events-auto flex w-[356px] max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-lg border bg-popover p-4 text-sm text-popover-foreground shadow-lg';
const headingClass = 'flex min-w-0 items-start gap-2 [&>[data-slot=toast-icon]]:shrink-0';
const titleClass = 'min-w-0 flex-1 font-medium wrap-break-word';
const icon = '<svg data-slot="toast-icon" class="size-4" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>';
const toast = (id, heading, typed, description, action = '') => `<li id="${id}" data-slot="toast" class="${toastClass}"><div data-slot="toast-heading" class="${headingClass}">${typed ? icon : ''}<div data-slot="toast-title" class="${titleClass}">${heading}</div></div>${description ? `<div data-slot="toast-description" class="text-muted-foreground">${description}</div>` : ''}${action}</li>`;
const fixture = `<main class="flex flex-col gap-4 p-4">${toast('typed', 'Saved successfully', true, 'Supporting description')}${toast('plain', 'Plain notification', false, '')}${toast('long', 'A very long toast title that must wrap without colliding with the action or escaping the viewport at phone width', true, 'A long supporting description remains a separate row.', '<button data-slot="toast-action" class="self-start rounded border px-2 py-1">Undo</button>')}</main>`;

const scratch = mkdtempSync(join(tmpdir(), 'nisli-ui-toast-row-e2e-'));
let browser;
let primary;
try {
  const input = join(scratch, 'input.css');
  const output = join(scratch, 'output.css');
  writeFileSync(join(scratch, 'fixture.html'), fixture);
  writeFileSync(input, `@import "tailwindcss";\n@import ${JSON.stringify(theme)};\n@source "./fixture.html";\n`);
  execFileSync(tailwind, ['-i', input, '-o', output, '--minify'], { cwd: wwwDir });
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`<style>${readFileSync(output, 'utf8')}</style>${fixture}`);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 720 });
    const result = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
      const typedIcon = rect('#typed [data-slot=toast-icon]');
      const typedTitle = rect('#typed [data-slot=toast-title]');
      const plainHeading = rect('#plain [data-slot=toast-heading]');
      const plainTitle = rect('#plain [data-slot=toast-title]');
      const longToast = rect('#long');
      const longTitle = rect('#long [data-slot=toast-title]');
      const action = rect('#long [data-slot=toast-action]');
      return { iconTop: typedIcon.top, titleTop: typedTitle.top, plainDelta: plainTitle.left - plainHeading.left, longWithin: longTitle.right <= longToast.right && action.top >= longTitle.bottom, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    if (Math.abs(result.iconTop - result.titleTop) > 1) throw new Error(`icon/title are not beside each other at ${width}: ${JSON.stringify(result)}`);
    if (Math.abs(result.plainDelta) > 1) throw new Error(`default no-icon title is indented at ${width}: ${JSON.stringify(result)}`);
    if (!result.longWithin || result.overflow) throw new Error(`long toast/action layout failed at ${width}: ${JSON.stringify(result)}`);
  }
  console.log('UI-62 toast row proof OK at 1280px and 390px');
} catch (error) { primary = error; throw error; }
finally { await cleanup({ browser, scratch, primary }); }
