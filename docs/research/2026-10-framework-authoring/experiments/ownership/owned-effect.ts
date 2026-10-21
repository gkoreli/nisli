import { effect, type Disposer } from '../../../../../packages/core/src/signal.ts';

// Research-only opt-in owner stack. No change to effect() or component context.
let owner: Disposer[] | null = null;

export function ownedEffect(fn: () => void | (() => void)): Disposer {
  const parent = owner;
  const stop = effect(() => {
    const children: Disposer[] = [];
    const previous = owner;
    owner = children;
    const disposeChildren = () => { for (const stop of children.splice(0).reverse()) stop(); };
    try {
      const cleanup = fn();
      return () => { disposeChildren(); if (typeof cleanup === 'function') cleanup(); };
    } catch (error) {
      disposeChildren();
      throw error;
    } finally { owner = previous; }
  });
  parent?.push(stop);
  return stop;
}

export function detached<T>(fn: () => T): T {
  const previous = owner;
  owner = null;
  try { return fn(); } finally { owner = previous; }
}
