import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { component, html, signal } from '@nisli/core';
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
});
