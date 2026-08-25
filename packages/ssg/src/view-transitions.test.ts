import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { html } from '@nisli/core';
import { defineRouter, notFound, route } from '@nisli/router';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildStaticSite,
  renderViewTransitionHead,
  type StaticSiteViewTransitions,
} from './index.js';

const tempRoots: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'nisli-ssg-vt-'));
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempRoots.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const STYLE = '<style>@view-transition { navigation: auto; }</style>';
const DEFAULT_RULES = '<script type="speculationrules">'
  + '{"prefetch":[{"where":{"href_matches":"/*"},"eagerness":"moderate"}],'
  + '"prerender":[{"where":{"and":[{"href_matches":"/*"},'
  + '{"not":{"selector_matches":"[data-no-prerender]"}}]},"eagerness":"moderate"}]}'
  + '</script>';

const PAGES = [
  { path: '/', title: 'Home', body: '<h1>Home</h1>' },
  { path: '/posts/hello', title: 'hello', body: '<article>hello</article>' },
  { path: '/posts/second', title: 'second', body: '<article>second</article>' },
  { path: '/404.html', title: 'Not Found', body: '<h1>Missing</h1>' },
];

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
</head>
<body>
<main>${body}</main>
</body>
</html>
`;
}

/** Builds the same four full documents under an option, keyed by route path. */
async function buildSite(viewTransitions?: StaticSiteViewTransitions): Promise<Record<string, string>> {
  const result = await buildStaticSite({
    outDir: tempDir(),
    viewTransitions,
    routes: PAGES.map(({ path, title, body }) => ({ path, render: () => page(title, body) })),
  });
  return Object.fromEntries(result.pages.map(written => [
    written.path,
    readFileSync(written.filePath, 'utf8'),
  ]));
}

describe('viewTransitions emission', () => {
  it('leaves output byte-identical when the option is off', async () => {
    const today = await buildSite();
    expect(await buildSite(false)).toEqual(today);

    for (const html of Object.values(today)) {
      expect(html).not.toContain('@view-transition');
      expect(html).not.toContain('speculationrules');
    }

    // The object form is the enabled form; `{}` is "on, default tuning".
    expect(await buildSite({})).toEqual(await buildSite(true));
  });

  it('injects the @view-transition opt-in into the head of every page', async () => {
    const pages = await buildSite(true);

    expect(Object.keys(pages)).toHaveLength(4);
    for (const [path, html] of Object.entries(pages)) {
      expect(html.slice(html.indexOf('<head>'), html.indexOf('</head>')), path).toContain(STYLE);
    }
  });

  it('injects into router-built pages including the emitted 404', async () => {
    const AppRouter = defineRouter({
      home: route('/', { render: () => html`<h1>Home</h1>`, metadata: { title: 'Home' } }),
      post: route('/posts/:slug', {
        entries: () => [{ slug: 'hello' }],
        render: ({ params }) => html`<article>${params.slug}</article>`,
        metadata: ({ params }) => ({ title: params.slug }),
      }),
      notFound: notFound({ render: () => html`<h1>Missing</h1>`, metadata: { title: 'Not Found' } }),
    });

    const result = await buildStaticSite({
      outDir: tempDir(),
      router: AppRouter,
      viewTransitions: true,
      shell: ({ metadata }) => page(metadata?.title ?? '', 'body'),
    });

    expect(result.pages.map(written => written.path)).toEqual(['/', '/posts/hello', '/404.html']);
    for (const written of result.pages) {
      const html = readFileSync(written.filePath, 'utf8');
      expect(html.slice(html.indexOf('<head>'), html.indexOf('</head>')), written.path).toContain(STYLE);
    }
  });

  it('omits speculation rules unless they are requested', async () => {
    for (const html of Object.values(await buildSite(true))) {
      expect(html).toContain(STYLE);
      expect(html).not.toContain('speculationrules');
    }
    for (const html of Object.values(await buildSite({ speculationRules: false }))) {
      expect(html).not.toContain('speculationrules');
    }
  });

  it('emits the documented default speculation rules verbatim', async () => {
    const pages = await buildSite({ speculationRules: true });

    for (const [path, html] of Object.entries(pages)) {
      expect(html, path).toContain(`${STYLE}\n${DEFAULT_RULES}\n</head>`);
    }
  });

  it('tunes scope, eagerness, and the prerender exclusion', async () => {
    const pages = await buildSite({
      speculationRules: {
        hrefMatches: ['/docs/*', '/ui/*'],
        prefetch: 'conservative',
        prerender: 'eager',
        excludeSelector: '[data-skip]',
      },
    });

    expect(pages['/']).toContain(
      '<script type="speculationrules">'
      + '{"prefetch":[{"where":{"href_matches":["/docs/*","/ui/*"]},"eagerness":"conservative"}],'
      + '"prerender":[{"where":{"and":[{"href_matches":["/docs/*","/ui/*"]},'
      + '{"not":{"selector_matches":"[data-skip]"}}]},"eagerness":"eager"}]}'
      + '</script>',
    );
  });

  it('drops the prerender exclusion and either rule set on request', async () => {
    const noExclusion = await buildSite({ speculationRules: { prefetch: false, excludeSelector: false } });
    expect(noExclusion['/']).toContain(
      '<script type="speculationrules">'
      + '{"prerender":[{"where":{"href_matches":"/*"},"eagerness":"moderate"}]}'
      + '</script>',
    );

    const prefetchOnly = await buildSite({ speculationRules: { prerender: false } });
    expect(prefetchOnly['/']).toContain(
      '<script type="speculationrules">'
      + '{"prefetch":[{"where":{"href_matches":"/*"},"eagerness":"moderate"}]}'
      + '</script>',
    );

    const neither = await buildSite({ speculationRules: { prefetch: false, prerender: false } });
    expect(neither['/']).toContain(STYLE);
    expect(neither['/']).not.toContain('speculationrules');
  });

  it('emits valid, byte-stable JSON across builds', async () => {
    const options: StaticSiteViewTransitions = {
      speculationRules: { hrefMatches: '/docs/*', prerender: 'conservative' },
    };
    const first = await buildSite(options);
    expect(await buildSite(options)).toEqual(first);

    const payload = /<script type="speculationrules">(.*?)<\/script>/s.exec(first['/'] ?? '')?.[1] ?? '';
    expect(JSON.parse(payload)).toEqual({
      prefetch: [{ where: { href_matches: '/docs/*' }, eagerness: 'moderate' }],
      prerender: [{
        where: { and: [{ href_matches: '/docs/*' }, { not: { selector_matches: '[data-no-prerender]' } }] },
        eagerness: 'conservative',
      }],
    });
  });

  it('escapes payloads that would otherwise close the script element', async () => {
    const pages = await buildSite({ speculationRules: { excludeSelector: '[data-x="</script>"]' } });
    const emitted = pages['/'] ?? '';

    expect(emitted).toContain('\\u003C/script>');
    const payload = /<script type="speculationrules">(.*?)<\/script>\n<\/head>/s.exec(emitted)?.[1] ?? '';
    const parsed = JSON.parse(payload) as {
      prerender: [{ where: { and: [unknown, { not: { selector_matches: string } }] } }];
    };
    expect(parsed.prerender[0].where.and[1].not.selector_matches).toBe('[data-x="</script>"]');
  });

  it('prepends the block to fragment output, where the parser implies a head', async () => {
    const outDir = tempDir();
    await buildStaticSite({
      outDir,
      viewTransitions: true,
      routes: [{ path: '/', render: () => '<h1>Home</h1>' }],
    });

    expect(readFileSync(join(outDir, 'index.html'), 'utf8')).toBe(`${STYLE}\n<h1>Home</h1>`);
  });

  it('reuses the indentation of the closing head tag', async () => {
    const outDir = tempDir();
    await buildStaticSite({
      outDir,
      viewTransitions: true,
      routes: [{ path: '/', render: () => '<!doctype html>\n<head>\n  <title>x</title>\n  </head>\n' }],
    });

    expect(readFileSync(join(outDir, 'index.html'), 'utf8'))
      .toBe(`<!doctype html>\n<head>\n  <title>x</title>\n  ${STYLE}\n  </head>\n`);
  });

  it('fails loudly when a rendered document has no closing head tag', async () => {
    await expect(buildStaticSite({
      outDir: tempDir(),
      viewTransitions: true,
      routes: [{ path: '/', render: () => '<!doctype html>\n<body><h1>Home</h1></body>\n' }],
    })).rejects.toThrow('viewTransitions requires a closing </head> in rendered output: /');
  });

  it('exposes the same markup to shells that assemble the document themselves', () => {
    expect(renderViewTransitionHead(undefined)).toBe('');
    expect(renderViewTransitionHead(false)).toBe('');
    expect(renderViewTransitionHead(true)).toBe(STYLE);
    expect(renderViewTransitionHead({ speculationRules: true })).toBe(`${STYLE}\n${DEFAULT_RULES}`);
  });
});
