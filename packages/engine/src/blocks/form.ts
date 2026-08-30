/**
 * Form — a schema of fields, decided by the engine: which exist, how they lay
 * out at width, how a choice is offered, when a rule is checked and how its
 * reason is announced. App code states the schema; nothing about looks.
 *
 * The domain lives in `./form/`: `schema.ts` (intent, pure rules) and
 * `draft.ts` (state over signals). This file renders, on the block kernel:
 * structure from `ctx.metrics`, every visual through `ctx.part()`.
 */
import { el, each, ref, computed, effect, onCleanup, untrack, isSignal, type Ref, type ReadonlySignal, type Signal, type TemplateResult } from '@nisli/core';
import { buttonBox, inputBox, type StyleRecord } from '../style.js';
import type { Part } from '../skin.js';
import { columnsFor } from '../engine/space.js';
import { reportIf } from '../engine/report.js';
import type { Action, Content } from './types.js';
import { block, type Ctx, type Parts } from './kernel.js';
import { confirm } from './confirm.js';
import { optionsOf, isReadOnly, spansRow, stepOf, type Field, type FieldKind, type Option } from './form/schema.js';
import { createDraft, type Draft } from './form/draft.js';

export type { Field, FieldKind, Option } from './form/schema.js';

export interface FormProps<T> {
  fields: readonly Field<T>[] | ReadonlySignal<readonly Field<T>[]>;
  // Draft ownership — exactly one of the two:
  /** Controlled: the app's draft. A writable signal is edited in place; otherwise supply `onChange`. */
  value?: T | Signal<T> | ReadonlySignal<T>;
  /** Uncontrolled: the engine owns the draft; a new `key` resets it to `initial`. */
  initial?: Partial<T>;
  key?: string | number;
  onChange?: (value: T) => void;
  onSubmit: (value: T) => void | Promise<unknown>;
  submitLabel?: string;
  onCancel?: () => void;
  /** A destructive action offered beside the buttons — e.g. delete. */
  destructive?: Action;
  /** `live`: no buttons, no submit; every change is the submission (filters, settings that apply as you type). */
  mode?: 'submit' | 'live';
  /** For the rare imperative caller. */
  ref?: (h: FormHandle) => void;
}

export interface FormHandle { reset(): void; submit(): void }

/** A select with this many choices or fewer is offered as a segmented group. */
const SEGMENTED_MAX = 3;

type Rec = Record<string, unknown>;

interface ImplProps {
  fields: readonly Field<Rec>[];
  owned: boolean;
  value?: Rec;
  initial?: Partial<Rec>;
  key?: unknown;
  onChange?: (value: Rec) => void;
  onSubmit: (value: Rec) => void | Promise<unknown>;
  submitLabel?: string;
  onCancel?: () => void;
  destructive?: Action;
  mode?: 'submit' | 'live';
  handle?: (h: FormHandle) => void;
}

type Item = { id: string; kind: 'field'; field: Field<Rec> } | { id: string; kind: 'group'; title: string; fields: Field<Rec>[] };

/** Fields with the same group gather into one fieldset at the position of the first; declaration order otherwise. */
export function arrange(fields: readonly Field<Rec>[]): Item[] {
  const items: Item[] = [];
  const groups = new Map<string, Extract<Item, { kind: 'group' }>>();
  for (const f of fields) {
    if (!f.group) { items.push({ id: `field:${f.key}`, kind: 'field', field: f }); continue; }
    let g = groups.get(f.group);
    if (!g) { g = { id: `group:${f.group}`, kind: 'group', title: f.group, fields: [] }; groups.set(f.group, g); items.push(g); }
    g.fields.push(f);
  }
  return items;
}

const parse = (kind: FieldKind, raw: string): unknown => {
  if (kind === 'number' || kind === 'money') return raw === '' ? undefined : Number(raw);
  return raw;
};
const show = (v: unknown): string => (v == null ? '' : String(v));
const attr = (v: number | string | undefined): string | false => (v === undefined ? false : String(v));
/**
 * A control's current value, as attribute AND property. An attribute stops
 * reflecting once a person has typed; a reset or an external change must
 * reach the property too. Called from the attribute's computed, which the
 * binder evaluates at mount and on every change.
 */
const sync = <P extends 'value' | 'checked'>(r: Ref<HTMLElement>, prop: P, v: P extends 'value' ? string : boolean): string | false => {
  const n = r.current as unknown as Record<string, unknown> | null;
  if (n && n[prop] !== v) n[prop] = v;
  return prop === 'checked' ? (v ? 'checked' : false) : String(v);
};

const FormImpl = block<ImplProps>('nisli-form', {
  measure: 'width',
  host: () => ({ display: 'block', minWidth: 0 }),
  render: (props, ctx) => {
    const { host, width, busy, metrics } = ctx;
    const gap = metrics.space[4];
    const fields = computed(() => [...(props.fields.value ?? [])]);
    const owned = untrack(() => !!props.owned.value);

    const draft: Draft<Rec> = owned
      ? createDraft<Rec>({ mode: 'owned', fields, initial: props.initial, key: props.key, onChange: (v) => props.onChange.value?.(v) })
      : createDraft<Rec>({ mode: 'controlled', fields, value: props.value, onChange: (v) => props.onChange.value?.(v) });
    onCleanup(draft.dispose);

    const visible = draft.visible;
    const items = computed(() => arrange(visible.value));
    const cols = computed(() => columnsFor(width.value, visible.value.length, metrics.layout.minField, gap));
    const gridOf = (n: number): StyleRecord => ({ display: 'grid', gap, gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` });

    // A single column narrower than a field's minimum is an unsatisfiable cell.
    const stopReport = effect(() => {
      if (width.value > 0 && visible.value.length > 0) {
        reportIf({ slack: width.value - metrics.layout.minField }, { code: 'FIT_CELL', block: 'nisli-form', width: width.value, detail: 'a single field column is narrower than the minimum' });
      }
    });
    onCleanup(stopReport);

    const value = () => draft.draft.value;
    const errorOf = (key: string) => draft.errors.value[key];

    const focusField = (key: string) => {
      const target = host.querySelector<HTMLElement>(`#f-${key}`);
      if (!target) return;
      if (target.getAttribute('role') === 'radiogroup') (target.querySelector<HTMLElement>('[aria-checked=true]') ?? target.querySelector<HTMLElement>('[role=radio]'))?.focus();
      else target.focus();
    };

    const submit = () => {
      if (props.mode.value === 'live') return;
      const result = draft.submit();
      if (!result.ok) { if (result.first) focusField(result.first); return; }
      busy.run('submit', () => {
        const r = props.onSubmit.value(result.value);
        if (r && typeof (r as Promise<unknown>).then === 'function') return (r as Promise<unknown>).then((x) => { draft.commit(result.value); return x; });
        draft.commit(result.value);
        return r;
      });
    };

    const cancel = () => {
      const done = () => props.onCancel.value?.();
      if (!owned || !draft.dirty.value) return done();
      void confirm({ title: 'Discard changes?', message: 'Your edits will be lost.', destructive: true, confirmLabel: 'Discard' }).then((yes) => { if (yes) done(); });
    };

    untrack(() => props.handle.value?.({ reset: () => draft.reset(), submit }));

    // ── Controls ─────────────────────────────────────────────────────────

    type ElementLike = TemplateResult | ReadonlySignal<TemplateResult>;
    type Common = Record<string, string | false | ReadonlySignal<string | false>>;
    type InputStyle = (extra?: StyleRecord) => ReadonlySignal<string>;

    const control = (f: Field<Rec>): ElementLike => {
      const id = `f-${f.key}`;
      const readOnly = computed(() => isReadOnly(f, value()));
      const invalid = computed(() => !!errorOf(f.key));
      const common = {
        name: f.key,
        id,
        required: f.required ? 'required' : (false as const),
        placeholder: f.placeholder ?? (false as const),
        'aria-invalid': computed(() => (invalid.value ? 'true' : false)),
        'aria-describedby': computed(() => (invalid.value || f.hint ? `${id}-note` : false)),
      };
      // The input's parts: its state decides which; the skin decides how.
      const inputParts = (): Parts => ['input', ...(invalid.value ? ['input.invalid' as const] : []), ...(readOnly.value ? ['input.readonly' as const] : [])];
      const style: InputStyle = (extra = {}) => ctx.part(inputParts, { ...inputBox(), ...extra });
      const on = (name: string, handler: (e: Event) => void) => ({ [name]: handler, blur: () => draft.blur(f.key) });

      if (f.kind === 'select') {
        const opts = computed(() => optionsOf(f, value()));
        // The engine's eyes-decision: a handful of choices is a segmented group, more is a list.
        return computed(() => (opts.value.length >= 2 && opts.value.length <= SEGMENTED_MAX ? segmented(f, opts.value, id, readOnly) : select(f, opts.value, id, common, style, readOnly, on)));
      }
      if (f.kind === 'file') {
        // A file control cannot take a value; it resets by remount.
        return computed(() => { draft.generation.value; return el('input', {
          ...common,
          type: 'file',
          accept: f.accept ?? false,
          disabled: computed(() => (readOnly.value ? 'disabled' : false)),
          style: style({ padding: `${metrics.space[1]}px ${metrics.space[2]}px`, height: 'auto' }),
          on: on('change', (e) => draft.set(f.key, (e.target as HTMLInputElement).files?.[0] ?? undefined)),
        }); });
      }
      if (f.kind === 'checkbox') {
        const r = ref<HTMLElement>();
        return el('span', { style: ctx.part([], { display: 'flex', alignItems: 'center', gap: metrics.space[2], height: metrics.control.height }) }, [
          el('input', {
            ref: r,
            ...common,
            type: 'checkbox',
            disabled: computed(() => (readOnly.value ? 'disabled' : false)),
            style: ctx.part([], { width: metrics.control.check, height: metrics.control.check, margin: 0 }),
            checked: computed(() => sync(r, 'checked', !!value()[f.key])),
            on: on('change', (e) => draft.set(f.key, (e.target as HTMLInputElement).checked)),
          }),
          el('span', { style: ctx.part('text') }, f.placeholder ?? ''),
        ]);
      }
      if (f.kind === 'textarea') {
        const r = ref<HTMLElement>();
        return el('textarea', {
          ref: r,
          ...common,
          rows: '3',
          readonly: computed(() => (readOnly.value ? 'readonly' : false)),
          style: style({ height: 'auto', minHeight: 80, padding: metrics.space[3] }),
          on: on('input', (e) => draft.set(f.key, (e.target as HTMLTextAreaElement).value)),
        }, computed(() => { const v = show(value()[f.key]); sync(r, 'value', v); return v; }));
      }
      const r = ref<HTMLElement>();
      return el('input', {
        ref: r,
        ...common,
        type: f.kind === 'date' ? 'date' : f.kind === 'text' ? 'text' : 'number',
        min: attr(f.min), max: attr(f.max), step: attr(stepOf(f)),
        inputmode: f.kind === 'money' || f.kind === 'number' ? 'decimal' : false,
        readonly: computed(() => (readOnly.value ? 'readonly' : false)),
        style: style(),
        value: computed(() => sync(r, 'value', show(value()[f.key]))),
        on: on('input', (e) => draft.set(f.key, parse(f.kind, (e.target as HTMLInputElement).value))),
      });
    };

    const select = (f: Field<Rec>, opts: readonly Option[], id: string, common: Common, style: InputStyle, readOnly: ReadonlySignal<boolean>, on: (n: string, h: (e: Event) => void) => Record<string, (e: Event) => void>) => {
      const r = ref<HTMLElement>();
      const current = computed(() => show(value()[f.key]));
      return el('select', {
        ref: r,
        ...common,
        disabled: computed(() => (readOnly.value ? 'disabled' : false)),
        style: style(),
        on: on('change', (e) => draft.set(f.key, (e.target as HTMLSelectElement).value)),
      }, [
        el('option', { value: '' }, f.placeholder ?? 'Choose…'),
        ...opts.map((o) => el('option', { value: o.value, selected: computed(() => (current.value === o.value ? 'selected' : false)) }, o.label)),
        // Options are mounted after the attributes: the property is synced from a trailing slot.
        computed(() => { sync(r, 'value', current.value); return null; }),
      ]);
    };

    const segmented = (f: Field<Rec>, opts: readonly Option[], id: string, readOnly: ReadonlySignal<boolean>) => {
      const current = computed(() => show(value()[f.key]));
      const buttons = opts.map((o, i) => el('button', {
        type: 'button',
        role: 'radio',
        value: o.value,
        'aria-checked': computed(() => (current.value === o.value ? 'true' : 'false')),
        tabindex: computed(() => (current.value === o.value || (i === 0 && !opts.some((x) => x.value === current.value)) ? '0' : '-1')),
        disabled: computed(() => (readOnly.value ? 'disabled' : false)),
        style: ctx.part(
          (): Parts => ['button', current.value === o.value ? 'button.primary' : 'button.plain', ...(readOnly.value ? ['input.readonly' as const] : [])],
          { ...buttonBox(), flex: '1 1 0', minWidth: 0, justifyContent: 'center' },
        ),
        on: {
          click: () => draft.set(f.key, o.value),
          keydown: (e) => {
            const k = (e as KeyboardEvent).key;
            const d = k === 'ArrowRight' || k === 'ArrowDown' ? 1 : k === 'ArrowLeft' || k === 'ArrowUp' ? -1 : 0;
            if (!d) return;
            e.preventDefault();
            const next = opts[(i + d + opts.length) % opts.length]!;
            draft.set(f.key, next.value);
            host.querySelector<HTMLElement>(`#${id} [value="${next.value}"]`)?.focus();
          },
        },
      }, o.label));
      return el('div', {
        id,
        name: f.key,
        role: 'radiogroup',
        'aria-labelledby': `${id}-label`,
        'aria-invalid': computed(() => (errorOf(f.key) ? 'true' : false)),
        'aria-describedby': computed(() => (errorOf(f.key) || f.hint ? `${id}-note` : false)),
        'aria-readonly': computed(() => (readOnly.value ? 'true' : false)),
        style: ctx.part([], { display: 'flex', gap: metrics.space[1], minWidth: 0, height: metrics.control.height }),
        on: { focusout: (e) => { const to = (e as FocusEvent).relatedTarget as Node | null; if (!to || !(e.currentTarget as HTMLElement).contains(to)) draft.blur(f.key); } },
      }, buttons);
    };

    // ── Fields, groups, the grid ─────────────────────────────────────────

    const fieldEl = (f: Field<Rec>) => {
      const id = `f-${f.key}`;
      return el('div', {
        style: ctx.part([], { display: 'flex', flexDirection: 'column', gap: metrics.space[1], minWidth: 0, gridColumn: spansRow(f) ? '1 / -1' : 'auto' }),
      }, [
        el('label', { for: id, id: `${id}-label`, style: ctx.part('text.muted') }, f.required ? `${f.label} *` : f.label),
        control(f),
        el('span', {
          id: `${id}-note`,
          style: ctx.part((): Part => (errorOf(f.key) ? 'tone.negative' : 'text.faint'), () => ({ display: errorOf(f.key) || f.hint ? 'block' : 'none' })),
        }, computed(() => errorOf(f.key) || f.hint || '')),
      ]);
    };

    const groupEl = (g: Extract<Item, { kind: 'group' }>) => {
      const members = computed(() => items.value.find((i): i is Extract<Item, { kind: 'group' }> => i.id === g.id)?.fields ?? []);
      const n = computed(() => columnsFor(width.value, members.value.length, metrics.layout.minField, gap));
      return el('fieldset', {
        style: ctx.part([], () => ({ ...gridOf(n.value), gridColumn: '1 / -1', margin: 0, padding: 0, border: 'none', minWidth: 0 })),
      }, [
        el('legend', { style: ctx.part('text.label', { padding: 0, marginBottom: metrics.space[2] }) }, g.title),
        each(members, (f) => f.key, (f) => fieldEl(untrack(() => f.value))),
      ]);
    };

    const body = el('div', { style: ctx.part([], () => gridOf(cols.value)) }, [
      each(items, (i) => i.id, (item) => { const i = untrack(() => item.value); return i.kind === 'field' ? fieldEl(i.field) : groupEl(i); }),
    ]);

    const summary = computed(() => {
      const n = Object.keys(draft.errors.value).length;
      return n >= 2 ? el('p', { role: 'alert', style: ctx.part('tone.negative', { margin: 0 }) }, `${n} fields need attention.`) : null;
    });

    const button = (variant: 'primary' | 'plain' | 'danger', id: string | null, structure: () => StyleRecord) =>
      ctx.part(
        (): Parts => ['button', `button.${variant}`, ...(id && busy.is(id) ? ['button.busy' as const] : [])],
        () => ({ ...buttonBox(), ...structure() }),
      );

    return el('form', {
      novalidate: 'novalidate',
      style: ctx.part([], { display: 'flex', flexDirection: 'column', gap: metrics.space[4] }),
      on: { submit: (e) => { e.preventDefault(); submit(); } },
    }, [
      summary,
      body,
      el('div', { style: ctx.part([], () => ({ display: props.mode.value === 'live' ? 'none' : 'flex', gap: metrics.space[2], justifyContent: 'flex-end', flexWrap: 'wrap' })) }, [
        el('button', {
          type: 'button',
          'aria-busy': computed(() => (busy.is('destructive') ? 'true' : false)),
          disabled: computed(() => (busy.is('destructive') ? 'disabled' : false)),
          style: button('danger', 'destructive', () => ({ marginRight: 'auto', display: props.destructive.value ? 'inline-flex' : 'none' })),
          on: { click: () => busy.run('destructive', props.destructive.value?.onSelect) },
        }, computed(() => props.destructive.value?.label ?? '')),
        el('button', {
          type: 'button',
          style: button('plain', null, () => ({ display: props.onCancel.value ? 'inline-flex' : 'none' })),
          on: { click: cancel },
        }, 'Cancel'),
        el('button', {
          type: 'submit',
          'aria-busy': computed(() => (busy.is('submit') ? 'true' : false)),
          disabled: computed(() => (busy.is('submit') ? 'disabled' : false)),
          style: button('primary', 'submit', () => ({})),
        }, computed(() => props.submitLabel.value ?? 'Save')),
      ]),
    ]);
  },
});

export function Form<T extends object>(props: FormProps<T>): Content {
  const { ref, value, ...rest } = props;
  const owned = !('value' in props);
  const onChange = props.onChange ?? (isSignal(value) ? (v: T) => { (value as Signal<T>).value = v; } : undefined);
  const impl: Record<string, unknown> = { ...rest, owned, onChange, handle: ref };
  if (!owned) impl.value = value;
  return FormImpl(impl as unknown as Parameters<typeof FormImpl>[0]);
}
