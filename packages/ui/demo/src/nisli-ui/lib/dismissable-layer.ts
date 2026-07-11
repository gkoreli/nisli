/**
 * lib/dismissable-layer.ts — escape-key + outside-pointer dismissal.
 *
 * Behavior ported from Radix UI's DismissableLayer (MIT —
 * https://github.com/radix-ui/primitives), the primitive shadcn/ui's dialog,
 * popover, and dropdown wrap. Rebuilt on Nisli lifecycle.
 *
 * A layer, once activated, dismisses when the user presses Escape or points
 * down outside its root element. Layers form a LIFO stack: only the topmost
 * layer responds, so nested layers (e.g. a popover inside a dialog) dismiss
 * innermost-first. Operates on the component's inner root element (via a Ref),
 * never the `display: contents` host (ADR 0022).
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import { hasContext, onCleanup, type Ref } from '@nisli/core';

export interface DismissableLayerOptions {
  /** Called when the layer is dismissed (Escape or outside pointer). */
  onDismiss: () => void;
  /** Runs before dismissal on Escape; call `preventDefault()` to keep open. */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  /** Runs before dismissal on outside pointer; `preventDefault()` to keep open. */
  onPointerDownOutside?: (event: PointerEvent) => void;
}

export interface DismissableLayerController {
  /** Push onto the layer stack and begin listening. Idempotent. */
  activate(): void;
  /** Remove from the layer stack. Idempotent. */
  deactivate(): void;
}

interface LayerEntry {
  rootRef: Ref<HTMLElement>;
  options: DismissableLayerOptions;
}

// ── Shared layer stack + document listeners ─────────────────────────

const stack: LayerEntry[] = [];
let listening = false;

function top(): LayerEntry | undefined {
  return stack[stack.length - 1];
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  const layer = top();
  if (!layer) return;
  layer.options.onEscapeKeyDown?.(event);
  if (!event.defaultPrevented) layer.options.onDismiss();
}

function handlePointerDown(event: PointerEvent): void {
  const layer = top();
  if (!layer) return;
  const root = layer.rootRef.current;
  // Inside the top layer's root → not a dismissal.
  if (!root || root.contains(event.target as Node)) return;
  layer.options.onPointerDownOutside?.(event);
  if (!event.defaultPrevented) layer.options.onDismiss();
}

function startListening(): void {
  if (listening) return;
  listening = true;
  // Capture phase: observe the event before app handlers can stop it.
  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('pointerdown', handlePointerDown, true);
}

function stopListening(): void {
  if (!listening) return;
  listening = false;
  document.removeEventListener('keydown', handleKeyDown, true);
  document.removeEventListener('pointerdown', handlePointerDown, true);
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Create a dismissable layer bound to `rootRef`. Call `activate()` when the
 * layer opens and `deactivate()` when it closes; both are idempotent. When
 * created during component setup, the layer auto-deactivates on disconnect.
 *
 * ```ts
 * const layer = dismissableLayer(contentRef, { onDismiss: () => setOpen(false) });
 * effect(() => (open.value ? layer.activate() : layer.deactivate()));
 * ```
 */
export function dismissableLayer(
  rootRef: Ref<HTMLElement>,
  options: DismissableLayerOptions,
): DismissableLayerController {
  const entry: LayerEntry = { rootRef, options };

  const activate = (): void => {
    if (stack.includes(entry)) return;
    stack.push(entry);
    startListening();
  };

  const deactivate = (): void => {
    const i = stack.indexOf(entry);
    if (i === -1) return;
    stack.splice(i, 1);
    if (stack.length === 0) stopListening();
  };

  // Never leak a stack entry if the owning component disconnects while open.
  if (hasContext()) onCleanup(deactivate);

  return { activate, deactivate };
}
