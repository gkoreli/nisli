/**
 * text.ts — semantic text.
 *
 * DECLARES: which of the five text levels this is, how important it is
 * (`priority`), and what to do with it when the line runs out of room
 * (`collapse`).
 *
 * DOES NOT DECIDE: font size, weight, line height, colour or measure. Those are
 * a function of the declared level and the inherited context.
 *
 * `collapse` is deliberately NOT a boolean. F5: the prototype gave every
 * shortenable node `truncate`, and at the narrowest measured width the
 * timestamps degraded to "1…", "Y…", "M" — technically fitting, visually
 * useless. `truncate` is only right for prose; a short atomic value is either
 * readable or it should be gone, so the author has to pick, and the two legal
 * answers are the only two offered. (`menu` is absent here: moving a paragraph
 * into a menu is not a thing.)
 */

import { children, component, type ComponentAttrs, computed, html } from '@nisli/core';
import type { Priority, TextRole } from '../../appearance/contracts.js';

/** The strategies that mean something for text. */
export type TextStrategy = 'truncate' | 'hide';

export interface TextProps {
  as?: TextRole;
  collapse?: TextStrategy;
  priority?: Priority;
  grow?: boolean;
  children?: unknown;
}

const textAttrs = {
  as: 'string',
  collapse: 'string',
  priority: 'number',
  grow: 'boolean',
} satisfies ComponentAttrs<TextProps>;

export const Text = component<TextProps, typeof textAttrs>(
  'app-text',
  (props) => html`<span
    data-component="app-text"
    data-text=${computed(() => props.as.value ?? 'body')}
    data-collapse=${props.collapse}
    data-priority=${props.priority}
    data-grow=${props.grow}
  >${children()}</span>`,
  { attrs: textAttrs },
);
