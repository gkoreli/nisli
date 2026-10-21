import { signal } from '../../../../../packages/core/src/signal.ts';

/** Throwaway research mechanism, not a proposed public API or RPC boundary. */
export interface Operation<I, O> {
  readonly completion: 'local' | 'remote';
  readonly prepare?: () => Promise<void>;
  readonly execute: (input: I) => O | Promise<O>;
  readonly reconcile?: () => Promise<void>;
  readonly refresh: readonly (() => Promise<unknown>)[];
  readonly refreshOn: 'success' | 'settled';
}

export interface Receipt<O> {
  readonly effect: 'not-started' | 'unconfirmed' | 'acknowledged';
  readonly completion: 'local' | 'remote';
  readonly value?: O;
  readonly failure?: { readonly phase: string; readonly error: unknown };
}

export function coordinator<I, O>(definition: Operation<I, O>) {
  const phase = signal('idle');
  let inflight: Promise<Receipt<O>> | undefined;
  const run = async (input: I): Promise<Receipt<O>> => {
    let effect: Receipt<O>['effect'] = 'not-started';
    let value: O | undefined;
    let failure: Receipt<O>['failure'];
    try {
      phase.value = 'prepare';
      await definition.prepare?.();
      phase.value = 'execute';
      effect = 'unconfirmed';
      value = await definition.execute(input);
      effect = 'acknowledged';
      phase.value = 'reconcile';
      await definition.reconcile?.();
    } catch (error) { failure = { phase: phase.value, error }; }
    if (!failure || definition.refreshOn === 'settled') {
      phase.value = 'refresh';
      const results = await Promise.allSettled(definition.refresh.map(refresh => Promise.resolve().then(refresh)));
      // Keep the primary failure: a failed read must not hide a write outcome.
      const rejected = results.find(r => r.status === 'rejected');
      if (!failure && rejected?.status === 'rejected') failure = { phase: 'refresh', error: rejected.reason };
    }
    const receipt = { effect, completion: definition.completion, value, failure };
    phase.value = failure ? effect === 'acknowledged' ? 'acknowledged-needs-attention' : effect === 'unconfirmed' ? 'outcome-unknown' : 'failed' : definition.completion === 'local' ? 'accepted-locally' : 'confirmed-remotely';
    return receipt;
  };
  return {
    phase,
    invoke(input: I): Promise<Receipt<O>> {
      if (inflight) return Promise.reject(new Error('Operation session is busy; a different call was not silently merged'));
      inflight = run(input).finally(() => { inflight = undefined; });
      return inflight;
    },
  };
}
