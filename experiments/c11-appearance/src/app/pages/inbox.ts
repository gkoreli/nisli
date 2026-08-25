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
 */

import { computed, each, html, type TemplateResult } from '@nisli/core';
import { type ActionGroupSpec, MessageRow, Region, Surface, Toolbar } from '../../ui/index.js';
import {
  archive,
  compose,
  markAllRead,
  markRead,
  reply,
  restoreDemoData,
  unreadOnly,
  visibleMessages,
} from '../state.js';

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

export function InboxPage(): TemplateResult {
  return Region({
    layout: 'stack',
    children: html`
      ${Toolbar({ title: 'Inbox', actions: TOOLBAR_ACTIONS })}
      ${Surface({
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
      })}
    `,
  });
}
