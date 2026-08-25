/**
 * message-row.ts — one message in a list.
 *
 * DECLARES: the structure (avatar, an identity/excerpt column that takes the
 * slack, a timestamp, action groups, one overflow affordance), and for every
 * part of it what matters least and what to do when the room runs out.
 *
 * DOES NOT DECIDE: a single breakpoint. There is no narrow-width branch, no
 * `compact` variant and no "mobile row" component. The row states its priorities
 * once, and the same source produces the widest layout and the narrowest one.
 *
 * The declared degradation ladder, and why each rung is what it is:
 *
 *   5  excerpt   truncate  prose ellipsises without becoming a lie, so it is
 *                          the cheapest thing to give up and goes first
 *   5  unread ●  hide      pure decoration; the same rung as the excerpt on
 *                          purpose — both are free to lose, neither before the
 *                          other
 *   4  timestamp HIDE      **F5.** This was `truncate`, and at the narrowest
 *                          measured width the timestamps degraded to "1…",
 *                          "Y…", "M" — technically fitting, and useless. A
 *                          time is an ATOMIC value: it is either readable or it
 *                          should be gone. The engine did exactly what it was
 *                          told; the author had chosen a strategy that only
 *                          makes sense for prose.
 *   3  author    truncate  the row's identity: it may ellipsise, never vanish
 *   2/1 actions  menu      supplied by the caller, and reachable afterwards
 *
 * Action groups collapse as ONE group each. A group is a single candidate
 * carrying a single `data-collapse`, so the solver cannot take Star and leave
 * Archive stranded beside it, and cannot leave a "Reply" that no longer sits
 * next to anything.
 */

import { component, type ComponentAttrs, computed, each, html, when } from '@nisli/core';
import type { ActionGroupSpec } from './overflow-menu.js';
import { fit } from '../../appearance/fit/observe.js';
import { Avatar } from '../primitives/avatar.js';
import { Text } from '../primitives/text.js';
import { ActionGroup, ActionScopeContext, actionScope, OverflowMenu } from './overflow-menu.js';

export interface MessageRowProps {
  author?: string;
  initials?: string;
  time?: string;
  excerpt?: string;
  unread?: boolean;
  /** Ordered groups. Convention: 2 for secondary, 1 for the one that survives. */
  actions?: readonly ActionGroupSpec[];
}

const messageRowAttrs = {
  author: 'string',
  initials: 'string',
  time: 'string',
  excerpt: 'string',
  unread: 'boolean',
} satisfies ComponentAttrs<MessageRowProps>;

export const MessageRow = component<MessageRowProps, typeof messageRowAttrs>(
  'app-message-row',
  (props, host) => {
    // The scope is provided on the HOST, before the template exists, so the
    // groups and the menu inside it resolve it during their own setup.
    ActionScopeContext.provide(host, actionScope());
    // The framework's measured tier, attached in one line.
    fit(host);

    const groups = computed(() => [...(props.actions.value ?? [])]);

    return html`<div
      data-component="app-message-row"
      data-fit
      data-layout="row"
      data-align="center"
    >
      ${Avatar({ initials: props.initials })}

      <div data-layout="stack" data-grow>
        <div data-layout="row" data-align="center">
          ${Text({ as: 'title', collapse: 'truncate', priority: 3, children: props.author })}
          ${when(
            props.unread,
            () => html`<span
              data-text="meta"
              data-priority="5"
              data-collapse="hide"
              role="img"
              aria-label="Unread"
            >●</span>`,
          )}
        </div>
        ${Text({ as: 'meta', collapse: 'truncate', priority: 5, children: props.excerpt })}
      </div>

      ${Text({ as: 'meta', collapse: 'hide', priority: 4, children: props.time })}

      ${each(
        groups,
        (group) => group.id,
        (group) => html`${ActionGroup({
          priority: computed(() => group.value.priority),
          actions: computed(() => group.value.actions),
        })}`,
      )}

      ${OverflowMenu({ label: 'More actions' })}
    </div>`;
  },
  { attrs: messageRowAttrs },
);
