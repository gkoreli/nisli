import { component, el, computed } from '@nisli/core';
import { css, apply } from '../style.js';
import { look, type Part } from '../skin.js';
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

export const Text = component<TextProps>('nisli-text', (props, host) => {
  apply(host, { display: 'block', minWidth: 0 });
  return el('span', {
    style: computed(() => css({
      overflowWrap: 'anywhere',
      ...look(ROLE_PART[props.role.value ?? 'body']),
      ...(props.tone.value ? look(`tone.${props.tone.value}`) : {}),
    })),
  }, props.text);
});

export const Link = component<LinkProps>('nisli-link', (props, host) => {
  apply(host, { display: 'inline' });
  return el('a', { href: props.href, style: computed(() => css(look('link'))) }, props.label);
});
