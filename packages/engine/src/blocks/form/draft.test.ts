/** The draft's rules over signals: presence, dependent choices, timing, lifecycle. No DOM. */
import { describe, it, expect } from 'vitest';
import { signal, flushEffects } from '@nisli/core';
import { createDraft } from './draft.js';
import type { Field } from './schema.js';

interface D { kind?: string; amount?: number; debit?: number; country?: string; city?: string; name?: string }
const fields = signal<readonly Field<D>[]>([
  { name: 'kind', label: 'Kind', options: [{ value: 'single', label: 'Single' }, { value: 'split', label: 'Split' }] },
  { name: 'amount', label: 'Amount', kind: 'money', required: true, when: (d) => d.kind === 'single' },
  { name: 'debit', label: 'Debit', kind: 'money', required: true, when: (d) => d.kind === 'split' },
  { name: 'country', label: 'Country', options: [{ value: 'ge', label: 'GE' }, { value: 'fr', label: 'FR' }] },
  { name: 'city', label: 'City', options: (d) => (d.country === 'ge' ? [{ value: 'tbilisi', label: 'Tbilisi' }] : d.country === 'fr' ? [{ value: 'paris', label: 'Paris' }] : []) },
  { name: 'name', label: 'Name', kind: 'text', required: true },
]);

const owned = (initial: Partial<D> = {}, key = signal<unknown>(1)) => {
  const d = createDraft<D>({ mode: 'owned', fields, initial: signal(initial), key });
  flushEffects();
  return d;
};

describe('rule 1 — presence', () => {
  it('a field whose `when` is false is not visible, leaves the submitted object and carries no error', () => {
    const d = owned({ kind: 'single', amount: 5, debit: 9, name: 'n' });
    expect(d.visible.value.map((f) => f.name)).toEqual(['kind', 'amount', 'country', 'city', 'name']);
    expect(d.submit()).toMatchObject({ ok: true, value: { kind: 'single', amount: 5, name: 'n' } });
    d.set('kind', 'split'); d.set('debit', undefined);
    expect(d.submit().errors).toEqual({ debit: 'Debit is required.' });
    d.set('kind', 'single');
    expect(d.errors.value).toEqual({});
    expect(d.submit().value).not.toHaveProperty('debit');
  });
});

describe('rule 2 — dependent options', () => {
  it('clears a value no longer among the choices on every change', () => {
    const d = owned({ country: 'ge', city: 'tbilisi' });
    d.set('country', 'fr');
    expect(d.draft.value.city).toBeUndefined();
    d.set('city', 'paris');
    expect(d.draft.value.city).toBe('paris');
    d.set('name', 'x');
    expect(d.draft.value.city).toBe('paris');
  });
});

describe('rule 3 — validation timing', () => {
  it('an untouched field shows no error; blur shows it; a submit attempt shows them all', () => {
    const d = owned({ kind: 'single' });
    expect(d.errors.value).toEqual({});
    d.set('name', '');
    expect(d.errors.value).toEqual({});
    d.blur('name');
    expect(d.errors.value).toEqual({ name: 'Name is required.' });
    d.set('name', 'ok');
    expect(d.errors.value).toEqual({});
    const r = d.submit();
    expect(r.ok).toBe(false);
    expect(r.first).toBe('amount');
    expect(d.errors.value).toEqual({ amount: 'Amount is required.' });
  });
});

describe('rule 5 — lifecycle', () => {
  it('starts at initial, resets to it when the key changes, and tracks dirty', () => {
    const key = signal<unknown>(1);
    const d = owned({ name: 'a' }, key);
    expect(d.dirty.value).toBe(false);
    d.set('name', 'b'); d.blur('name');
    expect(d.dirty.value).toBe(true);
    expect(d.touched.value.has('name')).toBe(true);
    const gen = d.generation.value;
    key.value = 2; flushEffects();
    expect(d.draft.value).toEqual({ name: 'a' });
    expect(d.dirty.value).toBe(false);
    expect(d.touched.value.size).toBe(0);
    expect(d.generation.value).toBe(gen + 1);
  });
  it('after a successful submit the form is no longer dirty; reset returns to what was last committed', () => {
    const d = owned({ kind: 'single', amount: 1, name: 'a' });
    d.set('name', 'b');
    expect(d.dirty.value).toBe(true);
    const r = d.submit();
    expect(r.ok).toBe(true);
    d.commit(r.value);
    expect(d.dirty.value).toBe(false);
    d.set('name', 'c');
    d.reset();
    expect(d.draft.value.name).toBe('b');
  });
  it('an emptied field is not dirty against a missing one', () => {
    const d = owned({});
    d.set('name', '');
    expect(d.dirty.value).toBe(false);
  });
});

describe('controlled mode', () => {
  it('reads the app draft, writes through onChange, and applies the same rules', () => {
    const value = signal<D | undefined>({ country: 'ge', city: 'tbilisi' });
    const d = createDraft<D>({ mode: 'controlled', fields, value, onChange: (v) => { value.value = v; } });
    d.set('country', 'fr');
    expect(value.value).toEqual({ country: 'fr', city: undefined });
    expect(d.dirty.value).toBe(true);
    value.value = undefined;
    expect(d.draft.value).toEqual({});
    d.dispose();
  });
});
