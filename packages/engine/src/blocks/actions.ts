/**
 * The one renderer for every Action (ADR 0043 rule 3). Toolbar, Page (via
 * Toolbar), Empty, Form, Dialog and confirm draw their buttons and menu items
 * here, so one `Action` is honoured identically wherever it is placed:
 * `destructive` → `button.danger` (wins); else `priority === 'primary'` →
 * `button.primary`; else `button.plain`; busy on a returned promise. The rule
 * is per action — the renderer never counts primaries. Where a row may
 * overflow, and where a destructive action sits, is the placement's decision.
 * Not a block: a helper on `ctx`, like `surface.ts`.
 */
import { el, each, computed, type ReadonlySignal, type TemplateResult } from '@nisli/core';
import { buttonBox, menuItemBox, type StyleRecord } from '../style.js';
import type { Ctx, Parts } from './kernel.js';
import type { Action } from './types.js';

export type Variant = 'primary' | 'plain' | 'danger';

/** The rule. */
export const variantOf = (a: Pick<Action, 'priority' | 'destructive'>): Variant =>
  (a.destructive ? 'danger' : a.priority === 'primary' ? 'primary' : 'plain');

export interface ActionButtonOptions {
  /** `'submit'`: a form's own verb — the form's submit handler runs, not `onSelect`. */
  readonly type?: 'button' | 'submit';
  /** Structure beyond the button box: the placement's decisions (gone, apart, a top margin). */
  readonly structure?: () => StyleRecord;
  /** Extra attributes the placement needs (a data-* hook for measuring). */
  readonly attrs?: Record<string, unknown>;
  /** What activating does; default: run `onSelect` busy under the action's id. */
  readonly onActivate?: (a: Action) => void;
}

const run = <P,>(ctx: Ctx<P>, a: Action) => ctx.busy.run(a.id, a.onSelect);

/** One action as a button. */
export function actionButton<P>(ctx: Ctx<P>, action: () => Action, options: ActionButtonOptions = {}): TemplateResult {
  const isBusy = () => ctx.busy.is(action().id);
  return el('button', {
    type: options.type ?? 'button',
    ...(options.attrs ?? {}),
    'aria-busy': computed(() => (isBusy() ? 'true' : false)),
    disabled: computed(() => (isBusy() ? 'disabled' : false)),
    style: ctx.part(
      (): Parts => ['button', `button.${variantOf(action())}` as const, ...(isBusy() ? ['button.busy' as const] : [])],
      () => ({ ...buttonBox(), ...(options.structure?.() ?? {}) }),
    ),
    on: options.type === 'submit' ? {} : { click: () => (options.onActivate ?? ((a: Action) => run(ctx, a)))(action()) },
  }, computed(() => action().label));
}

/** One action as a menu item (an overflowed row): danger when destructive, busy the same way. */
export function menuItem<P>(ctx: Ctx<P>, action: () => Action, options: { readonly attrs?: Record<string, unknown>; readonly onActivate?: (a: Action) => void } = {}): TemplateResult {
  const isBusy = () => ctx.busy.is(action().id);
  return el('button', {
    type: 'button',
    role: 'menuitem',
    ...(options.attrs ?? {}),
    style: ctx.part((): Parts => ['menu.item', ...(action().destructive ? ['menu.item.danger' as const] : [])], menuItemBox()),
    'aria-busy': computed(() => (isBusy() ? 'true' : false)),
    disabled: computed(() => (isBusy() ? 'disabled' : false)),
    on: { click: () => (options.onActivate ?? ((a: Action) => run(ctx, a)))(action()) },
  }, computed(() => action().label));
}

export interface ActionRowOptions {
  readonly justify?: 'start' | 'center' | 'end';
  /** A footer's rule: destructive actions sit first and apart from the rest. */
  readonly apart?: boolean;
  /** Controls the placement adds after the actions (a form's Cancel and submit). */
  readonly trailing?: readonly TemplateResult[];
  /** Structure beyond the row (a margin, a display the placement decides). */
  readonly structure?: () => StyleRecord;
}

const JUSTIFY = { start: 'flex-start', center: 'center', end: 'flex-end' } as const;

/** A row of actions that wraps and never overflows. Hidden when it has nothing to show. */
export function actionRow<P>(ctx: Ctx<P>, actions: ReadonlySignal<readonly Action[]>, options: ActionRowOptions = {}): TemplateResult {
  const placed = computed(() => {
    const list = [...actions.value];
    return options.apart ? [...list.filter((a) => a.destructive), ...list.filter((a) => !a.destructive)] : list;
  });
  const shown = () => placed.value.length > 0 || (options.trailing?.length ?? 0) > 0;
  return el('div', {
    style: ctx.part([], () => ({
      display: shown() ? 'flex' : 'none',
      gap: ctx.metrics.space[2],
      flexWrap: 'wrap',
      justifyContent: JUSTIFY[options.justify ?? 'end'],
      ...(options.structure?.() ?? {}),
    })),
  }, [
    each(placed, (a) => a.id, (a) =>
      actionButton(ctx, () => a.value, { structure: () => (options.apart && a.value.destructive ? { marginRight: 'auto' } : {}) }),
    ),
    ...(options.trailing ?? []),
  ]);
}
