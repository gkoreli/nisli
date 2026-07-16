import { mkdirSync } from 'node:fs';
import { renderToHtml, type Renderable } from './core-render.js';
import { cleanOutDir, copyPublicAssets, writeRoute } from './output.js';

export type { Renderable } from './core-render.js';

export interface StaticRoute<Context extends Record<string, unknown> = Record<string, never>> {
  path: string;
  render: (context: Context) => Renderable | Promise<Renderable>;
}

/** Structural router metadata contract; keeps the router package optional. */
export interface StaticRouterMetadata {
  /** Document title (`<title>`). */
  title?: string;
  /** `<meta name="…" content="…">` entries. */
  meta?: Readonly<Record<string, string>>;
  /** `<meta property="…" content="…">` entries such as OpenGraph. */
  property?: Readonly<Record<string, string>>;
  /** `<link rel="canonical" href="…">`. */
  canonical?: string;
  /** `<link rel="alternate" hreflang="…" href="…">` entries. */
  alternates?: readonly {
    readonly hreflang: string;
    readonly href: string;
  }[];
  /** Document language and direction. */
  lang?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  /** Keyed structured-data blocks for a static shell to serialize. */
  jsonLd?: Readonly<Record<string, unknown>>;
}

// Under strictFunctionTypes, a precise route metadata callback is
// contravariantly unassignable to this broad structural context. Extracting a
// method deliberately grants bivariant parameter checking, matching render's
// method syntax while retaining object-valued metadata. Do not simplify this
// to a function-property type; that reintroduces the variance rejection.
type BivariantCallback<Args extends unknown[], Result> = {
  bivarianceHack(...args: Args): Result;
}['bivarianceHack'];

export interface StaticRouterRenderContext {
  url: URL;
  params: Record<string, string>;
  query: Record<string, unknown>;
  searchParams: URLSearchParams;
}

export interface StaticRouterRoute {
  path: string;
  href(...args: unknown[]): string;
  entries?: () => Iterable<Record<string, string>> | Promise<Iterable<Record<string, string>>>;
  // Optional: a route may be authored render-less (identity-only) for a Worker/
  // shared catalog and bound on the client. A static build requires it (guarded).
  render?(context: StaticRouterRenderContext): Renderable | Promise<Renderable>;
  metadata?: StaticRouterMetadata | BivariantCallback<[StaticRouterRenderContext], StaticRouterMetadata>;
}

export interface StaticRouterNotFound {
  render?(context: { url: URL }): Renderable | Promise<Renderable>;
  metadata?: StaticRouterMetadata | BivariantCallback<[{ url: URL }], StaticRouterMetadata>;
}

/**
 * Structural view of a client-side redirect definition. Redirects are resolved
 * in the browser (ADR 0026); the static build carries the type only so a router
 * that declares redirects stays assignable to {@link StaticApplicationRouter}.
 */
export interface StaticRouterRedirect {
  kind: 'redirect';
  path: string;
  resolve(context: { url: URL; params: Record<string, string>; searchParams: URLSearchParams }): string;
}

export interface StaticRouterMatch {
  name: string | null;
  route: StaticRouterRoute | StaticRouterNotFound | StaticRouterRedirect;
  url: URL;
  params: Record<string, string>;
  query: Record<string, unknown>;
  searchParams: URLSearchParams;
  metadata?: StaticRouterMetadata;
  notFound: boolean;
  /** Resolved redirect target when the match is a redirect definition. */
  redirect?: string;
}

export interface StaticApplicationRouter {
  routes: Readonly<Record<string, StaticRouterRoute>>;
  notFound?: StaticRouterNotFound;
  match(input: URL | string, baseURL?: string | URL): StaticRouterMatch | null;
}

interface StaticSiteConfigBase<Context extends Record<string, unknown>> {
  outDir: string;
  context?: Context;
  publicDir?: string;
  clean?: boolean;
  copyPublic?: boolean;
  beforeBuild?: (context: Context) => void | Promise<void>;
  afterBuild?: (result: StaticSiteBuildResult) => void | Promise<void>;
  onPage?: (page: StaticPageResult) => void | Promise<void>;
}

export interface StaticRoutesSiteConfig<Context extends Record<string, unknown> = Record<string, never>>
  extends StaticSiteConfigBase<Context> {
  routes: readonly StaticRoute<Context>[];
  router?: never;
  shell?: never;
}

export interface StaticRouterPage {
  path: string;
  url: URL;
  match: StaticRouterMatch;
  content: Renderable;
  metadata?: StaticRouterMetadata;
  notFound: boolean;
}

export interface StaticRouterSiteConfig<Context extends Record<string, unknown> = Record<string, never>>
  extends StaticSiteConfigBase<Context> {
  router: StaticApplicationRouter;
  routes?: never;
  shell?: (page: StaticRouterPage) => Renderable | Promise<Renderable>;
}

export type StaticSiteConfig<Context extends Record<string, unknown> = Record<string, never>> =
  | StaticRoutesSiteConfig<Context>
  | StaticRouterSiteConfig<Context>;

export interface StaticPageResult {
  path: string;
  filePath: string;
  html: string;
}

export interface StaticSiteBuildResult {
  outDir: string;
  pages: StaticPageResult[];
}

export async function buildStaticSite<Context extends Record<string, unknown> = Record<string, never>>(
  config: StaticSiteConfig<Context>,
): Promise<StaticSiteBuildResult> {
  const clean = config.clean ?? true;
  const copyPublic = config.copyPublic ?? true;
  const context = (config.context ?? {}) as Context;

  if (clean) {
    cleanOutDir(config.outDir);
  } else {
    mkdirSync(config.outDir, { recursive: true });
  }

  if (config.publicDir && copyPublic) {
    copyPublicAssets({ publicDir: config.publicDir, outDir: config.outDir });
  }

  await config.beforeBuild?.(context);

  const pages: StaticPageResult[] = [];
  if ('router' in config && config.router) {
    const renderedPages = await renderRouterPages(config);
    for (const rendered of renderedPages) {
      const html = await renderToHtml(rendered.content);
      const page = writeRoute(config.outDir, rendered.path, html);
      pages.push(page);
      await config.onPage?.(page);
    }
  } else {
    // Preserve the existing route-by-route render/write/hook ordering.
    for (const route of config.routes) {
      const html = await renderToHtml(await route.render(context));
      const page = writeRoute(config.outDir, route.path, html);
      pages.push(page);
      await config.onPage?.(page);
    }
  }

  const result = { outDir: config.outDir, pages };
  await config.afterBuild?.(result);
  return result;
}

interface PendingPage {
  path: string;
  content: Renderable;
}

async function renderRouterPages<Context extends Record<string, unknown>>(
  config: StaticRouterSiteConfig<Context>,
): Promise<PendingPage[]> {
  const pages: PendingPage[] = [];
  for (const route of Object.values(config.router.routes)) {
    const hrefs = await staticHrefs(route);
    for (const href of hrefs) {
      const match = config.router.match(href, 'http://nisli.local/');
      if (!match || match.notFound || match.route !== route) {
        throw new Error(`Router did not match its generated static URL: ${href}`);
      }
      if (!route.render) {
        throw new Error(`Route requires a render to build statically (bind it before buildStaticSite): ${route.path}`);
      }
      const content = await route.render({
        url: match.url,
        params: match.params,
        query: match.query,
        searchParams: match.searchParams,
      });
      pages.push({
        path: href,
        content: await applyShell(config, {
          path: href,
          url: match.url,
          match,
          content,
          metadata: match.metadata,
          notFound: false,
        }),
      });
    }
  }

  if (config.router.notFound) {
    const page = await renderNotFound(config, config.router.notFound);
    pages.push({ path: '/404.html', content: page });
  }
  return pages;
}

async function staticHrefs(route: StaticRouterRoute): Promise<string[]> {
  const dynamic = /(?:^|\/)[:*][^/]+/.test(route.path);
  if (!dynamic) return [(route.href as () => string)()];
  if (!route.entries) throw new Error(`Dynamic route requires entries() for static build: ${route.path}`);
  const entries = await route.entries();
  return [...entries].map((params) => (
    route.href as (options: { params: Record<string, string> }) => string
  )({ params }));
}

async function renderNotFound<Context extends Record<string, unknown>>(
  config: StaticRouterSiteConfig<Context>,
  definition: StaticRouterNotFound,
): Promise<Renderable> {
  const url = new URL('/404.html', 'http://nisli.local/');
  const metadata = typeof definition.metadata === 'function'
    ? definition.metadata({ url })
    : definition.metadata;
  const match: StaticRouterMatch = {
    name: null,
    route: definition,
    url,
    params: {},
    query: {},
    searchParams: url.searchParams,
    metadata,
    notFound: true,
  };
  if (!definition.render) {
    throw new Error('notFound requires a render to build statically (bind it before buildStaticSite)');
  }
  const content = await definition.render({ url });
  return applyShell(config, {
    path: '/404.html',
    url,
    match,
    content,
    metadata,
    notFound: true,
  });
}

async function applyShell<Context extends Record<string, unknown>>(
  config: StaticRouterSiteConfig<Context>,
  page: StaticRouterPage,
): Promise<Renderable> {
  return config.shell ? config.shell(page) : page.content;
}
