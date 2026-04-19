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
import { buildStaticSite } from '@nisli/ssg';

await buildStaticSite({
  outDir: 'dist',
  publicDir: 'public',
  context: { title: 'My site' },
  routes: [
    {
      path: '/',
      render: ({ title }) => `<h1>${title}</h1>`,
    },
  ],
});
```

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
