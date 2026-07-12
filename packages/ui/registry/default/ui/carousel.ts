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
import { attr, captureChildren, cn, projectChildren, transparentHost } from '../lib/utils.js';
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
  registerItem(): void;
  setViewport(el: HTMLElement): void;
  setTrack(el: HTMLElement): void;
  beginDrag(): void;
  dragTo(offset: number): void;
  endDrag(delta: number): void;
}

/** Subtree-scoped channel from the Carousel provider to its parts. */
const CarouselContext = createContext<CarouselState>('Carousel', { providerTag: 'ui-carousel' });

let uid = 0;

// ── ui-carousel (root, owns state) ───────────────────────────────────

export type CarouselProps = {
  orientation?: CarouselOrientation;
  className?: string;
  children?: string | TemplateResult;
};

export const Carousel = component<CarouselProps>('ui-carousel', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);

  const orientationAttr = attr(props.orientation, host, 'orientation');
  const orientation = computed<CarouselOrientation>(() =>
    orientationAttr.value === 'vertical' ? 'vertical' : 'horizontal',
  );

  const index = signal(0);
  const count = signal(0);
  const canScrollPrev = computed(() => index.value > 0);
  const canScrollNext = computed(() => index.value < count.value - 1);

  let viewportEl: HTMLElement | null = null;
  let trackEl: HTMLElement | null = null;

  const slideSize = (): number => {
    if (!viewportEl) return 0;
    const rect = viewportEl.getBoundingClientRect();
    return orientation.value === 'vertical' ? rect.height : rect.width;
  };
  const applyTransform = (offset = 0): void => {
    if (!trackEl) return;
    const px = -index.value * slideSize() + offset;
    trackEl.style.transform =
      orientation.value === 'vertical'
        ? `translate3d(0, ${px}px, 0)`
        : `translate3d(${px}px, 0, 0)`;
  };

  const scrollTo = (i: number): void => {
    const clamped = Math.max(0, Math.min(count.value - 1, i));
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
    registerItem: () => {
      count.value += 1;
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
    endDrag: (delta) => {
      if (trackEl) trackEl.style.transition = '';
      const threshold = Math.max(slideSize() * 0.2, DRAG_THRESHOLD_MIN);
      if (delta < -threshold) scrollTo(index.value + 1);
      else if (delta > threshold) scrollTo(index.value - 1);
      else applyTransform(); // settle back to the current slide
    },
  };
  CarouselContext.provide(host, state);

  // Re-settle the track whenever the selected slide or orientation changes.
  effect(() => {
    index.value;
    orientation.value;
    applyTransform();
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

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn('relative', className.value));

  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<div
    ref="${root}"
    role="region"
    aria-roledescription="carousel"
    data-slot="carousel"
    class="${classes}"
    @keydown=${onKeyDown}
  >${props.children}</div>`;
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
    const projected = captureChildren(host);

    const className = attr(props.className, host, 'class-name');
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
    let startPos = 0;
    let delta = 0;
    const axisPos = (event: MouseEvent): number =>
      state.orientation.value === 'vertical' ? event.clientY : event.clientX;

    const onPointerMove = (event: PointerEvent): void => {
      if (!dragging) return;
      delta = axisPos(event) - startPos;
      state.dragTo(delta);
    };
    const endDrag = (): void => {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', endDrag);
      document.removeEventListener('pointercancel', endDrag);
      state.endDrag(delta);
    };
    const onPointerDown = (event: PointerEvent): void => {
      if (state.count.value <= 1) return;
      dragging = true;
      startPos = axisPos(event);
      delta = 0;
      state.beginDrag();
      try {
        if (event.pointerId != null) viewport.current?.setPointerCapture?.(event.pointerId);
      } catch {
        /* setPointerCapture unsupported — fine */
      }
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', endDrag);
      document.addEventListener('pointercancel', endDrag);
    };

    onMount(() => {
      if (track.current) {
        projectChildren(host, track.current, projected);
        state.setTrack(track.current);
      }
      if (viewport.current) state.setViewport(viewport.current);
    });
    onCleanup(() => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', endDrag);
      document.removeEventListener('pointercancel', endDrag);
    });

    return html`<div
      ref="${viewport}"
      data-slot="carousel-content"
      class="overflow-hidden"
      @pointerdown=${onPointerDown}
    ><div ref="${track}" class="${trackClasses}" style="will-change:transform">${props.children}</div></div>`;
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
  const projected = captureChildren(host);

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() =>
    cn(
      'min-w-0 shrink-0 grow-0 basis-full',
      state.orientation.value === 'horizontal' ? 'pl-4' : 'pt-4',
      className.value,
    ),
  );

  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) {
      projectChildren(host, root.current, projected);
      state.registerItem();
    }
  });

  return html`<div
    ref="${root}"
    role="group"
    aria-roledescription="slide"
    data-slot="carousel-item"
    class="${classes}"
  >${props.children}</div>`;
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
    const className = attr(props.className, host, 'class-name');
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
);

export const CarouselNext = component<CarouselNavProps>('ui-carousel-next', (props, host) => {
  const state = CarouselContext.inject();
  transparentHost(host);
  const className = attr(props.className, host, 'class-name');
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
});
