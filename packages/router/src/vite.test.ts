import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { html } from '@nisli/core';
import { defineRouter } from './application.js';
import { notFound, route } from './route.js';
import { nisliRoutes, type NisliViteServer, type ViteNext, type ViteRequest, type ViteResponse } from './vite.js';

const roots: string[] = [];

function root(): string {
  const directory = mkdtempSync(join(tmpdir(), 'nisli-router-vite-'));
  roots.push(directory);
  writeFileSync(join(directory, 'index.html'), '<main>shell</main>');
  return directory;
}

afterEach(() => {
  for (const directory of roots.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function harness(app: ReturnType<typeof defineRouter>) {
  let middleware!: (request: ViteRequest, response: ViteResponse, next: ViteNext) => void | Promise<void>;
  const transformIndexHtml = vi.fn(async (url: string, source: string) => `${source}:${url}`);
  const directory = root();
  const server: NisliViteServer = {
    config: { root: directory },
    middlewares: { use: (handler) => { middleware = handler; } },
    transformIndexHtml,
  };
  const plugin = nisliRoutes(app);
  plugin.configureServer(server);
  return { directory, middleware, plugin, transformIndexHtml };
}

function response() {
  const result = { statusCode: 0, headers: new Map<string, string>(), body: undefined as string | undefined };
  const value: ViteResponse = {
    statusCode: 0,
    setHeader: (name, content) => result.headers.set(name, content),
    end: (body) => { result.statusCode = value.statusCode; result.body = body; },
  };
  return { value, result };
}

describe('nisliRoutes()', () => {
  const app = () => defineRouter({
    home: route('/', { render: () => html`home` }),
    user: route('/users/:id', { render: () => html`user` }),
    notFound: notFound({ render: () => html`missing` }),
  });

  it('is a serve-only plugin with no transform or HMR protocol', () => {
    const { plugin } = harness(app());
    expect(plugin).toMatchObject({ name: 'nisli-routes', apply: 'serve' });
    expect(plugin).not.toHaveProperty('transform');
    expect(plugin).not.toHaveProperty('handleHotUpdate');
  });

  it('serves the transformed shell for direct dynamic and not-found URLs', async () => {
    const { middleware, transformIndexHtml } = harness(app());
    for (const url of ['/users/42?tab=profile', '/missing']) {
      const output = response();
      const next = vi.fn();
      await middleware({ method: 'GET', url, headers: { accept: 'text/html' } }, output.value, next);
      expect(next).not.toHaveBeenCalled();
      expect(output.result.statusCode).toBe(200);
      expect(output.result.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
      expect(output.result.body).toBe(`<main>shell</main>:${url}`);
      expect(transformIndexHtml).toHaveBeenCalledWith(url, '<main>shell</main>');
    }
  });

  it('passes assets, non-HTML requests, and URLs outside the base path onward', async () => {
    const based = defineRouter({ home: route('/', { render: () => html`` }) }, { base: '/app' });
    const { middleware } = harness(based);
    for (const request of [
      { method: 'GET', url: '/src/main.ts', headers: { accept: '*/*' } },
      { method: 'POST', url: '/app', headers: { accept: 'text/html' } },
      { method: 'GET', url: '/outside', headers: { accept: 'text/html' } },
    ]) {
      const next = vi.fn();
      await middleware(request, response().value, next);
      expect(next).toHaveBeenCalledOnce();
    }
  });

  it('supports HEAD without returning a body', async () => {
    const { middleware } = harness(app());
    const output = response();
    await middleware({ method: 'HEAD', url: '/', headers: { accept: 'text/html' } }, output.value, vi.fn());
    expect(output.result.statusCode).toBe(200);
    expect(output.result.body).toBeUndefined();
  });

  it('forwards index transform failures to Vite', async () => {
    const { middleware, transformIndexHtml } = harness(app());
    transformIndexHtml.mockRejectedValueOnce(new Error('transform failed'));
    const next = vi.fn();
    await middleware({ method: 'GET', url: '/', headers: { accept: 'text/html' } }, response().value, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'transform failed' }));
  });

  it('forwards index read failures to Vite', async () => {
    const { directory, middleware } = harness(app());
    unlinkSync(join(directory, 'index.html'));
    const next = vi.fn();
    await middleware({ method: 'GET', url: '/', headers: { accept: 'text/html' } }, response().value, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'ENOENT' }));
  });
});
