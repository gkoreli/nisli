/**
 * acp-tool-call.test.ts — tool-call card rendering.
 *
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { html, type TemplateResult } from '@nisli/core';
import { AcpToolCall } from './acp-tool-call.js';
import type { ToolCall } from '../../lib/acp-protocol.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

const root = (container: HTMLElement) =>
  container.querySelector('[data-slot="acp-tool-call"]') as HTMLDetailsElement;

describe('summary', () => {
  it('exposes kind and status as data attributes for styling and testing', () => {
    const container = mount(
      html`${AcpToolCall({
        call: { toolCallId: 'c1', title: 'Read config', kind: 'read', status: 'in_progress' },
      })}`,
    );
    expect(root(container).dataset['kind']).toBe('read');
    expect(root(container).dataset['status']).toBe('in_progress');
    expect(container.textContent).toContain('Read config');
    expect(container.textContent).toContain('Running');
  });

  it('defaults an absent kind to other and an absent status to pending', () => {
    const container = mount(html`${AcpToolCall({ call: { toolCallId: 'c1', title: 'Mystery' } })}`);
    expect(root(container).dataset['kind']).toBe('other');
    expect(root(container).dataset['status']).toBe('pending');
  });

  it('shows a spinner only while the call is unsettled', () => {
    const running = mount(
      html`${AcpToolCall({ call: { toolCallId: 'c', title: 'x', status: 'in_progress' } })}`,
    );
    expect(running.querySelector('.animate-spin')).not.toBeNull();

    document.body.innerHTML = '';
    const done = mount(
      html`${AcpToolCall({ call: { toolCallId: 'c', title: 'x', status: 'completed' } })}`,
    );
    expect(done.querySelector('.animate-spin')).toBeNull();
  });
});

describe('disclosure', () => {
  it('stays collapsed by default so the conversation is not buried', () => {
    const container = mount(
      html`${AcpToolCall({
        call: { toolCallId: 'c', title: 'x', status: 'completed', rawInput: { a: 1 } },
      })}`,
    );
    expect(root(container).hasAttribute('open')).toBe(false);
  });

  it('opens itself on failure — the one case the user must read', () => {
    const container = mount(
      html`${AcpToolCall({
        call: { toolCallId: 'c', title: 'x', status: 'failed', rawInput: { a: 1 } },
      })}`,
    );
    expect(root(container).hasAttribute('open')).toBe(true);
  });

  it('honours an explicit open prop over the failure default', () => {
    const container = mount(
      html`${AcpToolCall({
        call: { toolCallId: 'c', title: 'x', status: 'failed' },
        open: false,
      })}`,
    );
    expect(root(container).hasAttribute('open')).toBe(false);
  });

  it('renders no body when there is nothing to disclose', () => {
    const container = mount(html`${AcpToolCall({ call: { toolCallId: 'c', title: 'bare' } })}`);
    expect(container.querySelector('[data-slot="acp-tool-call-body"]')).toBeNull();
  });
});

describe('body', () => {
  const rich: ToolCall = {
    toolCallId: 'c1',
    title: 'Edit files',
    kind: 'edit',
    status: 'completed',
    locations: [{ path: 'src/a.ts', line: 12 }, { path: 'src/b.ts' }],
    rawInput: { path: 'src/a.ts' },
    content: [
      { type: 'content', content: { type: 'text', text: 'wrote 2 files' } },
      { type: 'diff', path: 'src/a.ts', oldText: 'one', newText: 'two' },
      { type: 'terminal', terminalId: 't1' },
    ],
  };

  it('renders locations with and without a line number', () => {
    const container = mount(html`${AcpToolCall({ call: rich, open: true })}`);
    const text = container.querySelector('[data-slot="acp-tool-call-locations"]')?.textContent ?? '';
    expect(text).toContain('src/a.ts:12');
    expect(text).toContain('src/b.ts');
  });

  it('renders arguments as formatted JSON', () => {
    const container = mount(html`${AcpToolCall({ call: rich, open: true })}`);
    expect(container.querySelector('[data-slot="acp-tool-call-input"]')?.textContent).toContain(
      '"path": "src/a.ts"',
    );
  });

  it('delegates diffs, text output, and terminals to their own slots', () => {
    const container = mount(html`${AcpToolCall({ call: rich, open: true })}`);
    expect(container.querySelector('[data-slot="acp-diff"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="acp-content"]')?.textContent).toContain(
      'wrote 2 files',
    );
    expect(container.querySelector('[data-slot="acp-tool-call-terminal"]')?.textContent).toContain(
      't1',
    );
  });

  it('survives raw input that cannot be serialised', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    const container = mount(
      html`${AcpToolCall({ call: { toolCallId: 'c', title: 'x', rawInput: circular }, open: true })}`,
    );
    expect(container.querySelector('[data-slot="acp-tool-call-input"]')).not.toBeNull();
  });
});
