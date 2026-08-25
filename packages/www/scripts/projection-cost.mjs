/**
 * Measures the cost of light-DOM projection in real browsers.
 *
 *   node scripts/projection-cost.mjs
 *
 * Reports rather than asserts: this exists to size the moveBefore opportunity
 * in projection.ts, not to gate anything yet.
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { build } from 'vite';

const wwwDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = join(wwwDir, '..', '..');
const bundleResult = await build({
  configFile: false,
  logLevel: 'silent',
  root: repoRoot,
  build: {
    write: false,
    rollupOptions: {
      input: join(wwwDir, 'scripts', 'projection-cost-fixture.js'),
      output: { format: 'es', inlineDynamicImports: true },
    },
  },
});
const bundle = bundleResult.output.find((item) => item.type === 'chunk')?.code;
assert.ok(bundle, 'Vite did not produce the projection cost bundle');

for (const [name, browserType] of [
  ['chromium', chromium],
  ['firefox', firefox],
  ['webkit', webkit],
]) {
  let browser;
  try {
    browser = await browserType.launch();
    const page = await browser.newPage();
    await page.setContent('<!doctype html><body></body>');
    await page.addScriptTag({ content: bundle, type: 'module' });
    await page.evaluate(() => window.__projectionCost.run());
    // Let the projection sweep microtask and any iframe loads settle.
    await page.waitForTimeout(400);
    const result = await page.evaluate(() => window.__projectionCost.result());
    console.log(`${name} initial-capture: ${JSON.stringify(result)}`);

    // Scenario 2: children that are already live when the sweep relocates them.
    await page.evaluate(() => window.__projectionCost.mountLate());
    await page.waitForTimeout(200);
    await page.evaluate(() => window.__projectionCost.addLateChildren());
    await page.waitForTimeout(400); // let the late iframe finish loading
    const pre = await page.evaluate(() => window.__projectionCost.captureLateBaseline());
    await page.waitForTimeout(400); // the sweep microtask has long since run
    const late = await page.evaluate(() => window.__projectionCost.lateResult());
    console.log(`${name} late-sweep:      ${JSON.stringify({ ...pre, ...late })}`);
  } catch (error) {
    console.log(`${name}: ERROR ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await browser?.close();
  }
}
