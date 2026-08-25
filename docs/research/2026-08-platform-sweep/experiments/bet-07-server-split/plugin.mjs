/**
 * Throwaway prototype of the `@nisli/server/vite` module-boundary split plugin
 * described in `briefs/bet-07-server-functions.md:70-76`, built to answer the
 * BET07 review's riskiest-assumption experiment
 * (`reviews/bet-07-server-functions.review.md:150-164`).
 *
 * This file is EXPERIMENT CODE. It is not a package, it is not published, and
 * nothing in `packages/` imports it.
 *
 * Two modes:
 *   strict: true   the review's suggested revision — real export-surface
 *                  parsing over a deliberately small grammar, unknown export
 *                  syntax is a build error, queries/aliases on a server module
 *                  are a build error, and `generateBundle` audits client
 *                  chunk modules + emitted assets.
 *   strict: false  the brief's design as written — specifier-suffix matching
 *                  and regex export discovery, no grammar enforcement. Used as
 *                  the control arm so the report can say which leaks the naive
 *                  shape actually ships.
 *
 * `vite` is injected because this directory has no `node_modules`; the runner
 * resolves the repository's installed Vite and hands the namespace in.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

const SERVER_FILE_RE = /\.server\.[cm]?[jt]sx?$/;
const STUB_PREFIX = '\0nisli-stub:';
const MANIFEST_ID = 'virtual:nisli-server-fns';
const RESOLVED_MANIFEST_ID = '\0' + MANIFEST_ID;
const SERVER_ONLY_ID = 'server-only';
const RESOLVED_SERVER_ONLY_ID = '\0server-only';

const splitQuery = (id) => {
  const at = id.indexOf('?');
  return at === -1 ? [id, ''] : [id.slice(0, at), id.slice(at)];
};

const toPosix = (p) => p.split(path.sep).join('/');

/**
 * Vite's resolver reports real paths (`preserveSymlinks: false`), while a
 * filesystem scan reports whatever the caller passed. Normalising both through
 * realpath is load-bearing: without it the client stubs and the server manifest
 * hash different relative paths and every id silently disagrees.
 */
const real = (p) => {
  try {
    return realpathSync.native(p);
  } catch {
    return p;
  }
};

/** Deterministic function id: sha256(root-relative defining module + '#' + defining export name). */
export const fnId = (appRoot, file, exportName) =>
  createHash('sha256')
    .update(`${toPosix(path.relative(real(appRoot), real(file)))}#${exportName}`)
    .digest('hex')
    .slice(0, 16);

const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

/** Resolve a relative re-export specifier written with the TS `.js` convention. */
const resolveRelative = (spec, importer) => {
  const base = path.resolve(path.dirname(importer), spec);
  const candidates = [base];
  const jsExt = /\.([cm]?)js(x?)$/.exec(base);
  if (jsExt) candidates.push(base.replace(/\.([cm]?)js(x?)$/, '.$1ts$2'));
  else candidates.push(`${base}.ts`, `${base}.js`, path.join(base, 'index.ts'));
  const hit = candidates.find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
  );
  return hit ? real(hit) : undefined;
};

class GrammarError extends Error {}

export function createServerSplitPlugin({
  vite,
  appRoot: rawAppRoot,
  strict = true,
  scanDir = 'src',
  failOnViolation = true,
  failPhase = 'writeBundle',
  report,
}) {
  const appRoot = real(rawAppRoot);
  const { parseAst, transformWithEsbuild } = vite;
  /** file -> { mtime, exports: Map<exportedName, { definedIn, definedAs }> } */
  const analysisCache = new Map();
  /** Set of absolute files that carry the `server-only` marker import. */
  let serverOnlyFiles = new Set();
  let serverModules = [];
  /** client-graph stub export surface, recorded at load(): file -> sorted "name:id" list */
  const stubSurface = new Map();
  /** manifest id set recorded at load(): sorted list */
  let manifestSurface = null;

  const invalidateAnalysis = (file) => {
    analysisCache.delete(file);
  };

  /**
   * Parse the *value* export surface of a server module.
   *
   * Allowed grammar (strict mode) — anything else is a build error:
   *   export const NAME = serverFn({ … })
   *   export { local as exported }            // local must be a top-level serverFn const
   *   export { name as exported } from './other.server.js'
   *   export type …  /  export type { … } from …   (erased before parsing)
   */
  const analyze = async (file, seen = new Set()) => {
    if (seen.has(file)) throw new GrammarError(`circular server re-export chain at ${file}`);
    seen.add(file);
    const mtime = statSync(file).mtimeMs;
    const cached = analysisCache.get(file);
    if (cached && cached.mtime === mtime) return cached.exports;

    const source = readFileSync(file, 'utf8');
    const exports = new Map();

    if (!strict) {
      // The brief as written: "for each export" via cheap discovery, no AST.
      for (const match of source.matchAll(/^\s*export\s+const\s+([A-Za-z_$][\w$]*)\s*=/gm)) {
        exports.set(match[1], { definedIn: file, definedAs: match[1] });
      }
      analysisCache.set(file, { mtime, exports });
      return exports;
    }

    // Types must be erased before an ECMAScript parser sees the module.
    const { code } = await transformWithEsbuild(source, file, { loader: 'ts' });
    const ast = parseAst(code);
    const serverFnLocals = new Set();

    for (const top of ast.body) {
      const node =
        top.type === 'ExportNamedDeclaration' && top.declaration ? top.declaration : top;
      if (node.type !== 'VariableDeclaration') continue;
      for (const decl of node.declarations) {
        if (
          decl.id.type === 'Identifier' &&
          decl.init?.type === 'CallExpression' &&
          decl.init.callee.type === 'Identifier' &&
          decl.init.callee.name === 'serverFn'
        ) {
          serverFnLocals.add(decl.id.name);
        }
      }
    }

    for (const node of ast.body) {
      if (node.type === 'ExportAllDeclaration') {
        throw new GrammarError(
          `${path.relative(appRoot, file)}: \`export *\` is not an analysable export surface`,
        );
      }
      if (node.type === 'ExportDefaultDeclaration') {
        throw new GrammarError(
          `${path.relative(appRoot, file)}: default exports are not allowed in a server module`,
        );
      }
      if (node.type !== 'ExportNamedDeclaration') continue;

      if (node.declaration) {
        const decl = node.declaration;
        if (decl.type !== 'VariableDeclaration' || decl.kind !== 'const') {
          throw new GrammarError(
            `${path.relative(appRoot, file)}: only \`export const NAME = serverFn(…)\` declarations are allowed`,
          );
        }
        for (const d of decl.declarations) {
          if (d.id.type !== 'Identifier' || !serverFnLocals.has(d.id.name)) {
            throw new GrammarError(
              `${path.relative(appRoot, file)}: exported \`${
                d.id.type === 'Identifier' ? d.id.name : '<pattern>'
              }\` is not a serverFn() call — a server module may export only server functions and types`,
            );
          }
          exports.set(d.id.name, { definedIn: file, definedAs: d.id.name });
        }
        continue;
      }

      if (node.source) {
        const target = resolveRelative(node.source.value, file);
        if (!target) {
          throw new GrammarError(
            `${path.relative(appRoot, file)}: cannot resolve re-export source \`${node.source.value}\``,
          );
        }
        if (!SERVER_FILE_RE.test(target)) {
          throw new GrammarError(
            `${path.relative(appRoot, file)}: re-export source \`${node.source.value}\` is not a server module`,
          );
        }
        const targetExports = await analyze(target, seen);
        for (const spec of node.specifiers) {
          const local = spec.local.name;
          const exported = spec.exported.name;
          const origin = targetExports.get(local);
          if (!origin) {
            throw new GrammarError(
              `${path.relative(appRoot, file)}: re-exported \`${local}\` is not a server function of ${path.relative(appRoot, target)}`,
            );
          }
          exports.set(exported, origin);
        }
        continue;
      }

      for (const spec of node.specifiers) {
        const local = spec.local.name;
        if (!serverFnLocals.has(local)) {
          throw new GrammarError(
            `${path.relative(appRoot, file)}: exported binding \`${local}\` is not a serverFn() call`,
          );
        }
        exports.set(spec.exported.name, { definedIn: file, definedAs: local });
      }
    }

    analysisCache.set(file, { mtime, exports });
    return exports;
  };

  const scan = () => {
    const root = path.join(appRoot, scanDir);
    const files = walk(root).map(real);
    serverModules = files.filter((file) => SERVER_FILE_RE.test(file)).sort();
    serverOnlyFiles = new Set(
      files.filter(
        (file) =>
          /\.[cm]?[jt]sx?$/.test(file) &&
          /^\s*import\s+['"]server-only['"]\s*;?\s*$/m.test(readFileSync(file, 'utf8')),
      ),
    );
  };

  /** Sorted "exportedName:id" list — the only thing a client bundle depends on. */
  const surfaceOf = async (file) => {
    const exports = await analyze(file);
    return [...exports]
      .map(([name, origin]) => `${name}:${fnId(appRoot, origin.definedIn, origin.definedAs)}`)
      .sort()
      .join(',');
  };

  const manifestIds = async () => {
    const ids = new Set();
    for (const file of serverModules) {
      const exports = await analyze(file);
      for (const origin of exports.values()) {
        ids.add(fnId(appRoot, origin.definedIn, origin.definedAs));
      }
    }
    return [...ids].sort().join(',');
  };

  const stubCode = async (file) => {
    const exports = await analyze(file);
    const lines = [
      '// generated by nisli-server-split — the real module never enters the client graph',
      "const ORIGIN = globalThis.__NISLI_FN_ORIGIN ?? '';",
      'const createStub = (id) =>',
      '  Object.assign(',
      '    async (input, opts) => {',
      "      const res = await fetch(ORIGIN + '/_nisli/fn/' + id, {",
      "        method: 'POST',",
      "        headers: { 'content-type': 'application/json', 'x-nisli-fn': id },",
      '        body: JSON.stringify({ input }),',
      '        signal: opts?.signal,',
      '      });',
      '      const body = await res.json();',
      "      if (!body.ok) throw Object.assign(new Error(body.error.code), { code: body.error.code, data: body.error.data });",
      '      return body.data;',
      '    },',
      "    { __fnId: id },",
      '  );',
    ];
    for (const [name, origin] of exports) {
      lines.push(
        `export const ${name} = /*#__PURE__*/ createStub(${JSON.stringify(
          fnId(appRoot, origin.definedIn, origin.definedAs),
        )});`,
      );
    }
    return lines.join('\n');
  };

  const manifestCode = async () => {
    const seen = new Map();
    for (const file of serverModules) {
      const exports = await analyze(file);
      for (const origin of exports.values()) {
        seen.set(fnId(appRoot, origin.definedIn, origin.definedAs), origin);
      }
    }
    const entries = [...seen.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    const body = entries
      .map(([id, origin]) => {
        const url = '/' + toPosix(path.relative(appRoot, origin.definedIn));
        return `  ${JSON.stringify(id)}: { name: ${JSON.stringify(origin.definedAs)}, module: ${JSON.stringify(url)}, load: () => import(${JSON.stringify(url)}) },`;
      })
      .join('\n');
    return `export default {\n${body}\n};\n`;
  };

  const violations = [];
  const seenViolationKeys = new Set();
  const addViolation = (v) => {
    const key = `${v.kind}:${v.detail}`;
    if (seenViolationKeys.has(key)) return;
    seenViolationKeys.add(key);
    violations.push(v);
    report?.violations?.push(v);
  };

  const isClientEnv = (ctx) => (ctx.environment?.config?.consumer ?? 'client') === 'client';

  const auditFailure = (ctx) => {
    if (!isClientEnv(ctx) || !failOnViolation || !violations.length) return null;
    return `nisli-server-split client audit failed:\n${violations
      .map((violation) => `  ${violation.kind}: ${violation.detail}`)
      .join('\n')}`;
  };

  return {
    name: 'nisli-server-split',
    enforce: 'pre',

    async buildStart() {
      scan();
      // Fail closed everywhere, not only in the environment that needs the manifest.
      for (const file of serverModules) {
        try {
          await analyze(file);
        } catch (error) {
          if (error instanceof GrammarError) this.error(error.message);
          throw error;
        }
      }
    },

    configureServer(server) {
      scan();
      server.__nisliServerSplit = {
        analyze,
        manifestCode,
        stubCode,
        rescan: scan,
        get serverModules() {
          return serverModules;
        },
      };
    },

    async resolveId(source, importer, options) {
      const client = isClientEnv(this);

      if (source === MANIFEST_ID || source === RESOLVED_MANIFEST_ID) {
        if (client && strict) {
          addViolation({ kind: 'manifest-in-client', detail: String(importer) });
          this.error(
            `virtual:nisli-server-fns imported from the client graph (importer: ${importer})`,
          );
        }
        return RESOLVED_MANIFEST_ID;
      }

      if (source === SERVER_ONLY_ID) {
        if (client) {
          addViolation({ kind: 'server-only-in-client', detail: String(importer) });
          if (strict) {
            this.error(
              `\`server-only\` module reached the client graph through ${importer}`,
            );
          }
        }
        return RESOLVED_SERVER_ONLY_ID;
      }

      if (!client) return null;

      if (!strict) {
        // Brief-as-written: bare specifier suffix test, no query awareness.
        if (!/\.server\.[cm]?[jt]sx?$/.test(source)) return null;
        const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
        if (!resolved) return null;
        return STUB_PREFIX + splitQuery(resolved.id)[0];
      }

      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved) return null;
      const [file, query] = splitQuery(resolved.id);
      if (!SERVER_FILE_RE.test(file)) return null;
      if (query) {
        addViolation({ kind: 'server-module-query-access', detail: `${source} from ${importer}` });
        this.error(
          `server module accessed with an unsupported query: \`${source}\` (importer: ${importer}). ` +
            'Query access (?raw/?url/?inline) bypasses stub substitution.',
        );
      }
      return STUB_PREFIX + file;
    },

    async load(id) {
      if (id === RESOLVED_SERVER_ONLY_ID) return 'export {};\n';
      if (id === RESOLVED_MANIFEST_ID) {
        if (!serverModules.length) scan();
        for (const file of serverModules) this.addWatchFile(file);
        manifestSurface = await manifestIds();
        return manifestCode();
      }
      if (id.startsWith(STUB_PREFIX)) {
        const file = id.slice(STUB_PREFIX.length);
        this.addWatchFile(file);
        stubSurface.set(file, await surfaceOf(file));
        return stubCode(file);
      }
      return null;
    },

    async hotUpdate({ type, file, modules }) {
      if (type !== 'update') scan();
      if (!SERVER_FILE_RE.test(file)) return;
      invalidateAnalysis(file);
      const environment = this.environment;
      const relative = toPosix(path.relative(appRoot, file));

      if (environment.name === 'client') {
        const stubModule = environment.moduleGraph.getModuleById(STUB_PREFIX + file);
        if (!stubModule) return modules;
        const next = await surfaceOf(file);
        const surfaceChanged = stubSurface.get(file) !== next;
        report?.hmr?.push({
          environment: 'client',
          file: relative,
          surfaceChanged,
          invalidated: surfaceChanged ? [stubModule.id] : [],
        });
        return surfaceChanged ? [stubModule] : [];
      }

      // Server environment: the real module invalidates by default, but the
      // virtual manifest has no import edge to it and would otherwise go stale.
      const out = [...modules];
      const nextManifest = await manifestIds();
      const manifestChanged = manifestSurface !== null && manifestSurface !== nextManifest;
      if (manifestChanged) {
        const manifestModule = environment.moduleGraph.getModuleById(RESOLVED_MANIFEST_ID);
        if (manifestModule) out.push(manifestModule);
      }
      report?.hmr?.push({
        environment: environment.name,
        file: relative,
        surfaceChanged: manifestChanged,
        invalidated: out.map((mod) => mod.id),
      });
      return out;
    },

    generateBundle(_options, bundle) {
      if (!isClientEnv(this)) return;
      // `new URL('./x.server.ts', import.meta.url)` never reaches resolveId and
      // never lands in chunk.modules: Vite inlines the file as a base64 data
      // URI (or emits it as an asset above assetsInlineLimit). Both channels
      // ship the verbatim module, so the audit needs a content arm too.
      const signatures = serverModules.map((file) => {
        const source = readFileSync(file, 'utf8');
        return {
          file,
          source,
          base64: Buffer.from(source, 'utf8').toString('base64'),
        };
      });

      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type === 'chunk') {
          for (const moduleId of Object.keys(output.modules)) {
            if (moduleId.startsWith(STUB_PREFIX)) continue;
            const [clean] = splitQuery(moduleId);
            if (SERVER_FILE_RE.test(clean)) {
              addViolation({
                kind: 'server-module-in-client-chunk',
                detail: `${fileName} <- ${toPosix(path.relative(appRoot, clean))}${splitQuery(moduleId)[1]}`,
              });
            } else if (serverOnlyFiles.has(clean)) {
              addViolation({
                kind: 'server-only-module-in-client-chunk',
                detail: `${fileName} <- ${toPosix(path.relative(appRoot, clean))}`,
              });
            }
          }
          for (const signature of signatures) {
            if (output.code.includes(signature.base64)) {
              addViolation({
                kind: 'server-source-inlined-as-data-uri',
                detail: `${fileName} <- base64(${toPosix(path.relative(appRoot, signature.file))})`,
              });
            } else if (output.code.includes(signature.source)) {
              addViolation({
                kind: 'server-source-inlined-verbatim',
                detail: `${fileName} <- ${toPosix(path.relative(appRoot, signature.file))}`,
              });
            }
          }
        } else {
          // Emitted assets are outside `chunk.modules` but still shipped.
          const named = output.originalFileNames?.find?.((n) => SERVER_FILE_RE.test(n)) ?? null;
          const text =
            typeof output.source === 'string'
              ? output.source
              : Buffer.from(output.source).toString('utf8');
          const matched = signatures.find((signature) => text.includes(signature.source));
          if (named || SERVER_FILE_RE.test(output.name ?? '') || matched) {
            addViolation({
              kind: 'server-module-emitted-as-asset',
              detail: `${fileName} <- ${named ?? output.name ?? toPosix(path.relative(appRoot, matched.file))}`,
            });
          }
        }
      }
      if (failPhase === 'generateBundle') {
        const message = auditFailure(this);
        if (message) this.error(message);
      }
    },

    writeBundle() {
      // Default phase is writeBundle so the harness can inspect what a leaking
      // build would have shipped. `failPhase: 'generateBundle'` is the shape a
      // production plugin must use — nothing reaches disk.
      if (failPhase !== 'writeBundle') return;
      const message = auditFailure(this);
      if (message) this.error(message);
    },
  };
}

export const constants = { STUB_PREFIX, MANIFEST_ID, SERVER_FILE_RE };
