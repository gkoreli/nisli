/**
 * BET05 falsification probe — "can an independently loaded component module
 * reconstruct the setup inputs that produced an SSG host?"
 *
 * Implements the cheapest decisive experiment specified at
 * docs/research/2026-08-platform-sweep/reviews/bet-05-adopt-islands.review.md:163-175.
 * THE EXPECTED OUTCOME IS FAILURE: a red assertion table is the deliverable.
 *
 *   node docs/research/2026-08-platform-sweep/experiments/bet-05-adopt-probe/adopt-probe.mjs
 *
 * Structural invariants of the harness itself throw (node:assert/strict); the
 * probe's own assertions are collected, tabulated, and reported, then the
 * process exits 1 if any of them failed. Playwright and Vite are resolved from
 * @nisli/www's devDependencies (packages/www/package.json:31-33) — this
 * experiment adds no dependency of its own.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..', '..', '..');
const wwwRequire = createRequire(join(repoRoot, 'packages', 'www', 'package.json'));
// playwright's entry is CJS, so the named export lives on the default interop
// namespace when it is imported by absolute path.
const playwright = await import(pathToFileURL(wwwRequire.resolve('playwright')).href);
const { chromium } = playwright.default ?? playwright;
const { build, createServer } = await import(pathToFileURL(wwwRequire.resolve('vite')).href);

// This directory has no node_modules of its own, so `@nisli/core` is aliased to
// the workspace source. Exact-match only: every importer (probe files AND the
// ssg sources) must land on ONE core instance.
const alias = [
  { find: /^@nisli\/core$/, replacement: join(repoRoot, 'packages', 'core', 'src', 'index.ts') },
];

// ── 1. SSG-render the fixture with the real pipeline ────────────────────
const server = await createServer({
  configFile: false,
  logLevel: 'error',
  root: repoRoot,
  resolve: { alias },
  server: { middlewareMode: true },
  appType: 'custom',
});
let pages;
try {
  const mod = await server.ssrLoadModule(join(here, 'ssg-pages.ts'));
  pages = await mod.renderProbePages();
} finally {
  await server.close();
}
console.log('--- SSG output (decoy route, rendered first) ---');
console.log(pages.decoy);
console.log('--- SSG output (page under test) ---');
console.log(pages.island);

// Islands mode does not exist in @nisli/ssg yet, so the probe stamps the flag
// the brief specifies (briefs/bet-05-adopt-islands.md:42) onto the snapshot.
const stamped = pages.island.replaceAll('<probe-island', '<probe-island data-nisli-adopt="1"');
assert.ok(stamped.includes('data-nisli-adopt="1"'), 'island flag stamping failed');

// ── 2. Bundle the two browser halves separately ─────────────────────────
async function bundle(entry) {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    mode: 'development',
    root: repoRoot,
    resolve: { alias },
    build: {
      write: false,
      minify: false,
      rollupOptions: { input: entry, output: { format: 'es', inlineDynamicImports: true } },
    },
  });
  const code = result.output.find((item) => item.type === 'chunk')?.code;
  assert.ok(code, `Vite produced no chunk for ${entry}`);
  return code;
}
const harness = await bundle(join(here, 'adopt-probe-fixture.ts'));
const componentModule = await bundle(join(here, 'probe-component.ts'));

const documentHtml = `<!doctype html><meta charset="utf-8"><body>${stamped}</body>`;
const browser = await chromium.launch();
const rows = [];
const record = (island, assertion, expected, actual) => {
  rows.push({ island, assertion, expected, actual, pass: expected === actual });
};
let naive;
let report;
const logs = [];
try {
  const page = await browser.newPage();
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (error) => logs.push(`[pageerror] ${error.message}`));

  // ── 3. Fresh realm, component module NOT loaded ───────────────────────
  await page.setContent(documentHtml);
  const inert = await page.evaluate(() => ({
    defined: Boolean(customElements.get('probe-island')),
    hosts: document.querySelectorAll('probe-island').length,
  }));
  assert.equal(inert.defined, false, 'probe-island must be undefined before the module loads');
  assert.equal(inert.hosts, 2, 'expected two prerendered islands');

  await page.addScriptTag({ content: harness, type: 'module' });

  // ── 4. Focus and type into the prerendered inner inputs ───────────────
  for (const [selector, text] of [['#probe-a', 'typed into A'], ['#probe-b', 'typed into B']]) {
    await page.click(selector);
    await page.keyboard.type(text);
    await page.evaluate((sel) => document.querySelector(sel).setSelectionRange(6, 10), selector);
  }

  // ── 5. Minimal P1 adopt branch, then the independent module arrives ────
  await page.evaluate(() => window.__adoptProbe.prepare());
  await page.addScriptTag({ content: componentModule, type: 'module' });
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  await page.evaluate(() => window.__adoptProbe.finish());
  report = await page.evaluate(() => window.__adoptProbe.report());

  // Control: the SAME snapshot with NO adopt branch — the WWW-14 naive path.
  const control = await browser.newPage();
  await control.setContent(documentHtml);
  await control.addScriptTag({ content: componentModule, type: 'module' });
  await control.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  naive = await control.evaluate(() => Array.from(document.querySelectorAll('probe-island')).map((host) => ({
    roots: host.querySelectorAll('[data-slot="root"]').length,
    nestedRoots: host.querySelectorAll('[data-slot="root"] [data-slot="root"]').length,
  })));
} finally {
  await browser.close();
}

// ── 6. The review's assertion list ──────────────────────────────────────
for (const [index, before] of report.server.entries()) {
  const after = report.client[index];
  const island = String.fromCharCode(65 + index);
  record(island, 'factory children survive', before.childrenHtml, after.childrenHtml);
  record(island, 'factory label survives', before.labelText, after.labelText);
  record(island, 'forwarded id survives', before.inputId, after.inputId);
  record(island, 'forwarded name survives', before.inputName, after.inputName);
  record(island, 'generated id matches server', before.localId, after.localId);
  record(island, 'aria-labelledby matches server', before.ariaLabelledBy, after.ariaLabelledBy);
  record(island, 'aria-describedby matches server', before.ariaDescribedBy, after.ariaDescribedBy);
  record(island, 'typed input value survives', before.inputValue, after.inputValue);
  record(island, 'input selection survives', String(before.selection), String(after.selection));
  record(island, 'component signal matches DOM', before.inputValue, after.signalValue);
  record(island, 'focus retained', before.focused, after.focused);
  record(island, 'no duplicate root', 1, after.rootCount);
}

console.log('\n--- pre-adopt (server) facts ---');
console.log(JSON.stringify(report.server, null, 2));
console.log('\n--- post-adopt (client) facts ---');
console.log(JSON.stringify(report.client, null, 2));
console.log(`\nblur events fired during adoption: ${report.blurs}`);
console.log('\n--- control: naive upgrade, no adopt branch (WWW-14) ---');
console.log(JSON.stringify(naive));
if (logs.length) {
  console.log('\n--- page console ---');
  for (const line of logs) console.log(line);
}

console.log('\n| island | assertion | expected (server) | actual (adopted) | result |');
console.log('| --- | --- | --- | --- | --- |');
for (const row of rows) {
  console.log(
    `| ${row.island} | ${row.assertion} | ${JSON.stringify(row.expected)} `
    + `| ${JSON.stringify(row.actual)} | ${row.pass ? 'PASS' : 'FAIL'} |`,
  );
}

const failed = rows.filter((row) => !row.pass);
console.log(`\n${rows.length - failed.length}/${rows.length} assertions passed.`);
if (failed.length) {
  console.log(
    `FALSIFIED: ${failed.length} assertion(s) failed — an independently loaded component `
    + 'module cannot reconstruct the setup inputs that produced the SSG host.',
  );
  process.exitCode = 1;
} else {
  console.log('NOT FALSIFIED: every setup input was reconstructable from the prerendered DOM.');
}
