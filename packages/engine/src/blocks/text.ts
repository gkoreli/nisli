import { el, computed } from '@nisli/core';
import type { Part } from '../skin.js';
import { block } from './kernel.js';
import type { Tone } from './types.js';

export interface TextProps {
  text: string;
  /**
   * What the prose is: `'body'` (default); `'note'`, WAI-ARIA's word for content ancillary to the main content —
   * a free-standing secondary paragraph; `'code'`, a literal. A heading is a container's `title`.
   */
  role?: 'body' | 'note' | 'code';
  tone?: Tone;
}

export interface LinkProps {
  href: string;
  label: string;
}

const ROLE_PART: Record<NonNullable<TextProps['role']>, Part> = { body: 'text', note: 'text.muted', code: 'text.code' };

export const Text = block<TextProps>('nisli-text', {
  host: () => ({ display: 'block', minWidth: 0 }),
  render: (props, ctx) => el('span', {
    // `note` and `code` are ARIA roles; the word reaches AT, not only the skin.
    role: computed(() => (props.role.value === 'note' || props.role.value === 'code' ? props.role.value : false)),
    style: ctx.part(
      () => [ROLE_PART[props.role.value ?? 'body'], ...(props.tone.value ? [`tone.${props.tone.value}` as const] : [])],
      () => ({ overflowWrap: 'anywhere' }),
    ),
  }, props.text),
});

export const Link = block<LinkProps>('nisli-link', {
  host: () => ({ display: 'inline' }),
  render: (props, ctx) => el('a', { href: props.href, style: ctx.part('link') }, props.label),
});
