import { describe, expect, it } from 'vitest';
import { effect, flush, signal, untrack, type Disposer } from '../../../../../packages/core/src/signal.ts';
import { ownedEffect, detached } from './owned-effect.ts';

describe('optional lifetime ownership separate from dependency tracking', () => {
  it('records the current explicit-cleanup contract for standalone nested effects', () => {
    const source = signal(0), branch = signal(0);
    const children: Disposer[] = [];
    let observations = 0;
    const stop = effect(() => { branch.value; children.push(effect(() => { source.value; observations++; })); });
    try {
      branch.value++; flush();
      const before = observations;
      source.value++; flush();
      expect(observations - before).toBe(2);
      stop();
      const afterStop = observations;
      source.value++; flush();
      expect(observations - afterStop).toBe(2);
      console.log(JSON.stringify({ current: 'standalone nested effects require explicit child cleanup', activeChildrenAfterParentStop: 2 }));
    } finally { stop(); for (const child of children) child(); }
  });

  it('replaces old child computations and stops them with the owner', () => {
    const source = signal(0), branch = signal(0);
    let observations = 0;
    const stop = ownedEffect(() => { branch.value; ownedEffect(() => { source.value; observations++; }); });
    try {
      branch.value++; flush();
      const before = observations;
      source.value++; flush();
      expect(observations - before).toBe(1);
      stop();
      const afterStop = observations;
      source.value++; flush();
      expect(observations).toBe(afterStop);
    } finally { stop(); }
  });

  it('untrack suppresses dependencies without abandoning lifetime ownership', () => {
    const source = signal(0);
    let observations = 0;
    const stop = ownedEffect(() => { untrack(() => ownedEffect(() => { source.value; observations++; })); });
    source.value++; flush();
    expect(observations).toBe(2);
    stop(); source.value++; flush();
    expect(observations).toBe(2);
  });

  it('explicit detachment keeps an intentionally longer lifetime possible', () => {
    const source = signal(0);
    let observations = 0;
    let child!: Disposer;
    const stop = ownedEffect(() => { child = detached(() => ownedEffect(() => { source.value; observations++; })); });
    try {
      stop(); source.value++; flush();
      expect(observations).toBe(2);
    } finally { stop(); child(); }
  });

  it('retains authored callback cleanup while owning descendant effects', () => {
    const source = signal(0);
    let cleanups = 0;
    const stop = ownedEffect(() => { source.value; return () => { cleanups++; }; });
    source.value++; flush();
    expect(cleanups).toBe(1);
    stop(); stop();
    expect(cleanups).toBe(2);
  });
});
