import { html } from '@nisli/core';
import { AcpPermission } from '../nisli-ui/ui/acp/acp-permission.js';
import type {
  RequestPermissionRequest,
  RequestPermissionOutcome,
} from '../nisli-ui/lib/acp-protocol.js';

// The agent blocks until the user answers session/request_permission.
// Render the card; resolve with the outcome the click handler gives you.
export function askUser(request: RequestPermissionRequest): Promise<RequestPermissionOutcome> {
  return new Promise((resolve) => {
    html`${AcpPermission({
      toolCall: request.toolCall, // rendered expanded, diff included
      options: request.options, // allow_always is styled distinctly
      onSelect: resolve, // { outcome: 'selected', optionId } | { outcome: 'cancelled' }
    })}`.mount(document.querySelector('#approvals')!);
  });
}
