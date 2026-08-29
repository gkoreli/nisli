import { el, signal } from '@nisli/core';
import { metrics } from '../metrics.js';
import { css, buttonStyle } from '../style.js';
import { look } from '../skin.js';
import { Dialog } from './dialog.js';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
}

/** Ask before an action that cannot be undone. Resolves to the answer. */
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
    const tpl = el('div', { style: 'display:contents' }, [
      Dialog({
        title: options.title,
        open,
        onClose: () => finish(false),
        children: [
          el('p', { style: css({ margin: 0, ...look('text') }) }, options.message),
          el('div', { style: css({ display: 'flex', gap: metrics.space[2], justifyContent: 'flex-end' }) }, [
            el('button', { type: 'button', style: css(buttonStyle('plain')), on: { click: () => finish(false) } }, 'Cancel'),
            el('button', { type: 'button', style: css(buttonStyle(options.destructive ? 'danger' : 'primary')), on: { click: () => finish(true) } }, options.confirmLabel ?? 'Confirm'),
          ]),
        ],
      }),
    ]);
    tpl.mount(host);
  });
}
