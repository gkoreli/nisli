/**
 * esbuild-hmr/server.ts — Tiny SSE hub for the Nisli HMR change channel.
 *
 * DEV-ONLY, Node, build-time. Reachable only via `@nisli/core/esbuild-hmr`,
 * never the runtime `.` entry (ADR 0021, Ruling 1). Uses only `node:http`
 * (a Node built-in, not a package dependency), so the zero-dep posture of the
 * `.` entry is preserved.
 *
 * Two ways to wire transport (ADR 0021 Engineering Plan §1):
 *   (a) Standalone: `createHmrServer()` starts a minimal `node:http` SSE hub at
 *       `/esbuild` (matching esbuild's own client convention) and returns a
 *       broadcaster the plugin pushes `change` payloads to.
 *   (b) BYO: any object implementing {@link ChangeBroadcaster} (e.g. an esbuild
 *       `serve` adapter that owns the `/esbuild` endpoint) can be handed to the
 *       plugin instead.
 */

/// <reference types="node" />
import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';

/** esbuild-shaped change payload broadcast to dev clients. */
export interface ChangePayload {
  added: string[];
  removed: string[];
  updated: string[];
}

/** Anything that can push a `change` event to connected dev clients. */
export interface ChangeBroadcaster {
  /** Broadcast a change to every connected client. */
  broadcast(payload: ChangePayload): void;
  /** Current number of connected clients (for diagnostics/tests). */
  readonly clientCount: number;
}

/** Handle for the standalone SSE hub. */
export interface HmrServer extends ChangeBroadcaster {
  /** The underlying `node:http` server (for `.address()`, lifecycle, tests). */
  readonly server: Server;
  /** Start listening. Resolves once bound. */
  listen(port?: number, host?: string): Promise<{ port: number; host: string }>;
  /** Close all client connections and stop the server. */
  close(): Promise<void>;
}

export interface CreateHmrServerOptions {
  /** SSE route. Defaults to `/esbuild` (esbuild's client convention). */
  path?: string;
}

/**
 * Create a standalone SSE hub. Returns immediately; call `listen()` to bind.
 * The plugin calls `broadcast()` from its `onEnd` after each watch rebuild.
 */
export function createHmrServer(options: CreateHmrServerOptions = {}): HmrServer {
  const path = options.path ?? '/esbuild';
  const clients = new Set<ServerResponse>();

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url !== path) {
      res.statusCode = 404;
      res.end();
      return;
    }
    // SSE handshake.
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('retry: 500\n\n');
    clients.add(res);
    req.on('close', () => {
      clients.delete(res);
    });
  });

  const broadcast = (payload: ChangePayload): void => {
    const frame = `event: change\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of clients) {
      try {
        res.write(frame);
      } catch {
        clients.delete(res);
      }
    }
  };

  return {
    server,
    broadcast,
    get clientCount() {
      return clients.size;
    },
    listen(port = 0, host = '127.0.0.1') {
      return new Promise((resolve) => {
        server.listen(port, host, () => {
          const addr = server.address();
          const boundPort = typeof addr === 'object' && addr ? addr.port : port;
          resolve({ port: boundPort, host });
        });
      });
    },
    close() {
      return new Promise((resolve) => {
        for (const res of clients) {
          try {
            res.end();
          } catch {
            /* ignore */
          }
        }
        clients.clear();
        server.close(() => resolve());
      });
    },
  };
}
