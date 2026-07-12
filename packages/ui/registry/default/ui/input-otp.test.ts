/**
 * input-otp.test.ts — InputOTP: single native input + slot presentation.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flush, flushEffects, html, signal, type TemplateResult } from '@nisli/core';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from './input-otp.js';
import './label.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult, into: HTMLElement = document.body): HTMLElement {
  const container = document.createElement('div');
  into.appendChild(container);
  template.mount(container);
  return container;
}

function slots(count: number): TemplateResult {
  const parts = Array.from({ length: count }, (_, i) => InputOTPSlot({ index: i }));
  // A signal holding an array of factory results renders each (real consumers
  // write the slots out explicitly; this is just a dynamic-count test helper).
  return InputOTPGroup({ children: signal(parts) as unknown as TemplateResult });
}

function mountOTP(props: Record<string, unknown> = {}, count = 6, into?: HTMLElement): HTMLElement {
  return mount(
    html`${InputOTP({ maxLength: count, ...props, children: slots(count) })}`,
    into,
  );
}

const input = (r: ParentNode) =>
  r.querySelector<HTMLInputElement>('[data-slot="input-otp-input"]')!;
const slotEls = (r: ParentNode): [HTMLElement, HTMLElement, HTMLElement, HTMLElement, ...HTMLElement[]] =>
  Array.from(r.querySelectorAll<HTMLElement>('[data-slot="input-otp-slot"]')) as [
    HTMLElement,
    HTMLElement,
    HTMLElement,
    HTMLElement,
    ...HTMLElement[],
  ];

/** Simulate typing `text` into the single input. */
function type(r: ParentNode, text: string): void {
  const el = input(r);
  el.value = text;
  el.setSelectionRange(text.length, text.length);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  flushEffects();
  flushEffects();
}

describe('InputOTP — structure', () => {
  it('renders one native input overlaying N slot divs', () => {
    const c = mountOTP();
    const el = input(c);
    expect(el.tagName).toBe('INPUT');
    expect(el.getAttribute('maxlength')).toBe('6');
    expect(el.getAttribute('autocomplete')).toBe('one-time-code');
    expect(el.className).toContain('opacity-0');
    expect(slotEls(c)).toHaveLength(6);
  });

  it('host is layout-transparent', () => {
    const c = mountOTP();
    expect((c.querySelector('ui-input-otp') as HTMLElement).style.display).toBe('contents');
  });

  it('targets first and last painted slots through their transparent hosts', () => {
    const c = mountOTP({}, 3);
    const group = c.querySelector<HTMLElement>('[data-slot="input-otp-group"]')!;
    expect([...group.children].map((child) => child.tagName)).toEqual([
      'UI-INPUT-OTP-SLOT', 'UI-INPUT-OTP-SLOT', 'UI-INPUT-OTP-SLOT',
    ]);
    expect(group.className).toContain(
      '[&>ui-input-otp-slot:first-child>[data-slot=input-otp-slot]]:border-l',
    );
    expect(group.className).toContain(
      '[&>ui-input-otp-slot:last-child>[data-slot=input-otp-slot]]:rounded-r-md',
    );
    expect(slotEls(c)[1].className).not.toContain('first:rounded-l-md');
    expect(slotEls(c)[1].className).not.toContain('last:rounded-r-md');
    expect(slotEls(c)[1].className).not.toContain('first:border-l');
  });

  it('renders a minus separator', () => {
    const c = mount(html`${InputOTP({ maxLength: 2, children: InputOTPSeparator({}) })}`);
    const sep = c.querySelector('[data-slot="input-otp-separator"]') as HTMLElement;
    expect(sep.getAttribute('role')).toBe('separator');
    expect(sep.querySelector('svg')).not.toBeNull();
  });
});

describe('InputOTP — typing', () => {
  it('distributes characters into the slots', () => {
    const c = mountOTP();
    type(c, '123');
    const s = slotEls(c);
    expect(s[0].textContent).toContain('1');
    expect(s[1].textContent).toContain('2');
    expect(s[2].textContent).toContain('3');
    expect(s[3].textContent?.trim()).toBe('');
  });

  it('marks the active slot and shows a fake caret while focused', () => {
    const c = mountOTP();
    input(c).dispatchEvent(new Event('focus', { bubbles: true }));
    type(c, '12');
    const s = slotEls(c);
    // caret at index 2 (next empty) → active + fake caret.
    expect(s[2].getAttribute('data-active')).toBe('true');
    expect(s[2].querySelector('.animate-caret-blink')).not.toBeNull();
    expect(s[0].getAttribute('data-active')).toBe('false');
  });

  it('emits ui-value-change on input and ui-complete when full', () => {
    const c = mountOTP({}, 4);
    const onChange = vi.fn();
    const onComplete = vi.fn();
    const host = c.querySelector('ui-input-otp') as HTMLElement;
    host.addEventListener('ui-value-change', (e) => onChange((e as CustomEvent).detail));
    host.addEventListener('ui-complete', (e) => onComplete((e as CustomEvent).detail));

    type(c, '12');
    expect(onChange).toHaveBeenLastCalledWith({ value: '12' });
    expect(onComplete).not.toHaveBeenCalled();

    type(c, '1234');
    expect(onComplete).toHaveBeenCalledWith({ value: '1234' });
  });
});

describe('InputOTP — pattern + caps', () => {
  it('filters characters not matching the pattern', () => {
    const c = mountOTP({ pattern: '[0-9]' });
    type(c, '1a2b3');
    expect(input(c).value).toBe('123');
    expect(input(c).getAttribute('inputmode')).toBe('numeric');
  });

  it('caps input at maxLength', () => {
    const c = mountOTP({}, 4);
    type(c, '1234567');
    expect(input(c).value).toBe('1234');
  });
});

describe('InputOTP — native form participation', () => {
  it('forwards id/name and associates with a label', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    mountOTP({ id: 'otp', name: 'otp' }, 6, form);
    mount(html`${InputOTP({})}`); // noop guard against cross-test leakage

    const el = form.querySelector('[data-slot="input-otp-input"]') as HTMLInputElement;
    expect(el.id).toBe('otp');
    expect(form.elements.namedItem('otp')).toBe(el);
  });

  it('restores the initial value on form.reset()', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    mountOTP({ name: 'otp', defaultValue: '42' }, 6, form);

    const el = form.querySelector('[data-slot="input-otp-input"]') as HTMLInputElement;
    expect(el.value).toBe('42');
    el.value = '99';
    form.reset();
    expect(el.value).toBe('42');
  });
});

// ── Slot aria-invalid forwarding (UI-36A: active+invalid visual parity) ──
// Upstream spreads {...props}, landing aria-invalid on the slot div that owns
// the aria-invalid: / data-[active=true]:aria-invalid:* hooks. Our transparent
// host can't do that implicitly, so ui-input-otp-slot forwards it onto the
// inner element. Without a reachable path those parity tokens are dead CSS.

describe('InputOTPSlot — aria-invalid forwarding', () => {
  const oneSlot = (props: Record<string, unknown> = {}): HTMLElement =>
    mount(
      html`${InputOTP({
        maxLength: 6,
        value: 'ABCDEF',
        children: InputOTPGroup({ children: InputOTPSlot({ index: 0, ...props }) }),
      })}`,
    );

  it('forwards the ariaInvalid factory prop onto the inner slot div', () => {
    const c = oneSlot({ ariaInvalid: true });
    flushEffects();
    const slot = c.querySelector('[data-slot="input-otp-slot"]') as HTMLElement;
    expect(slot.getAttribute('aria-invalid')).toBe('true');
  });

  it('aria-invalid is live: host setAttribute after mount updates the inner slot div', () => {
    const c = oneSlot();
    flushEffects();
    const slot = c.querySelector('[data-slot="input-otp-slot"]') as HTMLElement;
    const host = c.querySelector('ui-input-otp-slot') as HTMLElement;
    // Unset → attribute absent (so `aria-invalid:` selectors stay dormant).
    expect(slot.getAttribute('aria-invalid')).toBeNull();

    host.setAttribute('aria-invalid', 'true');
    flushEffects();
    // Now data-active + aria-invalid can co-occur on one element, so the
    // data-[active=true]:aria-invalid:* hooks are actually reachable.
    expect(slot.getAttribute('aria-invalid')).toBe('true');
    expect(slot.getAttribute('data-active')).not.toBeNull();

    // ARIA tri-state: "false" means not-invalid → attribute cleared.
    host.setAttribute('aria-invalid', 'false');
    flushEffects();
    expect(slot.getAttribute('aria-invalid')).toBeNull();
  });
});

describe('InputOTP — misuse', () => {
  it('renders the setup error boundary for a slot outside a root', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = mount(html`${InputOTPSlot({ index: 0 })}`);
    expect(c.querySelector('[data-slot="input-otp-slot"]')).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ── Live attribute residuals (UI-30 batch-1, rev delta) ─────────────
// These attributes were one-time host.getAttribute() reads pre-migration; now
// declared in attrs{}, so a post-mount setAttribute must flow through.

describe('InputOTP — live attribute residuals', () => {
  it("max-length is live: setAttribute after mount updates the inner input (rev repro)", () => {
    document.body.innerHTML = '<ui-input-otp max-length="4"></ui-input-otp>';
    flushEffects();
    const el = input(document.body);
    expect(el.getAttribute('maxlength')).toBe('4');
    (document.body.querySelector('ui-input-otp') as HTMLElement).setAttribute('max-length', '2');
    flushEffects();
    expect(el.getAttribute('maxlength')).toBe('2');
  });

  it('pattern is live: setAttribute after mount changes character filtering', () => {
    document.body.innerHTML = '<ui-input-otp max-length="6"></ui-input-otp>';
    flushEffects();
    const el = input(document.body);
    // No pattern → letters pass through.
    el.value = 'a1';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    flushEffects();
    flushEffects();
    expect(el.value).toBe('a1');
    // A digits-only pattern applied live → the next input filters letters out.
    (document.body.querySelector('ui-input-otp') as HTMLElement).setAttribute('pattern', '[0-9]');
    flushEffects();
    el.value = 'b2c3';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    flushEffects();
    flushEffects();
    expect(el.value).toBe('23');
  });

  it('slot index is live: setAttribute updates which char the slot renders', () => {
    const c = mount(
      html`${InputOTP({ maxLength: 6, value: 'ABCDEF', children: InputOTPGroup({ children: InputOTPSlot({}) }) })}`,
    );
    flushEffects();
    flushEffects();
    const slot = c.querySelector('[data-slot="input-otp-slot"]') as HTMLElement;
    expect(slot.textContent).toContain('A'); // default index 0
    (c.querySelector('ui-input-otp-slot') as HTMLElement).setAttribute('index', '2');
    flushEffects();
    expect(slot.textContent).toContain('C'); // index 2
  });
});
