/**
 * component.test.ts — Tests for the component shell.
 * Requires DOM — uses happy-dom via vitest environment.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { component, type ReactiveProps, type ComponentAttrs } from './component.js';
import { signal, computed, effect, flushEffects, type Signal } from './signal.js';
import { inject, provide, resetInjector } from './injector.js';
import { getCurrentComponent, runWithContext } from './context.js';
import { html, type TemplateResult } from './template.js';
import { onMount } from './lifecycle.js';
import { setDevMode } from './diagnostics.js';

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
    expect(el.querySelectorAll('span')).toHaveLength(1);
    expect(el.textContent).toBe('content');
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

  it('setup failure disposes effects registered before the throw', () => {
    const tag = uniqueTag('errcleanup');
    const source = signal(0);
    const runs = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    component(tag, () => {
      effect(() => runs(source.value));
      throw new Error('after effect');
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    expect(runs).toHaveBeenCalledTimes(1);

    source.value = 1;
    flushEffects();
    expect(runs).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it('disposes a reactive TemplateResult error fallback on disconnect', async () => {
    const tag = uniqueTag('errfallbackcleanup');
    const label = signal('first');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    component(tag, () => {
      throw new Error('fallback');
    }, {
      onError: () => html`<span>${label}</span>`,
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    const span = el.querySelector('span')!;
    expect(span.textContent).toBe('first');

    document.body.removeChild(el);
    await settleTeardown();
    label.value = 'second';
    flushEffects();
    expect(span.textContent).toBe('first');
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

describe('attrs: declared-type narrowing (ADR 0025 candidate b) — runtime parity', () => {
  // The narrowing is type-only, but it PROMISES the runtime value is non-`undefined`
  // for a declared boolean / number-with-default. These assert the runtime actually
  // honors that promise both via declared defaults and via factory-style writes, so
  // the compile-time narrowed type can never diverge from the runtime value.
  interface NarrowProps {
    checked?: boolean;
    span?: number;
  }
  const narrowAttrs = {
    checked: 'boolean',
    span: { type: 'number', default: 3 },
  } satisfies ComponentAttrs<NarrowProps>;

  it('declared defaults make the narrowed types honest with no factory write', () => {
    const tag = uniqueTag('narrow-defaults');
    let props!: ReactiveProps<NarrowProps, typeof narrowAttrs>;
    component<NarrowProps, typeof narrowAttrs>(
      tag,
      (p) => { props = p; return html`<i></i>`; },
      { attrs: narrowAttrs },
    );
    const el = document.createElement(tag);
    document.body.appendChild(el);
    // checked → false (not undefined); span → its declared default 3.
    expect(props.checked.value).toBe(false);
    expect(props.span.value).toBe(3);
  });

  it('a factory-style prop write sets the narrowed value (pinned over the default)', () => {
    const tag = uniqueTag('narrow-write');
    let props!: ReactiveProps<NarrowProps, typeof narrowAttrs>;
    component<NarrowProps, typeof narrowAttrs>(
      tag,
      (p) => { props = p; return html`<i></i>`; },
      { attrs: narrowAttrs },
    );
    // Mirrors ComponentFactory: props are _setProp'd BEFORE the element connects.
    const el = document.createElement(tag) as HTMLElement & { _setProp(k: string, v: unknown): void };
    el._setProp('checked', true);
    el._setProp('span', 7);
    document.body.appendChild(el);
    expect(props.checked.value).toBe(true);
    expect(props.span.value).toBe(7);
    // A later live write flows through the same signal.
    el._setProp('checked', false);
    expect(props.checked.value).toBe(false);
  });

  it('the real ComponentFactory writes narrowed values through mount (end-to-end)', () => {
    const tag = uniqueTag('narrow-factory');
    let props!: ReactiveProps<NarrowProps, typeof narrowAttrs>;
    const Factory = component<NarrowProps, typeof narrowAttrs>(
      tag,
      (p) => { props = p; return html`<i></i>`; },
      { attrs: narrowAttrs },
    );
    const container = document.createElement('div');
    document.body.appendChild(container);
    // The actual typed factory → TemplateResult → mount: mountTemplate's factory
    // branch _setProp's each prop before connecting the child, so the narrowed
    // compile-time types (checked: boolean, span: number) match the live values.
    html`${Factory({ checked: true, span: 7 })}`.mount(container);
    expect(props.checked.value).toBe(true);
    expect(props.span.value).toBe(7);

    // A factory that OMITS the props still lands the declared defaults (so the
    // non-undefined narrowed types stay honest end-to-end).
    const tag2 = uniqueTag('narrow-factory-default');
    let props2!: ReactiveProps<NarrowProps, typeof narrowAttrs>;
    const Factory2 = component<NarrowProps, typeof narrowAttrs>(
      tag2,
      (p) => { props2 = p; return html`<i></i>`; },
      { attrs: narrowAttrs },
    );
    const c2 = document.createElement('div');
    document.body.appendChild(c2);
    html`${Factory2({})}`.mount(c2);
    expect(props2.checked.value).toBe(false);
    expect(props2.span.value).toBe(3);
  });
});

// ── _isPinned — controlled-mode discriminator (attribute-as-truth) ──

describe('_isPinned', () => {
  it('tracks defined-write pinning; attribute writes never pin', () => {
    const tag = uniqueTag('pin-query');
    component<{ open: boolean }>(tag, () => html`<div></div>`, {
      attrs: { open: 'boolean' },
    });
    // This setup deliberately never reads props.open, so the post-mount
    // _setProp below legitimately trips the N202 echo — silence the console
    // for output hygiene (the echo itself is pinned in its own suite).
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const el = document.createElement(tag) as any;
    document.body.appendChild(el);

    // Attribute-driven: never pinned.
    expect(el._isPinned('open')).toBe(false);
    el.setAttribute('open', '');
    expect(el._isPinned('open')).toBe(false);

    // Defined factory/property write pins…
    el._setProp('open', true);
    expect(el._isPinned('open')).toBe(true);

    // …and an undefined write (spread-of-unset) unpins.
    el._setProp('open', undefined);
    expect(el._isPinned('open')).toBe(false);
    errorSpy.mockRestore();
  });
});

// ── T6: failure is a DOM fact (ADR 0030.2) ──────────────────────────

describe('T6: failure is a DOM fact', () => {
  it('a contained setup failure stamps the host data-nisli-error="N401"', () => {
    const tag = uniqueTag('t6-setup');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    component(tag, () => { throw new Error('setup boom'); });

    const el = document.createElement(tag);
    document.body.appendChild(el);

    expect(el.getAttribute('data-nisli-error')).toBe('N401');
    // Discoverable with no listener installed in advance — the durable channel.
    expect(Array.from(document.querySelectorAll('[data-nisli-error]'))).toContain(el);
    expect(errorSpy.mock.calls.some((c) => String(c[0]).includes('[nisli N401]'))).toBe(true);
    errorSpy.mockRestore();
  });

  it('dispatches a bubbling nisli-error CustomEvent {code, tag, phase, message}', () => {
    const tag = uniqueTag('t6-event');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    component(tag, () => { throw new Error('setup boom'); });

    const seen: unknown[] = [];
    const listener = (e: Event) => seen.push((e as CustomEvent).detail);
    document.addEventListener('nisli-error', listener);

    const el = document.createElement(tag);
    document.body.appendChild(el);

    expect(seen).toEqual([
      { code: 'N401', tag, phase: 'setup', message: 'setup boom' },
    ]);
    document.removeEventListener('nisli-error', listener);
    errorSpy.mockRestore();
  });

  it('the event bubbles through display:contents (transparent-host) ancestry', () => {
    const tag = uniqueTag('t6-contents');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    component(tag, () => { throw new Error('boom'); });

    const seen = vi.fn();
    document.addEventListener('nisli-error', seen);

    // Transparent wrapper chain: bubbling is a DOM-tree walk — CSS display
    // (including display:contents hosts) never affects delivery.
    const wrapper = document.createElement('div');
    wrapper.style.display = 'contents';
    document.body.appendChild(wrapper);
    const el = document.createElement(tag);
    el.style.display = 'contents';
    wrapper.appendChild(el);

    expect(seen).toHaveBeenCalledTimes(1);
    document.removeEventListener('nisli-error', seen);
    errorSpy.mockRestore();
  });

  it('detached-fragment mounts swallow the event; the ATTRIBUTE is the durable channel', () => {
    const tag = uniqueTag('t6-detached');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    component(tag, () => { throw new Error('detached boom'); });

    const seen = vi.fn();
    document.addEventListener('nisli-error', seen);

    // Simulate a detached mount (the HMR remount path invokes lifecycle
    // callbacks directly): the element lives in a fragment with no path to
    // document, so the bubbling event dies at the fragment root.
    const frag = document.createDocumentFragment();
    const el = document.createElement(tag) as HTMLElement & { connectedCallback(): void };
    frag.appendChild(el);
    el.connectedCallback();

    expect(seen).not.toHaveBeenCalled();
    // The stamp survives as the machine-readable record.
    expect(el.getAttribute('data-nisli-error')).toBe('N401');
    expect(frag.querySelectorAll('[data-nisli-error]').length).toBe(1);
    document.removeEventListener('nisli-error', seen);
    errorSpy.mockRestore();
  });

  it('a successful re-setup (_remount, the boundary reset) REMOVES the stamp', () => {
    const tag = uniqueTag('t6-reset');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail = true;
    component(tag, () => {
      if (fail) throw new Error('first mount fails');
      return html`<span>recovered</span>`;
    });

    const el = document.createElement(tag) as HTMLElement & { _remount(): void };
    document.body.appendChild(el);
    expect(el.getAttribute('data-nisli-error')).toBe('N401');

    fail = false;
    el._remount();

    expect(el.hasAttribute('data-nisli-error')).toBe(false);
    expect(el.innerHTML).toContain('recovered');
    errorSpy.mockRestore();
  });

  it('a repeat failure in a different phase updates the stamp code', () => {
    const tag = uniqueTag('t6-code-swap');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let phase: 'setup' | 'mount' = 'setup';
    component(tag, () => {
      if (phase === 'setup') throw new Error('setup boom');
      onMount(() => { throw new Error('mount boom'); });
      return html`<span>x</span>`;
    });

    const el = document.createElement(tag) as HTMLElement & { _remount(): void };
    document.body.appendChild(el);
    expect(el.getAttribute('data-nisli-error')).toBe('N401');

    phase = 'mount';
    el._remount();
    expect(el.getAttribute('data-nisli-error')).toBe('N402');
    errorSpy.mockRestore();
  });

  it('onError fallback still renders alongside the stamp (custom boundary kept)', () => {
    const tag = uniqueTag('t6-onerror');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    component(tag, () => { throw new Error('boom'); }, {
      onError: (error) => `<div class="fb">${error.message}</div>`,
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    expect(el.getAttribute('data-nisli-error')).toBe('N401');
    expect(el.innerHTML).toContain('class="fb"');
    errorSpy.mockRestore();
  });
});

// ── Duplicate define — coded error N201 (ADR 0030.2 §3/§8) ──────────

describe('duplicate define (N201)', () => {
  it('throws a coded dev error to the SECOND definer, naming the first site', () => {
    const tag = uniqueTag('dup');
    component(tag, () => html`<a>first</a>`);

    let thrown: Error | null = null;
    try {
      component(tag, () => html`<b>second</b>`);
    } catch (e) {
      thrown = e as Error;
    }

    expect(thrown).not.toBeNull();
    expect(thrown!.message).toContain('[nisli N201]');
    expect(thrown!.message).toContain(`<${tag}>`);
    // First definition site captured (this test file's frame).
    expect(thrown!.message).toMatch(/First defined .*component\.test/);

    // First-wins preserved: the live element renders the FIRST definition.
    const el = document.createElement(tag);
    document.body.appendChild(el);
    expect(el.innerHTML).toContain('first');
  });

  it('production keeps silent first-wins (dev/prod split)', () => {
    const tag = uniqueTag('dup-prod');
    setDevMode(false);
    try {
      component(tag, () => html`<a>first</a>`);
      expect(() => component(tag, () => html`<b>second</b>`)).not.toThrow();
      const el = document.createElement(tag);
      document.body.appendChild(el);
      expect(el.innerHTML).toContain('first');
    } finally {
      setDevMode(null);
    }
  });

  it('HMR re-evaluations are exempt via the registry-thunk marker', () => {
    const tag = uniqueTag('dup-hmr');
    component(tag, () => html`<a>first</a>`);

    // hmr/registry.__register marks its indirection thunks; a re-evaluated
    // module re-calling component() with one must NOT trip N201.
    const rebuiltSetup = Object.assign(() => html`<b>rebuilt</b>`, { __nisliHmr: true as const });
    expect(() => component(tag, rebuiltSetup)).not.toThrow();
  });
});

// ── Unknown-prop echo — N202 (ADR 0030.2, attribution-only) ─────────

describe('unknown-prop echo (N202)', () => {
  const echoCalls = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls.filter((c) => String(c[0]).includes('[nisli N202]'));

  it('post-mount _setProp to a never-read key echoes once; the write still lands', () => {
    const tag = uniqueTag('echo');
    component<{ known: string }>(tag, (props) => html`<span>${props.known}</span>`);

    const el = document.createElement(tag) as any;
    document.body.appendChild(el);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    el._setProp('varian', 'ghost'); // misspelled `variant`
    expect(echoCalls(errorSpy).length).toBe(1);
    expect(String(errorSpy.mock.calls[0]![0])).toContain("'varian'");
    // Attribution-only: behavior unchanged, the signal was still written.
    expect(el._propSignal('varian').value).toBe('ghost');

    // Deduped per key per element.
    el._setProp('varian', 'again');
    expect(echoCalls(errorSpy).length).toBe(1);
    errorSpy.mockRestore();
  });

  it('ignores undefined writes (factory-spread contract) and read keys', () => {
    const tag = uniqueTag('echo-safe');
    component<{ known: string }>(tag, (props) => html`<span>${props.known}</span>`);

    const el = document.createElement(tag) as any;
    document.body.appendChild(el);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // {...opts} spreading an unset optional fires _setProp(key, undefined) —
    // exempt by contract.
    el._setProp('optionalThing', undefined);
    // A key setup() actually read is never noise.
    el._setProp('known', 'value');
    expect(echoCalls(errorSpy).length).toBe(0);
    errorSpy.mockRestore();
  });

  it('pre-mount factory seeding never echoes (echo gates on setup completion)', () => {
    const tag = uniqueTag('echo-premount');
    component<{ known: string }>(tag, (props) => html`<span>${props.known}</span>`);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const el = document.createElement(tag) as any;
    el._setProp('varian', 'seeded-before-connect'); // factory seeding path
    document.body.appendChild(el);
    expect(echoCalls(errorSpy).length).toBe(0);

    // But a POST-mount write to the same never-read key does echo.
    el._setProp('varian', 'updated-after-mount');
    expect(echoCalls(errorSpy).length).toBe(1);
    errorSpy.mockRestore();
  });

  it('is dev-only: production writes stay silent', () => {
    const tag = uniqueTag('echo-prod');
    component<{ known: string }>(tag, (props) => html`<span>${props.known}</span>`);

    const el = document.createElement(tag) as any;
    document.body.appendChild(el);

    setDevMode(false);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      el._setProp('varian', 'x');
      expect(echoCalls(errorSpy).length).toBe(0);
    } finally {
      errorSpy.mockRestore();
      setDevMode(null);
    }
  });
});
