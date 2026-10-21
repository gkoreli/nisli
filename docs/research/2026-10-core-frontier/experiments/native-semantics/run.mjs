import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../..');
const fromWww = createRequire(resolve(root, 'packages/www/package.json'));
const { build } = await import(fromWww.resolve('vite'));
const { chromium, firefox, webkit } = fromWww('playwright');
const bundle = await build({
  configFile: false, logLevel: 'silent', root,
  build: { write: false, rollupOptions: { input: resolve(here, 'fixture.js'), output: { format: 'es', inlineDynamicImports: true } } },
});
const code = bundle.output.find(x => x.type === 'chunk')?.code;
assert.ok(code);
let failures = 0;
for (const [name, browserType] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) {
  let browser;
  try {
    browser = await browserType.launch();
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: code, type: 'module' });
    await page.waitForFunction(() => typeof window.runNativeProbe === 'function');
    const result = await page.evaluate(() => window.runNativeProbe());
    const failed = result.checks.filter(x => !x.pass);
    failures += failed.length;
    console.log(JSON.stringify({ browser: name, version: browser.version(), ...result }));
  } catch (error) {
    failures++;
    console.log(JSON.stringify({ browser: name, infrastructureError: String(error) }));
  } finally {
    await browser?.close();
  }
}
console.log(JSON.stringify({ failures, verdict: failures ? 'FAIL: native equivalence or move optimum not satisfied; inspect individual checks' : 'PASS' }));
process.exitCode = failures ? 1 : 0;
