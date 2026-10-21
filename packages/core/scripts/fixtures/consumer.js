import { component, html, signal, setDevMode } from '@nisli/core';

if (globalThis.overrideMode !== undefined) setDevMode(globalThis.overrideMode);
const Counter = component('repro-counter', () => {
  const count = signal(0);
  const increment = () => { count.value += 1; };
  return html`<button id="counter" @click=${increment} @clik=${increment}>Count: ${count}</button>`;
});
html`${Counter({})}`.mount(document.querySelector('#app'));
