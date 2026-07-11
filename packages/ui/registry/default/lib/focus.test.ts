/**
 * focus.test.ts — focus trap wrap + focus restore.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ref, type Ref } from '@nisli/core';
import { focusTrap, type FocusTrapController, type FocusTrapOptions } from './focus.js';

// focusTrap installs a document keydown listener while active; track traps and
// deactivate them after each test so listeners never leak across tests.
const created: FocusTrapController[] = [];
function trap(root: Ref<HTMLElement>, options?: FocusTrapOptions): FocusTrapController {
  const t = focusTrap(root, options);
  created.push(t);
  return t;
}

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  for (const t of created) t.deactivate();
  created.length = 0;
});

/** A trigger outside the trap + a root with `count` tabbable buttons. */
function scene(count = 3): {
  root: Ref<HTMLElement>;
  rootEl: HTMLElement;
  buttons: HTMLButtonElement[];
  trigger: HTMLButtonElement;
} {
  const trigger = document.createElement('button');
  trigger.textContent = 'trigger';
  const rootEl = document.createElement('div');
  const buttons: HTMLButtonElement[] = [];
  for (let i = 0; i < count; i++) {
    const b = document.createElement('button');
    b.textContent = `b${i}`;
    rootEl.appendChild(b);
    buttons.push(b);
  }
  document.body.append(trigger, rootEl);
  const root = ref<HTMLElement>();
  root.current = rootEl;
  return { root, rootEl, buttons, trigger };
}

function tab(shiftKey = false): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }),
  );
}

describe('focusTrap — activate/restore', () => {
  it('focuses the first tabbable on activate', () => {
    const { root, buttons } = scene();
    trap(root).activate();
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('honors initialFocus', () => {
    const { root, buttons } = scene();
    const initialFocus = ref<HTMLElement>();
    initialFocus.current = buttons[2];
    trap(root, { initialFocus }).activate();
    expect(document.activeElement).toBe(buttons[2]);
  });

  it('restores focus to the trigger on deactivate', () => {
    const { root, trigger } = scene();
    trigger.focus();
    const t = trap(root);
    t.activate();
    expect(document.activeElement).not.toBe(trigger);
    t.deactivate();
    expect(document.activeElement).toBe(trigger);
  });

  it('honors returnFocus override on deactivate', () => {
    const { root, buttons, trigger } = scene();
    trigger.focus();
    const returnFocus = ref<HTMLElement>();
    returnFocus.current = buttons[1];
    const t = trap(root, { returnFocus });
    t.activate();
    t.deactivate();
    expect(document.activeElement).toBe(buttons[1]);
  });

  it('focuses the root when there is nothing tabbable inside', () => {
    const rootEl = document.createElement('div');
    document.body.appendChild(rootEl);
    const root = ref<HTMLElement>();
    root.current = rootEl;
    trap(root).activate();
    expect(document.activeElement).toBe(rootEl);
    expect(rootEl.getAttribute('tabindex')).toBe('-1');
  });
});

describe('focusTrap — Tab wrapping', () => {
  it('Tab from the last tabbable wraps to the first', () => {
    const { root, buttons } = scene();
    trap(root).activate();
    buttons[2].focus();
    tab();
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('Shift+Tab from the first tabbable wraps to the last', () => {
    const { root, buttons } = scene();
    trap(root).activate();
    buttons[0].focus();
    tab(true);
    expect(document.activeElement).toBe(buttons[2]);
  });

  it('does not wrap when focus is on a middle item', () => {
    const { root, buttons } = scene();
    trap(root).activate();
    buttons[1].focus();
    tab();
    expect(document.activeElement).toBe(buttons[1]); // native Tab handled by browser
  });

  it('pulls focus back inside when it has escaped the root', () => {
    const { root, buttons, trigger } = scene();
    trap(root).activate();
    trigger.focus(); // focus escaped the trap
    tab();
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('skips disabled elements when computing first/last', () => {
    const { root, buttons } = scene();
    buttons[0].setAttribute('disabled', ''); // first tabbable is now b1
    buttons[2].setAttribute('disabled', ''); // last tabbable is now b1
    trap(root).activate();
    expect(document.activeElement).toBe(buttons[1]);
    buttons[1].focus();
    tab(); // b1 is both first and last enabled -> wraps to itself (first)
    expect(document.activeElement).toBe(buttons[1]);
  });

  it('stops trapping after deactivate', () => {
    const { root, buttons } = scene();
    const t = trap(root);
    t.activate();
    t.deactivate();
    buttons[2].focus();
    tab();
    expect(document.activeElement).toBe(buttons[2]); // no wrap after deactivate
  });
});

describe('focusTrap — idempotency', () => {
  it('activate/deactivate are idempotent', () => {
    const { root, trigger } = scene();
    trigger.focus();
    const t = trap(root);
    t.activate();
    t.activate();
    t.deactivate();
    t.deactivate();
    expect(document.activeElement).toBe(trigger);
  });
});
