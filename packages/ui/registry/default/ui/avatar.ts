/**
 * ui/avatar.ts — Avatar, AvatarImage, AvatarFallback.
 *
 * Ported from new-york-v4/ui/avatar.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui)
 * and the Radix Avatar behavior it wraps (MIT), rebuilt as Nisli custom
 * elements. Radix tracks the image's loading status (idle → loaded / error)
 * to decide whether to show the image or the fallback; we do the same with a
 * shared signal driven by the real `<img>`'s native `load`/`error` events —
 * no timers, no `delayMs`.
 *
 * ```
 * <ui-avatar>
 *   <ui-avatar-image src="/me.jpg" alt="Me"></ui-avatar-image>
 *   <ui-avatar-fallback>ME</ui-avatar-fallback>
 * </ui-avatar>
 * ```
 *
 * The `<ui-avatar>` publishes its status via a subtree-scoped context
 * (`AvatarContext`); the image and fallback resolve it with
 * `AvatarContext.inject()` (setup-boundary error if used outside one). The
 * image is hidden until it loads; the fallback is shown
 * whenever the status is not `loaded`.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  children,
  component,
  createContext,
  computed,
  html,
  onMount,
  ref,
  signal,
  type ReadonlySignal,
  type TemplateResult,
} from '@nisli/core';
import { cn, transparentHost } from '../lib/utils.js';

export type AvatarStatus = 'idle' | 'loaded' | 'error';

export interface AvatarState {
  status: ReadonlySignal<AvatarStatus>;
  setStatus(status: AvatarStatus): void;
}

/** Subtree-scoped channel from the Avatar provider to its parts. */
const AvatarContext = createContext<AvatarState>('Avatar', { providerTag: 'ui-avatar' });

// ── ui-avatar (root, owns loading status) ───────────────────────────

export type AvatarSize = 'default' | 'sm' | 'lg';

export type AvatarProps = {
  size?: AvatarSize;
  className?: string;
  children?: string | TemplateResult;
};

export const Avatar = component<AvatarProps>('ui-avatar', (props, host) => {
  transparentHost(host);

  const size = props.size;
  const className = props.className;

  const status = signal<AvatarStatus>('idle');
  const state: AvatarState = {
    status,
    setStatus: (s) => {
      status.value = s;
    },
  };
  AvatarContext.provide(host, state);

  const classes = computed(() =>
    cn(
      'group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6',
      className.value,
    ),
  );

  return html`<div
    data-slot="avatar"
    data-size="${computed(() => size.value ?? 'default')}"
    class="${classes}"
  >${children()}</div>`;
}, {
  attrs: {
    size: 'string',
    className: 'string',
  },
});

// ── ui-avatar-image ─────────────────────────────────────────────────

export type AvatarImageProps = {
  src?: string;
  alt?: string;
  className?: string;
};

export const AvatarImage = component<AvatarImageProps>('ui-avatar-image', (props, host) => {
  const state = AvatarContext.inject();
  transparentHost(host);

  const src = props.src;
  const alt = props.alt;
  const className = props.className;
  const classes = computed(() => cn('aspect-square size-full', className.value));

  // Hidden until the image has actually loaded (avoids a broken/blank flash;
  // a hidden <img> still fetches, so `load` fires).
  const hidden = computed(() => state.status.value !== 'loaded');

  const root = ref<HTMLImageElement>();
  onMount(() => {
    const img = root.current;
    if (img && img.complete && img.naturalWidth > 0) state.setStatus('loaded');
  });

  return html`<img
    ref="${root}"
    data-slot="avatar-image"
    class="${classes}"
    src="${src}"
    alt="${computed(() => alt.value ?? '')}"
    hidden="${hidden}"
    @load=${() => state.setStatus('loaded')}
    @error=${() => state.setStatus('error')}
  />`;
}, {
  attrs: {
    src: 'string',
    alt: 'string',
    className: 'string',
  },
});

// ── ui-avatar-fallback ──────────────────────────────────────────────

export type AvatarFallbackProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const AvatarFallback = component<AvatarFallbackProps>(
  'ui-avatar-fallback',
  (props, host) => {
    const state = AvatarContext.inject();
    transparentHost(host);

    const className = props.className;
    const classes = computed(() =>
      cn(
        'flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs',
        className.value,
      ),
    );

    // Shown whenever the image has not loaded.
    const hidden = computed(() => state.status.value === 'loaded');

    return html`<span
      data-slot="avatar-fallback"
      class="${classes}"
      hidden="${hidden}"
    >${children()}</span>`;
  },
  {
    attrs: {
      className: 'string',
    },
  },
);
