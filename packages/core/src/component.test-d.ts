/** Compile-time API proofs for component() prop inference. */
import { component, type ComponentAttrs } from './component.js';
import { html } from './template.js';

interface InterfaceProps {
  title: string;
  count?: number;
}

const InterfaceComponent = component<InterfaceProps>('interface-props-proof', (props) => {
  const title: string = props.title.value;
  const count: number | undefined = props.count.value;
  return html`<span>${title}:${count}</span>`;
});

InterfaceComponent({ title: 'Works' });
InterfaceComponent({ title: 'Works', count: 1 });

// @ts-expect-error title is required
InterfaceComponent({});
// @ts-expect-error count must be a number
InterfaceComponent({ title: 'Wrong', count: 'one' });

// ── ADR 0025 candidate (b): declared-type-aware ReactiveProps ────────
//
// Passing the `attrs` literal type as the second type argument narrows
// `props.K.value` to the runtime type the declaration guarantees, retiring the
// `as boolean` / `?? false` stopgap. `satisfies` validates the map (keys must be
// props, values must be AttrDecls) while preserving the literal shape.

interface AttrProps {
  checked?: boolean; // 'boolean'      → boolean
  loading?: boolean; // { type:'boolean', default:true } → boolean
  span?: number; //     { type:'number', default:1 } → number
  ratio?: number; //    'number' (no default) → number | undefined
  size?: 'sm' | 'lg'; // 'string' → unchanged (| undefined)
  name?: string; //     'forward' → unchanged (| undefined)
  extra?: boolean; //   undeclared → unchanged (| undefined)
}

const attrProofAttrs = {
  checked: 'boolean',
  loading: { type: 'boolean', default: true },
  span: { type: 'number', default: 1 },
  ratio: 'number',
  size: 'string',
  name: 'forward',
} satisfies ComponentAttrs<AttrProps>;

component<AttrProps, typeof attrProofAttrs>('attr-narrowing-proof', (props) => {
  // Declared booleans are non-undefined (absent → false / default).
  const checked: boolean = props.checked.value;
  const loading: boolean = props.loading.value;
  // number with a default is non-undefined; without, stays optional.
  const span: number = props.span.value;
  const ratio: number | undefined = props.ratio.value;
  // string / forward / undeclared keep their optional author type.
  const size: 'sm' | 'lg' | undefined = props.size.value;
  const name: string | undefined = props.name.value;
  const extra: boolean | undefined = props.extra.value;
  return html`<span>${checked}${loading}${span}${ratio}${size}${name}${extra}</span>`;
}, { attrs: attrProofAttrs });

// A declared boolean is NOT `undefined` — asserting `undefined` must fail.
component<AttrProps, typeof attrProofAttrs>('attr-narrowing-negative', (props) => {
  // @ts-expect-error checked narrows to boolean, so it is not assignable to undefined
  const bad: undefined = props.checked.value;
  // @ts-expect-error a no-default number keeps `| undefined`, so it is not a bare number
  const badRatio: number = props.ratio.value;
  return html`<span>${bad}${badRatio}</span>`;
}, { attrs: attrProofAttrs });

// Required-options: with a non-empty attrs type argument, the options object
// carrying `attrs` is REQUIRED — a call that types the props as narrowed but
// never wires the attrs at runtime is a compile-time lie and must not compile.
// @ts-expect-error options with `attrs: A` is required when the attrs type arg is non-empty
component<AttrProps, typeof attrProofAttrs>('attr-requires-options', (props) =>
  html`<span>${props.checked.value}</span>`);

// ...and options present but WITHOUT `attrs` also fails (attrs is the required key).
component<AttrProps, typeof attrProofAttrs>(
  'attr-requires-attrs-key',
  (props) => html`<span>${props.checked.value}</span>`,
  // @ts-expect-error `attrs` is a required property of the options here
  { onError: () => 'x' },
);

// Legacy (no second type argument) keeps the options argument optional.
component<AttrProps>('attr-legacy-optional-options', (props) =>
  html`<span>${props.checked.value}</span>`);

// Sound fallback on an INCOMPATIBLE declaration: a decl whose runtime type the
// prop cannot hold must NOT narrow (that would be a lie) — it falls back to the
// author type. `ComponentAttrs<P>` permits the mismatch (it only checks each
// value is an AttrDecl); `AttrValueType` is what refuses the bad narrowing.
interface MismatchProps {
  label?: string; // declared 'boolean' (WRONG) → must stay string | undefined
  flag?: boolean; // declared { type:'number', default } (WRONG) → must stay boolean | undefined
}
const mismatchAttrs = {
  label: 'boolean',
  flag: { type: 'number', default: 0 },
} satisfies ComponentAttrs<MismatchProps>;

component<MismatchProps, typeof mismatchAttrs>('attr-mismatch-sound-fallback', (props) => {
  const label: string | undefined = props.label.value;
  const flag: boolean | undefined = props.flag.value;
  // @ts-expect-error a 'boolean' decl on a string prop must NOT narrow to boolean
  const labelBad: boolean = props.label.value;
  // @ts-expect-error a numeric decl on a boolean prop must NOT narrow to number
  const flagBad: number = props.flag.value;
  return html`<span>${label}${flag}${labelBad}${flagBad}</span>`;
}, { attrs: mismatchAttrs });

// EXACT-KIND (both-directions) fallback — the narrowing is applied ONLY when
// `NonNullable<P[K]>` is EXACTLY the declared kind. A partial-overlap UNION or a
// LITERAL author type must fall back to `T`, never narrow (a one-way guard would
// drop `string` from `boolean | string`, or widen a literal `true`/`1`).
interface UnionLiteralProps {
  flexi?: boolean | string; // 'boolean' — overlaps but is not exactly boolean
  measure?: number | string; // {type:'number',default} — overlaps but not exactly number
  lit?: true; // 'boolean' — a literal, not exactly boolean
  litNum?: 1; // {type:'number',default} — a literal, not exactly number
}
const unionLiteralAttrs = {
  flexi: 'boolean',
  measure: { type: 'number', default: 0 },
  lit: 'boolean',
  litNum: { type: 'number', default: 0 },
} satisfies ComponentAttrs<UnionLiteralProps>;

component<UnionLiteralProps, typeof unionLiteralAttrs>('attr-exact-kind-fallback', (props) => {
  // Every one falls back to the author type — the union keeps BOTH members, the
  // literal keeps its literal type; none silently narrow/widen.
  const flexi: boolean | string | undefined = props.flexi.value;
  const measure: number | string | undefined = props.measure.value;
  const lit: true | undefined = props.lit.value;
  const litNum: 1 | undefined = props.litNum.value;
  // @ts-expect-error `boolean | string` declared 'boolean' must NOT narrow to boolean (drops string)
  const flexiBad: boolean = props.flexi.value;
  // @ts-expect-error `number | string` declared number+default must NOT narrow to number (drops string)
  const measureBad: number = props.measure.value;
  // @ts-expect-error a literal `true` prop must NOT widen to boolean
  const litBad: boolean = props.lit.value;
  // @ts-expect-error a literal `1` prop must NOT widen to number
  const litNumBad: number = props.litNum.value;
  return html`<span>${flexi}${measure}${lit}${litNum}${flexiBad}${measureBad}${litBad}${litNumBad}</span>`;
}, { attrs: unionLiteralAttrs });

// Backward compatibility: omitting the second type argument leaves every prop
// at its author type (the pre-candidate-(b) behavior), even with `attrs` set.
component<AttrProps>('attr-backcompat-proof', (props) => {
  const checked: boolean | undefined = props.checked.value;
  // @ts-expect-error without the type arg, checked keeps `| undefined` (not narrowed)
  const narrowed: boolean = props.checked.value;
  return html`<span>${checked}${narrowed}</span>`;
}, { attrs: { checked: 'boolean' } });

// The `attrs` map is still validated even without the narrowing type arg.
component<AttrProps>('attr-validation-proof', () => html`<span></span>`, {
  // @ts-expect-error 'nope' is not a prop of AttrProps
  attrs: { nope: 'boolean' },
});
