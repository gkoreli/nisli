/**
 * Overlay — the decisions the engine makes about things that float: what a
 * layer is, which one an Escape or an outside pointer reaches, where a menu
 * goes. Every function here is pure: data in, data out, no DOM, no signals.
 * The kernel's `useOverlay()` is the behaviour that drives them.
 *
 * Vocabulary:
 *   layer     — one floating thing that is open right now, of a `kind`
 *   modal     — a dialog: dismissed by Escape and an outside pointer, traps
 *               focus, locks scroll, restores focus when it closes
 *   popover   — a menu: dismissed by Escape and an outside pointer, no trap,
 *               no lock, restores focus to its trigger
 *   passive   — a notice: nothing dismisses it by keyboard, it never takes
 *               focus, and it is transparent to routing — a notice above a
 *               dialog does not swallow the dialog's Escape
 *   stack     — the open layers in opening order; the last is the top, and the
 *               topmost non-passive layer (`reach`) is the only layer an Escape
 *               or an outside pointer reaches
 */
import { metrics } from '../metrics.js';

export type LayerKind = 'modal' | 'popover' | 'passive';

export interface Layer {
  readonly id: number;
  readonly kind: LayerKind;
  /** What dismisses it: Escape, a pointer outside its surface. */
  readonly dismiss: { readonly escape: boolean; readonly outside: boolean };
  /** Focus stays inside while it is open. */
  readonly trap: boolean;
  /** The document does not scroll while it is open. */
  readonly lock: boolean;
  /** Focus returns to where it was (or to the anchor) when it closes. */
  readonly restoreFocus: boolean;
}

/** The z-index base per kind; widened from the literal metrics so a test can pass its own. */
export type LayerBase = { readonly [K in LayerKind]: number };

/** What a kind means, as flags. */
export function defaults(kind: LayerKind): Omit<Layer, 'id'> {
  switch (kind) {
    case 'modal': return { kind, dismiss: { escape: true, outside: true }, trap: true, lock: true, restoreFocus: true };
    case 'popover': return { kind, dismiss: { escape: true, outside: true }, trap: false, lock: false, restoreFocus: true };
    case 'passive': return { kind, dismiss: { escape: false, outside: false }, trap: false, lock: false, restoreFocus: false };
  }
}

/** A layer of `kind` with its default flags. */
export function layer(id: number, kind: LayerKind): Layer {
  return { id, ...defaults(kind) };
}

/** The open layers, bottom to top. Immutable: every operation returns a new stack. */
export type LayerStack = readonly Layer[];

export const EMPTY_STACK: LayerStack = [];

/** Open a layer: it becomes the top. Re-pushing an id moves it to the top. */
export function push(stack: LayerStack, l: Layer): LayerStack {
  return [...stack.filter((x) => x.id !== l.id), l];
}

/** Close a layer by id; a stack without it is returned unchanged. */
export function pop(stack: LayerStack, id: number): LayerStack {
  return stack.some((x) => x.id === id) ? stack.filter((x) => x.id !== id) : stack;
}

/** The topmost layer of any kind; null when nothing is open. */
export function top(stack: LayerStack): Layer | null {
  return stack.length ? stack[stack.length - 1]! : null;
}

/** The layer an Escape or an outside pointer can reach: the topmost non-passive layer; null when none is open. */
export function reach(stack: LayerStack): Layer | null {
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i]!.kind !== 'passive') return stack[i]!;
  return null;
}

/** True while any open layer locks scroll. */
export function locks(stack: LayerStack): boolean {
  return stack.some((l) => l.lock);
}

/**
 * Which layer, if any, an Escape reaches: the topmost non-passive layer, when
 * it dismisses on Escape. A layer below it is never reached — one Escape
 * closes one thing — and a passive layer above it is not in the way.
 */
export function escapeTarget(stack: LayerStack): Layer | null {
  const t = reach(stack);
  return t && t.dismiss.escape ? t : null;
}

/**
 * Which layer, if any, a pointer reaches: the topmost non-passive layer, when
 * it dismisses on an outside pointer and the pointer was not inside it or
 * inside any layer above it (`inside`). A pointer inside a layer above the
 * target — a notice over a dialog — never dismisses layers below.
 */
export function pointerTarget(stack: LayerStack, inside: boolean): Layer | null {
  const t = reach(stack);
  return t && t.dismiss.outside && !inside ? t : null;
}

/**
 * A layer's z-index: its kind's base plus its position in the stack, so a
 * later layer of the same kind paints above an earlier one and a notice
 * (passive, base 200) floats above every modal. A layer that is not open
 * sits at its base.
 */
export function zIndexOf(stack: LayerStack, id: number, kind: LayerKind, base: LayerBase = metrics.layer): number {
  const i = stack.findIndex((l) => l.id === id);
  return base[kind] + Math.max(0, i);
}

export interface Rect { readonly top: number; readonly left: number; readonly width: number; readonly height: number }
export interface Size { readonly width: number; readonly height: number }
export interface Placement { readonly top: number; readonly left: number }
export interface PlaceOptions {
  /** Space between anchor and menu, px. Default 0. */
  readonly gap?: number;
  /** Which edges to align first: the anchor's leading edge, or its trailing edge. Default leading. */
  readonly align?: 'leading' | 'trailing';
  /** Writing direction: leading is left in `ltr` (default) and right in `rtl`. */
  readonly dir?: 'ltr' | 'rtl';
}

/**
 * Where a popover goes, in viewport coordinates: below its anchor when it
 * fits, else above when that fits, else below; its preferred edge aligned to
 * the anchor's, flipping to the other edge when the preferred one would leave
 * the viewport; then clamped so the menu stays inside. Leading is the left
 * edge in `ltr` and the right edge in `rtl`. A pure function of three
 * rectangles.
 */
export function placeMenu(anchor: Rect, menu: Size, viewport: Size, options: PlaceOptions = {}): Placement {
  const gap = options.gap ?? 0;
  const below = anchor.top + anchor.height + gap;
  const above = anchor.top - gap - menu.height;
  const fitsBelow = below + menu.height <= viewport.height;
  const fitsAbove = above >= 0;
  const top = fitsBelow || !fitsAbove ? below : above;
  const atLeft = anchor.left;
  const atRight = anchor.left + anchor.width - menu.width;
  const fitsLeft = atLeft + menu.width <= viewport.width;
  const fitsRight = atRight >= 0;
  const rtl = options.dir === 'rtl';
  const wantRight = (options.align === 'trailing') !== rtl;
  const left = wantRight
    ? (fitsRight || !fitsLeft ? atRight : atLeft)
    : (fitsLeft || !fitsRight ? atLeft : atRight);
  return {
    top: clamp(top, 0, Math.max(0, viewport.height - menu.height)),
    left: clamp(left, 0, Math.max(0, viewport.width - menu.width)),
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
