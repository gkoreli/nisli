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
