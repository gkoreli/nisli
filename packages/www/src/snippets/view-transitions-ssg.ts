import { buildStaticSite, renderViewTransitionHead } from '@nisli/ssg';
import { html } from '@nisli/core';

// A cross-document transition runs only when BOTH documents opt in, so a page
// cannot opt its own inbound navigations in. The build is the only layer that
// sees every page — which is why this is a build option, not authoring.
await buildStaticSite({
  outDir: 'dist',
  routes: [{ path: '/', render: () => html`<main>Home</main>` }],
  viewTransitions: { speculationRules: true },
});

// If your build renders body FRAGMENTS and your own shell assembles the
// document, place the same markup yourself — the build injects before the first
// `</head>` of what it is given, and a fragment has none.
const head = renderViewTransitionHead({ speculationRules: true });
export const page = `<!doctype html>
<html lang="en">
<head>${head}</head>
<body>fragment</body>
</html>`;
