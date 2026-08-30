#!/usr/bin/env node
/** Run the API and Vite as one process group so neither is orphaned. */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const children = [
  spawn(process.execPath, ['--env-file-if-exists=.env', 'server/index.mjs'], { cwd: root, stdio: 'inherit' }),
  spawn('pnpm', ['exec', 'vite', '--configLoader', 'runner'], { cwd: root, stdio: 'inherit' }),
];
let stopping = false;
let exitCode = 0;

const stop = (signal = 'SIGTERM') => {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill(signal);
};

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    exitCode = signal === 'SIGINT' ? 130 : 143;
    stop(signal);
  });
}

const exits = children.map((child) => new Promise((resolve) => {
  child.once('error', (error) => {
    console.error(error.message);
    exitCode = 1;
    stop();
    resolve();
  });
  child.once('exit', (code, signal) => {
    if (!stopping) {
      exitCode = code ?? (signal ? 1 : 0);
      stop();
    }
    resolve();
  });
}));

await Promise.all(exits);
process.exitCode = exitCode;
