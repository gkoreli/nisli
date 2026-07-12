/**
 * ui/toast.ts — Toaster + toast().
 *
 * shadcn/ui delegates toasts to the `sonner` npm package (MIT —
 * https://github.com/emilkowalski/sonner); there is no upstream .tsx to
 * port. This is an original zero-dependency implementation following
 * sonner's conventions — `toast()` API with success/error/warning/info,
 * auto-dismiss with pause-on-hover, a visible-toast limit, positioned
 * stack, `data-type`/`data-slot` styling hooks — sized for v1 (no swipe
 * dismissal, no promise toasts, no exit animations).
 *
 * Place `<ui-toaster>` once (per position) and call `toast(...)` from
 * anywhere:
 *
 * ```ts
 * import { Toaster, toast } from './toast.js';
 * toast.success('Saved', { description: 'Your changes are live.' });
 * ```
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  component,
  computed,
  each,
  effect,
  html,
  onCleanup,
  onMount,
  signal,
  type ReadonlySignal,
} from '@nisli/core';
import { cn, transparentHost } from '../lib/utils.js';

// ── Store (module-level, shared by toast() and <ui-toaster>) ─────────

export type ToastType = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  description?: string;
  /** ms before auto-dismiss; `Infinity` keeps the toast until dismissed. */
  duration?: number;
  type?: ToastType;
}

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  type: ToastType;
  duration: number;
}

const DEFAULT_DURATION = 4000;

let nextId = 0;
const items = signal<ToastItem[]>([]);

/** Read-only view of the active toasts (newest last). */
export const toasts: ReadonlySignal<ToastItem[]> = items;

function push(title: string, type: ToastType, options: ToastOptions = {}): number {
  const item: ToastItem = {
    id: ++nextId,
    title,
    description: options.description,
    type: options.type ?? type,
    duration: options.duration ?? DEFAULT_DURATION,
  };
  items.value = [...items.value, item];
  return item.id;
}

function baseToast(title: string, options?: ToastOptions): number {
  return push(title, 'default', options);
}

/** Show a toast. `toast.success(...)` etc. set the type. */
export const toast = Object.assign(baseToast, {
  success: (title: string, options?: ToastOptions) => push(title, 'success', options),
  error: (title: string, options?: ToastOptions) => push(title, 'error', options),
  warning: (title: string, options?: ToastOptions) => push(title, 'warning', options),
  info: (title: string, options?: ToastOptions) => push(title, 'info', options),
  dismiss(id?: number): void {
    items.value = id == null ? [] : items.value.filter((t) => t.id !== id);
  },
});

// ── <ui-toaster> — the rendered stack ─────────────────────────────────

export type ToasterPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

const positionClasses: Record<ToasterPosition, string> = {
  'top-left': 'top-4 left-4 items-start',
  'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
  'top-right': 'top-4 right-4 items-end',
  'bottom-left': 'bottom-4 left-4 items-start',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
  'bottom-right': 'bottom-4 right-4 items-end',
};

const toastClasses =
  'pointer-events-auto flex w-[356px] max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-lg border bg-popover p-4 text-sm text-popover-foreground shadow-lg data-[type=error]:border-destructive/50 data-[type=error]:text-destructive data-[type=success]:border-border';

export type ToasterProps = {
  position?: ToasterPosition;
  /** Max simultaneously visible toasts (oldest hidden first). Default 3. */
  visibleToasts?: number;
  className?: string;
};

export const Toaster = component<ToasterProps>('ui-toaster', (props, host) => {
  transparentHost(host);

  // ADR 0025 item 3: attribute fallbacks declared via the `attrs` option below
  // and delivered as plain, LIVE prop signals — no userland attr()/boolAttr().
  const position = computed<ToasterPosition>(() =>
    props.position.value && props.position.value in positionClasses
      ? (props.position.value as ToasterPosition)
      : 'bottom-right',
  );
  const className = props.className;
  const limit = computed(() => props.visibleToasts.value ?? 3);
  const visible = computed(() => items.value.slice(-limit.value));

  // Auto-dismiss timers, paused while the pointer is over the region.
  const hovered = signal(false);
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  const disposeTimers = (): void => {
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
  };
  onCleanup(disposeTimers);

  // Escape dismisses the newest toast while leaving focus where the user put
  // it. The listener is scoped to the connected toaster rather than installed
  // permanently by the module-level store.
  onMount(() => {
    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const newest = items.value.at(-1);
      if (!newest) return;
      event.preventDefault();
      toast.dismiss(newest.id);
    };
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  });

  const schedule = (item: ToastItem): void => {
    if (timers.has(item.id) || item.duration === Infinity || hovered.value) return;
    timers.set(
      item.id,
      setTimeout(() => {
        timers.delete(item.id);
        toast.dismiss(item.id);
      }, item.duration),
    );
  };

  // Timer wiring is a side effect — auto-disposed with the component.
  effect(() => {
    if (hovered.value) {
      disposeTimers();
    } else {
      for (const item of items.value) schedule(item);
    }
  });

  const classes = computed(() =>
    cn(
      'pointer-events-none fixed z-[100] flex flex-col gap-2',
      positionClasses[position.value],
      className.value,
    ),
  );

  return html`<ol
    data-slot="toaster"
    data-position="${position}"
    class="${classes}"
    @pointerenter=${() => { hovered.value = true; }}
    @pointerleave=${() => { hovered.value = false; }}
  >${each(
    visible,
    (item) => item.id,
    (t) => {
      return html`<li
        data-slot="toast"
        data-type="${computed(() => t.value.type)}"
        role="${computed(() => (t.value.type === 'error' ? 'alert' : 'status'))}"
        class="${toastClasses}"
        @click=${() => toast.dismiss(t.value.id)}
      >
        <div data-slot="toast-title" class="font-medium">${computed(() => t.value.title)}</div>
        ${computed(() =>
          t.value.description
            ? html`<div data-slot="toast-description" class="text-muted-foreground">${t.value.description}</div>`
            : null,
        )}
      </li>`;
    },
  )}</ol>`;
}, {
  // ADR 0025 item 3: opt-in attribute reactivity. Kebab-case attr
  // names (className → class-name).
  attrs: {
    position: 'string',
    visibleToasts: 'number',
    className: 'string',
  },
});
