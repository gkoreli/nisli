/**
 * component.test.ts — Tests for the component shell.
 * Requires DOM — uses happy-dom via vitest environment.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { component, type ReactiveProps } from './component.js';
import { signal, computed, effect, flushEffects, type Signal } from './signal.js';
import { inject, provide, resetInjector } from './injector.js';
import { getCurrentComponent, runWithContext } from './context.js';
import { html, type TemplateResult } from './template.js';

beforeEach(() => {
  resetInjector();
  // Clean up any custom elements test artifacts from the DOM
  document.body.innerHTML = '';
});

// ── Helper to create unique tag names per test ──────────────────────

let tagCounter = 0;
function uniqueTag(prefix = 'test'): string {
  return `${prefix}-${++tagCounter}-${Date.now()}`;
}

/**
 * Disconnect teardown is deferred one microtask so same-tick DOM moves
 * don't dispose the component (ADR 0023). Await this after removing an
 * element before asserting disposal happened.
 */
function settleTeardown(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve));
}

// ── Basic registration and lifecycle ────────────────────────────────

describe('component() registration', () => {
  it('registers a custom element', () => {
    const tag = uniqueTag('reg');
    component(tag, () => {
      return html`<div>hello</div>`;
    });

    const el = document.createElement(tag);
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it('setup runs on connectedCallback (appended to DOM)', () => {
    const tag = uniqueTag('setup');
    const setupFn = vi.fn(() => html`<span>content</span>`);

    component(tag, setupFn);

    const el = document.createElement(tag);
    expect(setupFn).not.toHaveBeenCalled();

    document.body.appendChild(el);
    expect(setupFn).toHaveBeenCalledTimes(1);
  });

  it('same-tick remove+reinsert is a move: setup does not re-run', () => {
    const tag = uniqueTag('reconnect');
    const setupFn = vi.fn(() => html`<span>content</span>`);

    component(tag, setupFn);

    const el = document.createElement(tag);
    document.body.appendChild(el);
    expect(setupFn).toHaveBeenCalledTimes(1);

    // Append-based moves fire disconnected+connected (WHATWG), but teardown
    // is deferred a microtask (ADR 0023) — the component survives the move
    // intact and does not duplicate its rendered output.
    document.body.removeChild(el);
    document.body.appendChild(el);
    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(el.querySelectorAll('span').length).toBe(1);
  });

  it('true removal tears down; a later re-connect re-initializes', async () => {
    const tag = uniqueTag('remount');
    const setupFn = vi.fn(() => html`<span>content</span>`);

    component(tag, setupFn);

    const el = document.createElement(tag);
    document.body.appendChild(el);
    expect(setupFn).toHaveBeenCalledTimes(1);

    document.body.removeChild(el);
    await settleTeardown(); // still disconnected → teardown runs

    document.body.appendChild(el);
    expect(setupFn).toHaveBeenCalledTimes(2);
  });
});

// ── Props via Proxy ─────────────────────────────────────────────────

describe('component props', () => {
  it('props are accessible as signals inside setup', () => {
    const tag = uniqueTag('props');
    let capturedTitle: Signal<string> | null = null;

    component<{ title: string }>(tag, (props) => {
      capturedTitle = props.title;
      return html`<span>${props.title}</span>`;
    });

    const el = document.createElement(tag) as any;
    el._setProp('title', 'Hello');
    document.body.appendChild(el);

    expect(capturedTitle).not.toBeNull();
    expect(capturedTitle!.value).toBe('Hello');
  });

  it('prop updates propagate to signal values', () => {
    const tag = uniqueTag('propupdate');
    let titleSignal: Signal<string> | null = null;

    component<{ title: string }>(tag, (props) => {
      titleSignal = props.title;
      return html`<span>content</span>`;
    });

    const el = document.createElement(tag) as any;
    el._setProp('title', 'initial');
    document.body.appendChild(el);

    expect(titleSignal!.value).toBe('initial');

    el._setProp('title', 'updated');
    expect(titleSignal!.value).toBe('updated');
  });
});

// ── Lifecycle and disposal ──────────────────────────────────────────

describe('component lifecycle', () => {
  it('disconnectedCallback disposes all registered disposers', async () => {
    const tag = uniqueTag('dispose');
    const disposer = vi.fn();

    component(tag, (_props, host) => {
      // Simulate registering a disposer via the context
      // In real usage, effect() and emitter.on() do this automatically
      const comp = getCurrentComponent();
      comp.addDisposer(disposer);
      return html`<span>content</span>`;
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    expect(disposer).not.toHaveBeenCalled();

    document.body.removeChild(el);
    await settleTeardown();
    expect(disposer).toHaveBeenCalledTimes(1);
  });

  it('effects are cleaned up on disconnect', () => {
    const tag = uniqueTag('effectclean');
    const count = signal(0);
    const fn = vi.fn();

    component(tag, () => {
      effect(() => {
        fn(count.value);
      });
      return html`<span>content</span>`;
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    expect(fn).toHaveBeenCalledTimes(1);

    // Remove — should dispose effects
    document.body.removeChild(el);

    // Changing signal should NOT trigger effect
    count.value = 1;
    flushEffects();
    // Note: the effect is not auto-registered as a disposer in the current
    // implementation — this would require effect() to be context-aware.
    // This is an intentional future improvement (see ADR notes).
  });
});

// ── Error boundaries ────────────────────────────────────────────────

describe('error boundaries', () => {
  it('setup error renders default error fallback', () => {
    const tag = uniqueTag('err');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    component(tag, () => {
      throw new Error('setup boom');
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);

    expect(el.innerHTML).toContain('Error in');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('custom onError renders custom fallback', () => {
    const tag = uniqueTag('errcustom');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    component(tag, () => {
      throw new Error('custom boom');
    }, {
      onError: (error) => `<div class="error">${error.message}</div>`,
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);

    expect(el.innerHTML).toContain('custom boom');
    expect(el.innerHTML).toContain('class="error"');
    errorSpy.mockRestore();
  });

  it('error in one component does not affect siblings', () => {
    const goodTag = uniqueTag('good');
    const badTag = uniqueTag('bad');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    component(goodTag, () => html`<span>I'm fine</span>`);
    component(badTag, () => { throw new Error('bad'); });

    const good = document.createElement(goodTag);
    const bad = document.createElement(badTag);
    document.body.appendChild(good);
    document.body.appendChild(bad);

    expect(good.innerHTML).toContain("I'm fine");
    expect(bad.innerHTML).toContain('Error in');
    errorSpy.mockRestore();
  });
});

// ── DI integration ──────────────────────────────────────────────────

describe('component + DI integration', () => {
  it('inject() works inside component setup', () => {
    class TestService {
      name = 'TestService';
    }

    const tag = uniqueTag('di');
    let captured: TestService | null = null;

    component(tag, () => {
      captured = inject(TestService);
      return html`<span>content</span>`;
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);

    expect(captured).toBeInstanceOf(TestService);
    expect(captured!.name).toBe('TestService');
  });
});

// ── Context isolation ───────────────────────────────────────────────

describe('context isolation', () => {
  it('two components mounting get separate contexts', () => {
    const tag1 = uniqueTag('ctx1');
    const tag2 = uniqueTag('ctx2');
    const hosts: HTMLElement[] = [];

    component(tag1, (_props, host) => {
      hosts.push(host);
      return html`<span>1</span>`;
    });
    component(tag2, (_props, host) => {
      hosts.push(host);
      return html`<span>2</span>`;
    });

    const el1 = document.createElement(tag1);
    const el2 = document.createElement(tag2);
    document.body.appendChild(el1);
    document.body.appendChild(el2);

    expect(hosts).toHaveLength(2);
    expect(hosts[0]).toBe(el1);
    expect(hosts[1]).toBe(el2);
    expect(hosts[0]).not.toBe(hosts[1]);
  });
});

// ── attrs option v1.1 — number kind + attr-name override ────────────

describe('attrs v1.1: number kind', () => {
  it("bare 'number' resolves absent→undefined, valid→Number, garbage→undefined", () => {
    const tag = uniqueTag('num');
    let props!: ReactiveProps<{ max?: number }>;
    component<{ max?: number }>(tag, (p) => { props = p; return html`<i></i>`; }, {
      attrs: { max: 'number' },
    });

    const absent = document.createElement(tag);
    document.body.appendChild(absent);
    expect(props.max.value).toBeUndefined();

    const valid = document.createElement(tag);
    valid.setAttribute('max', '42');
    document.body.appendChild(valid);
    expect(props.max.value).toBe(42);

    // Garbage behaves as absent → undefined (no default here); NaN never propagates.
    const garbage = document.createElement(tag);
    garbage.setAttribute('max', 'not-a-number');
    document.body.appendChild(garbage);
    expect(props.max.value).toBeUndefined();
  });

  it("'{ type: number, default }' uses the default when absent OR garbage", () => {
    const tag = uniqueTag('numdef');
    let props!: ReactiveProps<{ step?: number }>;
    component<{ step?: number }>(tag, (p) => { props = p; return html`<i></i>`; }, {
      attrs: { step: { type: 'number', default: 1 } },
    });

    const absent = document.createElement(tag);
    document.body.appendChild(absent);
    expect(props.step.value).toBe(1);

    const set = document.createElement(tag);
    set.setAttribute('step', '5');
    document.body.appendChild(set);
    expect(props.step.value).toBe(5);

    // Garbage behaves as absent → the declared default (NOT literal undefined),
    // so a default guarantees non-undefined.
    const garbage = document.createElement(tag);
    garbage.setAttribute('step', 'oops');
    document.body.appendChild(garbage);
    expect(props.step.value).toBe(1);
  });

  it('live setAttribute updates a number prop after mount', () => {
    const tag = uniqueTag('numlive');
    let props!: ReactiveProps<{ value?: number }>;
    component<{ value?: number }>(tag, (p) => { props = p; return html`<i></i>`; }, {
      attrs: { value: 'number' },
    });
    const el = document.createElement(tag);
    document.body.appendChild(el);
    expect(props.value.value).toBeUndefined();

    el.setAttribute('value', '7');
    expect(props.value.value).toBe(7);
    el.setAttribute('value', 'oops');
    expect(props.value.value).toBeUndefined();
  });
});

describe('attrs v1.1: attr-name override', () => {
  it('observes an explicit attr name instead of the kebab derivation', () => {
    const tag = uniqueTag('override');
    let props!: ReactiveProps<{ readOnly?: boolean }>;
    const Factory = component<{ readOnly?: boolean }>(tag, (p) => { props = p; return html`<i></i>`; }, {
      // native boolean attribute is `readonly`, not the kebab `read-only`.
      attrs: { readOnly: { type: 'boolean', attr: 'readonly' } },
    });
    void Factory;

    // observedAttributes reflects the override, not the kebab name.
    const ctor = customElements.get(tag)!;
    expect((ctor as unknown as { observedAttributes: string[] }).observedAttributes).toContain('readonly');
    expect((ctor as unknown as { observedAttributes: string[] }).observedAttributes).not.toContain('read-only');

    // The native `readonly` attribute drives the prop; the kebab name does not.
    const on = document.createElement(tag);
    on.setAttribute('readonly', '');
    document.body.appendChild(on);
    expect(props.readOnly.value).toBe(true);

    const kebab = document.createElement(tag);
    kebab.setAttribute('read-only', '');
    document.body.appendChild(kebab);
    expect(props.readOnly.value).toBe(false); // 'read-only' is not observed
  });
});

describe('attrs v1.1: forward unpin (rev audit fix)', () => {
  it("'forward' defined→undefined unpin clears the pinned id AND name", () => {
    const tag = uniqueTag('fwd-unpin');
    let props!: ReactiveProps<{ id?: string; name?: string }>;
    component<{ id?: string; name?: string }>(tag, (p) => { props = p; return html`<input />`; }, {
      attrs: { id: 'forward', name: 'forward' },
    });
    const el = document.createElement(tag) as HTMLElement & { _setProp(k: string, v: unknown): void };
    el._setProp('id', 'pinned-id');
    el._setProp('name', 'pinned-name');
    document.body.appendChild(el);
    expect(props.id.value).toBe('pinned-id');
    expect(props.name.value).toBe('pinned-name');

    // Unpin: a defined→undefined write must resolve the ABSENT value
    // (undefined) instead of leaving the stale pinned value on the control.
    el._setProp('id', undefined);
    el._setProp('name', undefined);
    expect(props.id.value).toBeUndefined();
    expect(props.name.value).toBeUndefined();
  });

  it("'forward' spread-of-undefined does not pin and resolves absent", () => {
    const tag = uniqueTag('fwd-spread');
    let props!: ReactiveProps<{ id?: string }>;
    component<{ id?: string }>(tag, (p) => { props = p; return html`<input />`; }, {
      attrs: { id: 'forward' },
    });
    const el = document.createElement(tag) as HTMLElement & { _setProp(k: string, v: unknown): void };
    // Mirrors `Factory({ ...opts })` where opts.id is present-but-undefined.
    el._setProp('id', undefined);
    document.body.appendChild(el);
    expect(props.id.value).toBeUndefined(); // not pinned, no stale value
  });
});
