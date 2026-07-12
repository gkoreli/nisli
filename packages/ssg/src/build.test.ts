import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { children, component, html, signal, ref, onMount } from '@nisli/core';
import { defineRouter, notFound, numberParam, route } from '@nisli/router';
import { afterEach, describe, expect, it } from 'vitest';
import { buildStaticSite } from './index.js';

const tempRoots: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'nisli-ssg-'));
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempRoots.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('buildStaticSite', () => {
  it('writes route output to index files', async () => {
    const outDir = tempDir();

    const result = await buildStaticSite({
      outDir,
      routes: [
        { path: '/', render: () => '<h1>Home</h1>' },
        { path: '/about', render: () => '<p>About</p>' },
        { path: 'posts/hello', render: () => '<article>Hello</article>' },
      ],
    });

    expect(readFileSync(join(outDir, 'index.html'), 'utf-8')).toBe('<h1>Home</h1>');
    expect(readFileSync(join(outDir, 'about', 'index.html'), 'utf-8')).toBe('<p>About</p>');
    expect(readFileSync(join(outDir, 'posts', 'hello', 'index.html'), 'utf-8')).toBe('<article>Hello</article>');
    expect(result.pages.map(page => page.path)).toEqual(['/', '/about', 'posts/hello']);
  });

  it('passes context and calls hooks', async () => {
    const outDir = tempDir();
    const events: string[] = [];

    await buildStaticSite({
      outDir,
      context: { title: 'Nisli' },
      routes: [
        { path: '/', render: ({ title }) => `<h1>${title}</h1>` },
      ],
      beforeBuild: ({ title }) => { events.push(`before:${title}`); },
      onPage: page => { events.push(`page:${page.path}`); },
      afterBuild: result => { events.push(`after:${result.pages.length}`); },
    });

    expect(events).toEqual(['before:Nisli', 'page:/', 'after:1']);
  });

  it('renders regular @nisli/core html template results', async () => {
    const outDir = tempDir();
    const active = signal(true);

    await buildStaticSite({
      outDir,
      routes: [
        {
          path: '/',
          render: () => html`
            <main class=${'page'} class:active=${active}>
              <h1>${'Hello <Nisli>'}</h1>
              <button @click=${() => {}}>Read</button>
              <section html:inner=${'<p>trusted</p>'}></section>
            </main>
          `,
        },
      ],
    });

    const output = readFileSync(join(outDir, 'index.html'), 'utf-8');
    expect(output).toContain('<main class="page active">');
    expect(output).toContain('<h1>Hello &lt;Nisli&gt;</h1>');
    expect(output).toContain('<button>Read</button>');
    expect(output).toContain('<section><p>trusted</p></section>');
  });

  it('renders regular Nisli component factory results inside templates', async () => {
    const outDir = tempDir();
    const ArticleCard = component<{ title: string }>('ssg-article-card', props => {
      return html`<article><h2>${props.title}</h2></article>`;
    });

    await buildStaticSite({
      outDir,
      routes: [
        {
          path: '/',
          render: () => html`${ArticleCard({ title: 'Factory Component' }, { class: 'featured' })}`,
        },
      ],
    });

    const output = readFileSync(join(outDir, 'index.html'), 'utf-8');
    expect(output).toContain('<ssg-article-card class="featured">');
    expect(output).toContain('<article><h2>Factory Component</h2></article>');
  });

  it('settles real content projection before snapshotting (ADR 0025 §5)', async () => {
    // @nisli/ui projects plain-HTML-authored children into an inner root via a
    // post-mount queueMicrotask sweep. This exercises the ACTUAL mechanism: the
    // projector captures its host's light-DOM children at setup, detaches them,
    // and re-appends them into an inner slot on a post-mount microtask. So the
    // authored child is genuinely ABSENT from the DOM at synchronous-snapshot
    // time and only reappears once tick() drains the sweep.
    const outDir = tempDir();
    const Projector = component('ssg-projector', (_props, host) => {
      const captured = Array.from(host.childNodes);
      for (const node of captured) host.removeChild(node);
      const slot = ref<HTMLDivElement>();
      onMount(() => {
        queueMicrotask(() => {
          if (slot.current) for (const node of captured) slot.current.appendChild(node);
        });
      });
      return html`<div data-slot="projected" ref="${slot}"></div>`;
    });
    // Silence the unused-import lint: Projector is registered by the call above.
    void Projector;

    await buildStaticSite({
      outDir,
      // Plain-HTML-authored child (`projected-light-dom`) nested in the custom
      // element — the template parser gives it to the host as a real childNode.
      routes: [{ path: '/', render: () => html`<ssg-projector>projected-light-dom</ssg-projector>` }],
    });

    const output = readFileSync(join(outDir, 'index.html'), 'utf-8');
    expect(output).toContain('data-slot="projected"');
    // Present ONLY because tick() drained the projection sweep before snapshot;
    // and it landed INSIDE the inner slot, proving real projection ran.
    expect(output).toContain('<div data-slot="projected">projected-light-dom</div>');
  });

  it('projects factory children through buildStaticSite (ADR 0025 item 1)', async () => {
    const outDir = tempDir();
    const Btn = component<{ children?: string }>(
      'ssg-proj-btn',
      () => html`<button data-slot="btn">${children('DEFAULT')}</button>`,
    );
    void Btn;

    await buildStaticSite({
      outDir,
      routes: [{ path: '/', render: () => Btn({ children: 'Click' }) }],
    });

    const output = readFileSync(join(outDir, 'index.html'), 'utf-8');
    expect(output).toContain('data-slot="btn"');
    expect(output).toContain('Click'); // factory children projected into the slot
    expect(output).not.toContain('DEFAULT'); // fallback replaced
  });

  it('projects light-DOM children and settles the sweep via tick() (item 1 + §5)', async () => {
    const outDir = tempDir();
    const Btn2 = component(
      'ssg-proj-btn2',
      () => html`<button data-slot="btn2">${children('DEFAULT')}</button>`,
    );
    void Btn2;

    await buildStaticSite({
      // Plain-HTML light child; capture (+ any late sweep) settles under tick().
      outDir,
      routes: [{ path: '/', render: () => html`<ssg-proj-btn2>Projected</ssg-proj-btn2>` }],
    });

    const output = readFileSync(join(outDir, 'index.html'), 'utf-8');
    expect(output).toContain('data-slot="btn2"');
    expect(output).toContain('Projected');
    expect(output).not.toContain('DEFAULT');
  });

  it('renders top-level Nisli component factory results', async () => {
    const outDir = tempDir();
    const StaticHero = component<{ title: string }>('ssg-static-hero', props => {
      return html`<header><h1>${props.title}</h1></header>`;
    });

    await buildStaticSite({
      outDir,
      routes: [
        {
          path: '/',
          render: () => StaticHero({ title: 'Top Level Component' }, { class: 'hero' }),
        },
      ],
    });

    const output = readFileSync(join(outDir, 'index.html'), 'utf-8');
    expect(output).toContain('<ssg-static-hero class="hero">');
    expect(output).toContain('<header><h1>Top Level Component</h1></header>');
  });

  it('copies public assets before writing pages', async () => {
    const outDir = tempDir();
    const publicDir = tempDir();
    mkdirSync(join(publicDir, 'assets'));
    writeFileSync(join(publicDir, 'assets', 'site.txt'), 'asset');

    await buildStaticSite({
      outDir,
      publicDir,
      routes: [
        { path: '/', render: () => 'home' },
      ],
    });

    expect(readFileSync(join(outDir, 'assets', 'site.txt'), 'utf-8')).toBe('asset');
    expect(readFileSync(join(outDir, 'index.html'), 'utf-8')).toBe('home');
  });

  it('rejects unexpanded dynamic routes', async () => {
    const outDir = tempDir();

    await expect(buildStaticSite({
      outDir,
      routes: [
        { path: '/posts/:slug', render: () => 'post' },
      ],
    })).rejects.toThrow('Dynamic route path must be expanded before build');
  });

  it('cleans existing output by default', async () => {
    const outDir = tempDir();
    writeFileSync(join(outDir, 'stale.txt'), 'stale');

    await buildStaticSite({
      outDir,
      routes: [
        { path: '/', render: () => 'fresh' },
      ],
    });

    expect(existsSync(join(outDir, 'stale.txt'))).toBe(false);
    expect(readFileSync(join(outDir, 'index.html'), 'utf-8')).toBe('fresh');
  });

  it('preserves existing output when clean is false', async () => {
    const outDir = tempDir();
    writeFileSync(join(outDir, 'stale.txt'), 'stale');

    await buildStaticSite({
      outDir,
      clean: false,
      routes: [
        { path: '/', render: () => 'fresh' },
      ],
    });

    expect(readFileSync(join(outDir, 'stale.txt'), 'utf-8')).toBe('stale');
    expect(readFileSync(join(outDir, 'index.html'), 'utf-8')).toBe('fresh');
  });

  it('expands router entries and reuses matched render contexts', async () => {
    const outDir = tempDir();
    const seen: Array<{ slug: string; page: number; pathname: string }> = [];
    const AppRouter = defineRouter({
      home: route('/', { render: () => html`<h1>Home</h1>` }),
      post: route('/posts/:slug', {
        query: { page: numberParam().default(1) },
        entries: async () => [{ slug: 'hello world' }, { slug: 'second' }],
        render: ({ params, query, url }) => {
          seen.push({ slug: params.slug, page: query.page, pathname: url.pathname });
          return html`<article>${params.slug}:${query.page}</article>`;
        },
      }),
    }, { base: '/docs' });

    const result = await buildStaticSite({ outDir, router: AppRouter });

    expect(readFileSync(join(outDir, 'docs', 'index.html'), 'utf8')).toContain('Home');
    expect(readFileSync(join(outDir, 'docs', 'posts', 'hello%20world', 'index.html'), 'utf8'))
      .toContain('hello world:1');
    expect(result.pages.map((page) => page.path)).toEqual([
      '/docs/', '/docs/posts/hello%20world', '/docs/posts/second',
    ]);
    expect(seen).toEqual([
      { slug: 'hello world', page: 1, pathname: '/docs/posts/hello%20world' },
      { slug: 'second', page: 1, pathname: '/docs/posts/second' },
    ]);
  });

  it('emits root 404.html and passes shared metadata through shell', async () => {
    const outDir = tempDir();
    const shellPages: Array<{ path: string; title?: string; description?: string; notFound: boolean }> = [];
    const AppRouter = defineRouter({
      home: route('/', {
        render: () => html`<h1>Home</h1>`,
        metadata: { title: 'Home', meta: { description: 'Start' } },
      }),
      notFound: notFound({
        render: () => html`<h1>Missing</h1>`,
        metadata: { title: 'Not Found', meta: { description: 'Missing page' } },
      }),
    });

    const result = await buildStaticSite({
      outDir,
      router: AppRouter,
      shell: (page) => {
        shellPages.push({
          path: page.path,
          title: page.metadata?.title,
          description: page.metadata?.meta?.description,
          notFound: page.notFound,
        });
        return html`<!doctype html><title>${page.metadata?.title}</title><main>${page.content}</main>`;
      },
    });

    expect(readFileSync(join(outDir, 'index.html'), 'utf8')).toContain('<title>Home</title>');
    expect(readFileSync(join(outDir, '404.html'), 'utf8')).toContain('<title>Not Found</title>');
    expect(readFileSync(join(outDir, '404.html'), 'utf8')).toContain('<h1>Missing</h1>');
    expect(result.pages.map((page) => page.path)).toEqual(['/', '/404.html']);
    expect(shellPages).toEqual([
      { path: '/', title: 'Home', description: 'Start', notFound: false },
      { path: '/404.html', title: 'Not Found', description: 'Missing page', notFound: true },
    ]);
  });

  it('rejects dynamic application routes without entries', async () => {
    const AppRouter = defineRouter({
      post: route('/posts/:slug', { render: () => html`` }),
    });
    await expect(buildStaticSite({ outDir: tempDir(), router: AppRouter }))
      .rejects.toThrow('requires entries()');
  });

  it('rejects generated URLs that do not re-match their source route', async () => {
    const AppRouter = defineRouter({
      page: route('/page', {
        query: { page: numberParam() },
        render: () => html``,
      }),
      notFound: notFound({ render: () => html`` }),
    });
    await expect(buildStaticSite({ outDir: tempDir(), router: AppRouter }))
      .rejects.toThrow('did not match its generated static URL');
  });
});
