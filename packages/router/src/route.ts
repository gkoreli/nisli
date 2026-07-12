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

export type QuerySchema = Readonly<Record<string, QueryCodec<unknown>>>;
export type QueryValues<Q extends QuerySchema> = {
  [K in keyof Q]: Q[K] extends QueryCodec<infer T> ? T : never;
};

export interface RouteMetadata {
  title?: string;
  meta?: Readonly<Record<string, string>>;
}

export interface RouteContext<Path extends string = string, Q extends QuerySchema = QuerySchema> {
  url: URL;
  params: PathParams<Path>;
  query: QueryValues<Q>;
  searchParams: URLSearchParams;
}

export type RouteRenderer<Path extends string, Q extends QuerySchema> =
  (context: RouteContext<Path, Q>) => TemplateResult | Promise<TemplateResult>;

export interface RouteOptions<Path extends string, Q extends QuerySchema> {
  query?: Q;
  render: RouteRenderer<Path, Q>;
  entries?: () => Iterable<PathParams<Path>> | Promise<Iterable<PathParams<Path>>>;
  metadata?: RouteMetadata | ((context: RouteContext<Path, Q>) => RouteMetadata);
}

type HasKeys<T> = keyof T extends never ? false : true;
type HrefArgs<Path extends string, Q extends QuerySchema> =
  (HasKeys<PathParams<Path>> extends true ? { params: PathParams<Path> } : { params?: never }) &
  (HasKeys<QueryValues<Q>> extends true ? { query: QueryValues<Q> } : { query?: never });
type NeedsHrefOptions<Path extends string, Q extends QuerySchema> =
  HasKeys<PathParams<Path>> extends true ? true : HasKeys<QueryValues<Q>>;

export interface RouteDefinition<Path extends string = string, Q extends QuerySchema = QuerySchema> {
  readonly kind: 'route';
  readonly path: Path;
  readonly query: Q;
  readonly render: RouteRenderer<Path, Q>;
  readonly entries?: RouteOptions<Path, Q>['entries'];
  readonly metadata?: RouteOptions<Path, Q>['metadata'];
  href(...args: NeedsHrefOptions<Path, Q> extends true
    ? [options: HrefArgs<Path, Q>]
    : [options?: HrefArgs<Path, Q>]): string;
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

export function route<const Path extends string, const Q extends QuerySchema = Record<never, never>>(
  path: Path,
  options: RouteOptions<Path, Q>,
): RouteDefinition<Path, Q> {
  const query = (options.query ?? {}) as Q;
  return Object.freeze({
    kind: 'route' as const,
    path,
    query,
    render: options.render,
    entries: options.entries,
    metadata: options.metadata,
    href(args?: HrefArgs<Path, Q>) {
      const params = (args?.params ?? {}) as Record<string, string>;
      const pathname = replacePathParams(path, params);
      const search = new URLSearchParams();
      const values = (args?.query ?? {}) as Record<string, unknown>;
      for (const [name, value] of Object.entries(values)) {
        const queryCodec = query[name];
        if (!queryCodec) throw new TypeError(`Unknown query parameter: ${name}`);
        const serialized = queryCodec.serialize(value);
        if (serialized !== undefined) search.set(name, serialized);
      }
      const string = search.toString();
      return string ? `${pathname}?${string}` : pathname;
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
