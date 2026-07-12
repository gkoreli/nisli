import { component, inject, html } from '@nisli/core';

class Clock {
  now() {
    return new Date().toLocaleTimeString();
  }
}

component('x-now', () => {
  const clock = inject(Clock); // singleton, auto-created
  return html`<time>${clock.now()}</time>`;
});
