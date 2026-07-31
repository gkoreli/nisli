import { component, html } from '@nisli/core';
import { createTranscript } from '../nisli-ui/lib/acp-session.js';
import { AcpTranscript } from '../nisli-ui/ui/acp/acp-transcript.js';

// However your ACP connection is transported (stdio, WebSocket, a relay),
// it delivers session/update notifications and resolves prompts.
declare const connection: {
  onSessionUpdate(handler: (notification: unknown) => void): void;
  prompt(text: string): Promise<void>;
};

const transcript = createTranscript();

// Every update folds through the reducer: chunks coalesce into stable
// entries, tool_call_update merges by id, unknown variants are kept.
connection.onSessionUpdate((notification) => {
  transcript.apply(notification as Parameters<typeof transcript.apply>[0]);
});

component('agent-panel', () => {
  async function send(text: string): Promise<void> {
    await connection.prompt(text); // resolves when the turn ends
    transcript.endTurn(); // settle streaming entries
  }
  void send;

  return html`${AcpTranscript({ entries: transcript.entries })}`;
});
