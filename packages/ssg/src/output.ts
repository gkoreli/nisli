import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface CopyPublicAssetsOptions {
  publicDir: string;
  outDir: string;
}

export interface WrittenRouteResult {
  path: string;
  filePath: string;
  html: string;
}

function routeSegments(routePath: string): string[] {
  const cleanPath = routePath.split('?')[0]?.split('#')[0] ?? routePath;
  const path = cleanPath.replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+$/, '');

  if (path === '') {
    return [];
  }

  return path.split('/').filter(segment => segment !== '.' && segment !== '');
}

function rejectUnsafeSegments(kind: string, originalPath: string, segments: readonly string[]): void {
  if (originalPath.includes('\0')) {
    throw new Error(`${kind} path cannot contain null bytes: ${originalPath}`);
  }

  if (segments.some(segment => segment === '..')) {
    throw new Error(`${kind} path cannot escape outDir: ${originalPath}`);
  }
}

export function cleanOutDir(outDir: string): void {
  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true });
  }

  mkdirSync(outDir, { recursive: true });
}

export function copyPublicAssets({ publicDir, outDir }: CopyPublicAssetsOptions): boolean {
  mkdirSync(outDir, { recursive: true });

  if (!existsSync(publicDir)) {
    return false;
  }

  cpSync(publicDir, outDir, { recursive: true });
  return true;
}

export function routeToFilePath(outDir: string, routePath: string): string {
  if (routePath.includes(':')) {
    throw new Error(`Dynamic route path must be expanded before build: ${routePath}`);
  }

  const segments = routeSegments(routePath);
  rejectUnsafeSegments('Static route', routePath, segments);

  if (segments.length === 0) {
    return join(outDir, 'index.html');
  }

  const relativePath = join(...segments);
  if (relativePath.endsWith('.html')) {
    return join(outDir, relativePath);
  }

  return join(outDir, relativePath, 'index.html');
}

export function writeRoute(outDir: string, routePath: string, html: string): WrittenRouteResult {
  const filePath = routeToFilePath(outDir, routePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, html, 'utf-8');

  return { path: routePath, filePath, html };
}

function rootFilePath(outDir: string, filename: string): string {
  const path = filename.replaceAll('\\', '/').replace(/^\/+/, '');
  const segments = path.split('/').filter(segment => segment !== '.' && segment !== '');
  rejectUnsafeSegments('Root file', filename, segments);

  if (segments.length === 0) {
    throw new Error('Root file path cannot be empty');
  }

  return join(outDir, ...segments);
}

export function writeRoot(outDir: string, filename: string, content: string): string {
  const filePath = rootFilePath(outDir, filename);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
  return filePath;
}
