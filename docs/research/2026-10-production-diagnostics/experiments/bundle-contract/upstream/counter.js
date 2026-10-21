import { component, html, signal } from '@nisli/core';

export function start() {
  const Counter = component('repro-counter', () => {
    const count = signal(0);
    const increment = () => { count.value += 1; };
    // @clik is an intentional negative probe. @click proves normal behavior.
    return html`<button id="counter" @click=${increment} @clik=${increment}>Count: ${count}</button>`;
  });
  html`${Counter({})}`.mount(document.querySelector('#app'));
}
