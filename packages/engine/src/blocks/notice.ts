import { el, signal, each, computed } from '@nisli/core';
import { metrics } from '../metrics.js';
import { css } from '../style.js';
import { look } from '../skin.js';
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

function mountRegion(): void {
  if (region || typeof document === 'undefined') return;
  region = document.createElement('div');
  document.body.appendChild(region);
  el('div', {
    role: 'status',
    'aria-live': 'polite',
    style: css({
      position: 'fixed',
      left: metrics.space[4],
      right: metrics.space[4],
      bottom: metrics.space[4],
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: metrics.space[2],
      pointerEvents: 'none',
      zIndex: 200,
    }),
  }, [
    each(notices, (n) => n.id, (n) =>
      el('div', {
        style: computed(() => css({
          maxWidth: 420,
          padding: `${metrics.space[2]}px ${metrics.space[3]}px`,
          pointerEvents: 'auto',
          ...look('notice', ...(n.value.tone === 'neutral' ? [] : [`notice.${n.value.tone}` as const])),
        })),
        on: { click: () => { notices.value = notices.value.filter((x) => x.id !== n.value.id); } },
      }, computed(() => n.value.text)),
    ),
  ]).mount(region);
}

/** Test seam. */
export const __notices = notices;
