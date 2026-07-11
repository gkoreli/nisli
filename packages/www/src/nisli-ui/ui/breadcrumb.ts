/**
 * ui/breadcrumb.ts — Breadcrumb and its parts.
 *
 * Ported from new-york-v4/ui/breadcrumb.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui)
 * as Nisli custom elements: a real `<nav aria-label="breadcrumb">` wrapping an
 * `<ol>` of `<li>` items, with links, the current page, separators, and an
 * ellipsis. Class lists, roles, and aria-* match the v4 source; the default
 * separator/ellipsis lucide icons (ChevronRight / MoreHorizontal) are inlined
 * as SVG.
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
  projectChildren,
  transparentHost,
} from '../lib/utils.js';

const chevronRight = (): TemplateResult => html`<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
><path d="m9 18 6-6-6-6"></path></svg>`;

const moreHorizontal = (): TemplateResult => html`<svg
  class="size-4"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`;

export type BreadcrumbPartProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const Breadcrumb = component<BreadcrumbPartProps>('ui-breadcrumb', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);
  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn(className.value));
  const root = ref<HTMLElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });
  return html`<nav
    ref="${root}"
    data-slot="breadcrumb"
    aria-label="breadcrumb"
    class="${classes}"
  >${props.children}</nav>`;
});

export const BreadcrumbList = component<BreadcrumbPartProps>(
  'ui-breadcrumb-list',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        'flex flex-wrap items-center gap-1.5 text-sm break-words text-muted-foreground sm:gap-2.5',
        className.value,
      ),
    );
    const root = ref<HTMLOListElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<ol
      ref="${root}"
      data-slot="breadcrumb-list"
      class="${classes}"
    >${props.children}</ol>`;
  },
);

export const BreadcrumbItem = component<BreadcrumbPartProps>(
  'ui-breadcrumb-item',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn('inline-flex items-center gap-1.5', className.value));
    const root = ref<HTMLLIElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<li
      ref="${root}"
      data-slot="breadcrumb-item"
      class="${classes}"
    >${props.children}</li>`;
  },
);

export type BreadcrumbLinkProps = BreadcrumbPartProps & { href?: string };

export const BreadcrumbLink = component<BreadcrumbLinkProps>(
  'ui-breadcrumb-link',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const href = attr(props.href, host, 'href');
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn('transition-colors hover:text-foreground', className.value),
    );
    const root = ref<HTMLAnchorElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<a
      ref="${root}"
      data-slot="breadcrumb-link"
      href="${href}"
      class="${classes}"
    >${props.children}</a>`;
  },
);

export const BreadcrumbPage = component<BreadcrumbPartProps>(
  'ui-breadcrumb-page',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn('font-normal text-foreground', className.value));
    const root = ref<HTMLSpanElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<span
      ref="${root}"
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      class="${classes}"
    >${props.children}</span>`;
  },
);

export const BreadcrumbSeparator = component<BreadcrumbPartProps>(
  'ui-breadcrumb-separator',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn('[&>svg]:size-3.5', className.value));
    const root = ref<HTMLLIElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    // Default to a chevron when no explicit content is supplied.
    const content = computed(() =>
      props.children.value ?? (projected.length === 0 ? chevronRight() : undefined),
    );
    return html`<li
      ref="${root}"
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      class="${classes}"
    >${content}</li>`;
  },
);

export const BreadcrumbEllipsis = component<BreadcrumbPartProps>(
  'ui-breadcrumb-ellipsis',
  (props, host) => {
    transparentHost(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn('flex size-9 items-center justify-center', className.value),
    );
    return html`<span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      class="${classes}"
    >${moreHorizontal()}<span class="sr-only">More</span></span>`;
  },
);
