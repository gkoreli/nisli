import { el } from '@nisli/core';
import type { Part } from '../skin.js';
import { block } from './kernel.js';
import type { Tone } from './types.js';

export interface TextProps {
  text: string;
  /** What the text is; the skin decides how that reads. */
  role?: 'body' | 'muted' | 'heading' | 'code';
  tone?: Tone;
}

export interface LinkProps {
  href: string;
  label: string;
}

const ROLE_PART: Record<NonNullable<TextProps['role']>, Part> = { body: 'text', muted: 'text.muted', heading: 'text.heading', code: 'text.code' };

export const Text = block<TextProps>('nisli-text', {
  host: () => ({ display: 'block', minWidth: 0 }),
  render: (props, ctx) => el('span', {
    style: ctx.part(
      () => [ROLE_PART[props.role.value ?? 'body'], ...(props.tone.value ? [`tone.${props.tone.value}` as const] : [])],
      { overflowWrap: 'anywhere' },
    ),
  }, props.text),
});

export const Link = block<LinkProps>('nisli-link', {
  host: () => ({ display: 'inline' }),
  render: (props, ctx) => el('a', { href: props.href, style: ctx.part('link') }, props.label),
});
