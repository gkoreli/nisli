/**
 * ui/empty.ts — Empty and its parts.
 *
 * Ported from new-york-v4/ui/empty.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui)
 * as Nisli custom elements: a centered empty-state block with a header
 * (media + title + description) and a content region. Class lists and
 * data-slots match the v4 source; presentation only, no behavior.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  component,
  computed,
  html,
  onMount,
  ref,
  type TemplateResult,
} from '@nisli/core';
import {
  attr,
  captureChildren,
  cn,
  cv,
  projectChildren,
  transparentHost,
} from '../lib/utils.js';

export type EmptyPartProps = {
  className?: string;
  children?: string | TemplateResult;
};

/** A single-root projected `<div>` part carrying `data-slot` + base classes. */
function emptyPart(tag: string, slot: string, base: string) {
  return component<EmptyPartProps>(tag, (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(base, className.value));
    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<div ref="${root}" data-slot="${slot}" class="${classes}">${props.children}</div>`;
  });
}

export const Empty = emptyPart(
  'ui-empty',
  'empty',
  'flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12',
);

export const EmptyHeader = emptyPart(
  'ui-empty-header',
  'empty-header',
  'flex max-w-sm flex-col items-center gap-2 text-center',
);

export const EmptyTitle = emptyPart(
  'ui-empty-title',
  'empty-title',
  'text-lg font-medium tracking-tight',
);

export const EmptyDescription = emptyPart(
  'ui-empty-description',
  'empty-description',
  'text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary',
);

export const EmptyContent = emptyPart(
  'ui-empty-content',
  'empty-content',
  'flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance',
);

// ── ui-empty-media (variant) ─────────────────────────────────────────

export const emptyMediaVariants = cv(
  'mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        icon: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type EmptyMediaVariant = 'default' | 'icon';

export type EmptyMediaProps = {
  variant?: EmptyMediaVariant;
  className?: string;
  children?: string | TemplateResult;
};

export const EmptyMedia = component<EmptyMediaProps>('ui-empty-media', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);
  const variant = attr(props.variant, host, 'variant');
  const className = attr(props.className, host, 'class-name');
  const classes = computed(() =>
    cn(emptyMediaVariants({ variant: variant.value }), className.value),
  );
  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });
  return html`<div
    ref="${root}"
    data-slot="empty-icon"
    data-variant="${computed(() => variant.value ?? 'default')}"
    class="${classes}"
  >${props.children}</div>`;
});
