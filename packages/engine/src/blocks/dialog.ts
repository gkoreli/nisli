import { component, el, computed, effect, onCleanup, onMount } from '@nisli/core';
import { metrics } from '../metrics.js';
import { css, apply, buttonStyle } from '../style.js';
import { look } from '../skin.js';
import { useViewportWidth } from '../engine/measure.js';
import { toList, type Children } from './types.js';

export interface DialogProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: Children;
}

/**
 * A modal. Centred with room; a full-height sheet on a phone. The engine
 * decides which from the viewport, locks scroll, traps Escape, restores focus.
 */
export const Dialog = component<DialogProps>('nisli-dialog', (props, host) => {
  const vw = useViewportWidth();
  const sheet = computed(() => vw.value > 0 && vw.value < metrics.layout.dialogMin);
  apply(host, { display: 'contents' });

  let previous: HTMLElement | null = null;
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && props.open.value) props.onClose.value(); };
  onMount(() => document.addEventListener('keydown', onKey));
  onCleanup(() => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; });

  const stop = effect(() => {
    if (props.open.value) {
      previous = document.activeElement as HTMLElement | null;
      document.body.style.overflow = 'hidden';
      queueMicrotask(() => host.querySelector<HTMLElement>('input, select, textarea, button:not([aria-label="Close"])')?.focus());
    } else {
      document.body.style.overflow = '';
      previous?.focus?.();
      previous = null;
    }
  });
  onCleanup(stop);

  return el('div', {
    role: 'presentation',
    style: computed(() => css({
      display: props.open.value ? 'flex' : 'none',
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      alignItems: sheet.value ? 'stretch' : 'center',
      justifyContent: 'center',
      padding: sheet.value ? 0 : metrics.space[4],
      ...look('overlay'),
    })),
    on: { click: (e) => { if (e.target === e.currentTarget) props.onClose.value(); } },
  }, [
    el('div', {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': props.title,
      style: computed(() => css({
        width: sheet.value ? '100%' : metrics.layout.dialogWidth,
        maxWidth: '100%',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        ...look('surface', 'dialog'),
        ...(sheet.value ? { borderRadius: 0 } : {}),
      })),
    }, [
      el('div', { style: computed(() => css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${metrics.space[3]}px ${metrics.space[4]}px`, ...look('divider') })) }, [
        el('h2', { style: computed(() => css({ margin: 0, font: 'inherit', ...look('text.title') })) }, props.title),
        el('button', { type: 'button', 'aria-label': 'Close', style: computed(() => css(buttonStyle('quiet'))), on: { click: () => props.onClose.value() } }, '✕'),
      ]),
      el('div', { style: css({ padding: metrics.space[4], overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: metrics.space[4] }) }, computed(() => toList(props.children.value))),
    ]),
  ]);
});
