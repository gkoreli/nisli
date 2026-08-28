#!/usr/bin/env node
/**
 * no-values-guard — the exclusivity invariant, mechanically.
 *
 * Every file under src/ must contain no length, no colour, no media query, no
 * class attribute and no inline style, and must write no data-* attribute the
 * package's vocabulary does not name. The one permitted style write is
 * `host.style.display = 'contents'`, the transparent-host idiom, and it is
 * matched exactly rather than allow-listed by file.
 *
 * Exit 1 with every offending line on failure; prints the scanned file count
 * on success so an empty scan cannot read as a pass.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

/**
 * The vocabulary's attribute names, read from the contract's SOURCE rather
 * than duplicated here: Node cannot execute the package's TypeScript directly,
 * and a second hand-written list is exactly the drift this guard exists to
 * catch. Fails loudly if the table cannot be found.
 */
async function contractedAttributes() {
  const contracts = await readFile(path.join(ROOT, '..', 'intent', 'src', 'contracts.ts'), 'utf8');
  const table = contracts.match(/export const AXIS_ATTRS = \{([\s\S]*?)\}/);
  if (!table) throw new Error('no-values-guard: AXIS_ATTRS not found in @nisli/intent contracts.ts');
  const names = [...table[1].matchAll(/'(data-[a-z-]+)'/g)].map((m) => m[1]);
  if (names.length === 0) throw new Error('no-values-guard: AXIS_ATTRS parsed to nothing');
  return names;
}

/** Attributes the theme answers to that the vocabulary contract does not (yet) name. See GAPS.md G2. */
const UNCONTRACTED_BUT_THEMED = ['data-priority', 'data-grow', 'data-flush', 'data-table', 'data-component', 'data-fit', 'data-overflow', 'data-overflow-anchor', 'data-overflow-menu'];
const ALLOWED_DATA = new Set([...(await contractedAttributes()), ...UNCONTRACTED_BUT_THEMED]);

const RULES = [
  { name: 'length', pattern: /(?<![\w.$-])\d*\.?\d+(?:px|rem|em|vw|vh|vmin|vmax|ch|ex|pt|pc|cm|mm|in)\b/g },
  { name: 'colour', pattern: /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl|oklch|oklab)a?\(/g },
  { name: 'media query', pattern: /@media\b|@container\b/g },
  { name: 'class attribute', pattern: /\bclass(?:Name)?=|classList\b/g },
  { name: 'inline style', pattern: /\bstyle=|\.style\.(?!display = 'contents')/g },
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|css|html)$/.test(entry.name)) yield full;
  }
}

const failures = [];
let scanned = 0;
for await (const file of walk(SRC)) {
  scanned += 1;
  const text = await readFile(file, 'utf8');
  const rel = path.relative(ROOT, file);
  text.split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(code)) failures.push(`${rel}:${i + 1}: ${rule.name}: ${line.trim()}`);
    }
    for (const match of code.matchAll(/\bdata-[a-z-]+(?==)/g)) {
      if (!ALLOWED_DATA.has(match[0])) failures.push(`${rel}:${i + 1}: unlisted attribute ${match[0]}: ${line.trim()}`);
    }
  });
}

if (scanned === 0) {
  console.error('no-values-guard: scanned nothing — refusing to pass an empty scan');
  process.exit(1);
}
if (failures.length) {
  console.error(`no-values-guard: ${failures.length} violation(s) in ${scanned} files`);
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log(`no-values-guard: clean — ${scanned} files, ${ALLOWED_DATA.size} permitted data-* attributes`);
