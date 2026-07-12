/**
 * lib/floating.ts — anchored positioning for floating elements.
 *
 * A zero-dependency stand-in for the slice of Floating UI that Radix
 * popovers/tooltips/menus use (MIT — https://github.com/floating-ui/floating-ui
 * for the concepts): place a `position: fixed` element against an anchor with
 * `side`/`align` + offsets, flip to the opposite side when the preferred side
 * overflows the viewport, and clamp along the align axis. Repositions on
 * scroll (capture) and resize until disposed.
 *
 * Deliberate v1 limits (document in consumers): no `shift` beyond align-axis
 * clamping, no anchor-resize observation, and
 * `position: fixed` is trapped by transformed/filtered ancestors (same caveat
 * as ui-dialog; upstream solves it with portals).
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  effect,
  onCleanup,
  signal,
  type ReadonlySignal,
  type Ref,
} from '@nisli/core';

export type Side = 'top' | 'right' | 'bottom' | 'left';
export type Align = 'start' | 'center' | 'end';
type FloatingArrowElement = HTMLElement | SVGSVGElement;

export interface FloatingOptions {
  /** Preferred side of the anchor. Default `'bottom'`. */
  side?: Side;
  /** Alignment along the anchor's edge. Default `'center'`. */
  align?: Align;
  /** Gap in px between anchor and floating element. Default `0`. */
  sideOffset?: number;
  /** Shift in px along the align axis. Default `0`. */
  alignOffset?: number;
  /** Flip to the opposite side when the preferred side overflows. Default `true`. */
  avoidCollisions?: boolean;
  /** Viewport edge padding used for collision math. Default `8`. */
  collisionPadding?: number;
  /** Optional arrow rendered inside the floating element. */
  arrow?: FloatingArrowElement;
  /** Minimum arrow distance from the floating element's cross-axis edges. */
  arrowPadding?: number;
}

export interface FloatingPosition {
  x: number;
  y: number;
  /** The side actually used after collision handling. */
  side: Side;
  align: Align;
}

export interface FloatingArrowPosition {
  left: number;
  top: number;
  side: Side;
}

const OPPOSITE: Record<Side, Side> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

// The upstream arrow SVG's polygon points down, while its byte-identical
// class adds a constant 45deg rotate. Counter that class rotation first, then
// turn the visible polygon tip toward the anchor-facing edge.
const ARROW_ROTATION: Record<Side, number> = {
  top: -45,
  bottom: 135,
  left: -135,
  right: 45,
};

export function arrowRotation(side: Side): number {
  return ARROW_ROTATION[side];
}

const ORIGIN_VARIABLE_BY_SLOT: Record<string, string> = {
  'tooltip-content': '--radix-tooltip-content-transform-origin',
  'popover-content': '--radix-popover-content-transform-origin',
  'hover-card-content': '--radix-hover-card-content-transform-origin',
  'dropdown-menu-content': '--radix-dropdown-menu-content-transform-origin',
  'dropdown-menu-sub-content': '--radix-dropdown-menu-content-transform-origin',
  'context-menu-content': '--radix-context-menu-content-transform-origin',
  'context-menu-sub-content': '--radix-context-menu-content-transform-origin',
  'menubar-content': '--radix-menubar-content-transform-origin',
  'menubar-sub-content': '--radix-menubar-content-transform-origin',
};

/** Transform origin on the anchor-facing edge after collision flipping. */
export function transformOrigin(side: Side, align: Align): string {
  const cross = align === 'start' ? '0%' : align === 'end' ? '100%' : '50%';
  switch (side) {
    case 'top': return `${cross} 100%`;
    case 'bottom': return `${cross} 0%`;
    case 'left': return `100% ${cross}`;
    case 'right': return `0% ${cross}`;
  }
}

function hasClosingAnimation(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  const names = style.animationName.split(',').map((name) => name.trim());
  const durations = style.animationDuration.split(',').map((duration) => duration.trim());
  return names.some((name, index) => {
    const duration = durations[index] ?? durations[durations.length - 1] ?? '0s';
    return name !== '' && name !== 'none' && duration !== '' && duration !== '0s' && duration !== '0ms';
  });
}

/**
 * Keep a closing floating layer visible for its CSS exit animation. In
 * no-CSS environments (including happy-dom) closing hides synchronously.
 */
export function floatingHidden(
  open: ReadonlySignal<boolean>,
  elementRef: Ref<HTMLElement>,
): ReadonlySignal<boolean> {
  const hidden = signal(!open.value);
  let closingElement: HTMLElement | null = null;

  const stopWaiting = (): void => {
    if (!closingElement) return;
    closingElement.removeEventListener('animationend', finish);
    closingElement.removeEventListener('animationcancel', finish);
    closingElement = null;
  };
  const finish = (event: Event): void => {
    if (event.target !== closingElement || open.value) return;
    stopWaiting();
    hidden.value = true;
  };

  effect(() => {
    if (open.value) {
      stopWaiting();
      hidden.value = false;
      return;
    }

    const element = elementRef.current;
    if (!element) {
      hidden.value = true;
      return;
    }

    // Make the closing selectors observable before checking computed style;
    // the template binding converges on the same value in this flush.
    element.setAttribute('data-state', 'closed');
    if (!hasClosingAnimation(element)) {
      stopWaiting();
      hidden.value = true;
      return;
    }

    stopWaiting();
    closingElement = element;
    element.addEventListener('animationend', finish);
    element.addEventListener('animationcancel', finish);
  });

  onCleanup(stopWaiting);
  return hidden;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function mainAxisCoord(anchor: Rect, floating: Rect, side: Side, gap: number): number {
  switch (side) {
    case 'top': return anchor.y - floating.height - gap;
    case 'bottom': return anchor.y + anchor.height + gap;
    case 'left': return anchor.x - floating.width - gap;
    case 'right': return anchor.x + anchor.width + gap;
  }
}

function crossAxisCoord(anchor: Rect, floating: Rect, side: Side, align: Align, shift: number): number {
  const horizontal = side === 'top' || side === 'bottom';
  const anchorStart = horizontal ? anchor.x : anchor.y;
  const anchorSize = horizontal ? anchor.width : anchor.height;
  const floatingSize = horizontal ? floating.width : floating.height;
  switch (align) {
    case 'start': return anchorStart + shift;
    case 'center': return anchorStart + anchorSize / 2 - floatingSize / 2 + shift;
    case 'end': return anchorStart + anchorSize - floatingSize + shift;
  }
}

/**
 * Pure placement math over viewport-relative rects. Exposed separately from
 * the DOM wiring so behavior tests need no layout engine.
 */
export function computePosition(
  anchor: Rect,
  floating: Rect,
  viewport: { width: number; height: number },
  options: FloatingOptions = {},
): FloatingPosition {
  const {
    side = 'bottom',
    align = 'center',
    sideOffset = 0,
    alignOffset = 0,
    avoidCollisions = true,
    collisionPadding = 8,
  } = options;

  let usedSide = side;
  let main = mainAxisCoord(anchor, floating, side, sideOffset);

  if (avoidCollisions) {
    const size = side === 'top' || side === 'bottom' ? floating.height : floating.width;
    const limit = side === 'left' || side === 'top'
      ? main >= collisionPadding
      : main + size <= (side === 'bottom' ? viewport.height : viewport.width) - collisionPadding;
    if (!limit) {
      const flipped = OPPOSITE[side];
      const flippedMain = mainAxisCoord(anchor, floating, flipped, sideOffset);
      const flippedFits = flipped === 'top' || flipped === 'left'
        ? flippedMain >= collisionPadding
        : flippedMain + size <= (flipped === 'bottom' ? viewport.height : viewport.width) - collisionPadding;
      if (flippedFits) {
        usedSide = flipped;
        main = flippedMain;
      }
    }
  }

  let cross = crossAxisCoord(anchor, floating, usedSide, align, alignOffset);
  // Clamp the align axis into the viewport.
  const horizontal = usedSide === 'top' || usedSide === 'bottom';
  const crossViewport = horizontal ? viewport.width : viewport.height;
  const crossSize = horizontal ? floating.width : floating.height;
  cross = Math.min(
    Math.max(cross, collisionPadding),
    Math.max(collisionPadding, crossViewport - crossSize - collisionPadding),
  );

  return horizontal
    ? { x: cross, y: main, side: usedSide, align }
    : { x: main, y: cross, side: usedSide, align };
}

/**
 * Place an arrow on the anchor-facing edge of a positioned floating element.
 * Its cross-axis center follows the anchor and clamps inside rounded corners.
 */
export function computeArrowPosition(
  anchor: Rect,
  floating: Rect,
  position: FloatingPosition,
  arrow: Pick<Rect, 'width' | 'height'>,
  padding = 4,
): FloatingArrowPosition {
  const horizontal = position.side === 'top' || position.side === 'bottom';
  const anchorCenter = horizontal
    ? anchor.x + anchor.width / 2 - position.x - arrow.width / 2
    : anchor.y + anchor.height / 2 - position.y - arrow.height / 2;
  const crossSize = horizontal ? floating.width : floating.height;
  const arrowSize = horizontal ? arrow.width : arrow.height;
  const cross = Math.min(
    Math.max(anchorCenter, padding),
    Math.max(padding, crossSize - arrowSize - padding),
  );

  switch (position.side) {
    case 'top': return { left: cross, top: floating.height - arrow.height / 2, side: 'top' };
    case 'bottom': return { left: cross, top: -arrow.height / 2, side: 'bottom' };
    case 'left': return { left: floating.width - arrow.width / 2, top: cross, side: 'left' };
    case 'right': return { left: -arrow.width / 2, top: cross, side: 'right' };
  }
}

/**
 * Position `floating` against `anchor` and keep it positioned on scroll and
 * resize. Sets `position: fixed`, `left`/`top`, and `data-side`/`data-align`
 * (so shadcn `data-[side=…]` animation classes work). Returns a dispose
 * function — call it in `onCleanup` or when the layer closes.
 */
export function positionFloating(
  anchor: HTMLElement,
  floating: HTMLElement,
  options: FloatingOptions = {},
): () => void {
  const update = (): void => {
    const a = anchor.getBoundingClientRect();
    const f = floating.getBoundingClientRect();
    const pos = computePosition(
      { x: a.x, y: a.y, width: a.width, height: a.height },
      { x: f.x, y: f.y, width: f.width, height: f.height },
      { width: window.innerWidth, height: window.innerHeight },
      options,
    );
    floating.style.position = 'fixed';
    floating.style.left = `${pos.x}px`;
    floating.style.top = `${pos.y}px`;
    floating.setAttribute('data-side', pos.side);
    floating.setAttribute('data-align', pos.align);
    const variable = ORIGIN_VARIABLE_BY_SLOT[floating.dataset.slot ?? ''];
    if (variable) floating.style.setProperty(variable, transformOrigin(pos.side, pos.align));
    if (options.arrow) {
      const arrowRect = options.arrow.getBoundingClientRect();
      const arrowPos = computeArrowPosition(
        { x: a.x, y: a.y, width: a.width, height: a.height },
        { x: f.x, y: f.y, width: f.width, height: f.height },
        pos,
        { width: arrowRect.width, height: arrowRect.height },
        options.arrowPadding,
      );
      options.arrow.style.position = 'absolute';
      options.arrow.style.left = `${arrowPos.left}px`;
      options.arrow.style.top = `${arrowPos.top}px`;
      options.arrow.style.transformOrigin = 'center';
      options.arrow.style.transform = `rotate(${arrowRotation(arrowPos.side)}deg)`;
      options.arrow.setAttribute('data-side', arrowPos.side);
    }
  };

  update();
  window.addEventListener('scroll', update, true);
  window.addEventListener('resize', update);
  return () => {
    window.removeEventListener('scroll', update, true);
    window.removeEventListener('resize', update);
  };
}
