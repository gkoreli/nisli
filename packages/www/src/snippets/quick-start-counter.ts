import { signal, component, html } from '@nisli/core';

component('x-counter', () => {
  const count = signal(0);

  return html`
    <button @click=${() => count.value++}>
      Count: ${count}
    </button>
  `;
});
