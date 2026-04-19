/**
 * Nisli SSG public API.
 */

import './environment.js';

export {
  buildStaticSite,
  type Renderable,
  type StaticRoute,
  type StaticSiteConfig,
  type StaticPageResult,
  type StaticSiteBuildResult,
} from './build.js';

export {
  cleanOutDir,
  copyPublicAssets,
  routeToFilePath,
  writeRoot,
  writeRoute,
  type CopyPublicAssetsOptions,
  type WrittenRouteResult,
} from './output.js';
