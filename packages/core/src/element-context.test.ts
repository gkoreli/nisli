/**
 * element-context.test.ts — subtree-scoped provide/inject.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createContext } from './element-context.js';
import { component } from './component.js';
import { html } from './template.js';
import { signal, flushEffects, type Signal } from './signal.js';
import { runWithContext, type ComponentHost } from './context.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

interface Counter {
  count: Signal<number>;
}
const CounterContext = createContext<Counter>('Counter');

/** Minimal fake component host so we can call inject() inside a setup context. */
function withSetup<T>(element: HTMLElement, fn: () => T): T {
  const hostImpl: ComponentHost = { element, addDisposer: () => {} };
  let out!: T;
  runWithContext(hostImpl, () => {
    out = fn();
  });
  return out;
}

describe('createContext — resolution', () => {
  it('provide() on an ancestor is resolved by inject() from a descendant', () => {
    const provider = document.createElement('div');
    const child = document.createElement('span');
    const grandchild = document.createElement('em');
    child.appendChild(grandchild);
    provider.appendChild(child);
    document.body.appendChild(provider);

    const value: Counter = { count: signal(1) };
    CounterContext.provide(provider, value);

    expect(CounterContext.inject(grandchild)).toBe(value);
    expect(CounterContext.inject(child)).toBe(value);
    // Inclusive of the start element (the provider resolves itself).
    expect(CounterContext.inject(provider)).toBe(value);
  });

  it('resolves the NEAREST provider when contexts nest', () => {
    const outer = document.createElement('div');
    const inner = document.createElement('div');
    const leaf = document.createElement('span');
    inner.appendChild(leaf);
    outer.appendChild(inner);
    document.body.appendChild(outer);

    const outerVal: Counter = { count: signal(1) };
    const innerVal: Counter = { count: signal(2) };
    CounterContext.provide(outer, outerVal);
    CounterContext.provide(inner, innerVal);

    expect(CounterContext.inject(leaf)).toBe(innerVal);
    expect(CounterContext.inject(outer)).toBe(outerVal);
  });

  it('crosses display:contents ancestors', () => {
    const provider = document.createElement('div');
    const transparent = document.createElement('div');
    transparent.style.display = 'contents';
    const leaf = document.createElement('span');
    transparent.appendChild(leaf);
    provider.appendChild(transparent);
    document.body.appendChild(provider);

    const value: Counter = { count: signal(7) };
    CounterContext.provide(provider, value);
    expect(CounterContext.inject(leaf)).toBe(value);
  });

  it('two contexts with the same name stay distinct', () => {
    const a = createContext<Counter>('Dup');
    const b = createContext<Counter>('Dup');
    const provider = document.createElement('div');
    const leaf = document.createElement('span');
    provider.appendChild(leaf);
    document.body.appendChild(provider);

    const av: Counter = { count: signal(1) };
    a.provide(provider, av);
    expect(a.inject(leaf)).toBe(av);
    expect(b.inject.optional(leaf)).toBeUndefined();
  });
});

describe('createContext — peek (this-host-only, no walk)', () => {
  it('reads the value on the exact host, and does NOT walk to ancestors', () => {
    const provider = document.createElement('div');
    const child = document.createElement('span');
    provider.appendChild(child);
    document.body.appendChild(provider);

    const value: Counter = { count: signal(1) };
    CounterContext.provide(provider, value);

    expect(CounterContext.peek(provider)).toBe(value); // this host: yes
    expect(CounterContext.peek(child)).toBeUndefined(); // child is not a provider — no walk
  });

  it('supports a bespoke nearest-of-A-or-B walk (the menu resolveParentOpen pattern)', () => {
    const A = createContext<{ tag: string }>('A');
    const B = createContext<{ tag: string }>('B');
    const outer = document.createElement('div'); // provides A
    const mid = document.createElement('div'); // provides B (nearer to leaf)
    const leaf = document.createElement('span');
    mid.appendChild(leaf);
    outer.appendChild(mid);
    document.body.appendChild(outer);
    A.provide(outer, { tag: 'A' });
    B.provide(mid, { tag: 'B' });

    // Nearest provider of A-or-B from leaf, walking up, checking both per level.
    const nearest = (start: HTMLElement): string | undefined => {
      let el: HTMLElement | null = start.parentElement;
      while (el) {
        const a = A.peek(el);
        if (a) return a.tag;
        const b = B.peek(el);
        if (b) return b.tag;
        el = el.parentElement;
      }
      return undefined;
    };
    expect(nearest(leaf)).toBe('B'); // mid (B) is nearer than outer (A)
  });
});

describe('createContext — absence', () => {
  it('inject() throws a named error when no provider exists', () => {
    const orphan = document.createElement('ui-orphan');
    document.body.appendChild(orphan);
    expect(() => CounterContext.inject(orphan)).toThrow(/Context "Counter" not found/);
  });

  it('inject.optional() returns undefined when no provider exists', () => {
    const orphan = document.createElement('span');
    document.body.appendChild(orphan);
    expect(CounterContext.inject.optional(orphan)).toBeUndefined();
  });

  it('providerTag makes the not-found error actionable element-language', () => {
    const Ctx = createContext<Counter>('Widget', { providerTag: 'ui-widget' });
    const orphan = document.createElement('ui-widget-item');
    document.body.appendChild(orphan);
    // The actionable sentence names the injecting tag AND the provider tag.
    expect(() => Ctx.inject(orphan)).toThrow(
      '<ui-widget-item> must be used inside <ui-widget>.',
    );
  });

  it('without providerTag, the default (API-named) message stands', () => {
    const orphan = document.createElement('ui-thing');
    document.body.appendChild(orphan);
    expect(() => CounterContext.inject(orphan)).toThrow(/provide\(host/);
  });

  it('zero cost for non-users: providing adds exactly one key, non-users get none', () => {
    const provider = document.createElement('div');
    const nonUser = document.createElement('div');
    const baseline = Object.getOwnPropertySymbols(nonUser).length;

    CounterContext.provide(provider, { count: signal(0) });

    // The provider gained exactly one own symbol; the non-user gained nothing.
    expect(Object.getOwnPropertySymbols(provider)).toHaveLength(baseline + 1);
    expect(Object.getOwnPropertySymbols(nonUser)).toHaveLength(baseline);
  });
});

describe('createContext — setup-context default host', () => {
  it('inject() with no host uses the current component host', () => {
    const provider = document.createElement('div');
    const child = document.createElement('ui-child');
    provider.appendChild(child);
    document.body.appendChild(provider);

    const value: Counter = { count: signal(5) };
    CounterContext.provide(provider, value);

    // Inside a setup context whose host is `child`, inject() needs no argument.
    expect(withSetup(child, () => CounterContext.inject())).toBe(value);
  });

  it('inject() with no host throws when called outside setup', () => {
    expect(() => CounterContext.inject()).toThrow(/outside component setup/);
  });

  it('inject.optional() with no host returns undefined outside setup', () => {
    expect(CounterContext.inject.optional()).toBeUndefined();
  });
});

// A provider component that publishes a reactive counter, and a child that
// injects it — exercising the real component path end to end.
interface Rc {
  count: Signal<number>;
}
const RcContext = createContext<Rc>('Rc');

const RcProvider = component<{ start?: number; children?: unknown }>('rc-provider', (props, host) => {
  const count = signal<number>(props.start.value ?? 0);
  RcContext.provide(host, { count });
  (host as unknown as { bump(): void }).bump = () => (count.value += 1);
  return html`<div data-slot="rc-provider">${props.children as never}</div>`;
});

const RcReader = component('rc-reader', () => {
  const rc = RcContext.inject();
  return html`<span data-slot="rc-reader">${rc.count}</span>`;
});

describe('createContext — through the component model', () => {
  it('a child injects the provider value and stays reactive', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    html`${RcProvider({ start: 3, children: RcReader({}) })}`.mount(container);
    flushEffects();

    const reader = container.querySelector('[data-slot="rc-reader"]')!;
    expect(reader.textContent).toBe('3');

    // Signal in the injected value drives the child with no re-walk.
    (container.querySelector('rc-provider') as unknown as { bump(): void }).bump();
    flushEffects();
    flushEffects();
    expect(reader.textContent).toBe('4');
  });

  it('a reader with no provider renders the error boundary', () => {
    const host = document.createElement('rc-reader');
    document.body.appendChild(host);
    expect(host.querySelector('[data-slot="rc-reader"]')).toBeNull();
    expect(host.textContent).toContain('Error');
  });

  it('the injected value survives the host being reparented (portal-safe capture)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    html`${RcProvider({ start: 1, children: RcReader({}) })}`.mount(container);
    flushEffects();

    const readerHost = container.querySelector('rc-reader') as HTMLElement;
    const reader = readerHost.querySelector('[data-slot="rc-reader"]')!;
    // Move the reader out of the provider subtree — as a portal would.
    document.body.appendChild(readerHost);
    expect(readerHost.closest('rc-provider')).toBeNull(); // no longer under provider

    // Still reactive: it captured the value at setup, before the move.
    (container.querySelector('rc-provider') as unknown as { bump(): void }).bump();
    flushEffects();
    flushEffects();
    expect(reader.textContent).toBe('2');
  });
});
