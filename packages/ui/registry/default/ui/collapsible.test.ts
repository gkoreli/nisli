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

  it('mounts open from literal `open` markup, then the trigger closes it', async () => {
    // The `open` attribute is present at PARSE, so the SEED-AT-CONNECT path (not
    // attributeChangedCallback) must render the content OPEN at connect.
    document.body.innerHTML =
      '<ui-collapsible open>' +
      '<ui-collapsible-trigger>Toggle</ui-collapsible-trigger>' +
      '<ui-collapsible-content>Body</ui-collapsible-content>' +
      '</ui-collapsible>';
    await Promise.resolve();
    await Promise.resolve();

    const root = document.querySelector('ui-collapsible')!;
    const content = q(root, 'collapsible-content');
    expect(content.hasAttribute('hidden')).toBe(false);
    expect(content.getAttribute('data-state')).toBe('open');

    // Close via the COMPONENT path (the trigger toggles it closed).
    click(q(root, 'collapsible-trigger'));
    expect(content.hasAttribute('hidden')).toBe(true);
    expect(content.getAttribute('data-state')).toBe('closed');
  });

  it('setAttribute("open") on a plain host opens it; removeAttribute closes it', async () => {
    document.body.innerHTML =
      '<ui-collapsible>' +
      '<ui-collapsible-trigger>Toggle</ui-collapsible-trigger>' +
      '<ui-collapsible-content>Body</ui-collapsible-content>' +
      '</ui-collapsible>';
    await Promise.resolve();
    await Promise.resolve();

    const root = document.querySelector('ui-collapsible')!;
    expect(q(root, 'collapsible-content').hasAttribute('hidden')).toBe(true);
    expect(q(root, 'collapsible-trigger').getAttribute('aria-expanded')).toBe('false');

    root.setAttribute('open', '');
    flushEffects();
    flushEffects();
    expect(q(root, 'collapsible-content').hasAttribute('hidden')).toBe(false);
    expect(q(root, 'collapsible-trigger').getAttribute('aria-expanded')).toBe('true');
    expect(q(root, 'collapsible').getAttribute('data-state')).toBe('open');

    root.removeAttribute('open');
    flushEffects();
    flushEffects();
    expect(q(root, 'collapsible-content').hasAttribute('hidden')).toBe(true);
    expect(q(root, 'collapsible-trigger').getAttribute('aria-expanded')).toBe('false');
  });

  it('explicit open="false" beats default-open (stays closed)', async () => {
    document.body.innerHTML =
      '<ui-collapsible default-open open="false">' +
      '<ui-collapsible-trigger>Toggle</ui-collapsible-trigger>' +
      '<ui-collapsible-content>Body</ui-collapsible-content>' +
      '</ui-collapsible>';
    await Promise.resolve();
    await Promise.resolve();

    const root = document.querySelector('ui-collapsible')!;
    expect(q(root, 'collapsible-content').hasAttribute('hidden')).toBe(true);
    expect(q(root, 'collapsible').getAttribute('data-state')).toBe('closed');
  });
});

describe('Collapsible — controlled guard', () => {
  it('controlled (factory open signal): setOpen is guarded, the parent stays in control', () => {
    const open = signal<boolean | undefined>(true);
    const c = mountCollapsible({ open });
    const host = c.querySelector('ui-collapsible') as HTMLElement;
    const content = q(c, 'collapsible-content');
    const onChange = vi.fn();
    host.addEventListener('ui-open-change', onChange as EventListener);
    flushEffects();
    // The reflect effect mirrors the pinned signal onto the attribute.
    expect(host.hasAttribute('open')).toBe(true);
    expect(content.hasAttribute('hidden')).toBe(false);

    // A trigger click calls state.setOpen(false). Because `open` is a pinned
    // factory prop (controlled), the guard skips the attribute write — the parent
    // stays in control (attr NOT cleared) and only the event fires.
    click(q(c, 'collapsible-trigger'));
    expect(host.hasAttribute('open')).toBe(true); // guard held
    expect(content.hasAttribute('hidden')).toBe(false);
    expect((onChange.mock.calls.at(-1)![0] as CustomEvent).detail).toEqual({ open: false });

    // The parent responds by updating the signal → reflect effect closes it.
    open.value = false;
    flushEffects();
    flushEffects();
    expect(host.hasAttribute('open')).toBe(false);
    expect(content.hasAttribute('hidden')).toBe(true);
  });
});
