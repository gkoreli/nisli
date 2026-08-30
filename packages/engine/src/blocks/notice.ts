import { el, signal, each, computed } from '@nisli/core';
import { block } from './kernel.js';
import type { Tone } from './types.js';

interface Notice { id: number; text: string; tone: Tone }
const notices = signal<Notice[]>([]);
let nextId = 1;
let region: HTMLElement | null = null;

/** Tell the person something happened. The engine places and times it. */
export function notify(text: string, tone: Tone = 'neutral'): void {
  const id = nextId++;
  notices.value = [...notices.value, { id, text, tone }];
  setTimeout(() => { notices.value = notices.value.filter((n) => n.id !== id); }, tone === 'negative' ? 8000 : 4000);
  mountRegion();
}

/**
 * The live region, fixed to the page's bottom corner; one per document. It is
 * a passive layer while it shows something: on the overlay stack for its
 * z-order (above every modal), never focused, never made inert by a modal,
 * and transparent to Escape and outside pointers — clicking a notice over a
 * dialog dismisses the notice, not the dialog.
 * Defined on first use: the kernel reaches this module (busy → notify), so
 * `block` is not yet bound while the modules load.
 */
let NoticeRegion: ReturnType<typeof defineRegion> | undefined;
const defineRegion = () => block<Record<never, never>>('nisli-notices', {
  host: () => ({ display: 'contents' }),
  render: (_props, ctx) => {
    const { metrics } = ctx;
    const overlay = ctx.overlay({ kind: 'passive', open: computed(() => notices.value.length > 0), onDismiss: () => {} });
    return el('div', {
      role: 'status',
      'aria-live': 'polite',
      style: ctx.part([], () => ({
        position: 'fixed',
        left: metrics.space[4],
        right: metrics.space[4],
        bottom: metrics.space[4],
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: metrics.space[2],
        pointerEvents: 'none',
        zIndex: overlay.z.value,
      })),
    }, [
      each(notices, (n) => n.id, (n) =>
        el('div', {
          style: ctx.part(
            () => ['notice', ...(n.value.tone === 'neutral' ? [] : [`notice.${n.value.tone}` as const])],
            { maxWidth: 420, padding: `${metrics.space[2]}px ${metrics.space[3]}px`, pointerEvents: 'auto' },
          ),
          on: { click: () => { notices.value = notices.value.filter((x) => x.id !== n.value.id); } },
        }, computed(() => n.value.text)),
      ),
    ]);
  },
});

function mountRegion(): void {
  if (region?.isConnected || typeof document === 'undefined') return;
  region = document.createElement('div');
  document.body.appendChild(region);
  NoticeRegion ??= defineRegion();
  el('div', {}, [NoticeRegion({})]).mount(region);
}

/** Test seam. */
export const __notices = notices;
