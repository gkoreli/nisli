import { component, signal, html } from '@nisli/core';

component('save-button', () => {
  const busy = signal(false);
  const label = signal('Save');

  return html`
    <button
      class="btn"
      disabled=${busy}
      @click=${() => (label.value = 'Saved')}
    >${label}</button>
  `;
});
