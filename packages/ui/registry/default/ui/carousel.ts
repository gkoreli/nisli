/**
 * ui/carousel.ts — Carousel.
 *
 * Ported from new-york-v4/ui/carousel.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui).
 * Upstream wraps embla-carousel, which isn't vendorable into a copy-in file,
 * so — like drawer/resizable — the VISUALS are ported verbatim (the root /
 * content / item / previous / next class lists, data-slots, and the horizontal
 * vs vertical variants) while the BEHAVIOR follows embla's conventions on plain
 * DOM: a transform-translated track, one slide per view, pointer drag that
 * settles to the nearest slide, prev/next buttons that disable at the edges,
 * and ArrowLeft/ArrowRight keyboard navigation.
 *
 * Elements: ui-carousel / -content / -item / -previous / -next. Selecting a
 * slide dispatches a bubbling `ui-select` CustomEvent (`detail: { index }`)
 * from the `<ui-carousel>` host; the region is aria-roledescription="carousel"
 * and each item aria-roledescription="slide".
 *
 * v1 limits (documented): no loop, no autoplay, one slide per view (no
 * multi-slide layouts).
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  children,
  component,
  createContext,
  computed,
  effect,
  html,
  onCleanup,
  onMount,
  ref,
  signal,
  type ReadonlySignal,
  type TemplateResult,
} from '@nisli/core';
import { cn, transparentHost } from '../lib/utils.js';
import { buttonVariants } from './button.js';

export type CarouselOrientation = 'horizontal' | 'vertical';

const arrowLeftIcon = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>`;
const arrowRightIcon = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>`;

/** Settle to an adjacent slide past this drag distance (px); fallback keeps it
 * usable before the viewport has laid out. */
const DRAG_THRESHOLD_MIN = 40;

// ── Shared state (published on the <ui-carousel> host) ───────────────

export interface CarouselState {
  orientation: ReadonlySignal<CarouselOrientation>;
  index: ReadonlySignal<number>;
  count: ReadonlySignal<number>;
  canScrollPrev: ReadonlySignal<boolean>;
  canScrollNext: ReadonlySignal<boolean>;
  scrollPrev(): void;
  scrollNext(): void;
  scrollTo(index: number): void;
  registerItem(el: HTMLElement): void;
  unregisterItem(el: HTMLElement): void;
  setViewport(el: HTMLElement): void;
  setTrack(el: HTMLElement): void;
  beginDrag(): void;
  dragTo(offset: number): void;
  endDrag(delta: number, velocity?: number): void;
}

/** Subtree-scoped channel from the Carousel provider to its parts. */
const CarouselContext = createContext<CarouselState>('Carousel', { providerTag: 'ui-carousel' });

// ── ui-carousel (root, owns state) ───────────────────────────────────

export type CarouselProps = {
  orientation?: CarouselOrientation;
  className?: string;
  children?: string | TemplateResult;
};

export const Carousel = component<CarouselProps>('ui-carousel', (props, host) => {
  transparentHost(host);

  // ADR 0025 item 3: attribute fallbacks declared via the `attrs` option below
  // and delivered as plain, LIVE prop signals — no userland attr(). Projection
  // via `children()` (ADR 0025 item 1).
  const orientation = computed<CarouselOrientation>(() =>
    props.orientation.value === 'vertical' ? 'vertical' : 'horizontal',
  );

  const index = signal(0);
  const count = signal(0);
  const canScrollPrev = computed(() => index.value > 0);
  const canScrollNext = computed(() => index.value < count.value - 1);

  let viewportEl: HTMLElement | null = null;
  let trackEl: HTMLElement | null = null;
  const itemEls: HTMLElement[] = [];

  const slideSize = (): number => {
    if (itemEls.length > 1) {
      const first = itemEls[0]!.getBoundingClientRect();
      const second = itemEls[1]!.getBoundingClientRect();
      const step = orientation.value === 'vertical'
        ? Math.abs(second.top - first.top)
        : Math.abs(second.left - first.left);
      if (step > 0) return step;
    }
    if (!viewportEl) return 0;
    const rect = viewportEl.getBoundingClientRect();
    return orientation.value === 'vertical' ? rect.height : rect.width;
  };
  const applyTransform = (offset = 0): void => {
    if (!trackEl) return;
    const size = slideSize();
    const minOffset = -(Math.max(0, count.value - 1 - index.value) * size);
    const maxOffset = index.value * size;
    const px = -index.value * size + Math.max(minOffset, Math.min(maxOffset, offset));
    trackEl.style.transform =
      orientation.value === 'vertical'
        ? `translate3d(0, ${px}px, 0)`
        : `translate3d(${px}px, 0, 0)`;
  };

  const scrollTo = (i: number): void => {
    const clamped = Math.max(0, Math.min(Math.max(0, count.value - 1), i));
    if (clamped !== index.value) {
      index.value = clamped;
      host.dispatchEvent(
        new CustomEvent('ui-select', { detail: { index: clamped }, bubbles: true }),
      );
    }
    applyTransform();
  };

  const state: CarouselState = {
    orientation,
    index,
    count,
    canScrollPrev,
    canScrollNext,
    scrollPrev: () => scrollTo(index.value - 1),
    scrollNext: () => scrollTo(index.value + 1),
    scrollTo,
    registerItem: (el) => {
      if (!itemEls.includes(el)) itemEls.push(el);
      count.value = itemEls.length;
    },
    unregisterItem: (el) => {
      const at = itemEls.indexOf(el);
      if (at >= 0) itemEls.splice(at, 1);
      count.value = itemEls.length;
      if (index.value >= count.value) scrollTo(Math.max(0, count.value - 1));
    },
    setViewport: (el) => {
      viewportEl = el;
    },
    setTrack: (el) => {
      trackEl = el;
    },
    beginDrag: () => {
      if (trackEl) trackEl.style.transition = 'none';
    },
    dragTo: (offset) => applyTransform(offset),
    endDrag: (delta, velocity = 0) => {
      if (trackEl) trackEl.style.transition = '';
      const size = slideSize();
      const threshold = Math.max(size * 0.2, DRAG_THRESHOLD_MIN);
      const projected = delta + velocity * 180;
      if (Math.abs(delta) >= threshold || Math.abs(projected) >= threshold) {
        const slides = size > 0 ? Math.max(1, Math.round(Math.abs(projected) / size)) : 1;
        scrollTo(index.value + (projected < 0 ? slides : -slides));
      } else applyTransform(); // settle back to the current slide
    },
  };
  CarouselContext.provide(host, state);

  // Re-settle the track whenever the selected slide or orientation changes.
  effect(() => {
    index.value;
    count.value;
    orientation.value;
    applyTransform();
    itemEls.forEach((item, itemIndex) => {
      const active = itemIndex === index.value;
      item.toggleAttribute('data-active', active);
      item.setAttribute('aria-hidden', active ? 'false' : 'true');
      if (active) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    });
  });

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      state.scrollPrev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      state.scrollNext();
    }
  };

  const className = props.className;
  const classes = computed(() => cn('relative', className.value));

  return html`<div
    role="region"
    aria-roledescription="carousel"
    data-slot="carousel"
    class="${classes}"
    @keydown=${onKeyDown}
  >${children()}</div>`;
}, {
  attrs: {
    orientation: 'string',
    className: 'string',
  },
});

// ── ui-carousel-content (viewport + draggable track) ─────────────────

export type CarouselContentProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const CarouselContent = component<CarouselContentProps>(
  'ui-carousel-content',
  (props, host) => {
    const state = CarouselContext.inject();
    transparentHost(host);

    const className = props.className;
    const trackClasses = computed(() =>
      cn(
        'flex',
        state.orientation.value === 'horizontal' ? '-ml-4' : '-mt-4 flex-col',
        className.value,
      ),
    );

    const viewport = ref<HTMLDivElement>();
    const track = ref<HTMLDivElement>();

    // ── Drag ──
    let dragging = false;
    let pointerId = -1;
    let startPrimary = 0;
    let startCross = 0;
    let lastPrimary = 0;
    let lastTime = 0;
    let velocity = 0;
    let axisLocked = false;
    let delta = 0;
    const axisPos = (event: MouseEvent): number =>
      state.orientation.value === 'vertical' ? event.clientY : event.clientX;
    const crossPos = (event: MouseEvent): number =>
      state.orientation.value === 'vertical' ? event.clientX : event.clientY;

    const removeDocumentListeners = (): void => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', endDrag);
      document.removeEventListener('pointercancel', cancelDrag);
      window.removeEventListener('scroll', cancelDrag, true);
    };

    const finishDrag = (cancelled = false): void => {
      if (!dragging) return;
      dragging = false;
      removeDocumentListeners();
      state.endDrag(cancelled || !axisLocked ? 0 : delta, cancelled ? 0 : velocity);
      pointerId = -1;
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!dragging || (event.pointerId != null && pointerId >= 0 && event.pointerId !== pointerId)) return;
      const primary = axisPos(event);
      const primaryDelta = primary - startPrimary;
      const crossDelta = crossPos(event) - startCross;
      if (!axisLocked) {
        if (Math.max(Math.abs(primaryDelta), Math.abs(crossDelta)) < 8) return;
        if (Math.abs(crossDelta) > Math.abs(primaryDelta)) {
          finishDrag(true);
          return;
        }
        axisLocked = true;
        state.beginDrag();
      }
      event.preventDefault();
      const now = performance.now();
      const elapsed = now - lastTime;
      velocity = elapsed >= 8 ? (primary - lastPrimary) / elapsed : 0;
      lastPrimary = primary;
      lastTime = now;
      delta = primaryDelta;
      state.dragTo(delta);
    };
    const endDrag = (event: Event): void => {
      if ('pointerId' in event && event.pointerId != null && pointerId >= 0 && event.pointerId !== pointerId) return;
      finishDrag(false);
    };
    const cancelDrag = (): void => finishDrag(true);
    const onPointerDown = (event: PointerEvent): void => {
      if (state.count.value <= 1 || event.isPrimary === false || event.button !== 0) return;
      dragging = true;
      pointerId = event.pointerId ?? -1;
      startPrimary = axisPos(event);
      startCross = crossPos(event);
      lastPrimary = startPrimary;
      lastTime = performance.now();
      velocity = 0;
      axisLocked = false;
      delta = 0;
      try {
        if (event.pointerId != null) viewport.current?.setPointerCapture?.(event.pointerId);
      } catch {
        /* setPointerCapture unsupported — fine */
      }
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', endDrag);
      document.addEventListener('pointercancel', cancelDrag);
      window.addEventListener('scroll', cancelDrag, true);
    };

    onMount(() => {
      if (track.current) state.setTrack(track.current);
      if (viewport.current) state.setViewport(viewport.current);
    });
    onCleanup(() => {
      finishDrag(true);
      removeDocumentListeners();
    });

    return html`<div
      ref="${viewport}"
      data-slot="carousel-content"
      class="overflow-hidden ${computed(() => state.orientation.value === 'horizontal' ? 'touch-pan-y' : 'touch-pan-x')}"
      @pointerdown=${onPointerDown}
    ><div ref="${track}" class="${trackClasses}" style="will-change:transform">${children()}</div></div>`;
  },
  {
    attrs: {
      className: 'string',
    },
  },
);

// ── ui-carousel-item ─────────────────────────────────────────────────

export type CarouselItemProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const CarouselItem = component<CarouselItemProps>('ui-carousel-item', (props, host) => {
  const state = CarouselContext.inject();
  transparentHost(host);

  const className = props.className;
  const classes = computed(() =>
    cn(
      'min-w-0 shrink-0 grow-0 basis-full',
      state.orientation.value === 'horizontal' ? 'pl-4' : 'pt-4',
      className.value,
    ),
  );

  const item = ref<HTMLDivElement>();
  onMount(() => {
    if (item.current) state.registerItem(item.current);
  });
  onCleanup(() => {
    if (item.current) state.unregisterItem(item.current);
  });

  return html`<div
    ref="${item}"
    role="group"
    aria-roledescription="slide"
    data-slot="carousel-item"
    class="${classes}"
  >${children()}</div>`;
}, {
  attrs: {
    className: 'string',
  },
});

// ── ui-carousel-previous / -next ─────────────────────────────────────

const prevPositionClasses = (orientation: CarouselOrientation): string =>
  orientation === 'horizontal'
    ? 'top-1/2 -left-12 -translate-y-1/2'
    : '-top-12 left-1/2 -translate-x-1/2 rotate-90';
const nextPositionClasses = (orientation: CarouselOrientation): string =>
  orientation === 'horizontal'
    ? 'top-1/2 -right-12 -translate-y-1/2'
    : '-bottom-12 left-1/2 -translate-x-1/2 rotate-90';

export type CarouselNavProps = {
  className?: string;
};

export const CarouselPrevious = component<CarouselNavProps>(
  'ui-carousel-previous',
  (props, host) => {
    const state = CarouselContext.inject();
    transparentHost(host);
    const className = props.className;
    const classes = computed(() =>
      cn(
        buttonVariants({ variant: 'outline', size: 'icon' }),
        'absolute size-8 rounded-full',
        prevPositionClasses(state.orientation.value),
        className.value,
      ),
    );
    return html`<button
      type="button"
      data-slot="carousel-previous"
      aria-label="Previous slide"
      disabled="${computed(() => !state.canScrollPrev.value)}"
      class="${classes}"
      @click=${() => state.scrollPrev()}
    >${arrowLeftIcon}<span class="sr-only">Previous slide</span></button>`;
  },
  {
    attrs: {
      className: 'string',
    },
  },
);

export const CarouselNext = component<CarouselNavProps>('ui-carousel-next', (props, host) => {
  const state = CarouselContext.inject();
  transparentHost(host);
  const className = props.className;
  const classes = computed(() =>
    cn(
      buttonVariants({ variant: 'outline', size: 'icon' }),
      'absolute size-8 rounded-full',
      nextPositionClasses(state.orientation.value),
      className.value,
    ),
  );
  return html`<button
    type="button"
    data-slot="carousel-next"
    aria-label="Next slide"
    disabled="${computed(() => !state.canScrollNext.value)}"
    class="${classes}"
    @click=${() => state.scrollNext()}
  >${arrowRightIcon}<span class="sr-only">Next slide</span></button>`;
}, {
  attrs: {
    className: 'string',
  },
});
