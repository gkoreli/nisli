/**
 * hmr/registry.test.ts — in-place HMR remount lifecycle.
 *
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { component } from '../component.js';
import { effect, signal } from '../signal.js';
import { html } from '../template.js';
import {
  __register,
  __resetRegistry,
  drainRemounts,
  type HmrSetup,
} from './registry.js';

let uid = 0;

beforeEach(() => {
  document.body.innerHTML = '';
  __resetRegistry();
});

describe('HMR registry remount', () => {
  it('synchronously replaces live DOM on the same host and disposes the old scope', () => {
    const tag = `hmr-probe-${uid++}`;
    const source = signal(0);
    const oldCleanup = vi.fn();

    const oldSetup: HmrSetup = () => {
      effect(() => {
        source.value;
        return oldCleanup;
      });
      return html`<span>old</span>`;
    };
    component(tag, __register(tag, oldSetup) as never);

    const element = document.createElement(tag);
    document.body.appendChild(element);
    expect(element.textContent).toBe('old');

    __register(tag, (() => html`<span>new</span>`) as HmrSetup);
    expect(drainRemounts()).toEqual([tag]);

    expect(element.textContent).toBe('new');
    expect(element.querySelectorAll('span')).toHaveLength(1);
    expect(oldCleanup).toHaveBeenCalledTimes(1);
  });

  it('marks its indirection thunks for the N201 duplicate-define exemption', () => {
    const tag = `hmr-mark-${uid++}`;
    const thunk = __register(tag, (() => html`<span>x</span>`) as HmrSetup);
    expect((thunk as { __nisliHmr?: boolean }).__nisliHmr).toBe(true);
  });

  it('a module re-evaluation calling component() again does NOT trip N201 (thunk exemption)', () => {
    const tag = `hmr-reeval-${uid++}`;
    // Initial module evaluation (as the HMR transform emits it):
    component(tag, __register(tag, (() => html`<span>v1</span>`) as HmrSetup) as never);
    const element = document.createElement(tag);
    document.body.appendChild(element);
    expect(element.textContent).toBe('v1');

    // Rebuild re-evaluates the whole module — component() runs AGAIN for an
    // already-defined tag, but with the registry's marked thunk: exempt from
    // the duplicate-define error, and the swap still lands via the registry.
    expect(() => {
      component(tag, __register(tag, (() => html`<span>v2</span>`) as HmrSetup) as never);
    }).not.toThrow();
    drainRemounts();
    expect(element.textContent).toBe('v2');
  });
});
