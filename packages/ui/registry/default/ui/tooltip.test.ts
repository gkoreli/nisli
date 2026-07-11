/**
 * tooltip.test.ts — Tooltip show/hide, delay manager, ARIA, and interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import { Tooltip, TooltipTrigger, TooltipContent } from './tooltip.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});
afterEach(() => {
  // Flush the skip-delay window so module state doesn't leak between tests.
  vi.runAllTimers();
  vi.useRealTimers();
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function mountTooltip(
  opts: { delayDuration?: number; open?: ReturnType<typeof signal<boolean | undefined>> } = {},
): HTMLElement {
  const { delayDuration, open } = opts;
  return mount(
    html`${Tooltip({
      delayDuration,
      open: open as unknown as boolean,
      children: html`${TooltipTrigger({ children: 'Hover' })}
      ${TooltipContent({ children: 'Tip' })}`,
    })}`,
  );
}

const q = (root: ParentNode, slot: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
const isOpen = (root: ParentNode) => !q(root, 'tooltip-content').hasAttribute('hidden');
function fire(el: Element, type: string): void {
  el.dispatchEvent(new Event(type, { bubbles: true }));
  flushEffects();
  flushEffects();
}
function advance(ms: number): void {
  vi.advanceTimersByTime(ms);
  flushEffects();
  flushEffects();
}

describe('Tooltip — structure and ARIA', () => {
  it('wires trigger aria-describedby to the content, closed initially', () => {
    const c = mountTooltip();
    const trigger = q(c, 'tooltip-trigger');
    const content = q(c, 'tooltip-content');
    expect(content.getAttribute('role')).toBe('tooltip');
    expect(content.id).toBeTruthy();
    expect(trigger.getAttribute('aria-describedby')).toBe(content.id);
    expect(content.hasAttribute('hidden')).toBe(true);
    expect(trigger.getAttribute('data-state')).toBe('closed');
  });
});

describe('Tooltip — hover/focus with delay', () => {
  it('opens after the delay on pointerenter, not before', () => {
    const c = mountTooltip({ delayDuration: 500 });
    fire(q(c, 'tooltip-trigger'), 'pointerenter');
    expect(isOpen(c)).toBe(false); // still within delay
    advance(500);
    expect(isOpen(c)).toBe(true);
    expect(q(c, 'tooltip-trigger').getAttribute('data-state')).toBe('open');
  });

  it('opens instantly when delayDuration is 0', () => {
    const c = mountTooltip({ delayDuration: 0 });
    fire(q(c, 'tooltip-trigger'), 'pointerenter');
    expect(isOpen(c)).toBe(true);
  });

  it('opens on focus and closes on blur', () => {
    const c = mountTooltip({ delayDuration: 0 });
    fire(q(c, 'tooltip-trigger'), 'focus');
    expect(isOpen(c)).toBe(true);
    fire(q(c, 'tooltip-trigger'), 'blur');
    expect(isOpen(c)).toBe(false);
  });

  it('cancels a pending open when the pointer leaves before the delay', () => {
    const c = mountTooltip({ delayDuration: 500 });
    fire(q(c, 'tooltip-trigger'), 'pointerenter');
    advance(200);
    fire(q(c, 'tooltip-trigger'), 'pointerleave');
    advance(500);
    expect(isOpen(c)).toBe(false);
  });
});

describe('Tooltip — dismissal', () => {
  it('closes on pointerdown', () => {
    const c = mountTooltip({ delayDuration: 0 });
    fire(q(c, 'tooltip-trigger'), 'pointerenter');
    expect(isOpen(c)).toBe(true);
    fire(q(c, 'tooltip-trigger'), 'pointerdown');
    expect(isOpen(c)).toBe(false);
  });

  it('closes on Escape', () => {
    const c = mountTooltip({ delayDuration: 0 });
    fire(q(c, 'tooltip-trigger'), 'pointerenter');
    expect(isOpen(c)).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    flushEffects();
    flushEffects();
    expect(isOpen(c)).toBe(false);
  });
});

describe('Tooltip — provider semantics', () => {
  it('only one tooltip is open at a time', () => {
    const a = mountTooltip({ delayDuration: 0 });
    const b = mountTooltip({ delayDuration: 0 });
    fire(q(a, 'tooltip-trigger'), 'pointerenter');
    expect(isOpen(a)).toBe(true);
    fire(q(b, 'tooltip-trigger'), 'pointerenter');
    flushEffects();
    flushEffects();
    expect(isOpen(b)).toBe(true);
    expect(isOpen(a)).toBe(false);
  });

  it('skip-delay: after one closes, the next opens instantly within the window', () => {
    const a = mountTooltip({ delayDuration: 500 });
    const b = mountTooltip({ delayDuration: 500 });
    // Open A (after delay), then close it — starting the skip window.
    fire(q(a, 'tooltip-trigger'), 'pointerenter');
    advance(500);
    expect(isOpen(a)).toBe(true);
    fire(q(a, 'tooltip-trigger'), 'pointerleave');
    expect(isOpen(a)).toBe(false);
    // Within the skip window, B opens without waiting out its delay.
    fire(q(b, 'tooltip-trigger'), 'pointerenter');
    expect(isOpen(b)).toBe(true);
  });
});

describe('Tooltip — controlled', () => {
  it('reflects an externally controlled open signal', () => {
    const open = signal<boolean | undefined>(false);
    const c = mountTooltip({ open });
    expect(isOpen(c)).toBe(false);
    open.value = true;
    flushEffects();
    flushEffects();
    expect(isOpen(c)).toBe(true);
  });
});

describe('Tooltip — misuse', () => {
  it('a trigger used outside <ui-tooltip> renders an error fallback', () => {
    const host = document.createElement('ui-tooltip-trigger');
    document.body.appendChild(host);
    expect(host.querySelector('[data-slot="tooltip-trigger"]')).toBeNull();
    expect(host.textContent).toContain('Error');
  });
});

describe('Tooltip — plain custom element usage', () => {
  it('projects trigger + content, exact element counts', async () => {
    document.body.innerHTML =
      '<ui-tooltip>' +
      '<ui-tooltip-trigger>Hover</ui-tooltip-trigger>' +
      '<ui-tooltip-content>Tip</ui-tooltip-content>' +
      '</ui-tooltip>';
    await Promise.resolve();
    await Promise.resolve();

    const root = document.querySelector('ui-tooltip')!;
    expect(root.querySelectorAll('[data-slot="tooltip-trigger"]')).toHaveLength(1);
    expect(root.querySelectorAll('[data-slot="tooltip-content"]')).toHaveLength(1);
    expect(q(root, 'tooltip-trigger').textContent).toBe('Hover');
    expect(q(root, 'tooltip-content').textContent).toBe('Tip');
  });
});
