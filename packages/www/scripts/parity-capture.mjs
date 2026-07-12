/**
 * Capture-only side-by-side harness for @nisli/ui criterion-2 human review.
 * It intentionally makes no visual comparison and emits no parity verdict.
 * See PARITY-CAPTURE.md for invocation, dependencies, and failure behavior.
 */
import { chromium } from 'playwright';
import { access, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REGISTRY = resolve(HERE, '../../ui/registry/registry.json');
const VIEWPORT = { width: 1440, height: 1000 };
const DEFAULT_OUT = resolve(tmpdir(), 'nisli-ui-parity', new Date().toISOString().replace(/[:.]/g, '-'));

const arg = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const has = (name) => process.argv.includes(`--${name}`);
const output = resolve(arg('out') ?? DEFAULT_OUT);
const nisliBase = (arg('nisli-base') ?? 'https://nisli.dev').replace(/\/$/, '');
const shadcnBase = (arg('shadcn-base') ?? 'https://ui.shadcn.com/view/new-york-v4').replace(/\/$/, '');
const timeout = Number(arg('timeout') ?? 20_000);
const requested = new Set((arg('names') ?? '').split(',').filter(Boolean));
const keepPartial = has('keep-partial');

const DEMO_OVERRIDES = {
  'form-field': { route: 'field-demo', reason: 'Registry FormField maps to shadcn Field.' },
  select: { route: 'native-select-demo', reason: 'Registry Select deliberately tracks native-select.tsx, not Radix select.tsx.' },
  toast: { route: 'sonner-demo', reason: 'shadcn deprecated Toast in favor of the Sonner demo.' },
  sidebar: { route: 'sidebar-07', reason: 'No sidebar-demo route; sidebar-07 is the deterministic broad canonical block.' },
};

const NO_UPSTREAM = {
  direction: 'Nisli direction provider has no public new-york-v4 default demo.',
  marker: 'AI/message primitive has no public new-york-v4 default demo.',
  message: 'AI/message primitive has no public new-york-v4 default demo.',
  bubble: 'Nisli chat primitive has no public new-york-v4 default demo.',
  attachment: 'Nisli chat primitive has no public new-york-v4 default demo.',
  'message-scroller': 'AI/message primitive has no public new-york-v4 default demo.',
};

// Mirrors packages/www/scripts/preview-sweep.mjs. These are the curated
// hydrated previews whose useful comparison state is open, not merely loaded.
const INTERACTIVE = new Set([
  'alert-dialog', 'combobox', 'context-menu', 'dialog', 'drawer',
  'dropdown-menu', 'hover-card', 'menubar', 'popover', 'sheet', 'tooltip',
]);

function demoRoute(name) {
  return DEMO_OVERRIDES[name]?.route ?? `${name}-demo`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

async function cleanupAfterRun({ browser, completed, staging, output, keepPartial, primaryFailure }) {
  const failures = [];
  const [browserClose] = await Promise.allSettled([browser?.close()]);
  if (browserClose.status === 'rejected') failures.push(browserClose.reason);

  if (!completed) {
    if (keepPartial) {
      const partial = `${output}.partial-${Date.now()}`;
      try {
        await rename(staging, partial);
        console.error(`capture aborted; partial artifacts kept at ${partial}`);
      } catch (error) {
        failures.push(error);
      }
    } else {
      try {
        await rm(staging, { recursive: true, force: true });
      } catch (error) {
        failures.push(error);
      }
    }
  }

  if (!primaryFailure && failures.length) throw failures[0];
}

if (has('self-test-cleanup')) {
  const root = await mkdtemp(join(tmpdir(), 'nisli-ui-parity-cleanup-test-'));
  const staging = join(root, 'staging');
  const target = join(root, 'capture');
  await mkdir(staging);
  await writeFile(join(staging, 'evidence.txt'), 'partial evidence\n');
  const primary = new Error('injected primary capture failure');
  const closeFailure = new Error('injected browser close failure');
  let caught;
  let primaryFailure;
  try {
    try {
      throw primary;
    } catch (error) {
      primaryFailure = error;
      throw error;
    } finally {
      await cleanupAfterRun({
        browser: { close: async () => { throw closeFailure; } },
        completed: false,
        staging,
        output: target,
        keepPartial: true,
        primaryFailure,
      });
    }
  } catch (error) {
    caught = error;
  }
  const entries = await readdir(root);
  const partial = entries.find((entry) => entry.startsWith('capture.partial-'));
  const retained = partial && await readFile(join(root, partial, 'evidence.txt'), 'utf8');
  await rm(root, { recursive: true, force: true });
  if (caught !== primary || retained !== 'partial evidence\n') {
    throw new Error('cleanup self-test failed: primary identity or partial retention was lost');
  }
  console.log('cleanup self-test OK: browser-close rejection did not mask primary failure; partial evidence retained');
  process.exit(0);
}

async function interact(page, name, scope) {
  if (!INTERACTIVE.has(name)) return { action: 'static' };
  // Match preview-sweep's content-slot guard: an open trigger cannot satisfy
  // this, and transparent content hosts still count when a descendant paints.
  // Radix tooltip content names its open modes instant-open/delayed-open, so
  // the upstream half accepts those two content-only states as open too.
  const visibleOpenCount = () => page.evaluate(() =>
    [...document.querySelectorAll('[data-slot$="-content"][data-state="open"],[data-slot$="-content"][data-state="instant-open"],[data-slot$="-content"][data-state="delayed-open"]')].filter((element) =>
      [...element.querySelectorAll('*'), element].some((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1 && getComputedStyle(node).visibility !== 'hidden';
      }),
    ).length,
  );
  const before = await visibleOpenCount();
  const specific = scope.locator(`[data-slot="${name}-trigger"]`).first();
  const trigger = await specific.count()
    ? specific
    : scope.locator('button, [data-slot*="trigger"], [aria-haspopup]').first();
  if (name === 'context-menu') await trigger.click({ button: 'right', timeout });
  else if (name === 'tooltip' || name === 'hover-card') {
    await trigger.hover({ timeout });
    await page.waitForTimeout(900);
  } else await trigger.click({ timeout });
  await page.waitForTimeout(500);
  const after = await visibleOpenCount();
  if (after <= before) throw new Error(`${name} interaction did not expose open content (${before}->${after})`);
  return {
    action: name === 'context-menu' ? 'right-click' : name === 'tooltip' || name === 'hover-card' ? 'hover' : 'click',
    visibleOpenCount: { before, after },
  };
}

async function captureNisli(page, name, target) {
  const url = `${nisliBase}/ui/${name}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout });
  const preview = page.locator(`[data-preview="${name}"]`).first();
  await preview.waitFor({ state: 'visible', timeout });
  await preview.scrollIntoViewIfNeeded();
  if (INTERACTIVE.has(name)) {
    await page.waitForFunction(
      (component) => document.querySelector(`[data-preview="${component}"]`)?.hasAttribute('data-hydrated'),
      name,
      { timeout },
    );
  }
  const interaction = await interact(page, name, preview);
  await page.screenshot({ path: target });
  return { url, interaction, status: 'captured' };
}

async function captureShadcn(page, name, target) {
  const route = demoRoute(name);
  const url = `${shadcnBase}/${route}`;
  if (NO_UPSTREAM[name]) return { url, interaction: 'none', status: 'no-upstream', reason: NO_UPSTREAM[name] };
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout });
  if (!response?.ok()) throw new Error(`HTTP ${response?.status() ?? 'no response'} for ${url}`);
  const interaction = await interact(page, name, page.locator('body'));
  await page.screenshot({ path: target });
  return { url, interaction, status: 'captured', mappingReason: DEMO_OVERRIDES[name]?.reason };
}

async function placeholder(page, title, detail, target) {
  await page.goto('about:blank', { waitUntil: 'load' }).catch(() => {});
  await page.setViewportSize(VIEWPORT);
  await page.setContent(`<main style="box-sizing:border-box;width:100vw;height:100vh;padding:64px;background:#fafafa;color:#18181b;font:18px/1.5 system-ui;display:grid;place-content:center;text-align:center"><section><h1>${escapeHtml(title)}</h1><p style="max-width:760px">${escapeHtml(detail)}</p></section></main>`);
  await page.screenshot({ path: target });
}

async function contactSheet(page, name, nisliPath, upstreamPath, record, target) {
  const [nisli, upstream] = await Promise.all([readFile(nisliPath), readFile(upstreamPath)]);
  await page.setViewportSize({ width: 2920, height: 1120 });
  const panel = (label, image, details) => `<section style="width:1440px"><h2 style="margin:0 0 8px">${escapeHtml(label)}</h2><p style="height:46px;margin:0 0 12px;color:#52525b;overflow:hidden">${escapeHtml(details)}</p><img style="display:block;width:1440px;height:1000px;object-fit:contain;object-position:top;background:white;border:1px solid #d4d4d8" src="data:image/png;base64,${image.toString('base64')}"></section>`;
  await page.setContent(`<main style="box-sizing:border-box;padding:14px;background:#f4f4f5;color:#18181b;font:16px/1.4 system-ui"><h1 style="margin:0 0 10px">${escapeHtml(name)} — human side-by-side capture (no automated verdict)</h1><div style="display:flex;gap:12px">${panel('nisli.dev', nisli, `${record.nisli.url} · interaction=${JSON.stringify(record.nisli.interaction)}`)}${panel('ui.shadcn.com', upstream, `${record.upstream.url} · status=${record.upstream.status} · interaction=${JSON.stringify(record.upstream.interaction)}`)}</div></main>`);
  await page.screenshot({ path: target, fullPage: true });
}

const registry = JSON.parse(await readFile(REGISTRY, 'utf8'));
const allNames = registry.items.filter((item) => item.type === 'ui').map((item) => item.name).sort();
if (new Set(allNames).size !== allNames.length) throw new Error('registry contains duplicate UI item names');
const names = requested.size ? allNames.filter((name) => requested.has(name)) : allNames;
const unknown = [...requested].filter((name) => !allNames.includes(name));
if (unknown.length) throw new Error(`unknown registry UI item(s): ${unknown.join(', ')}`);
if (!names.length) throw new Error('no registry UI items selected');

const plan = names.map((name) => ({
  name,
  nisliUrl: `${nisliBase}/ui/${name}`,
  upstreamUrl: `${shadcnBase}/${demoRoute(name)}`,
  upstreamDisposition: NO_UPSTREAM[name] ? 'no-upstream' : DEMO_OVERRIDES[name] ? 'override' : 'same-name',
  reason: NO_UPSTREAM[name] ?? DEMO_OVERRIDES[name]?.reason,
  interaction: INTERACTIVE.has(name) ? (name === 'context-menu' ? 'right-click' : name === 'tooltip' || name === 'hover-card' ? 'hover' : 'click') : 'static',
}));
if (has('plan')) {
  console.log(JSON.stringify({ count: plan.length, components: plan }, null, 2));
  process.exit(0);
}

await mkdir(dirname(output), { recursive: true });
await access(output).then(
  () => { throw new Error(`output already exists: ${output}`); },
  () => {},
);
const staging = await mkdtemp(join(dirname(output), '.ui-parity-capture-'));
let browser;
let completed = false;
let primaryFailure;
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  purpose: 'Human side-by-side review only; no automated visual verdict.',
  bases: { nisli: nisliBase, shadcn: shadcnBase },
  viewport: VIEWPORT,
  demoOverrides: DEMO_OVERRIDES,
  noUpstream: NO_UPSTREAM,
  components: [],
};

try {
  browser = await chromium.launch({ headless: !has('headed') });
  const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: 'light', reducedMotion: 'no-preference' });
  for (const name of names) {
    const directory = join(staging, name);
    await mkdir(directory, { recursive: true });
    const paths = {
      nisli: join(directory, 'nisli.png'),
      upstream: join(directory, 'shadcn.png'),
      contact: join(directory, 'contact-sheet.png'),
    };
    const record = { name, files: { nisli: `${name}/nisli.png`, upstream: `${name}/shadcn.png`, contactSheet: `${name}/contact-sheet.png` } };
    const nisliPage = await context.newPage();
    const upstreamPage = await context.newPage();
    const sheetPage = await context.newPage();
    try {
      try {
        record.nisli = await captureNisli(nisliPage, name, paths.nisli);
      } catch (error) {
        record.nisli = { url: `${nisliBase}/ui/${name}`, interaction: 'unknown', status: 'error', error: String(error) };
        await placeholder(nisliPage, 'Nisli capture failed', record.nisli.error, paths.nisli);
      }
      try {
        record.upstream = await captureShadcn(upstreamPage, name, paths.upstream);
        if (record.upstream.status === 'no-upstream') {
          await placeholder(upstreamPage, 'NO UPSTREAM DEFAULT DEMO', `${record.upstream.url}\n${record.upstream.reason}`, paths.upstream);
        }
      } catch (error) {
        record.upstream = { url: `${shadcnBase}/${demoRoute(name)}`, interaction: 'unknown', status: 'error', error: String(error), mappingReason: DEMO_OVERRIDES[name]?.reason };
        await placeholder(upstreamPage, 'shadcn capture failed', record.upstream.error, paths.upstream);
      }
      await contactSheet(sheetPage, name, paths.nisli, paths.upstream, record, paths.contact);
    } finally {
      await Promise.allSettled([nisliPage.close(), upstreamPage.close(), sheetPage.close()]);
    }
    manifest.components.push(record);
    console.log(`${name.padEnd(20)} nisli=${record.nisli.status.padEnd(11)} upstream=${record.upstream.status}`);
  }
  await writeFile(join(staging, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  if (manifest.components.length !== names.length || new Set(manifest.components.map((record) => record.name)).size !== names.length) {
    throw new Error(`manifest cardinality mismatch: expected ${names.length}, got ${manifest.components.length}`);
  }
  await writeFile(join(staging, 'README.txt'), 'Capture artifacts for human side-by-side review only. manifest.json records URLs, mappings, interactions, and failures. No automated visual verdict was performed.\n');
  await rename(staging, output);
  completed = true;
} catch (error) {
  primaryFailure = error;
  throw error;
} finally {
  await cleanupAfterRun({ browser, completed, staging, output, keepPartial, primaryFailure });
}

const failures = manifest.components.filter((record) => record.nisli.status === 'error' || record.upstream.status === 'error');
console.log(`\nWrote ${manifest.components.length} contact sheet(s) to ${output}`);
console.log('No automated visual verdict was performed. Review contact-sheet.png files manually.');
if (failures.length) {
  console.error(`Capture failures: ${failures.map((record) => record.name).join(', ')}`);
  process.exitCode = 1;
}
