/**
 * ui/acp/acp-chat.ts — the ACP chat.
 *
 * The composed piece: a transcript above a prompt composer. This is what an
 * app mounts when it wants "a chat with the agent" rather than assembling
 * transcript + input itself.
 *
 * Elements: ui-acp-chat.
 *
 * The composer is a native <form> with a <textarea>: Enter submits,
 * Shift+Enter inserts a newline, and an empty or whitespace-only prompt never
 * fires. While `busy` (a prompt turn is in flight) the composer disables and
 * the send becomes the caller's cancel affordance if `onCancel` is given —
 * ACP's `session/cancel` is a first-class operation, not an afterthought.
 *
 * Submission surfaces twice, pick either: the `onPrompt` callback prop, and a
 * bubbling `ui-acp-prompt` CustomEvent whose detail is the prompt text.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import { component, computed, html, ref, signal } from '@nisli/core';
import { cn, transparentHost } from '../../lib/utils.js';
import type { TranscriptEntry } from '../../lib/acp-session.js';
import { AcpTranscript } from './acp-transcript.js';

const BUTTON =
  'inline-flex shrink-0 items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50';

export type AcpChatProps = {
  entries?: TranscriptEntry[];
  /** Called with the prompt text; the `ui-acp-prompt` event fires too. */
  onPrompt?: (text: string) => void;
  /** True while a turn is in flight — disables the composer. */
  busy?: boolean;
  /** When given, the send button becomes a Cancel button while busy. */
  onCancel?: () => void;
  placeholder?: string;
  /** Shown by the transcript when there are no entries yet. */
  empty?: string;
  className?: string;
};

export const AcpChat = component<AcpChatProps>(
  'ui-acp-chat',
  (props, host) => {
    transparentHost(host);

    const draft = signal('');
    const input = ref<HTMLTextAreaElement>();
    const busy = computed(() => props.busy.value === true);
    const canSend = computed(() => !busy.value && draft.value.trim().length > 0);
    const cancellable = computed(() => busy.value && props.onCancel.value !== undefined);
    const classes = computed(() =>
      cn('flex min-h-0 w-full flex-col gap-3', props.className.value),
    );

    function submit(): void {
      const text = draft.value.trim();
      if (busy.value || text.length === 0) return;
      draft.value = '';
      if (input.current) input.current.value = '';
      props.onPrompt.value?.(text);
      host.dispatchEvent(
        new CustomEvent<string>('ui-acp-prompt', { detail: text, bubbles: true, composed: true }),
      );
    }

    function onKeydown(event: KeyboardEvent): void {
      // Enter sends; Shift+Enter keeps its native newline. IME composition
      // Enter (keyCode 229 / isComposing) must not send a half-typed prompt.
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      submit();
    }

    return html`<div data-slot="acp-chat" class="${classes}">
      <div data-slot="acp-chat-transcript" class="min-h-0 flex-1 overflow-y-auto">
        ${AcpTranscript({
          entries: computed(() => props.entries.value ?? []),
          empty: computed(() => props.empty.value ?? 'Ask the agent something.'),
        })}
      </div>
      <form
        data-slot="acp-chat-composer"
        class="flex items-end gap-2 rounded-md border bg-background p-2 focus-within:ring-1 focus-within:ring-ring"
        @submit=${(event: Event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          data-slot="acp-chat-input"
          ref="${input}"
          class="max-h-40 min-h-9 w-full flex-1 resize-none bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
          rows="1"
          placeholder="${computed(() => props.placeholder.value ?? 'Message the agent…')}"
          disabled="${busy}"
          @input=${(event: Event) => {
            draft.value = (event.target as HTMLTextAreaElement).value;
          }}
          @keydown=${onKeydown}
        ></textarea>
        ${computed(() =>
          cancellable.value
            ? html`<button
                type="button"
                data-slot="acp-chat-cancel"
                class="${cn(BUTTON, 'border bg-background hover:bg-muted')}"
                @click=${() => props.onCancel.value?.()}
              >
                Cancel
              </button>`
            : html`<button
                type="submit"
                data-slot="acp-chat-send"
                class="${cn(BUTTON, 'bg-primary text-primary-foreground hover:bg-primary/90')}"
                disabled="${computed(() => !canSend.value)}"
              >
                Send
              </button>`,
        )}
      </form>
    </div>`;
  },
  { attrs: { busy: 'boolean', placeholder: 'string', empty: 'string', className: 'string' } },
);
