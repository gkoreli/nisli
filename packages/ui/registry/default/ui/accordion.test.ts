/**
 * accordion.test.ts — Accordion rendering, ARIA, keyboard nav, and interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './accordion.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function item(value: string, label: string, disabled?: boolean): TemplateResult {
  return AccordionItem({
    value,
    children: html`${AccordionTrigger({ disabled, children: label })}${AccordionContent({
      children: `Body ${label}`,
    })}`,
  });
}

function mountAccordion(
  opts: {
    type?: 'single' | 'multiple';
    collapsible?: boolean;
    defaultValue?: string | string[];
    value?: ReturnType<typeof signal<string | string[] | undefined>>;
    items?: TemplateResult;
  } = {},
): HTMLElement {
  const { type = 'single', collapsible, defaultValue, value, items } = opts;
  return mount(
    html`${Accordion({
      type,
      collapsible,
      defaultValue,
      value: value as unknown as string,
      children: items ?? html`${item('a', 'A')}${item('b', 'B')}`,
    })}`,
  );
}

const triggers = (r: ParentNode = document.body) =>
  Array.from(r.querySelectorAll<HTMLButtonElement>('[data-slot="accordion-trigger"]'));
const regions = (r: ParentNode = document.body) =>
  Array.from(r.querySelectorAll<HTMLElement>('[role="region"]'));
function click(el: Element): void {
  (el as HTMLElement).click();
  flushEffects();
  flushEffects();
}
function press(el: Element, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  flushEffects();
  flushEffects();
}

describe('Accordion — structure and ARIA', () => {
  it('renders header/button/region with wired ids, closed by default', () => {
    const c = mountAccordion();
    const [btnA] = triggers(c);
    const [regA] = regions(c);

    expect(c.querySelector('[data-slot="accordion"]')).not.toBeNull();
    expect(c.querySelector('[data-slot="accordion-item"]')).not.toBeNull();
    expect(btnA.closest('[data-slot="accordion-header"]')!.tagName).toBe('H3');

    expect(btnA.getAttribute('aria-expanded')).toBe('false');
    expect(btnA.getAttribute('data-state')).toBe('closed');
    expect(btnA.id).toBeTruthy();
    expect(regA.id).toBeTruthy();
    expect(btnA.getAttribute('aria-controls')).toBe(regA.id);
    expect(regA.getAttribute('aria-labelledby')).toBe(btnA.id);
    expect(regA.hasAttribute('hidden')).toBe(true);
  });

  it('projects the trigger label and carries the chevron svg', () => {
    const c = mountAccordion();
    const [btnA] = triggers(c);
    expect(btnA.textContent).toContain('A');
    const svg = btnA.querySelector('svg')!;
    expect(svg).not.toBeNull();
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    // chevron is a direct child of the button so the rotate hook applies
    expect(svg.parentElement).toBe(btnA);
  });

  it('opens the item named by defaultValue', () => {
    const c = mountAccordion({ defaultValue: 'a' });
    const [btnA, btnB] = triggers(c);
    const [regA] = regions(c);
    expect(btnA.getAttribute('aria-expanded')).toBe('true');
    expect(btnA.getAttribute('data-state')).toBe('open');
    expect(regA.hasAttribute('hidden')).toBe(false);
    expect(btnB.getAttribute('aria-expanded')).toBe('false');
    // item reflects open state too
    expect(btnA.closest('[data-slot="accordion-item"]')!.getAttribute('data-state')).toBe(
      'open',
    );
  });
});

describe('Accordion — single mode', () => {
  it('opens on click and only one item stays open', () => {
    const c = mountAccordion();
    const [btnA, btnB] = triggers(c);
    const [regA, regB] = regions(c);

    click(btnA);
    expect(btnA.getAttribute('aria-expanded')).toBe('true');
    expect(regA.hasAttribute('hidden')).toBe(false);

    click(btnB);
    expect(btnB.getAttribute('aria-expanded')).toBe('true');
    expect(btnA.getAttribute('aria-expanded')).toBe('false');
    expect(regA.hasAttribute('hidden')).toBe(true);
    expect(regB.hasAttribute('hidden')).toBe(false);
  });

  it('non-collapsible: clicking the open item keeps it open', () => {
    const c = mountAccordion({ defaultValue: 'a' });
    const [btnA] = triggers(c);
    click(btnA);
    expect(btnA.getAttribute('aria-expanded')).toBe('true');
  });

  it('collapsible: clicking the open item closes it', () => {
    const c = mountAccordion({ collapsible: true, defaultValue: 'a' });
    const [btnA] = triggers(c);
    click(btnA);
    expect(btnA.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('Accordion — multiple mode', () => {
  it('keeps several items open at once', () => {
    const c = mountAccordion({ type: 'multiple' });
    const [btnA, btnB] = triggers(c);
    click(btnA);
    click(btnB);
    expect(btnA.getAttribute('aria-expanded')).toBe('true');
    expect(btnB.getAttribute('aria-expanded')).toBe('true');

    click(btnA);
    expect(btnA.getAttribute('aria-expanded')).toBe('false');
    expect(btnB.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('Accordion — keyboard navigation', () => {
  it('ArrowDown/ArrowUp move focus between headers (no toggle)', () => {
    const c = mountAccordion();
    const [btnA, btnB] = triggers(c);
    btnA.focus();

    press(btnA, 'ArrowDown');
    expect(document.activeElement).toBe(btnB);
    expect(btnB.getAttribute('aria-expanded')).toBe('false'); // focus only, no open

    press(btnB, 'ArrowUp');
    expect(document.activeElement).toBe(btnA);
  });

  it('does not wrap; Home/End jump to first/last', () => {
    const c = mountAccordion({ items: html`${item('a', 'A')}${item('b', 'B')}${item('c', 'C')}` });
    const [btnA, , btnC] = triggers(c);
    btnA.focus();

    press(btnA, 'ArrowUp'); // already first, no wrap
    expect(document.activeElement).toBe(btnA);

    press(btnA, 'End');
    expect(document.activeElement).toBe(btnC);
    press(btnC, 'Home');
    expect(document.activeElement).toBe(btnA);
  });

  it('skips disabled triggers', () => {
    const c = mountAccordion({
      items: html`${item('a', 'A')}${item('b', 'B', true)}${item('c', 'C')}`,
    });
    const [btnA, btnB, btnC] = triggers(c);
    expect(btnB.hasAttribute('disabled')).toBe(true);
    btnA.focus();
    press(btnA, 'ArrowDown'); // skip disabled B -> C
    expect(document.activeElement).toBe(btnC);
  });

  it('a disabled trigger does not toggle on click', () => {
    const c = mountAccordion({ items: html`${item('a', 'A', true)}${item('b', 'B')}` });
    const [btnA] = triggers(c);
    click(btnA);
    expect(btnA.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('Accordion — ui-value-change event', () => {
  it('dispatches the open value (single) and array (multiple)', () => {
    const c = mountAccordion();
    const host = c.querySelector('ui-accordion') as HTMLElement;
    const onChange = vi.fn();
    host.addEventListener('ui-value-change', onChange as EventListener);

    click(triggers(c)[1]);
    expect((onChange.mock.calls[0][0] as CustomEvent).detail).toEqual({ value: 'b' });

    const c2 = mountAccordion({ type: 'multiple' });
    const host2 = c2.querySelector('ui-accordion') as HTMLElement;
    const onChange2 = vi.fn();
    host2.addEventListener('ui-value-change', onChange2 as EventListener);
    click(triggers(c2)[0]);
    expect((onChange2.mock.calls[0][0] as CustomEvent).detail).toEqual({ value: ['a'] });
  });
});

describe('Accordion — controlled value', () => {
  it('reflects an externally controlled value signal', () => {
    const value = signal<string | string[] | undefined>('a');
    const c = mountAccordion({ value });
    const [btnA, btnB] = triggers(c);
    expect(btnA.getAttribute('aria-expanded')).toBe('true');

    value.value = 'b';
    flushEffects();
    flushEffects();
    expect(btnA.getAttribute('aria-expanded')).toBe('false');
    expect(btnB.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('Accordion — misuse', () => {
  it('a trigger used outside <ui-accordion> renders an error fallback', () => {
    const host = document.createElement('ui-accordion-trigger');
    document.body.appendChild(host);
    expect(host.querySelector('[data-slot="accordion-trigger"]')).toBeNull();
    expect(host.textContent).toContain('Error');
  });
});

describe('Accordion — plain custom element usage', () => {
  // Parser (innerHTML) authoring connects parent-first, so nested children
  // resolve their accordion/item state; projection moves them into the inner
  // roots without re-running setup (ADR 0023 deferred-disconnect teardown), so
  // counts are exact — no ghost duplication.
  const triggerFor = (root: ParentNode, value: string) =>
    root.querySelector<HTMLButtonElement>(`[data-slot="accordion-trigger"][id$="-trigger-${value}"]`)!;

  it('reads type/value from attributes and projects labels', async () => {
    document.body.innerHTML =
      '<ui-accordion type="single" default-value="a">' +
      '<ui-accordion-item value="a">' +
      '<ui-accordion-trigger>A</ui-accordion-trigger>' +
      '<ui-accordion-content>Body A</ui-accordion-content>' +
      '</ui-accordion-item>' +
      '<ui-accordion-item value="b">' +
      '<ui-accordion-trigger>B</ui-accordion-trigger>' +
      '<ui-accordion-content>Body B</ui-accordion-content>' +
      '</ui-accordion-item>' +
      '</ui-accordion>';
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const acc = document.querySelector('ui-accordion')!;
    // Exactly one trigger/region per item — no ghosts.
    expect(triggers(acc)).toHaveLength(2);
    expect(regions(acc)).toHaveLength(2);
    expect(acc.querySelectorAll('[data-slot="accordion-item"]')).toHaveLength(2);

    const btnA = triggerFor(acc, 'a');
    expect(btnA.querySelector('span')!.textContent).toBe('A'); // label projected
    expect(btnA.getAttribute('aria-expanded')).toBe('true'); // default-value="a"
    expect(triggerFor(acc, 'b').getAttribute('aria-expanded')).toBe('false');
  });
});

describe('Accordion — height animation wiring', () => {
  it('sets --accordion-content-height from the content scrollHeight when open', async () => {
    const c = mountAccordion({ defaultValue: 'a' });
    const [regA] = regions(c);
    // measure() runs in a microtask once the region is displayed.
    await Promise.resolve();
    // happy-dom has no layout (scrollHeight 0), but the var is wired to a px
    // value so theme.css's accordion-down/up keyframes are no longer inert.
    expect(regA.style.getPropertyValue('--accordion-content-height')).toMatch(/px$/);
  });

  it('keeps the region present when open and hides it after close', () => {
    const c = mountAccordion({ collapsible: true, defaultValue: 'a' });
    const [regA] = regions(c);
    expect(regA.hasAttribute('hidden')).toBe(false);

    click(triggers(c)[0]); // collapse
    // No animation runs under happy-dom, so the region hides within the flush.
    expect(regA.hasAttribute('hidden')).toBe(true);
  });
});
