/**
 * tabs.test.ts — Tabs rendering, ARIA wiring, keyboard nav, and interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

/** Standard two/three-tab widget via factories. */
function mountTabs(
  opts: {
    defaultValue?: string;
    value?: ReturnType<typeof signal<string | undefined>>;
    orientation?: 'horizontal' | 'vertical';
    disabledC?: boolean;
    three?: boolean;
  } = {},
): HTMLElement {
  const { defaultValue = 'a', value, orientation, disabledC, three } = opts;
  const triggers = html`
    ${TabsTrigger({ value: 'a', children: 'Tab A' })}
    ${TabsTrigger({ value: 'b', children: 'Tab B' })}
    ${three ? TabsTrigger({ value: 'c', disabled: disabledC, children: 'Tab C' }) : ''}
  `;
  const contents = html`
    ${TabsContent({ value: 'a', children: 'Panel A' })}
    ${TabsContent({ value: 'b', children: 'Panel B' })}
    ${three ? TabsContent({ value: 'c', children: 'Panel C' }) : ''}
  `;
  return mount(
    html`${Tabs({
      defaultValue,
      value: value as unknown as string,
      orientation,
      children: html`${TabsList({ children: triggers })}${contents}`,
    })}`,
  );
}

function tabButtons(
  root: ParentNode = document.body,
): [HTMLButtonElement, HTMLButtonElement, ...HTMLButtonElement[]] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]')) as [
    HTMLButtonElement,
    HTMLButtonElement,
    ...HTMLButtonElement[],
  ];
}
function panels(root: ParentNode = document.body): [HTMLElement, HTMLElement, ...HTMLElement[]] {
  return Array.from(root.querySelectorAll<HTMLElement>('[role="tabpanel"]')) as [
    HTMLElement,
    HTMLElement,
    ...HTMLElement[],
  ];
}
function press(el: Element, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  flushEffects();
  flushEffects();
}

describe('Tabs — structure and ARIA', () => {
  it('renders tablist/tab/tabpanel roles with the default selection', () => {
    const c = mountTabs();
    expect(c.querySelector('[data-slot="tabs"]')).not.toBeNull();
    expect(c.querySelector('[role="tablist"]')).not.toBeNull();

    const [tabA, tabB] = tabButtons(c);
    const [panelA, panelB] = panels(c);

    expect(tabA.getAttribute('aria-selected')).toBe('true');
    expect(tabB.getAttribute('aria-selected')).toBe('false');
    expect(tabA.getAttribute('data-state')).toBe('active');
    expect(tabB.getAttribute('data-state')).toBe('inactive');
    expect(tabA.getAttribute('tabindex')).toBe('0');
    expect(tabB.getAttribute('tabindex')).toBe('-1');

    expect(panelA.hasAttribute('hidden')).toBe(false);
    expect(panelB.hasAttribute('hidden')).toBe(true);
    expect(panelA.textContent).toBe('Panel A');
  });

  it('wires aria-controls/aria-labelledby to matching ids', () => {
    const c = mountTabs();
    const [tabA] = tabButtons(c);
    const [panelA] = panels(c);

    expect(tabA.id).toBeTruthy();
    expect(panelA.id).toBeTruthy();
    expect(tabA.getAttribute('aria-controls')).toBe(panelA.id);
    expect(panelA.getAttribute('aria-labelledby')).toBe(tabA.id);
  });

  it('sets aria-orientation on the tablist', () => {
    const c = mountTabs({ orientation: 'vertical' });
    expect(c.querySelector('[role="tablist"]')!.getAttribute('aria-orientation')).toBe(
      'vertical',
    );
  });
});

describe('Tabs — pointer selection', () => {
  it('clicking a trigger selects it and swaps the visible panel', () => {
    const c = mountTabs();
    const [tabA, tabB] = tabButtons(c);
    const [panelA, panelB] = panels(c);

    tabB.click();
    flushEffects();
    flushEffects();

    expect(tabB.getAttribute('aria-selected')).toBe('true');
    expect(tabA.getAttribute('aria-selected')).toBe('false');
    expect(tabB.getAttribute('data-state')).toBe('active');
    expect(panelB.hasAttribute('hidden')).toBe(false);
    expect(panelA.hasAttribute('hidden')).toBe(true);
    expect(tabB.getAttribute('tabindex')).toBe('0');
    expect(tabA.getAttribute('tabindex')).toBe('-1');
  });
});

describe('Tabs — keyboard navigation (automatic activation)', () => {
  it('ArrowRight/ArrowLeft move focus and selection', () => {
    const c = mountTabs();
    const [tabA, tabB] = tabButtons(c);
    tabA.focus();

    press(tabA, 'ArrowRight');
    expect(document.activeElement).toBe(tabB);
    expect(tabB.getAttribute('aria-selected')).toBe('true');

    press(tabB, 'ArrowLeft');
    expect(document.activeElement).toBe(tabA);
    expect(tabA.getAttribute('aria-selected')).toBe('true');
  });

  it('wraps at the ends', () => {
    const c = mountTabs();
    const [tabA, tabB] = tabButtons(c);
    tabA.focus();

    press(tabA, 'ArrowLeft'); // wrap to last
    expect(document.activeElement).toBe(tabB);
    expect(tabB.getAttribute('aria-selected')).toBe('true');
  });

  it('Home/End jump to first/last', () => {
    const c = mountTabs({ three: true });
    const buttons = tabButtons(c);
    buttons[0].focus();

    press(buttons[0], 'End');
    expect(document.activeElement).toBe(buttons[2]!);
    expect(buttons[2]!.getAttribute('aria-selected')).toBe('true');

    press(buttons[2]!, 'Home');
    expect(document.activeElement).toBe(buttons[0]);
    expect(buttons[0].getAttribute('aria-selected')).toBe('true');
  });

  it('navigates vertically with ArrowUp/ArrowDown when orientation=vertical', () => {
    const c = mountTabs({ orientation: 'vertical' });
    const [tabA, tabB] = tabButtons(c);
    tabA.focus();

    press(tabA, 'ArrowRight'); // inert on vertical axis
    expect(document.activeElement).toBe(tabA);

    press(tabA, 'ArrowDown');
    expect(document.activeElement).toBe(tabB);
    expect(tabB.getAttribute('aria-selected')).toBe('true');
  });

  it('skips disabled triggers and does not select them on click', () => {
    const c = mountTabs({ three: true, disabledC: true });
    const [tabA, tabB, tabC] = tabButtons(c) as [HTMLButtonElement, HTMLButtonElement, HTMLButtonElement];
    expect(tabC!.hasAttribute('disabled')).toBe(true);

    tabB.focus();
    press(tabB, 'ArrowRight'); // C disabled -> wrap to A
    expect(document.activeElement).toBe(tabA);

    tabC!.click();
    flushEffects();
    flushEffects();
    expect(tabC!.getAttribute('aria-selected')).toBe('false');
    expect(tabA.getAttribute('aria-selected')).toBe('true');
  });
});

describe('Tabs — ui-value-change event', () => {
  it('dispatches a bubbling ui-value-change with the new value', () => {
    const c = mountTabs();
    const host = c.querySelector('ui-tabs') as HTMLElement;
    const onChange = vi.fn();
    host.addEventListener('ui-value-change', onChange as EventListener);

    tabButtons(c)[1].click();
    flushEffects();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0]![0] as CustomEvent).detail).toEqual({ value: 'b' });
  });

  it('does not re-dispatch when the already-selected trigger is clicked', () => {
    const c = mountTabs();
    const host = c.querySelector('ui-tabs') as HTMLElement;
    const onChange = vi.fn();
    host.addEventListener('ui-value-change', onChange as EventListener);

    tabButtons(c)[0]!.click(); // 'a' already selected
    flushEffects();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Tabs — controlled value', () => {
  it('reflects an externally controlled value signal', () => {
    const value = signal<string | undefined>('a');
    const c = mountTabs({ value });
    const [tabA, tabB] = tabButtons(c);
    expect(tabA.getAttribute('aria-selected')).toBe('true');

    value.value = 'b';
    flushEffects();
    flushEffects();
    expect(tabB.getAttribute('aria-selected')).toBe('true');
    expect(tabA.getAttribute('aria-selected')).toBe('false');
  });
});

describe('Tabs — plain custom element usage', () => {
  // Plain-HTML consumers author markup (the innerHTML parse path), which
  // connects each element parent-first so nested children resolve their
  // <ui-tabs> state, and projection moves them into the inner roots without
  // re-running setup (ADR 0023 deferred-disconnect teardown) — so counts are
  // exact, no duplication.
  const byValue = (root: ParentNode, v: string) =>
    root.querySelector<HTMLButtonElement>(`[role="tab"][data-value="${v}"]`)!;
  const visiblePanel = (root: ParentNode) =>
    Array.from(root.querySelectorAll<HTMLElement>('[role="tabpanel"]')).find(
      (p) => !p.hasAttribute('hidden'),
    )!;

  it('reads default-value + values from attributes and projects labels', async () => {
    document.body.innerHTML =
      '<ui-tabs default-value="b">' +
      '<ui-tabs-list>' +
      '<ui-tabs-trigger value="a">A</ui-tabs-trigger>' +
      '<ui-tabs-trigger value="b">B</ui-tabs-trigger>' +
      '</ui-tabs-list>' +
      '<ui-tabs-content value="a">Panel A</ui-tabs-content>' +
      '<ui-tabs-content value="b">Panel B</ui-tabs-content>' +
      '</ui-tabs>';
    // Projection of parser-appended children settles across microtasks.
    await Promise.resolve();
    await Promise.resolve();

    const tabs = document.querySelector('ui-tabs')!;
    expect(tabs.querySelectorAll('[role="tablist"]')).toHaveLength(1);
    // Exactly one button per trigger and one panel per content — no ghosts.
    expect(tabButtons(tabs)).toHaveLength(2);
    expect(panels(tabs)).toHaveLength(2);

    const tabA = byValue(tabs, 'a');
    const tabB = byValue(tabs, 'b');
    expect(tabA.textContent).toBe('A'); // label projected into the button
    expect(tabB.textContent).toBe('B');

    // default-value="b" is the initial selection.
    expect(tabB.getAttribute('aria-selected')).toBe('true');
    expect(tabA.getAttribute('aria-selected')).toBe('false');
    expect(tabB.getAttribute('data-state')).toBe('active');

    expect(visiblePanel(tabs).textContent).toBe('Panel B');
  });

  it('reads value/disabled from a trigger attribute', async () => {
    document.body.innerHTML =
      '<ui-tabs default-value="a">' +
      '<ui-tabs-list>' +
      '<ui-tabs-trigger value="a">A</ui-tabs-trigger>' +
      '<ui-tabs-trigger value="b" disabled>B</ui-tabs-trigger>' +
      '</ui-tabs-list>' +
      '</ui-tabs>';
    await Promise.resolve();
    await Promise.resolve();

    const tabs = document.querySelector('ui-tabs')!;
    expect(tabButtons(tabs)).toHaveLength(2);
    expect(byValue(tabs, 'a').getAttribute('aria-selected')).toBe('true');
    expect(byValue(tabs, 'b').hasAttribute('disabled')).toBe(true);
  });
});

describe('Tabs — value-root regression matrix (UI-30 3A)', () => {
  const byValue = (root: ParentNode, v: string) =>
    root.querySelector<HTMLButtonElement>(`[role="tab"][data-value="${v}"]`)!;

  it('BARE-PARSE: authored value="b" selects at connect; component-path click reflects the new value attr', async () => {
    // The `value` attribute is authored at PARSE (not default-value), so the
    // SEED-AT-CONNECT path must render tab B selected at connect.
    document.body.innerHTML =
      '<ui-tabs value="b">' +
      '<ui-tabs-list>' +
      '<ui-tabs-trigger value="a">A</ui-tabs-trigger>' +
      '<ui-tabs-trigger value="b">B</ui-tabs-trigger>' +
      '</ui-tabs-list>' +
      '<ui-tabs-content value="a">Panel A</ui-tabs-content>' +
      '<ui-tabs-content value="b">Panel B</ui-tabs-content>' +
      '</ui-tabs>';
    await Promise.resolve();
    await Promise.resolve();

    const tabs = document.querySelector('ui-tabs')!;
    expect(byValue(tabs, 'b').getAttribute('aria-selected')).toBe('true');
    expect(byValue(tabs, 'a').getAttribute('aria-selected')).toBe('false');

    // Change via the REAL COMPONENT PATH (click the other trigger).
    byValue(tabs, 'a').click();
    flushEffects();
    flushEffects();
    expect(byValue(tabs, 'a').getAttribute('aria-selected')).toBe('true');
    expect(byValue(tabs, 'b').getAttribute('aria-selected')).toBe('false');
    // The ROOT's value attribute reflects the new selection.
    expect(tabs.getAttribute('value')).toBe('a');
  });

  it('CONTROLLED: component-path click fires ui-value-change but the guard preserves the pinned attr; parent signal drives selection', () => {
    const value = signal<string | undefined>('b');
    const c = mountTabs({ value });
    const host = c.querySelector('ui-tabs') as HTMLElement;
    const onChange = vi.fn();
    host.addEventListener('ui-value-change', onChange as EventListener);
    flushEffects();
    // The reflect effect mirrors the pinned signal onto the attribute.
    expect(host.getAttribute('value')).toBe('b');
    const [tabA, tabB] = tabButtons(c);
    expect(tabB.getAttribute('aria-selected')).toBe('true');

    // A click calls state.setValue('a'). Because `value` is pinned (controlled),
    // the guard skips the attribute write — the parent stays in control.
    tabA.click();
    flushEffects();
    expect((onChange.mock.calls[0]![0] as CustomEvent).detail).toEqual({ value: 'a' });
    expect(host.getAttribute('value')).toBe('b'); // guard held: attr NOT clobbered
    expect(tabB.getAttribute('aria-selected')).toBe('true'); // selection unchanged

    // The parent responds by updating the signal → reflect effect + selection.
    value.value = 'a';
    flushEffects();
    flushEffects();
    expect(host.getAttribute('value')).toBe('a');
    expect(tabA.getAttribute('aria-selected')).toBe('true');
    expect(tabB.getAttribute('aria-selected')).toBe('false');
  });
});

describe('Tabs — misuse', () => {
  it('a trigger used outside <ui-tabs> renders an error fallback', () => {
    const __err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const host = document.createElement('ui-tabs-trigger');
    host.setAttribute('value', 'a');
    document.body.appendChild(host);

    // Setup error boundary catches the thrown error and renders a fallback;
    // no [role="tab"] is produced.
    expect(host.querySelector('[role="tab"]')).toBeNull();
    expect(host.textContent).toContain('Error');
    expect(String(__err.mock.calls.flat())).toContain('must be used inside <ui-tabs>');
    __err.mockRestore();
  });
});
