/** A disposal surface that exposes ERM when the consumer's lib supports it. */
type DisposeSymbol = typeof Symbol extends {
  readonly dispose: infer Key extends symbol;
} ? Key : never;

export type DisposableResource = {
  [Key in DisposeSymbol]: () => void;
};

/** Callable disposer returned by effects, subscriptions, and emitter handles. */
export interface Disposer extends DisposableResource {
  (): void;
}

const DISPOSE = Symbol.dispose as typeof Symbol.dispose | undefined;

/** Attach a guarded Symbol.dispose alias without polyfilling the platform. */
export function disposable<T extends object>(
  value: T,
  dispose: () => void,
): T & DisposableResource {
  if (DISPOSE) (value as Record<symbol, () => void>)[DISPOSE] = dispose;
  return value as T & DisposableResource;
}
