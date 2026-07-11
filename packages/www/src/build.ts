/**
 * build.ts — render every route to dist/ with @nisli/ssg.
 * Driven by src/render.test.ts (vitest is the repo's TS runner); the package
 * build script then compiles dist/assets/site.css with the Tailwind CLI.
 *
 * @nisli/ssg renders each route's body fragment and writes it to its per-route
 * file (writeRoute: `/` → dist/index.html, `/docs/x` → dist/docs/x/index.html);
 * we then wrap each fragment in the full HTML document (shell) and overwrite.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStaticSite } from '@nisli/ssg';
import { shell } from './shell.js';
import { routes } from './routes.js';

const siteDir = dirname(dirname(fileURLToPath(import.meta.url)));

export interface BuiltPage {
  path: string;
  filePath: string;
}

export async function buildSite(outDir: string = join(siteDir, 'dist')): Promise<BuiltPage[]> {
  const result = await buildStaticSite({
    outDir,
    routes: routes.map((route) => ({ path: route.path, render: () => route.body() })),
  });

  mkdirSync(join(outDir, 'assets'), { recursive: true });

  const built: BuiltPage[] = [];
  for (const page of result.pages) {
    const route = routes.find((r) => r.path === page.path);
    if (!route) throw new Error(`no route metadata for rendered page ${page.path}`);
    writeFileSync(page.filePath, shell(page.html, route.meta));
    built.push({ path: page.path, filePath: page.filePath });
  }
  return built;
}
