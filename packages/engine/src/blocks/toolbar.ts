import { el, each, signal, computed, ref } from '@nisli/core';
import { truncate, buttonBox } from '../style.js';
import { measure } from '../engine/measure.js';
import { block, focusables } from './kernel.js';
import { actionButton, menuItem } from './actions.js';
import type { Action } from './types.js';

export type { Action };

export interface ToolbarProps {
  title: string;
  actions?: readonly Action[];
}

// The block's taste, expressed as ranks the engine walks. The title gives
// ground (to `minTitle`) and everything else leaves first; a primary never leaves.
const RANK = { tertiary: 1, secondary: 2, title: 10, primary: 20 } as const;
const rank = (a: Action) => RANK[a.priority ?? 'secondary'];
let nextId = 1;

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
    const id = `nisli-toolbar-${nextId++}`;
    const titleEl = ref();
    const trigger = ref<HTMLElement>();
    const menu = ref<HTMLElement>();
    const open = signal(false);
    const actions = computed(() => [...(props.actions.value ?? [])]);

    const row = ctx.fitRow({
      gap: () => metrics.space[2],
      available: () => measure(host) - 2 * metrics.space[4],
      triggerWidth: () => (trigger.current ? measure(trigger.current as HTMLElement) : 0),
      items: () => {
        const buttons = [...host.querySelectorAll<HTMLElement>('[data-nisli-action]')];
        const titleWidth = titleEl.current ? measure(titleEl.current as HTMLElement) : 0;
        return [
          { id: 'title', width: titleWidth, minWidth: Math.min(titleWidth, metrics.layout.minTitle), priority: RANK.title },
          // A primary never leaves the row (ADR 0042): below the minimum row the plan reports FIT_ROW rather than hiding the verb.
          ...actions.value.map((a, i) => ({ id: a.id, width: buttons[i] ? measure(buttons[i]!) : 0, priority: rank(a), overflowable: a.priority !== 'primary' })),
        ];
      },
      deps: () => { actions.value; props.title.value; },
      report: { code: 'FIT_ROW', detail: () => `title "${props.title.value}" and its primary actions cannot fit` },
    });
    const overflowed = computed(() => (row.measuring.value ? [] : actions.value.filter((a) => row.decision(a.id)?.action === 'overflow')));

    // The menu is a popover layer: the engine closes it on Escape or an outside
    // pointer when it is the reachable layer, places it against the trigger,
    // and returns focus to the trigger on close — except when Tab left it.
    const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role=menuitem]:not([disabled])') ?? [])];
    let from: 'first' | 'last' = 'first';   // ArrowUp on the trigger opens on the last item (WAI-ARIA menu button)
    let leaving = false;                     // Tab left the menu: focus goes on past the trigger, not back to it
    const openMenu = (at: 'first' | 'last' = 'first') => { from = at; leaving = false; active.value = null; open.value = true; };
    const overlay = ctx.overlay({
      kind: 'popover',
      open,
      onDismiss: () => { open.value = false; },
      within: () => menu.current,
      anchor: () => trigger.current,
      align: 'trailing',
      size: () => ({ width: metrics.layout.menuWidth, height: metrics.control.height }),
      initialFocus: () => (from === 'last' ? items().at(-1) : items()[0]) ?? menu.current,
      restoreFocus: () => !leaving,
    });

    // Roving tabindex: one item is in the tab order; arrows move it with wrap, Home/End jump, Tab leaves and closes.
    const active = signal<string | null>(null);
    const focusItem = (item: HTMLElement | undefined) => { if (item) { active.value = item.getAttribute('data-nisli-item'); item.focus(); } };
    const onMenuKey = (ev: Event) => {
      const e = ev as KeyboardEvent;
      const list = items();
      const i = list.indexOf(document.activeElement as HTMLElement);
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); focusItem(list[(i + 1) % list.length]); break;
        case 'ArrowUp': e.preventDefault(); focusItem(list[(i - 1 + list.length) % list.length]); break;
        case 'Home': e.preventDefault(); focusItem(list[0]); break;
        case 'End': e.preventDefault(); focusItem(list[list.length - 1]); break;
        case 'Tab': {
          // Leave forwards (or backwards): to the tabbable after (before) the trigger, as if the menu were not there.
          e.preventDefault();
          leaving = true;
          open.value = false;
          const order = focusables(document.body).filter((c) => !menu.current?.contains(c));
          const at = trigger.current ? order.indexOf(trigger.current) : -1;
          (order[at + (e.shiftKey ? -1 : 1)] ?? trigger.current)?.focus();
          break;
        }
      }
    };
    const onTriggerKey = (ev: Event) => {
      const e = ev as KeyboardEvent;
      if (e.key === 'ArrowDown') { e.preventDefault(); openMenu('first'); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); openMenu('last'); }
    };

    return [
      el('h2', {
        ref: titleEl,
        style: ctx.part('text.title', () => {
          const d = row.decision('title');
          return { margin: 0, flex: 'none', font: 'inherit', ...truncate, width: !row.measuring.value && d?.action === 'shrink' ? d.width : 'auto' };
        }),
      }, props.title),
      el('div', { style: ctx.part([], () => ({ flex: '1 1 0', minWidth: 0 })) }),
      each(actions, (a) => a.id, (a) =>
        actionButton(ctx, () => a.value, {
          attrs: { 'data-nisli-action': computed(() => a.value.id) },
          structure: () => ({ display: row.gone(a.value.id) ? 'none' : 'inline-flex' }),
        }),
      ),
      el('button', {
        ref: trigger,
        id: `${id}-trigger`,
        type: 'button',
        'aria-label': 'More actions',
        'aria-haspopup': 'menu',
        'aria-controls': `${id}-menu`,
        'aria-expanded': computed(() => String(open.value)),
        style: ctx.part(['button', 'button.plain'], () => ({ ...buttonBox(), display: row.measuring.value || overflowed.value.length ? 'inline-flex' : 'none' })),
        on: { click: () => { if (open.value) open.value = false; else openMenu(); }, keydown: onTriggerKey },
      }, '⋯'),
      el('div', {
        ref: menu,
        id: `${id}-menu`,
        role: 'menu',
        'aria-labelledby': `${id}-trigger`,
        style: ctx.part(['surface.raised', 'menu'], () => ({
          display: open.value ? 'flex' : 'none',
          // Unseen until the engine has placed it: no first paint at the corner.
          visibility: overlay.placement.value ? 'visible' : 'hidden',
          flexDirection: 'column',
          position: 'fixed',
          top: overlay.placement.value?.top ?? 0,
          left: overlay.placement.value?.left ?? 0,
          minWidth: metrics.layout.menuWidth,
          padding: metrics.space[1],
          zIndex: overlay.z.value,
        })),
        on: { keydown: onMenuKey },
      }, [
        each(overflowed, (a) => a.id, (a) =>
          menuItem(ctx, () => a.value, {
            attrs: {
              'data-nisli-item': computed(() => a.value.id),
              tabindex: computed(() => ((active.value ?? overflowed.value[0]?.id) === a.value.id ? '0' : '-1')),
            },
            onActivate: (x) => { open.value = false; busy.run(x.id, x.onSelect); },
          }),
        ),
      ]),
    ];
  },
});
