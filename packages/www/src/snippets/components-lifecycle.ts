import { component, onMount, onCleanup, signal, html } from '@nisli/core';

component('x-clock', () => {
  const now = signal(new Date().toLocaleTimeString());

  onMount(() => {
    const id = setInterval(() => {
      now.value = new Date().toLocaleTimeString();
    }, 1000);
    onCleanup(() => clearInterval(id));
  });

  return html`<time>${now}</time>`;
});
