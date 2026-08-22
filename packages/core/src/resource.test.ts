/**
 * resource.test.ts — Local async derivation lifecycle.
 *
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { component } from './component.js';
import { resource } from './resource.js';
import { flush, signal } from './signal.js';
import { html } from './template.js';

function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('resource()', () => {
  it.runIf(typeof Symbol.dispose === 'symbol')('aliases dispose for ERM without changing dispose()', async () => {
    const loader = vi.fn(async () => 'unused');
    const result = resource(() => 'source', loader);

    expect(result[Symbol.dispose]).toBe(result.dispose);
    result.dispose();
    result[Symbol.dispose]();
    await Promise.resolve();

    expect(loader).not.toHaveBeenCalled();
  });

  it('loads the tracked source and exposes data/loading/error signals', async () => {
    const source = signal('markdown');
    const gate = deferred<string>();
    const result = resource(() => source.value, () => gate.promise);

    expect(result.loading.value).toBe(true);
    expect(result.data.value).toBeUndefined();
    expect(result.error.value).toBeNull();

    gate.resolve('<p>rendered</p>');
    await vi.waitFor(() => expect(result.loading.value).toBe(false));
    expect(result.data.value).toBe('<p>rendered</p>');
    expect(result.error.value).toBeNull();
    result.dispose();
  });

  it('normalizes loader rejection and clears loading', async () => {
    const result = resource(
      () => 'markdown',
      () => {
        throw 'parse failed';
      },
    );

    await vi.waitFor(() => expect(result.loading.value).toBe(false));
    expect(result.error.value?.message).toBe('parse failed');
    result.dispose();
  });

  it('normalizes non-stringifiable rejection reasons', async () => {
    const result = resource(
      () => 'markdown',
      () => Promise.reject(Object.create(null)),
    );

    await vi.waitFor(() => expect(result.loading.value).toBe(false));
    expect(result.error.value?.message).toBe('Unknown error');
    result.dispose();
  });

  it('does not start a queued loader after immediate disposal', async () => {
    const loader = vi.fn(async () => 'rendered');
    const result = resource(() => 'markdown', loader);

    result.dispose();
    await Promise.resolve();

    expect(loader).not.toHaveBeenCalled();
  });

  it('does not start a stale queued loader after source replacement', async () => {
    const source = signal('old');
    const loader = vi.fn(async (value: string) => value.toUpperCase());
    const result = resource(() => source.value, loader);

    source.value = 'new';
    flush();

    await vi.waitFor(() => expect(result.data.value).toBe('NEW'));
    expect(loader).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledWith('new', expect.any(AbortSignal));
    result.dispose();
  });

  it('discards stale results even when the loader ignores abort', async () => {
    const source = signal('old');
    const oldGate = deferred<string>();
    const newGate = deferred<string>();
    const result = resource(
      () => source.value,
      (value) => value === 'old' ? oldGate.promise : newGate.promise,
    );
    await Promise.resolve(); // start old loader

    source.value = 'new';
    flush();
    await Promise.resolve(); // start new loader

    newGate.resolve('new result');
    await vi.waitFor(() => expect(result.data.value).toBe('new result'));
    oldGate.resolve('old result');
    await Promise.resolve();
    expect(result.data.value).toBe('new result');
    result.dispose();
  });

  it('aborts on source change and explicit disposal', async () => {
    const source = signal('first');
    const signals: AbortSignal[] = [];
    const result = resource(
      () => source.value,
      (_value, loaderSignal) => {
        signals.push(loaderSignal);
        return new Promise<string>(() => {});
      },
    );
    await Promise.resolve();
    expect(signals[0]?.aborted).toBe(false);

    source.value = 'second';
    flush();
    await Promise.resolve();
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    result.dispose();
    expect(signals[1]?.aborted).toBe(true);
    expect(result.loading.value).toBe(false);
  });

  it('uses undefined as the disabled source and clears current state', async () => {
    const source = signal<string | undefined>('markdown');
    const signals: AbortSignal[] = [];
    const loader = vi.fn(async (value: string, loaderSignal: AbortSignal) => {
      signals.push(loaderSignal);
      return value.toUpperCase();
    });
    const result = resource(() => source.value, loader);

    await vi.waitFor(() => expect(result.data.value).toBe('MARKDOWN'));
    source.value = undefined;
    flush();

    expect(signals[0]?.aborted).toBe(true);
    expect(result.data.value).toBeUndefined();
    expect(result.loading.value).toBe(false);
    expect(result.error.value).toBeNull();
    expect(loader).toHaveBeenCalledTimes(1);
    result.dispose();
  });

  it('retains the last success while a newer enabled run loads or fails', async () => {
    const source = signal('first');
    const second = deferred<string>();
    const result = resource(
      () => source.value,
      (value) => value === 'first' ? Promise.resolve('FIRST') : second.promise,
    );
    await vi.waitFor(() => expect(result.data.value).toBe('FIRST'));

    source.value = 'second';
    flush();
    expect(result.data.value).toBe('FIRST');
    expect(result.loading.value).toBe(true);

    second.reject(new Error('second failed'));
    await vi.waitFor(() => expect(result.loading.value).toBe(false));
    expect(result.data.value).toBe('FIRST');
    expect(result.error.value?.message).toBe('second failed');
    result.dispose();
  });

  it('refreshes without tracking signals read inside the loader', async () => {
    const source = signal('source');
    const unrelated = signal('a');
    const loader = vi.fn(async (value: string) => `${value}:${unrelated.value}`);
    const result = resource(() => source.value, loader);

    await vi.waitFor(() => expect(result.data.value).toBe('source:a'));
    unrelated.value = 'b';
    flush();
    await Promise.resolve();
    expect(loader).toHaveBeenCalledTimes(1);

    result.refresh();
    flush();
    await vi.waitFor(() => expect(result.data.value).toBe('source:b'));
    expect(loader).toHaveBeenCalledTimes(2);
    result.dispose();
  });

  it('auto-disposes outstanding work with its component', async () => {
    const tag = `resource-owner-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let loaderSignal: AbortSignal | undefined;
    component(tag, () => {
      resource(
        () => 'markdown',
        (_value, signal) => {
          loaderSignal = signal;
          return new Promise<string>(() => {});
        },
      );
      return html`<span>owner</span>`;
    });

    const element = document.createElement(tag);
    document.body.appendChild(element);
    await Promise.resolve();
    expect(loaderSignal?.aborted).toBe(false);

    document.body.removeChild(element);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(loaderSignal?.aborted).toBe(true);
  });
});
