/**
 * build.ts — render the site to dist/ with @nisli/ssg.
 * Driven by src/render.test.ts (vitest is the repo's TS runner); the
 * package build script then compiles dist/assets/site.css with Tailwind.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStaticSite } from '@nisli/ssg';
import { shell } from './shell.js';
import { homePage } from './pages/home.js';

const siteDir = dirname(dirname(fileURLToPath(import.meta.url)));

export async function buildSite(outDir: string = join(siteDir, 'dist')): Promise<string> {
  const result = await buildStaticSite({
    outDir,
    routes: [{ path: '/', render: () => homePage() }],
  });
  const first = result.pages[0];
  if (!first) throw new Error('no page rendered');
  const page = shell(readFileSync(first.filePath, 'utf8'));
  mkdirSync(join(outDir, 'assets'), { recursive: true });
  const outFile = join(outDir, 'index.html');
  writeFileSync(outFile, page);
  return outFile;
}
