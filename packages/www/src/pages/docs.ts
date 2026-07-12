/**
 * pages/docs.ts — the framework docs: nav structure, sidebar layout, and page
 * content. Docs are framework-first (react.dev/svelte.dev shape). Authored as
 * nisli html templates rendered through @nisli/ssg (no markdown pipeline yet —
 * see IA.md §2). Content sourced from the README + ADRs.
 */
import { html, type TemplateResult } from '@nisli/core';
import { CodeBlock, Command } from '../components/code-block.js';

export interface DocPage {
  /** Route is `/docs` for '' , else `/docs/<slug>`. */
  slug: string;
  title: string;
  description: string;
  render: () => TemplateResult;
}

interface DocSection {
  title: string;
  pages: DocPage[];
}

// ── Prose helpers ───────────────────────────────────────────────────────────
function Lead(text: string): TemplateResult {
  return html`<p class="mt-3 text-lg text-muted-foreground text-pretty">${text}</p>`;
}
function H2(text: string): TemplateResult {
  return html`<h2 class="mt-10 scroll-mt-20 text-2xl font-semibold tracking-tight">${text}</h2>`;
}
function P(content: TemplateResult | string): TemplateResult {
  return html`<p class="mt-4 leading-7 text-pretty">${content}</p>`;
}
function code(text: string): TemplateResult {
  return html`<code class="rounded bg-muted px-1.5 py-0.5 text-[0.9em]">${text}</code>`;
}

// ── Pages ───────────────────────────────────────────────────────────────────
const introPage: DocPage = {
  slug: '',
  title: 'Introduction',
  description: 'nisli is a reactive web-component framework — signals, tagged-template components, DI, and static rendering, with no build step.',
  render: () => html`<div>
    <h1 class="text-4xl font-bold tracking-tight">Introduction</h1>
    ${Lead('nisli is a reactive framework for the native web platform. It gives you fine-grained signals, tagged-template components, dependency injection, and static rendering — with no compiler and no virtual DOM.')}
    ${P(html`nisli is the framework — everything lives in ${code('@nisli/core')}. ${code('@nisli/ui')} is its batteries-included design language: shadcn-style components you copy into your project and own. The one idea that ties it together: install the framework, copy in the components.`)}
    ${H2('Why nisli')}
    ${P('Components are real custom elements, so they interoperate everywhere and outlive framework churn. Reactivity is fine-grained — a signal change updates exactly the DOM that depends on it, with no re-render and no diffing. And there is no build step: templates are just JavaScript tagged-template literals.')}
    ${H2('Next steps')}
    ${P(html`Install it (${code('/docs/installation')}), then build a counter in the ${code('/docs/quick-start')}. The core concepts — signals, templates, and components — each have a page.`)}
  </div>`,
};

const installationPage: DocPage = {
  slug: 'installation',
  title: 'Installation',
  description: 'Install the nisli framework from npm, then set up @nisli/ui to copy in components.',
  render: () => html`<div>
    <h1 class="text-4xl font-bold tracking-tight">Installation</h1>
    ${Lead('Install the framework from npm. It ships as ESM with TypeScript types and has zero runtime dependencies.')}
    ${H2('The framework')}
    ${Command('npm install @nisli/core')}
    ${P(html`That is the whole framework — ${code('signal')}, ${code('component')}, ${code('html')}, DI, and more, from one package.`)}
    ${H2('The components (optional)')}
    ${P(html`${code('@nisli/ui')} is a CLI, not a dependency — you run it to copy component source into your project. Initialize once:`)}
    ${Command('npx @nisli/ui init')}
    ${P(html`Then add any component; its source lands in your project and becomes yours to edit:`)}
    ${Command('npx @nisli/ui add button dialog')}
    ${P(html`See ${code('/docs/cli')} for the full copy-in workflow, and browse the catalog at ${code('/ui')}.`)}
  </div>`,
};

const quickStartPage: DocPage = {
  slug: 'quick-start',
  title: 'Quick start',
  description: 'Build a reactive counter with a signal, a component, and an html template — the nisli hello-world.',
  render: () => html`<div>
    <h1 class="text-4xl font-bold tracking-tight">Quick start</h1>
    ${Lead('Three imports — a signal, a component, and an html template — build a working reactive counter. No build step required.')}
    ${H2('Define a component')}
    ${P(html`${code('component()')} registers a real custom element. Inside the setup function, ${code('signal()')} creates reactive state; the ${code('html``')} template wires it to the DOM.`)}
    ${CodeBlock(
      `import { signal, component, html } from '@nisli/core';

component('x-counter', () => {
  const count = signal(0);

  return html\`
    <button @click=\${() => count.value++}>
      Count: \${count}
    </button>
  \`;
});`,
      { file: 'counter.ts' },
    )}
    ${H2('Use it')}
    ${P(html`Importing the module registers the ${code('<x-counter>')} element. Drop the tag in your HTML — it upgrades automatically. No hydration step, no root render call.`)}
    ${CodeBlock(
      `<script type="module" src="./counter.ts"></script>

<x-counter></x-counter>`,
      { file: 'index.html' },
    )}
    ${P(html`Clicking the button mutates ${code('count.value')}; the ${code('${count}')} binding is the only thing that updates. That is fine-grained reactivity — no re-render, no diff.`)}
    ${H2('What next')}
    ${P(html`Learn how reactivity works (${code('/docs/signals')}), how templates bind (${code('/docs/templates')}), and how to compose components (${code('/docs/components')}).`)}
  </div>`,
};

const signalsPage: DocPage = {
  slug: 'signals',
  title: 'Signals',
  description: 'Fine-grained reactivity with signal(), computed(), and effect() — no re-renders, no diffing.',
  render: () => html`<div>
    <h1 class="text-4xl font-bold tracking-tight">Signals</h1>
    ${Lead('Signals are nisli’s reactive primitive. A signal holds a value; anything that reads it re-runs when it changes — and nothing else does.')}
    ${H2('signal')}
    ${P(html`Create state with ${code('signal(initial)')}. Read and write through ${code('.value')}.`)}
    ${CodeBlock(
      `import { signal } from '@nisli/core';

const count = signal(0);
count.value;        // 0
count.value = 5;    // notifies readers`,
    )}
    ${H2('computed')}
    ${P(html`${code('computed()')} derives a read-only signal. It is lazy and cached — it recomputes only when a dependency changes.`)}
    ${CodeBlock(
      `import { signal, computed } from '@nisli/core';

const count = signal(2);
const doubled = computed(() => count.value * 2);
doubled.value;      // 4`,
    )}
    ${H2('effect')}
    ${P(html`${code('effect()')} runs a side effect and re-runs when any signal it read changes. Dependencies are tracked automatically — no dependency arrays.`)}
    ${CodeBlock(
      `import { signal, effect } from '@nisli/core';

const count = signal(0);
effect(() => console.log('count is', count.value));
// logs "count is 0" now, and again on every change`,
    )}
    ${P(html`Inside ${code('html``')} templates you read signals implicitly — ${code('${count}')}, no ${code('.value')} needed. The template subscribes and updates exactly the binding that changed.`)}
  </div>`,
};

const templatesPage: DocPage = {
  slug: 'templates',
  title: 'Templates',
  description: 'The html`` tag — interpolation, attributes, events, lists with each(), and conditionals with when().',
  render: () => html`<div>
    <h1 class="text-4xl font-bold tracking-tight">Templates</h1>
    ${Lead('Templates are tagged-template literals — the html`` tag. No JSX, no compiler; they are just JavaScript.')}
    ${H2('Bindings')}
    ${P(html`Interpolate signals and values directly. Text bindings are escaped by default. Bind attributes with ${code('name="${value}"')} and events with ${code('@event=${handler}')}.`)}
    ${CodeBlock(
      `html\`
  <button
    class="btn \${variant}"
    disabled=\${isBusy}
    @click=\${onClick}
  >\${label}</button>
\``,
    )}
    ${H2('Lists')}
    ${P(html`${code('each()')} renders a keyed list that reconciles efficiently as the source changes.`)}
    ${CodeBlock(
      `import { html, each } from '@nisli/core';

html\`<ul>\${each(items, (item) => html\`<li>\${item.name}</li>\`)}</ul>\``,
    )}
    ${H2('Conditionals')}
    ${P(html`${code('when()')} renders one branch or another based on a condition.`)}
    ${CodeBlock(
      `import { html, when } from '@nisli/core';

html\`\${when(isOpen, () => html\`<panel-body></panel-body>\`, () => html\`\`)}\``,
    )}
    ${P(html`Compose other components by calling their factory inside a template — ${code('${Button({ children: \'Save\' })}')}. Custom elements are always used via their factory, never as raw tags.`)}
  </div>`,
};

const componentsPage: DocPage = {
  slug: 'components',
  title: 'Components',
  description: 'Define custom elements with component(): typed props as signals, a synchronous setup, and lifecycle hooks.',
  render: () => html`<div>
    <h1 class="text-4xl font-bold tracking-tight">Components</h1>
    ${Lead('component() defines a real custom element and returns a typed factory for composition.')}
    ${H2('Props are signals')}
    ${P(html`Declare props as a TypeScript interface. Inside setup, every prop is a ${code('Signal')} — read ${code('.value')} or use it in a template. The setup function must be synchronous.`)}
    ${CodeBlock(
      `import { component, computed, html } from '@nisli/core';

interface GreetingProps { name: string }

const Greeting = component<GreetingProps>('x-greeting', (props) => {
  const upper = computed(() => props.name.value.toUpperCase());
  return html\`<p>Hello, \${upper}</p>\`;
});`,
    )}
    ${H2('Factory composition')}
    ${P(html`Calling ${code('Greeting({ name: \'nisli\' })')} returns a template you compose into other components. Pass a plain value for static props, or a signal to stay reactive.`)}
    ${H2('Lifecycle')}
    ${P(html`${code('onMount()')} runs after the element connects; ${code('onCleanup()')} runs on teardown. Effects created in setup are disposed automatically.`)}
    ${CodeBlock(
      `import { component, onMount, onCleanup, html } from '@nisli/core';

component('x-clock', () => {
  onMount(() => {
    const id = setInterval(tick, 1000);
    onCleanup(() => clearInterval(id));
  });
  return html\`<time></time>\`;
});`,
    )}
  </div>`,
};

const cliPage: DocPage = {
  slug: 'cli',
  title: 'CLI — copy in components',
  description: 'The @nisli/ui CLI copies component source into your project. You own the files; nothing auto-updates.',
  render: () => html`<div>
    <h1 class="text-4xl font-bold tracking-tight">CLI — copy in components</h1>
    ${Lead('@nisli/ui is a copy-in CLI, not a runtime dependency. It writes real component source into your project — you own and edit it.')}
    ${H2('Initialize')}
    ${P(html`Run once per project. ${code('init')} writes the token layer and a ${code('nisli-ui.json')} config recording where components land.`)}
    ${Command('npx @nisli/ui init')}
    ${H2('Add components')}
    ${P(html`${code('add')} copies the named items — and their registry dependencies — into your project.`)}
    ${Command('npx @nisli/ui add button dialog')}
    ${P(html`Every component page lists its exact command and dependencies — see ${code('/ui')}.`)}
    ${H2('You own the copies')}
    ${P('Copied files are yours: edit them freely. They never auto-update — re-run add to pull a fresh copy when you want one. This is the honest-consumer model; even this website installs its components this way.')}
  </div>`,
};

const diPage: DocPage = {
  slug: 'dependency-injection',
  title: 'Dependency injection',
  description: 'Share services down the component tree with provide() and inject() — the class is the token.',
  render: () => html`<div>
    <h1 class="text-4xl font-bold tracking-tight">Dependency injection</h1>
    ${Lead('nisli has built-in DI. Inject a service anywhere in the tree without prop-drilling or module-level globals — and the class itself is the token.')}
    ${H2('inject')}
    ${P(html`${code('inject(Service)')} returns a singleton, auto-created on first use. No registration, no provider boilerplate — the class is the token.`)}
    ${CodeBlock(
      `import { component, inject, html } from '@nisli/core';

class Clock {
  now() { return new Date().toLocaleTimeString(); }
}

component('x-now', () => {
  const clock = inject(Clock);          // singleton, auto-created
  return html\`<time>\${clock.now()}</time>\`;
});`,
    )}
    ${H2('provide')}
    ${P(html`Override what a token resolves to — a mock in tests, or a configured instance. Call ${code('provide()')} before the consumer injects.`)}
    ${CodeBlock(`import { provide } from '@nisli/core';

provide(Clock, () => ({ now: () => '12:00:00' })); // e.g. in a test`)}
    ${H2('Tokens for non-class values')}
    ${P(html`For values that aren’t classes (config objects, primitives), create a typed token with ${code('createToken()')}.`)}
    ${CodeBlock(`import { createToken, inject, provide } from '@nisli/core';

const ApiUrl = createToken<string>('ApiUrl');
provide(ApiUrl, () => 'https://api.nisli.dev');
const url = inject(ApiUrl);`)}
  </div>`,
};

const queryPage: DocPage = {
  slug: 'query',
  title: 'Query',
  description: 'Declarative async data with query() — caching, loading, and error state wired into signals.',
  render: () => html`<div>
    <h1 class="text-4xl font-bold tracking-tight">Query</h1>
    ${Lead('query() absorbs the loading / error / cache / refetch boilerplate of fetching data, and hands you signals wired straight into the reactivity graph.')}
    ${H2('query')}
    ${P(html`Pass a cache-key function and a fetcher. You get back ${code('data')}, ${code('loading')}, and ${code('error')} signals plus a ${code('refetch()')} method. The key is tracked — when it changes, the query refetches. Select the view with a ${code('computed()')} (the sanctioned multi-branch pattern) so each branch stays reactive.`)}
    ${CodeBlock(
      `import { component, query, computed, html } from '@nisli/core';

component('user-card', (props) => {
  const user = query(
    () => ['user', props.id.value],          // cache key (tracked)
    () => fetch(\`/api/users/\${props.id.value}\`).then((r) => r.json()),
  );

  const view = computed(() => {
    if (user.loading.value) return html\`<p>Loading…</p>\`;
    if (user.error.value) return html\`<p>Error: \${user.error.value.message}</p>\`;
    return html\`<p>\${user.data.value?.name}</p>\`;
  });

  return html\`\${view}\`;
});`,
    )}
    ${H2('Refetch & caching')}
    ${P(html`Call ${code('user.refetch()')} to reload. ${code('staleTime')} (ms) marks cached data fresh for that window — while it is fresh, the automatic query (on mount or when the key changes) serves the cache and skips fetching. An explicit ${code('refetch()')} bypasses ${code('staleTime')} — it is never a no-op inside the fresh window — though if the same query is already in flight it joins that request rather than firing a second. Only once ${code('staleTime')} expires does the automatic path fetch again. Use ${code('QueryClient')} to prefetch.`)}
  </div>`,
};

const ssgPage: DocPage = {
  slug: 'ssg',
  title: 'Static rendering',
  description: 'Render nisli components to static HTML with @nisli/ssg — the pipeline behind this site.',
  render: () => html`<div>
    <h1 class="text-4xl font-bold tracking-tight">Static rendering</h1>
    ${Lead('@nisli/ssg renders nisli components to static HTML at build time. No client runtime is required for the initial paint — custom elements upgrade if and when you ship the scripts.')}
    ${H2('buildStaticSite')}
    ${P(html`Give it an output directory and a list of routes; each route’s ${code('render')} returns a nisli template, which is rendered to HTML and written to disk.`)}
    ${CodeBlock(
      `import { buildStaticSite } from '@nisli/ssg';
import { homePage } from './pages/home.js';

await buildStaticSite({
  outDir: 'dist',
  routes: [{ path: '/', render: () => homePage() }],
});`,
      { file: 'build.ts' },
    )}
    ${P(html`This very website is built this way — nisli pages, composed from ${code('@nisli/ui')}, rendered by ${code('@nisli/ssg')} to a static bundle and deployed to Cloudflare. It is the framework’s own dogfood.`)}
  </div>`,
};

// ── Structure ───────────────────────────────────────────────────────────────
export const DOC_SECTIONS: readonly DocSection[] = [
  { title: 'Getting started', pages: [introPage, installationPage, quickStartPage] },
  {
    title: 'Core concepts',
    pages: [signalsPage, templatesPage, componentsPage, diPage, queryPage],
  },
  { title: 'Tooling', pages: [ssgPage, cliPage] },
];

export const docPages: readonly DocPage[] = DOC_SECTIONS.flatMap((s) => s.pages);

export function docPath(slug: string): string {
  return slug ? `/docs/${slug}` : '/docs';
}

// ── Layout ──────────────────────────────────────────────────────────────────
export function docsLayout(page: DocPage): TemplateResult {
  const current = docPath(page.slug);
  return html`<div class="mx-auto flex max-w-6xl gap-10 px-6 py-10">
    <aside class="hidden w-56 shrink-0 lg:block">
      <nav class="sticky top-20 space-y-6 text-sm">
        ${DOC_SECTIONS.map(
          (section) => html`<div>
            <div class="font-medium">${section.title}</div>
            <ul class="mt-2 space-y-1 border-l">
              ${section.pages.map((p) => {
                const path = docPath(p.slug);
                const active = path === current;
                return html`<li>
                  <a
                    href="${path}"
                    class="-ml-px block border-l py-1 pl-4 ${active
                      ? 'border-foreground font-medium text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground'}"
                    >${p.title}</a
                  >
                </li>`;
              })}
            </ul>
          </div>`,
        )}
      </nav>
    </aside>
    <article class="min-w-0 max-w-2xl flex-1">${page.render()}</article>
  </div>`;
}
