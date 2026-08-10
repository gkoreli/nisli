/**
 * lifecycle.test.ts — Tests for onMount() and onCleanup() lifecycle hooks.
 * Requires DOM — uses happy-dom via vitest environment.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { component } from './component.js';
import { signal, effect, flushEffects } from './signal.js';
import { onMount, onCleanup } from './lifecycle.js';
import { html } from './template.js';
import { resetInjector } from './injector.js';

beforeEach(() => {
  resetInjector();
  document.body.innerHTML = '';
});

let tagCounter = 0;
/**
 * Disconnect teardown is deferred one microtask so same-tick DOM moves
 * don't dispose the component (ADR 0023). Await this after removing an
 * element before asserting disposal happened.
 */
function settleTeardown(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve));
}

function uniqueTag(prefix = 'lc'): string {
  return `${prefix}-${++tagCounter}-${Date.now()}`;
}

describe('onMount()', () => {
  it('runs callback after template is mounted to DOM', () => {
    const tag = uniqueTag('mount');
    const order: string[] = [];

    component(tag, () => {
      order.push('setup');
      onMount(() => {
        order.push('mounted');
      });
      return html`<span>content</span>`;
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);

    // onMount runs after setup and template mount
    expect(order).toEqual(['setup', 'mounted']);
  });

  it('can access DOM elements created by the template', () => {
    const tag = uniqueTag('mount-dom');
    let foundSpan = false;

    component(tag, (_props, host) => {
      onMount(() => {
        foundSpan = host.querySelector('span.target') !== null;
      });
      return html`<span class="target">hello</span>`;
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);

    expect(foundSpan).toBe(true);
  });

  it('cleanup from onMount runs on disconnect', async () => {
    const tag = uniqueTag('mount-cleanup');
    const cleanup = vi.fn();

    component(tag, () => {
      onMount(() => {
        return cleanup;
      });
      return html`<span>content</span>`;
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    expect(cleanup).not.toHaveBeenCalled();

    document.body.removeChild(el);
    await settleTeardown();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('multiple onMount callbacks run in order', () => {
    const tag = uniqueTag('mount-multi');
    const order: string[] = [];

    component(tag, () => {
      onMount(() => { order.push('first'); });
      onMount(() => { order.push('second'); });
      onMount(() => { order.push('third'); });
      return html`<span>content</span>`;
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);

    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('throws when called outside setup context', () => {
    expect(() => onMount(() => {})).toThrow('outside setup');
  });

  // ── T6: an onMount throw routes through the SAME boundary as setup ──
  // (ADR 0030.2 — the pre-T6 behavior logged per-callback and limped on,
  // leaving a half-mounted component alive with no machine-readable trace.)

  it('onMount throw contains the component: later callbacks skipped, host stamped N402, fallback rendered', () => {
    const tag = uniqueTag('mount-err');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const secondCb = vi.fn();

    component(tag, () => {
      onMount(() => { throw new Error('mount boom'); });
      onMount(secondCb);
      return html`<span>content</span>`;
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);

    // Contained, not limped: the second callback never ran.
    expect(secondCb).not.toHaveBeenCalled();
    // The failure is a DOM fact (durable stamp) + the error fallback rendered.
    expect(el.getAttribute('data-nisli-error')).toBe('N402');
    expect(el.innerHTML).toContain('Error in');
    // Coded diagnostic on the console.
    expect(errorSpy.mock.calls.some((c) => String(c[0]).includes('[nisli N402]'))).toBe(true);
    errorSpy.mockRestore();
  });

  it('onMount throw tears the scope down with setup-failure parity (issue 0010): effects disposed, earlier cleanups run', () => {
    const tag = uniqueTag('mount-err-parity');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const source = signal(0);
    const effectRuns = vi.fn();
    const earlierCleanup = vi.fn();

    component(tag, () => {
      effect(() => effectRuns(source.value));
      onMount(() => earlierCleanup); // returns a cleanup — registered BEFORE the throw
      onMount(() => { throw new Error('mount boom'); });
      return html`<span>content</span>`;
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    expect(effectRuns).toHaveBeenCalledTimes(1);

    // The boundary disposed the partial scope: the setup effect is dead …
    source.value = 1;
    flushEffects();
    expect(effectRuns).toHaveBeenCalledTimes(1);
    // … and the earlier callback's registered cleanup ran.
    expect(earlierCleanup).toHaveBeenCalledTimes(1);
    expect(el.getAttribute('data-nisli-error')).toBe('N402');
    errorSpy.mockRestore();
  });
});

describe('onCleanup()', () => {
  it('runs callback on disconnect', async () => {
    const tag = uniqueTag('cleanup');
    const cleanup = vi.fn();

    component(tag, () => {
      onCleanup(cleanup);
      return html`<span>content</span>`;
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    expect(cleanup).not.toHaveBeenCalled();

    document.body.removeChild(el);
    await settleTeardown();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('throws when called outside setup context', () => {
    expect(() => onCleanup(() => {})).toThrow('outside setup');
  });
});
