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

Long term, this package is where Nisli's SSG tooling belongs. `@nisli/core`
stays focused on component authoring and the browser runtime.
