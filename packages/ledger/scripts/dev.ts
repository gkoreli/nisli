#!/usr/bin/env bun
/** Run the API and Vite as one process group so neither is orphaned. */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLedgerBunRuntime } from '../runtime.ts';

assertLedgerBunRuntime();

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bun = process.execPath;
const children = [
  Bun.spawn([bun, '--no-env-file', '--env-file=.env', 'server/index.ts'], {
    cwd: root,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  }),
  Bun.spawn([bun, '--no-env-file', 'x', '--bun', '--no-install', 'vite', '--configLoader', 'runner'], {
    cwd: root,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  }),
];

let stopping = false;
let exitCode = 0;

const stop = (signal: NodeJS.Signals = 'SIGTERM'): void => {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill(signal);
  }
};

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    exitCode = signal === 'SIGINT' ? 130 : 143;
    stop(signal);
  });
}

await Promise.all(children.map(async (child) => {
  const code = await child.exited;
  if (!stopping) {
    exitCode = code;
    stop();
  }
}));

process.exitCode = exitCode;
