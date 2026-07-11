/**
 * page.test.ts — builds the openable kitchen-sink page into demo/dist
 * (gitignored) and asserts the shell. Doubles as the demo:build command,
 * so the viewable page is fresh after every test run.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildDemoPage } from './page.js';

describe('demo page build', () => {
  it('writes a full HTML shell with theme, Tailwind, and the kitchen sink', async () => {
    const outFile = await buildDemoPage();
    const page = readFileSync(outFile, 'utf8');

    expect(page).toContain('<!doctype html>');
    expect(page).toContain('@tailwindcss/browser@4');
    expect(page).toContain('--background: oklch(1 0 0)'); // theme inlined
    expect(page).toContain('theme-toggle');
    expect(page).toContain('<ui-button'); // rendered fragment injected
    expect(page).toContain('@nisli/ui — kitchen sink');
  });
});
