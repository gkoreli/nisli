/**
 * Axes — the context the engine detects or is told, never authored per block
 * (ADR 0046): colour `scheme`, `density` (how much rhythm a person wants) and
 * `input` (the primary pointing device). Each is a preference over a platform
 * reading; `'system'` follows the platform, live, through the same
 * `matchMedia` watcher shape. Density has no platform signal today, so
 * `'system'` is `comfortable` — the word is kept so one can be honoured later
 * without an API change. Axes are never derived from each other (F9).
 *
 * Nothing here knows about skins or metrics: both read `axes` and decide.
 */
import { signal, computed, type ReadonlySignal } from '@nisli/core';

export type Scheme = 'light' | 'dark';
export type Density = 'comfortable' | 'compact';
export type Input = 'pointer' | 'touch';

/** The resolved triple: the input to the metrics table and to a skin. */
export interface Axes {
  readonly scheme: Scheme;
  readonly density: Density;
  readonly input: Input;
}

// ── Preferences and platform readings ──────────────────────────────────

const schemePreference = signal<Scheme | 'system'>('system');
const densityPreference = signal<Density | 'system'>('system');
const inputPreference = signal<Input | 'system'>('system');
const platformScheme = signal<Scheme>('light');
const platformInput = signal<Input>('pointer');

type Query = { matches: boolean; addEventListener?: (t: 'change', cb: (e: { matches: boolean }) => void) => void; addListener?: (cb: (e: { matches: boolean }) => void) => void };

/** Follow one media query, live; with no `matchMedia` (SSR, node) the reading stays at its default. */
function watch(query: string, on: (matches: boolean) => void): void {
  if (typeof matchMedia !== 'function') return;
  const q = matchMedia(query) as Query;
  on(q.matches);
  const onChange = (e: { matches: boolean }) => on(e.matches);
  if (typeof q.addEventListener === 'function') q.addEventListener('change', onChange);
  else q.addListener?.(onChange);
}

let watching = false;
function watchPlatform(): void {
  if (watching || typeof matchMedia !== 'function') return;
  watching = true;
  watch('(prefers-color-scheme: dark)', (dark) => { platformScheme.value = dark ? 'dark' : 'light'; });
  watch('(pointer: coarse)', (coarse) => { platformInput.value = coarse ? 'touch' : 'pointer'; });
}
watchPlatform();

// ── The resolved axes ──────────────────────────────────────────────────

/** The resolved colour scheme: the preference, or the platform's when `'system'`. */
export const scheme: ReadonlySignal<Scheme> = computed(() => (schemePreference.value === 'system' ? platformScheme.value : schemePreference.value));
/** The resolved density: the preference; `'system'` is `comfortable`. */
export const density: ReadonlySignal<Density> = computed(() => (densityPreference.value === 'system' ? 'comfortable' : densityPreference.value));
/** The resolved input: the preference, or `(pointer: coarse)` when `'system'`. */
export const input: ReadonlySignal<Input> = computed(() => (inputPreference.value === 'system' ? platformInput.value : inputPreference.value));

/** The resolved axes, one signal. */
export const axes: ReadonlySignal<Axes> = computed(() => ({ scheme: scheme.value, density: density.value, input: input.value }));

/**
 * Only the two axes that size anything. A scheme flip changes neither
 * primitive, so this keeps its identity and nothing structural re-decides —
 * the metrics table and every `fitRow` hang off this, never off `axes`.
 */
export const sizing: ReadonlySignal<Pick<Axes, 'density' | 'input'>> = computed(() => ({ density: density.value, input: input.value }));

/** Set the scheme preference; `'system'` follows `prefers-color-scheme`, live. */
export function setScheme(s: Scheme | 'system'): void {
  schemePreference.value = s;
  if (s === 'system') watchPlatform();
}

/** Set the density preference; `'system'` resolves to `comfortable`. */
export function setDensity(d: Density | 'system'): void {
  densityPreference.value = d;
}

/** Set the input preference; `'system'` follows `(pointer: coarse)`, live. */
export function setInput(i: Input | 'system'): void {
  inputPreference.value = i;
  if (i === 'system') watchPlatform();
}
