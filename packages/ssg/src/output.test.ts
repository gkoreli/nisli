import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanOutDir,
  copyPublicAssets,
  routeToFilePath,
  writeRoot,
  writeRoute,
} from './index.js';

const tempRoots: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'nisli-ssg-output-'));
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempRoots.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('output helpers', () => {
  it('maps root, slash routes, slug routes, and html routes to files', () => {
    const outDir = tempDir();

    expect(routeToFilePath(outDir, '/')).toBe(join(outDir, 'index.html'));
    expect(routeToFilePath(outDir, '/about')).toBe(join(outDir, 'about', 'index.html'));
    expect(routeToFilePath(outDir, 'posts/hello')).toBe(join(outDir, 'posts', 'hello', 'index.html'));
    expect(routeToFilePath(outDir, '/404.html')).toBe(join(outDir, '404.html'));
  });

  it('rejects dynamic routes and traversal routes', () => {
    const outDir = tempDir();

    expect(() => routeToFilePath(outDir, '/posts/:slug')).toThrow('Dynamic route path must be expanded before build');
    expect(() => routeToFilePath(outDir, '../outside')).toThrow('Static route path cannot escape outDir');
    expect(() => routeToFilePath(outDir, '/posts/../../outside')).toThrow('Static route path cannot escape outDir');
  });

  it('writes route html and returns the written page result', () => {
    const outDir = tempDir();

    const page = writeRoute(outDir, 'about', '<main>About</main>');

    expect(page).toEqual({
      path: 'about',
      filePath: join(outDir, 'about', 'index.html'),
      html: '<main>About</main>',
    });
    expect(readFileSync(join(outDir, 'about', 'index.html'), 'utf-8')).toBe('<main>About</main>');
  });

  it('writes root files and nested root files', () => {
    const outDir = tempDir();

    const feedPath = writeRoot(outDir, 'feed.xml', '<rss />');
    const dataPath = writeRoot(outDir, 'data/site.json', '{}');

    expect(feedPath).toBe(join(outDir, 'feed.xml'));
    expect(dataPath).toBe(join(outDir, 'data', 'site.json'));
    expect(readFileSync(join(outDir, 'feed.xml'), 'utf-8')).toBe('<rss />');
    expect(readFileSync(join(outDir, 'data', 'site.json'), 'utf-8')).toBe('{}');
  });

  it('rejects unsafe root file paths', () => {
    const outDir = tempDir();

    expect(() => writeRoot(outDir, '', '')).toThrow('Root file path cannot be empty');
    expect(() => writeRoot(outDir, '../feed.xml', '')).toThrow('Root file path cannot escape outDir');
  });

  it('cleans and recreates output directories', () => {
    const outDir = tempDir();
    writeFileSync(join(outDir, 'stale.txt'), 'stale');

    cleanOutDir(outDir);

    expect(existsSync(outDir)).toBe(true);
    expect(existsSync(join(outDir, 'stale.txt'))).toBe(false);
  });

  it('copies public assets when present and reports missing public directories', () => {
    const outDir = tempDir();
    const publicDir = tempDir();
    mkdirSync(join(publicDir, 'assets'));
    writeFileSync(join(publicDir, 'assets', 'site.txt'), 'asset');

    expect(copyPublicAssets({ publicDir, outDir })).toBe(true);
    expect(readFileSync(join(outDir, 'assets', 'site.txt'), 'utf-8')).toBe('asset');
    expect(copyPublicAssets({ publicDir: join(publicDir, 'missing'), outDir })).toBe(false);
  });
});
