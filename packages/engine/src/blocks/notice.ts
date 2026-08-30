import { el, signal, each, computed } from '@nisli/core';
import { buttonBox } from '../style.js';
import { block } from './kernel.js';
import type { Tone } from './types.js';

interface Notice { id: number; text: string; tone: Tone }
const notices = signal<Notice[]>([]);
let nextId = 1;
let region: HTMLElement | null = null;

/** How long a notice stands, by tone: a failure longer. */
const durationOf = (tone: Tone): number => (tone === 'negative' ? 8000 : 4000);
/** The live tone: a failure interrupts (`alert`, assertive); everything else waits its turn (`status`, polite). */
const isAssertive = (tone: Tone): boolean => tone === 'negative';

/** The spoken name of a notice, by tone: a person hears a word, not the engine's vocabulary. */
const nameOf = (tone: Tone): string => ({ negative: 'Error', positive: 'Success', warning: 'Warning', neutral: 'Note' })[tone];

/**
 * Where focus came from, per focused notice: recorded on the notice's own
 * `focusin` (the `relatedTarget`), so a keyboard Dismiss or Escape sends focus
 * back there — never to `<body>`, which would restart Tab from the top of the
 * document (WCAG 2.4.3). When that element is gone, the nearest surface a
 * reader is in: the open dialog, else the main landmark.
 */
interface Origin { el: HTMLElement; from: HTMLElement | null }
const origins = new Map<number, Origin>();
const usable = (n: Element | null | undefined): n is HTMLElement => !!n && n.isConnected && !n.closest('[inert]') && !(n as HTMLElement).hidden;
function returnTarget(o: Origin): HTMLElement | null {
  if (usable(o.from) && !o.el.contains(o.from)) return o.from;
  const surfaces = [...document.querySelectorAll<HTMLElement>('[role=dialog], main, [role=main]')].filter((s) => usable(s) && !region?.contains(s));
  const back = surfaces.find((s) => s.getAttribute('role') === 'dialog') ?? surfaces[0] ?? null;
  if (back && !back.hasAttribute('tabindex')) back.setAttribute('tabindex', '-1');
  return back;
}

const dismiss = (id: number): void => {
  timers.get(id)?.stop(); timers.delete(id);
  const o = origins.get(id); origins.delete(id);
  const back = o && o.el.contains(document.activeElement) ? returnTarget(o) : null;
  notices.value = notices.value.filter((n) => n.id !== id);
  back?.focus();
};

/**
 * A resumable countdown per notice (WCAG 2.2.1): paused while a pointer or
 * focus is on the notice, resumed with the remaining time, never restarted.
 */
interface Countdown { pause(): void; resume(): void; stop(): void }
const timers = new Map<number, Countdown>();
function countdown(id: number, total: number): Countdown {
  let remaining = total;
  let since = 0;
  let handle: ReturnType<typeof setTimeout> | null = null;
  let holds = 0;
  const start = () => { since = Date.now(); handle = setTimeout(() => { handle = null; dismiss(id); }, remaining); };
  const stop = () => { if (handle !== null) { clearTimeout(handle); handle = null; } };
  const c: Countdown = {
    pause: () => { if (holds++ === 0 && handle !== null) { stop(); remaining = Math.max(0, remaining - (Date.now() - since)); } },
    resume: () => { if (holds > 0 && --holds === 0 && handle === null && timers.has(id)) start(); },
    stop,
  };
  timers.set(id, c);
  start();
  return c;
}

/** Tell the person something happened. The engine places, announces and times it. */
export function notify(text: string, tone: Tone = 'neutral'): void {
  const id = nextId++;
  notices.value = [...notices.value, { id, text, tone }];
  countdown(id, durationOf(tone));
  mountRegion();
}

/**
 * The live regions, fixed to the page's bottom corner; one box per document,
 * holding a polite `status` container and an assertive `alert` container —
 * both there before any notice arrives, so an announcement is never missed.
 * A notice mounts into the one its tone maps to. The box is a passive layer
 * while it shows something: on the overlay stack for its z-order (above every
 * modal), never focused by the engine, never made inert by a modal, and
 * transparent to Escape and outside pointers — Escape on a focused notice is
 * handled by the notice itself and `preventDefault`ed, so the manager never
 * sees it; clicking a notice over a dialog dismisses the notice, not the dialog.
 * Defined on first use: the kernel reaches this module (busy → notify), so
 * `block` is not yet bound while the modules load.
 */
let NoticeRegion: ReturnType<typeof defineRegion> | undefined;
const defineRegion = () => block<Record<never, never>>('nisli-notices', {
  host: () => ({ display: 'contents' }),
  render: (_props, ctx) => {
    const { metrics } = ctx;
    const overlay = ctx.overlay({ kind: 'passive', open: computed(() => notices.value.length > 0), onDismiss: () => {} });
    const polite = computed(() => notices.value.filter((n) => !isAssertive(n.tone)));
    const assertive = computed(() => notices.value.filter((n) => isAssertive(n.tone)));

    const notice = (n: { value: Notice }) =>
      el('div', {
        role: 'group',
        'aria-label': computed(() => nameOf(n.value.tone)),
        // A test seam in the family of data-nisli-report: the tone this notice was told, for the LIVE_TONE claim.
        'data-nisli-tone': computed(() => n.value.tone),
        style: ctx.part(
          () => ['notice', ...(n.value.tone === 'neutral' ? [] : [`notice.${n.value.tone}` as const])],
          { maxWidth: 420, padding: `${metrics.space[2]}px ${metrics.space[3]}px`, pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: metrics.space[3] },
        ),
        on: {
          keydown: ((e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); dismiss(n.value.id); } }) as EventListener,
          pointerenter: () => timers.get(n.value.id)?.pause(),
          pointerleave: () => timers.get(n.value.id)?.resume(),
          focusin: ((e: FocusEvent) => {
            const me = e.currentTarget as HTMLElement;
            const from = e.relatedTarget as HTMLElement | null;
            if (!origins.has(n.value.id) || (from && !me.contains(from))) origins.set(n.value.id, { el: me, from: from && !me.contains(from) ? from : (origins.get(n.value.id)?.from ?? null) });
            timers.get(n.value.id)?.pause();
          }) as EventListener,
          focusout: () => timers.get(n.value.id)?.resume(),
        },
      }, [
        el('span', { style: ctx.part([], { flex: '1 1 auto', minWidth: 0 }) }, computed(() => n.value.text)),
        el('button', {
          type: 'button',
          'aria-label': 'Dismiss',
          style: ctx.part([], { ...buttonBox(), padding: `0 ${metrics.space[2]}px`, height: metrics.control.height - metrics.space[2] }),
          on: { click: () => dismiss(n.value.id) },
        }, '×'),
      ]);

    const container = (list: typeof polite, live: 'polite' | 'assertive') =>
      el('div', {
        role: live === 'polite' ? 'status' : 'alert',
        'aria-live': live,
        style: ctx.part([], { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: metrics.space[2] }),
      }, [each(list, (n) => n.id, notice)]);

    return el('div', {
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
    }, [container(polite, 'polite'), container(assertive, 'assertive')]);
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
