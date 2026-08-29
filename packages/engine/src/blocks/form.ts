import { component, el, signal, computed, effect, onCleanup, isSignal, type ReadonlySignal, type Signal } from '@nisli/core';
import { metrics } from '../metrics.js';
import { css, apply, buttonStyle, inputStyle } from '../style.js';
import { look } from '../skin.js';
import { useWidth } from '../engine/measure.js';
import { columnsFor } from '../engine/columns.js';
import { report } from '../engine/report.js';
import type { Action, Content } from './types.js';
import { createBusy } from './status.js';

export type FieldKind = 'text' | 'number' | 'money' | 'date' | 'select' | 'textarea' | 'file' | 'checkbox';

export interface Field<T> {
  readonly key: keyof T & string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly options?: readonly { value: string; label: string }[];
  readonly required?: boolean;
  readonly placeholder?: string;
  readonly hint?: string;
  /** For `file`: accepted types, e.g. ".csv,text/csv". */
  readonly accept?: string;
}

export interface FormProps<T> {
  fields: readonly Field<T>[];
  value: T;
  onChange: (value: T) => void;
  onSubmit: (value: T) => void | Promise<unknown>;
  submitLabel?: string;
  onCancel?: () => void;
  /** A destructive action offered beside the buttons — e.g. delete. */
  destructive?: Action;
  /** `live`: no buttons; every change is the submission (filters, settings that apply as you type). */
  mode?: 'submit' | 'live';
}

type Rec = Record<string, unknown>;

const parse = (kind: FieldKind, raw: string): unknown => {
  if (kind === 'number' || kind === 'money') return raw === '' ? undefined : Number(raw);
  return raw;
};
const show = (v: unknown): string => (v == null ? '' : String(v));

const FormImpl = component<FormProps<Rec>>('nisli-form', (props, host) => {
  const width = useWidth(host);
  const errors = signal<Record<string, string>>({});
  const { is: isBusy, run } = createBusy();
  const gap = metrics.space[4];
  const fields = computed(() => [...props.fields.value]);
  const cols = computed(() => columnsFor(width.value, fields.value.length, metrics.layout.minField, gap));
  const stopReport = effect(() => {
    if (width.value > 0 && fields.value.length > 0 && width.value < metrics.layout.minField) {
      report({ code: 'FIT_CELL', block: 'nisli-form', width: width.value, deficit: metrics.layout.minField - width.value, detail: 'a single field column is narrower than the minimum' });
    }
  });
  onCleanup(stopReport);

  apply(host, { display: 'block', minWidth: 0 });

  /** The draft, tolerating "nothing yet". */
  const draft = (): Rec => (props.value.value ?? {}) as Rec;

  const set = (key: string, v: unknown) => {
    props.onChange.value({ ...draft(), [key]: v });
    if (errors.value[key]) errors.value = { ...errors.value, [key]: '' };
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    for (const f of fields.value) {
      const v = draft()[f.key];
      if (f.required && (v === undefined || v === null || v === '' || v === false || (typeof v === 'number' && Number.isNaN(v)))) next[f.key] = `${f.label} is required.`;
    }
    errors.value = next;
    const first = Object.keys(next)[0];
    if (first) host.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    return first === undefined;
  };

  const control = (f: Field<Rec>) => {
    const common = {
      name: f.key,
      id: `f-${f.key}`,
      required: f.required ? 'required' : false,
      placeholder: f.placeholder ?? false,
      'aria-invalid': computed(() => (errors.value[f.key] ? 'true' : false)),
      style: computed(() => css({
        ...inputStyle(!!errors.value[f.key]),
        height: f.kind === 'textarea' ? 'auto' : metrics.control.height,
        minHeight: f.kind === 'textarea' ? 80 : undefined,
        padding: f.kind === 'textarea' ? metrics.space[3] : `0 ${metrics.space[3]}px`,
      })),
    };
    if (f.kind === 'select') {
      return el('select', { ...common, on: { change: (e) => set(f.key, (e.target as HTMLSelectElement).value) } }, [
        el('option', { value: '' }, f.placeholder ?? 'Choose…'),
        ...(f.options ?? []).map((o) =>
          el('option', { value: o.value, selected: computed(() => (show(draft()[f.key]) === o.value ? 'selected' : false)) }, o.label),
        ),
      ]);
    }
    if (f.kind === 'file') {
      return el('input', {
        ...common,
        type: 'file',
        accept: f.accept ?? false,
        style: computed(() => css({ ...inputStyle(!!errors.value[f.key]), padding: `${metrics.space[1]}px ${metrics.space[2]}px`, height: 'auto' })),
        on: { change: (e) => set(f.key, (e.target as HTMLInputElement).files?.[0] ?? undefined) },
      });
    }
    if (f.kind === 'checkbox') {
      return el('span', { style: css({ display: 'flex', alignItems: 'center', gap: metrics.space[2], height: metrics.control.height }) }, [
        el('input', {
          ...common,
          type: 'checkbox',
          style: css({ width: 16, height: 16, margin: 0 }),
          checked: computed(() => (draft()[f.key] ? 'checked' : false)),
          on: { change: (e) => set(f.key, (e.target as HTMLInputElement).checked) },
        }),
        el('span', { style: computed(() => css(look('text'))) }, f.placeholder ?? ''),
      ]);
    }
    if (f.kind === 'textarea') {
      return el('textarea', { ...common, rows: '3', on: { input: (e) => set(f.key, (e.target as HTMLTextAreaElement).value) } }, computed(() => show(draft()[f.key])));
    }
    return el('input', {
      ...common,
      type: f.kind === 'date' ? 'date' : f.kind === 'text' ? 'text' : 'number',
      step: f.kind === 'money' ? '0.01' : f.kind === 'number' ? 'any' : false,
      inputmode: f.kind === 'money' || f.kind === 'number' ? 'decimal' : false,
      value: computed(() => show(draft()[f.key])),
      on: { input: (e) => set(f.key, parse(f.kind, (e.target as HTMLInputElement).value)) },
    });
  };

  const grid = el('div', {
    style: computed(() => css({ display: 'grid', gap, gridTemplateColumns: `repeat(${cols.value}, minmax(0, 1fr))` })),
  }, fields.value.map((f) =>
    el('label', {
      for: `f-${f.key}`,
      style: css({ display: 'flex', flexDirection: 'column', gap: metrics.space[1], minWidth: 0, gridColumn: f.kind === 'textarea' ? '1 / -1' : 'auto' }),
    }, [
      el('span', { style: computed(() => css(look('text.muted'))) }, f.required ? `${f.label} *` : f.label),
      control(f),
      el('span', {
        style: computed(() => css({ display: errors.value[f.key] || f.hint ? 'block' : 'none', ...look(errors.value[f.key] ? 'tone.negative' : 'text.faint') })),
      }, computed(() => errors.value[f.key] || f.hint || '')),
    ]),
  ));

  return el('form', {
    novalidate: 'novalidate',
    style: css({ display: 'flex', flexDirection: 'column', gap: metrics.space[4] }),
    on: { submit: (e) => { e.preventDefault(); if (validate()) run('submit', () => props.onSubmit.value(draft())); } },
  }, [
    grid,
    el('div', { style: computed(() => css({ display: props.mode.value === 'live' ? 'none' : 'flex', gap: metrics.space[2], justifyContent: 'flex-end', flexWrap: 'wrap' })) }, [
      el('button', {
        type: 'button',
        'aria-busy': computed(() => (isBusy('destructive') ? 'true' : false)),
        disabled: computed(() => (isBusy('destructive') ? 'disabled' : false)),
        style: computed(() => css({ ...buttonStyle('danger'), marginRight: 'auto', display: props.destructive.value ? 'inline-flex' : 'none', ...(isBusy('destructive') ? look('button.busy') : {}) })),
        on: { click: () => run('destructive', props.destructive.value?.onSelect) },
      }, computed(() => props.destructive.value?.label ?? '')),
      el('button', {
        type: 'button',
        style: computed(() => css({ ...buttonStyle('plain'), display: props.onCancel.value ? 'inline-flex' : 'none' })),
        on: { click: () => props.onCancel.value?.() },
      }, 'Cancel'),
      el('button', {
        type: 'submit',
        'aria-busy': computed(() => (isBusy('submit') ? 'true' : false)),
        disabled: computed(() => (isBusy('submit') ? 'disabled' : false)),
        style: computed(() => css({ ...buttonStyle('primary'), ...(isBusy('submit') ? look('button.busy') : {}) })),
      }, computed(() => props.submitLabel.value ?? 'Save')),
    ]),
  ]);
});

export function Form<T extends object>(props: {
  fields: readonly Field<T>[] | ReadonlySignal<readonly Field<T>[]>;
  /** The draft. A writable signal is edited in place; otherwise supply `onChange`. */
  value: T | Signal<T> | ReadonlySignal<T>;
  onChange?: (value: T) => void;
  onSubmit: (value: T) => void | Promise<unknown>;
  submitLabel?: string;
  onCancel?: () => void;
  destructive?: Action;
  mode?: 'submit' | 'live';
}): Content {
  const onChange = props.onChange ?? (isSignal(props.value) ? (v: T) => { (props.value as Signal<T>).value = v; } : () => {});
  return FormImpl({ ...props, onChange } as unknown as Parameters<typeof FormImpl>[0]);
}
