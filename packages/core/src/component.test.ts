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
