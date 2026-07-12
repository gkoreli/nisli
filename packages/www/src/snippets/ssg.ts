import { buildStaticSite } from '@nisli/ssg';
import { html } from '@nisli/core';

function homePage() {
  return html`<main>Hello from nisli</main>`;
}

await buildStaticSite({
  outDir: 'dist',
  routes: [{ path: '/', render: () => homePage() }],
});
