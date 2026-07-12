/** Tailwind v4 + Chromium proof for UI-57 transparent-host position rules. */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const uiDir = dirname(dirname(fileURLToPath(import.meta.url)));
const wwwDir = resolve(uiDir, '../www');
const theme = join(uiDir, 'registry/default/styles/theme.css');
const tailwind = join(wwwDir, 'node_modules/.bin/tailwindcss');
const { chromium } = createRequire(join(wwwDir, 'package.json'))('playwright');
const cleanup = async ({ browser, scratch, primary, remove = rmSync }) => {
  const failures = [];
  const [closed] = await Promise.allSettled([browser?.close()]);
  if (closed.status === 'rejected') failures.push(closed.reason);
  try { remove(scratch, { recursive: true, force: true }); } catch (error) { failures.push(error); }
  if (!primary && failures.length) throw failures[0];
};

if (process.argv.includes('--self-test-cleanup')) {
  const primary = new Error('injected primary positional-host failure');
  const cleanupFailure = new Error('injected cleanup failure');
  let caughtPrimary;
  try {
    try { throw primary; } catch (error) { throw error; }
    finally { await cleanup({ browser: { close: async () => { throw cleanupFailure; } }, scratch: '/injected', primary, remove: () => { throw cleanupFailure; } }); }
  } catch (error) { caughtPrimary = error; }
  let caughtCleanup;
  try { await cleanup({ scratch: '/injected', remove: () => { throw cleanupFailure; } }); }
  catch (error) { caughtCleanup = error; }
  if (caughtPrimary !== primary || caughtCleanup !== cleanupFailure) throw new Error('UI-57 cleanup self-test failed');
  console.log('UI-57 cleanup self-test OK');
  process.exit(0);
}

const toggleClass = "group/toggle-group flex w-fit items-center gap-[--spacing(var(--gap))] rounded-md [&>ui-toggle-group-item:first-child>[data-slot=toggle-group-item][data-spacing='0']]:rounded-l-md [&>ui-toggle-group-item:last-child>[data-slot=toggle-group-item][data-spacing='0']]:rounded-r-md [&>ui-toggle-group-item:first-child>[data-slot=toggle-group-item][data-spacing='0'][data-variant=outline]]:border-l";
const toggleItemClass = "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground border border-input bg-transparent shadow-xs h-9 min-w-9 px-2 w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10 data-[spacing=0]:rounded-none data-[spacing=0]:shadow-none data-[spacing=0]:data-[variant=outline]:border-l-0";
const otpClass = 'flex items-center [&>ui-input-otp-slot:first-child>[data-slot=input-otp-slot]]:rounded-l-md [&>ui-input-otp-slot:first-child>[data-slot=input-otp-slot]]:border-l [&>ui-input-otp-slot:last-child>[data-slot=input-otp-slot]]:rounded-r-md';
const otpItemClass = 'relative flex h-9 w-9 items-center justify-center border-y border-r border-input text-sm shadow-xs transition-all outline-none aria-invalid:border-destructive data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-[3px] data-[active=true]:ring-ring/50';
const accordionClass = '[&>ui-accordion-item:last-child>[data-slot=accordion-item]]:border-b-0';
const fixture = `<main class="p-4">
<div id="toggle" data-orientation="horizontal" class="${toggleClass}">${['A', 'B', 'C'].map((x, i) => `<ui-toggle-group-item style="display:contents"><button data-slot="toggle-group-item" data-spacing="0" data-variant="outline" data-state="${i === 1 ? 'on' : 'off'}" class="${toggleItemClass}">${x}</button></ui-toggle-group-item>`).join('')}</div>
<div id="otp" data-orientation="horizontal" class="mt-4 ${otpClass}">${[1, 2, 3].map((x, i) => `<ui-input-otp-slot style="display:contents"><div data-slot="input-otp-slot" data-active="${i === 1}" class="${otpItemClass}">${x}</div></ui-input-otp-slot>`).join('')}</div>
<div id="accordion" data-orientation="vertical" class="mt-4 ${accordionClass}">${['open', 'closed', 'closed'].map((state) => `<ui-accordion-item style="display:contents"><div data-slot="accordion-item" data-state="${state}" class="border-b">${state}</div></ui-accordion-item>`).join('')}</div>
</main>`;

const scratch = mkdtempSync(join(tmpdir(), 'nisli-ui-positional-e2e-'));
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
      const styles = (selector) => [...document.querySelectorAll(selector)].map((el) => {
        const s = getComputedStyle(el);
        return { left: s.borderLeftWidth, bottom: s.borderBottomWidth, tl: s.borderTopLeftRadius, tr: s.borderTopRightRadius };
      });
      return { toggle: styles('#toggle button'), otp: styles('#otp [data-slot=input-otp-slot]'), accordion: styles('#accordion [data-slot=accordion-item]'), overflow: document.documentElement.scrollWidth > innerWidth };
    });
    if (result.toggle[0].left === '0px' || result.toggle[0].tl === '0px' || result.toggle[1].tl !== '0px' || result.toggle[2].tr === '0px') throw new Error(`toggle position failed at ${width}: ${JSON.stringify(result)}`);
    if (result.otp[0].left === '0px' || result.otp[0].tl === '0px' || result.otp[1].tl !== '0px' || result.otp[2].tr === '0px') throw new Error(`OTP position failed at ${width}: ${JSON.stringify(result)}`);
    if (result.accordion[0].bottom === '0px' || result.accordion[1].bottom === '0px' || result.accordion[2].bottom !== '0px') throw new Error(`accordion position failed at ${width}: ${JSON.stringify(result)}`);
    if (result.overflow) throw new Error(`UI-57 fixture overflow at ${width}`);
  }
  console.log('UI-57 positional-host proof OK at 1280px and 390px');
} catch (error) { primary = error; throw error; }
finally { await cleanup({ browser, scratch, primary }); }
