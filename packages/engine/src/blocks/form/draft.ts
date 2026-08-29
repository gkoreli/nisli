/**
 * The Form draft — the engine's ownership of a form's state, pure over
 * signals. Owns presence (a hidden field leaves the submitted object and its
 * errors), dependent choices (a value no longer offered is cleared),
 * validation timing (blur and submit, never a first keystroke), and the
 * lifecycle (initial, key, dirty, commit, reset). No DOM here.
 */
import { signal, computed, effect, untrack, type ReadonlySignal } from '@nisli/core';
import { visibleFields, optionsOf, validateField, type Field } from './schema.js';

export type DraftMode = 'controlled' | 'owned';

interface Common<T> {
  readonly fields: ReadonlySignal<readonly Field<T>[]>;
  readonly onChange?: (value: T) => void;
}
export interface ControlledDraft<T> extends Common<T> {
  readonly mode: 'controlled';
  /** The app's draft. May be "nothing yet". */
  readonly value: ReadonlySignal<T | undefined>;
  readonly onChange: (value: T) => void;
}
export interface OwnedDraft<T> extends Common<T> {
  readonly mode: 'owned';
  readonly initial: ReadonlySignal<Partial<T> | undefined>;
  /** A new key resets the draft to `initial`. */
  readonly key: ReadonlySignal<unknown>;
}
export type DraftOptions<T> = ControlledDraft<T> | OwnedDraft<T>;

export interface SubmitResult<T> {
  readonly ok: boolean;
  /** Only the fields that exist for this draft. */
  readonly value: T;
  readonly errors: Readonly<Record<string, string>>;
  readonly first?: string;
}

export interface Draft<T> {
  readonly draft: ReadonlySignal<Partial<T>>;
  readonly visible: ReadonlySignal<Field<T>[]>;
  /** Errors shown right now: touched fields, or every visible one after a submit attempt. */
  readonly errors: ReadonlySignal<Readonly<Record<string, string>>>;
  readonly touched: ReadonlySignal<ReadonlySet<string>>;
  readonly dirty: ReadonlySignal<boolean>;
  /** Bumped whenever the draft is reset; controls that cannot take a value (file) remount on it. */
  readonly generation: ReadonlySignal<number>;
  set(key: string, value: unknown): void;
  blur(key: string): void;
  /** Validate every visible field; on success return the value to submit. */
  submit(): SubmitResult<T>;
  /** After a successful submit: the form is no longer dirty from this value. */
  commit(value: T): void;
  reset(): void;
  dispose(): void;
}

type Rec = Record<string, unknown>;

const same = (a: unknown, b: unknown): boolean => {
  const empty = (v: unknown) => v === undefined || v === null || v === '';
  if (empty(a) && empty(b)) return true;
  return Object.is(a, b);
};

/** Shallow difference over the union of keys, empties alike. */
export function differs(a: Rec, b: Rec): boolean {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (!same(a[k], b[k])) return true;
  return false;
}

/** Clear any dependent choice whose value is no longer offered, to a fixpoint. */
export function settle<T>(fields: readonly Field<T>[], draft: Rec): Rec {
  let next = draft;
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const f of visibleFields(fields, next as Partial<T>)) {
      if (f.kind !== 'select' || typeof f.options !== 'function') continue;
      const v = next[f.key];
      if (v === undefined || v === null || v === '') continue;
      if (!optionsOf(f, next as Partial<T>).some((o) => o.value === String(v))) { next = { ...next, [f.key]: undefined }; changed = true; }
    }
    if (!changed) break;
  }
  return next;
}

/** Only the keys of fields that exist. */
const pick = <T>(visible: readonly Field<T>[], draft: Rec): T => {
  const out: Rec = {};
  for (const f of visible) if (draft[f.key] !== undefined) out[f.key] = draft[f.key];
  return out as T;
};

export function createDraft<T>(options: DraftOptions<T>): Draft<T> {
  const own = signal<Rec>({});
  const base = signal<Rec>({});
  const touched = signal<ReadonlySet<string>>(new Set());
  const attempted = signal(false);
  const generation = signal(0);

  const draft = computed<Partial<T>>(() =>
    (options.mode === 'controlled' ? ((options.value.value ?? {}) as Rec) : own.value) as Partial<T>,
  );
  const visible = computed(() => visibleFields(options.fields.value, draft.value));

  const write = (next: Rec) => {
    if (options.mode === 'owned') own.value = next;
    options.onChange?.(next as T);
  };

  const load = (initial: Rec) => {
    base.value = initial;
    if (options.mode === 'owned') own.value = initial;
    touched.value = new Set();
    attempted.value = false;
    generation.value = generation.value + 1;
  };

  let stop = () => {};
  if (options.mode === 'owned') {
    let first = true;
    stop = effect(() => {
      options.key.value;
      untrack(() => {
        const initial = (options.initial.value ?? {}) as Rec;
        if (first) { first = false; base.value = initial; own.value = initial; return; }
        load(initial);
      });
    });
  } else {
    base.value = untrack(() => (options.value.value ?? {}) as Rec);
  }

  const errors = computed<Readonly<Record<string, string>>>(() => {
    const d = draft.value as Rec;
    const all = attempted.value;
    const t = touched.value;
    const out: Record<string, string> = {};
    for (const f of visible.value) {
      if (!all && !t.has(f.key)) continue;
      const m = validateField(f, d[f.key], draft.value);
      if (m) out[f.key] = m;
    }
    return out;
  });

  const dirty = computed(() => differs(draft.value as Rec, base.value));

  return {
    draft, visible, errors, touched, dirty, generation,
    set(key, value) {
      write(settle(options.fields.value, { ...(draft.value as Rec), [key]: value }));
    },
    blur(key) {
      if (!touched.value.has(key)) touched.value = new Set([...touched.value, key]);
    },
    submit() {
      attempted.value = true;
      const d = draft.value as Rec;
      const errs: Record<string, string> = {};
      for (const f of visible.value) {
        const m = validateField(f, d[f.key], draft.value);
        if (m) errs[f.key] = m;
      }
      const first = Object.keys(errs)[0];
      return { ok: first === undefined, value: pick(visible.value, d), errors: errs, first };
    },
    commit(value) {
      base.value = { ...(draft.value as Rec), ...(value as Rec) };
      touched.value = new Set();
      attempted.value = false;
    },
    reset() {
      const initial = base.value;
      if (options.mode === 'controlled') options.onChange(initial as T);
      load(initial);
    },
    dispose: () => stop(),
  };
}
