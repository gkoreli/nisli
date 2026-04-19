import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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
      ],
    });

    expect(readFileSync(join(outDir, 'index.html'), 'utf-8')).toBe('<h1>Home</h1>');
    expect(readFileSync(join(outDir, 'about', 'index.html'), 'utf-8')).toBe('<p>About</p>');
    expect(result.pages.map(page => page.path)).toEqual(['/', '/about']);
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
});
