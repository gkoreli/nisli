/**
 * avatar.ts — an identity token.
 *
 * DECLARES: that this is an avatar. That is the entire declaration.
 *
 * DOES NOT DECIDE: its diameter, its radius, its background, or the font its
 * initials are set in. Its size is a function of the context's `--unit` and the
 * context's minimum touch target, which is why the same source is small on a
 * pointer and comfortably larger on touch without a `size` prop existing.
 *
 * It is marked `aria-hidden`: the initials are a redundant rendering of a name
 * that is always announced by the text beside it, so exposing them would make
 * every row read its author twice.
 */

import { component, type ComponentAttrs, html } from '@nisli/core';

export interface AvatarProps {
  initials?: string;
}

const avatarAttrs = { initials: 'string' } satisfies ComponentAttrs<AvatarProps>;

export const Avatar = component<AvatarProps, typeof avatarAttrs>(
  'app-avatar',
  (props) => html`<span
    data-component="app-avatar"
    data-appearance="avatar"
    aria-hidden="true"
  >${props.initials}</span>`,
  { attrs: avatarAttrs },
);
