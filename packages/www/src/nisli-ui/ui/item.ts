/**
 * ui/item.ts — Item and its parts.
 *
 * Ported from new-york-v4/ui/item.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui)
 * as Nisli custom elements: a flexible list row with media, content
 * (title/description), actions, and header/footer, plus a grouping wrapper and
 * a separator. Class lists, variant maps, and data-slots match the v4 source;
 * presentation only, no behavior.
 *
 * ItemSeparator reproduces a horizontal separator inline (rather than
 * depending on ui-separator) so it can carry `data-slot="item-separator"`,
 * matching upstream's slot contract.
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

export type ItemPartProps = {
  className?: string;
  children?: string | TemplateResult;
};

/** A single-root projected `<div>` part carrying `data-slot` + base classes. */
function itemPart(tag: string, slot: string, base: string, role?: string) {
  return component<ItemPartProps>(tag, (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(base, className.value));
    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<div
      ref="${root}"
      data-slot="${slot}"
      role="${role}"
      class="${classes}"
    >${props.children}</div>`;
  });
}

// ── ui-item-group / -separator ───────────────────────────────────────

export const ItemGroup = itemPart(
  'ui-item-group',
  'item-group',
  'group/item-group flex flex-col',
  'list',
);

export const ItemSeparator = component<ItemPartProps>('ui-item-separator', (props, host) => {
  transparentHost(host);
  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn('h-px w-full shrink-0 bg-border my-0', className.value));
  return html`<div
    data-slot="item-separator"
    role="none"
    data-orientation="horizontal"
    class="${classes}"
  ></div>`;
});

// ── ui-item (variant + size) ─────────────────────────────────────────

export const itemVariants = cv(
  'group/item flex flex-wrap items-center rounded-md border border-transparent text-sm transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-accent/50',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: 'border-border',
        muted: 'bg-muted/50',
      },
      size: {
        default: 'gap-4 p-4',
        sm: 'gap-2.5 px-4 py-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ItemVariant = 'default' | 'outline' | 'muted';
export type ItemSize = 'default' | 'sm';

export type ItemProps = {
  variant?: ItemVariant;
  size?: ItemSize;
  className?: string;
  children?: string | TemplateResult;
};

export const Item = component<ItemProps>('ui-item', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);
  const variant = attr(props.variant, host, 'variant');
  const size = attr(props.size, host, 'size');
  const className = attr(props.className, host, 'class-name');
  const classes = computed(() =>
    cn(itemVariants({ variant: variant.value, size: size.value }), className.value),
  );
  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });
  return html`<div
    ref="${root}"
    data-slot="item"
    data-variant="${computed(() => variant.value ?? 'default')}"
    data-size="${computed(() => size.value ?? 'default')}"
    class="${classes}"
  >${props.children}</div>`;
});

// ── ui-item-media (variant) ──────────────────────────────────────────

export const itemMediaVariants = cv(
  'flex shrink-0 items-center justify-center gap-2 group-has-[[data-slot=item-description]]/item:translate-y-0.5 group-has-[[data-slot=item-description]]/item:self-start [&_svg]:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        icon: "size-8 rounded-sm border bg-muted [&_svg:not([class*='size-'])]:size-4",
        image: 'size-10 overflow-hidden rounded-sm [&_img]:size-full [&_img]:object-cover',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type ItemMediaVariant = 'default' | 'icon' | 'image';

export type ItemMediaProps = {
  variant?: ItemMediaVariant;
  className?: string;
  children?: string | TemplateResult;
};

export const ItemMedia = component<ItemMediaProps>('ui-item-media', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);
  const variant = attr(props.variant, host, 'variant');
  const className = attr(props.className, host, 'class-name');
  const classes = computed(() =>
    cn(itemMediaVariants({ variant: variant.value }), className.value),
  );
  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });
  return html`<div
    ref="${root}"
    data-slot="item-media"
    data-variant="${computed(() => variant.value ?? 'default')}"
    class="${classes}"
  >${props.children}</div>`;
});

// ── ui-item-content / -title / -actions / -header / -footer ──────────

export const ItemContent = itemPart(
  'ui-item-content',
  'item-content',
  'flex flex-1 flex-col gap-1 [&+[data-slot=item-content]]:flex-none',
);

export const ItemTitle = itemPart(
  'ui-item-title',
  'item-title',
  'flex w-fit items-center gap-2 text-sm leading-snug font-medium',
);

export const ItemActions = itemPart(
  'ui-item-actions',
  'item-actions',
  'flex items-center gap-2',
);

export const ItemHeader = itemPart(
  'ui-item-header',
  'item-header',
  'flex basis-full items-center justify-between gap-2',
);

export const ItemFooter = itemPart(
  'ui-item-footer',
  'item-footer',
  'flex basis-full items-center justify-between gap-2',
);

// ── ui-item-description (a <p>) ──────────────────────────────────────

export const ItemDescription = component<ItemPartProps>(
  'ui-item-description',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        'line-clamp-2 text-sm leading-normal font-normal text-balance text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary',
        className.value,
      ),
    );
    const root = ref<HTMLParagraphElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<p
      ref="${root}"
      data-slot="item-description"
      class="${classes}"
    >${props.children}</p>`;
  },
);
