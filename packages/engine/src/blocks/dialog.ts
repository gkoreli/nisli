import { el, computed, effect, onCleanup, onMount } from '@nisli/core';
import { buttonBox } from '../style.js';
import { dialogMode } from '../engine/space.js';
import { block, lockScroll } from './kernel.js';
import { toList, type Children } from './types.js';

export interface DialogProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: Children;
}

/**
 * A modal. Centred with room; a full-height sheet on a phone. The engine
 * decides which from the viewport (`dialogMode`), locks scroll, traps Escape,
 * restores focus.
 */
export const Dialog = block<DialogProps>('nisli-dialog', {
  measure: 'viewport',
  host: () => ({ display: 'contents' }),
  render: (props, ctx) => {
    const { host, metrics } = ctx;
    const sheet = computed(() => dialogMode(ctx.width.value, metrics.layout) === 'sheet');
    const open = computed(() => props.open.value);

    lockScroll(open);

    let previous: HTMLElement | null = null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && props.open.value) props.onClose.value(); };
    onMount(() => document.addEventListener('keydown', onKey));
    onCleanup(() => document.removeEventListener('keydown', onKey));

    const stop = effect(() => {
      if (open.value) {
        previous = document.activeElement as HTMLElement | null;
        queueMicrotask(() => host.querySelector<HTMLElement>('input, select, textarea, button:not([aria-label="Close"])')?.focus());
      } else {
        previous?.focus?.();
        previous = null;
      }
    });
    onCleanup(stop);

    return el('div', {
      role: 'presentation',
      style: ctx.part('overlay', () => ({
        display: open.value ? 'flex' : 'none',
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        alignItems: sheet.value ? 'stretch' : 'center',
        justifyContent: 'center',
        padding: sheet.value ? 0 : metrics.space[4],
      })),
      on: { click: (e) => { if (e.target === e.currentTarget) props.onClose.value(); } },
    }, [
      el('div', {
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': props.title,
        style: ctx.part(['surface', 'dialog'], () => ({
          width: sheet.value ? '100%' : metrics.layout.dialogWidth,
          maxWidth: '100%',
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          ...(sheet.value ? { borderRadius: 0 } : {}),
        })),
      }, [
        el('div', { style: ctx.part('divider', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${metrics.space[3]}px ${metrics.space[4]}px` }) }, [
          el('h2', { style: ctx.part('text.title', { margin: 0, font: 'inherit' }) }, props.title),
          el('button', { type: 'button', 'aria-label': 'Close', style: ctx.part(['button', 'button.quiet'], buttonBox()), on: { click: () => props.onClose.value() } }, '✕'),
        ]),
        el('div', { style: ctx.part([], { padding: metrics.space[4], overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: metrics.space[4] }) }, computed(() => toList(props.children.value))),
      ]),
    ]);
  },
});
