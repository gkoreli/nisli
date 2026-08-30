import { el, computed, ref } from '@nisli/core';
import { buttonBox } from '../style.js';
import { dialogMode } from '../engine/space.js';
import { block, focusables } from './kernel.js';
import { actionRow } from './actions.js';
import { toList, type Action, type Children } from './types.js';

export interface DialogProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: Children;
  /** What a person may do from the dialog, after its content. The row wraps; it never overflows — the dialog is already the focused layer. */
  actions?: readonly Action[];
}

let nextId = 1;

/**
 * A modal. Centred with room; a full-height sheet on a phone. The engine
 * decides which from the viewport (`dialogMode`); as a modal layer
 * (`ctx.overlay`) it locks scroll, traps focus, closes on Escape or a pointer
 * outside it — only when it is the top layer — and restores focus on close.
 */
export const Dialog = block<DialogProps>('nisli-dialog', {
  measure: 'viewport',
  host: () => ({ display: 'contents' }),
  render: (props, ctx) => {
    const { metrics } = ctx;
    const id = `nisli-dialog-${nextId++}`;
    const surface = ref<HTMLElement>();
    const sheet = computed(() => dialogMode(ctx.width.value, metrics.layout) === 'sheet');
    const open = computed(() => props.open.value);
    const actions = computed(() => [...(props.actions.value ?? [])]);

    const overlay = ctx.overlay({
      kind: 'modal',
      open,
      onDismiss: () => props.onClose.value(),
      within: () => surface.current,
      // The first visible, enabled control of the body, never the Close button; the surface itself when there is none.
      initialFocus: () => (surface.current ? focusables(surface.current).find((c) => c.getAttribute('aria-label') !== 'Close') : null) ?? surface.current,
    });

    return el('div', {
      role: 'presentation',
      style: ctx.part('overlay', () => ({
        display: open.value ? 'flex' : 'none',
        position: 'fixed',
        inset: 0,
        zIndex: overlay.z.value,
        alignItems: sheet.value ? 'stretch' : 'center',
        justifyContent: 'center',
        padding: sheet.value ? 0 : metrics.space[4],
      })),
    }, [
      el('div', {
        ref: surface,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': `${id}-title`,
        tabindex: '-1',
        style: ctx.part(['surface', 'dialog'], () => ({
          width: sheet.value ? '100%' : metrics.layout.dialogWidth,
          maxWidth: '100%',
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          outline: 'none',
          ...(sheet.value ? { borderRadius: 0 } : {}),
        })),
      }, [
        el('div', { style: ctx.part('divider', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${metrics.space[3]}px ${metrics.space[4]}px` }) }, [
          el('h2', { id: `${id}-title`, style: ctx.part('text.title', { margin: 0, font: 'inherit' }) }, props.title),
          el('button', { type: 'button', 'aria-label': 'Close', style: ctx.part(['button', 'button.quiet'], buttonBox()), on: { click: () => props.onClose.value() } }, '✕'),
        ]),
        el('div', { style: ctx.part([], { padding: metrics.space[4], overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: metrics.space[4] }) }, [
          computed(() => toList(props.children.value)),
          // In the body's flow after the content — where a fieldless Form's row sat; a footer's rule for danger.
          actionRow(ctx, actions, { apart: true }),
        ]),
      ]),
    ]);
  },
});
