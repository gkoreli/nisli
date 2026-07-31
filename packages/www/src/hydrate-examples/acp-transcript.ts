/**
 * hydrate-examples/acp-transcript.ts — the ACP transcript, live (WWW-14/15).
 *
 * The static previews show a settled conversation; the point of the transcript
 * is what happens DURING one. This demo replays a canned ACP session —
 * chunk-by-chunk, through the real `createTranscript()` reducer — so streaming
 * coalescence, the tool-call status flip, and the plan update are all visible
 * as behavior, not claimed in prose.
 *
 * SSG-safe by construction: at render time the transcript starts pre-folded to
 * its final state (a pure reduce, no timers), so the prerendered HTML shows the
 * whole conversation. Timers are only ever scheduled from @click, which needs
 * hydration anyway.
 */
import { html, signal, type TemplateResult } from '@nisli/core';
import { buttonVariants } from '../nisli-ui/ui/button.js';
import { AcpTranscript } from '../nisli-ui/ui/acp/acp-transcript.js';
import { createTranscript } from '../nisli-ui/lib/acp-session.js';
import type { SessionUpdate } from '../nisli-ui/lib/acp-protocol.js';

const text = (t: string) => ({ type: 'text' as const, text: t });

/** The canned session — exactly what an ACP agent puts on the wire. */
const SESSION: SessionUpdate[] = [
  { sessionUpdate: 'user_message_chunk', content: text('Why is resolve() slow?') },
  { sessionUpdate: 'agent_thought_chunk', content: text('Checking whether the ') },
  { sessionUpdate: 'agent_thought_chunk', content: text('cache is read at all.') },
  {
    sessionUpdate: 'tool_call',
    toolCallId: 'demo-read',
    title: 'Read src/resolver.ts',
    kind: 'read',
    status: 'in_progress',
  },
  { sessionUpdate: 'tool_call_update', toolCallId: 'demo-read', status: 'completed' },
  {
    sessionUpdate: 'plan',
    entries: [
      { content: 'Patch the cache read', status: 'in_progress' },
      { content: 'Re-run the suite', status: 'pending' },
    ],
  },
  {
    sessionUpdate: 'tool_call',
    toolCallId: 'demo-edit',
    title: 'Edit src/resolver.ts',
    kind: 'edit',
    status: 'in_progress',
    content: [
      {
        type: 'diff',
        path: 'src/resolver.ts',
        oldText: '  return load(id);',
        newText: '  const hit = cache[id];\n  if (hit) return hit;\n  return load(id);',
      },
    ],
  },
  { sessionUpdate: 'tool_call_update', toolCallId: 'demo-edit', status: 'completed' },
  {
    sessionUpdate: 'plan',
    entries: [
      { content: 'Patch the cache read', status: 'completed' },
      { content: 'Re-run the suite', status: 'in_progress' },
    ],
  },
  // Streamed as word-chunks so the coalescing (one entry, one growing text
  // block) is visible in the replay.
  ...'The cache was written but never read on the hot path — fixed, and the suite is green.'
    .split(/(?<= )/)
    .map((word): SessionUpdate => ({ sessionUpdate: 'agent_message_chunk', content: text(word) })),
];

export default function acpTranscriptExample(): TemplateResult {
  const transcript = createTranscript();
  // Pre-fold so the SSG output (and the pre-click live mount) shows the full
  // settled conversation rather than an empty box.
  for (const update of SESSION) transcript.apply(update);
  transcript.endTurn();

  const replaying = signal(false);

  function replay(): void {
    if (replaying.value) return;
    replaying.value = true;
    transcript.reset();
    let index = 0;
    const step = (): void => {
      const update = SESSION[index++];
      if (!update) {
        transcript.endTurn();
        replaying.value = false;
        return;
      }
      transcript.apply(update);
      // Message chunks stream fast; structural updates pause long enough to read.
      setTimeout(step, update.sessionUpdate === 'agent_message_chunk' ? 45 : 420);
    };
    step();
  }

  return html`<div class="flex w-full max-w-xl flex-col gap-3">
    <div class="flex items-center gap-2">
      <button
        class="${buttonVariants({ variant: 'outline', size: 'sm' })}"
        disabled="${replaying}"
        @click=${replay}
      >
        Replay session
      </button>
      <span class="text-xs text-muted-foreground"
        >streams the same updates through the reducer</span
      >
    </div>
    ${AcpTranscript({ entries: transcript.entries })}
  </div>`;
}
