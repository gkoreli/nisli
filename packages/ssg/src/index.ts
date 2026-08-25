/**
 * Nisli SSG public API.
 */

import './environment.js';

export {
  buildStaticSite,
  type Renderable,
  type StaticRoute,
  type StaticSiteConfig,
  type StaticRoutesSiteConfig,
  type StaticRouterSiteConfig,
  type StaticRouterPage,
  type StaticApplicationRouter,
  type StaticRouterMatch,
  type StaticRouterMetadata,
  type StaticRouterNotFound,
  type StaticRouterRenderContext,
  type StaticRouterRoute,
  type StaticPageResult,
  type StaticSiteBuildResult,
} from './build.js';

export {
  // Exported for shells that assemble the document themselves (build the head,
  // then wrap the emitted body fragment): they need the same markup verbatim.
  renderViewTransitionHead,
  type SpeculationEagerness,
  type StaticSiteSpeculationRules,
  type StaticSiteViewTransitions,
  type StaticSiteViewTransitionsConfig,
} from './view-transitions.js';

// Also published as `@nisli/ssg/client`, which is the import to use from a
// browser bundle: this barrel pulls in the build-only (node:fs, happy-dom) half.
export { whenActive } from './client.js';

export {
  cleanOutDir,
  copyPublicAssets,
  routeToFilePath,
  writeRoot,
  writeRoute,
  type CopyPublicAssetsOptions,
  type WrittenRouteResult,
} from './output.js';
