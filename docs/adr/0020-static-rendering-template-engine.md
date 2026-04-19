# 0020. Static Rendering Template Engine

**Date**: 2026-04-11
**Status**: Accepted, superseded by [0020.1-static-site-generation-build-toolkit](./0020.1-static-publication-components-and-attributes.md)
**Depends on**: [0017-framework-package-extraction](./0017-framework-package-extraction.md)

**Update 2026-04-19**: Phase 1 shipped as `@nisli/core/static`, but the project
has only one known consumer and no compatibility burden. ADR 0020.1 moves static
and SSG internals into a dedicated `@nisli/ssg` package and removes
`@nisli/core/static` so `@nisli/core` remains the browser/client UI framework.
The low-level static primitives are no longer the customer-facing SSG API;
`buildStaticSite()` is.

## Context

`@nisli/core` currently owns the browser runtime for reactive templates:

- `html` tagged template literals
- signal-aware text and attribute bindings
- `when()` and `each()` dynamic regions
- component mounting through Web Components
- DOM refs, event handlers, lifecycle hooks, and cleanup

That browser runtime is intentionally DOM-first. It parses templates through
`document.createElement('template')`, mounts `DocumentFragment`s, and wires
live bindings into real nodes.

For static sites, documentation, feeds, emails, and build-time HTML generation,
the same template syntax is useful without any browser runtime. A separate blog
project already needed this and introduced an ad-hoc renderer at:

`/Users/goga/Documents/goga/blog/packages/blog/src/nisli-static/static.ts`

That implementation proves the smallest useful shape:

- the same tagged-template authoring shape under an explicit `staticHtml` name
- escaped interpolated values by default
- nested template results
- array flattening
- `raw()` for intentionally pre-rendered HTML
- no DOM dependency
- no reactivity or component runtime yet

The question is whether this belongs in `@nisli/core`, and if so, how it should
be exposed without making browser consumers pay for server/static code.

## Decision

Add **Phase 1 static rendering** to the same npm package, `@nisli/core`, but
expose it as a separate subpath export:

```ts
import { staticHtml, raw, renderToString } from '@nisli/core/static';
```

The root export remains browser/runtime focused:

```ts
import { component, html, signal } from '@nisli/core';
```

The static export owns a DOM-free HTML string renderer. It should not be added
to the root barrel unless a later compatibility decision explicitly chooses to
do so.

This ADR accepts **Phase 1 only**. The first implementation is not SSR, not a
complete SSG framework, and not Web Component server rendering. It is the
primitive that can support the next immediate product direction: **SSG plus
custom-element islands for web publications**.

Initial package shape:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./static": "./src/static/index.ts"
  },
  "publishConfig": {
    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "./static": {
        "types": "./dist/static/index.d.ts",
        "default": "./dist/static/index.js"
      }
    }
  }
}
```

Use `@nisli/core/static` rather than `@nisli/core/server` for the first version.
The word `server` implies fuller SSR semantics: component tree rendering,
lifecycle semantics, async data coordination, streaming, hydration boundaries,
and browser/server parity. The first useful artifact is narrower and more honest:
a static HTML template engine.

If full SSR becomes real later, reserve `@nisli/core/server` for that API. It can
compose the static renderer internally.

The terminology distinction is intentional:

- **SSG/static rendering** is the current goal. Nisli should support build-time
  HTML generation for publications, documentation, blogs, feeds, and other pages
  whose HTML can be produced before deploy.
- **Islands** are the current interactivity model. Static pages may include
  useful light DOM and custom-element tags that upgrade in the browser through
  the normal `@nisli/core` client runtime.
- **SSR** is not the current goal. Request-time component rendering, streaming,
  request-scoped dependency injection, server data orchestration, and
  hydration/adoption semantics belong in a future dedicated server design, likely
  a separate `@nisli/core/server` entry point or separate package.

The immediate need is practical: the `gkoreli.com` publication is built with
Nisli UI components and needs first-class static output for SEO. It does not
need request-time SSR today, so this roadmap should improve the UI framework and
SSG publication capabilities before attempting SSR.

## Phase 1 Scope

Phase 1 ships a small, production-quality static template renderer:

- package entry point: `@nisli/core/static`
- source location: `packages/core/src/static/`
- exports: `staticHtml`, `raw`, `renderToString`, `StaticResult`, `RawHtml`
- no browser globals
- no DOM parsing
- no filesystem access
- no network access
- no runtime dependencies
- unit tests with direct string assertions

The renderer resolves values by a strict static contract:

- `StaticResult` renders to its HTML string
- `RawHtml` renders without escaping
- arrays flatten recursively
- `null`, `undefined`, `false`, and `true` render as empty strings
- all other values stringify and escape as text

Phase 1 deliberately does **not** include:

- `@nisli/core/server`
- route discovery
- file output
- markdown processing
- SSG build orchestration
- request-time rendering
- Web Component SSR
- hydration or DOM adoption
- streaming
- lifecycle hooks
- event listeners
- refs
- signal subscriptions
- request-scoped dependency injection
- async `query()` resolution

Signals are out of scope for Phase 1. If a caller wants to render a signal's
current value, they should pass `signal.value` explicitly. A later phase can add
one-time signal value resolution if it proves useful and does not blur the static
contract.

## Acceptance Criteria

Phase 1 is complete when:

- `@nisli/core/static` works from source in the workspace.
- published package metadata includes the `./static` subpath export.
- `staticHtml` escapes interpolated text by default.
- `raw` is the only built-in escape hatch.
- `renderToString` uses the same value resolution rules as `staticHtml`.
- nested templates and arrays render correctly.
- booleans and nullish values render as empty strings.
- static tests run in the framework package without jsdom.
- the static implementation imports no browser runtime modules.

## Prior Art

This section records reference material and distilled lessons for future Nisli
static rendering, SSG, SSR, and hydration work. Only Phase 1 static rendering is
in scope for this ADR.

### Terminology Baseline

Reference:

- [web.dev: Rendering on the Web](https://web.dev/articles/rendering-on-the-web)
- [Astro: Rendering Modes](https://v4.docs.astro.build/en/basics/rendering-modes/)
- [Qwik: Static Site Generation Overview](https://qwik.dev/docs/guides/static-site-generation/)

Distillation:

- Static rendering/SSG generates HTML ahead of time, usually one HTML file per
  URL.
- SSR generates HTML on demand for a request.
- Hydration attaches browser runtime behavior to HTML that was already produced
  by server/static rendering.
- Static rendering and SSR can use the same rendering primitive. The difference
  is usually **when** the renderer runs, not necessarily how the HTML string is
  produced.
- Static rendering is usually best for blogs/docs/content where most visitors
  receive the same HTML.
- SSR is justified when HTML must vary per request, per user, per cookie, or per
  fresh backend read.

Nisli insight:

- `@nisli/core/static` should describe the rendering primitive, not the delivery
  mode.
- SSG and SSR should be treated as layers that can call the static renderer.
- The blog's current model is best described as SSG with custom-element islands,
  not request-time SSR.

### Lit

References:

- [Lit: SSR Overview](https://lit.dev/docs/ssr/overview/)
- [Lit: SSR Server Usage](https://lit.dev/docs/ssr/server-usage/)
- [Lit: SSR Client Usage](https://lit.dev/docs/ssr/client-usage/)
- [Lit: Authoring Components for Lit SSR](https://lit.dev/docs/ssr/authoring/)

Distillation:

- Lit keeps SSR in a separate experimental package: `@lit-labs/ssr`.
- Lit SSR renders Lit templates and components to static HTML in non-browser
  JavaScript environments.
- Its server `render()` returns a `RenderResult`, an iterable that can be
  streamed or collected into a string.
- Lit separates server rendering from client hydration support. The client side
  uses `@lit-labs/ssr-client`.
- Lit component SSR has real constraints: browser-only code, lifecycle behavior,
  async component work, custom element registry handling, and Declarative Shadow
  DOM all require explicit design.

Nisli insight:

- Phase 1 should copy the **small renderer first** part, not the full component
  SSR system.
- A future server renderer should be a separate entry point because Web
  Component SSR immediately introduces lifecycle, registry, shadow DOM, and
  hydration/adoption semantics.
- Returning a composable render result is worth revisiting later if streaming or
  async templates become necessary. Phase 1 can stay string-first.

### React

References:

- [React: Server React DOM APIs](https://react.dev/reference/react-dom/server)
- [React: renderToString](https://react.dev/reference/react-dom/server/renderToString)
- [React: renderToStaticMarkup](https://react.dev/reference/react-dom/server/renderToStaticMarkup)
- [React: Static React DOM APIs](https://react.dev/reference/react-dom/static)
- [React: hydrateRoot](https://react.dev/reference/react-dom/client/hydrateRoot)

Distillation:

- React keeps server APIs out of the root `react` package import path. They live
  under renderer-specific entry points such as `react-dom/server` and
  `react-dom/static`.
- React distinguishes non-interactive static markup from hydratable server
  output.
- React's static markup API is useful for simple static pages and emails, but
  explicitly cannot be hydrated.
- Hydration has a strict identity requirement: client output must match server
  output, and mismatches are treated as bugs.
- Modern React pushes serious SSR/SSG toward streaming or prerender APIs instead
  of legacy synchronous string rendering.

Nisli insight:

- A subpath export is the right shape: `@nisli/core/static` now,
  `@nisli/core/server` later if needed.
- Static output should not imply hydration.
- If Nisli ever supports hydration/adoption, it needs a contract before any API
  name suggests it is supported.

### Vue

References:

- [Vue: Server-Side Rendering Guide](https://vuejs.org/guide/scaling-up/ssr)
- [Vue: Server-Side Rendering API](https://vuejs.org/api/ssr.html)

Distillation:

- Vue exposes SSR through `vue/server-renderer`, not the default browser entry.
- SSR renders an app or vnode to HTML and later hydrates it on the client.
- Vue has an explicit SSR context object for collecting side-channel render data
  such as teleports.
- The guide frames SSR as isomorphic/universal application rendering: most app
  code runs on both server and client.

Nisli insight:

- `@nisli/core/server` should be reserved for true app/component rendering, not
  simple template string rendering.
- Request/render context is a later concern. It should not leak into Phase 1.

### Svelte And SvelteKit

References:

- [SvelteKit: Page Options](https://svelte.dev/docs/kit/page-options)
- [SvelteKit: Static Site Generation](https://svelte.dev/docs/kit/adapter-static)
- [Svelte: Server API](https://svelte.dev/docs/svelte/svelte-server)

Distillation:

- SvelteKit makes rendering mode a route/page concern: prerender, SSR, and CSR
  can be mixed.
- Prerendering is only suitable when different users can receive the same HTML.
- SSR is normally followed by hydration unless CSR is disabled.
- SvelteKit separates framework rendering semantics from deployment adapters.
  `adapter-static` is a site output layer, not the component renderer itself.

Nisli insight:

- Do not put route discovery, output files, markdown, or dev-server rebuilds into
  `@nisli/core/static`.
- A future Nisli SSG tool should be separate from the static renderer, because
  it is a site pipeline, not a template primitive.

### Astro

References:

- [Astro: Rendering Modes](https://v4.docs.astro.build/en/basics/rendering-modes/)
- [Astro: Islands Architecture](https://v4.docs.astro.build/en/concepts/islands/)
- [Astro: On-Demand Rendering](https://docs.astro.build/en/guides/on-demand-rendering/)

Distillation:

- Astro defaults to pre-rendered static output and can opt into on-demand server
  rendering.
- Astro's islands model keeps most of the page as server/static HTML and ships
  JavaScript only for interactive regions.
- Astro treats "server output mode" and "client-side islands" as independent
  decisions.

Nisli insight:

- The blog's current model maps well to static HTML plus custom-element islands.
- Nisli should document this as progressive custom-element islands before trying
  to solve full hydration.
- Static rendering can be valuable even when interactive components remain
  client-upgraded only.

### Solid And SolidStart

References:

- [Solid: renderToString](https://docs.solidjs.com/reference/rendering/render-to-string)
- [Solid: renderToStringAsync](https://docs.solidjs.com/reference/rendering/render-to-string-async)
- [Solid: renderToStream](https://docs.solidjs.com/reference/rendering/render-to-stream)
- [SolidStart Overview](https://docs.solidjs.com/solid-start)
- [SolidStart: createHandler](https://docs.solidjs.com/solid-start/reference/server/create-handler)

Distillation:

- Solid exposes multiple renderer modes: sync string, async string, and stream.
- Async rendering exists specifically to wait for Suspense/resource data.
- Streaming exposes shell-complete and all-complete milestones.
- SolidStart is the app framework layer that composes rendering modes with
  routing and deployment.

Nisli insight:

- Phase 1 should stay synchronous and data-agnostic.
- If async data rendering becomes important, it should be a deliberate Phase 2+
  API, not accidental Promise stringification behavior.
- A future server renderer needs mode selection: sync, async, stream, or a
  smaller subset.

### Qwik

References:

- [Qwik: Static Site Generation Overview](https://qwik.dev/docs/guides/static-site-generation/)
- [Qwik: Resumable vs Hydration](https://qwik.dev/docs/concepts/resumable/)
- [Qwik: Static Site Adapter](https://qwik.dev/docs/deployments/static/)

Distillation:

- Qwik clearly separates SSG and SSR by timing: build time versus request time.
- It argues that both SSG and SSR can share the same HTML generation process.
- Qwik's key distinction is resumability: it serializes enough application
  structure into HTML to avoid replaying the whole app during hydration.
- This power comes with authoring and serialization constraints.

Nisli insight:

- The "same renderer, different timing" model is useful for Nisli terminology.
- Resumability is not Phase 1, but Qwik clarifies why hydration/adoption cannot
  be hand-waved: component boundaries, listeners, and state must be recoverable.

### Web Components: WebC, Enhance, Declarative Shadow DOM

References:

- [11ty WebC README](https://github.com/11ty/webc)
- [Enhance: Components](https://enhance.dev/docs/conventions/components)
- [MDN: Using Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM)
- [web.dev: Declarative Shadow DOM](https://web.dev/articles/declarative-shadow-dom)

Distillation:

- WebC is a framework-independent HTML serializer for Web Components with static
  generation, progressive enhancement, async, streaming, and shadow-DOM-friendly
  goals.
- Enhance starts from server-rendered HTML and optionally upgrades with client
  interaction.
- Declarative Shadow DOM is the platform primitive that makes server-rendered
  shadow roots possible without client-side `attachShadow()` work during initial
  parsing.

Nisli insight:

- Custom elements provide a natural island boundary for Nisli.
- Useful light DOM fallback content is a lower-risk intermediate step before
  shadow-DOM SSR.
- If Nisli ever SSRs component internals, Declarative Shadow DOM becomes central.

### Design Lessons For Nisli

- Keep `@nisli/core/static` small and boring. It should be a trustworthy string
  renderer, not an app framework.
- Keep package entry points semantic:
  - `@nisli/core`: browser runtime
  - `@nisli/core/static`: DOM-free template-to-string rendering
  - `@nisli/core/server`: future request-time app/component renderer, if needed
- Do not imply hydration. Static HTML that cannot be hydrated is still valuable.
- Treat SSG as a pipeline layer. It owns routes, content loading, file output,
  feeds, sitemaps, and rebuild loops.
- Treat SSR as an app/runtime layer. It owns request context, async data,
  lifecycle constraints, streaming, and client handoff.
- Treat custom-element islands as the practical near-term bridge for the blog:
  generate useful HTML, then let selected components upgrade in the browser.
- Avoid Promise handling in Phase 1. Async rendering changes the API shape and
  failure modes.
- Make `raw()` easy to audit. Prior art consistently separates escaped text from
  trusted HTML.

## Rationale

1. **Same package, explicit target.** Static rendering is not a separate
   framework. It is another backend for Nisli's template syntax. Versioning it
   separately would create compatibility drift, but naming the static tag
   `staticHtml` makes refactors safer because browser `html` and static
   `staticHtml` are not interchangeable.

2. **Subpath export keeps the browser surface clean.** Browser apps importing
   `@nisli/core` should not see static rendering APIs, and bundlers should not
   need to analyze a server/static module to remove it.

3. **Tree-shaking is not the only concern.** Modern bundlers can often drop
   unused exports from a single barrel, but a subpath export gives stronger
   module-boundary guarantees: different entry points, different docs, different
   dependency policy, and no accidental root API growth.

4. **The static renderer should stay DOM-free.** The current browser template
   engine depends on `document`, `Node`, `Element`, `Comment`, and live binding
   updates. Static rendering should run in Node, Workers, and build pipelines
   without jsdom.

5. **The API can grow without overpromising SSR.** `@nisli/core/static` starts
   with strings and templates. Later phases can add static control flow,
   progressive custom-element patterns, or full server rendering when the
   semantics are clear.

## Starting Prototype

The blog project's ad-hoc implementation is the starting point. This is copied
here as the initial reference implementation, with only comment formatting
normalized for this ADR:

```ts
/**
 * static.ts - Static HTML renderer for nisli/core-style templates
 *
 * Prototype of `@nisli/core/static` - a build-time `renderToString()` for
 * nisli/core templates. Same tagged-template authoring shape as the browser
 * version, but resolves to plain HTML strings instead of DOM bindings.
 *
 * Design goal: static templates use the same tagged-template shape as browser
 * templates, but resolve to strings instead of DOM bindings.
 *
 * Current limitation: this is a standalone static tag function, not a
 * server renderer for nisli/core components.
 */

export interface StaticResult {
  toString(): string;
  __staticResult: true;
}

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, ch => ESCAPE_MAP[ch] ?? ch);
}

export function staticHtml(strings: TemplateStringsArray, ...values: unknown[]): StaticResult {
  const result: string[] = [];

  for (let i = 0; i < strings.length; i++) {
    result.push(strings[i] ?? '');

    if (i < values.length) {
      const value = values[i];
      result.push(resolveValue(value));
    }
  }

  const output = result.join('');

  return {
    __staticResult: true as const,
    toString: () => output,
  };
}

interface RawHtml {
  __raw: true;
  value: string;
}

export function raw(value: string): RawHtml {
  return { __raw: true as const, value };
}

function resolveValue(value: unknown): string {
  if (value == null || value === false) return '';
  if (value === true) return '';

  if (typeof value === 'object' && '__staticResult' in value) {
    return (value as StaticResult).toString();
  }

  if (typeof value === 'object' && '__raw' in value) {
    return (value as RawHtml).value;
  }

  if (Array.isArray(value)) {
    return value.map(resolveValue).join('');
  }

  return escapeHtml(String(value));
}
```

## Proposed Public API

Start minimal:

```ts
export interface StaticResult {
  toString(): string;
  __staticResult: true;
}

export interface RawHtml {
  __raw: true;
  value: string;
}

export function staticHtml(strings: TemplateStringsArray, ...values: unknown[]): StaticResult;
export function raw(value: string): RawHtml;
export function renderToString(value: unknown): string;
```

`renderToString()` should use the same value resolution rules as interpolation:

- `StaticResult` returns its rendered HTML
- `RawHtml` returns its raw value
- arrays are flattened
- `null`, `undefined`, `false`, and `true` render as empty strings
- all other values are stringified and escaped

This keeps the call-site options simple:

```ts
const page = staticHtml`<h1>${title}</h1>`;

page.toString();
renderToString(page);
```

## Compatibility With Browser Templates

The static renderer should intentionally mirror the browser template language
where the semantics are stable:

- string interpolation escapes HTML
- nested templates render inline
- arrays render in order
- falsy control values disappear

It should not initially attempt to support browser-only features:

- event listeners
- refs
- live signal bindings
- lifecycle hooks
- DOM reconciliation
- component registration side effects

## Mandatory SSG Publication Capabilities

The current blog/publication use case has moved from a local prototype renderer
to `@nisli/core/static`. That validates Phase 1, but it also shows which
capabilities are mandatory before Nisli can honestly claim strong SSG support
for web publications.

These requirements are for SSG and islands. They do not imply SSR.

1. Build-time rendering for existing Nisli components.

   Publications need to reuse components already authored with `component()` and
   `html`. SSG should be a build target, not a new component authoring mode.
   Authors should not have to rewrite working Nisli components with
   `staticHtml` or a separate `staticComponent()` API just to get SEO-friendly
   output.

   The next phase is therefore documented in
   [0020.1-static-site-generation-build-toolkit](./0020.1-static-publication-components-and-attributes.md):

   ```ts
   import { buildStaticSite } from '@nisli/ssg';

   await buildStaticSite({
     routes: [
       ...posts.map(post => ({
         path: `/posts/${post.slug}`,
         render: () => PostPage({ post }),
       })),
     ],
   });
   ```

2. Static-safe serialization of existing template features.

   The build-time renderer needs to understand the current `html` template
   language: text interpolation, attribute interpolation, `class:name`,
   `html:inner`, arrays, conditionals, and nested component factory results.
   Attribute output still needs careful escaping, but the goal is to serialize
   existing Nisli templates rather than introduce static-only attribute
   authoring.

3. Publication metadata primitives.

   SSG publication output is not only article body HTML. A useful system needs
   predictable generation of document metadata: titles, descriptions, canonical
   URLs, Open Graph/Twitter tags, JSON-LD, RSS, sitemap entries, and
   machine-readable indexes such as `posts.json` or `llms.txt`.

   These may not belong in `@nisli/core/static`, but they are mandatory for a
   complete Nisli publication stack.

4. Content pipeline integration.

   Markdown, frontmatter validation, syntax highlighting, generated `.md`
   endpoints, and typed TypeScript article modules are application-level SSG
   concerns. The static renderer should remain independent of these, but a future
   SSG toolkit should make these integrations straightforward and testable.

5. Island asset coordination.

   Static pages need a reliable way to include the client bundles required by
   the custom-element islands present on a page. The current publication manually
   includes global and page-specific scripts. A future SSG layer should be able
   to declare or collect island assets without implying hydration.

   This is asset orchestration, not server rendering.

6. File output and route mapping.

   A publication needs deterministic mapping from routes and slugs to output
   files, usually `dist/<slug>/index.html`, plus root files such as `feed.xml`,
   `sitemap.xml`, `llms.txt`, and static assets. This should live above
   `@nisli/core/static`.

7. Build and dev ergonomics.

   A practical SSG needs fast rebuilds, useful validation errors, deterministic
   output, and a dev server loop. This is also an SSG toolkit concern rather than
   a static renderer concern.

The conclusion is that Phase 1 is sufficient as a low-level string rendering
primitive, but not the end of the SSG story. The next framework work should
prioritize a publication build toolkit that can render existing `component()`
and `html` trees internally before any request-time SSR work.

## Phased Roadmap

The long-term roadmap is documented here for orientation, but only Phase 1 is in
scope for this ADR.

### Phase 1: Static Template Renderer

Status: **in scope now**.

Purpose: convert Nisli-style tagged templates into HTML strings.

Entry point:

```ts
import { staticHtml, raw, renderToString } from '@nisli/core/static';
```

Example:

```ts
const body = staticHtml`<article><h1>${post.title}</h1>${raw(post.html)}</article>`;
const output = renderToString(body);
```

This is enough for the current blog use case: build-time page shells, posts,
feeds, sitemap output, and HTML fragments.

### Phase 2: Static Site Generation Build Toolkit

Status: **next/current phase**.

Purpose: provide a build-time publication pipeline that turns existing Nisli
components, content, metadata, assets, and routes into static files without
introducing a second component authoring model.

Potential additions:

```ts
import { buildStaticSite } from '@nisli/ssg';

await buildStaticSite({
  outDir: 'dist',
  context: { posts },
  routes: [
    { path: '/', render: ({ posts }) => HomePage({ posts }) },
    ...posts.map(post => ({
      path: `/posts/${post.slug}`,
      render: () => PostPage({ post }),
    })),
  ],
});
```

The build tool should internally support the static-safe subset of the existing
browser template model: one-time signal/computed reads, text and attribute
serialization, `class:name`, `html:inner`, arrays, conditionals, and nested
component factories. Browser-only behavior such as event listeners, refs,
`onMount`, effects, and imperative host mutation should be omitted, rejected, or
represented as explicit islands.

### Phase 3: Progressive Custom Element Islands

Status: **future**.

Purpose: document and support the pattern the blog already uses: static HTML
documents with custom-element islands that upgrade in the browser.

Potential convention:

```ts
staticHtml`
  <nisli-theme-toggle>
    <button type="button">Theme</button>
  </nisli-theme-toggle>
`;
```

The static renderer emits useful light DOM. The client component may enhance,
adopt, or replace that content after `customElements.define()` runs. This is not
hydration unless a later ADR defines a concrete adoption protocol.

### Phase 4: Static Site Generation Toolkit

Status: **future, maybe separate package, after the static component and island
contracts are clearer**.

Purpose: route/content orchestration on top of the static renderer.

Potential scope:

- route discovery
- markdown/content loading
- file writing
- asset copying
- RSS/sitemap helpers
- publication metadata helpers
- island asset coordination
- dev server rebuild loop

This would be an SSG layer, not a renderer. If it becomes generic and useful
outside this repo, a separate package such as `@nisli/static-site` would be more
appropriate than adding it to `@nisli/core/static`.

### Phase 5: Server Renderer

Status: **future, separate ADR required**.

Purpose: request-time rendering of Nisli apps or component trees.

Potential entry point:

```ts
import { renderToString, renderToStream } from '@nisli/core/server';
```

This phase would need real framework semantics for component rendering,
request-scoped DI, async data, signal reads, lifecycle constraints, streaming,
error handling, and browser handoff.

### Phase 6: Hydration Or DOM Adoption

Status: **future, separate ADR required**.

Purpose: allow browser components to attach to server-rendered or statically
rendered DOM without throwing it away.

This is the hardest phase and should not be implied by `@nisli/core/static`.
Hydration/adoption needs a precise contract for markers, ownership, mismatch
handling, lifecycle timing, and cleanup.

## Security

Escaping by default is the central rule. `raw()` is an explicit opt-out and
should be named plainly enough to be searchable in reviews.

The renderer should not try to sanitize raw HTML. Sanitization depends on the
source domain and policy. `raw()` means "this string is already trusted or has
already been sanitized."

## Testing

Static renderer tests belong in `packages/core/src/static/*.test.ts` or an
equivalent colocated location under the core package.

They should be unit tests only:

- no real filesystem
- no network
- no jsdom requirement unless a later test covers integration with browser
  template behavior
- direct assertions against rendered strings

Important cases:

- escapes text interpolation
- preserves `raw()` output
- renders nested templates
- flattens arrays recursively
- renders booleans and nullish values as empty strings
- renders numbers and other primitives
- does not import browser globals

## Consequences

- `@nisli/core` gains a second public entry point without expanding the root
  browser API.
- Static site and build-time projects can use the same template style without
  copying local renderers.
- Browser and static template semantics need an explicit compatibility contract.
- Full SSR remains out of scope until component-tree rendering semantics are
  designed separately.
