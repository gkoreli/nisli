import { afterEach, describe, expect, it, vi } from 'vitest';
import { whenActive } from './client.js';

interface Registration {
  type: string;
  listener: () => void;
  options?: { once?: boolean };
}

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

function installDocument(value: unknown): Registration[] {
  const registrations: Registration[] = [];
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    writable: true,
    value: value === undefined ? undefined : {
      ...(value as object),
      addEventListener(type: string, listener: () => void, options?: { once?: boolean }) {
        registrations.push({ type, listener, options });
      },
    },
  });
  return registrations;
}

afterEach(() => {
  if (originalDocument) {
    Object.defineProperty(globalThis, 'document', originalDocument);
  } else {
    Reflect.deleteProperty(globalThis, 'document');
  }
});

describe('whenActive', () => {
  it('defers to prerenderingchange, once, while the document is prerendering', () => {
    const registrations = installDocument({ prerendering: true });
    const fn = vi.fn();

    whenActive(fn);
    expect(fn).not.toHaveBeenCalled();
    expect(registrations).toHaveLength(1);
    expect(registrations[0]?.type).toBe('prerenderingchange');
    expect(registrations[0]?.options).toEqual({ once: true });

    registrations[0]?.listener();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('runs immediately once the document is active', () => {
    const registrations = installDocument({ prerendering: false });
    const fn = vi.fn();

    whenActive(fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(registrations).toHaveLength(0);
  });

  it('runs immediately where document.prerendering is unsupported', () => {
    const registrations = installDocument({});
    const fn = vi.fn();

    whenActive(fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(registrations).toHaveLength(0);
  });

  it('runs immediately and does not throw without a DOM at all', () => {
    Reflect.deleteProperty(globalThis, 'document');
    const fn = vi.fn();

    expect(() => { whenActive(fn); }).not.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
