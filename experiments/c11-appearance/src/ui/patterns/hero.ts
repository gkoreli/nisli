/**
 * hero.ts — the loudest block in the app.
 *
 * DECLARES: display text, supporting body text, one action that must survive,
 * and a group of alternatives that may collapse into the overflow menu.
 *
 * DOES NOT DECIDE: what "display" resolves to, or that a hero's button is bigger
 * than a toolbar's. It is the SAME Button primitive, with the same source, in a
 * context that resolves the scale differently. A hero in this system cannot
 * drift from the rest of the product, because there is no channel through which
 * it could be given its own numbers.
 *
 *   5  secondary actions  menu  the alternative is optional; the primary path
 *                               is not, so it carries no strategy at all and
 *                               the solver can never take it away
 */

import { component, type ComponentAttrs, computed, html, when } from '@nisli/core';
import type { MenuAction } from './overflow-menu.js';
import { fit } from '../../appearance/fit/observe.js';
import { Button } from '../primitives/button.js';
import { Text } from '../primitives/text.js';
import { ActionGroup, ActionScopeContext, actionScope, OverflowMenu } from './overflow-menu.js';

export interface HeroProps {
  headline?: string;
  sub?: string;
  /** The one action that never collapses. */
  primaryAction?: MenuAction;
  /** Alternatives, collapsed as one group when the line runs out. */
  secondaryActions?: readonly MenuAction[];
}

const heroAttrs = { headline: 'string', sub: 'string' } satisfies ComponentAttrs<HeroProps>;

export const Hero = component<HeroProps, typeof heroAttrs>(
  'app-hero',
  (props, host) => {
    ActionScopeContext.provide(host, actionScope());
    fit(host);

    const secondary = computed(() => [...(props.secondaryActions.value ?? [])]);

    return html`<div data-component="app-hero" data-fit data-layout="stack">
      ${Text({ as: 'display', children: props.headline })}
      ${Text({ as: 'body', children: props.sub })}

      <div data-layout="row" data-align="center">
        ${when(
          computed(() => Boolean(props.primaryAction.value)),
          () => html`${Button({
            role: 'primary',
            onClick: () => props.primaryAction.value?.onSelect?.(),
            children: computed(() => props.primaryAction.value?.label ?? ''),
          })}`,
        )}
        ${when(
          computed(() => secondary.value.length > 0),
          () => html`${ActionGroup({ priority: 5, actions: secondary })}`,
        )}
        ${OverflowMenu({ label: 'More actions' })}
      </div>
    </div>`;
  },
  { attrs: heroAttrs },
);
