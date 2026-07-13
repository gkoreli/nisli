/**
 * `@nisli/router/catalog` — the pure, environment-neutral surface.
 *
 * Re-exports only `route`/`redirect`/`notFound`, the query codecs, and the
 * matcher (`createMatcher`/`defineRoutes`/`normalizePathname`). It never touches
 * `defineRouter` or `Router` — so it pulls no `@nisli/core` runtime and is safe
 * to import from a shared route-catalog module and from an edge Worker.
 *
 * Author the catalog once here, then:
 *   - the browser client: `defineRouter(catalog)` (from `@nisli/router`);
 *   - the Worker: `createMatcher(catalog)` — the same flat catalog, no adapter.
 *
 * Route `render` callbacks MUST use dynamic `import()` for page modules, so the
 * Worker (which matches and reads metadata but never calls `render`) never pulls
 * client/component chunks into its bundle.
 */
export {
  route,
  redirect,
  notFound,
  bindRenders,
  type AlternateLink,
  type BoundRenderer,
  type HrefExtras,
  type NotFoundDefinition,
  type NotFoundRenderer,
  type PathCodecs,
  type RenderableKeys,
  type RenderBindings,
  type PathParams,
  type RedirectContext,
  type RedirectDefinition,
  type RedirectTarget,
  type ResolvedParams,
  type QuerySchema,
  type QueryValues,
  type RouteContext,
  type RouteDefinition,
  type RouteMetadata,
  type RouteOptions,
} from './route.js';
export {
  createMatcher,
  defineRoutes,
  normalizePathname,
  prefixBase,
  type MatcherDefinition,
  type RouteCatalog,
  type RouteMatch,
} from './matcher.js';
export {
  booleanParam,
  enumParam,
  numberParam,
  optional,
  stringParam,
  type QueryCodec,
} from './query.js';
