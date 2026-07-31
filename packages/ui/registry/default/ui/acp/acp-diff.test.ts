/**
 * acp-diff.test.ts — line diffing and diff rendering.
 *
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { html, type TemplateResult } from '@nisli/core';
import { AcpDiff, collapseContext, diffLines, type DiffRow } from './acp-diff.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

const shape = (rows: DiffRow[]) => rows.map((row) => `${row.kind}:${row.text}`);

describe('diffLines', () => {
  it('marks unchanged lines as context', () => {
    expect(shape(diffLines('a\nb', 'a\nb'))).toEqual(['context:a', 'context:b']);
  });

  it('finds a single-line replacement without rewriting the whole file', () => {
    expect(shape(diffLines('a\nb\nc', 'a\nB\nc'))).toEqual([
      'context:a',
      'remove:b',
      'add:B',
      'context:c',
    ]);
  });

  it('treats a null oldText as file creation — everything is an addition', () => {
    const rows = diffLines(null, 'one\ntwo');
    expect(shape(rows)).toEqual(['add:one', 'add:two']);
    expect(rows.every((row) => row.oldLine === null)).toBe(true);
  });

  it('numbers old and new lines independently', () => {
    const rows = diffLines('a\nb\nc', 'a\nc');
    const removed = rows.find((row) => row.kind === 'remove');
    expect(removed).toMatchObject({ text: 'b', oldLine: 2, newLine: null });
    const lastContext = rows.filter((row) => row.kind === 'context').at(-1);
    expect(lastContext).toMatchObject({ text: 'c', oldLine: 3, newLine: 2 });
  });

  it('handles pure insertion at the end', () => {
    expect(shape(diffLines('a', 'a\nb'))).toEqual(['context:a', 'add:b']);
  });

  it('handles deletion down to empty', () => {
    expect(shape(diffLines('a\nb', ''))).toEqual(['remove:a', 'remove:b', 'add:']);
  });
});

describe('collapseContext', () => {
  it('replaces long unchanged runs with a gap that counts the skipped lines', () => {
    const before = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n');
    const after = before.replace('line 10', 'CHANGED');
    const collapsed = collapseContext(diffLines(before, after), 2);

    const gaps = collapsed.filter((row) => row.kind === 'gap') as { kind: 'gap'; count: number }[];
    expect(gaps.length).toBeGreaterThan(0);
    // Every line is accounted for: kept rows + skipped counts = total rows.
    const kept = collapsed.length - gaps.length;
    const skipped = gaps.reduce((sum, gap) => sum + gap.count, 0);
    expect(kept + skipped).toBe(diffLines(before, after).length);
  });

  it('keeps every row when the file is small enough to have no gap', () => {
    const rows = diffLines('a\nb', 'a\nB');
    expect(collapseContext(rows, 3)).toHaveLength(rows.length);
  });
});

describe('AcpDiff rendering', () => {
  it('renders the path, an add/remove tally, and one row per line', () => {
    const container = mount(
      html`${AcpDiff({ path: 'src/main.ts', oldText: 'a\nb\nc', newText: 'a\nB\nc', full: true })}`,
    );

    expect(container.querySelector('[data-slot="acp-diff-header"]')?.textContent).toContain(
      'src/main.ts',
    );
    expect(container.textContent).toContain('+1');
    expect(container.textContent).toContain('-1');

    const rows = container.querySelectorAll('[data-slot="acp-diff-row"]');
    expect(rows).toHaveLength(4);
    expect(rows[1]?.getAttribute('data-kind')).toBe('remove');
    expect(rows[2]?.getAttribute('data-kind')).toBe('add');
  });

  it('flags a created file', () => {
    const container = mount(html`${AcpDiff({ path: 'new.ts', oldText: null, newText: 'x' })}`);
    expect(container.querySelector('[data-slot="acp-diff-header"]')?.textContent).toContain('new');
  });

  it('renders content as text, not as HTML', () => {
    const container = mount(
      html`${AcpDiff({ path: 'x.ts', oldText: '', newText: '<img src=x onerror=alert(1)>' })}`,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('is layout-transparent at the host', () => {
    const container = mount(html`${AcpDiff({ path: 'a', oldText: 'a', newText: 'b' })}`);
    const host = container.querySelector('ui-acp-diff') as HTMLElement;
    expect(host.style.display).toBe('contents');
  });
});
