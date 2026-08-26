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

/*
 * ── The two per-page shell decisions, DERIVED FROM THE EMITTED HTML ─────────
 *
 * These used to be one function, `hydratesPath(path)`, holding a literal list
 * of `/ui` and `/docs` prefixes. `render.test.ts` held a second copy of the
 * same list and asserted the two agreed. That is a test with no subject:
 * `has(path) === isDocsLayout(path)` is satisfied whenever BOTH are false, so
 * it passed most confidently exactly when a page was most absent from the
 * feature. Adding a route that needs the runtime made both sides answer "no"
 * and the suite stayed green while the page shipped without its client half.
 *
 * So the question is asked of the ARTIFACT instead. A page needs the runtime
 * iff it actually contains something for the runtime to mount, and it needs
 * intent's stylesheet iff it actually declares intent's vocabulary. Both facts
 * are in the fragment that is about to be wrapped, so a new route cannot forget
 * to opt in and an old route cannot keep an entitlement it no longer uses.
 *
 * TWO PREDICATES, TWO NAMES, ON PURPOSE. They are different questions that
 * happen to correlate: one is a BUILD decision (does this document reference a
 * script bundle) and the other is a STYLING decision (does it reference a
 * stylesheet). They already disagree — /intent renders in SiteShell alone yet
 * needs both, /ui/button needs the runtime and not the theme. If they ever
 * converge, keep them separate anyway: a single flag serving two questions is
 * precisely how the duplicated list got there.
 */

/**
 * Does this page reference the client runtime (`/ui-preview/hydrate.js`)?
 *
 * A hydration frame is `[data-hydrate="<name>"]` (the DocsLayout mobile drawer,
 * the view-transitions demo island, the intent islands) or `[data-preview]` (a
 * live @nisli/ui component preview). `client/hydrate.ts` mounts exactly those
 * two selectors, so this predicate is the same set expressed as a string test —
 * and a page with neither stays runtime-free, which keeps the static-first
 * tenet a measured property rather than an intention.
 */
const HYDRATION_FRAME = /\bdata-(?:hydrate=|preview\b)/;

/**
 * Does this page declare @nisli/intent's vocabulary, and therefore need
 * `/assets/intent.css`?
 *
 * The marker set is intent's axis attributes MINUS `data-align` and
 * `data-role`, which are the only two of intent's 26 that @nisli/ui also
 * writes (22 and 1 call sites: bubble, message, input-group, lib/floating,
 * acp-transcript). Including them would load intent's theme onto /ui/message
 * because a tooltip wrote an animation hook — a false positive that would
 * re-open the site-wide bleed through the back door. The remaining attributes
 * are intent's alone, so a match means the page really did declare meaning.
 */
const INTENT_VOCABULARY =
  /\bdata-(?:appearance|layout|text|priority|collapse|grow|clip|density|input|fit|truncate|flush|table|component|theme)[=>\s]/;

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
    writeFileSync(
      page.filePath,
      shell(fragment, meta, {
        hydrate: HYDRATION_FRAME.test(fragment),
        intentTheme: INTENT_VOCABULARY.test(fragment),
      }),
    );
    built.push({ path: page.path, filePath: page.filePath });
  }
  return built;
}
