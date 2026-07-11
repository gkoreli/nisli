/**
 * ui/pagination.ts — Pagination and its parts.
 *
 * Ported from new-york-v4/ui/pagination.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui)
 * as Nisli custom elements: a real `<nav aria-label="pagination">` wrapping a
 * `<ul>` of `<li>` items whose links are styled with the shared
 * `buttonVariants` (this is the first registry item to depend on another
 * component). The current page link carries `aria-current="page"` and
 * `data-active`. Previous/Next links inline the lucide chevrons; the ellipsis
 * inlines MoreHorizontal with an sr-only label.
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
  boolAttr,
  captureChildren,
  cn,
  projectChildren,
  transparentHost,
} from '../lib/utils.js';
import { buttonVariants, type ButtonSize } from './button.js';

const chevronLeft = (): TemplateResult => html`<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
><path d="m15 18-6-6 6-6"></path></svg>`;

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

export type PaginationPartProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const Pagination = component<PaginationPartProps>('ui-pagination', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);
  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn('mx-auto flex w-full justify-center', className.value));
  const root = ref<HTMLElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });
  return html`<nav
    ref="${root}"
    role="navigation"
    aria-label="pagination"
    data-slot="pagination"
    class="${classes}"
  >${props.children}</nav>`;
});

export const PaginationContent = component<PaginationPartProps>(
  'ui-pagination-content',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn('flex flex-row items-center gap-1', className.value));
    const root = ref<HTMLUListElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<ul
      ref="${root}"
      data-slot="pagination-content"
      class="${classes}"
    >${props.children}</ul>`;
  },
);

export const PaginationItem = component<PaginationPartProps>(
  'ui-pagination-item',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(className.value));
    const root = ref<HTMLLIElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<li
      ref="${root}"
      data-slot="pagination-item"
      class="${classes}"
    >${props.children}</li>`;
  },
);

export type PaginationLinkProps = PaginationPartProps & {
  isActive?: boolean;
  size?: ButtonSize;
  href?: string;
};

export const PaginationLink = component<PaginationLinkProps>(
  'ui-pagination-link',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);

    const isActive = boolAttr(props.isActive, host, 'is-active');
    const size = attr(props.size, host, 'size');
    const href = attr(props.href, host, 'href');
    const className = attr(props.className, host, 'class-name');

    const classes = computed(() =>
      cn(
        buttonVariants({
          variant: isActive.value ? 'outline' : 'ghost',
          size: size.value ?? 'icon',
        }),
        className.value,
      ),
    );

    const root = ref<HTMLAnchorElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<a
      ref="${root}"
      data-slot="pagination-link"
      href="${href}"
      aria-current="${computed(() => (isActive.value ? 'page' : undefined))}"
      data-active="${computed(() => (isActive.value ? 'true' : undefined))}"
      class="${classes}"
    >${props.children}</a>`;
  },
);

export const PaginationPrevious = component<Pick<PaginationLinkProps, 'href' | 'className'>>(
  'ui-pagination-previous',
  (props, host) => {
    transparentHost(host);
    const href = attr(props.href, host, 'href');
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        buttonVariants({ variant: 'ghost', size: 'default' }),
        'gap-1 px-2.5 sm:pl-2.5',
        className.value,
      ),
    );
    return html`<a
      data-slot="pagination-link"
      aria-label="Go to previous page"
      href="${href}"
      class="${classes}"
    >${chevronLeft()}<span class="hidden sm:block">Previous</span></a>`;
  },
);

export const PaginationNext = component<Pick<PaginationLinkProps, 'href' | 'className'>>(
  'ui-pagination-next',
  (props, host) => {
    transparentHost(host);
    const href = attr(props.href, host, 'href');
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        buttonVariants({ variant: 'ghost', size: 'default' }),
        'gap-1 px-2.5 sm:pr-2.5',
        className.value,
      ),
    );
    return html`<a
      data-slot="pagination-link"
      aria-label="Go to next page"
      href="${href}"
      class="${classes}"
    ><span class="hidden sm:block">Next</span>${chevronRight()}</a>`;
  },
);

export const PaginationEllipsis = component<PaginationPartProps>(
  'ui-pagination-ellipsis',
  (props, host) => {
    transparentHost(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn('flex size-9 items-center justify-center', className.value),
    );
    return html`<span
      aria-hidden="true"
      data-slot="pagination-ellipsis"
      class="${classes}"
    >${moreHorizontal()}<span class="sr-only">More pages</span></span>`;
  },
);
