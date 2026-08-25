/**
 * Compile the copied theme with real Tailwind v4 and prove, in Chromium:
 *   1. its upstream base border/outline defaults (UI-55);
 *   2. every token resolves to its light arm under `color-scheme: light`, and
 *      to its dark arm both inside a nested `.dark` region and after a root
 *      `.dark` flip (bet 08 batch 0 — `light-dark()`);
 *   3. a theme flip interpolates rather than snaps, which only the `@property`
 *      registrations make possible (bet 08 batch 0).
 * Uses www's build-only CLI/browser deps; all generated files live under the OS
 * temp directory and are always removed.
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

/**
 * Read the shared `:root, .dark` block as {name, light, dark} triples, and hold
 * the source to the shape batch 0 established: the duplicated `.dark` token
 * block is gone, every colour token is a `light-dark()` pair, and every pair is
 * registered with its light arm as the initial value.
 */
const readThemeContract = (source) => {
  if (!/^\.dark \{\n {2}color-scheme: dark;\n\}/m.test(source)) {
    throw new Error('theme.css: the standalone `.dark` rule must carry color-scheme only — the duplicated token block is meant to be gone');
  }
  const block = source.match(/^:root,\n\.dark \{\n([\s\S]*?)\n\}/m);
  if (!block) throw new Error('theme.css: could not find the shared `:root, .dark` token block');

  const tokens = block[1].split('\n').map((line) => {
    const declaration = line.match(/^ {2}(--[\w-]+): light-dark\((.+)\);$/);
    if (!declaration) throw new Error(`theme.css: shared token block holds a non-light-dark() line: ${line}`);
    const [, name, args] = declaration;
    let depth = 0;
    let comma = -1;
    for (let i = 0; i < args.length && comma < 0; i += 1) {
      if (args[i] === '(') depth += 1;
      else if (args[i] === ')') depth -= 1;
      else if (args[i] === ',' && depth === 0) comma = i;
    }
    if (comma < 0) throw new Error(`theme.css: ${name} has no top-level comma in its light-dark() pair`);
    return { name, light: args.slice(0, comma).trim(), dark: args.slice(comma + 1).trim() };
  });

  const registrations = new Map(
    [...source.matchAll(/@property (--[\w-]+) \{ syntax: "<color>"; inherits: true; initial-value: (.+); \}/g)]
      .map((match) => [match[1], match[2]]),
  );
  for (const { name, light } of tokens) {
    if (!registrations.has(name)) throw new Error(`theme.css: ${name} is a colour token but has no @property registration`);
    if (registrations.get(name) !== light) {
      throw new Error(`theme.css: ${name} registers initial-value ${registrations.get(name)} but its light arm is ${light}`);
    }
    registrations.delete(name);
  }
  if (registrations.size) {
    throw new Error(`theme.css: @property registers tokens absent from the shared block: ${[...registrations.keys()].join(', ')}`);
  }
  return tokens;
};

const scratch = mkdtempSync(join(tmpdir(), 'nisli-ui-theme-e2e-'));
const input = join(scratch, 'input.css');
const output = join(scratch, 'output.css');
const tailwind = join(wwwDir, 'node_modules/.bin/tailwindcss');
const requireFromWww = createRequire(join(wwwDir, 'package.json'));
const { chromium } = requireFromWww('playwright');
let browser;
let primaryFailure;

try {
  const tokens = readThemeContract(readFileSync(theme, 'utf8'));
  writeFileSync(input, `@import "tailwindcss";
@import "tw-animate-css";
@import ${JSON.stringify(theme)};
@source inline("border border-border outline outline-ring/50 text-foreground");
`);
  execFileSync(tailwind, ['-i', input, '-o', output, '--minify'], {
    cwd: wwwDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const compiled = readFileSync(output, 'utf8');

  browser = await chromium.launch();
  const page = await browser.newPage();

  // 1. UI-55: bare `border`/`outline` resolve the tokens, not currentColor.
  await page.setContent(`<style>${compiled}</style>
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

  // 2. light-dark(): every token, in light, in a nested `.dark` region, and
  //    after a root flip. Probes paint the token; references paint the literal
  //    arm read out of theme.css, so both sides serialise the same way.
  const probes = tokens.map((token) => `<div style="background-color: var(${token.name})"></div>`).join('');
  const references = tokens
    .map((token) => `<div data-arm="light" style="background-color: ${token.light}"></div>`
      + `<div data-arm="dark" style="background-color: ${token.dark}"></div>`)
    .join('');
  await page.setContent(`<style>${compiled}</style>
    <div id="root-probes">${probes}</div>
    <div id="nested-probes" class="dark">${probes}</div>
    <div id="references">${references}</div>`);
  const readModes = () => page.evaluate(() => {
    const paint = (selector) => [...document.querySelectorAll(selector)]
      .map((el) => getComputedStyle(el).backgroundColor);
    return {
      root: paint('#root-probes > div'),
      nested: paint('#nested-probes > div'),
      light: paint('#references > [data-arm=light]'),
      dark: paint('#references > [data-arm=dark]'),
    };
  });
  const beforeFlip = await readModes();
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  const afterFlip = await readModes();

  let differing = 0;
  tokens.forEach((token, index) => {
    const expectedLight = beforeFlip.light[index];
    const expectedDark = beforeFlip.dark[index];
    const seen = {
      token: token.name,
      light: beforeFlip.root[index],
      nested: beforeFlip.nested[index],
      flipped: afterFlip.root[index],
      expectedLight,
      expectedDark,
    };
    if (seen.light !== expectedLight) throw new Error(`light mode did not resolve the light arm: ${JSON.stringify(seen)}`);
    if (seen.nested !== expectedDark) throw new Error(`nested .dark region did not resolve the dark arm: ${JSON.stringify(seen)}`);
    if (seen.flipped !== expectedDark) throw new Error(`root .dark flip did not resolve the dark arm: ${JSON.stringify(seen)}`);
    if (expectedLight !== expectedDark) {
      differing += 1;
      if (seen.light === seen.nested) throw new Error(`token did not change between modes: ${JSON.stringify(seen)}`);
    }
  });
  if (differing < tokens.length / 2) {
    throw new Error(`only ${differing}/${tokens.length} tokens differ between arms — the mode proof is near-vacuous`);
  }
  console.log(`theme light-dark proof: ${tokens.length} tokens match both arms in light, nested .dark, and flipped root (${differing} differ between modes)`);

  // 3. @property: a flip interpolates. `--background` is transitioned on the
  //    root; `--foreground` is not, so it is the snap control.
  const background = tokens.find((token) => token.name === '--background');
  const foreground = tokens.find((token) => token.name === '--foreground');
  if (!background || !foreground) throw new Error('theme.css: expected --background and --foreground tokens');
  await page.setContent(`<style>${compiled}</style>
    <style>
      :root { transition: --background 2s linear; }
      #interpolated { background-color: var(--background); }
      #control { background-color: var(--foreground); }
      #background-light { background-color: ${background.light}; }
      #background-dark { background-color: ${background.dark}; }
      #foreground-dark { background-color: ${foreground.dark}; }
    </style>
    <div id="interpolated"></div><div id="control"></div>
    <div id="background-light"></div><div id="background-dark"></div><div id="foreground-dark"></div>`);
  const flip = await page.evaluate(async () => {
    const paint = (id) => getComputedStyle(document.getElementById(id)).backgroundColor;
    const wait = (ms) => new Promise((settle) => { setTimeout(settle, ms); });
    const endpoints = {
      backgroundLight: paint('background-light'),
      backgroundDark: paint('background-dark'),
      foregroundDark: paint('foreground-dark'),
    };
    void document.documentElement.offsetWidth;
    document.documentElement.classList.add('dark');
    await wait(500);
    const early = { interpolated: paint('interpolated'), control: paint('control') };
    await wait(700);
    const late = paint('interpolated');
    await wait(1200);
    return { ...endpoints, early, late, settled: paint('interpolated') };
  });
  const { backgroundLight, backgroundDark, foregroundDark, early, late, settled } = flip;
  if (backgroundLight === backgroundDark) throw new Error('--background arms are identical; the transition proof would be vacuous');
  if (early.control !== foregroundDark) {
    throw new Error(`untransitioned control did not snap to its dark arm — the flip itself did not land: ${JSON.stringify(flip)}`);
  }
  for (const [label, sample] of [['500ms', early.interpolated], ['1200ms', late]]) {
    if (sample === backgroundLight || sample === backgroundDark) {
      throw new Error(`--background snapped instead of interpolating at ${label}: ${JSON.stringify(flip)}`);
    }
  }
  if (early.interpolated === late) throw new Error(`--background stalled mid-transition: ${JSON.stringify(flip)}`);
  if (settled !== backgroundDark) throw new Error(`--background did not settle on its dark arm: ${JSON.stringify(flip)}`);
  console.log(`theme transition proof: --background ${backgroundLight} -> ${early.interpolated} -> ${late} -> ${settled} while the untransitioned control snapped to ${early.control}`);
} catch (error) {
  primaryFailure = error;
  throw error;
} finally {
  await cleanupAfterRun({ browser, scratch, primaryFailure });
}
