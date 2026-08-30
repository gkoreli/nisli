import { el, each, signal, computed, onMount, onCleanup, ref } from '@nisli/core';
import { truncate, buttonBox, menuItemBox } from '../style.js';
import { measure } from '../engine/measure.js';
import { block } from './kernel.js';
import type { Action } from './types.js';

export type { Action };

export interface ToolbarProps {
  title: string;
  actions?: readonly Action[];
}

// The block's taste, expressed as ranks the engine walks. The title gives
// ground before a primary action leaves the row; everything else leaves first.
const RANK = { tertiary: 1, secondary: 2, title: 10, primary: 20 } as const;
const rank = (a: Action) => RANK[a.priority ?? 'secondary'];
const variantOf = (a: Action) => (a.destructive ? 'danger' : a.priority === 'primary' ? 'primary' : 'plain');

export const Toolbar = block<ToolbarProps>('nisli-toolbar', {
  host: ({ metrics }) => ({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: metrics.space[2],
    padding: `${metrics.space[2]}px ${metrics.space[4]}px`,
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 0,
    minHeight: metrics.control.height + 2 * metrics.space[2] + 2,
  }),
  hostParts: ['surface', 'bar'],
  render: (props, ctx) => {
    const { host, busy, metrics } = ctx;
    const titleEl = ref();
    const trigger = ref();
    const open = signal(false);
    const actions = computed(() => [...(props.actions.value ?? [])]);

    const row = ctx.fitRow({
      gap: metrics.space[2],
      available: () => measure(host) - 2 * metrics.space[4],
      triggerWidth: () => (trigger.current ? measure(trigger.current as HTMLElement) : 0),
      items: () => {
        const buttons = [...host.querySelectorAll<HTMLElement>('[data-nisli-action]')];
        const titleWidth = titleEl.current ? measure(titleEl.current as HTMLElement) : 0;
        return [
          { id: 'title', width: titleWidth, minWidth: Math.min(titleWidth, metrics.layout.minTitle), priority: RANK.title },
          ...actions.value.map((a, i) => ({ id: a.id, width: buttons[i] ? measure(buttons[i]!) : 0, priority: rank(a), overflowable: true })),
        ];
      },
      deps: () => { actions.value; props.title.value; },
      report: { code: 'FIT_ROW', detail: () => `title "${props.title.value}" and its primary actions cannot fit` },
    });
    const overflowed = computed(() => (row.measuring.value ? [] : actions.value.filter((a) => row.decision(a.id)?.action === 'overflow')));

    const onDoc = (e: Event) => { if (!host.contains(e.target as Node)) open.value = false; };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') open.value = false; };
    onMount(() => {
      document.addEventListener('pointerdown', onDoc);
      document.addEventListener('keydown', onKey);
    });
    onCleanup(() => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    });

    const isBusy = (a: Action) => busy.is(a.id);

    return [
      el('h2', {
        ref: titleEl,
        style: ctx.part('text.title', () => {
          const d = row.decision('title');
          return { margin: 0, flex: 'none', font: 'inherit', ...truncate, width: !row.measuring.value && d?.action === 'shrink' ? d.width : 'auto' };
        }),
      }, props.title),
      el('div', { style: ctx.part([], { flex: '1 1 0', minWidth: 0 }) }),
      each(actions, (a) => a.id, (a) =>
        el('button', {
          type: 'button',
          'data-nisli-action': computed(() => a.value.id),
          'aria-busy': computed(() => (isBusy(a.value) ? 'true' : false)),
          disabled: computed(() => (isBusy(a.value) ? 'disabled' : false)),
          style: ctx.part(
            () => ['button', `button.${variantOf(a.value)}`, ...(isBusy(a.value) ? ['button.busy' as const] : [])],
            () => ({ ...buttonBox(), display: row.gone(a.value.id) ? 'none' : 'inline-flex' }),
          ),
          on: { click: () => busy.run(a.value.id, a.value.onSelect) },
        }, computed(() => a.value.label)),
      ),
      el('button', {
        ref: trigger,
        type: 'button',
        'aria-label': 'More actions',
        'aria-haspopup': 'menu',
        'aria-expanded': computed(() => String(open.value)),
        style: ctx.part(['button', 'button.plain'], () => ({ ...buttonBox(), display: row.measuring.value || overflowed.value.length ? 'inline-flex' : 'none' })),
        on: { click: () => { open.value = !open.value; } },
      }, '⋯'),
      el('div', {
        role: 'menu',
        style: ctx.part(['surface.raised', 'menu'], () => ({
          display: open.value ? 'flex' : 'none',
          flexDirection: 'column',
          position: 'absolute',
          top: '100%',
          right: metrics.space[4],
          minWidth: 160,
          padding: metrics.space[1],
          zIndex: 10,
        })),
      }, [
        each(overflowed, (a) => a.id, (a) =>
          el('button', {
            type: 'button',
            role: 'menuitem',
            style: ctx.part(() => ['menu.item', ...(a.value.destructive ? ['menu.item.danger' as const] : [])], menuItemBox()),
            'aria-busy': computed(() => (isBusy(a.value) ? 'true' : false)),
            disabled: computed(() => (isBusy(a.value) ? 'disabled' : false)),
            on: { click: () => { open.value = false; busy.run(a.value.id, a.value.onSelect); } },
          }, computed(() => a.value.label)),
        ),
      ]),
    ];
  },
});
