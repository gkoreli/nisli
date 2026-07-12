/**
 * ui/message-scroller.ts — Message Scroller.
 *
 * Ported from new-york-v4/ui/message-scroller.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui).
 * Upstream wraps a headless `@shadcn/react/message-scroller` primitive, which
 * isn't vendorable into a copy-in file, so — like drawer/carousel — the visuals
 * are ported verbatim (root/viewport/content/item/button class lists +
 * data-slots) while the behavior follows its conventions on plain DOM:
 * stick-to-bottom autoscroll (a new message scrolls into view only while the
 * viewport is already at the bottom) and a scroll-to-end/start button whose
 * data-active reflects the scroll position.
 *
 * Elements: ui-message-scroller-provider (passthrough) / ui-message-scroller
 * (root, owns state) / -viewport (the scroll container) / -content / -item /
 * -button.
 *
 * v1 limits (documented): a single stick-to-bottom mode (no per-item
 * scrollAnchor targeting — the prop is accepted and reflected as an attribute);
 * autoscroll triggers on content mutation via a MutationObserver.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  component,
  computed,
  html,
  onCleanup,
  onMount,
  ref,
  signal,
  type ReadonlySignal,
  type TemplateResult,
} from '@nisli/core';
import { attr, boolAttr, captureChildren, cn, projectChildren, transparentHost } from '../lib/utils.js';

const AT_EDGE_THRESHOLD = 2;

// ── Shared state (published on the <ui-message-scroller> host) ───────

export interface MessageScrollerState {
  isAtStart: ReadonlySignal<boolean>;
  isAtEnd: ReadonlySignal<boolean>;
  scrollToStart(): void;
  scrollToEnd(): void;
  handleScroll(): void;
  setViewport(el: HTMLElement): void;
  setContent(el: HTMLElement): void;
}

type MessageScrollerHost = HTMLElement & { __uiMessageScroller?: MessageScrollerState };

function useScroller(host: HTMLElement, tag: string): MessageScrollerState {
  const state = (host.closest('ui-message-scroller') as MessageScrollerHost | null)
    ?.__uiMessageScroller;
  if (!state) {
    throw new Error(`<${tag}> must be used inside <ui-message-scroller>.`);
  }
  return state;
}

// ── ui-message-scroller-provider (passthrough) ───────────────────────

export type MessageScrollerSectionProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const MessageScrollerProvider = component<MessageScrollerSectionProps>(
  'ui-message-scroller-provider',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(className.value));
    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<div ref="${root}" data-slot="message-scroller-provider" style="display:contents" class="${classes}">${props.children}</div>`;
  },
);

// ── ui-message-scroller (root) ───────────────────────────────────────

export const MessageScroller = component<MessageScrollerSectionProps>(
  'ui-message-scroller',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);

    const isAtStart = signal<boolean>(true);
    const isAtEnd = signal<boolean>(true);
    let viewportEl: HTMLElement | null = null;
    let sticky = true;
    let observer: MutationObserver | null = null;

    const update = (): void => {
      const v = viewportEl;
      if (!v) return;
      isAtStart.value = v.scrollTop <= AT_EDGE_THRESHOLD;
      isAtEnd.value = v.scrollHeight - v.clientHeight - v.scrollTop <= AT_EDGE_THRESHOLD;
      sticky = isAtEnd.value;
    };
    const scrollToEnd = (): void => {
      if (viewportEl) {
        viewportEl.scrollTop = viewportEl.scrollHeight;
        update();
      }
    };
    const scrollToStart = (): void => {
      if (viewportEl) {
        viewportEl.scrollTop = 0;
        update();
      }
    };

    const state: MessageScrollerState = {
      isAtStart,
      isAtEnd,
      scrollToStart,
      scrollToEnd,
      handleScroll: update,
      setViewport: (el) => {
        viewportEl = el;
        update();
      },
      setContent: (el) => {
        if (typeof MutationObserver === 'undefined') return;
        observer = new MutationObserver(() => {
          // New content: keep the bottom pinned only if we were already there.
          if (sticky) scrollToEnd();
          else update();
        });
        observer.observe(el, { childList: true, subtree: true, characterData: true });
      },
    };
    (host as MessageScrollerHost).__uiMessageScroller = state;
    onCleanup(() => observer?.disconnect());

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        'group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden',
        className.value,
      ),
    );
    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<div ref="${root}" data-slot="message-scroller" class="${classes}">${props.children}</div>`;
  },
);

// ── ui-message-scroller-viewport ─────────────────────────────────────

export const MessageScrollerViewport = component<MessageScrollerSectionProps>(
  'ui-message-scroller-viewport',
  (props, host) => {
    const state = useScroller(host, 'ui-message-scroller-viewport');
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        'size-full min-h-0 min-w-0 scroll-fade-b scrollbar-thin scrollbar-gutter-stable overflow-y-auto overscroll-contain contain-content data-autoscrolling:scrollbar-none',
        className.value,
      ),
    );
    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) {
        projectChildren(host, root.current, projected);
        state.setViewport(root.current);
      }
    });
    return html`<div
      ref="${root}"
      data-slot="message-scroller-viewport"
      class="${classes}"
      @scroll=${() => state.handleScroll()}
    >${props.children}</div>`;
  },
);

// ── ui-message-scroller-content ──────────────────────────────────────

export const MessageScrollerContent = component<MessageScrollerSectionProps>(
  'ui-message-scroller-content',
  (props, host) => {
    const state = useScroller(host, 'ui-message-scroller-content');
    transparentHost(host);
    const projected = captureChildren(host);
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn('flex h-max min-h-full flex-col gap-8', className.value));
    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) {
        projectChildren(host, root.current, projected);
        state.setContent(root.current);
      }
    });
    return html`<div ref="${root}" data-slot="message-scroller-content" class="${classes}">${props.children}</div>`;
  },
);

// ── ui-message-scroller-item ─────────────────────────────────────────

export type MessageScrollerItemProps = {
  scrollAnchor?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const MessageScrollerItem = component<MessageScrollerItemProps>(
  'ui-message-scroller-item',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);
    const scrollAnchor = boolAttr(props.scrollAnchor, host, 'scroll-anchor');
    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn(
        'min-w-0 shrink-0 [contain-intrinsic-size:auto_10rem] [content-visibility:auto]',
        className.value,
      ),
    );
    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });
    return html`<div
      ref="${root}"
      data-slot="message-scroller-item"
      data-scroll-anchor="${computed(() => (scrollAnchor.value ? 'true' : undefined))}"
      class="${classes}"
    >${props.children}</div>`;
  },
);

// ── ui-message-scroller-button ───────────────────────────────────────

const arrowDownIcon = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"></path><path d="m19 12-7 7-7-7"></path></svg>`;

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium shadow-sm size-8 [&_svg]:pointer-events-none [&_svg:not([class*=size-])]:size-4 [&_svg]:shrink-0';

const buttonPosition =
  'absolute inset-s-1/2 -translate-x-1/2 border-border bg-background text-foreground transition-[translate,scale,opacity] duration-200 hover:bg-muted hover:text-foreground data-[active=false]:pointer-events-none data-[active=false]:scale-95 data-[active=false]:opacity-0 data-[active=false]:duration-400 data-[active=false]:ease-[cubic-bezier(0.7,0,0.84,0)] data-[active=true]:translate-y-0 data-[active=true]:scale-100 data-[active=true]:opacity-100 data-[active=true]:ease-[cubic-bezier(0.23,1,0.32,1)] data-[direction=end]:bottom-4 data-[direction=end]:data-[active=false]:translate-y-full data-[direction=start]:top-4 data-[direction=start]:data-[active=false]:-translate-y-full rtl:translate-x-1/2 data-[direction=start]:[&_svg]:rotate-180';

export type MessageScrollerButtonProps = {
  direction?: 'start' | 'end';
  className?: string;
  children?: string | TemplateResult;
};

export const MessageScrollerButton = component<MessageScrollerButtonProps>(
  'ui-message-scroller-button',
  (props, host) => {
    const state = useScroller(host, 'ui-message-scroller-button');
    transparentHost(host);
    const projected = captureChildren(host);

    const dirAttr = attr(props.direction, host, 'direction');
    const direction = computed<'start' | 'end'>(() =>
      dirAttr.value === 'start' ? 'start' : 'end',
    );
    const active = computed(() =>
      direction.value === 'end' ? !state.isAtEnd.value : !state.isAtStart.value,
    );

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(buttonBase, buttonPosition, className.value));

    const root = ref<HTMLButtonElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    const onClick = (): void => {
      if (direction.value === 'end') state.scrollToEnd();
      else state.scrollToStart();
    };

    return html`<button
      ref="${root}"
      type="button"
      data-slot="message-scroller-button"
      data-direction="${direction}"
      data-active="${computed(() => (active.value ? 'true' : 'false'))}"
      aria-label="${computed(() => (direction.value === 'end' ? 'Scroll to end' : 'Scroll to start'))}"
      class="${classes}"
      @click=${onClick}
    >${arrowDownIcon}${props.children}</button>`;
  },
);
