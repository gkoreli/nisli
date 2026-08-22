/**
 * Real-browser proof for Nisli's moveBefore() adoption. Vite bundles the actual
 * core and registry sources in memory for Chromium, Firefox, and WebKit; the
 * fixture checks keyed each() state preservation, lifecycle suppression, and
 * portal moves.
 *
 *   pnpm --filter @nisli/www proof:movebefore
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
      input: join(wwwDir, 'scripts', 'movebefore-proof-fixture.js'),
      output: { format: 'es', inlineDynamicImports: true },
    },
  },
});
const bundle = bundleResult.output.find((item) => item.type === 'chunk')?.code;
assert.ok(bundle, 'Vite did not produce the moveBefore proof bundle');

const failures = [];
for (const [name, browserType] of [
  ['chromium', chromium],
  ['firefox', firefox],
  ['webkit', webkit],
]) {
  let browser;
  try {
    browser = await browserType.launch();
    const page = await browser.newPage();
    await page.setContent(`<!doctype html>
      <style>
        @keyframes movebefore-running { from { opacity: .25 } to { opacity: 1 } }
        [data-animation] { animation: movebefore-running 10s linear infinite }
      </style>
      <div id="portal-target"></div>`);
    await page.addScriptTag({ content: bundle, type: 'module' });
    await page.waitForFunction(() => window.__moveBeforeProof?.counters.iframeLoads === 3);
    await page.waitForFunction(() =>
      document.querySelector('[data-row="b"] [data-animation]')?.getAnimations().length === 1,
    );

    await page.evaluate(() => window.__moveBeforeProof.prepare());
    await page.evaluate(() => window.__moveBeforeProof.reorder());
    await page.waitForTimeout(150);
    const result = await page.evaluate(() => window.__moveBeforeProof.result());
    const portalResult = await page.evaluate(() => window.__moveBeforeProof.portalResult());

    assert.deepEqual(result.order, ['c', 'b', 'a'], `${name}: keyed order`);
    assert.equal(result.setup, 0, `${name}: each() move re-ran setup`);
    assert.equal(portalResult.setup, 0, `${name}: portal move re-ran setup`);
    if (result.supported) {
      assert.equal(result.focusPreserved, true, `${name}: focus was not preserved`);
      assert.equal(result.blurs, 0, `${name}: move fired blur`);
      assert.equal(result.inputSelectionPreserved, true, `${name}: input selection changed`);
      assert.equal(result.selectionPreserved, true, `${name}: document selection changed`);
      assert.equal(result.iframeLoadsAfter, result.iframeLoadsBefore, `${name}: iframe reloaded`);
      assert.equal(result.animationPreserved, true, `${name}: animation object changed`);
      assert.equal(result.animationTimePreserved, true, `${name}: animation time reset`);
      assert.equal(result.popoverPreserved, true, `${name}: popover closed`);
      assert.equal(result.connected, 0, `${name}: each() fired connectedCallback`);
      assert.equal(result.disconnected, 0, `${name}: each() fired disconnectedCallback`);
      assert.ok(result.moved > 0, `${name}: each() did not fire connectedMoveCallback`);
      assert.equal(portalResult.focusPreserved, true, `${name}: portal focus was not preserved`);
      assert.equal(portalResult.popoverPreserved, true, `${name}: portal popover closed`);
      assert.equal(portalResult.connected, 0, `${name}: portal fired connectedCallback`);
      assert.equal(portalResult.disconnected, 0, `${name}: portal fired disconnectedCallback`);
      assert.ok(portalResult.moved > 0, `${name}: portal did not fire connectedMoveCallback`);
    }

    console.log(`${name}: PASS ${JSON.stringify({ ...result, portal: portalResult })}`);
  } catch (error) {
    failures.push(new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`));
  } finally {
    await browser?.close();
  }
}

if (failures.length) throw new AggregateError(failures, 'moveBefore browser proof failed');
