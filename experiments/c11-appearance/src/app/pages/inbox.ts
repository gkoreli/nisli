/**
 * inbox.ts — the page the fit solver is judged on: five independent fit
 * containers (a toolbar and four message rows) that must each degrade on their
 * own terms, with no breakpoint telling any of them what is about to happen.
 *
 * The action groups are declared here rather than inside the pattern because of
 * F6: collapsed actions have to stay reachable, and an action the page did not
 * supply cannot be reached from anywhere. Priorities say only what matters
 * least — 2 goes into the overflow menu before 1 does — and never how wide
 * anything is.
 *
 * THE DECLARED STATES ARE RENDERED FROM THE SAME SOURCE. The toolbar is page
 * chrome and stays in every state, because it is how the reader gets out of one:
 * the empty state's way forward is the toolbar's own New message action, and the
 * bulk actions are what make `many` reachable. Below it there are exactly four
 * possible renderings and no per-state styling anywhere: the delivery states
 * defer to `states.ts`, an empty corpus falls through to the empty panel as a
 * CONSEQUENCE rather than as a branch anybody chose, and everything else is the
 * row list the matrix has always measured.
 *
 * THE SENDERS STRIP IS DECORATION, AND SAYS SO TWICE. A row of initials above
 * the list is a visual summary of who is in it, and every identity in it is
 * rendered as text a few boxes below — which is why `Avatar` was already
 * `aria-hidden`: the initials are a redundant rendering of a name that is
 * always announced beside them. A strip of them is therefore not in the
 * accessibility tree at all, and that is the whole licence for `clip: 'trim'`.
 *
 * The theme derives a reachable scroll region for clipped content by default,
 * because a clipped column is a deleted column and the demo table paid for
 * that lesson. Nothing measurable separates this strip from that table — both
 * are simply wider than their box — so the author has to answer the one
 * question the engine cannot, and `trim` is that answer: the overhang here
 * carries no information, because the accessibility tree already says there is
 * none to carry. The claim is checkable rather than decorative prose: N710
 * stops reporting clipped loss on a trimmed clipper, so declaring it on a
 * strip whose contents were NOT duplicated below would be muting a real
 * finding, and declaring it here is not.
 *
 * It renders only when there is a list. An empty decorative strip is furniture.
 */

import { computed, each, html, type ReadonlySignal, type TemplateResult } from '@nisli/core';
import {
  type ActionGroupSpec,
  Avatar,
  Button,
  MessageRow,
  Region,
  Surface,
  Toolbar,
} from '../../ui/index.js';
import {
  archive,
  compose,
  delivery,
  markAllRead,
  markRead,
  reply,
  restoreDemoData,
  retry,
  unreadOnly,
  visibleMessages,
} from '../state.js';
import { StatePanel } from './states.js';

function messageActions(id: string): readonly ActionGroupSpec[] {
  return [
    {
      id: 'secondary',
      priority: 2,
      actions: [
        { id: 'read', label: 'Mark read', emphasis: 'quiet', onSelect: () => markRead(id) },
        { id: 'archive', label: 'Archive', emphasis: 'quiet', onSelect: () => archive(id) },
      ],
    },
    {
      id: 'reply',
      priority: 1,
      actions: [{ id: 'reply', label: 'Reply', emphasis: 'quiet', onSelect: () => reply(id) }],
    },
  ];
}

const TOOLBAR_ACTIONS: readonly ActionGroupSpec[] = [
  {
    id: 'bulk',
    priority: 4,
    actions: [
      { id: 'read-all', label: 'Mark all read', emphasis: 'quiet', onSelect: markAllRead },
      { id: 'restore', label: 'Restore demo data', emphasis: 'quiet', onSelect: restoreDemoData },
    ],
  },
  {
    id: 'filter',
    priority: 3,
    actions: [
      {
        id: 'unread',
        label: 'Unread only',
        emphasis: 'quiet',
        onSelect: () => {
          unreadOnly.value = !unreadOnly.value;
        },
      },
    ],
  },
  {
    id: 'compose',
    priority: 1,
    actions: [{ id: 'compose', label: 'New message', emphasis: 'primary', onSelect: compose }],
  },
];

/**
 * The list, or the one panel that explains why there is no list.
 *
 * Created per mount rather than at module scope: a cached TemplateResult is a
 * mounted DOM range, so sharing one across two mounts of the same page hands
 * the second mount nodes the first still owns.
 */
function inboxBody(): ReadonlySignal<TemplateResult> {
  return computed((): TemplateResult => {
    if (delivery.value === 'loading') {
      return StatePanel({
        kind: 'loading',
        headline: 'Loading messages',
        what: 'The thread list has been requested and has not arrived yet.',
      });
    }
    if (delivery.value === 'error') {
      return StatePanel({
        kind: 'error',
        headline: 'Messages unavailable',
        what: 'The thread list could not be loaded, so nothing below can be trusted.',
        action: Button({ role: 'primary', children: 'Try again', onClick: retry }),
      });
    }
    if (visibleMessages.value.length === 0) {
      return StatePanel({
        kind: 'empty',
        headline: 'No messages',
        what: 'Nothing is waiting. New messages arrive at the top of this list.',
        action: Button({ role: 'primary', children: 'New message', onClick: compose }),
      });
    }
    return Surface({
      flush: true,
      layout: 'stack',
      children: html`${each(
        visibleMessages,
        (message) => message.id,
        // `each` mounts what its callback returns, and a component factory
        // result is not a mountable template — returning `MessageRow({…})`
        // bare renders an empty list, silently. The wrapping html`` is load
        // bearing.
        (message) => html`${MessageRow({
          author: computed(() => message.value.author),
          initials: computed(() => message.value.initials),
          time: computed(() => message.value.time),
          excerpt: computed(() => message.value.excerpt),
          unread: computed(() => message.value.unread),
          actions: messageActions(message.value.id),
        })}`,
      )}`,
    });
  });
}

/**
 * The decorative summary of who is in the list.
 *
 * Empty when the list is, which covers loading, failed and genuinely empty
 * without asking about any of them: all three seed an empty corpus, so "there
 * is nobody to show" and "there is no list" are the same fact read once.
 */
function sendersStrip(): ReadonlySignal<TemplateResult> {
  return computed((): TemplateResult => {
    const senders = visibleMessages.value;
    if (senders.length === 0) return html``;
    return Region({
      layout: 'row',
      clip: 'trim',
      children: html`${senders.map((message) => Avatar({ initials: message.initials }))}`,
    });
  });
}

export function InboxPage(): TemplateResult {
  return Region({
    layout: 'stack',
    children: html`${Toolbar({ title: 'Inbox', actions: TOOLBAR_ACTIONS })} ${sendersStrip()}
    ${inboxBody()}`,
  });
}
