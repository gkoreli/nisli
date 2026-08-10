/**
 * T3 design-gate prototype: can `component(tag, schema, setup)` infer BOTH the
 * runtime attr behavior AND the full props type from one value declaration,
 * while the legacy `component<P, typeof attrs>(tag, setup, opts)` overload
 * coexists? Checked with the workspace tsc (5.9.3), strict.
 */

// ── Minimal stand-ins for core types ────────────────────────────────
type Signal<T> = { value: T };
type ReadonlySignal<T> = { readonly value: T };
type TemplateResult = { readonly __tpl: unique symbol } & { mount(h: HTMLElement): void };
declare const tpl: TemplateResult;
type PropInput<T> = T | Signal<T> | ReadonlySignal<T>;

// ── Legacy machinery (copied shape from component.ts:62–197) ────────
type IsExactKind<T, K> =
  [NonNullable<T>] extends [K] ? ([K] extends [NonNullable<T>] ? true : false) : false;
type AttrValueType<T, D> =
  D extends 'boolean' ? (IsExactKind<T, boolean> extends true ? boolean : T)
  : D extends { type: 'boolean' } ? (IsExactKind<T, boolean> extends true ? boolean : T)
  : D extends { type: 'number'; default: number } ? (IsExactKind<T, number> extends true ? number : T)
  : D extends 'number' ? (IsExactKind<T, number> extends true ? number | undefined : T)
  : D extends { type: 'number' } ? (IsExactKind<T, number> extends true ? number | undefined : T)
  : T;
type AttrDecl =
  | 'string' | 'boolean' | 'number' | 'forward'
  | { type: 'boolean'; default?: boolean; attr?: string }
  | { type: 'string'; default?: string; attr?: string }
  | { type: 'number'; default?: number; attr?: string };
type ComponentAttrs<P> = Partial<Record<Extract<keyof P, string>, AttrDecl>>;
type ReactiveProps<P, A extends ComponentAttrs<P> = {}> = {
  readonly [K in keyof P]-?: Signal<K extends keyof A ? AttrValueType<P[K], A[K]> : P[K]>;
};
type SetupFunction<P, A extends ComponentAttrs<P> = {}> = (
  props: ReactiveProps<P, A>,
  host: HTMLElement,
) => TemplateResult;
interface ComponentOptions<P = unknown> {
  onError?: (error: Error, host: HTMLElement) => TemplateResult | string;
  attrs?: ComponentAttrs<P>;
}
type ComponentFactory<P> = (
  props: { [K in keyof P]: PropInput<P[K]> },
  hostAttrs?: { class?: PropInput<string> },
) => TemplateResult;

// ── Schema spec layer (the T3 proposal) ─────────────────────────────
declare const IN: unique symbol;
declare const OUT: unique symbol;
/** Dual-phantom spec: `In` = what the factory may pass (drives optionality),
 * `Out` = what setup's signal holds after runtime reconciliation. The split is
 * the load-bearing design: a defaulted kind is optional-in but non-undefined-out
 * (Zod's z.input/z.output distinction). Phantoms are type-space only. */
interface PropSpec<In, Out> { readonly [IN]: In; readonly [OUT]: Out; readonly kind: string }

interface BoolSpec extends PropSpec<boolean | undefined, boolean> { readonly kind: 'boolean'; readonly default?: boolean }
interface StringSpec<T extends string> extends PropSpec<T | undefined, T | undefined> { readonly kind: 'string' }
interface StringDefSpec<T extends string> extends PropSpec<T | undefined, T> { readonly kind: 'string'; readonly default: T }
interface NumberSpec extends PropSpec<number | undefined, number | undefined> { readonly kind: 'number' }
interface NumberDefSpec extends PropSpec<number | undefined, number> { readonly kind: 'number'; readonly default: number }
interface ForwardSpec extends PropSpec<string | undefined, string | undefined> { readonly kind: 'forward' }
interface EventSpec<D> extends PropSpec<((detail: D) => void) | undefined, ((detail: D) => void) | undefined> { readonly kind: 'event' }
interface ObjectSpec<T> extends PropSpec<T, T> { readonly kind: 'object' }
interface StateSpec<T> extends PropSpec<T | undefined, T> { readonly kind: 'state'; readonly default: T }
interface ChildrenSpec extends PropSpec<string | TemplateResult | undefined, string | TemplateResult | undefined> { readonly kind: 'children' }

declare const p: {
  boolean(opts?: { default?: boolean }): BoolSpec;
  string<T extends string = string>(): StringSpec<T>;
  string<T extends string>(opts: { default: T }): StringDefSpec<T>;
  number(): NumberSpec;
  number(opts: { default: number }): NumberDefSpec;
  forward(): ForwardSpec;
  event<D>(): EventSpec<D>;
  /** required object/function-valued prop — type supplied explicitly */
  object<T>(): ObjectSpec<T>;
  optional<T>(): ObjectSpec<T | undefined>;
  state<T extends boolean | string>(opts: { default: T }): StateSpec<T>;
  children(): ChildrenSpec;
};

type Schema = Record<string, PropSpec<any, any>>;
type SpecIn<S> = S extends PropSpec<infer I, any> ? I : never;
type SpecOut<S> = S extends PropSpec<any, infer O> ? O : never;

/** Factory props: keys whose INPUT type admits undefined become optional. */
type FactoryProps<S extends Schema> =
  { [K in keyof S as undefined extends SpecIn<S[K]> ? never : K]: PropInput<SpecIn<S[K]>> } &
  { [K in keyof S as undefined extends SpecIn<S[K]> ? K : never]?: PropInput<SpecIn<S[K]>> };

/** Setup props: every key present, wrapped as Signal of the OUTPUT type. */
type SchemaSetupProps<S extends Schema> = { readonly [K in keyof S]-?: Signal<SpecOut<S[K]>> };

// ── The dual-form component() ───────────────────────────────────────
declare function component<S extends Schema>(
  tag: string,
  schema: S,
  setup: (props: SchemaSetupProps<S>, host: HTMLElement) => TemplateResult,
): (props: FactoryProps<S>, hostAttrs?: { class?: PropInput<string> }) => TemplateResult;
declare function component<
  P extends object = Record<string, never>,
  A extends ComponentAttrs<P> = {},
>(
  tag: string,
  setup: SetupFunction<P, A>,
  ...args: [keyof A] extends [never]
    ? [options?: ComponentOptions<P>]
    : [options: ComponentOptions<P> & { attrs: A }]
): ComponentFactory<P>;

// ════════════════════════════════════════════════════════════════════
// (1) THE FLAGSHIP CALL — full inference from one value declaration
// ════════════════════════════════════════════════════════════════════
interface Task { id: string; title: string }

const Switch = component('ui-switch', {
  checked: p.boolean(),
  label: p.string(),
  onChange: p.event<boolean>(),
  task: p.object<Task>(),
}, (props, host) => {
  // setup side: narrowed exactly as the runtime guarantees
  const c: boolean = props.checked.value;               // boolean, NOT boolean|undefined
  const l: string | undefined = props.label.value;      // string attr absent → undefined
  const t: Task = props.task.value;                     // required object
  props.onChange.value?.(true);                          // typed handler payload
  const h: HTMLElement = host;
  // @ts-expect-error declared boolean is not undefined
  const bad: undefined = props.checked.value;
  // @ts-expect-error payload is boolean, not string
  props.onChange.value?.('nope');
  return tpl;
});

// factory side: required vs optional derived from the same schema
Switch({ task: { id: '1', title: 'x' } });
Switch({ task: { id: '1', title: 'x' }, checked: true, label: 'hi', onChange: (b) => { const _: boolean = b; } });
// @ts-expect-error task is required
Switch({ checked: true });
// @ts-expect-error unknown factory prop
Switch({ task: { id: '1', title: 'x' }, varian: 'x' });
// @ts-expect-error wrong payload type
Switch({ task: { id: '1', title: 'x' }, onChange: (s: string) => s });

// literal-union string props need the explicit generic (author type survives)
const Sized = component('ui-sized', {
  size: p.string<'sm' | 'default'>(),
  span: p.number({ default: 1 }),
  ratio: p.number(),
}, (props) => {
  const s: 'sm' | 'default' | undefined = props.size.value;
  const sp: number = props.span.value;                  // default → non-undefined
  const r: number | undefined = props.ratio.value;
  // @ts-expect-error no-default number keeps | undefined
  const rBad: number = props.ratio.value;
  return tpl;
});
Sized({});
// @ts-expect-error size must be the union
Sized({ size: 'lg' });

// p.state + children coexistence
const Dialog = component('ui-dialog', {
  open: p.state({ default: false }),
  className: p.string(),
  children: p.children(),
}, (props) => {
  const o: boolean = props.open.value;
  return tpl;
});
Dialog({});
Dialog({ open: true, children: tpl });

// ════════════════════════════════════════════════════════════════════
// (2) LEGACY OVERLOAD COEXISTENCE — the current registry forms
// ════════════════════════════════════════════════════════════════════
interface AttrProps {
  checked?: boolean;
  size?: 'sm' | 'lg';
  name?: string;
}
const attrProofAttrs = {
  checked: 'boolean',
  size: 'string',
  name: 'forward',
} satisfies ComponentAttrs<AttrProps>;

// (2a) two explicit type args + options — the UI-35 narrowing form
const Legacy = component<AttrProps, typeof attrProofAttrs>('legacy-narrowed', (props) => {
  const checked: boolean = props.checked.value;         // narrowed by AttrValueType
  const size: 'sm' | 'lg' | undefined = props.size.value;
  return tpl;
}, { attrs: attrProofAttrs });
Legacy({ checked: true });

// (2b) one explicit type arg, no options — the plain legacy form
interface InterfaceProps { title: string; count?: number }
const Plain = component<InterfaceProps>('legacy-plain', (props) => {
  const title: string = props.title.value;
  const count: number | undefined = props.count.value;
  return tpl;
});
Plain({ title: 'Works' });
// @ts-expect-error title is required
Plain({});

// (2c) zero type args, inline setup — still resolves to the legacy overload
const Zero = component('legacy-zero', () => tpl);
Zero({});

// (2d) required-options guard survives: narrowing type arg without options must fail
// @ts-expect-error options carrying attrs is required when A is non-empty
component<AttrProps, typeof attrProofAttrs>('legacy-missing-options', (props) => tpl);

// ════════════════════════════════════════════════════════════════════
// (3) AMBIGUITY PROBES
// ════════════════════════════════════════════════════════════════════
// empty schema resolves to the schema overload (not an error)
const Empty = component('empty-schema', {}, () => tpl);
Empty({});

// a schema value that is not a PropSpec is rejected
// @ts-expect-error plain values are not specs
component('bad-schema', { checked: true }, () => tpl);

export { Switch, Sized, Dialog, Legacy, Plain, Zero, Empty };
