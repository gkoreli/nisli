/**
 * toolbar.ts — a title and a set of actions on one line.
 *
 * DECLARES: the same three things the message row declares — structure,
 * priority, strategy — over completely different content. That is the point of
 * the experiment: the fit contract is a property of the VOCABULARY, not of a
 * component the framework was taught about. Nothing in the engine knows what a
 * toolbar is.
 *
 * DOES NOT DECIDE: which actions survive at a given width. The caller declares
 * how important each group is; the width decides the rest, at runtime, per
 * container, with no breakpoint anywhere.
 *
 *   5  title    HIDE      **F5, a second time, on a second element.** This was
 *                         `truncate`, on the reasoning that "a title ellipsises
 *                         legibly". It does not: the derived checker measured
 *                         "Inbox" — five characters wanting 39 — clamped to a
 *                         ONE-pixel box, which is "1…"/"Y…"/"M" again on new
 *                         markup. A page title is an ATOMIC value, and
 *                         truncating one can never repay a real deficit: the
 *                         whole element is worth about 39, so the solver spends
 *                         it, gains nothing, and moves on having destroyed the
 *                         label. `hide` is also the honest reading of the
 *                         contract — it is "correct for values repeated
 *                         elsewhere", and this value is repeated by the
 *                         `aria-current` nav item two boxes away. Giving up a
 *                         redundant label before giving up functionality is the
 *                         right trade; that is why it is still rung 5.
 *   4..1 groups menu      caller-declared; 1 survives longest
 *
 * Worth recording HOW this was found: nobody looked at a screenshot. The rule
 * that reports it (N621) exists because F5 happened once, and it caught the
 * same authoring mistake on an element written after it — which is the F5
 * finding's actual claim ("the checker can derive a warning — authoring
 * feedback no framework currently gives") being cashed in.
 *
 * The spacer is an empty `data-grow` box rather than a margin: it declares
 * "the slack belongs here", which is a relationship, whereas a margin would be
 * a value.
 */

import { component, type ComponentAttrs, computed, each, html } from '@nisli/core';
import type { ActionGroupSpec } from './overflow-menu.js';
import { fit } from '../../appearance/fit/observe.js';
import { Text } from '../primitives/text.js';
import { ActionGroup, ActionScopeContext, actionScope, OverflowMenu } from './overflow-menu.js';

export interface ToolbarProps {
  title?: string;
  /** Ordered groups. 1 survives longest, 5 collapses first. */
  actions?: readonly ActionGroupSpec[];
}

const toolbarAttrs = { title: 'string' } satisfies ComponentAttrs<ToolbarProps>;

export const Toolbar = component<ToolbarProps, typeof toolbarAttrs>(
  'app-toolbar',
  (props, host) => {
    ActionScopeContext.provide(host, actionScope());
    fit(host);

    const groups = computed(() => [...(props.actions.value ?? [])]);

    return html`<div
      data-component="app-toolbar"
      data-fit
      data-layout="row"
      data-align="center"
    >
      ${Text({ as: 'title', collapse: 'hide', priority: 5, children: props.title })}

      <span data-grow></span>

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
  { attrs: toolbarAttrs },
);
