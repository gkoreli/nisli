/**
 * The Form's decisions, proven in happy-dom at width: presence, dependent
 * choices, validation timing and announcement, how a choice is offered,
 * the draft lifecycle, layout, bounds, read-only, live mode, busy.
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { flushEffects, signal, el } from '@nisli/core';
import { setMeasurer } from '../engine/measure.js';
import { metrics } from '../metrics.js';
import { __notices } from './notice.js';
import { Form, type Field, type FormHandle } from './form.js';

let width = 800;
beforeEach(() => { document.body.innerHTML = ''; document.body.style.overflow = ''; __notices.value = []; setMeasurer(() => width); });
afterEach(() => setMeasurer(null));

const make = (props: Record<string, unknown>, w = 800) => {
  width = w;
  const e = document.createElement('nisli-form');
  for (const [k, v] of Object.entries({ onSubmit: () => {}, ...props })) (e as any)._setProp(k, v);
  document.body.appendChild(e);
  flushEffects();
  return e;
};
const owned = (fields: readonly Field<any>[], initial: Record<string, unknown> = {}, extra: Record<string, unknown> = {}, w = 800) =>
  make({ fields, owned: true, initial, key: 1, ...extra }, w);
const submit = (e: HTMLElement) => { e.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true })); flushEffects(); };
const type = (e: HTMLElement, key: string, v: string) => { const i = e.querySelector<HTMLInputElement>(`#f-${key}`)!; i.value = v; i.dispatchEvent(new Event('input')); flushEffects(); };
const blur = (e: HTMLElement, key: string) => { e.querySelector(`#f-${key}`)!.dispatchEvent(new Event('blur')); flushEffects(); };
const choose = (e: HTMLElement, key: string, v: string) => { const s = e.querySelector<HTMLSelectElement>(`select#f-${key}`)!; s.value = v; s.dispatchEvent(new Event('change')); flushEffects(); };
const settle = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); flushEffects(); };

describe('rule 1 — presence', () => {
  const fields: Field<any>[] = [
    { key: 'kind', label: 'Kind', kind: 'select', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }, { value: 'd', label: 'D' }] },
    { key: 'amount', label: 'Amount', kind: 'money', required: true, when: (d) => d.kind === 'a' },
  ];
  it('a field whose when() is false is not rendered, is omitted on submit, and its error is cleared', () => {
    const got: unknown[] = [];
    const e = owned(fields, { kind: 'a', amount: 5 }, { onSubmit: (v: unknown) => { got.push(v); } });
    expect(e.querySelector('#f-amount')).not.toBeNull();
    type(e, 'amount', ''); submit(e);
    expect(e.textContent).toContain('Amount is required.');
    choose(e, 'kind', 'b');
    expect(e.querySelector('#f-amount')).toBeNull();
    expect(e.textContent).not.toContain('Amount is required.');
    submit(e);
    expect(got).toEqual([{ kind: 'b' }]);
  });
});

describe('rule 2 — dependent options', () => {
  it('re-evaluates options(draft) on every change and clears a value no longer offered', () => {
    const fields: Field<any>[] = [
      { key: 'country', label: 'Country', kind: 'select', options: [{ value: 'ge', label: 'GE' }, { value: 'fr', label: 'FR' }, { value: 'de', label: 'DE' }, { value: 'it', label: 'IT' }] },
      { key: 'city', label: 'City', kind: 'select', options: (d) => (d.country === 'ge' ? [{ value: 'tbilisi', label: 'Tbilisi' }, { value: 'batumi', label: 'Batumi' }, { value: 'kutaisi', label: 'Kutaisi' }, { value: 'gori', label: 'Gori' }] : [{ value: 'paris', label: 'Paris' }, { value: 'lyon', label: 'Lyon' }, { value: 'nice', label: 'Nice' }, { value: 'lille', label: 'Lille' }]) },
    ];
    const seen: unknown[] = [];
    const e = owned(fields, { country: 'ge', city: 'batumi' }, { onChange: (v: unknown) => seen.push(v) });
    expect([...e.querySelectorAll<HTMLOptionElement>('select#f-city option')].map((o) => o.value)).toEqual(['', 'tbilisi', 'batumi', 'kutaisi', 'gori']);
    choose(e, 'country', 'fr');
    expect([...e.querySelectorAll<HTMLOptionElement>('select#f-city option')].map((o) => o.value)).toEqual(['', 'paris', 'lyon', 'nice', 'lille']);
    expect(seen.at(-1)).toEqual({ country: 'fr', city: undefined });
    expect(e.querySelector<HTMLSelectElement>('select#f-city')!.querySelector('option[selected]')).toBeNull();
  });
});

describe('rule 3 — validation timing and announcement', () => {
  const fields: Field<any>[] = [
    { key: 'payee', label: 'Payee', kind: 'text', required: true, hint: 'Who was paid' },
    { key: 'amount', label: 'Amount', kind: 'money', required: true },
  ];
  it('an untouched field shows no error while typing; blur shows it; typing again clears it', () => {
    const e = owned(fields);
    type(e, 'payee', 'a'); type(e, 'payee', '');
    expect(e.textContent).not.toContain('Payee is required.');
    expect(e.querySelector('#f-payee')!.getAttribute('aria-invalid')).toBeNull();
    blur(e, 'payee');
    expect(e.textContent).toContain('Payee is required.');
    expect(e.querySelector('#f-payee')!.getAttribute('aria-invalid')).toBe('true');
    expect(e.querySelector('#f-payee')!.getAttribute('aria-describedby')).toBe('f-payee-note');
    expect(e.querySelector('#f-payee-note')!.textContent).toBe('Payee is required.');
    type(e, 'payee', 'Chase');
    expect(e.querySelector('#f-payee-note')!.textContent).toBe('Who was paid');
    expect(e.querySelector('#f-payee')!.getAttribute('aria-invalid')).toBeNull();
  });
  it('on submit with 2+ errors: an alert summary, every field marked, focus on the first invalid', () => {
    let submitted = 0;
    const e = owned(fields, {}, { onSubmit: () => submitted++ });
    submit(e);
    expect(submitted).toBe(0);
    expect(e.querySelector('[role=alert]')!.textContent).toBe('2 fields need attention.');
    expect(e.querySelector('#f-amount')!.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(e.querySelector('#f-payee'));
    type(e, 'payee', 'x');
    expect(e.querySelector('[role=alert]')).toBeNull();
  });
});

describe('rule 4 — choice rendering', () => {
  const opts = (n: number) => Array.from({ length: n }, (_, i) => ({ value: `v${i}`, label: `V${i}` }));
  it('2–3 options: a segmented radio group; 4+: a native select; intent stays kind:select', () => {
    const e = owned([{ key: 'two', label: 'Two', kind: 'select', options: opts(2) }, { key: 'three', label: 'Three', kind: 'select', options: opts(3) }, { key: 'four', label: 'Four', kind: 'select', options: opts(4) }], { three: 'v1' });
    const three = e.querySelector<HTMLElement>('#f-three')!;
    expect(e.querySelector('#f-two')!.getAttribute('role')).toBe('radiogroup');
    expect(three.getAttribute('role')).toBe('radiogroup');
    expect(three.getAttribute('aria-labelledby')).toBe('f-three-label');
    expect([...three.querySelectorAll('button[role=radio]')].map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(e.querySelector('#f-four')!.tagName).toBe('SELECT');
  });
  it('clicking a segment selects it and the draft changes', () => {
    const seen: unknown[] = [];
    const e = owned([{ key: 'two', label: 'Two', kind: 'select', options: opts(2) }], {}, { onChange: (v: unknown) => seen.push(v) });
    e.querySelectorAll<HTMLButtonElement>('#f-two button')[1]!.click(); flushEffects();
    expect(seen).toEqual([{ two: 'v1' }]);
    expect(e.querySelectorAll('#f-two button')[1]!.getAttribute('aria-checked')).toBe('true');
  });
});

describe('rule 5 — draft lifecycle (uncontrolled)', () => {
  const fields: Field<any>[] = [{ key: 'name', label: 'Name', kind: 'text' }, { key: 'doc', label: 'Doc', kind: 'file' }];
  it('draft = initial on mount and whenever key changes; a file input remounts', () => {
    const e = owned(fields, { name: 'a' });
    type(e, 'name', 'b');
    const file = e.querySelector('#f-doc');
    expect(e.querySelector<HTMLInputElement>('#f-name')!.value).toBe('b');
    (e as any)._setProp('key', 2); flushEffects();
    expect(e.querySelector<HTMLInputElement>('#f-name')!.value).toBe('a');
    expect(e.querySelector('#f-doc')).not.toBe(file);
  });
  it('cancelling a dirty form asks first; Discard calls onCancel, a clean form does not ask', async () => {
    let cancelled = 0;
    const e = owned(fields, { name: 'a' }, { onCancel: () => cancelled++ });
    const cancel = [...e.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Cancel')!;
    cancel.click(); flushEffects();
    expect(cancelled).toBe(1);
    expect(document.querySelector('[role=dialog]')).toBeNull();
    type(e, 'name', 'b');
    cancel.click(); flushEffects();
    const dialog = document.querySelector<HTMLElement>('[role=dialog]')!;
    expect(dialog.getAttribute('aria-label')).toBe('Discard changes?');
    expect(cancelled).toBe(1);
    [...dialog.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Discard')!.click();
    await settle();
    expect(cancelled).toBe(2);
  });
  it('after a successful submit the form is no longer dirty', () => {
    let cancelled = 0;
    const e = owned(fields, { name: 'a' }, { onCancel: () => cancelled++ });
    type(e, 'name', 'b'); submit(e);
    [...e.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Cancel')!.click(); flushEffects();
    expect(cancelled).toBe(1);
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });
  it('a FormHandle via ref resets and submits', () => {
    let handle!: FormHandle;
    const got: unknown[] = [];
    const tpl = el('div', {}, [Form<{ name: string }>({ fields: [{ key: 'name', label: 'Name', kind: 'text' }], initial: { name: 'a' }, onSubmit: (v) => { got.push(v); }, ref: (h) => { handle = h; } })]);
    tpl.mount(document.body); flushEffects();
    const e = document.querySelector<HTMLElement>('nisli-form')!;
    type(e, 'name', 'b');
    handle.reset(); flushEffects();
    expect(e.querySelector<HTMLInputElement>('#f-name')!.value).toBe('a');
    handle.submit(); flushEffects();
    expect(got).toEqual([{ name: 'a' }]);
  });
});

describe('rule 6 — layout', () => {
  const fields: Field<any>[] = [
    { key: 'a', label: 'A', kind: 'text' },
    { key: 'b', label: 'B', kind: 'text', when: (d) => !!d.show },
    { key: 'addr', label: 'Address', kind: 'text', long: true },
    { key: 's1', label: 'Street', kind: 'text', group: 'Shipping' },
    { key: 'c', label: 'C', kind: 'text' },
    { key: 's2', label: 'City', kind: 'text', group: 'Shipping' },
    { key: 'note', label: 'Note', kind: 'textarea' },
  ];
  const grid = (e: HTMLElement) => e.querySelector<HTMLElement>('form > div')!;
  it('columns from the visible count only; long and textarea fields span the row', () => {
    const e = owned(fields, {}, {}, 1000);
    expect(grid(e).style.gridTemplateColumns).toBe(`repeat(${Math.min(6, Math.floor((1000 + 16) / (metrics.layout.minField + 16)))}, minmax(0, 1fr))`);
    expect(e.querySelector('label[for=f-b]')).toBeNull();
    expect(e.querySelector<HTMLElement>('label[for=f-addr]')!.parentElement!.style.gridColumn).toBe('1 / -1');
    expect(e.querySelector<HTMLElement>('label[for=f-note]')!.parentElement!.style.gridColumn).toBe('1 / -1');
    expect(e.querySelector<HTMLElement>('label[for=f-a]')!.parentElement!.style.gridColumn).toBe('auto');
    expect(grid(owned(fields, {}, {}, 360)).style.gridTemplateColumns).toBe('repeat(1, minmax(0, 1fr))');
  });
  it('a group is one fieldset with a legend, spanning the row, laying out its own fields by the same rule, in declaration order', () => {
    const e = owned(fields, {}, {}, 1000);
    const sets = e.querySelectorAll<HTMLFieldSetElement>('fieldset');
    expect(sets.length).toBe(1);
    const fs = sets[0]!;
    expect(fs.querySelector('legend')!.textContent).toBe('Shipping');
    expect(fs.style.gridColumn).toBe('1 / -1');
    expect(fs.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
    expect([...fs.querySelectorAll('label')].map((l) => l.getAttribute('for'))).toEqual(['f-s1', 'f-s2']);
    // each() wraps every cell in a display:contents <each-item>; the grid item is its child.
    const order = [...grid(e).children].map((w) => w.firstElementChild!).map((c) => c.tagName === 'FIELDSET' ? 'group' : c.querySelector('label')!.getAttribute('for'));
    expect(order).toEqual(['f-a', 'f-addr', 'group', 'f-c', 'f-note']);
  });
});

describe('rule 7 — bounds', () => {
  it('min/max/step reach the native control; money steps 0.01; a date takes ISO strings', () => {
    const e = owned([
      { key: 'n', label: 'N', kind: 'number', min: 1, max: 9, step: 2 },
      { key: 'm', label: 'M', kind: 'money', min: 0 },
      { key: 'd', label: 'D', kind: 'date', min: '2026-01-01', max: '2026-12-31' },
    ]);
    const n = e.querySelector('#f-n')!, m = e.querySelector('#f-m')!, d = e.querySelector('#f-d')!;
    expect([n.getAttribute('min'), n.getAttribute('max'), n.getAttribute('step')]).toEqual(['1', '9', '2']);
    expect([m.getAttribute('min'), m.getAttribute('step')]).toEqual(['0', '0.01']);
    expect([d.getAttribute('min'), d.getAttribute('max')]).toEqual(['2026-01-01', '2026-12-31']);
    type(e, 'n', '11'); blur(e, 'n');
    expect(e.textContent).toContain('N must be at most 9.');
  });
});

describe('rule 8 — read-only', () => {
  it('renders the control read-only (input readonly / select disabled), reactive to the draft', () => {
    const fields: Field<any>[] = [
      { key: 'lock', label: 'Lock', kind: 'checkbox' },
      { key: 't', label: 'T', kind: 'text', readOnly: (d) => !!d.lock },
      { key: 's', label: 'S', kind: 'select', readOnly: true, options: Array.from({ length: 4 }, (_, i) => ({ value: String(i), label: String(i) })) },
    ];
    const e = owned(fields, { lock: false });
    expect(e.querySelector('#f-t')!.hasAttribute('readonly')).toBe(false);
    expect(e.querySelector('#f-s')!.hasAttribute('disabled')).toBe(true);
    const lock = e.querySelector<HTMLInputElement>('#f-lock')!; lock.checked = true; lock.dispatchEvent(new Event('change')); flushEffects();
    expect(e.querySelector('#f-t')!.hasAttribute('readonly')).toBe(true);
  });
});

describe('rule 9 — live mode', () => {
  it('no buttons, no submit; onChange fires per change; validation still runs on blur', () => {
    const seen: unknown[] = [];
    let submitted = 0;
    const e = owned([{ key: 'q', label: 'Q', kind: 'text', required: true }], {}, { mode: 'live', onChange: (v: unknown) => seen.push(v), onSubmit: () => submitted++, onCancel: () => {} });
    expect(e.querySelector<HTMLElement>('form > div:last-child')!.style.display).toBe('none');
    type(e, 'q', 'a'); type(e, 'q', 'ab');
    expect(seen).toEqual([{ q: 'a' }, { q: 'ab' }]);
    submit(e);
    expect(submitted).toBe(0);
    type(e, 'q', ''); blur(e, 'q');
    expect(e.textContent).toContain('Q is required.');
  });
});

describe('rule 10 — busy', () => {
  it('a promise-returning onSubmit keeps the button busy and disabled; a rejection notifies', async () => {
    let done!: () => void;
    const p = new Promise<void>((r) => { done = r; });
    const e = owned([{ key: 'q', label: 'Q', kind: 'text' }], {}, { onSubmit: () => p });
    const btn = e.querySelector<HTMLButtonElement>('button[type=submit]')!;
    submit(e);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.disabled).toBe(true);
    done(); await settle();
    expect(btn.getAttribute('aria-busy')).toBeNull();
    const f = owned([{ key: 'q', label: 'Q', kind: 'text' }], {}, { onSubmit: () => Promise.reject(new Error('Bank said no')) });
    submit(f); await settle();
    expect(__notices.value.map((n) => n.text)).toEqual(['Bank said no']);
  });
});

describe('controlled draft', () => {
  it('a writable signal is edited in place through Form()', () => {
    const value = signal({ q: 'a' });
    el('div', {}, [Form<{ q: string }>({ fields: [{ key: 'q', label: 'Q', kind: 'text' }], value, onSubmit: () => {} })]).mount(document.body); flushEffects();
    type(document.querySelector<HTMLElement>('nisli-form')!, 'q', 'b');
    expect(value.value).toEqual({ q: 'b' });
  });
});
