import { el, signal } from '@nisli/core';
import { buttonBox } from '../style.js';
import { block } from './kernel.js';
import { Dialog } from './dialog.js';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
}

interface ConfirmBodyProps {
  message: string;
  confirmLabel: string;
  destructive: boolean;
  onAnswer: (answer: boolean) => void;
}

/** The question and its two answers; a block so it is styled only through `ctx.part()`. */
const ConfirmBody = block<ConfirmBodyProps>('nisli-confirm', {
  host: () => ({ display: 'contents' }),
  render: (props, ctx) => [
    el('p', { style: ctx.part('text', { margin: 0 }) }, props.message),
    el('div', { style: ctx.part([], { display: 'flex', gap: ctx.metrics.space[2], justifyContent: 'flex-end' }) }, [
      el('button', { type: 'button', style: ctx.part(['button', 'button.plain'], buttonBox()), on: { click: () => props.onAnswer.value(false) } }, 'Cancel'),
      el('button', {
        type: 'button',
        style: ctx.part(() => ['button', props.destructive.value ? 'button.danger' : 'button.primary'], buttonBox()),
        on: { click: () => props.onAnswer.value(true) },
      }, props.confirmLabel),
    ]),
  ],
});

/**
 * Ask before an action that cannot be undone. Resolves to the answer. A
 * Dialog mounted at the body, so it is a modal layer of the overlay stack:
 * above whatever is open (a dialog, its menu), one Escape answers it alone,
 * and focus returns to the control that invoked it.
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const open = signal(true);
    const host = document.createElement('div');
    document.body.appendChild(host);
    let done = false;
    const finish = (answer: boolean) => {
      if (done) return;
      done = true;
      open.value = false;
      setTimeout(() => { tpl.dispose(); host.remove(); }, 0);
      resolve(answer);
    };
    const tpl = el('div', {}, [
      Dialog({
        title: options.title,
        open,
        onClose: () => finish(false),
        children: [
          ConfirmBody({ message: options.message, confirmLabel: options.confirmLabel ?? 'Confirm', destructive: options.destructive ?? false, onAnswer: finish }),
        ],
      }),
    ]);
    tpl.mount(host);
  });
}
