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
import ts from 'typescript';
import { loadRegistry, registryDir, resolveItems } from './registry.js';

function importSpecifiers(file: string, source: string): string[] {
  if (file.endsWith('.css')) {
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
    return [
      ...withoutComments.matchAll(
        /^\s*@import\s+(?:url\(\s*(?:"([^"]+)"|'([^']+)'|([^'"\s)]+))\s*\)|"([^"]+)"|'([^']+)')/gm,
      ),
    ]
      .map((match) => match.slice(1).find((specifier) => specifier !== undefined))
      .filter((specifier): specifier is string => specifier !== undefined);
  }

  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];

  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      specifiers.push(node.argument.literal.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

describe('registry integrity', () => {
  const registry = loadRegistry();
  const sourceRoot = join(registryDir(), registry.style);

  it('copied files have no runtime npm dependencies', () => {
    const files = new Set(registry.items.flatMap((item) => item.files));

    for (const file of files) {
      const source = readFileSync(join(sourceRoot, file), 'utf8');
      for (const specifier of importSpecifiers(file, source)) {
        expect(
          specifier.startsWith('.') || specifier === '@nisli/core',
          `${file} imports disallowed runtime dependency "${specifier}"; copied registry files may only import relative files or @nisli/core`,
        ).toBe(true);
      }
    }
  });

  // Tailwind drops a utility whose variant was never declared — SILENTLY, with no
  // build error. A `field-invalid:` token in a copied component is therefore only
  // real if `styles/theme.css` (a BASE_ITEMS install, so every consumer has it)
  // declares the matching `@custom-variant`. Checked both ways so the CSS API
  // cannot drift into typos or into declarations nothing uses.
  it('field-* custom variants used by copied sources are declared in the base theme', () => {
    const theme = readFileSync(join(sourceRoot, 'styles/theme.css'), 'utf8');
    const declared = new Set(
      [...theme.matchAll(/^@custom-variant\s+([\w-]+)\s*\(/gm)].map(([, name]) => name as string),
    );
    expect(declared.size, 'styles/theme.css declares no @custom-variant').toBeGreaterThan(0);

    const used = new Map<string, string>();
    for (const file of new Set(registry.items.flatMap((item) => item.files))) {
      if (!file.endsWith('.ts')) continue;
      const source = readFileSync(join(sourceRoot, file), 'utf8');
      // The lookbehind keeps container-query tokens (`@md/field-group:`) and the
      // custom property itself (`[--field-invalid:true]`) out — only a variant at
      // the start of a class token, or after another variant's `:`, counts.
      for (const [, variant] of source.matchAll(/(?<![\w/@-])(field-[a-z-]+):/g)) {
        if (variant && !used.has(variant)) used.set(variant, file);
      }
    }

    for (const [variant, file] of used) {
      expect(
        declared.has(variant),
        `${file} uses the "${variant}:" variant, but styles/theme.css does not @custom-variant it — Tailwind would drop the utility silently`,
      ).toBe(true);
    }
    for (const variant of declared) {
      expect(
        used.has(variant),
        `styles/theme.css declares the "${variant}" variant, but no copied source uses it`,
      ).toBe(true);
    }
  });

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

describe('importSpecifiers', () => {
  it('finds quoted, quoted url(), and unquoted url() CSS imports', () => {
    expect(
      importSpecifiers(
        'styles/example.css',
        '@import "quoted";\n@import url(  "quoted-url"  );\n@import url( unquoted-url );',
      ),
    ).toEqual(['quoted', 'quoted-url', 'unquoted-url']);
  });

  it('ignores CSS imports inside comments', () => {
    expect(
      importSpecifiers(
        'styles/example.css',
        '/* @import "inline-comment";\n@import url(block-comment); */',
      ),
    ).toEqual([]);
  });
});
