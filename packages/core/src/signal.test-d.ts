/**
 * Compile-time API proofs for the reactive primitives (ADR 0030.2 T5 / §3).
 * Checked by `tsc --noEmit` (this file is not run by vitest).
 */
import { signal, computed, effect, untrack } from './signal.js';

// ── effect() rejects async callbacks at the type level (N310) ────────

// @ts-expect-error — async functions are not valid effects; use resource()
effect(async () => {});

// @ts-expect-error — Promise-returning callbacks are equally rejected
effect(() => Promise.resolve(1));

// Synchronous callbacks with incidental non-void returns stay legal
// (expression-bodied arrows: Array.push returns number).
const values: number[] = [];
effect(() => values.push(1));

// Cleanup-returning callbacks stay legal, and dispose stays a function.
const dispose: () => void = effect(() => {
  return () => { values.length = 0; };
});
dispose();

// Conditional cleanup (union with undefined) stays legal.
effect(() => {
  if (values.length > 0) return () => {};
});

// ── untrack<T> returns its callback's value ──────────────────────────

const n: number = untrack(() => 42);
const strings: string[] = untrack(() => ['a']);
// Void callbacks still typecheck in statement position.
untrack(() => { values.push(n, strings.length); });

// @ts-expect-error — the return type is the callback's, not any
const misTyped: string = untrack(() => 42);
void misTyped;

// ── peek(): non-tracking read is typed like `value` ──────────────────

const count = signal(0);
const peeked: number = count.peek();
void peeked;

const doubled = computed(() => count.value * 2);
const peekedComputed: number = doubled.peek();
void peekedComputed;

// @ts-expect-error — peek returns T, not any
const wrongPeek: string = count.peek();
void wrongPeek;
