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
});
