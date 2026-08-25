import { html } from '@nisli/core';
import { defineRouter, route, type NavInfo } from '@nisli/router';

const DOCS_ORDER = ['/docs', '/docs/signals', '/docs/templates'];

// The engine reports HISTORY direction. A docs site usually wants CONTENT
// direction: clicking the sidebar back up to an earlier page is a history push
// (`forward`) even though the reader moved backwards. So derive it, and fall
// back to the engine off the docs spine. `unknown` contributes no type — it
// would only make the stylesheet match on a word that means nothing.
function navTypes(nav: NavInfo): string[] {
  const from = DOCS_ORDER.indexOf(nav.from.pathname);
  const to = DOCS_ORDER.indexOf(nav.to.pathname);
  const direction = from >= 0 && to >= 0 && from !== to
    ? (to > from ? 'forward' : 'back')
    : nav.direction;
  return direction === 'unknown' ? [] : [direction];
}

export const AppRouter = defineRouter({
  docs: route('/docs', { render: async () => html`<h1>Docs</h1>` }),
}, {
  // Off by default. The router wraps only the COMMIT — rendered output, managed
  // head, and the scroll/focus effects — so an awaited route loader delays the
  // animation's start instead of freezing the page inside the capture window.
  viewTransitions: { enabled: true, types: navTypes },
});
