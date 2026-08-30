/** The schema's pure rules: presence, choices, validity. No DOM. */
import { describe, it, expect } from 'vitest';
import { visibleFields, optionsOf, validateField, stepOf, type Field } from './schema.js';

interface D { kind?: string; amount?: number; when?: string; country?: string; city?: string; note?: string }

describe('visibleFields', () => {
  it('keeps a field only while its `when` holds; no `when` means always', () => {
    const fields: Field<D>[] = [
      { name: 'kind', label: 'Kind' },
      { name: 'amount', label: 'Amount', kind: 'money', when: (d) => d.kind === 'single' },
    ];
    expect(visibleFields(fields, {}).map((f) => f.name)).toEqual(['kind']);
    expect(visibleFields(fields, { kind: 'single' }).map((f) => f.name)).toEqual(['kind', 'amount']);
  });
});

describe('optionsOf', () => {
  it('returns fixed options, evaluates dependent ones against the draft, and is empty otherwise', () => {
    const fixed: Field<D> = { name: 'kind', label: 'K', options: [{ value: 'a', label: 'A' }] };
    const dep: Field<D> = { name: 'city', label: 'City', options: (d) => (d.country === 'ge' ? [{ value: 'tbilisi', label: 'Tbilisi' }] : []) };
    expect(optionsOf(fixed, {})).toEqual([{ value: 'a', label: 'A' }]);
    expect(optionsOf(dep, { country: 'ge' }).map((o) => o.value)).toEqual(['tbilisi']);
    expect(optionsOf(dep, {})).toEqual([]);
    expect(optionsOf({ name: 'note', label: 'N', kind: 'text' }, {})).toEqual([]);
  });
});

describe('validateField', () => {
  it('required: empty, blank, false and NaN are all missing', () => {
    const f: Field<D> = { name: 'note', label: 'Note', kind: 'text', required: true };
    for (const v of [undefined, null, '', false, NaN]) expect(validateField(f, v, {})).toBe('Note is required.');
    expect(validateField(f, 'x', {})).toBeUndefined();
  });
  it('bounds on number, money and ISO dates; skipped when empty and not required', () => {
    const n: Field<D> = { name: 'amount', label: 'Amount', kind: 'money', min: 0, max: 100 };
    expect(validateField(n, -1, {})).toBe('Amount must be at least 0.');
    expect(validateField(n, 101, {})).toBe('Amount must be at most 100.');
    expect(validateField(n, 50, {})).toBeUndefined();
    expect(validateField(n, undefined, {})).toBeUndefined();
    const d: Field<D> = { name: 'when', label: 'When', kind: 'date', min: '2026-01-01', max: '2026-12-31' };
    expect(validateField(d, '2025-12-31', {})).toBe('When must be on or after 2026-01-01.');
    expect(validateField(d, '2027-01-01', {})).toBe('When must be on or before 2026-12-31.');
    expect(validateField(d, '2026-06-01', {})).toBeUndefined();
  });
  it('a domain rule speaks last and sees the draft', () => {
    const f: Field<D> = { name: 'amount', label: 'Amount', kind: 'money', validate: (v, d) => (d.kind === 'refund' && (v as number) > 0 ? 'A refund is negative.' : undefined) };
    expect(validateField(f, 5, { kind: 'refund' })).toBe('A refund is negative.');
    expect(validateField(f, 5, { kind: 'sale' })).toBeUndefined();
  });
  it('a select value must be one of the current choices', () => {
    const f: Field<D> = { name: 'city', label: 'City', options: (d) => (d.country === 'ge' ? [{ value: 'tbilisi', label: 'Tbilisi' }] : [{ value: 'paris', label: 'Paris' }]) };
    expect(validateField(f, 'paris', { country: 'ge' })).toBe('City is not one of the choices.');
    expect(validateField(f, 'tbilisi', { country: 'ge' })).toBeUndefined();
  });
  it('money steps by 0.01, number by any, unless the schema says', () => {
    expect(stepOf({ name: 'amount', label: 'A', kind: 'money' })).toBe(0.01);
    expect(stepOf({ name: 'amount', label: 'A', kind: 'number' })).toBe('any');
    expect(stepOf({ name: 'amount', label: 'A', kind: 'number', step: 5 })).toBe(5);
    expect(stepOf({ name: 'note', label: 'A', kind: 'text' })).toBeUndefined();
  });
});
