/**
 * build.ts — render the whole site to dist/ from the AppRouter (ADR 0026).
 * Driven by src/render.test.ts (vitest is the repo's TS runner); the package
 * build script then compiles dist/assets/site.css with the Tailwind CLI.
 *
 * buildStaticSite expands the AppRouter's routes (static + entries()-expanded
 * dynamic ones) and writes each match's body fragment to its per-route file
 * (`/` → dist/index.html, `/ui/button` → dist/ui/button/index.html, the
 * notFound → dist/404.html). The `shell` callback captures each page's metadata;
 * we then wrap every written fragment in the full HTML document (shell.ts).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStaticSite } from '@nisli/ssg';
import { shell, type ShellMeta } from './shell.js';
import { AppRouter } from './app-router.js';
import { hydrateSet } from './hydrate-set.js';

/** A /ui/<name> page hydrates when its component has an interactive example. */
function hydratesPath(path: string): boolean {
  const name = /^\/ui\/(.+)$/.exec(path)?.[1];
  return name !== undefined && hydrateSet.has(name);
}

const siteDir = dirname(dirname(fileURLToPath(import.meta.url)));

export interface BuiltPage {
  path: string;
  filePath: string;
}

export async function buildSite(outDir: string = join(siteDir, 'dist')): Promise<BuiltPage[]> {
  const metaByPath = new Map<string, ShellMeta>();

  const result = await buildStaticSite({
    outDir,
    router: AppRouter,
    // The router build renders each match's content; we return it as the body
    // fragment (SSG writes it to disk) and record its metadata for the wrap.
    shell: (page) => {
      metaByPath.set(page.path, {
        title: page.metadata?.title ?? 'nisli',
        description: page.metadata?.meta?.description ?? '',
      });
      return page.content;
    },
  });

  mkdirSync(join(outDir, 'assets'), { recursive: true });

  const built: BuiltPage[] = [];
  for (const page of result.pages) {
    const meta = metaByPath.get(page.path) ?? { title: 'nisli', description: '' };
    const fragment = readFileSync(page.filePath, 'utf8');
    writeFileSync(page.filePath, shell(fragment, meta, { hydrate: hydratesPath(page.path) }));
    built.push({ path: page.path, filePath: page.filePath });
  }
  return built;
}
