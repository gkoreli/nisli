/**
 * Issue #1: cloned nested fragments must connect parent-first, and the exact
 * single-template Accordion reproduction must mount and remain interactive.
 * Bundles current core + registry sources in memory; no prebuilt dist needed.
 *
 *   pnpm --filter @nisli/www proof:compound-lifecycle
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { build } from 'vite';

const wwwDir = dirname(dirname(fileURLToPath(import.meta.url)));
const result = await build({
  configFile: false,
  logLevel: 'silent',
  root: join(wwwDir, '..', '..'),
  build: {
    write: false,
    rollupOptions: {
      input: join(wwwDir, 'scripts', 'compound-lifecycle-proof-fixture.js'),
      output: { format: 'es', inlineDynamicImports: true },
    },
  },
});
const bundle = result.output.find((item) => item.type === 'chunk')?.code;
assert.ok(bundle, 'Vite did not produce the compound lifecycle proof bundle');

const failures = [];
for (const [name, browserType] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) {
  let browser;
  try {
    browser = await browserType.launch();
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.evaluate(() => {
      window.__compoundErrors = [];
      document.addEventListener('nisli-error', (event) => window.__compoundErrors.push(event.detail));
    });
    await page.addScriptTag({ content: bundle, type: 'module' });
    await page.waitForFunction(() => window.__compoundLifecycleProof);
    assert.deepEqual(await page.evaluate(() => window.__compoundLifecycleProof), {
      order: ['parent', 'child'], childSawContext: true,
    }, `${name}: cloned fragment lifecycle`);

    const hosts = page.locator('accordion-test-host');
    assert.equal(await hosts.count(), 2, `${name}: both template mounts exist`);
    const ids = [];
    for (let index = 0; index < 2; index += 1) {
      const host = hosts.nth(index);
      const trigger = host.getByRole('button', { name: 'First question' });
      const region = host.locator('[role="region"]');
      assert.equal(await trigger.count(), 1, `${name}: no missing/duplicate trigger`);
      assert.equal(await region.count(), 1, `${name}: no missing/duplicate region`);
      assert.equal(await region.textContent(), 'First answer');
      const triggerId = await trigger.getAttribute('id');
      const regionId = await region.getAttribute('id');
      assert.ok(triggerId && regionId, `${name}: nonempty ARIA IDs`);
      ids.push(triggerId, regionId);
      assert.equal(await trigger.getAttribute('aria-controls'), regionId);
      assert.equal(await region.getAttribute('aria-labelledby'), triggerId);

      async function assertState(expanded) {
        await page.waitForFunction(({ index, expanded }) => {
          const host = document.querySelectorAll('accordion-test-host')[index];
          const button = host.querySelector('button');
          const region = host.querySelector('[role="region"]');
          return button?.getAttribute('aria-expanded') === String(expanded)
            && region?.getAttribute('data-state') === (expanded ? 'open' : 'closed')
            && region.hidden === !expanded;
        }, { index, expanded });
        assert.equal(await region.isVisible(), expanded, `${name}: region visibility`);
      }

      await assertState(false);
      await trigger.click();
      await assertState(true);
      await trigger.press('Enter');
      await assertState(false);
      await trigger.press('Space');
      await assertState(true);
      await trigger.click();
      await assertState(false);
    }
    assert.equal(new Set(ids).size, ids.length, `${name}: IDs unique across mounts`);
    assert.equal(await page.locator('[data-nisli-error]').count(), 0, `${name}: no contained setup failures`);
    assert.deepEqual(await page.evaluate(() => window.__compoundErrors), [], `${name}: no lifecycle error events`);
    assert.deepEqual(errors, [], `${name}: no console/page errors`);
    console.log(`${name}: PASS parent-first clone + two Accordion mounts, ARIA, click, Enter, Space`);
  } catch (error) {
    failures.push(new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`));
  } finally {
    await browser?.close();
  }
}
if (failures.length) throw new AggregateError(failures, 'compound lifecycle browser proof failed');
