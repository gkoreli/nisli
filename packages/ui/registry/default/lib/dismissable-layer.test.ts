/**
 * dismissable-layer.test.ts — escape + outside-pointer dismissal, LIFO stack.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref, type Ref } from '@nisli/core';
import {
  dismissableLayer,
  type DismissableLayerController,
  type DismissableLayerOptions,
} from './dismissable-layer.js';

// The layer stack is module-level; track every layer created in a test and
// deactivate them afterward so state never leaks between tests.
const created: DismissableLayerController[] = [];
function layer(root: Ref<HTMLElement>, options: DismissableLayerOptions): DismissableLayerController {
  const l = dismissableLayer(root, options);
  created.push(l);
  return l;
}

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  for (const l of created) l.deactivate();
  created.length = 0;
});

/** A connected root element wrapped in a Ref, plus a sibling "outside" node. */
function scene(): { root: Ref<HTMLElement>; inside: HTMLElement; outside: HTMLElement } {
  const rootEl = document.createElement('div');
  const inside = document.createElement('button');
  rootEl.appendChild(inside);
  const outside = document.createElement('button');
  document.body.append(rootEl, outside);
  const root = ref<HTMLElement>();
  root.current = rootEl;
  return { root, inside, outside };
}

function escape(): boolean {
  return document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  );
}
function pointerDown(el: Element): void {
  el.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
}

describe('dismissableLayer — escape', () => {
  it('dismisses on Escape while active', () => {
    const { root } = scene();
    const onDismiss = vi.fn();
    const l = layer(root, { onDismiss });
    l.activate();

    escape();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss after deactivate', () => {
    const { root } = scene();
    const onDismiss = vi.fn();
    const l = layer(root, { onDismiss });
    l.activate();
    l.deactivate();

    escape();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('onEscapeKeyDown can preventDefault to keep the layer open', () => {
    const { root } = scene();
    const onDismiss = vi.fn();
    const l = layer(root, {
      onDismiss,
      onEscapeKeyDown: (e) => e.preventDefault(),
    });
    l.activate();

    escape();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('ignores non-Escape keys', () => {
    const { root } = scene();
    const onDismiss = vi.fn();
    layer(root, { onDismiss }).activate();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('dismissableLayer — outside pointer', () => {
  it('dismisses on pointerdown outside the root', () => {
    const { root, outside } = scene();
    const onDismiss = vi.fn();
    layer(root, { onDismiss }).activate();

    pointerDown(outside);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss on pointerdown inside the root', () => {
    const { root, inside } = scene();
    const onDismiss = vi.fn();
    layer(root, { onDismiss }).activate();

    pointerDown(inside);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('onPointerDownOutside can preventDefault to keep the layer open', () => {
    const { root, outside } = scene();
    const onDismiss = vi.fn();
    layer(root, {
      onDismiss,
      onPointerDownOutside: (e) => e.preventDefault(),
    }).activate();

    pointerDown(outside);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('dismissableLayer — LIFO stack', () => {
  it('only the topmost layer responds to Escape (innermost-first)', () => {
    const outer = scene();
    const inner = scene();
    const onOuter = vi.fn();
    const onInner = vi.fn();
    const outerLayer = layer(outer.root, { onDismiss: onOuter });
    const innerLayer = layer(inner.root, { onDismiss: onInner });
    outerLayer.activate();
    innerLayer.activate();

    escape();
    expect(onInner).toHaveBeenCalledTimes(1);
    expect(onOuter).not.toHaveBeenCalled();

    // Inner closes; Escape now reaches the outer layer.
    innerLayer.deactivate();
    escape();
    expect(onOuter).toHaveBeenCalledTimes(1);
    expect(onInner).toHaveBeenCalledTimes(1);
  });

  it('outside-pointer dismissal targets only the top layer', () => {
    const outer = scene();
    const inner = scene();
    const onOuter = vi.fn();
    const onInner = vi.fn();
    layer(outer.root, { onDismiss: onOuter }).activate();
    layer(inner.root, { onDismiss: onInner }).activate();

    // A point outside the inner root (but the top layer is inner) dismisses inner.
    pointerDown(outer.inside);
    expect(onInner).toHaveBeenCalledTimes(1);
    expect(onOuter).not.toHaveBeenCalled();
  });
});

describe('dismissableLayer — idempotency', () => {
  it('activate/deactivate are idempotent', () => {
    const { root } = scene();
    const onDismiss = vi.fn();
    const l = layer(root, { onDismiss });
    l.activate();
    l.activate(); // no double-registration
    escape();
    expect(onDismiss).toHaveBeenCalledTimes(1);

    l.deactivate();
    l.deactivate(); // no throw
    escape();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
