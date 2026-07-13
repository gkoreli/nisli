import type { TemplateResult } from '@nisli/core';
import type { QueryCodec } from './query.js';

export type PathParams<Path extends string> =
  string extends Path ? Record<string, string> : ExtractPathParams<Path>;

type ExtractPathParams<Path extends string> =
  Path extends `${string}:${infer Rest}`
    ? Rest extends `${infer Name}/${infer Tail}`
      ? { [K in Name | keyof ExtractPathParams<`/${Tail}`>]: string }
      : { [K in Rest]: string }
    : Path extends `${string}*${infer Name}`
      ? { [K in Name]: string }
      : Record<never, never>;

/**
 * Per-segment path-parameter codecs. Reuses the {@link QueryCodec} contract so
 * `enumParam`, `numberParam`, … validate and refine `:params` the same way they
 * validate query values. An invalid segment is a matcher NO-MATCH (the URL falls
 * through to `notFound`), never a render-time error.
 */
export type PathCodecs<Path extends string> =
  Partial<Record<keyof PathParams<Path>, QueryCodec<unknown>>>;

/** Path parameters after applying any declared codecs (default: all strings). */
export type ResolvedParams<Path extends string, P> = {
  [K in keyof PathParams<Path>]: K extends keyof P
    ? P[K] extends QueryCodec<infer T> ? T : PathParams<Path>[K]
    : PathParams<Path>[K];
};

export type QuerySchema = Readonly<Record<string, QueryCodec<unknown>>>;
export type QueryValues<Q extends QuerySchema> = {
  [K in keyof Q]: Q[K] extends QueryCodec<infer T> ? T : never;
};

/** One `<link rel="alternate" hreflang="…">` entry for localized SEO. */
export interface AlternateLink {
  readonly hreflang: string;
  readonly href: string;
}

export interface RouteMetadata {
  /** Document title (`<title>`). */
  title?: string;
  /** `<meta name="…" content="…">` entries (description, robots, …). */
  meta?: Readonly<Record<string, string>>;
  /** `<meta property="…" content="…">` entries (OpenGraph, e.g. `og:title`). */
  property?: Readonly<Record<string, string>>;
  /** `<link rel="canonical" href="…">`. Removed on navigations that omit it. */
  canonical?: string;
  /** `<link rel="alternate" hreflang="…" href="…">` entries. */
  alternates?: readonly AlternateLink[];
  /** `<html lang="…">`. Falls back to the connect-time value when omitted. */
  lang?: string;
  /** `<html dir="…">`. Falls back to the connect-time value when omitted. */
  dir?: 'ltr' | 'rtl' | 'auto';
  /**
   * Managed `<script type="application/ld+json">` blocks, keyed by a stable id.
   * Serialized to JSON and reconciled (set/update/remove) like the meta/link
   * tags, so structured data never lingers after a client navigation.
   */
  jsonLd?: Readonly<Record<string, unknown>>;
}

export interface RouteContext<
  Path extends string = string,
  Q extends QuerySchema = QuerySchema,
  P = Record<never, never>,
> {
  url: URL;
  params: ResolvedParams<Path, P>;
  query: QueryValues<Q>;
  searchParams: URLSearchParams;
}

export type RouteRenderer<Path extends string, Q extends QuerySchema, P> =
  (context: RouteContext<Path, Q, P>) => TemplateResult | Promise<TemplateResult>;

export interface RouteOptions<Path extends string, Q extends QuerySchema, P extends PathCodecs<Path>> {
  params?: P;
  query?: Q;
  render: RouteRenderer<Path, Q, P>;
  entries?: () => Iterable<ResolvedParams<Path, P>> | Promise<Iterable<ResolvedParams<Path, P>>>;
  metadata?: RouteMetadata | ((context: RouteContext<Path, Q, P>) => RouteMetadata);
}

/**
 * Open-ended href extras, independent of the route's declared params/query.
 * `search` merges arbitrary query parameters (declared `query` wins on key
 * conflicts); `hash` appends a fragment. Used to carry the current URL's
 * untyped query (inquiry selection, attribution params) and anchor across a
 * counterpart-locale link without declaring every possible key as a codec.
 */
export interface HrefExtras {
  search?: URLSearchParams | Readonly<Record<string, string>> | string;
  hash?: string;
}

type HasKeys<T> = keyof T extends never ? false : true;
type HrefArgs<Path extends string, Q extends QuerySchema, P> =
  (HasKeys<ResolvedParams<Path, P>> extends true ? { params: ResolvedParams<Path, P> } : { params?: never }) &
  (HasKeys<QueryValues<Q>> extends true ? { query: QueryValues<Q> } : { query?: never }) &
  HrefExtras;
type NeedsHrefOptions<Path extends string, Q extends QuerySchema, P> =
  HasKeys<ResolvedParams<Path, P>> extends true ? true : HasKeys<QueryValues<Q>>;

export interface RouteDefinition<
  Path extends string = string,
  Q extends QuerySchema = QuerySchema,
  P extends PathCodecs<Path> = PathCodecs<Path>,
> {
  readonly kind: 'route';
  readonly path: Path;
  readonly params: P;
  readonly query: Q;
  readonly render: RouteRenderer<Path, Q, P>;
  readonly entries?: RouteOptions<Path, Q, P>['entries'];
  readonly metadata?: RouteOptions<Path, Q, P>['metadata'];
  href(...args: NeedsHrefOptions<Path, Q, P> extends true
    ? [options: HrefArgs<Path, Q, P>]
    : [options?: HrefArgs<Path, Q, P>]): string;
}

function replacePathParams(path: string, params: Record<string, string>): string {
  const consumed = new Set<string>();
  const result = path
    .replace(/\*([A-Za-z_$][\w$]*)/g, (_match, name: string) => {
      consumed.add(name);
      return encodeCatchAll(params[name], name);
    })
    .replace(/:([A-Za-z_$][\w$]*)/g, (_match, name: string) => {
      consumed.add(name);
      const value = params[name];
      if (value === undefined) throw new TypeError(`Missing path parameter: ${name}`);
      return encodeURIComponent(value);
    });
  for (const key of Object.keys(params)) {
    if (!consumed.has(key)) throw new TypeError(`Unknown path parameter: ${key}`);
  }
  return result;
}

function encodeCatchAll(value: string | undefined, name: string): string {
  if (value === undefined) throw new TypeError(`Missing path parameter: ${name}`);
  return value.split('/').map(encodeURIComponent).join('/');
}

function toSearchParams(input: HrefExtras['search']): URLSearchParams {
  if (input === undefined) return new URLSearchParams();
  // Copy so a passed-in URLSearchParams (e.g. the live location.search) is not mutated.
  return new URLSearchParams(input as URLSearchParams | Record<string, string> | string);
}

function normalizeHash(hash: string | undefined): string {
  if (!hash) return '';
  return hash.startsWith('#') ? hash : `#${hash}`;
}

/** Serialize typed path-parameter values back to their raw string segments. */
function serializePathParams(
  params: Record<string, unknown>,
  codecs: Record<string, QueryCodec<unknown>>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(params)) {
    const codec = codecs[name];
    if (codec) {
      const serialized = codec.serialize(value);
      if (serialized === undefined) throw new TypeError(`Path parameter is not serializable: ${name}`);
      result[name] = serialized;
    } else {
      result[name] = value as string;
    }
  }
  return result;
}

export function route<
  const Path extends string,
  const Q extends QuerySchema = Record<never, never>,
  const P extends PathCodecs<Path> = Record<never, never>,
>(
  path: Path,
  options: RouteOptions<NoInfer<Path>, Q, P>,
): RouteDefinition<Path, Q, P> {
  const params = (options.params ?? {}) as P;
  const paramCodecs = params as Record<string, QueryCodec<unknown>>;
  const query = (options.query ?? {}) as Q;
  return Object.freeze({
    kind: 'route' as const,
    path,
    params,
    query,
    render: options.render,
    entries: options.entries,
    metadata: options.metadata,
    href(args?: HrefArgs<Path, Q, P>) {
      const serialized = serializePathParams((args?.params ?? {}) as Record<string, unknown>, paramCodecs);
      const pathname = replacePathParams(path, serialized);
      // Seed from arbitrary carry-over params (attribution, inquiry selection,
      // counterpart-locale passthrough); declared query wins on key conflicts.
      const search = toSearchParams(args?.search);
      const values = (args?.query ?? {}) as Record<string, unknown>;
      for (const [name, value] of Object.entries(values)) {
        const queryCodec = query[name];
        if (!queryCodec) throw new TypeError(`Unknown query parameter: ${name}`);
        const serializedValue = queryCodec.serialize(value);
        if (serializedValue !== undefined) search.set(name, serializedValue);
        else search.delete(name);
      }
      const string = search.toString();
      const hash = normalizeHash(args?.hash);
      return `${string ? `${pathname}?${string}` : pathname}${hash}`;
    },
  });
}

export interface NotFoundDefinition {
  readonly kind: 'not-found';
  readonly render: (context: { url: URL }) => TemplateResult | Promise<TemplateResult>;
  readonly metadata?: RouteMetadata | ((context: { url: URL }) => RouteMetadata);
}

export function notFound(options: Omit<NotFoundDefinition, 'kind'>): NotFoundDefinition {
  return Object.freeze({ kind: 'not-found', ...options });
}

/** Context passed to a redirect's dynamic target resolver. */
export interface RedirectContext<Path extends string = string> {
  url: URL;
  params: PathParams<Path>;
  searchParams: URLSearchParams;
}

/** A redirect target: a fixed href, or a function of the matched request. */
export type RedirectTarget<Path extends string = string> =
  string | ((context: RedirectContext<Path>) => string);

/**
 * A client-side redirect. When its `path` matches, the browser router replaces
 * the current entry with the resolved target — replace semantics, no extra
 * history entry. This is only the client half; server 301s stay in the Worker.
 */
export interface RedirectDefinition<Path extends string = string> {
  readonly kind: 'redirect';
  readonly path: Path;
  readonly to: RedirectTarget<Path>;
  resolve(context: RedirectContext<Path>): string;
}

export function redirect<const Path extends string>(
  path: Path,
  to: RedirectTarget<NoInfer<Path>>,
): RedirectDefinition<Path> {
  return Object.freeze({
    kind: 'redirect' as const,
    path,
    to,
    resolve(context: RedirectContext<Path>): string {
      return typeof to === 'function' ? to(context) : to;
    },
  });
}
