/**
 * ui/acp-permission.ts — ACP permission request.
 *
 * Renders `session/request_permission`: the agent wants to do something and is
 * blocked until the user answers. This is the one component in the set where
 * getting the visual design wrong has a security consequence, so three rules
 * are baked in rather than left to the caller:
 *
 *  1. **Show what is actually being approved.** The requested tool call renders
 *     expanded, diffs included. Approving a write whose diff you cannot see is
 *     the failure mode this whole round-trip exists to prevent.
 *  2. **`*_always` never looks like `*_once`.** "Allow always" grants standing
 *     permission for the rest of the session; it is rendered as a secondary
 *     affordance with an explicit note, so it cannot be clicked by muscle
 *     memory meant for a one-time approval.
 *  3. **Nothing is autofocused, and there is no default action.** A pending
 *     request that receives a stray Enter must not resolve itself. Escape and
 *     dismissal map to `cancelled`, never to an allow.
 *
 * Elements: ui-acp-permission.
 *
 * Emits a bubbling `ui-acp-permission-select` CustomEvent whose detail is
 * `{ outcome: 'selected', optionId } | { outcome: 'cancelled' }` — the exact
 * `RequestPermissionOutcome` shape you send back over ACP.
 *
 * PROMPT INJECTION: `toolCall.title` and its arguments are agent-authored text
 * that may be steered by a document the agent just read. It is rendered as
 * text, and it is never treated as an instruction about which button to
 * present. Do not add auto-approval here or on the agent side.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import { component, computed, each, html } from '@nisli/core';
import { cn, transparentHost } from '../../lib/utils.js';
import {
  isAllowOption,
  isPersistentOption,
  type PermissionOption,
  type RequestPermissionOutcome,
  type ToolCall,
} from '../../lib/acp-protocol.js';
import { AcpToolCall } from './acp-tool-call.js';

const BUTTON_BASE =
  'inline-flex shrink-0 items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50';

function buttonClass(option: PermissionOption): string {
  const allow = isAllowOption(option);
  const persistent = isPersistentOption(option);

  if (allow && !persistent) return cn(BUTTON_BASE, 'bg-primary text-primary-foreground hover:bg-primary/90');
  if (allow && persistent) {
    // Deliberately quieter than the one-time allow: a standing grant should
    // take a moment of intent, not sit under the cursor's resting position.
    return cn(BUTTON_BASE, 'border border-primary/40 text-primary hover:bg-primary/10');
  }
  if (!allow && !persistent) return cn(BUTTON_BASE, 'border bg-background hover:bg-muted');
  return cn(BUTTON_BASE, 'border border-destructive/40 text-destructive hover:bg-destructive/10');
}

export type AcpPermissionProps = {
  toolCall?: ToolCall;
  options?: PermissionOption[];
  /** Explanatory line above the buttons. */
  prompt?: string;
  /** Disable every control, e.g. while the answer is in flight. */
  disabled?: boolean;
  /** Called with the outcome; the `ui-acp-permission-select` event fires too. */
  onSelect?: (outcome: RequestPermissionOutcome) => void;
  className?: string;
};

export const AcpPermission = component<AcpPermissionProps>(
  'ui-acp-permission',
  (props, host) => {
    transparentHost(host);

    const options = computed(() => props.options.value ?? []);
    const allowOptions = computed(() => options.value.filter(isAllowOption));
    const rejectOptions = computed(() => options.value.filter((option) => !isAllowOption(option)));
    const disabled = computed(() => props.disabled.value === true);
    const classes = computed(() =>
      cn(
        'flex flex-col gap-3 rounded-md border-2 border-amber-500/50 bg-amber-500/5 p-3',
        props.className.value,
      ),
    );

    function choose(outcome: RequestPermissionOutcome): void {
      if (disabled.value) return;
      props.onSelect.value?.(outcome);
      host.dispatchEvent(
        new CustomEvent<RequestPermissionOutcome>('ui-acp-permission-select', {
          detail: outcome,
          bubbles: true,
          composed: true,
        }),
      );
    }

    function renderOption(option: PermissionOption) {
      return html`<button
        type="button"
        data-slot="acp-permission-option"
        data-kind="${option.kind}"
        class="${buttonClass(option)}"
        disabled="${disabled}"
        @click=${() => choose({ outcome: 'selected', optionId: option.optionId })}
      >
        ${option.name}
      </button>`;
    }

    return html`<div
      data-slot="acp-permission"
      class="${classes}"
      role="alertdialog"
      aria-label="Permission required"
    >
      <div
        data-slot="acp-permission-header"
        class="flex items-center gap-2 text-xs font-medium tracking-wide text-amber-700 uppercase dark:text-amber-400"
      >
        <span aria-hidden="true">⚠</span>
        <span>Permission required</span>
      </div>

      ${computed(() => {
        const call = props.toolCall.value;
        // `open: true` is the point — the diff must be readable before the
        // user can approve it.
        return call === undefined ? null : AcpToolCall({ call, open: true });
      })}

      ${computed(() => {
        const prompt = props.prompt.value;
        return prompt === undefined || prompt === ''
          ? null
          : html`<p data-slot="acp-permission-prompt" class="text-sm">${prompt}</p>`;
      })}

      <div data-slot="acp-permission-actions" class="flex flex-wrap items-center gap-2">
        ${each(allowOptions, (option) => option.optionId, (option) =>
          html`${computed(() => renderOption(option.value))}`,
        )}
        <span class="flex-1" aria-hidden="true"></span>
        ${each(rejectOptions, (option) => option.optionId, (option) =>
          html`${computed(() => renderOption(option.value))}`,
        )}
      </div>

      ${computed(() =>
        options.value.some(isPersistentOption)
          ? html`<p data-slot="acp-permission-note" class="text-[11px] text-muted-foreground">
              “Always” answers apply to every matching request for the rest of this session.
            </p>`
          : null,
      )}
    </div>`;
  },
  { attrs: { prompt: 'string', disabled: 'boolean', className: 'string' } },
);
