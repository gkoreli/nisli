/** Compare the saved optimization port with a pinned main in three real browsers. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(join(root, 'package.json'));
const { build } = require(require.resolve('esbuild', { paths: [join(root, 'node_modules/.pnpm/node_modules')] }));
const { chromium, firefox, webkit } = require('playwright');
const baseline = '4fa6360';
const expectEquivalent = process.argv.includes('--expect-equivalent');
const snapshot = await mkdtemp(join(tmpdir(), 'nisli-rendering-baseline-'));
execFileSync('tar', ['-x', '-C', snapshot], {
  input: execFileSync('git', ['archive', baseline, 'packages/core/src'], { cwd: root }),
});
const bundles = {};
for (const [name, source] of [['baseline', snapshot], ['candidate', root]]) {
  const result = await build({
    stdin: {
      contents: `import { signal, computed, effect, flush } from ${JSON.stringify(join(source, 'packages/core/src/signal.ts'))};
import { html } from ${JSON.stringify(join(source, 'packages/core/src/template.ts'))};
globalThis.__crosscheck = { signal, computed, effect, flush, html };`,
      resolveDir: source,
    },
    bundle: true, write: false, format: 'iife', platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  bundles[name] = result.outputFiles[0].text;
}
// Serve modules from the page's own HTTP origin. WebKit masks errors from
// script injection into an opaque about:blank origin as 'Script error.'.
const server = createServer((request, response) => {
  const name = request.url === '/baseline.js' ? 'baseline' : request.url === '/candidate.js' ? 'candidate' : null;
  response.setHeader('Content-Type', name ? 'text/javascript' : 'text/html');
  response.end(name ? bundles[name] : '<!doctype html><body></body>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
server.unref();
const address = server.address();
assert.ok(address && typeof address === 'object');
const origin = `http://127.0.0.1:${address.port}`;
const candidateSourceSha256 = createHash('sha256').update(await readFile(join(root, 'packages/core/src/signal.ts'))).update('\0').update(await readFile(join(root, 'packages/core/src/template.ts'))).digest('hex');
const report = { candidateSourceSha256, fixtureOrigin: 'same-origin HTTP loopback', baseline, candidateHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim(), browsers: [] };
for (const [engine, browserType] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) {
  const browser = await browserType.launch();
  const variants = {};
  try {
    for (const name of ['baseline', 'candidate']) {
      const page = await browser.newPage();
      await page.goto(origin);
      await page.addScriptTag({ url: `${origin}/${name}.js` });
      variants[name] = await page.evaluate(async () => {
        const { signal, computed, effect, flush, html } = globalThis.__crosscheck;
        const trace = [];
        // Exercise graph rewiring, cleanup, disposal, empty/single/multiple queues,
        // synchronous flushes, asynchronous coalescing, and cascading writes.
        for (let seed = 1; seed <= 100; seed++) {
          let state = seed;
          const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; };
          const sources = Array.from({ length: 4 }, () => signal(0));
          const gate = signal(true);
          const derived = computed(() => gate.value ? sources[0].value + sources[1].value : sources[2].value);
          const stops = Array.from({ length: 6 }, (_, i) => effect(() => {
            const value = i % 2 ? derived.value : sources[i % 4].value;
            trace.push([seed, i, value]);
            return () => trace.push([seed, i, 'cleanup']);
          }));
          const trigger = signal(0);
          const writer = effect(() => { sources[3].value = trigger.value; });
          for (let step = 0; step < 50; step++) {
            const operation = random() % 6;
            if (operation < 4) sources[operation].value = random() % 17;
            else if (operation === 4) gate.value = !gate.value;
            else trigger.value = random() % 17;
            if (step === 23) stops[2]();
            if (step % 3) flush();
            else { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
          }
          writer(); stops.forEach(stop => stop()); flush();
        }
        // The same callsite is mounted repeatedly; bindings include static
        // ancestors, table/SVG parser structure, mixed attributes and events.
        const render = (value, click) => html`<section><header>static</header><table><tbody><tr><td title="value-${value}">${value}</td></tr></tbody></table><svg><g><text>${value}</text></g></svg><button @click=${click}>click</button></section>`;
        const templates = [];
        for (let mount = 0; mount < 12; mount++) {
          const value = signal(mount);
          let clicks = 0;
          const result = render(value, () => clicks++);
          const host = document.createElement('div');
          result.mount(host); document.body.append(host);
          for (let update = 0; update < 10; update++) { value.value = mount + update; flush(); }
          host.querySelector('button').click();
          const before = host.innerHTML;
          result.dispose(); value.value = 999; flush();
          host.querySelector('button').click();
          templates.push({ text: host.textContent, title: host.querySelector('td').title, clicks, disposed: before === host.innerHTML });
          host.remove();
        }
        // Explicit flush() can leave already-enqueued empty flush jobs behind.
        // Drain that prior phase before measuring fresh FIFO ordering.
        await new Promise(resolve => setTimeout(resolve, 0));
        const normal = [];
        const source = signal(0);
        const stop = effect(() => { if (source.value) normal.push('effect:' + source.value); });
        void Promise.resolve().then(() => normal.push('before:promise'));
        queueMicrotask(() => normal.push('before:queue'));
        source.value = 1;
        void Promise.resolve().then(() => { normal.push('after:promise'); source.value = 2; });
        queueMicrotask(() => normal.push('after:queue'));
        await new Promise(resolve => setTimeout(resolve, 0));
        stop();
        const exceptional = [];
        const originalError = console.error;
        const onError = event => { exceptional.push('error:' + event.error.message); event.preventDefault(); };
        const onRejection = event => { exceptional.push('rejection:' + event.reason.message); event.preventDefault(); };
        addEventListener('error', onError); addEventListener('unhandledrejection', onRejection);
        const failure = signal(false);
        const failStop = effect(() => { if (failure.value) throw new Error('effect failed'); });
        try {
          console.error = () => { throw new Error('diagnostic transport failed'); };
          failure.value = true;
          queueMicrotask(() => exceptional.push('following:queue'));
          void Promise.resolve().then(() => exceptional.push('following:promise'));
          await new Promise(resolve => setTimeout(resolve, 0));
        } finally {
          console.error = originalError; failStop();
          removeEventListener('error', onError); removeEventListener('unhandledrejection', onRejection);
        }
        return { trace, templates, normal, exceptional };
      });
      await page.close();
    }
    const { baseline: original, candidate } = variants;
    assert.deepEqual(candidate.trace, original.trace, `${engine}: graph trace changed`);
    assert.deepEqual(candidate.templates, original.templates, `${engine}: rendered behavior changed`);
    assert.ok(candidate.templates.every(item => item.clicks === 1 && item.disposed), `${engine}: cleanup failed`);
    const expected = ['before:promise', 'before:queue', 'effect:1', 'after:promise', 'after:queue', 'effect:2'];
    assert.deepEqual(original.normal, expected); assert.deepEqual(candidate.normal, expected);
    // Full-candidate mode must reproduce its known counterexample; queue-only
    // mode instead requires exact agreement, including exceptional ordering.
    assert.deepEqual(original.exceptional, ['error:diagnostic transport failed', 'following:queue', 'following:promise']);
    assert.deepEqual(candidate.exceptional, expectEquivalent ? original.exceptional : ['following:queue', 'following:promise', 'error:diagnostic transport failed']);
    const result = {
      engine, version: browser.version(), graphSeeds: 100, writesPerSeed: 50,
      matchingGraphTraceSha256: createHash('sha256').update(JSON.stringify(candidate.trace)).digest('hex'),
      repeatedMounts: 12, verifiedUpdatesPerMount: 10,
      normalOrdering: candidate.normal,
      baselineExceptionalOrder: original.exceptional, candidateExceptionalOrder: candidate.exceptional,
      testedBehaviorMatchesBaseline: expectEquivalent,
    };
    report.browsers.push(result);
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
}
server.close();
report.checkedAt = new Date().toISOString();
await writeFile(join(root, 'docs/worklists/core-rendering-performance', expectEquivalent ? 'queue-only-results.json' : 'crosscheck-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(expectEquivalent ? 'PASS: queue-only subset matches the bounded normal and exceptional behavior probes in all three engines.' : 'PASS: bounded normal behavior matches; BLOCKER: the full candidate changes exceptional error ordering in all three engines.');
