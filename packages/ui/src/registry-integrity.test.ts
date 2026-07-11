/**
 * registry-integrity.test.ts — the registry manifest must match what the
 * source files actually import.
 *
 * Guards the failure mode where a registry entry's registryDependencies get
 * dropped (e.g. in a merge-conflict resolution): `nisli-ui add <item>` would
 * then copy source whose relative imports point at files that were never
 * installed. For every item, the transitive dependency closure must cover
 * every `../lib/*.js` / sibling import in every file it ships.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRegistry, registryDir, resolveItems } from './registry.js';

describe('registry integrity', () => {
  const registry = loadRegistry();
  const sourceRoot = join(registryDir(), registry.style);

  it.each(registry.items.map((item) => [item.name] as const))(
    '%s: transitive closure covers all relative imports',
    (name) => {
      const closure = resolveItems(registry, [name]);
      const closureFiles = new Set(closure.flatMap((i) => i.files));

      for (const item of closure) {
        for (const file of item.files) {
          if (!file.endsWith('.ts')) continue;
          const source = readFileSync(join(sourceRoot, file), 'utf8');
          const dir = file.split('/').slice(0, -1).join('/');
          for (const match of source.matchAll(/from '(\.[^']+)\.js'/g)) {
            const relative = match[1];
            if (!relative) continue;
            // Resolve ./x and ../lib/x against the file's registry path.
            const parts = [...dir.split('/'), ...relative.split('/')];
            const resolved: string[] = [];
            for (const part of parts) {
              if (part === '.' || part === '') continue;
              else if (part === '..') resolved.pop();
              else resolved.push(part);
            }
            const target = `${resolved.join('/')}.ts`;
            expect(
              closureFiles.has(target),
              `${file} imports ${target}, but "${name}"'s registryDependencies closure does not install it`,
            ).toBe(true);
          }
        }
      }
    },
  );
});
