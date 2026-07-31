/**
 * acp-transcript.test.ts — entry dispatch and streaming safety.
 *
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { flush, html, signal, type TemplateResult } from '@nisli/core';
import { AcpTranscript } from './acp-transcript.js';
import { createTranscript, type TranscriptEntry } from '../../lib/acp-session.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

const text = (t: string) => ({ type: 'text' as const, text: t });

describe('dispatch', () => {
  it('routes every entry kind to its own renderer', () => {
    const entries: TranscriptEntry[] = [
      { kind: 'message', id: 'm1', role: 'user', content: [text('hi')], streaming: false },
      { kind: 'message', id: 'm2', role: 'agent', content: [text('hello')], streaming: false },
      { kind: 'thought', id: 't1', content: [text('hmm')], streaming: false },
      { kind: 'tool-call', id: 'c1', call: { toolCallId: 'x', title: 'Read' } },
      { kind: 'plan', id: 'p1', entries: [{ content: 'step', status: 'pending' }] },
      { kind: 'unknown', id: 'u1', sessionUpdate: 'future_thing', raw: { a: 1 } },
    ];

    const container = mount(html`${AcpTranscript({ entries })}`);

    expect(container.querySelectorAll('[data-slot="acp-message"]')).toHaveLength(2);
    expect(container.querySelector('[data-slot="acp-thought"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="acp-tool-call"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="acp-plan"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="acp-unknown"]')).not.toBeNull();
  });

  it('distinguishes user from agent messages by data-role', () => {
    const container = mount(
      html`${AcpTranscript({
        entries: [
          { kind: 'message', id: 'm1', role: 'user', content: [text('q')], streaming: false },
          { kind: 'message', id: 'm2', role: 'agent', content: [text('a')], streaming: false },
        ],
      })}`,
    );
    const roles = Array.from(container.querySelectorAll('[data-slot="acp-message"]')).map((el) =>
      el.getAttribute('data-role'),
    );
    expect(roles).toEqual(['user', 'agent']);
  });

  it('shows an unhandled update instead of a gap in the conversation', () => {
    const container = mount(
      html`${AcpTranscript({
        entries: [
          { kind: 'unknown', id: 'u1', sessionUpdate: 'quantum_update', raw: { payload: 42 } },
        ],
      })}`,
    );
    const unknown = container.querySelector('[data-slot="acp-unknown"]') as HTMLElement;
    expect(unknown.textContent).toContain('quantum_update');
    // The raw frame stays inspectable so the gap is diagnosable, not mysterious.
    expect(unknown.textContent).toContain('"payload": 42');
  });

  it('renders an empty state, and drops it once entries arrive', () => {
    const entries = signal<TranscriptEntry[]>([]);
    const container = mount(html`${AcpTranscript({ entries, empty: 'Ask the agent something.' })}`);
    expect(container.querySelector('[data-slot="acp-transcript-empty"]')?.textContent).toContain(
      'Ask the agent something.',
    );

    entries.value = [
      { kind: 'message', id: 'm1', role: 'user', content: [text('go')], streaming: false },
    ];
    flush();
    expect(container.querySelector('[data-slot="acp-transcript-empty"]')).toBeNull();
  });
});

describe('streaming', () => {
  it('shows a caret only while a message is streaming', () => {
    const streaming = mount(
      html`${AcpTranscript({
        entries: [{ kind: 'message', id: 'm1', role: 'agent', content: [text('par')], streaming: true }],
      })}`,
    );
    expect(streaming.querySelector('[data-slot="acp-message-caret"]')).not.toBeNull();

    document.body.innerHTML = '';
    const settled = mount(
      html`${AcpTranscript({
        entries: [{ kind: 'message', id: 'm1', role: 'agent', content: [text('done')], streaming: false }],
      })}`,
    );
    expect(settled.querySelector('[data-slot="acp-message-caret"]')).toBeNull();
  });

  it('reuses the same DOM node across chunks, so streaming does not tear the list', () => {
    const transcript = createTranscript();
    transcript.apply({ sessionUpdate: 'agent_message_chunk', content: text('Hel') });

    const container = mount(html`${AcpTranscript({ entries: transcript.entries })}`);
    const before = container.querySelector('[data-slot="acp-message"]');

    transcript.apply({ sessionUpdate: 'agent_message_chunk', content: text('lo') });
    flush();

    const after = container.querySelector('[data-slot="acp-message"]');
    expect(after).toBe(before);
    expect(after?.textContent).toContain('Hello');
  });

  it('drives the whole transcript from a live reducer', () => {
    const transcript = createTranscript();
    const container = mount(html`${AcpTranscript({ entries: transcript.entries })}`);

    transcript.apply({ sessionUpdate: 'user_message_chunk', content: text('build it') });
    transcript.apply({ sessionUpdate: 'agent_thought_chunk', content: text('planning') });
    transcript.apply({
      sessionUpdate: 'tool_call',
      toolCallId: 'c1',
      title: 'Write file',
      kind: 'edit',
      status: 'in_progress',
    });
    flush();

    expect(container.querySelector('[data-slot="acp-tool-call"]')?.getAttribute('data-status')).toBe(
      'in_progress',
    );

    transcript.apply({ sessionUpdate: 'tool_call_update', toolCallId: 'c1', status: 'completed' });
    flush();

    expect(container.querySelector('[data-slot="acp-tool-call"]')?.getAttribute('data-status')).toBe(
      'completed',
    );
    expect(container.querySelectorAll('[data-slot="acp-tool-call"]')).toHaveLength(1);
  });
});
