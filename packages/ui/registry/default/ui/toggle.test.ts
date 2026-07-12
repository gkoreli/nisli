/**
 * toggle.test.ts — Toggle pressed-state behavior and interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import { Toggle, toggleVariants } from './toggle.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function getToggle(c: ParentNode = document.body): HTMLButtonElement {
  return c.querySelector('[data-slot="toggle"]') as HTMLButtonElement;
}

describe('Toggle via factory', () => {
  it('renders off by default with v4 classes', () => {
    const c = mount(html`${Toggle({ children: 'Bold' })}`);
    const btn = getToggle(c);

    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.getAttribute('data-state')).toBe('off');
    expect(btn.className).toContain('data-[state=on]:bg-accent');
    expect(btn.className).toBe(`${toggleVariants({})}`);
  });

  it('toggles on click and dispatches ui-pressed-change', () => {
    const onChange = vi.fn();
    const c = mount(html`<div @ui-pressed-change=${onChange}>${Toggle({ children: 'B' })}</div>`);
    const btn = getToggle(c);

    btn.click();
    flushEffects();
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.getAttribute('data-state')).toBe('on');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0].detail).toEqual({ pressed: true });

    btn.click();
    flushEffects();
    expect(btn.getAttribute('data-state')).toBe('off');
  });

  it('respects defaultPressed and a controlled pressed signal', () => {
    const c1 = mount(html`${Toggle({ defaultPressed: true, children: 'B' })}`);
    expect(getToggle(c1).getAttribute('data-state')).toBe('on');

    document.body.innerHTML = '';
    const pressed = signal<boolean | undefined>(false);
    const c2 = mount(html`${Toggle({ pressed, children: 'B' })}`);
    const btn = getToggle(c2);
    btn.click();
    flushEffects();
    // Controlled: click dispatched but the prop still wins.
    expect(btn.getAttribute('data-state')).toBe('off');
    pressed.value = true;
    flushEffects();
    flushEffects();
    expect(btn.getAttribute('data-state')).toBe('on');
  });

  it('applies outline variant and sizes', () => {
    const c = mount(html`${Toggle({ variant: 'outline', size: 'sm', children: 'B' })}`);
    const btn = getToggle(c);
    expect(btn.className).toContain('border-input');
    expect(btn.className).toContain('min-w-8');
  });

  it('does not toggle when disabled', () => {
    const c = mount(html`${Toggle({ disabled: true, children: 'B' })}`);
    const btn = getToggle(c);
    btn.click();
    flushEffects();
    expect(btn.getAttribute('data-state')).toBe('off');
    expect(btn.hasAttribute('disabled')).toBe(true);
  });
});

describe('Toggle as a plain custom element', () => {
  it('reads bare pressed attribute and variant, projects children', () => {
    const host = document.createElement('ui-toggle');
    host.setAttribute('pressed', '');
    host.setAttribute('variant', 'outline');
    host.append('B');
    document.body.appendChild(host);

    const btn = getToggle(host);
    expect(btn.getAttribute('data-state')).toBe('on');
    expect(btn.className).toContain('border-input');
    expect(btn.textContent).toBe('B');
  });

  it('live setAttribute/removeAttribute pressed drives state', () => {
    const host = document.createElement('ui-toggle');
    host.append('B');
    document.body.appendChild(host);
    const btn = getToggle(host);
    expect(btn.getAttribute('data-state')).toBe('off');

    host.setAttribute('pressed', '');
    flushEffects();
    expect(btn.getAttribute('data-state')).toBe('on');
    expect(btn.getAttribute('aria-pressed')).toBe('true');

    host.removeAttribute('pressed');
    flushEffects();
    expect(btn.getAttribute('data-state')).toBe('off');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('seeds from the default-pressed attribute', () => {
    const host = document.createElement('ui-toggle');
    host.setAttribute('default-pressed', '');
    host.append('B');
    document.body.appendChild(host);
    const btn = getToggle(host);
    expect(btn.getAttribute('data-state')).toBe('on');
    expect(host.hasAttribute('pressed')).toBe(true);
  });

  it('explicit pressed="false" beats default-pressed', () => {
    const host = document.createElement('ui-toggle');
    host.setAttribute('pressed', 'false');
    host.setAttribute('default-pressed', '');
    host.append('B');
    document.body.appendChild(host);
    const btn = getToggle(host);
    expect(btn.getAttribute('data-state')).toBe('off');
  });

  it('controlled-guard: pinned pressed signal ignores clicks but still fires the event', () => {
    const onChange = vi.fn();
    const pressed = signal<boolean | undefined>(false);
    const c = mount(
      html`<div @ui-pressed-change=${onChange}>${Toggle({ pressed, children: 'B' })}</div>`,
    );
    const btn = getToggle(c);

    btn.click();
    flushEffects();
    // Click is guarded (the pinned prop wins) but the change event still fires.
    expect(btn.getAttribute('data-state')).toBe('off');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0].detail).toEqual({ pressed: true });

    // The parent signal drives the resolved state.
    pressed.value = true;
    flushEffects();
    flushEffects();
    expect(btn.getAttribute('data-state')).toBe('on');
    expect(host_pressedReflected(c)).toBe(true);
  });
});

describe('Toggle — pressed-root regression matrix (UI-30 finding 2)', () => {
  it('BARE-PARSE: bare `<ui-toggle pressed>` is on at connect; component-path click clears the pressed attr', async () => {
    document.body.innerHTML = '<ui-toggle pressed>B</ui-toggle>';
    await Promise.resolve();
    await Promise.resolve();

    const host = document.querySelector('ui-toggle') as HTMLElement;
    const btn = getToggle(host);
    expect(host.hasAttribute('pressed')).toBe(true);
    expect(btn.getAttribute('data-state')).toBe('on');

    // Click it off via the COMPONENT path.
    btn.click();
    flushEffects();
    expect(host.hasAttribute('pressed')).toBe(false); // attribute CLEARS (uncontrolled)
    expect(btn.getAttribute('data-state')).toBe('off');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('CONTROLLED: pinned pressed=true → click requests false, attr + state REMAIN true, event fires; parent signal=false reflects/clears', () => {
    const onChange = vi.fn();
    const pressed = signal<boolean | undefined>(true);
    const c = mount(
      html`<div @ui-pressed-change=${onChange}>${Toggle({ pressed, children: 'B' })}</div>`,
    );
    const host = c.querySelector('ui-toggle') as HTMLElement;
    const btn = getToggle(c);
    flushEffects();
    // The reflect effect mirrors the pinned signal onto the attribute.
    expect(host.hasAttribute('pressed')).toBe(true);
    expect(btn.getAttribute('data-state')).toBe('on');

    // A click calls setPressed(false). Because `pressed` is pinned (controlled),
    // the guard skips the attribute write — the parent stays in control.
    btn.click();
    flushEffects();
    expect(host.hasAttribute('pressed')).toBe(true); // guard held: attr stays true
    expect(btn.getAttribute('data-state')).toBe('on'); // state stays on
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0].detail).toEqual({ pressed: false });

    // The parent responds by clearing the signal → reflect effect clears the attr.
    pressed.value = false;
    flushEffects();
    flushEffects();
    expect(host.hasAttribute('pressed')).toBe(false);
    expect(btn.getAttribute('data-state')).toBe('off');
  });
});

function host_pressedReflected(c: ParentNode): boolean {
  return (c.querySelector('ui-toggle') as HTMLElement).hasAttribute('pressed');
}
