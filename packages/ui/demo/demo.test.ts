/**
 * demo.test.ts — the dogfood milestone, verified in CI:
 * registry → CLI copy (committed fixture) → import copied source →
 * @nisli/ssg static render.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry, registryDir } from '../src/registry.js';
import { buildDemoSite } from './site.js';

const demoDir = dirname(fileURLToPath(import.meta.url));

describe('demo fixture is CLI output', () => {
  it('every registry file is installed and byte-identical to the registry source', () => {
    const registry = loadRegistry();
    const sourceRoot = join(registryDir(), registry.style);

    for (const item of registry.items) {
      for (const file of item.files) {
        const installed = join(demoDir, 'src/nisli-ui', file);
        expect(
          existsSync(installed),
          `${file} missing from demo fixture — run: pnpm --filter @nisli/ui demo:sync`,
        ).toBe(true);
        expect(
          readFileSync(installed, 'utf8'),
          `${file} drifted from the registry — run: pnpm --filter @nisli/ui demo:sync`,
        ).toBe(readFileSync(join(sourceRoot, file), 'utf8'));
      }
    }
  });
});

describe('kitchen sink renders statically via @nisli/ssg', () => {
  let outDir: string;
  let indexHtml: string;

  beforeAll(async () => {
    outDir = mkdtempSync(join(tmpdir(), 'nisli-ui-demo-'));
    const result = await buildDemoSite(outDir);
    expect(result.pages).toHaveLength(1);
    const first = result.pages[0];
    if (!first) throw new Error('no page emitted');
    indexHtml = readFileSync(first.filePath, 'utf8');
  });

  afterAll(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it('emits index.html with the page shell', () => {
    expect(existsSync(join(outDir, 'index.html'))).toBe(true);
    expect(indexHtml).toContain('@nisli/ui — kitchen sink');
  });

  it('renders every component as a themed custom element', () => {
    for (const tag of [
      'ui-button',
      'ui-badge',
      'ui-label',
      'ui-separator',
      'ui-skeleton',
      'ui-alert',
      'ui-card',
      'ui-input',
      'ui-textarea',
      'ui-checkbox',
      'ui-switch',
      'ui-tabs',
      'ui-accordion',
    ]) {
      expect(indexHtml, `missing <${tag}>`).toContain(`<${tag}`);
    }
    // Themed markup, not empty shells: variant classes + slots came through.
    expect(indexHtml).toContain('bg-primary');
    expect(indexHtml).toContain('data-slot="card-title"');
    expect(indexHtml).toContain('data-slot="button"');
  });

  it('renders interactive ARIA state statically', () => {
    // Tabs: default selection is rendered, non-selected panel is hidden.
    expect(indexHtml).toContain('role="tablist"');
    expect(indexHtml).toContain('aria-selected="true"');
    expect(indexHtml).toContain('data-state="active"');
    expect(indexHtml).toContain('hidden');
    // Accordion: closed by default.
    expect(indexHtml).toContain('data-state="closed"');
    expect(indexHtml).toContain('aria-expanded="false"');
  });

  it('renders native form controls with forwarded ids', () => {
    expect(indexHtml).toContain('type="email"');
    expect(indexHtml).toContain('id="demo-email"');
    expect(indexHtml).toContain('name="email"');
    expect(indexHtml).toContain('for="demo-email"');
    expect(indexHtml).toContain('type="checkbox"');
    expect(indexHtml).toContain('role="switch"');
  });
});
