import { describe, expect, it } from 'vitest';
import {
  applyUpdate,
  createTranscript,
  emptyTranscript,
  partitionToolContent,
  type MessageEntry,
  type ThoughtEntry,
  type ToolCallEntry,
  type TranscriptState,
  type UnknownEntry,
} from './acp-session.js';
import type { SessionUpdate } from './acp-protocol.js';

const text = (t: string) => ({ type: 'text' as const, text: t });

function fold(...updates: SessionUpdate[]): TranscriptState {
  return updates.reduce(applyUpdate, emptyTranscript());
}

describe('chunk coalescing', () => {
  it('merges a run of agent text into one entry with one block', () => {
    const state = fold(
      { sessionUpdate: 'agent_message_chunk', content: text('Hel') },
      { sessionUpdate: 'agent_message_chunk', content: text('lo ') },
      { sessionUpdate: 'agent_message_chunk', content: text('world') },
    );

    expect(state.entries).toHaveLength(1);
    const entry = state.entries[0] as MessageEntry;
    expect(entry.content).toEqual([text('Hello world')]);
    expect(entry.streaming).toBe(true);
  });

  it('keeps the entry id stable across chunks so keyed lists do not tear', () => {
    let state = fold({ sessionUpdate: 'agent_message_chunk', content: text('a') });
    const first = state.entries[0]!.id;
    state = applyUpdate(state, { sessionUpdate: 'agent_message_chunk', content: text('b') });
    expect(state.entries[0]!.id).toBe(first);
  });

  it('does not merge across roles', () => {
    const state = fold(
      { sessionUpdate: 'user_message_chunk', content: text('hi') },
      { sessionUpdate: 'agent_message_chunk', content: text('hello') },
    );
    expect(state.entries).toHaveLength(2);
    expect((state.entries[0] as MessageEntry).role).toBe('user');
    expect((state.entries[1] as MessageEntry).role).toBe('agent');
  });

  it('does not merge thoughts into messages', () => {
    const state = fold(
      { sessionUpdate: 'agent_thought_chunk', content: text('thinking') },
      { sessionUpdate: 'agent_message_chunk', content: text('answer') },
    );
    expect(state.entries.map((e) => e.kind)).toEqual(['thought', 'message']);
  });

  it('keeps non-text blocks as separate blocks', () => {
    const state = fold(
      { sessionUpdate: 'agent_message_chunk', content: text('see: ') },
      {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'image', data: 'AAAA', mimeType: 'image/png' },
      },
      { sessionUpdate: 'agent_message_chunk', content: text(' done') },
    );
    const entry = state.entries[0] as MessageEntry;
    expect(entry.content.map((b) => b.type)).toEqual(['text', 'image', 'text']);
  });

  it('starts a new message run after a tool call interrupts', () => {
    const state = fold(
      { sessionUpdate: 'agent_message_chunk', content: text('before') },
      { sessionUpdate: 'tool_call', toolCallId: 'c1', title: 'Read file' },
      { sessionUpdate: 'agent_message_chunk', content: text('after') },
    );
    expect(state.entries.map((e) => e.kind)).toEqual(['message', 'tool-call', 'message']);
    expect((state.entries[0] as MessageEntry).streaming).toBe(false);
  });
});

describe('tool calls', () => {
  it('merges an update into the announced call without clobbering fields', () => {
    const state = fold(
      {
        sessionUpdate: 'tool_call',
        toolCallId: 'c1',
        title: 'Edit main.ts',
        kind: 'edit',
        status: 'pending',
      },
      { sessionUpdate: 'tool_call_update', toolCallId: 'c1', status: 'completed' },
    );

    expect(state.entries).toHaveLength(1);
    const { call } = state.entries[0] as ToolCallEntry;
    expect(call.status).toBe('completed');
    expect(call.title).toBe('Edit main.ts');
    expect(call.kind).toBe('edit');
  });

  it('creates the entry when an update arrives for a call never announced', () => {
    const state = fold({
      sessionUpdate: 'tool_call_update',
      toolCallId: 'ghost',
      status: 'failed',
    });

    expect(state.entries).toHaveLength(1);
    const { call } = state.entries[0] as ToolCallEntry;
    expect(call.toolCallId).toBe('ghost');
    expect(call.status).toBe('failed');
    // No title was ever sent; fall back to the id rather than render blank.
    expect(call.title).toBe('ghost');
  });

  it('replaces content rather than appending, so partial output does not duplicate', () => {
    const state = fold(
      { sessionUpdate: 'tool_call', toolCallId: 'c1', title: 'Run tests' },
      {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'c1',
        content: [{ type: 'content', content: text('1 passing') }],
      },
      {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'c1',
        content: [{ type: 'content', content: text('1 passing\n2 passing') }],
      },
    );

    const { call } = state.entries[0] as ToolCallEntry;
    expect(call.content).toHaveLength(1);
    expect(partitionToolContent(call.content).blocks).toEqual([text('1 passing\n2 passing')]);
  });

  it('does not reorder a call that updates after later entries exist', () => {
    const state = fold(
      { sessionUpdate: 'tool_call', toolCallId: 'c1', title: 'First' },
      { sessionUpdate: 'tool_call', toolCallId: 'c2', title: 'Second' },
      { sessionUpdate: 'tool_call_update', toolCallId: 'c1', status: 'completed' },
    );
    expect(state.entries.map((e) => (e as ToolCallEntry).call.toolCallId)).toEqual(['c1', 'c2']);
  });

  it('partitions content into blocks, diffs, and terminals', () => {
    const parts = partitionToolContent([
      { type: 'content', content: text('out') },
      { type: 'diff', path: '/a.ts', oldText: 'a', newText: 'b' },
      { type: 'terminal', terminalId: 't1' },
    ]);
    expect(parts.blocks).toHaveLength(1);
    expect(parts.diffs[0]?.path).toBe('/a.ts');
    expect(parts.terminals[0]?.terminalId).toBe('t1');
  });
});

describe('plan', () => {
  it('replaces in place instead of accumulating stale copies', () => {
    const state = fold(
      { sessionUpdate: 'plan', entries: [{ content: 'step one', status: 'pending' }] },
      {
        sessionUpdate: 'plan',
        entries: [
          { content: 'step one', status: 'completed' },
          { content: 'step two', status: 'in_progress' },
        ],
      },
    );

    expect(state.entries.filter((e) => e.kind === 'plan')).toHaveLength(1);
    expect(state.plan).toHaveLength(2);
    expect(state.plan?.[0]?.status).toBe('completed');
  });
});

describe('forward compatibility', () => {
  it('preserves an update variant this build does not model', () => {
    // Exactly what a newer agent sends after the copied file was frozen.
    const future = { sessionUpdate: 'quantum_update', payload: 42 } as unknown as SessionUpdate;
    const state = fold(future);

    expect(state.entries).toHaveLength(1);
    const entry = state.entries[0] as UnknownEntry;
    expect(entry.kind).toBe('unknown');
    expect(entry.sessionUpdate).toBe('quantum_update');
    expect(entry.raw).toBe(future);
  });

  it('does not drop the surrounding conversation when an unknown arrives', () => {
    const state = fold(
      { sessionUpdate: 'agent_message_chunk', content: text('before') },
      { sessionUpdate: 'nope' } as unknown as SessionUpdate,
      { sessionUpdate: 'agent_message_chunk', content: text('after') },
    );
    expect(state.entries.map((e) => e.kind)).toEqual(['message', 'unknown', 'message']);
  });
});

describe('session-level state', () => {
  it('tracks available commands and current mode without adding entries', () => {
    const state = fold(
      { sessionUpdate: 'available_commands_update', availableCommands: [{ name: 'compact' }] },
      { sessionUpdate: 'current_mode_update', currentModeId: 'plan' },
    );

    expect(state.entries).toHaveLength(0);
    expect(state.availableCommands.map((c) => c.name)).toEqual(['compact']);
    expect(state.currentModeId).toBe('plan');
  });
});

describe('reactive store', () => {
  it('exposes entries, streaming, and pending tool calls as signals', () => {
    const transcript = createTranscript();

    transcript.apply({ sessionUpdate: 'agent_message_chunk', content: text('hi') });
    expect(transcript.entries.value).toHaveLength(1);
    expect(transcript.streaming.value).toBe(true);

    transcript.apply({ sessionUpdate: 'tool_call', toolCallId: 'c1', title: 'Read', status: 'in_progress' });
    expect(transcript.pendingToolCalls.value).toHaveLength(1);

    transcript.apply({ sessionUpdate: 'tool_call_update', toolCallId: 'c1', status: 'completed' });
    expect(transcript.pendingToolCalls.value).toHaveLength(0);
  });

  it('accepts a full session/update notification envelope', () => {
    const transcript = createTranscript();
    transcript.apply({
      sessionId: 's1',
      update: { sessionUpdate: 'agent_message_chunk', content: text('enveloped') },
    });
    expect((transcript.entries.value[0] as MessageEntry).content).toEqual([text('enveloped')]);
  });

  it('endTurn settles streaming entries', () => {
    const transcript = createTranscript();
    transcript.apply({ sessionUpdate: 'agent_thought_chunk', content: text('hmm') });
    expect(transcript.streaming.value).toBe(true);

    transcript.endTurn();
    expect(transcript.streaming.value).toBe(false);
    expect((transcript.entries.value[0] as ThoughtEntry).streaming).toBe(false);
  });

  it('reset clears the transcript', () => {
    const transcript = createTranscript();
    transcript.apply({ sessionUpdate: 'agent_message_chunk', content: text('x') });
    transcript.reset();
    expect(transcript.entries.value).toEqual([]);
    expect(transcript.currentModeId.value).toBeNull();
  });

  it('the fold is pure — applying to a snapshot does not mutate the store', () => {
    const transcript = createTranscript();
    transcript.apply({ sessionUpdate: 'agent_message_chunk', content: text('one') });
    const snapshot = transcript.snapshot();

    applyUpdate(snapshot, { sessionUpdate: 'agent_message_chunk', content: text(' two') });
    expect((transcript.entries.value[0] as MessageEntry).content).toEqual([text('one')]);
  });
});
