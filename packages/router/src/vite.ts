import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ApplicationRouter } from './application.js';
import type { RouteMatch } from './matcher.js';
import type { RouteDefinition } from './route.js';

export interface ViteRequest {
  method?: string;
  url?: string;
  headers: { accept?: string | string[] };
}

export interface ViteResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

export type ViteNext = (error?: unknown) => void;

export interface NisliViteServer {
  config: { root: string };
  middlewares: {
    use(handler: (request: ViteRequest, response: ViteResponse, next: ViteNext) => void | Promise<void>): void;
  };
  transformIndexHtml(url: string, html: string): Promise<string>;
}

export interface NisliRoutesPlugin {
  name: string;
  apply: 'serve';
  match(input: URL | string, baseURL?: string | URL): RouteMatch | null;
  configureServer(server: NisliViteServer): void;
}

export interface NisliRoutesOptions {
  /** Application shell read and transformed for matched HTML requests. */
  index?: string;
}

/**
 * Serve direct development requests for one application router definition.
 *
 * Matching is delegated to `AppRouter.match()`. The returned shell mounts the
 * same AppRouter in the browser, so page rendering and query parsing remain in
 * the shared route contract. This plugin adds no transform or HMR protocol and
 * composes independently with `@nisli/core/vite-hmr`.
 */
export function nisliRoutes(
  router: ApplicationRouter<Readonly<Record<string, RouteDefinition<any, any>>>>,
  options: NisliRoutesOptions = {},
): NisliRoutesPlugin {
  const index = options.index ?? 'index.html';
  return {
    name: 'nisli-routes',
    apply: 'serve',
    match: router.match,
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const method = request.method ?? 'GET';
        const requestUrl = request.url;
        if (!requestUrl || (method !== 'GET' && method !== 'HEAD') || !acceptsHtml(request.headers.accept)) {
          next();
          return;
        }

        const origin = 'http://nisli.local/';
        if (!router.match(requestUrl, origin)) {
          next();
          return;
        }

        try {
          const source = await readFile(join(server.config.root, index), 'utf8');
          const html = await server.transformIndexHtml(requestUrl, source);
          response.statusCode = 200;
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.end(method === 'HEAD' ? undefined : html);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

function acceptsHtml(value: string | string[] | undefined): boolean {
  const accept = Array.isArray(value) ? value.join(',') : value;
  return accept?.split(',').some((part) => part.trim().split(';')[0] === 'text/html') ?? false;
}
