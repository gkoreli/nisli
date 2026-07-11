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
 * The `<ui-avatar>` publishes its status on `host.__uiAvatar`; the image and
 * fallback locate it with `host.closest('ui-avatar')` (setup-boundary error if
 * used outside one). The image is hidden until it loads; the fallback is shown
 * whenever the status is not `loaded`.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  component,
  computed,
  html,
  onMount,
  ref,
  signal,
  type ReadonlySignal,
  type TemplateResult,
} from '@nisli/core';
import {
  attr,
  captureChildren,
  cn,
  projectChildren,
  transparentHost,
} from '../lib/utils.js';

export type AvatarStatus = 'idle' | 'loaded' | 'error';

export interface AvatarState {
  status: ReadonlySignal<AvatarStatus>;
  setStatus(status: AvatarStatus): void;
}

type AvatarHost = HTMLElement & { __uiAvatar?: AvatarState };

function useAvatarState(host: HTMLElement, tag: string): AvatarState {
  const parent = host.closest('ui-avatar') as AvatarHost | null;
  const state = parent?.__uiAvatar;
  if (!state) {
    throw new Error(`<${tag}> must be used inside <ui-avatar>.`);
  }
  return state;
}

// ── ui-avatar (root, owns loading status) ───────────────────────────

export type AvatarSize = 'default' | 'sm' | 'lg';

export type AvatarProps = {
  size?: AvatarSize;
  className?: string;
  children?: string | TemplateResult;
};

export const Avatar = component<AvatarProps>('ui-avatar', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);

  const size = attr(props.size, host, 'size');
  const className = attr(props.className, host, 'class-name');

  const status = signal<AvatarStatus>('idle');
  const state: AvatarState = {
    status,
    setStatus: (s) => {
      status.value = s;
    },
  };
  (host as AvatarHost).__uiAvatar = state;

  const classes = computed(() =>
    cn(
      'group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6',
      className.value,
    ),
  );

  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<div
    ref="${root}"
    data-slot="avatar"
    data-size="${computed(() => size.value ?? 'default')}"
    class="${classes}"
  >${props.children}</div>`;
});

// ── ui-avatar-image ─────────────────────────────────────────────────

export type AvatarImageProps = {
  src?: string;
  alt?: string;
  className?: string;
};

export const AvatarImage = component<AvatarImageProps>('ui-avatar-image', (props, host) => {
  const state = useAvatarState(host, 'ui-avatar-image');
  transparentHost(host);

  const src = attr(props.src, host, 'src');
  const alt = attr(props.alt, host, 'alt');
  const className = attr(props.className, host, 'class-name');
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
});

// ── ui-avatar-fallback ──────────────────────────────────────────────

export type AvatarFallbackProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const AvatarFallback = component<AvatarFallbackProps>(
  'ui-avatar-fallback',
  (props, host) => {
    const state = useAvatarState(host, 'ui-avatar-fallback');
    transparentHost(host);
    const projected = captureChildren(host);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        'flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs',
        className.value,
      ),
    );

    // Shown whenever the image has not loaded.
    const hidden = computed(() => state.status.value === 'loaded');

    const root = ref<HTMLSpanElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<span
      ref="${root}"
      data-slot="avatar-fallback"
      class="${classes}"
      hidden="${hidden}"
    >${props.children}</span>`;
  },
);
