import type { QueryCodec } from './query.js';
import type { NotFoundDefinition, QuerySchema, RedirectContext, RedirectDefinition, RouteContext, RouteDefinition, RouteMetadata } from './route.js';

/**
 * A flat route catalog: `route()`/`redirect()` entries under any key, plus an
 * optional `notFound` under the `notFound` key. This is the exact shape
 * `defineRouter` accepts; `defineRoutes`/`createMatcher` accept it too, so the
 * browser and an edge Worker share one authored catalog with no adapter.
 */
export type RouteCatalog = Readonly<Record<string, RouteDefinition<any, any, any> | RedirectDefinition<any> | NotFoundDefinition>>;

export interface RouteMatch<Params extends Record<string, unknown> = Record<string, string>, Query = Record<string, unknown>> {
  readonly name: string | null;
  readonly route: RouteDefinition | NotFoundDefinition | RedirectDefinition;
  readonly url: URL;
  readonly params: Params;
  readonly query: Query;
  readonly searchParams: URLSearchParams;
  readonly metadata?: RouteMetadata;
  readonly notFound: boolean;
  /** Resolved redirect target when the match is a redirect definition. */
  readonly redirect?: string;
}

export interface MatcherDefinition {
  readonly routes: Readonly<Record<string, RouteDefinition<any, any, any>>>;
  readonly redirects?: Readonly<Record<string, RedirectDefinition<any>>>;
  readonly notFound?: NotFoundDefinition;
  readonly base?: string;
}

type Segment = { kind: 'static'; value: string } | { kind: 'param'; name: string } | { kind: 'catch-all'; name: string };

interface CompiledRoute {
  name: string;
  route: RouteDefinition<any, any, any> | RedirectDefinition<any>;
  segments: Segment[];
  score: number[];
}

export function normalizePathname(pathname: string): string {
  let normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  normalized = normalized.replace(/\/{2,}/g, '/');
  if (normalized.length > 1) normalized = normalized.replace(/\/+$/, '');
  return normalized || '/';
}

function normalizeBase(base = '/'): string {
  const normalized = normalizePathname(base);
  return normalized === '/' ? '' : normalized;
}

/** Normalize a configured base to `''` or `/segment` (no trailing slash). */
function normalizeCatalogBase(base?: string): string {
  if (!base || base === '/') return '';
  return `/${base.replace(/^\/+|\/+$/g, '')}`;
}

/** Prefix a catalog-relative href/target with the application base. */
export function prefixBase(base: string, href: string): string {
  return href === '/' ? `${base}/` : `${base}${href}`;
}

/**
 * Partition a flat {@link RouteCatalog} into the normalized
 * {@link MatcherDefinition} that {@link createMatcher} consumes — routes and
 * redirects by `kind`, `notFound` by key, redirect targets base-prefixed. Pure
 * and environment-neutral: an edge Worker imports this (via `@nisli/router/
 * catalog`) to build the same matcher the browser does, with no @nisli/core
 * runtime and no consumer-side adapter.
 */
export function defineRoutes(catalog: RouteCatalog, options: { base?: string } = {}): MatcherDefinition {
  const base = normalizeCatalogBase(options.base);
  const routes: Record<string, RouteDefinition<any, any, any>> = {};
  const redirects: Record<string, RedirectDefinition<any>> = {};
  for (const [name, value] of Object.entries(catalog)) {
    const kind = (value as { kind?: unknown } | null)?.kind;
    if (kind === 'route') {
      routes[name] = value as RouteDefinition<any, any, any>;
    } else if (kind === 'redirect') {
      const def = value as RedirectDefinition<any>;
      redirects[name] = base
        ? Object.freeze({ ...def, resolve: (context: RedirectContext) => prefixBase(base, def.resolve(context)) })
        : def;
    }
  }
  const configured = (catalog as { notFound?: unknown }).notFound;
  const notFound = (configured as { kind?: unknown } | undefined)?.kind === 'not-found'
    ? (configured as NotFoundDefinition)
    : undefined;
  return { routes, redirects, notFound, base };
}

/** A MatcherDefinition has a `routes` record; a flat catalog does not (a route
 *  literally keyed `routes` carries `kind`, so it is still treated as flat). */
function isMatcherDefinition(input: MatcherDefinition | RouteCatalog): input is MatcherDefinition {
  const routes = (input as { routes?: unknown }).routes;
  return typeof routes === 'object' && routes !== null && (routes as { kind?: unknown }).kind === undefined;
}

function compile(path: string): Segment[] {
  const normalized = normalizePathname(path);
  if (normalized === '/') return [];
  return normalized.slice(1).split('/').map((part, index, all): Segment => {
    if (part.startsWith('*')) {
      if (index !== all.length - 1) throw new TypeError(`Catch-all must be the final segment: ${path}`);
      const name = part.slice(1);
      if (!name) throw new TypeError(`Catch-all parameter requires a name: ${path}`);
      return { kind: 'catch-all', name };
    }
    if (part.startsWith(':')) {
      if (part.endsWith('*')) throw new TypeError(`Invalid catch-all syntax; use *name: ${path}`);
      return { kind: 'param', name: part.slice(1) };
    }
    return { kind: 'static', value: decodeSegment(part, path) };
  });
}

function decodeSegment(segment: string, path: string): string {
  try { return decodeURIComponent(segment); } catch { throw new TypeError(`Invalid percent encoding in route path: ${path}`); }
}

function compiledRoutes(definition: MatcherDefinition): CompiledRoute[] {
  const seen = new Map<string, string>();
  const matchable: Array<[string, RouteDefinition<any, any, any> | RedirectDefinition<any>]> = [
    ...Object.entries(definition.routes),
    ...Object.entries(definition.redirects ?? {}),
  ];
  const result = matchable.map(([name, route]) => {
    const segments = compile(route.path);
    const signature = segments.map((segment) => segment.kind === 'static' ? `s:${segment.value}` : segment.kind).join('/');
    const duplicate = seen.get(signature);
    if (duplicate) throw new TypeError(`Ambiguous routes "${duplicate}" and "${name}"`);
    seen.set(signature, name);
    return { name, route, segments, score: segments.map((s) => s.kind === 'static' ? 3 : s.kind === 'param' ? 2 : 1) };
  });
  return result.sort((a, b) => {
    const length = Math.max(a.score.length, b.score.length);
    for (let i = 0; i < length; i++) {
      const diff = (b.score[i] ?? 0) - (a.score[i] ?? 0);
      if (diff) return diff;
    }
    return b.score.length - a.score.length;
  });
}

function matchSegments(compiled: CompiledRoute, pathname: string): Record<string, string> | null {
  const raw = pathname === '/' ? [] : pathname.slice(1).split('/');
  const params: Record<string, string> = {};
  let index = 0;
  for (const segment of compiled.segments) {
    if (segment.kind === 'catch-all') {
      if (index >= raw.length) return null;
      try { params[segment.name] = raw.slice(index).map(decodeURIComponent).join('/'); } catch { return null; }
      index = raw.length;
      break;
    }
    const value = raw[index++];
    if (value === undefined) return null;
    let decoded: string;
    try { decoded = decodeURIComponent(value); } catch { return null; }
    if (segment.kind === 'static') {
      if (decoded !== segment.value) return null;
    } else {
      params[segment.name] = decoded;
    }
  }
  return index === raw.length ? params : null;
}

function parseQuery(schema: QuerySchema, searchParams: URLSearchParams): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, queryCodec] of Object.entries(schema)) result[name] = queryCodec.parse(searchParams.get(name));
  return result;
}

/**
 * Validate/refine raw path parameters through their declared codecs. Returns
 * `null` when any codec rejects its segment, which the matcher treats as a
 * NO-MATCH so the URL falls through to the next candidate or `notFound`.
 */
function applyParamCodecs(
  codecs: Readonly<Record<string, QueryCodec<unknown> | undefined>> | undefined,
  raw: Record<string, string>,
): Record<string, unknown> | null {
  if (!codecs) return raw;
  const result: Record<string, unknown> = { ...raw };
  for (const [name, codec] of Object.entries(codecs)) {
    const value = raw[name];
    if (!codec || value === undefined) continue;
    try {
      result[name] = codec.parse(value);
    } catch {
      return null;
    }
  }
  return result;
}

export function createMatcher(input: MatcherDefinition | RouteCatalog): (input: URL | string, baseURL?: string | URL) => RouteMatch | null {
  // Accept the same flat catalog `defineRouter` takes, or a pre-normalized
  // definition — one catalog shape for browser and Worker, no adapter.
  const definition = isMatcherDefinition(input) ? input : defineRoutes(input);
  const routes = compiledRoutes(definition);
  const base = normalizeBase(definition.base);
  return (input, baseURL = 'http://localhost/') => {
    const url = input instanceof URL ? new URL(input.href) : new URL(input, baseURL);
    const normalized = normalizePathname(url.pathname);
    if (base && normalized !== base && !normalized.startsWith(`${base}/`)) return null;
    const pathname = normalizePathname(base ? normalized.slice(base.length) : normalized);
    for (const candidate of routes) {
      const rawParams = matchSegments(candidate, pathname);
      if (!rawParams) continue;
      if (candidate.route.kind === 'redirect') {
        const redirectContext = { url, params: rawParams, searchParams: url.searchParams };
        return {
          name: candidate.name,
          route: candidate.route,
          url,
          params: rawParams,
          query: {},
          searchParams: url.searchParams,
          notFound: false,
          redirect: candidate.route.resolve(redirectContext),
        };
      }
      const parsed = applyParamCodecs(candidate.route.params, rawParams);
      if (!parsed) continue;
      let query: Record<string, unknown>;
      try { query = parseQuery(candidate.route.query, url.searchParams); } catch { continue; }
      const context = { url, params: parsed, query, searchParams: url.searchParams } as RouteContext;
      const metadata = typeof candidate.route.metadata === 'function' ? candidate.route.metadata(context) : candidate.route.metadata;
      // Codec-refined values are preserved at runtime; the public RouteMatch
      // surfaces params as strings (the typed view is the render context).
      const params = parsed as Record<string, string>;
      return { name: candidate.name, route: candidate.route, url, params, query, searchParams: url.searchParams, metadata, notFound: false };
    }
    if (!definition.notFound) return null;
    const metadata = typeof definition.notFound.metadata === 'function' ? definition.notFound.metadata({ url }) : definition.notFound.metadata;
    return { name: null, route: definition.notFound, url, params: {}, query: {}, searchParams: url.searchParams, metadata, notFound: true };
  };
}
