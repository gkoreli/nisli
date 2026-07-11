#!/usr/bin/env node
/**
 * cli.ts — the `nisli-ui` command.
 *
 *   nisli-ui init [--dir <path>]        set up nisli-ui.json + base files
 *   nisli-ui add <name...> [--overwrite] copy component source into the project
 *   nisli-ui list                        show available registry items
 */

import { CONFIG_FILE } from './config.js';
import { addItems, type AddResult } from './add.js';
import { init } from './init.js';
import { loadRegistry } from './registry.js';

const HELP = `nisli-ui — copy @nisli/ui components into your project as source you own

Usage:
  nisli-ui init [--dir <path>]         Write ${CONFIG_FILE} and copy base files
                                       (default dir: src/nisli-ui)
  nisli-ui add <name...> [--overwrite] Copy components + their registry deps
  nisli-ui list                        List available registry items

Components import @nisli/core — make sure it is installed.`;

function report(result: AddResult): void {
  for (const file of result.copied) console.log(`  + ${file}`);
  for (const file of result.skipped) {
    console.log(`  = ${file} (exists, skipped — use --overwrite to replace)`);
  }
  if (result.dependencies.length > 0) {
    console.log(`\nInstall npm dependencies: npm install ${result.dependencies.join(' ')}`);
  }
}

export function run(argv: string[], cwd: string = process.cwd()): number {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case 'init': {
        const dirIdx = rest.indexOf('--dir');
        const dir = dirIdx === -1 ? undefined : rest[dirIdx + 1];
        if (dirIdx !== -1 && !dir) {
          console.error('--dir requires a value.');
          return 1;
        }
        const result = init(cwd, { dir });
        console.log(
          result.created
            ? `Created ${CONFIG_FILE} (dir: ${result.config.dir})`
            : `Using existing ${CONFIG_FILE} (dir: ${result.config.dir})`,
        );
        report(result.add);
        console.log('\nNext: import styles/theme.css after `@import "tailwindcss";` in your CSS.');
        return 0;
      }
      case 'add': {
        const names = rest.filter((arg) => !arg.startsWith('--'));
        const result = addItems(cwd, names, { overwrite: rest.includes('--overwrite') });
        report(result);
        return 0;
      }
      case 'list': {
        const registry = loadRegistry();
        for (const item of registry.items) {
          console.log(`${item.name.padEnd(16)} ${item.type.padEnd(6)} ${item.description ?? ''}`.trimEnd());
        }
        return 0;
      }
      case undefined:
      case 'help':
      case '--help':
      case '-h':
        console.log(HELP);
        return 0;
      default:
        console.error(`Unknown command "${command}".\n\n${HELP}`);
        return 1;
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

process.exitCode = run(process.argv.slice(2));
