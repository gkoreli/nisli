/**
 * cli.test.ts — init/add round-trip against the real registry, into a temp dir.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from './init.js';
import { addItems } from './add.js';
import { loadRegistry, registryDir, resolveItems } from './registry.js';

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'nisli-ui-test-'));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe('init()', () => {
  it('writes nisli-ui.json and copies base files', () => {
    const result = init(cwd);

    expect(result.created).toBe(true);
    expect(result.config.dir).toBe('src/nisli-ui');
    expect(existsSync(join(cwd, 'nisli-ui.json'))).toBe(true);
    expect(existsSync(join(cwd, 'src/nisli-ui/lib/utils.ts'))).toBe(true);
    expect(existsSync(join(cwd, 'src/nisli-ui/styles/theme.css'))).toBe(true);
  });

  it('respects a custom dir', () => {
    const result = init(cwd, { dir: 'app/ui' });

    expect(result.config.dir).toBe('app/ui');
    expect(existsSync(join(cwd, 'app/ui/lib/utils.ts'))).toBe(true);
  });

  it('reuses an existing config on re-run', () => {
    init(cwd, { dir: 'app/ui' });
    const second = init(cwd, { dir: 'ignored' });

    expect(second.created).toBe(false);
    expect(second.config.dir).toBe('app/ui');
    expect(second.add.copied).toHaveLength(0);
    expect(second.add.skipped.length).toBeGreaterThan(0);
  });
});

describe('addItems()', () => {
  it('throws without a config', () => {
    expect(() => addItems(cwd, ['button'])).toThrow(/nisli-ui init/);
  });

  it('copies a component and its registry dependencies verbatim', () => {
    init(cwd);
    const result = addItems(cwd, ['button']);

    const target = join(cwd, 'src/nisli-ui/ui/button.ts');
    expect(result.copied).toContain(join('src/nisli-ui', 'ui/button.ts'));
    expect(existsSync(target)).toBe(true);

    // utils was already copied by init — skipped, not overwritten.
    expect(result.skipped).toContain(join('src/nisli-ui', 'lib/utils.ts'));

    // Verbatim copy: byte-identical to the registry source.
    const source = readFileSync(join(registryDir(), 'default/ui/button.ts'), 'utf8');
    expect(readFileSync(target, 'utf8')).toBe(source);

    // Fixed layout keeps the relative import valid.
    expect(source).toContain("from '../lib/utils.js'");
    expect(existsSync(join(cwd, 'src/nisli-ui/lib/utils.ts'))).toBe(true);
  });

  it('skips existing files unless overwrite is set', () => {
    init(cwd);
    addItems(cwd, ['button']);

    const again = addItems(cwd, ['button']);
    expect(again.copied).toHaveLength(0);

    const forced = addItems(cwd, ['button'], { overwrite: true });
    expect(forced.copied.length).toBeGreaterThan(0);
  });

  it('rejects unknown items with the available list', () => {
    init(cwd);
    expect(() => addItems(cwd, ['carousel'])).toThrow(/Unknown registry item "carousel"/);
  });

  it('pulls a component dependency transitively (add pagination → button)', () => {
    init(cwd);
    const result = addItems(cwd, ['pagination']);

    // pagination depends on the button component (for buttonVariants).
    expect(existsSync(join(cwd, 'src/nisli-ui/ui/pagination.ts'))).toBe(true);
    expect(existsSync(join(cwd, 'src/nisli-ui/ui/button.ts'))).toBe(true);
    expect(result.copied).toContain(join('src/nisli-ui', 'ui/button.ts'));
  });

  it('copies the full lib closure for dropdown-menu (all six behavior libs)', () => {
    init(cwd);
    addItems(cwd, ['dropdown-menu']);

    // dropdown-menu is the first item consuming every behavior primitive.
    for (const lib of [
      'utils',
      'floating',
      'dismissable-layer',
      'focus',
      'roving-focus',
      'typeahead',
    ]) {
      expect(
        existsSync(join(cwd, `src/nisli-ui/lib/${lib}.ts`)),
        `expected lib/${lib}.ts to be installed`,
      ).toBe(true);
    }
    expect(existsSync(join(cwd, 'src/nisli-ui/ui/dropdown-menu.ts'))).toBe(true);
  });
});

describe('resolveItems()', () => {
  it('orders dependencies before dependents and dedupes', () => {
    const registry = loadRegistry();
    const items = resolveItems(registry, ['button', 'utils']);

    expect(items.map((i) => i.name)).toEqual(['utils', 'button']);
  });

  it('resolves a component-to-component dependency, deps first (pagination → button → utils)', () => {
    const registry = loadRegistry();
    const names = resolveItems(registry, ['pagination']).map((i) => i.name);

    expect(names).toContain('button');
    expect(names).toContain('utils');
    expect(names.indexOf('utils')).toBeLessThan(names.indexOf('button'));
    expect(names.indexOf('button')).toBeLessThan(names.indexOf('pagination'));
  });

  it('every registry item resolves and its files exist', () => {
    const registry = loadRegistry();
    for (const item of registry.items) {
      for (const resolved of resolveItems(registry, [item.name])) {
        for (const file of resolved.files) {
          expect(existsSync(join(registryDir(), registry.style, file))).toBe(true);
        }
      }
    }
  });
});
