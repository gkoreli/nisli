import { component, html, signal, onCleanup, inject, provide, createToken } from '@nisli/core';
import { __register, __drain } from '@nisli/core/vite-hmr/runtime';

const token = createToken('hmr-service');
provide(token, () => 'shared');
let cleanups = 0;
const setup = label => () => {
  const count = signal(0);
  const service = inject(token);
  onCleanup(() => { cleanups++; });
  return html`<button id="hmr" @click=${() => count.value++}>${label}:${service}:${count}</button>`;
};
const First = component('hmr-fixture', __register('hmr-fixture', setup('before')));
html`${First({})}`.mount(document.querySelector('#app'));
const element = document.querySelector('hmr-fixture');
globalThis.replaceSetup = () => {
  component('hmr-fixture', __register('hmr-fixture', setup('after')));
  __drain();
  return { sameElement: element === document.querySelector('hmr-fixture'), cleanups };
};
