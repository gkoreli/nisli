/**
 * Compile the copied theme with real Tailwind v4 and prove its upstream base
 * border/outline defaults in Chromium. Uses www's build-only CLI/browser deps;
 * all generated files live under the OS temp directory and are always removed.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const uiDir = dirname(dirname(fileURLToPath(import.meta.url)));
const wwwDir = resolve(uiDir, '../www');
const theme = join(uiDir, 'registry/default/styles/theme.css');
const cleanupAfterRun = async ({ browser, scratch, primaryFailure, remove = rmSync }) => {
  const failures = [];
  const [browserClose] = await Promise.allSettled([browser?.close()]);
  if (browserClose.status === 'rejected') failures.push(browserClose.reason);
  try {
    remove(scratch, { recursive: true, force: true });
  } catch (error) {
    failures.push(error);
  }
  if (!primaryFailure && failures.length) throw failures[0];
};

if (process.argv.includes('--self-test-cleanup')) {
  const primary = new Error('injected primary theme proof failure');
  const closeFailure = new Error('injected browser close failure');
  const removeFailure = new Error('injected scratch removal failure');
  let primaryFailure;
  let caughtPrimary;
  try {
    try {
      throw primary;
    } catch (error) {
      primaryFailure = error;
      throw error;
    } finally {
      await cleanupAfterRun({
        browser: { close: async () => { throw closeFailure; } },
        scratch: '/injected-scratch',
        primaryFailure,
        remove: () => { throw removeFailure; },
      });
    }
  } catch (error) {
    caughtPrimary = error;
  }

  let caughtCleanup;
  try {
    await cleanupAfterRun({
      browser: { close: async () => {} },
      scratch: '/injected-scratch',
      remove: () => { throw removeFailure; },
    });
  } catch (error) {
    caughtCleanup = error;
  }
  if (caughtPrimary !== primary || caughtCleanup !== removeFailure) {
    throw new Error('theme cleanup self-test lost primary identity or cleanup-only surfacing');
  }
  console.log('theme cleanup self-test OK: primary preserved; cleanup-only failure surfaced');
  process.exit(0);
}

const scratch = mkdtempSync(join(tmpdir(), 'nisli-ui-theme-e2e-'));
const input = join(scratch, 'input.css');
const output = join(scratch, 'output.css');
const tailwind = join(wwwDir, 'node_modules/.bin/tailwindcss');
const requireFromWww = createRequire(join(wwwDir, 'package.json'));
const { chromium } = requireFromWww('playwright');
let browser;
let primaryFailure;

try {
  writeFileSync(input, `@import "tailwindcss";
@import "tw-animate-css";
@import ${JSON.stringify(theme)};
@source inline("border border-border outline outline-ring/50 text-foreground");
`);
  execFileSync(tailwind, ['-i', input, '-o', output, '--minify'], {
    cwd: wwwDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`<style>${readFileSync(output, 'utf8')}</style>
    <div id="bare" class="border outline text-foreground">bare</div>
    <div id="explicit" class="border border-border outline outline-ring/50 text-foreground">explicit</div>`);
  const result = await page.evaluate(() => {
    const values = (id) => {
      const style = getComputedStyle(document.getElementById(id));
      return {
        border: style.borderTopColor,
        outline: style.outlineColor,
        color: style.color,
      };
    };
    return { bare: values('bare'), explicit: values('explicit') };
  });
  if (result.bare.border !== result.explicit.border || result.bare.border === result.bare.color) {
    throw new Error(`bare border did not resolve border-border: ${JSON.stringify(result)}`);
  }
  if (result.bare.outline !== result.explicit.outline || result.bare.outline === result.bare.color) {
    throw new Error(`bare outline did not resolve outline-ring/50: ${JSON.stringify(result)}`);
  }
  console.log(`theme base proof: border=${result.bare.border}, outline=${result.bare.outline}, currentColor=${result.bare.color}`);
} catch (error) {
  primaryFailure = error;
  throw error;
} finally {
  await cleanupAfterRun({ browser, scratch, primaryFailure });
}
