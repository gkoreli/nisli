/**
 * collapsible.test.ts — Collapsible rendering, toggle, ARIA, and interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from './collapsible.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function mountCollapsible(
  opts: {
    defaultOpen?: boolean;
    open?: ReturnType<typeof signal<boolean | undefined>>;
    disabled?: boolean;
  } = {},
): HTMLElement {
  const { defaultOpen, open, disabled } = opts;
  return mount(
    html`${Collapsible({
      defaultOpen,
      open: open as unknown as boolean,
      disabled,
      children: html`${CollapsibleTrigger({ children: 'Toggle' })}
      ${CollapsibleContent({ children: 'Body' })}`,
    })}`,
  );
}

const q = (root: ParentNode, slot: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
function click(el: Element): void {
  (el as HTMLElement).click();
  flushEffects();
  flushEffects();
}

describe('Collapsible — structure and ARIA', () => {
  it('wires trigger aria-controls/aria-expanded to the content, closed by default', () => {
    const c = mountCollapsible();
    const trigger = q(c, 'collapsible-trigger');
    const content = q(c, 'collapsible-content');

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('data-state')).toBe('closed');
    expect(content.id).toBeTruthy();
    expect(trigger.getAttribute('aria-controls')).toBe(content.id);
    expect(content.hasAttribute('hidden')).toBe(true);
    expect(content.getAttribute('data-state')).toBe('closed');
    expect(q(c, 'collapsible').getAttribute('data-state')).toBe('closed');
  });

  it('is open when defaultOpen is set', () => {
    const c = mountCollapsible({ defaultOpen: true });
    expect(q(c, 'collapsible-trigger').getAttribute('aria-expanded')).toBe('true');
    expect(q(c, 'collapsible-content').hasAttribute('hidden')).toBe(false);
    expect(q(c, 'collapsible').getAttribute('data-state')).toBe('open');
  });
});

describe('Collapsible — toggle', () => {
  it('toggles open and closed on trigger click', () => {
    const c = mountCollapsible();
    const trigger = q(c, 'collapsible-trigger');
    const content = q(c, 'collapsible-content');

    click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(content.hasAttribute('hidden')).toBe(false);

    click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(content.hasAttribute('hidden')).toBe(true);
  });

  it('dispatches ui-open-change with the new state', () => {
    const c = mountCollapsible();
    const host = c.querySelector('ui-collapsible') as HTMLElement;
    const onChange = vi.fn();
    host.addEventListener('ui-open-change', onChange as EventListener);

    click(q(c, 'collapsible-trigger'));
    expect((onChange.mock.calls[0]![0] as CustomEvent).detail).toEqual({ open: true });
  });
});

describe('Collapsible — disabled', () => {
  it('does not toggle when disabled and exposes data-disabled', () => {
    const c = mountCollapsible({ disabled: true });
    const trigger = q(c, 'collapsible-trigger') as HTMLButtonElement;
    expect(trigger.hasAttribute('disabled')).toBe(true);
    expect(trigger.hasAttribute('data-disabled')).toBe(true);
    expect(q(c, 'collapsible').hasAttribute('data-disabled')).toBe(true);

    click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('Collapsible — controlled', () => {
  it('reflects an externally controlled open signal', () => {
    const open = signal<boolean | undefined>(false);
    const c = mountCollapsible({ open });
    expect(q(c, 'collapsible-content').hasAttribute('hidden')).toBe(true);

    open.value = true;
    flushEffects();
    flushEffects();
    expect(q(c, 'collapsible-content').hasAttribute('hidden')).toBe(false);
  });
});

describe('Collapsible — misuse', () => {
  it('a trigger used outside <ui-collapsible> renders an error fallback', () => {
    const __err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const host = document.createElement('ui-collapsible-trigger');
    document.body.appendChild(host);
    expect(host.querySelector('[data-slot="collapsible-trigger"]')).toBeNull();
    expect(host.textContent).toContain('Error');
    expect(String(__err.mock.calls.flat())).toContain('must be used inside <ui-collapsible>');
    __err.mockRestore();
  });
});

describe('Collapsible — plain custom element usage', () => {
  it('reads default-open + projects content, exact element counts', async () => {
    document.body.innerHTML =
      '<ui-collapsible default-open>' +
      '<ui-collapsible-trigger>Toggle</ui-collapsible-trigger>' +
      '<ui-collapsible-content>Body</ui-collapsible-content>' +
      '</ui-collapsible>';
    await Promise.resolve();
    await Promise.resolve();

    const root = document.querySelector('ui-collapsible')!;
    expect(root.querySelectorAll('[data-slot="collapsible-trigger"]')).toHaveLength(1);
    expect(root.querySelectorAll('[data-slot="collapsible-content"]')).toHaveLength(1);
    expect(q(root, 'collapsible-trigger').textContent).toBe('Toggle');
    expect(q(root, 'collapsible-content').textContent).toBe('Body');
    expect(q(root, 'collapsible-content').hasAttribute('hidden')).toBe(false); // default-open
  });
});
