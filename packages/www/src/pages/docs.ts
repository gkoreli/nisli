/**
 * pages/docs.ts — the framework docs: nav structure, sidebar layout, and page
 * content. Docs are framework-first (react.dev/svelte.dev shape). Authored as
 * nisli html templates rendered through @nisli/ssg (no markdown pipeline yet —
 * see IA.md §2). Content sourced from the README + ADRs.
 */
import { html, type TemplateResult } from '@nisli/core';
import { CodeBlock, Command } from '../components/code-block.js';
// Code samples are real, compiler-checked .ts modules (src/snippets/*), rendered
// via Vite's ?raw so the shown source is exactly what typechecks (WWW-8).
import counterSrc from '../snippets/quick-start-counter.ts?raw';
import signalsSignalSrc from '../snippets/signals-signal.ts?raw';
import signalsComputedSrc from '../snippets/signals-computed.ts?raw';
import signalsEffectSrc from '../snippets/signals-effect.ts?raw';
import templatesBindingsSrc from '../snippets/templates-bindings.ts?raw';
import templatesEachSrc from '../snippets/templates-each.ts?raw';
import templatesWhenSrc from '../snippets/templates-when.ts?raw';
import componentsGreetingSrc from '../snippets/components-greeting.ts?raw';
import componentsLifecycleSrc from '../snippets/components-lifecycle.ts?raw';
import diInjectSrc from '../snippets/di-inject.ts?raw';
import diProvideSrc from '../snippets/di-provide.ts?raw';
import diTokenSrc from '../snippets/di-token.ts?raw';
import querySrc from '../snippets/query.ts?raw';
import ssgSrc from '../snippets/ssg.ts?raw';
import acpWireSrc from '../snippets/acp-wire.ts?raw';
import acpPermissionSrc from '../snippets/acp-permission.ts?raw';
import vtRouterSrc from '../snippets/view-transitions-router.ts?raw';
import vtSsgSrc from '../snippets/view-transitions-ssg.ts?raw';
import vtEachSrc from '../snippets/view-transitions-each.ts?raw';
// The site's ACTUAL view-transition stylesheet, rendered verbatim — the page
// documents the shipped file rather than a copy of it that can drift.
import vtCss from '../styles/view-transitions.css?raw';
import { ListTransitionDemo } from '../components/list-transition-demo.js';

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
    ${CodeBlock(counterSrc.trimEnd(), { file: 'counter.ts' })}
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
    ${CodeBlock(signalsSignalSrc.trimEnd())}
    ${H2('computed')}
    ${P(html`${code('computed()')} derives a read-only signal. It is lazy and cached — it recomputes only when a dependency changes.`)}
    ${CodeBlock(signalsComputedSrc.trimEnd())}
    ${H2('effect')}
    ${P(html`${code('effect()')} runs a side effect and re-runs when any signal it read changes. Dependencies are tracked automatically — no dependency arrays.`)}
    ${CodeBlock(signalsEffectSrc.trimEnd())}
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
    ${CodeBlock(templatesBindingsSrc.trimEnd(), { file: 'save-button.ts' })}
    ${H2('Lists')}
    ${P(html`${code('each()')} renders a keyed list that reconciles efficiently. It takes the items signal, a key function, and a template that receives each item as a signal. Inside that template, wrap each field read in a ${code('computed()')} — ${code('${computed(() => item.value.name)}')} — so a change to one item updates only that leaf binding. Reading ${code('item.value.name')} bare would subscribe the list's reconciler to the per-item signal, re-reconciling the whole list on every item change.`)}
    ${CodeBlock(templatesEachSrc.trimEnd())}
    ${H2('Conditionals')}
    ${P(html`${code('when()')} renders a template while a condition is truthy (pass a signal to stay reactive).`)}
    ${CodeBlock(templatesWhenSrc.trimEnd())}
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
    ${CodeBlock(componentsGreetingSrc.trimEnd())}
    ${H2('Factory composition')}
    ${P(html`Calling ${code('Greeting({ name: \'nisli\' })')} returns a template you compose into other components. Pass a plain value for static props, or a signal to stay reactive.`)}
    ${H2('Lifecycle')}
    ${P(html`${code('onMount()')} runs after the element connects; ${code('onCleanup()')} runs on teardown. Effects created in setup are disposed automatically.`)}
    ${CodeBlock(componentsLifecycleSrc.trimEnd())}
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
    ${CodeBlock(diInjectSrc.trimEnd())}
    ${H2('provide')}
    ${P(html`Override what a token resolves to — a mock in tests, or a configured instance. Call ${code('provide()')} before the consumer injects.`)}
    ${CodeBlock(diProvideSrc.trimEnd())}
    ${H2('Tokens for non-class values')}
    ${P(html`For values that aren’t classes (config objects, primitives), create a typed token with ${code('createToken()')}.`)}
    ${CodeBlock(diTokenSrc.trimEnd())}
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
    ${CodeBlock(querySrc.trimEnd())}
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
    ${CodeBlock(ssgSrc.trimEnd(), { file: 'build.ts' })}
    ${P(html`This very website is built this way — nisli pages, composed from ${code('@nisli/ui')}, rendered by ${code('@nisli/ssg')} to a static bundle and deployed to Cloudflare. It is the framework’s own dogfood.`)}
  </div>`,
};

const acpPage: DocPage = {
  slug: 'acp',
  title: 'Agent transcripts (ACP)',
  description:
    'Render a coding-agent session with the @nisli/ui ACP set — a reducer plus components for the Agent Client Protocol, copied as source with no SDK dependency.',
  render: () => html`<div>
    <h1 class="text-4xl font-bold tracking-tight">Agent transcripts (ACP)</h1>
    ${Lead('The Agent Client Protocol is how editors talk to coding agents — Claude Code, Gemini CLI, goose, codex. The @nisli/ui ACP set renders those sessions: streaming messages, tool calls with diffs, plans, reasoning, and the permission prompt.')}
    ${H2('Install')}
    ${Command('npx @nisli/ui add acp-chat')}
    ${P(html`That copies the whole set into your project: ${code('lib/acp-protocol.ts')} (type-only wire shapes), ${code('lib/acp-session.ts')} (the reducer), and the ${code('ui/acp/')} components — chat (transcript + composer), transcript, tool-call, diff, plan, thought, content, permission. Like every registry item, it is source you own; the only import is ${code('@nisli/core')}.`)}
    ${H2('Wire it to a session')}
    ${P(html`An ACP connection delivers ${code('session/update')} notifications. Feed each one to ${code('createTranscript()')} and mount ${code('AcpTranscript')} on its ${code('entries')} signal — the reducer coalesces streamed chunks into stable keyed entries, merges ${code('tool_call_update')}s by id, and replaces the plan in place, so the DOM patches instead of rebuilding per token.`)}
    ${CodeBlock(acpWireSrc.trimEnd())}
    ${H2('The permission round-trip')}
    ${P(html`${code('session/request_permission')} blocks the agent until the user answers. ${code('AcpPermission')} renders the requested tool call expanded — diff included, because approving a write you cannot read is the failure mode this exists to prevent — and styles ${code('allow_always')} distinctly from ${code('allow_once')}, so a standing grant is never one muscle-memory click away. Nothing autofocuses; dismissal maps to ${code('cancelled')}.`)}
    ${CodeBlock(acpPermissionSrc.trimEnd())}
    ${H2('Why no SDK dependency')}
    ${P(html`ACP has shipped three breaking majors in a year, and the published ACP UI libraries are each type-coupled to a dead one. These files instead describe the JSON on the wire: a ${code('sessionUpdate')} variant this copy has never seen renders as an inspectable raw row instead of vanishing, and widening the union without handling the new variant is a build error (a ${code('never')} guard in the reducer), not a blank row. When the protocol moves, you edit your own file.`)}
    ${P(html`Agent output and tool results are untrusted data — a tool result is a channel an attacker can steer. Every component renders content as text, never as HTML; if you add markdown, sanitize after parsing.`)}
    ${H2('See it live')}
    ${P(html`The ${code('/ui/acp-chat')} page is a working chat against a canned agent, and ${code('/ui/acp-transcript')} replays a session through the real reducer — streaming coalescence, the tool-call status flip, and plan updates, live. Each component in the set has its own page under ${code('/ui')}.`)}
  </div>`,
};

const viewTransitionsPage: DocPage = {
  slug: 'view-transitions',
  title: 'View transitions',
  description:
    'Animate navigations and keyed lists with the platform View Transition API — the router opt-in, the cross-document build option, and the each() reorder recipe.',
  render: () => html`<div>
    <h1 class="text-4xl font-bold tracking-tight">View transitions</h1>
    ${Lead('nisli does not ship an animation system. It hands the platform’s View Transition API three seams — a core primitive, a router option, and a build option — and gets out of the way. All three are opt-in, and all three degrade to today’s unanimated behavior with no polyfill and no UA sniffing.')}
    ${P(html`The three seams answer three different questions. ${code('viewTransition()')} from ${code('@nisli/core')} animates a state update inside one page. ${code('defineRouter')}’s ${code('viewTransitions')} option animates client-side navigation. ${code('buildStaticSite')}’s ${code('viewTransitions')} option animates navigation between statically built documents — no runtime JS at all. This site runs all three; the CSS at the bottom of this page is the file its own transitions run on.`)}

    ${H2('A state update: viewTransition()')}
    ${P(html`${code('viewTransition(update, { types })')} wraps a synchronous state write. The browser captures the old frame, runs your callback, captures the new frame, and animates between them. The reason it needs to be a wrapper at all is nisli’s scheduler: signal writes coalesce onto a microtask, so a bare ${code('items.value = sorted')} inside the callback would mutate the DOM after the capture window closed — the browser would animate a frame to itself. ${code('viewTransition()')} calls ${code('flush()')} inside the callback, so the mutation the browser snapshots is nisli’s own synchronous flush.`)}
    ${P(html`Keep async work outside. The page is frozen inside the capture window, so wrap the commit and nothing else.`)}

    ${H2('Navigation: the router opt-in')}
    ${P(html`Off by default. Turning it on wraps only the ${code('commit')} — rendered output, managed head, and the scroll/focus effects — so ${code('document.title')}, ${code('<meta>')}, and the DOM swap atomically inside one snapshot. The awaited route render stays outside: a slow loader delays the animation’s start, it never freezes the page mid-capture.`)}
    ${CodeBlock(vtRouterSrc.trimEnd(), { file: 'app-router.ts' })}
    ${P(html`${code('types')} chooses what ${code(':active-view-transition-type()')} matches, and defaults to the navigation direction the engine reports. That default is ${code('history')} direction — which is worth overriding on a docs site, because the direction a reader perceives is their position in the docs sequence. Clicking the sidebar from Templates back up to Signals is a history push (${code('forward')}) even though the content moved backwards, so this site derives the direction from its own page order and only falls back to the engine off the docs spine.`)}
    ${P(html`Three navigations never transition, whatever the policy says: the initial render (there is no previous frame), a hash-only move (the browser is already performing that jump), and a hidden document. A single navigation can also overrule the policy — ${code('router.navigate(href, { viewTransition: false })')}.`)}

    ${H2('Between built pages: the SSG option')}
    ${P(html`A cross-document transition runs only when ${code('both')} the outgoing and the incoming document carry ${code('@view-transition { navigation: auto }')}. A page therefore cannot opt its own inbound navigations in — which is exactly why this is a build option: the build is the only layer that sees every page. The object form adds speculation rules, so the next document is already fetched (or fully rendered) when the click lands.`)}
    ${CodeBlock(vtSsgSrc.trimEnd(), { file: 'build.ts' })}
    ${P(html`Prerendering runs a page fully in a hidden document: subresources load, scripts execute, fetches fire. Listener wiring and island mounting are fine there, but anything ${code('observable')} — analytics, timers, autofocus, media playback — has to wait for activation. ${code('whenActive()')} from ${code('@nisli/ssg/client')} is that guard, and it runs its callback immediately on engines without prerendering.`)}

    ${H2('A keyed list: the each() recipe')}
    ${P(html`Lists are where view transitions earn their keep, and where the platform gives you the most for the least. ${code('view-transition-name: match-element')} names an element by its own identity, so a keyed ${code('each()')} needs no generated names and no per-item bookkeeping — the reconciler already keeps the same element for the same key, and that is the whole contract.`)}
    ${P(html`${code('view-transition-class')} then styles every row as a group. With identity-keyed names there is no name to write a rule against, so the class is not a convenience here — it is the only way to reach the rows at all.`)}
    ${CodeBlock(vtEachSrc.trimEnd())}
    ${P(html`The part that bites: ${code('each()')} wraps every item in an ${code('<each-item style="display: contents">')} so inner content can swap DOM nodes without invalidating the reconciler’s node tracking. A ${code('display: contents')} element generates no box, and an element with no box cannot be snapshotted — a ${code('view-transition-name')} on that wrapper is silently ignored. The name belongs on the item’s painted root, the ${code('<li>')} inside.`)}
    ${P('Live, below. Sort and filter are separate writes through the same wrapped update, because as far as the animation is concerned a filter is a reorder too: rows leave, rows arrive, survivors move.')}
    ${html`<div data-hydrate="list-transition">${ListTransitionDemo()}</div>`}

    ${H2('Reduced motion')}
    ${P(html`Answered in CSS, never by branching in JS. The transition still runs — so the DOM still swaps atomically in a single frame, and type-scoped styles stay active — and only the motion is neutralised. Skipping the call instead would give a reduced-motion user a different code path, and a different set of bugs.`)}

    ${H2('The stylesheet')}
    ${P(html`nisli ships no stylesheet: the root crossfade is the browser default, and everything below is tuning. This is the whole file, rendered verbatim from the source this page is styled by.`)}
    ${CodeBlock(vtCss.trimEnd(), { file: 'src/styles/view-transitions.css' })}
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
  { title: 'Recipes', pages: [viewTransitionsPage, acpPage] },
];

export const docPages: readonly DocPage[] = DOC_SECTIONS.flatMap((s) => s.pages);

export function docPath(slug: string): string {
  return slug ? `/docs/${slug}` : '/docs';
}

// The docs sidebar + content frame is now the shared layout/DocsLayout (WWW-12),
// fed by layout/nav-model.ts (derived from DOC_SECTIONS below). The old
// page-local docsLayout() was deleted with the app-router rewire.
