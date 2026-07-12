import { signal, html, when } from '@nisli/core';

const open = signal(true);

export const panel = html`${when(open, () => html`<p>Now you see me.</p>`)}`;
