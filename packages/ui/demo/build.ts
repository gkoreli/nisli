/**
 * demo/build.ts — build the kitchen sink into an openable page.
 *
 *   pnpm --filter @nisli/ui demo:build
 *   open packages/ui/demo/dist/index.html
 *
 * Wraps the SSG-rendered fragment in a full HTML shell with the Tailwind v4
 * browser build (CDN — needs network when viewing) and the registry's
 * theme.css inlined, plus a light/dark toggle. This is the page for the
 * visual side-by-side pass against shadcn (NORTH-STAR "v1 done" item 2).
 *
 * Runs on Node >= 23.6 (native type stripping).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDemoSite } from './site.js';

const demoDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(demoDir, 'dist');

const result = await buildDemoSite(outDir);
const first = result.pages[0];
if (!first) throw new Error('no page rendered');
const fragment = readFileSync(first.filePath, 'utf8');
const theme = readFileSync(join(demoDir, 'src/nisli-ui/styles/theme.css'), 'utf8');

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>@nisli/ui — kitchen sink</title>
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<style type="text/tailwindcss">
${theme}
</style>
</head>
<body>
<div class="fixed top-4 right-4 z-[200]">
  <button id="theme-toggle" class="rounded-md border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-xs hover:bg-accent">
    Toggle dark
  </button>
</div>
${fragment}
<script>
  document.getElementById('theme-toggle').addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
  });
</script>
</body>
</html>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'index.html'), page);
console.log(`kitchen sink → ${join(outDir, 'index.html')}`);
