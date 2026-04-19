import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, sep } from 'node:path';

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

function routeToFilePath(outDir: string, routePath: string): string {
  if (!routePath.startsWith('/')) {
    throw new Error(`Static route path must start with "/": ${routePath}`);
  }

  if (routePath.includes(':')) {
    throw new Error(`Dynamic route path must be expanded before build: ${routePath}`);
  }

  const cleanPath = routePath.split('?')[0]?.split('#')[0] ?? routePath;
  const normalized = normalize(cleanPath);

  if (normalized.includes(`..${sep}`) || normalized === '..') {
    throw new Error(`Static route path cannot escape outDir: ${routePath}`);
  }

  if (normalized === sep || normalized === '/') {
    return join(outDir, 'index.html');
  }

  const relativePath = normalized.replace(/^[/\\]+/, '');
  if (relativePath.endsWith('.html')) {
    return join(outDir, relativePath);
  }

  return join(outDir, relativePath, 'index.html');
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

  if (clean && existsSync(config.outDir)) {
    rmSync(config.outDir, { recursive: true });
  }
  mkdirSync(config.outDir, { recursive: true });

  if (config.publicDir && copyPublic && existsSync(config.publicDir)) {
    cpSync(config.publicDir, config.outDir, { recursive: true });
  }

  await config.beforeBuild?.(context);

  const pages: StaticPageResult[] = [];
  for (const route of config.routes) {
    const html = renderPage(await route.render(context));
    const filePath = routeToFilePath(config.outDir, route.path);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, html);

    const page = { path: route.path, filePath, html };
    pages.push(page);
    await config.onPage?.(page);
  }

  const result = { outDir: config.outDir, pages };
  await config.afterBuild?.(result);
  return result;
}
