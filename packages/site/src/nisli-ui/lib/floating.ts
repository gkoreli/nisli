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
 * Deliberate v1 limits (document in consumers): no arrow positioning, no
 * `shift` beyond align-axis clamping, no anchor-resize observation, and
 * `position: fixed` is trapped by transformed/filtered ancestors (same caveat
 * as ui-dialog; upstream solves it with portals).
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

export type Side = 'top' | 'right' | 'bottom' | 'left';
export type Align = 'start' | 'center' | 'end';

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
}

export interface FloatingPosition {
  x: number;
  y: number;
  /** The side actually used after collision handling. */
  side: Side;
  align: Align;
}

const OPPOSITE: Record<Side, Side> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

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
  };

  update();
  window.addEventListener('scroll', update, true);
  window.addEventListener('resize', update);
  return () => {
    window.removeEventListener('scroll', update, true);
    window.removeEventListener('resize', update);
  };
}
