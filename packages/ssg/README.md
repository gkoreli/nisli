# @nisli/ssg

Static site generation tooling for Nisli publications.

## Install

```bash
npm install @nisli/core @nisli/ssg
```

## Build Toolkit

`buildStaticSite()` is the publication build spine. It writes route output,
optionally copies public assets, and will own Nisli's component-to-static output
internally. Applications should not import a separate static template API.

```typescript
import { html } from '@nisli/core';
import { buildStaticSite } from '@nisli/ssg';

await buildStaticSite({
  outDir: 'dist',
  publicDir: 'public',
  context: { title: 'My site' },
  routes: [
    {
      path: '/',
      render: ({ title }) => html`<h1>${title}</h1>`,
    },
  ],
});
```

Route render functions may return either an existing HTML string or a normal
`@nisli/core` `html` template result. SSG serializes Nisli template results
internally at build time, so application templates should use the same `html`
authoring API as browser components.

## Application router builds

Pass an `AppRouter` from `@nisli/router` instead of a separate route array to
share path matching, parameter decoding, query codecs, page rendering, and
metadata with browser and Vite navigation.

```typescript
import { html } from '@nisli/core';
import { buildStaticSite } from '@nisli/ssg';
import { defineRouter, notFound, route } from '@nisli/router';

const AppRouter = defineRouter({
  home: route('/', { render: () => html`<h1>Home</h1>` }),
  post: route('/posts/:slug', {
    entries: () => [{ slug: 'hello' }, { slug: 'second' }],
    render: ({ params }) => html`<article>${params.slug}</article>`,
  }),
  notFound: notFound({ render: () => html`<h1>Not found</h1>` }),
});

await buildStaticSite({
  outDir: 'dist',
  router: AppRouter,
  shell: ({ content, metadata }) => html`
    <!doctype html>
    <title>${metadata?.title}</title>
    <main>${content}</main>
  `,
});
```

Dynamic routes must provide `entries()`. Each entry is expanded with its typed
`href()` and re-matched before rendering, so a build fails rather than silently
using different URL rules. A configured not-found route is emitted as root
`404.html`. The optional `shell` receives the shared
router metadata contract: `title`, named `meta`, property/OpenGraph metadata,
canonical and alternate links, `lang`/`dir`, and keyed JSON-LD. SSG keeps this
contract structural, so `@nisli/router` remains optional at runtime.

## Cross-document view transitions

A cross-document view transition only runs when **both** the outgoing and the
incoming document carry `@view-transition { navigation: auto }`. A page cannot
opt its own inbound navigations in, so this is a build option rather than an
authoring one — the build is the only layer that sees every page.

```typescript
await buildStaticSite({
  outDir: 'dist',
  router: AppRouter,
  viewTransitions: true,
});
```

`true` emits the plain crossfade opt-in into every page's head:

```html
<style>@view-transition { navigation: auto; }</style>
```

The object form adds speculation rules on top of it. `speculationRules: true`
uses the defaults; an object tunes them:

```typescript
viewTransitions: {
  speculationRules: {
    hrefMatches: '/*',                     // URL Pattern scope, string or array
    prefetch: 'moderate',                  // eagerness hint, or false to omit
    prerender: 'moderate',
    excludeSelector: '[data-no-prerender]', // prerender opt-out, or false
  },
}
```

which emits, after the style element:

```html
<script type="speculationrules">{"prefetch":[{"where":{"href_matches":"/*"},"eagerness":"moderate"}],"prerender":[{"where":{"and":[{"href_matches":"/*"},{"not":{"selector_matches":"[data-no-prerender]"}}]},"eagerness":"moderate"}]}</script>
```

The payload is minified with a fixed key order, so a rebuild produces identical
bytes — this output is committed. `excludeSelector` filters prerendering only:
opting a link out of a hidden pre-rendered document does not mean opting it out
of a plain response download. Marking a link is authoring-side:
`<a href="/checkout" data-no-prerender>`.

Omitting the option, or passing `false`, leaves output byte-identical to a build
without the feature. Everything emitted degrades cleanly: an engine without
`@view-transition` ignores the unknown at-rule and navigates normally, and an
engine without the Speculation Rules API treats the script element as inert.

The build injects before the first `</head>` in each rendered page, reusing that
tag's indentation. A page rendered as a bare fragment gets the block prepended
instead — the HTML parser routes a leading `<style>`/`<script>` into the implied
head. If a page renders a *document* with no `</head>` at all, the build fails
rather than emit content ahead of `<!doctype html>` and trigger quirks mode.

Sites that render body fragments through SSG and assemble the document in their
own shell should place the markup themselves instead, using the same emitter:

```typescript
import { renderViewTransitionHead } from '@nisli/ssg';

const head = renderViewTransitionHead({ speculationRules: true });
const page = `<!doctype html>\n<html><head>${head}</head><body>${fragment}</body></html>`;
```

Per-page `view-transition-name`s stay authoring-side CSS. `match-element` is
same-document-only — element identity cannot cross a document boundary — so
cross-document names must be spelled out explicitly on both pages:

```css
.article-hero { view-transition-name: hero; }
```

### Prerendering: `whenActive`

Speculation-rules prerendering runs a page **fully** in a hidden document:
subresources load, scripts execute, fetches fire. DOM wiring (event listeners,
custom-element upgrades, island mounts) may run there. Anything *observable* —
analytics, timers, autofocus, media playback, ad impressions — must wait for
activation:

```typescript
import { whenActive } from '@nisli/ssg/client';

document.querySelectorAll('[data-copy]').forEach(wireCopyButton); // fine eagerly
whenActive(() => { analytics.pageview(location.pathname); });     // deferred
```

`@nisli/ssg/client` is dependency-free and side-effect-free, so importing it
from a browser bundle pulls in none of the build-only code behind the package
root. It touches no DOM globals at module scope: without `document.prerendering`
(every non-Chromium engine) and without a document at all, `whenActive` runs its
callback immediately instead of throwing.

## Output Helpers

Use the output helpers when adopting `@nisli/ssg` incrementally inside an
existing publication pipeline.

```typescript
import {
  cleanOutDir,
  copyPublicAssets,
  writeRoot,
  writeRoute,
} from '@nisli/ssg';

cleanOutDir('dist');
copyPublicAssets({ publicDir: 'public', outDir: 'dist' });
writeRoute('dist', 'about', '<main>About</main>');
writeRoot('dist', 'feed.xml', '<rss />');
```

`writeRoute()` writes page routes to `index.html` files:

- `/` -> `dist/index.html`
- `/about` -> `dist/about/index.html`
- `posts/hello` -> `dist/posts/hello/index.html`
- `/404.html` -> `dist/404.html`

`writeRoot()` writes root-level artifacts such as feeds, sitemaps, JSON files,
and `llms.txt`. Route and root-file helpers reject path traversal.

Long term, this package is where Nisli's SSG tooling belongs. `@nisli/core`
stays focused on component authoring and the browser runtime.
