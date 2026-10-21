import { afterEach, expect, it } from 'vitest';
import { component, html, signal, flush } from '@nisli/core';
import { record, region } from './prototype.mjs';

const cleanups: (() => void)[] = [];
afterEach(() => { for (const stop of cleanups.splice(0)) stop(); });

it('REQUIRED: child factory state survives an unrelated parent-render update', () => {
  const label = signal('before'); let setups = 0;
  const Child = component('research-stateful-child', () => { setups++; return html`<input value="seed">`; });
  const result = region(() => record`<section>${Child({})}<p>${label.value}</p></section>`);
  const host = document.createElement('div'); document.body.append(host); result.mount(host);
  cleanups.push(() => { result.dispose(); host.remove(); });
  const input = host.querySelector('input')!; input.value = 'unfinished'; label.value = 'after'; flush();
  console.log(JSON.stringify({case:'nested factory',setups,retainsInput:host.querySelector('input')===input,value:host.querySelector('input')!.value}));
  expect(host.querySelector('input'), 'retaining the outer template must not recreate its child factory').toBe(input);
  expect(setups).toBe(1);
});

it('REQUIRED: the blanket same-template policy distinguishes different document identities without a supplied key', () => {
  const selected = signal('A');
  const result = region(() => record`<h2>${selected.value}</h2><input value="seed">`);
  const host = document.createElement('div'); document.body.append(host); result.mount(host);
  cleanups.push(() => { result.dispose(); host.remove(); });
  host.querySelector('input')!.value = 'draft belonging to A'; selected.value = 'B'; flush();
  console.log(JSON.stringify({case:'document identity',selected:host.querySelector('h2')!.textContent,draft:host.querySelector('input')!.value}));
  expect(host.querySelector('input')!.value, 'the new document must not inherit the previous document draft').toBe('seed');
});
