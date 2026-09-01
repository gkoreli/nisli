import { el, signal, computed } from '@nisli/core';
import { block } from './kernel.js';
import { Dialog } from './dialog.js';
import { actionRow } from './actions.js';
import type { Action } from './types.js';

export interface ConfirmOptions {
  /** The question. */
  title: string;
  /** What answering yes does, in prose. */
  text: string;
  /** The affirmative answer: its label, and whether it cannot be undone. The engine makes it the row's primary. */
  action: Pick<Action, 'label' | 'destructive'>;
}

interface ConfirmBodyProps {
  text: string;
  action: Pick<Action, 'label' | 'destructive'>;
  onAnswer: (answer: boolean) => void;
}

/** The question and its two answers; a block so it is styled only through `ctx.part()`. */
const ConfirmBody = block<ConfirmBodyProps>('nisli-confirm', {
  host: () => ({ display: 'contents' }),
  render: (props, ctx) => [
    el('p', { style: ctx.part('text', () => ({ margin: 0 })) }, props.text),
    actionRow(ctx, computed<readonly Action[]>(() => [
      { id: 'cancel', label: 'Cancel', onSelect: () => props.onAnswer.value(false) },
      // The person came for the answer: it is the primary (filled), or danger when it cannot be undone.
      { id: 'confirm', label: props.action.value.label, destructive: props.action.value.destructive, priority: 'primary', onSelect: () => props.onAnswer.value(true) },
    ])),
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
        children: [ConfirmBody({ text: options.text, action: options.action, onAnswer: finish })],
      }),
    ]);
    tpl.mount(host);
  });
}
