import { mkdirSync } from 'node:fs';
import { cleanOutDir, copyPublicAssets, writeRoute } from './output.js';

export type Renderable = string;

export interface StaticRoute<Context extends Record<string, unknown> = Record<string, never>> {
  path: string;
  render: (context: Context) => Renderable | Promise<Renderable>;
}

export interface StaticSiteConfig<Context extends Record<string, unknown> = Record<string, never>> {
  outDir: string;
  routes: readonly StaticRoute<Context>[];
  context?: Context;
  publicDir?: string;
  clean?: boolean;
  copyPublic?: boolean;
  beforeBuild?: (context: Context) => void | Promise<void>;
  afterBuild?: (result: StaticSiteBuildResult) => void | Promise<void>;
  onPage?: (page: StaticPageResult) => void | Promise<void>;
}

export interface StaticPageResult {
  path: string;
  filePath: string;
  html: string;
}

export interface StaticSiteBuildResult {
  outDir: string;
  pages: StaticPageResult[];
}

function renderPage(value: Renderable): string {
  return value;
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
  for (const route of config.routes) {
    const html = renderPage(await route.render(context));
    const page = writeRoute(config.outDir, route.path, html);
    pages.push(page);
    await config.onPage?.(page);
  }

  const result = { outDir: config.outDir, pages };
  await config.afterBuild?.(result);
  return result;
}
