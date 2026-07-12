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
  children,
  component,
  computed,
  html,
  type TemplateResult,
} from '@nisli/core';
import {
  cn,
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
  const classes = computed(() => cn(props.className.value));
  return html`<nav
    data-slot="breadcrumb"
    aria-label="breadcrumb"
    class="${classes}"
  >${children()}</nav>`;
}, { attrs: { className: 'string' } });

export const BreadcrumbList = component<BreadcrumbPartProps>(
  'ui-breadcrumb-list',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() =>
      cn(
        'flex flex-wrap items-center gap-1.5 text-sm break-words text-muted-foreground sm:gap-2.5',
        props.className.value,
      ),
    );
    return html`<ol
      data-slot="breadcrumb-list"
      class="${classes}"
    >${children()}</ol>`;
  },
  { attrs: { className: 'string' } },
);

export const BreadcrumbItem = component<BreadcrumbPartProps>(
  'ui-breadcrumb-item',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() => cn('inline-flex items-center gap-1.5', props.className.value));
    return html`<li
      data-slot="breadcrumb-item"
      class="${classes}"
    >${children()}</li>`;
  },
  { attrs: { className: 'string' } },
);

export type BreadcrumbLinkProps = BreadcrumbPartProps & { href?: string };

export const BreadcrumbLink = component<BreadcrumbLinkProps>(
  'ui-breadcrumb-link',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() =>
      cn('transition-colors hover:text-foreground', props.className.value),
    );
    return html`<a
      data-slot="breadcrumb-link"
      href="${props.href}"
      class="${classes}"
    >${children()}</a>`;
  },
  { attrs: { href: 'string', className: 'string' } },
);

export const BreadcrumbPage = component<BreadcrumbPartProps>(
  'ui-breadcrumb-page',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() => cn('font-normal text-foreground', props.className.value));
    return html`<span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      class="${classes}"
    >${children()}</span>`;
  },
  { attrs: { className: 'string' } },
);

export const BreadcrumbSeparator = component<BreadcrumbPartProps>(
  'ui-breadcrumb-separator',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() => cn('[&>svg]:size-3.5', props.className.value));
    // Default to a chevron when no explicit content is supplied.
    return html`<li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      class="${classes}"
    >${children(chevronRight())}</li>`;
  },
  { attrs: { className: 'string' } },
);

export const BreadcrumbEllipsis = component<BreadcrumbPartProps>(
  'ui-breadcrumb-ellipsis',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() =>
      cn('flex size-9 items-center justify-center', props.className.value),
    );
    return html`<span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      class="${classes}"
    >${moreHorizontal()}<span class="sr-only">More</span></span>`;
  },
  { attrs: { className: 'string' } },
);
