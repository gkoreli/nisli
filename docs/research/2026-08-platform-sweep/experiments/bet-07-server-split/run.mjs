/**
 * BET07 — fail-closed server/client bundle-split experiment.
 *
 * Runs the cheapest-useful experiment specified at
 * `docs/research/2026-08-platform-sweep/reviews/bet-07-server-functions.review.md:150-164`
 * against the Vite version this repository actually installs (7.3.6, a
 * `packages/www` devDependency — `pnpm-lock.yaml:90-92`).
 *
 *   node docs/research/2026-08-platform-sweep/experiments/bet-07-server-split/run.mjs
 *
 * Set `BET07_STACK=1` to print full build stacks.
 *
 * Nothing is installed and nothing outside this directory is touched: Vite is
 * resolved out of `packages/www`, and every scenario builds a throwaway copy of
 * `./app` under the OS temp directory. Exit code is 0 when every check reached a
 * conclusion; a check may still be reported as FAIL — a negative result is the
 * deliverable.
 *
 * Layout:
 *   plugin.mjs   the `@nisli/server/vite` prototype under test (strict + naive)
 *   app/src      the fixture: server modules, barrel, shared modules, entries
 *   app/src/leaks  client entries that each attempt one distinct leak
 *   app/bad      server modules with export syntax outside the allowed grammar
 *   RESULT.md    findings, per-check table, verdict
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createServerSplitPlugin, fnId } from './plugin.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../../..');
const fixtureApp = path.join(here, 'app');

const require = createRequire(path.join(repoRoot, 'packages/www/package.json'));
const viteEntry = require.resolve('vite');
const vitePkg = require('vite/package.json');
const vite = await import(pathToFileURL(viteEntry).href);

const SENTINELS = [
  'NISLI_SENTINEL_DB_TOKEN_7f3a91c4',
  'NISLI_SENTINEL_SIGNING_KEY_2b8e04df',
  'NISLI_SENTINEL_ROTATION_c51d77ae',
  'NISLI_SENTINEL_HANDLER_BODY_9d20ba61',
  'NISLI_SENTINEL_APIKEY_4e6c18b2',
];

const results = [];
const record = (id, group, pass, detail) => {
  results.push({ id, group, pass, detail });
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${id} — ${detail}`);
};

const section = (title) => console.log(`\n=== ${title} ===`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const tempRoots = [];
const makeScenario = async (name) => {
  const dir = await mkdtemp(path.join(tmpdir(), `bet07-${name}-`));
  tempRoots.push(dir);
  const root = path.join(dir, 'app');
  await cp(fixtureApp, root, { recursive: true });
  await rm(path.join(root, 'bad'), { recursive: true, force: true });
  return root;
};

const listFiles = async (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await listFiles(full, out);
    else out.push(full);
  }
  return out;
};
const buildConfig = ({ root, plugin, clientInput, minify, sourcemap, assetsInlineLimit }) => ({
  configFile: false,
  logLevel: 'silent',
  root,
  cacheDir: path.join(root, '.vite'),
  resolve: { alias: { '@app': path.join(root, 'src') } },
  plugins: [plugin],
  environments: {
    client: {
      consumer: 'client',
      build: {
        outDir: 'dist/client',
        emptyOutDir: true,
        minify,
        assetsInlineLimit,
        sourcemap,
        target: 'esnext',
        modulePreload: false,
        reportCompressedSize: false,
        rollupOptions: {
          input: path.join(root, clientInput),
          preserveEntrySignatures: 'strict',
          output: { format: 'es', entryFileNames: 'entry.js' },
        },
      },
    },
    worker: {
      consumer: 'server',
      resolve: { noExternal: true },
      build: {
        outDir: 'dist/worker',
        emptyOutDir: true,
        minify: false,
        ssr: true,
        target: 'esnext',
        reportCompressedSize: false,
        rollupOptions: {
          input: path.join(root, 'src/worker/entry.ts'),
          preserveEntrySignatures: 'strict',
          output: { format: 'es', entryFileNames: 'entry.js' },
        },
      },
    },
  },
});

const runBuild = async ({
  root,
  clientInput = 'src/client/entry.ts',
  strict = true,
  minify = false,
  sourcemap = true,
  failOnViolation = true,
  failPhase = 'writeBundle',
  environments = ['client', 'worker'],
  assetsInlineLimit,
}) => {
  const report = { violations: [], hmr: [] };
  const plugin = createServerSplitPlugin({
    vite,
    appRoot: root,
    strict,
    failOnViolation,
    failPhase,
    report,
  });
  const builder = await vite.createBuilder(
    buildConfig({ root, plugin, clientInput, minify, sourcemap, assetsInlineLimit }),
  );
  const errors = {};
  for (const name of environments) {
    try {
      await builder.build(builder.environments[name]);
    } catch (error) {
      if (process.env.BET07_STACK) console.error(error.stack);
      errors[name] = error;
    }
  }
  return { report, errors, builder };
};

// ---------------------------------------------------------------------------
console.log(`vite ${vitePkg.version}`);
console.log(`resolved ${path.relative(repoRoot, viteEntry)}`);
console.log(`node ${process.version}`);

section('0. environment');
record(
  'vite-version',
  'env',
  vitePkg.version === '7.3.6',
  `installed Vite is ${vitePkg.version} (brief assumed Vite 8); createBuilder/environments present: ${typeof vite.createBuilder === 'function' && typeof vite.isRunnableDevEnvironment === 'function'}`,
);

// ---------------------------------------------------------------------------
section('1. baseline production builds (unminified, sourcemap)');
const baseRoot = await makeScenario('baseline');
const base = await runBuild({ root: baseRoot });

record(
  'client-build',
  'baseline',
  !base.errors.client,
  base.errors.client
    ? `client build threw: ${base.errors.client.message.split('\n')[0]}`
    : `client build succeeded, audit violations: ${base.report.violations.length}`,
);
record(
  'worker-build',
  'baseline',
  !base.errors.worker,
  base.errors.worker
    ? `worker build threw: ${base.errors.worker.message.split('\n')[0]}`
    : 'worker build succeeded',
);

const clientDist = path.join(baseRoot, 'dist/client');
const workerDist = path.join(baseRoot, 'dist/worker');
const clientFiles = await listFiles(clientDist);
const workerFiles = await listFiles(workerDist);
const clientBlob = (
  await Promise.all(clientFiles.map((file) => readFile(file, 'utf8')))
).join('\n');

record(
  'chunk-modules-audit',
  'baseline',
  base.report.violations.length === 0,
  base.report.violations.length === 0
    ? `no .server.* / server-only module in any client chunk (${clientFiles.length} client artifacts)`
    : JSON.stringify(base.report.violations),
);

// sentinel + source-map checks on the unminified build
const foundUnminified = SENTINELS.filter((s) => clientBlob.includes(s));
const mapFiles = clientFiles.filter((file) => file.endsWith('.map'));
const mapPayloads = await Promise.all(
  mapFiles.map(async (file) => JSON.parse(await readFile(file, 'utf8'))),
);
const mapSources = mapPayloads.flatMap((map) => map.sources ?? []);
const mapContent = mapPayloads.flatMap((map) => map.sourcesContent ?? []).join('\n');
const serverSourcesInMap = mapSources.filter((s) => /\.server\.[cm]?[jt]sx?$/.test(s ?? ''));
const sentinelsInMap = SENTINELS.filter((s) => mapContent.includes(s));

record(
  'sourcemap',
  'baseline',
  serverSourcesInMap.length === 0 && sentinelsInMap.length === 0,
  `${mapFiles.length} client sourcemap(s); server sources in map: ${JSON.stringify(serverSourcesInMap)}; sentinels in sourcesContent: ${JSON.stringify(sentinelsInMap)}`,
);

// minified rebuild — the honest sentinel test
const minRoot = await makeScenario('baseline-min');
const min = await runBuild({ root: minRoot, minify: 'esbuild' });
const minFiles = await listFiles(path.join(minRoot, 'dist/client'));
const minBlob = (await Promise.all(minFiles.map((file) => readFile(file, 'utf8')))).join('\n');
const foundMinified = SENTINELS.filter((s) => minBlob.includes(s));

record(
  'sentinel',
  'baseline',
  foundUnminified.length === 0 && foundMinified.length === 0 && !min.errors.client,
  `unminified hits: ${JSON.stringify(foundUnminified)}; minified hits: ${JSON.stringify(foundMinified)}`,
);

// ---------------------------------------------------------------------------
section('2. stub id <-> manifest id (runtime)');
const clientModule = await import(pathToFileURL(path.join(clientDist, 'entry.js')).href);
const workerModule = await import(pathToFileURL(path.join(workerDist, 'entry.js')).href);
const stubIds = clientModule.stubIds ?? {};
const manifestIds = workerModule.manifestIds ?? [];
const stubIdList = [...new Set(Object.values(stubIds))].sort();
const idsMatch =
  stubIdList.length > 0 &&
  stubIdList.length === manifestIds.length &&
  stubIdList.every((id, index) => id === manifestIds[index]);

const expectedDeleteId = fnId(baseRoot, path.join(baseRoot, 'src/server/admin.server.ts'), 'deleteUser');
record(
  'stub-id-match',
  'baseline',
  idsMatch,
  `client stub ids ${JSON.stringify(stubIds)} vs worker manifest ${JSON.stringify(manifestIds)}`,
);
record(
  'reexport-identity',
  'baseline',
  stubIds.deleteUser === expectedDeleteId,
  `deleteUser re-exported through users.server.ts keeps admin.server.ts's id (${stubIds.deleteUser} === ${expectedDeleteId})`,
);
record(
  'type-export-erased',
  'baseline',
  !Object.keys(stubIds).includes('User') && !clientBlob.includes('AdminAudit'),
  `client surface is ${JSON.stringify(Object.keys(stubIds))}; no stub generated for type-only exports`,
);

// worker-side dispatch actually runs the real handler
const workerResponse = await workerModule.dispatch(
  stubIds.getUser,
  { id: '42' },
  new Request('http://127.0.0.1/_nisli/fn/x', { method: 'POST' }),
);
record(
  'worker-dispatch',
  'baseline',
  workerResponse.ok === true && workerResponse.data.name === 'Lovelace, Ada',
  `worker manifest dispatch returned ${JSON.stringify(workerResponse)}`,
);

// ---------------------------------------------------------------------------
section('3. dev mode + HMR');
const devRoot = await makeScenario('dev');
const devReport = { violations: [], hmr: [] };
const devPlugin = createServerSplitPlugin({ vite, appRoot: devRoot, report: devReport });
const devDispatch = {
  name: 'bet07-dev-dispatch',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/_nisli/fn/')) {
        next();
        return;
      }
      const send = (status, body) => {
        res.statusCode = status;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(body));
      };
      try {
        const environment = server.environments.ssr;
        if (!vite.isRunnableDevEnvironment(environment)) {
          send(500, { ok: false, error: { code: 'NO_RUNNER' } });
          return;
        }
        const manifest = (await environment.runner.import('virtual:nisli-server-fns')).default;
        const id = req.url.slice('/_nisli/fn/'.length).split('?')[0];
        const entry = manifest[id];
        if (!entry) {
          send(404, { ok: false, error: { code: 'UNKNOWN_FN' } });
          return;
        }
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const { input } = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        const module = await entry.load();
        const data = await module[entry.name](input, {
          request: new Request(`http://127.0.0.1${req.url}`, { method: 'POST' }),
        });
        send(200, { ok: true, data });
      } catch (error) {
        send(500, { ok: false, error: { code: 'INTERNAL', detail: String(error?.message ?? error) } });
      }
    });
  },
};

const server = await vite.createServer({
  configFile: false,
  logLevel: 'silent',
  root: devRoot,
  cacheDir: path.join(devRoot, '.vite'),
  appType: 'custom',
  resolve: { alias: { '@app': path.join(devRoot, 'src') } },
  plugins: [devPlugin, devDispatch],
  server: { host: '127.0.0.1', port: 0, watch: { usePolling: true, interval: 60 } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;

const usersFile = path.join(devRoot, 'src/server/users.server.ts');
const devStub = await server.environments.client.transformRequest('/src/server/users.server.ts');
const devStubCode = devStub?.code ?? '';
const devLeaks = SENTINELS.filter((s) => devStubCode.includes(s));
record(
  'dev-stub-substitution',
  'dev',
  devStubCode.includes('createStub') && devLeaks.length === 0 && !devStubCode.includes('privilegedLookup'),
  `dev client transform of users.server.ts is a stub module (${devStubCode.length} bytes), sentinel hits: ${JSON.stringify(devLeaks)}`,
);

const devIds = {
  getUser: fnId(devRoot, usersFile, 'getUser'),
  updateUser: fnId(devRoot, usersFile, 'updateUser'),
  listUsers: fnId(devRoot, usersFile, 'listUsersFn'),
};
const devCall = async (id, input) => {
  const response = await fetch(`${origin}/_nisli/fn/${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-nisli-fn': id },
    body: JSON.stringify({ input }),
  });
  return { status: response.status, body: await response.json() };
};

const devResult = await devCall(devIds.getUser, { id: '42' });
record(
  'dev',
  'dev',
  devResult.status === 200 &&
    devResult.body.ok === true &&
    devResult.body.data.fingerprint.startsWith('NISLI_'),
  `Environment API runner dispatch (${vite.isRunnableDevEnvironment(server.environments.ssr) ? 'RunnableDevEnvironment' : 'not runnable'}): ${JSON.stringify(devResult)}`,
);

// real built stub -> real dev endpoint, proving the id contract end to end
globalThis.__NISLI_FN_ORIGIN = origin;
const roundTripDist = await makeScenario('roundtrip');
await runBuild({ root: roundTripDist, environments: ['client'] });
const roundTripModule = await import(
  pathToFileURL(path.join(roundTripDist, 'dist/client/entry.js')).href
);
let roundTrip;
try {
  roundTrip = await roundTripModule.fetchUser({ id: '7' });
} catch (error) {
  roundTrip = { error: String(error?.message ?? error) };
}
record(
  'stub-wire-roundtrip',
  'dev',
  roundTrip?.id === '7' && roundTrip?.name === 'Lovelace, Ada',
  `built client stub called the dev endpoint: ${JSON.stringify(roundTrip)}`,
);

// --- HMR probes -----------------------------------------------------------
const hotPayloads = [];
const clientHot = server.environments.client.hot;
const originalSend = clientHot.send.bind(clientHot);
clientHot.send = (...args) => {
  hotPayloads.push(args.length === 1 ? args[0] : { type: args[0], data: args[1] });
  return originalSend(...args);
};

const probe = async (mutate) => {
  hotPayloads.length = 0;
  devReport.hmr.length = 0;
  const before = (await server.environments.client.transformRequest('/src/server/users.server.ts'))
    ?.code;
  await mutate();
  await sleep(900);
  const after = (await server.environments.client.transformRequest('/src/server/users.server.ts'))
    ?.code;
  return {
    payloads: [...hotPayloads],
    hmr: [...devReport.hmr],
    stubChanged: before !== after,
    stubCode: after ?? '',
  };
};

const originalUsers = await readFile(usersFile, 'utf8');

const bodyProbe = await probe(async () => {
  await writeFile(
    usersFile,
    originalUsers.replace("formatName('Ada', 'Lovelace')", "formatName('Ada', 'Byron')"),
  );
});
const afterBodyCall = await devCall(devIds.getUser, { id: '42' });
record(
  'hmr-body',
  'hmr',
  bodyProbe.stubChanged === false &&
    bodyProbe.payloads.length === 0 &&
    afterBodyCall.body?.data?.name === 'Byron, Ada',
  `handler-body edit: client payloads ${JSON.stringify(bodyProbe.payloads.map((p) => p.type))}, stub bytes changed: ${bodyProbe.stubChanged}, server now returns ${JSON.stringify(afterBodyCall.body?.data?.name)}`,
);

const addedSource = `${originalUsers.replace("formatName('Ada', 'Lovelace')", "formatName('Ada', 'Byron')")}
export const archiveUser = serverFn<{ id: string }, { archived: string }>({
  input: 'object',
  handler: async (input) => ({ archived: input.id }),
});
`;
const addProbe = await probe(async () => {
  await writeFile(usersFile, addedSource);
});
const archiveId = fnId(devRoot, usersFile, 'archiveUser');
const archiveCall = await devCall(archiveId, { id: '9' });
record(
  'hmr-export-add',
  'hmr',
  addProbe.stubChanged === true &&
    addProbe.payloads.length > 0 &&
    addProbe.stubCode.includes(archiveId) &&
    archiveCall.body?.ok === true,
  `export add: client payloads ${JSON.stringify(addProbe.payloads.map((p) => p.type))}, new stub id present: ${addProbe.stubCode.includes(archiveId)}, dev manifest serves new fn: ${JSON.stringify(archiveCall.body)}`,
);

const removedSource = addedSource.replace(
  /\/\/ direct export 2[\s\S]*?\n\}\);\n/,
  '',
);
const removeProbe = await probe(async () => {
  await writeFile(usersFile, removedSource);
});
const removedCall = await devCall(devIds.updateUser, { id: '1', name: 'x' });
record(
  'hmr-export-remove',
  'hmr',
  removeProbe.stubChanged === true &&
    removeProbe.payloads.length > 0 &&
    !removeProbe.stubCode.includes(devIds.updateUser) &&
    removedCall.status === 404 &&
    removedCall.body?.error?.code === 'UNKNOWN_FN',
  `export remove: client payloads ${JSON.stringify(removeProbe.payloads.map((p) => p.type))}, stub still exposes removed id: ${removeProbe.stubCode.includes(devIds.updateUser)}, stale call -> ${removedCall.status} ${JSON.stringify(removedCall.body)}`,
);

await server.close();

// ---------------------------------------------------------------------------
section('4. negative controls — does the audit fail closed?');

const control = async ({
  id,
  entry,
  strict = true,
  assetsInlineLimit,
  expectBuildError,
  describe,
}) => {
  const root = await makeScenario(id);
  const { report, errors } = await runBuild({
    root,
    clientInput: entry,
    strict,
    assetsInlineLimit,
    environments: ['client'],
  });
  const files = await listFiles(path.join(root, 'dist/client'));
  const read = async (predicate) =>
    (
      await Promise.all(files.filter(predicate).map((file) => readFile(file, 'utf8')))
    ).join('\n');
  const codeBlob = await read((file) => !file.endsWith('.map'));
  const mapBlob = await read((file) => file.endsWith('.map'));
  const sentinelHits = SENTINELS.filter((s) => codeBlob.includes(s));
  const sentinelHitsInMap = SENTINELS.filter((s) => mapBlob.includes(s));
  const serverSourceShipped =
    /export const getUser = serverFn|privilegedLookup\(input\.id\)/.test(codeBlob) ||
    report.violations.some((v) => v.kind.startsWith('server-source-'));
  const blocked = Boolean(errors.client) || report.violations.length > 0;
  record(
    `control:${id}`,
    'control',
    blocked === expectBuildError,
    `${describe} | blocked=${blocked} (${errors.client ? errors.client.message.split('\n').slice(0, 2).join(' ') : 'no build error'}; violations=${JSON.stringify(report.violations.map((v) => v.kind))}) | sentinels in js=${JSON.stringify(sentinelHits)} | sentinels in sourcemap=${JSON.stringify(sentinelHitsInMap)} | real server source in output=${serverSourceShipped}`,
  );
  return {
    report,
    errors,
    codeBlob,
    mapBlob,
    sentinelHits,
    sentinelHitsInMap,
    serverSourceShipped,
    files,
    root,
  };
};

await control({
  id: 'server-only-import',
  entry: 'src/leaks/server-only-import.ts',
  expectBuildError: true,
  describe: 'client imports a `server-only`-marked shared module',
});

await control({
  id: 'raw-query-strict',
  entry: 'src/leaks/raw-query.ts',
  expectBuildError: true,
  describe: 'client reads the server module via `?raw` (strict plugin)',
});

const rawNaive = await control({
  id: 'raw-query-naive',
  entry: 'src/leaks/raw-query.ts',
  strict: false,
  expectBuildError: true,
  describe: 'client reads the server module via `?raw` (brief-as-written plugin)',
});
record(
  'control:raw-query-naive-detected-by',
  'control',
  rawNaive.report.violations.some((v) => v.kind === 'server-module-in-client-chunk'),
  `?raw under the naive plugin is caught by the generateBundle chunk.modules audit, not by stub substitution: ${JSON.stringify(rawNaive.report.violations)}`,
);

const urlInline = await control({
  id: 'url-asset-inlined',
  entry: 'src/leaks/url-asset.ts',
  expectBuildError: true,
  describe:
    'new URL(server module, import.meta.url) below assetsInlineLimit — Vite inlines the file as a base64 data URI',
});
record(
  'control:url-asset-invisible-to-chunk-modules',
  'control',
  urlInline.report.violations.length > 0 &&
    urlInline.report.violations.every((v) => v.kind === 'server-source-inlined-as-data-uri') &&
    urlInline.sentinelHits.length === 0,
  `the whole server module ships base64-encoded inside the chunk: chunk.modules sees nothing and sentinel grep sees nothing (js sentinel hits ${JSON.stringify(urlInline.sentinelHits)}); only the content arm of the audit catches it — ${JSON.stringify(urlInline.report.violations.map((v) => v.kind))}`,
);

const urlEmitted = await control({
  id: 'url-asset-emitted',
  entry: 'src/leaks/url-asset.ts',
  assetsInlineLimit: 0,
  expectBuildError: true,
  describe: 'same leak above assetsInlineLimit — the server module is emitted as a dist file',
});
record(
  'control:url-asset-on-disk',
  'control',
  urlEmitted.report.violations.some((v) => v.kind === 'server-module-emitted-as-asset') &&
    urlEmitted.files.some((file) => /users\.server/.test(path.basename(file))),
  `emitted server module lands in dist as ${JSON.stringify(urlEmitted.files.filter((f) => /users\.server/.test(path.basename(f))).map((f) => path.basename(f)))}; caught only by the emitted-asset arm`,
);

await control({
  id: 'dynamic-static',
  entry: 'src/leaks/dynamic-static.ts',
  expectBuildError: false,
  describe: 'statically analysable dynamic import of a server module (stub substitution should hold)',
});

const computed = await control({
  id: 'dynamic-computed',
  entry: 'src/leaks/dynamic-computed.ts',
  expectBuildError: false,
  describe: 'runtime-computed dynamic import — no hook ever sees the specifier',
});
record(
  'control:dynamic-computed-outcome',
  'control',
  !computed.serverSourceShipped && computed.sentinelHits.length === 0,
  'computed dynamic import ships no server code (the import is left unresolved and fails at runtime instead)',
);

const unmarked = await control({
  id: 'unmarked-privileged',
  entry: 'src/leaks/unmarked-privileged.ts',
  expectBuildError: false,
  describe: 'privileged shared module the developer forgot to mark `server-only`',
});
record(
  'control:sentinel-is-not-fail-closed',
  'control',
  unmarked.sentinelHits.length === 0 && /16777619/.test(unmarked.codeBlob),
  `privileged algorithm shipped to the client while every sentinel was tree-shaken out of the JS (js sentinel hits: ${JSON.stringify(unmarked.sentinelHits)}); sentinel grep would have reported this build clean`,
);
record(
  'control:sourcemap-resurrects-tree-shaken-secret',
  'control',
  unmarked.sentinelHitsInMap.includes('NISLI_SENTINEL_ROTATION_c51d77ae'),
  `the same secret that tree-shaking removed from the JS is republished verbatim in sourcesContent (${JSON.stringify(unmarked.sentinelHitsInMap)}) — shipping client sourcemaps re-opens every shared-module leak`,
);

// Does the audit fail before any byte reaches disk?
const beforeWriteRoot = await makeScenario('fail-before-write');
const beforeWrite = await runBuild({
  root: beforeWriteRoot,
  clientInput: 'src/leaks/url-asset.ts',
  failPhase: 'generateBundle',
  environments: ['client'],
});
const beforeWriteFiles = await listFiles(path.join(beforeWriteRoot, 'dist/client'));
const afterWriteFiles = urlInline.files;
record(
  'control:fail-closed-before-write',
  'control',
  Boolean(beforeWrite.errors.client) && beforeWriteFiles.length === 0,
  `failing in generateBundle leaves dist empty (${beforeWriteFiles.length} files); failing in writeBundle leaves the leaked artifacts on disk (${afterWriteFiles.length} files) even though the build exits non-zero`,
);

// grammar controls: bad server modules copied into the scanned tree
const grammar = async (file, describe) => {
  const root = await makeScenario(`grammar-${path.basename(file, '.server.ts')}`);
  await cp(path.join(fixtureApp, 'bad', file), path.join(root, 'src/bad', file), {
    recursive: true,
  });
  const { report, errors } = await runBuild({ root, environments: ['client'] });
  record(
    `grammar:${file}`,
    'grammar',
    Boolean(errors.client),
    `${describe} -> ${errors.client ? errors.client.message.split('\n')[0] : 'BUILD SUCCEEDED (leak)'} | violations=${JSON.stringify(report.violations.map((v) => v.kind))}`,
  );
};

await grammar('star.server.ts', 'server module uses `export *`');
await grammar('plain.server.ts', 'server module exports a non-serverFn secret constant');
await grammar('default.server.ts', 'server module uses a default export');

const naiveGrammarRoot = await makeScenario('grammar-naive');
await cp(
  path.join(fixtureApp, 'bad', 'plain.server.ts'),
  path.join(naiveGrammarRoot, 'src/bad/plain.server.ts'),
);
await writeFile(
  path.join(naiveGrammarRoot, 'src/client/entry.ts'),
  "import { API_KEY, ping } from '../bad/plain.server.js';\nexport const stubIds = { ping: (ping as unknown as { __fnId: string }).__fnId };\nexport const key = API_KEY;\n",
);
const naiveGrammar = await runBuild({
  root: naiveGrammarRoot,
  strict: false,
  environments: ['client'],
});
const naiveGrammarBlob = (
  await Promise.all(
    (await listFiles(path.join(naiveGrammarRoot, 'dist/client'))).map((file) =>
      readFile(file, 'utf8'),
    ),
  )
).join('\n');
record(
  'grammar:naive-stubs-a-secret',
  'grammar',
  !naiveGrammar.errors.client && naiveGrammarBlob.includes('createStub'),
  `brief-as-written regex discovery turned \`export const API_KEY\` into a callable client stub instead of failing: build error=${Boolean(naiveGrammar.errors.client)}, secret literal in bundle=${naiveGrammarBlob.includes('NISLI_SENTINEL_APIKEY_4e6c18b2')}`,
);

// ---------------------------------------------------------------------------
section('summary');
const width = Math.max(...results.map((r) => r.id.length));
for (const result of results) {
  console.log(`${result.id.padEnd(width)}  ${result.pass ? 'PASS' : 'FAIL'}`);
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) console.log(`failing: ${failed.map((r) => r.id).join(', ')}`);

await Promise.all(tempRoots.map((dir) => rm(dir, { recursive: true, force: true })));

assert.ok(results.length >= 20, 'experiment did not run to completion');
