/**
 * ui/scroll-area.ts — ScrollArea.
 *
 * Ported from shadcn/ui `new-york-v4/ui/scroll-area.tsx` (MIT —
 * https://github.com/shadcn-ui/ui), which wraps Radix ScrollArea. Native-
 * first translation (documented deviation): the viewport is a real
 * `overflow-auto` scroller and the thin themed scrollbar is drawn by CSS
 * (`scrollbar-width`/`scrollbar-color` + `::-webkit-scrollbar` rules
 * injected once) instead of Radix's JS-driven scrollbar/thumb elements —
 * so there are no `scroll-area-scrollbar`/`scroll-area-thumb` slots, and
 * scrolling keeps every native behavior (wheel, touch, keyboard, a11y).
 *
 * Usable as a typed factory (`ScrollArea({ className: 'h-72', children })`)
 * or as a plain custom element (`<ui-scroll-area class-name="h-72">`).
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

const SCROLLBAR_STYLE_ID = 'ui-scroll-area-style';

/**
 * Webkit browsers ignore `scrollbar-color`, so a stylesheet for the thin
 * themed scrollbar is injected once per document.
 */
function ensureScrollbarStyles(doc: Document): void {
  if (doc.getElementById(SCROLLBAR_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = SCROLLBAR_STYLE_ID;
  style.textContent = `
[data-slot="scroll-area-viewport"] { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
[data-slot="scroll-area-viewport"]::-webkit-scrollbar { width: 10px; height: 10px; }
[data-slot="scroll-area-viewport"]::-webkit-scrollbar-track { background: transparent; }
[data-slot="scroll-area-viewport"]::-webkit-scrollbar-thumb { background: var(--border); border-radius: 9999px; border: 2px solid transparent; background-clip: content-box; }
`;
  doc.head.appendChild(style);
}

export type ScrollAreaProps = {
  /** Merged last into the root's class list via cn() — size it here (e.g. h-72). */
  className?: string;
  children?: string | TemplateResult;
};

export const ScrollArea = component<ScrollAreaProps>('ui-scroll-area', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);
  ensureScrollbarStyles(host.ownerDocument);

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn('relative', className.value));

  const viewport = ref<HTMLDivElement>();
  onMount(() => {
    if (viewport.current) projectChildren(host, viewport.current, projected);
  });

  return html`<div data-slot="scroll-area" class="${classes}">
    <div
      ref="${viewport}"
      data-slot="scroll-area-viewport"
      tabindex="0"
      class="size-full overflow-auto rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
    >${props.children}</div>
  </div>`;
});
