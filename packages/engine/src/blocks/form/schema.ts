/**
 * The Form schema — intent only. Everything here is about meaning (what a
 * field is, when it exists, what makes it valid); nothing is about looks.
 * How a field is *captured* is derived, never said: `options` → a choice,
 * `long` → multi-line, `kind: 'boolean'` → a box with the label beside it,
 * `kind: 'file'` → a file picker. The functions are pure: the engine and its
 * tests call them with a draft.
 */
import type { Kind } from '../types.js';

export interface Option { readonly value: string; readonly label: string }

interface FieldBase<T> {
  /** The property of `T` this field edits; written to the control's HTML `name`. */
  readonly name: keyof T & string;
  readonly label: string;
  readonly required?: boolean;
  /** Secondary text of the field — an explanation under the control. */
  readonly hint?: string;
  /** The field exists only when this holds (default: always). */
  readonly when?: (draft: Partial<T>) => boolean;
  readonly readOnly?: boolean | ((draft: Partial<T>) => boolean);
  /** A domain rule; the message is the reason. */
  readonly validate?: (value: unknown, draft: Partial<T>) => string | undefined;
  /** A semantic group; the engine renders a titled fieldset. */
  readonly group?: string;
}

/** A datum a person types or picks: text, a number, money, a date. */
export interface DatumField<T> extends FieldBase<T> {
  /** What the value is; default `'text'`. */
  readonly kind?: Extract<Kind, 'text' | 'number' | 'money' | 'date'>;
  /** What the empty control shows: ghost text, or the empty choice ("All accounts"). */
  readonly placeholder?: string;
  /** Choices, fixed or dependent on the draft. Present → the field is a choice; the engine decides segmented or list. */
  readonly options?: readonly Option[] | ((draft: Partial<T>) => readonly Option[]);
  /** number/money/date bounds; a date's are ISO strings. */
  readonly min?: number | string;
  readonly max?: number | string;
  readonly step?: number;
  /** Holds long content (address, description); the engine gives it the full row and a multi-line control. */
  readonly long?: boolean;
}

/** A yes/no. Its one string is the `label`, beside the box; nothing to placeholder. */
export interface BooleanField<T> extends FieldBase<T> {
  readonly kind: 'boolean';
  readonly placeholder?: never;
  readonly options?: never;
  readonly long?: never;
}

/** A file. No ghost text; `accept` says which files. */
export interface FileField<T> extends FieldBase<T> {
  readonly kind: 'file';
  /** Accepted types, e.g. ".csv,text/csv". */
  readonly accept?: string;
  readonly placeholder?: never;
  readonly options?: never;
  readonly long?: never;
}

export type Field<T> = DatumField<T> | BooleanField<T> | FileField<T>;

/** A field's kind, defaulted. */
export const kindOf = <T>(f: Field<T>): Kind => f.kind ?? 'text';

/** The fields that exist for this draft, in declaration order. */
export function visibleFields<T>(fields: readonly Field<T>[], draft: Partial<T>): Field<T>[] {
  return fields.filter((f) => (f.when ? f.when(draft) : true));
}

/** Whether a field is a choice: it has `options` (fixed or dependent). */
export const hasOptions = <T>(f: Field<T>): f is DatumField<T> & { options: NonNullable<DatumField<T>['options']> } => f.options !== undefined;

/** A field's choices for this draft; empty for a field without any. */
export function optionsOf<T>(field: Field<T>, draft: Partial<T>): readonly Option[] {
  const o = field.options;
  if (!o) return [];
  return typeof o === 'function' ? o(draft) : o;
}

export function isReadOnly<T>(field: Field<T>, draft: Partial<T>): boolean {
  const r = field.readOnly;
  return typeof r === 'function' ? r(draft) : !!r;
}

/** Nothing there: required fails, bounds do not apply. */
export const isEmpty = (v: unknown): boolean =>
  v === undefined || v === null || v === '' || v === false || (typeof v === 'number' && Number.isNaN(v));

/** Whether a field spans the full row: long content. */
export const spansRow = <T>(f: Field<T>): boolean => !!f.long;

/** The engine's default step for a bounded kind. */
export function stepOf<T>(f: Field<T>): number | 'any' | undefined {
  if (f.kind === 'boolean' || f.kind === 'file') return undefined;
  if (f.step !== undefined) return f.step;
  if (f.kind === 'money') return 0.01;
  if (f.kind === 'number') return 'any';
  return undefined;
}

/** The reason a value is not acceptable, or nothing. */
export function validateField<T>(field: Field<T>, value: unknown, draft: Partial<T>): string | undefined {
  if (isEmpty(value)) return field.required ? `${field.label} is required.` : field.validate?.(value, draft);
  if (field.kind === 'number' || field.kind === 'money') {
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(n)) return `${field.label} must be a number.`;
    if (field.min !== undefined && n < Number(field.min)) return `${field.label} must be at least ${field.min}.`;
    if (field.max !== undefined && n > Number(field.max)) return `${field.label} must be at most ${field.max}.`;
  }
  if (field.kind === 'date') {
    const d = String(value);
    if (field.min !== undefined && d < String(field.min)) return `${field.label} must be on or after ${field.min}.`;
    if (field.max !== undefined && d > String(field.max)) return `${field.label} must be on or before ${field.max}.`;
  }
  if (hasOptions(field)) {
    const opts = optionsOf(field, draft);
    if (opts.length > 0 && !opts.some((o) => o.value === String(value))) return `${field.label} is not one of the choices.`;
  }
  return field.validate?.(value, draft);
}
