/**
 * Toolbar — a titled row of action groups that gives way in declared order.
 * The one measured container the pages share; everything else is static tier.
 */

import { component, type ComponentAttrs, computed, each, html } from '@nisli/core';
import { Row, Text } from '../primitives/index.js';
import { ActionGroup, type ActionGroupSpec, ActionScopeContext, actionScope, OverflowMenu } from './overflow-menu.js';

export interface ToolbarProps {
  title?: string;
  /** Ordered groups. 1 survives longest, 5 collapses first. */
  actions?: readonly ActionGroupSpec[];
}

const toolbarAttrs = { title: 'string' } satisfies ComponentAttrs<ToolbarProps>;

export const Toolbar = component<ToolbarProps, typeof toolbarAttrs>(
  'rb-toolbar',
  (props, host) => {
    host.style.display = 'contents';
    ActionScopeContext.provide(host, actionScope());
    const groups = computed(() => [...(props.actions.value ?? [])]);
    return html`${Row({
      align: 'center',
      role: 'toolbar',
      children: html`
        ${Text({ as: 'title', collapse: 'truncate', priority: 4, grow: true, children: props.title })}
        ${each(
          groups,
          (group) => group.id,
          (group) => html`${ActionGroup({
            priority: computed(() => group.value.priority),
            actions: computed(() => group.value.actions),
          })}`,
        )}
        ${OverflowMenu({ label: 'More actions' })}
      `,
    })}`;
  },
  { attrs: toolbarAttrs },
);
