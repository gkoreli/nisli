/**
 * hydrate-examples/acp-chat.ts — the composed chat, live (WWW-14/15).
 *
 * A working chat loop with a canned agent: send a prompt and the demo streams
 * a turn — thought, tool call, then a word-by-word answer — through the real
 * reducer, with the composer's busy state and Cancel wired the whole way.
 *
 * SSG-safe: the initial transcript is pre-folded (pure reduce, no timers at
 * render); timers are only scheduled from the onPrompt callback, which needs
 * hydration anyway.
 */
import { html, signal, type TemplateResult } from '@nisli/core';
import { AcpChat } from '../nisli-ui/ui/acp/acp-chat.js';
import { createTranscript } from '../nisli-ui/lib/acp-session.js';
import type { SessionUpdate } from '../nisli-ui/lib/acp-protocol.js';

const text = (t: string) => ({ type: 'text' as const, text: t });

/** The canned turn the demo agent plays for any prompt. */
function turnFor(prompt: string): SessionUpdate[] {
  return [
    { sessionUpdate: 'agent_thought_chunk', content: text('Looking at the codebase for that.') },
    {
      sessionUpdate: 'tool_call',
      toolCallId: `demo-${prompt.length}-${prompt.charCodeAt(0) || 0}`,
      title: 'Search the project',
      kind: 'search',
      status: 'in_progress',
    },
    {
      sessionUpdate: 'tool_call_update',
      toolCallId: `demo-${prompt.length}-${prompt.charCodeAt(0) || 0}`,
      status: 'completed',
    },
    ...`You asked: “${prompt}” — in a real app this turn comes from your ACP agent over session/update; this demo replays a canned one through the same reducer.`
      .split(/(?<= )/)
      .map((word): SessionUpdate => ({ sessionUpdate: 'agent_message_chunk', content: text(word) })),
  ];
}

export default function acpChatExample(): TemplateResult {
  const transcript = createTranscript();
  transcript.apply({ sessionUpdate: 'user_message_chunk', content: text('What can you do here?') });
  transcript.apply({
    sessionUpdate: 'agent_message_chunk',
    content: text('Send a prompt below — I stream a canned turn through the real ACP reducer.'),
  });
  transcript.endTurn();

  const busy = signal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function onPrompt(prompt: string): void {
    // A steered prompt arrives mid-turn: abandon the in-flight canned turn
    // (a real connection would keep streaming into the same turn instead).
    clearTimeout(timer);
    transcript.endTurn();
    transcript.apply({ sessionUpdate: 'user_message_chunk', content: text(prompt) });
    transcript.endTurn();
    busy.value = true;
    const turn = turnFor(prompt);
    let index = 0;
    const step = (): void => {
      const update = turn[index++];
      if (!update) {
        transcript.endTurn();
        busy.value = false;
        return;
      }
      transcript.apply(update);
      timer = setTimeout(step, update.sessionUpdate === 'agent_message_chunk' ? 40 : 500);
    };
    step();
  }

  function onCancel(): void {
    clearTimeout(timer);
    transcript.endTurn();
    busy.value = false;
  }

  return html`<div class="flex h-96 w-full max-w-xl flex-col">
    ${AcpChat({ entries: transcript.entries, onPrompt, onCancel, busy, steerable: true })}
  </div>`;
}
