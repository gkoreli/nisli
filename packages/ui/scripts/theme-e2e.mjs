/**
 * Compile the copied theme with real Tailwind v4 and prove, in Chromium:
 *   1. its upstream base border/outline defaults (UI-55);
 *   2. every token resolves to its light arm under `color-scheme: light`, and
 *      to its dark arm both inside a nested `.dark` region and after a root
 *      `.dark` flip (bet 08 batch 0 — `light-dark()`);
 *   3. a theme flip interpolates rather than snaps, which only the `@property`
 *      registrations make possible (bet 08 batch 0);
 *   4. the `field-invalid` / `field-disabled` container style queries actually
 *      reach the painted control through a `display:contents` host, paint what
 *      the `aria-invalid` path paints, and leave that attribute path working on
 *      its own (bet 08 batch 1).
 * Uses www's build-only CLI/browser deps; all generated files live under the OS
 * temp directory and are always removed. Nothing here builds www or touches its
 * dist.
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

  // Batch 1: the style-query variants are part of the file's contract — without
  // the declarations Tailwind drops every `field-invalid:` utility silently.
  for (const variant of ['field-invalid', 'field-disabled']) {
    if (!source.includes(`@custom-variant ${variant} (@container style(--${variant}: true));`)) {
      throw new Error(`theme.css: missing the \`@custom-variant ${variant}\` style-query declaration`);
    }
  }
  return tokens;
};

/**
 * Pull a component's real class string out of its registry source, so the proof
 * below styles its probes with exactly what ships (no transcribed copy to rot).
 */
const classString = (file, pattern) => {
  const source = readFileSync(join(uiDir, 'registry/default/ui', file), 'utf8');
  const match = source.match(pattern);
  if (!match) throw new Error(`${file}: could not extract a class string with ${pattern}`);
  if (match[1].includes("'")) throw new Error(`${file}: class string contains a quote the probe cannot inline`);
  return match[1];
};

const scratch = mkdtempSync(join(tmpdir(), 'nisli-ui-theme-e2e-'));
const input = join(scratch, 'input.css');
const output = join(scratch, 'output.css');
const probe = join(scratch, 'probe.html');
const tailwind = join(wwwDir, 'node_modules/.bin/tailwindcss');
const requireFromWww = createRequire(join(wwwDir, 'package.json'));
const { chromium } = requireFromWww('playwright');
let browser;
let primaryFailure;

try {
  const tokens = readThemeContract(readFileSync(theme, 'utf8'));

  // ── Batch 1 probe markup, built from the shipped class strings ──────
  // Each control is nested inside a `style="display:contents"` host, which is
  // exactly what `transparentHost()` writes at runtime — so the probe tests the
  // real obstacle: a selector cannot cross that host, an inherited custom
  // property can.
  const destructiveToken = tokens.find((token) => token.name === '--destructive');
  const inputToken = tokens.find((token) => token.name === '--input');
  if (!destructiveToken || !inputToken) throw new Error('theme.css: expected --destructive and --input tokens');

  const fieldClasses = classString('form-field.ts', /export const fieldVariants = cv\(\n {2}'([^']*)',/);
  const fieldLabelClasses = classString('form-field.ts', /export const fieldLabelClasses =\n {2}'([^']*)';/);
  const controls = [
    {
      key: 'input',
      host: 'ui-input',
      classes: classString('input.ts', /export const inputClasses =\n {2}'([^']*)';/),
      paint: (attrs, classes) => `<input ${attrs} class='${classes}'>`,
    },
    {
      key: 'textarea',
      host: 'ui-textarea',
      classes: classString('textarea.ts', /export const textareaClasses =\n {2}'([^']*)';/),
      paint: (attrs, classes) => `<textarea ${attrs} class='${classes}'></textarea>`,
    },
    {
      key: 'select',
      host: 'ui-select',
      classes: classString('select.ts', /export const selectClasses =\n {2}'([^']*)';/),
      paint: (attrs, classes) => `<select ${attrs} class='${classes}'><option>a</option></select>`,
    },
    {
      key: 'checkbox',
      host: 'ui-checkbox',
      classes: classString('checkbox.ts', /export const checkboxClasses =\n {2}'([^']*)';/),
      paint: (attrs, classes) => `<input type="checkbox" ${attrs} class='${classes}'>`,
    },
    {
      key: 'radio',
      host: 'ui-radio-group-item',
      classes: classString('radio-group.ts', /export const radioItemClasses =\n {2}'([^']*)';/),
      paint: (attrs, classes) => `<input type="radio" ${attrs} class='${classes}'>`,
    },
  ];
  const hosted = (control, id, attrs = '') =>
    `<${control.host} style="display:contents">${control.paint(`id="${id}" ${attrs}`, control.classes)}</${control.host}>`;
  const row = (suffix, attrs) => controls.map((control) => hosted(control, `${control.key}-${suffix}`, attrs)).join('');

  const probeMarkup = `<div id="refs">
  <div data-ref="destructive" style="background-color: ${destructiveToken.light}"></div>
  <div data-ref="input" style="background-color: ${inputToken.light}"></div>
</div>
<div data-slot="field" data-invalid="true" class='${fieldClasses}'>${row('field-invalid')}</div>
<div data-slot="field" class='${fieldClasses}'>${row('field-valid')}</div>
<div id="attribute-only">${controls.map((control) => control.paint(`id="${control.key}-aria-invalid" aria-invalid="true"`, control.classes)).join('')}</div>
<div id="consumer-property" style="--field-invalid: true">${row('consumer')}</div>
<label id="label-plain" class='${fieldLabelClasses}'>label</label>
<div style="--field-disabled: true"><label id="label-field-disabled" class='${fieldLabelClasses}'>label</label></div>
`;
  writeFileSync(probe, probeMarkup);

  writeFileSync(input, `@import "tailwindcss";
@import "tw-animate-css";
@import ${JSON.stringify(theme)};
@source inline("border border-border outline outline-ring/50 text-foreground");
@source "./probe.html";
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

  // 4. Container style queries: the field publishes --field-invalid, every
  //    painted control reads it THROUGH its display:contents host, and the
  //    aria-invalid path still paints on its own.
  await page.setContent(`<style>${compiled}</style>${probeMarkup}`);
  const fields = await page.evaluate((keys) => {
    const paint = (id) => {
      const el = document.getElementById(id);
      if (!el) throw new Error(`probe element missing: ${id}`);
      const style = getComputedStyle(el);
      return {
        border: style.borderTopColor,
        ring: style.getPropertyValue('--tw-ring-color').trim(),
        opacity: style.opacity,
      };
    };
    return {
      refs: Object.fromEntries(
        [...document.querySelectorAll('#refs > div')]
          .map((el) => [el.dataset.ref, getComputedStyle(el).backgroundColor]),
      ),
      controls: Object.fromEntries(keys.map((key) => [key, {
        fieldInvalid: paint(`${key}-field-invalid`),
        fieldValid: paint(`${key}-field-valid`),
        ariaInvalid: paint(`${key}-aria-invalid`),
        consumer: paint(`${key}-consumer`),
      }])),
      labels: { plain: paint('label-plain'), disabled: paint('label-field-disabled') },
    };
  }, controls.map((control) => control.key));

  const { destructive, input: inputBorder } = fields.refs;
  if (destructive === inputBorder) {
    throw new Error('--destructive and --input serialise identically; the style-query proof would be vacuous');
  }
  for (const { key } of controls) {
    const seen = { key, ...fields.controls[key] };
    if (seen.fieldValid.border !== inputBorder) {
      throw new Error(`baseline border is not border-input, so the invalid comparison means nothing: ${JSON.stringify(seen)}`);
    }
    if (seen.fieldInvalid.border !== destructive) {
      throw new Error(`the field-invalid style query did not reach the painted control through its display:contents host: ${JSON.stringify(seen)}`);
    }
    if (seen.consumer.border !== destructive) {
      throw new Error(`a consumer-set --field-invalid on a plain wrapper did not paint the control: ${JSON.stringify(seen)}`);
    }
    if (seen.ariaInvalid.border !== destructive) {
      throw new Error(`the retained aria-invalid attribute path stopped painting on its own: ${JSON.stringify(seen)}`);
    }
    if (seen.fieldInvalid.ring !== seen.ariaInvalid.ring || seen.fieldInvalid.ring === seen.fieldValid.ring) {
      throw new Error(`the two paths disagree on the destructive ring colour: ${JSON.stringify(seen)}`);
    }
  }
  if (fields.labels.plain.opacity !== '1' || fields.labels.disabled.opacity !== '0.5') {
    throw new Error(`--field-disabled did not dim the field label: ${JSON.stringify(fields.labels)}`);
  }
  console.log(`theme style-query proof: ${controls.length} control families paint ${destructive} from an inherited --field-invalid (baseline ${inputBorder}), matching the aria-invalid path's ring ${fields.controls.input.ariaInvalid.ring}; --field-disabled dims a label to ${fields.labels.disabled.opacity}`);
} catch (error) {
  primaryFailure = error;
  throw error;
} finally {
  await cleanupAfterRun({ browser, scratch, primaryFailure });
}
