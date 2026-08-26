# The fifth nisli package — skeleton, destination map, core seams, and the name
**Date**: 2026-08-25 · **Kind**: prior-art evidence, captured verbatim
**Slice**: exactly what it takes to add a fifth package to THIS repository, derived from the repository itself — no external research.
**Parent**: [`NEXTGEN-SCRATCHPAD.md`](../NEXTGEN-SCRATCHPAD.md) — the new package, provisionally called `@nisli/next`, then `@nisli/engine`. **This file recommends neither.**

> **The framing this was written to.** `@nisli/core` is the barebones kernel and
> stays independently usable. The new package is a **permanent peer** — things
> may be stable in it forever; there is no graduation clock and no expiry.
> Moving something into core later stays possible but is not the package's
> purpose. The dependency is **bidirectional by design**: core may grow new
> seams specifically so the peer can do more (§6). The charter is appearance +
> attention + declared state space, not layout alone — which is why §8 rejects
> appearance-only names too.

## Verdict in five bullets

1. **`@nisli/engine` collides harder with this repository than `@nisli/next`
   does, and its collision is in live public API.** `engine` is already a
   load-bearing noun here in three unrelated senses: the router's navigation
   seam (an entire module, seven exported names, and the public option
   `defineRouter(catalog, { engine })`), core's own "Template engine", and
   "engine" meaning *browser* engine — including inside a user-visible thrown
   error. Evidence with line numbers in the headline section below; ranked
   alternatives with per-name collision data in §8. `next` has **zero code
   collisions** and is wrong for a different reason: it promises impermanence
   about a package that was just declared permanent.

2. **Adding the package is cheap; making it *publishable* is the expensive half,
   and the repo already legislated it.** `docs/adr/0030.2-agent-native-core-ergonomics.md:333-336`:
   "`packages/*` is globbed by the workspace **and the push-triggered auto-tag
   release flow** — its first publish must be deliberate and sequenced with
   arch, not a side effect of landing source." `auto-tag.yml:7-8` fires on any
   push touching `packages/*/package.json`, and the workflow creates the git tag
   and GitHub release (`:100-115`) *before* it publishes (`:117-128`) — so a
   first landing with `trusted-publisher: true` before the npm Trusted Publisher
   exists strands a tag that blocks every retry of that version (`:64-69`).

3. **The CSS ships fine from this package — and only from this package.** Core
   cannot ship CSS at any layer: its build is `tsc -p tsconfig.build.json`
   (`packages/core/package.json:50`), which emits none; `files` is
   `["dist","README.md","LICENSE"]` (`:44-48`); the export map is three `.ts`
   entries (`:20-24`). `@nisli/ui` proves the mechanism is legal outside core —
   `packages/ui/package.json:43-49` ships a raw `registry/` directory containing
   `packages/ui/registry/default/styles/theme.css`. Put the resolution table at
   `<pkg>/theme/`, package root and **not** `src/`, because `files` never
   includes `src`. Corollary worth recording so it is never re-litigated: the
   table is the ~40% of the bet (`experiments/c11-appearance/README.md`,
   "Weighting") that **structurally can never move into core**.

4. **Core needs no changes to *host* the C11 code, and four seams to make it
   good — one of which is an outright collision.** Every core symbol the
   experiment imports is already on the barrel, and a grep for `@nisli/core/`
   across the whole experiment returns **no matches** (no deep imports). But
   C11's diagnostic codes — `N601, N610, N620, N621, N630, N640, N650, N660,
   N670, N680, N690` — all sit inside the `N6xx` range core reserves for "async:
   query/resource/settle diagnostics" (`packages/core/src/diagnostics.ts:48`),
   core has already assigned `N602`/`N603` (`:66-67`), and `N601` is a number
   core retired with "**The number is not reused**" (`:68-69`). §6, including
   the N700 addendum.

5. **Six existing files change for a public package, two for a private one.**
   Nothing in the root `package.json`, root `tsconfig.json`,
   `pnpm-workspace.yaml`, `mise.toml` or `scripts/check-toolchain.mjs` needs
   touching, each inert for a stated reason rather than by assumption. Full list
   with paths and reasons in §Complete edit list.

---

## Headline: the name

### `engine` is already three different things in this codebase

**(a) A public router API.** `packages/router/src/engine.ts` is a module by that
name, exporting seven identifiers:

| line | export | its own doc comment |
|---|---|---|
| `engine.ts:7` | `export type EngineNavigationKind = 'initial' \| 'push' \| 'replace' \| 'traverse';` | — |
| `engine.ts:16` | `export type NavigationDirection = 'forward' \| 'back' \| 'unknown';` | "Engine-answered because only the engine can know" (`:11`) |
| `engine.ts:22` | `export type ViewTransitionIntent = boolean \| { readonly types?: string[] };` | "Engines thread it through untouched" (`:20`) |
| `engine.ts:25` | `export interface EngineNavigation {` | "A navigation an engine hands to the router core." (`:24`) |
| `engine.ts:44` | `export interface EngineNavigateOptions {` | "A commit the router core asks an engine to perform." (`:43`) |
| `engine.ts:67` | `export interface EngineSink {` | "What an engine may ask of the router core." (`:66`) |
| `engine.ts:91` | `export interface NavigationEngine {` | "What the router core needs from a browser engine (ADR 0026 §9)" (`:86`) |

Plus, in `packages/router/src/router.ts`:

```ts
// router.ts:61
export type EngineOption = 'auto' | 'history' | 'navigation';

// router.ts:64-67
export interface RouterConnectOptions {
  readonly engine?: EngineOption;
  readonly viewTransitions?: RouterViewTransitions;
}

// router.ts:74
export function createEngine(option: EngineOption = 'auto'): NavigationEngine {
```

`Router` holds `private engine: NavigationEngine` (`router.ts:229`) and
`private readonly engineInjected: boolean` (`:231`, commented "An engine handed
in explicitly wins over any `defineRouter` preference"). Two more classes carry
the word — `HistoryEngine` (`packages/router/src/history-engine.ts`) and
`NavigationApiEngine` (`packages/router/src/navigation-engine.ts`) — and
`packages/router/src/index.ts:28` re-exports `engine.js` types on the router's
**public barrel**. The user-facing surface is
`defineRouter(catalog, { engine })`, declared at
`packages/router/src/application.ts:44` and applied at `:90`.

`AGENTS.md:90-97` documents it as a named architectural seam:

> - browser mechanics sit behind the `NavigationEngine` seam
>   (`HistoryEngine`, `NavigationApiEngine`), selected by
>   `defineRouter(catalog, { engine })` with `'auto'` the default. Matching,
>   signals, redirects, head reconciliation, and rendering stay
>   engine-independent, and any behavioural change must be proven on both
>   engines in three real browsers — `pnpm --filter @nisli/www
>   proof:router-navigation`. happy-dom has no layout and no native fragment
>   navigation, so the unit suite cannot see focus, scroll, or fragment bugs.

**The concrete cost.** One ordinary application file can legitimately contain
both `import { … } from '@nisli/engine'` and
`defineRouter(catalog, { engine: 'history' })`. In that file the word `engine`
denotes two unrelated systems, one of them a string-valued public option. Every
sentence of documentation, every error message and every repository search for
"engine" becomes ambiguous. "Any behavioural change must be proven on both
engines" (`AGENTS.md:94-95`) already means something specific, and it is not
this package.

**(b) Core's own template module.** `packages/core/src/index.ts:75` is a barrel
section header:

```ts
// ── Template engine ─────────────────────────────────────────────────
```

and `packages/core/src/template.ts:2` opens the module:

```
 * template.ts — Tagged template engine with targeted DOM binding
```

**(c) "Engine" meaning *browser* engine.** `packages/core/src/view-transition.ts:27`:

> Where `document.startViewTransition` is missing (no DOM at all, or an engine
> without the API) the update still applies …

`view-transition.ts:68` — "Does this engine accept
`startViewTransition({ update, types })`?"; `:71` — "Engines predating it take a
bare callback." And `packages/core/src/template.ts:1029`, inside the N107 error
message a *user* reads:

```ts
`html:inner cannot render sanitized() markup: this engine has no native ` +
`Element.setHTML() and no fallback is registered. …`
```

`packages/ssg/src/client.ts:29-30` — "without `document.prerendering` (every
non-Chromium engine)".

**Three distinct meanings of one word in one codebase, one of them public API
and one of them inside a thrown error string.** Adding `@nisli/engine` makes
four. That argument does not depend on taste.

One fair counter-point, recorded because it is the strongest thing *for* the
name: the C11 prototype itself uses "engine" in prose throughout —
`src/appearance/index.ts` ("the engine half of the C11 candidate"),
`src/theme/index.css` ("what the engine writes, never an author"),
`src/appearance/fit/dom.ts` ("the fixed engine"). The word *is* apt. It is also
already spent.

### `next` — the full collision list, for contrast

- `packages/ui/registry/default/ui/combobox.ts:20` — doc example using
  `value: 'next'` / `'Next.js'`; `combobox.test.ts:30, 235, 240, 246, 253, 259,
  293, 347` — the same demo strings.
- `packages/www/src/hydrate-examples/combobox.ts:9` and
  `packages/www/src/nisli-ui/ui/combobox.ts:20` — derived copies of the above.
- `docs/adr/0026-typed-application-router.md:673` — cites `vercel/next.js`
  source; `docs/adr/0031-atomic-dom-moves.md:254` — "React's crash in shipped
  products (React Aria, Next.js)".
- `packages/router/src/router.test.ts:291` and
  `packages/router/src/navigation-engine.test.ts:243` — route fixtures named
  `next: route('/next', …)`.
- `packages/router/src/vite.ts:24, 63, 69, 80` — the connect-style `next()`
  middleware callback.
- `packages/core/src/component.ts:460, 870` — parameters named `next`;
  `packages/core/src/template.ts:1307-1314` — `nextSibling`.
- **No `next` npm dependency anywhere**: a grep for `"next":` across package
  manifests returns no matches.

Every one is a local identifier or prose. **Nothing breaks.** `next` is *safe to
ship* and *wrong to choose*: it promises impermanence about a permanent peer,
and it shares mindshare with the most-downloaded React meta-framework, so
`from '@nisli/next'` is a coin flip for a reader.

### Plain verdict on the name

**Ship neither.** `@nisli/engine` is the worse of the two, because its collision
is in live public API rather than in prose. The ranked alternatives with
per-candidate collision searches are §8; the short answer is that
**`@nisli/intent` has the lightest collision footprint of every candidate
examined and is the only one that covers the whole charter** — appearance,
attention and declared state space are each a declaration of intent, whereas
`derive`, `resolve` and `system` each name only a mechanism and each already
means something specific in this repository.

---

## Files surveyed

| file | what it decides | verdict for the new package |
|---|---|---|
| `packages/core/package.json` | canonical manifest: dev `exports` → TS source, `publishConfig.exports` → `dist`, `files`, `repository.directory`, four scripts | copy wholesale; also proves core ships no CSS |
| `packages/core/src/index.ts` | the public barrel — every seam the peer may use | §6: no measurement, no layout hook, no code registry |
| `packages/core/src/diagnostics.ts` | the `codes` table (`:41`), owner ranges (`:42-48`), the dev probe, `isDev()` (`:96`), `setDevMode()` (`:104`) | §6: closed registry; `N6xx` owned by core; `N601` retired-never-reused |
| `packages/core/src/lifecycle.ts` | `onMount` / `onCleanup` / `useHostEvent` — the only auto-disposal seams | §6: `useHostEvent` is `EventTarget`-shaped; a `ResizeObserver` is not one |
| `packages/core/src/component.ts` | `SetupFunction` hands over the raw `host: HTMLElement` (`:105-108`); `customElements.define` at call time (`:773-774`); `setContextHook` (`:22-28`) | no subtree-walk seam is needed; `sideEffects: false` would be false |
| `packages/www/package.json` | a `packages/*` member that is `"private": true` (`:4`) and absent from the release matrix | **the private-landing precedent** |
| `packages/router/package.json` | `peerDependencies` (`:13-15`) + `devDependencies: workspace:*` (`:16-19`); three subpath exports (`:20-24`) | copy the dependency shape |
| `packages/router/src/engine.ts`, `router.ts`, `application.ts`, `index.ts` | `NavigationEngine` / `EngineSink` / `createEngine()` / `{ engine }` | **the name collision** (headline, §8) |
| `packages/ssg/package.json` | the only package with a runtime `dependencies` entry (`happy-dom`, `:19-21`) | precedent that a runtime dep is legal outside core |
| `packages/ui/package.json` + `registry/default/styles/theme.css` | the only package shipping non-`tsc` output (`"registry"`, `:43-49`) and the only one shipping CSS | **the mechanism that lets the theme ship** |
| `packages/*/tsconfig.build.json` | `outDir`, `declaration`, `sourceMap`, `noEmit: false`, exclusion lists | `router:9` excludes a test-double module — the `fakes.ts` precedent |
| `packages/*/tsconfig.json` | `lib`/`types` per package; core alone uses `"types": []` (`core/tsconfig.json:4`) | take core's row (browser-only), not ui's |
| `tsconfig.json` (root) | strict, ES2022, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `noEmitOnError` | inherited free; **no `paths`, no project references** — nothing to register |
| `pnpm-workspace.yaml` | `packages/*` and `experiments/*` globs | **no edit needed** — the new directory already matches |
| `package.json` (root) | `pnpm -r <script>` for build/typecheck/test/clean; `packageManager: pnpm@10.17.1` | **no edit needed** — recursive by construction |
| `.github/workflows/auto-tag.yml` | matrix (`:24-40`), tag prefixes, Node 24 (`:80`), `pnpm pack` + `npm publish *.tgz` (`:126-128`) | one 4-line matrix entry, public mode only; §3 |
| `.github/workflows/ci.yml` | toolchain check → install → build → browser previews → UI pack e2e → `pnpm test` | **has no size gate**; conditional edit for the geometry proof |
| `AGENTS.md` | "four independently versioned public packages" (`:5`), package architecture (`:80-127`), publishing invariants (`:129-140`), the 404 pattern (`:142-152`) | up to four edits, one file |
| `README.md` (`:200-209`) / `packages/core/README.md` (`:253-264`) | the two ecosystem lists | public mode only; the Repository-shape rule requires they stay aligned |
| `docs/adr/0030.2-*.md:286-289, :314-317, :319-331, :333-336` | the 10KB ceiling, the *proposed* `@nisli/core/devtools` entry, the ≤15-statement barrel cap, the new-package rule | the four rules governing this slice |
| `docs/adr/0025-core-proposals-from-ui.md:4` | "Open (tracker — items graduate to their own ADRs when accepted)" | the existing mechanism for a downstream package changing core |
| `docs/issues/README.md` | a 21-row status table: `open` / `resolved` / `wont-fix` + priority | the second in-repo status vocabulary |
| `packages/ui/NORTH-STAR.md` | Vision / Tenets / Invariants; the only package with one | a permanent peer wants one |
| `experiments/c11-appearance/**` | 45 source files, 5 CSS files, 6 test files, 2 proof scripts, 1 harness page, 248 images | destination-mapped in §5 |

---

## What each one actually does

### 1. Package anatomy — the exact pattern, then the filled-in manifest

#### 1.1 The invariant every sibling holds

**Dev exports point at TypeScript source; published exports point at `dist`** —
stated as law in `AGENTS.md:80-81`: "Development exports point at TypeScript
source. Published exports point at built files through `publishConfig`."
Concretely (`packages/core/package.json:20-40`):

```json
"exports": {
  ".": "./src/index.ts",
  "./vite-hmr": "./src/vite-hmr/plugin.ts",
  "./vite-hmr/runtime": "./src/vite-hmr/runtime.ts"
},
"publishConfig": {
  "exports": {
    ".":                  { "types": "./dist/index.d.ts",            "default": "./dist/index.js" },
    "./vite-hmr":         { "types": "./dist/vite-hmr/plugin.d.ts",  "default": "./dist/vite-hmr/plugin.js" },
    "./vite-hmr/runtime": { "types": "./dist/vite-hmr/runtime.d.ts", "default": "./dist/vite-hmr/runtime.js" }
  }
}
```

Four load-bearing details, each verified in all four manifests:

- **The dev form is a bare string, not a conditions object** (`core:21`,
  `router:21`, `ssg:30`, `ui:33`). No `types` condition is needed because the
  target *is* the `.ts` file.
- **`types` precedes `default` in every published entry** (`core:28-29, 32-33,
  36-37`; `router:28-29, 32-33, 36-37`; `ssg:36-37, 40-41`; `ui:38-39`). Export
  conditions resolve in declaration order, so `default` first would shadow
  `types` and TypeScript would never see the `.d.ts`.
- **`publishConfig.exports` replaces the whole `exports` object.** Every subpath
  must be repeated: `ssg` has two and lists two; `core` and `router` have three
  and list three. Omit one and the tarball silently ships a `./src/*.ts` path.
- **`publishConfig` only applies through `pnpm pack`**, which is why publishing
  is two commands (`auto-tag.yml:126-128`) under a five-line comment recording
  the `@nisli/core@0.48.0` regression (`:120-125`): "switching to plain
  `npm publish` shipped exports pointing at ./src/index.ts, which is not
  included in the tarball."

**Subpath naming.** Existing subpaths are named for the *environment or
consumer*, never for internal file layout: `@nisli/core/vite-hmr`,
`@nisli/router/catalog` ("the environment-neutral, side-effect-free
catalog/matcher surface for shared packages and Workers", `AGENTS.md:88-90`),
`@nisli/router/vite`, `@nisli/ssg/client` (which "must stay dependency-free and
DOM-optional", `AGENTS.md:106-107`). Each exists because a *different runtime*
needs a *smaller graph*. That is exactly the case for a `./devtools` subpath:
the ten diagnostic rules, the runner, the code registry, the report formatter
and `explain()` are dev weight and must not sit in the production graph. Note
this would be the **first implementation of a pattern core has only proposed** —
`docs/adr/0030.2:314-317` describes "the introspection global as a
`@nisli/core/devtools` subpath entry (zero bytes in `.`)", that ADR is
`Status: Proposed` (`:4`), and `packages/core/package.json:20-24` has no such
entry today.

**`files`.** Three of four ship `["dist","README.md","LICENSE"]` verbatim
(`core:44-48`, `router:41`, `ssg:45-49`). `ui` is the exception that matters
(`packages/ui/package.json:43-49`):

```json
"files": ["dist", "registry", "!registry/**/*.test.ts", "README.md", "LICENSE"]
```

— a raw source directory plus a negated glob keeping tests out of the tarball.
Every package has a real `LICENSE` file on disk
(`packages/{core,router,ssg,ui}/LICENSE`, plus a repo-root `LICENSE`), so the
new package needs one copied in.

**`repository.directory`.** Identical in all four (`core:7-11`, `router:7-11`,
`ssg:7-11`, `ui:7-11`): `url` is always `https://github.com/gkoreli/nisli.git`
and `directory` is always `packages/<name>`. `AGENTS.md:139-140` makes it a
publishing invariant and `AGENTS.md:147-148` names wrong repository metadata as
one of the four things to check when npm returns the misleading 404.

**`sideEffects`.** **No package in this repository declares it** — a grep over
`packages/` returns nothing. Do not add it, and specifically do not add
`"sideEffects": false`: `component()` calls
`customElements.define(tagName, FrameworkComponent)` at call time
(`packages/core/src/component.ts:773-774`), so any module that defines a
component at top level is side-effectful by construction, and a CSS entry point
is side-effectful by definition. Claiming otherwise invites a bundler to drop
the custom-element registrations.

**`peerDependencies` vs `dependencies`.** Three of four use the same pair —
`peerDependencies: { "@nisli/core": ">=0.4x/0.5x.0" }` plus
`devDependencies: { "@nisli/core": "workspace:*" }` (`router:13-19`; `ssg:22-27`;
`ui:24-30`) — with the floor tracking the core version that introduced what the
package needs. Core is at `0.55.0` (`packages/core/package.json:3`). Only
`@nisli/ssg` has a true runtime `dependencies` entry (`happy-dom`, `ssg:19-21`),
so a runtime dependency is permitted outside core, but the population is one.

#### 1.2 The filled-in manifest — public mode

Written with `@nisli/intent` per §8's ranking; substituting any other leaf name
changes exactly three lines (`name`, `repository.directory`, and the directory
on disk).

```json
{
  "name": "@nisli/intent",
  "version": "0.1.0",
  "description": "Appearance derived from declared meaning and context. Components declare what a thing is, how it composes, and what matters least; a resolution table and a measured fit pass derive every value, and the derived checks assert the result.",
  "type": "module",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/gkoreli/nisli.git",
    "directory": "packages/intent"
  },
  "keywords": [
    "nisli",
    "web-components",
    "design-system",
    "appearance",
    "layout",
    "container-queries",
    "accessibility"
  ],
  "peerDependencies": {
    "@nisli/core": ">=0.55.0"
  },
  "devDependencies": {
    "@nisli/core": "workspace:*",
    "playwright": "1.61.1"
  },
  "exports": {
    ".": "./src/index.ts",
    "./devtools": "./src/devtools.ts",
    "./theme.css": "./theme/index.css"
  },
  "publishConfig": {
    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "./devtools": {
        "types": "./dist/devtools.d.ts",
        "default": "./dist/devtools.js"
      },
      "./theme.css": "./theme/index.css"
    }
  },
  "files": [
    "dist",
    "theme",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist",
    "proof:geometry": "node scripts/geometry-proof.mjs",
    "proof:geometry:self-test": "node scripts/geometry-proof.mjs --self-test",
    "lint:values": "node scripts/no-values-guard.mjs"
  }
}
```

**Every field, and the sibling it was copied from:**

| field | copied from | why |
|---|---|---|
| `name` | the scope of all four | `@nisli/*`; §8 ranks the leaf |
| `version: "0.1.0"` | `ui` is `0.4.1` (`ui:3`), `ssg` `0.4.0` (`ssg:3`) | pre-1.0 like every sibling; the first tag becomes `<prefix>-v0.1.0` |
| `description` | all four carry one | it is the npm subtitle; `ssg:5` is the shortest model |
| `type: "module"` | `core:5`, `router:5`, `ssg:5`, `ui:5` | ESM-only repo; root tsconfig is `module: ES2022` |
| `license: "MIT"` | `core:6` and siblings | plus a copied `LICENSE`, which `files` ships |
| `repository` (3 keys) | `core:7-11` | `AGENTS.md:139-140` invariant; wrong metadata is a named 404 cause (`:144-148`) |
| `keywords` | `ui:12-20` (7 entries) | discovery only; `router:12` shows a 5-entry inline array is equally acceptable |
| `peerDependencies: ">=0.55.0"` | `router:13-15`, `ui:24-26`, `ssg:22-24` | core is 0.55.0 (`core:3`); the package uses `createContext`, `children`, `ref`, `useHostEvent` — all present today. **Raise this floor the moment any §6 seam lands** |
| `devDependencies["@nisli/core"]: "workspace:*"` | `router:17`, `ssg:26`, `ui:28` | the peer must resolve inside the workspace |
| `devDependencies["playwright"]: "1.61.1"` | `packages/www/package.json` and `experiments/c11-appearance/package.json` both pin exactly `1.61.1` | the geometry proof needs it; both existing users pin exactly, not with a caret |
| **no `@types/node`** | deviates from `core:42` / `router:18` | the domain imports no node builtin, and `tsconfig.json` will carry `"types": []` like `packages/core/tsconfig.json:4`. Add it only if a `scripts/*.mjs` is ever typechecked |
| **no `dependencies`** | `core`, `router`, `ui` have none | the package imports nothing outside core; `ssg:19-21` shows one would be legal, not that one is wanted |
| **no `sideEffects`** | absent repo-wide | it would be actively false (`component.ts:773-774`) |
| **no `bin`** | `ui:21-23` is the only `bin` | no CLI. If one is added, note `ui`'s `bin` points at `./dist/cli.js` even in dev, unlike `exports` |
| `exports["."]` | `core:21` | runtime surface: vocabulary, fit solver, the `fit()` lifecycle binding |
| `exports["./devtools"]` | `@nisli/ssg/client` (`ssg:31`), `@nisli/router/catalog` (`router:22`), and the *proposal* at `docs/adr/0030.2:314-317` | keeps ten rules, the runner, the code registry, the report formatter and `explain()` out of the production graph |
| `exports["./theme.css"]` | mechanism from `ui:45` (`"registry"` in `files`); **no sibling exports CSS today** | `tsc` emits no CSS, so the theme is a raw shipped directory. A bare string, not a conditions object — CSS has no `types` |
| `publishConfig.exports` | `core:25-40` | full replacement; `types` before `default`; the CSS entry is byte-identical dev and published because it is never compiled |
| `files` | `core:44-48` plus `ui:45` | `theme` is the `registry` analogue; no `!` negation is needed while nothing under `theme/` is a test |
| `scripts.build/test/typecheck/clean` | `core:50-53` verbatim | these four names are exactly what `pnpm -r` dispatches (root `package.json:3-7`) |
| `scripts.proof:*`, `lint:values` | `ui:55-72` (`e2e:*`), `www` (`proof:*`) | browser proofs are named-but-ungated scripts, invoked explicitly from `ci.yml` |

#### 1.3 Private mode — the two-line diff

If the first landing should not be a release event (which `docs/adr/0030.2:333-336`
effectively demands, and which §8's name question independently argues for), add
`"private": true` and delete `publishConfig`, following
`packages/www/package.json:4`. A private `packages/*` member still gets
`pnpm build`, `pnpm test` and `pnpm typecheck` for free, still resolves
`workspace:*` links, and is simply never named by the release matrix
(`auto-tag.yml:24-40` lists four packages; `www` is the fifth workspace member
and is absent). `files`/`publishConfig` can be added later, in the same commit
that adds the matrix entry — which is precisely "deliberate and sequenced".

### 2. Build and config

**`tsconfig.build.json`** is near-identical in all four:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "dist", "declaration": true, "sourceMap": true, "noEmit": false },
  "exclude": ["src/**/*.test.ts", "src/**/*.test-d.ts"]
}
```

(`packages/core/tsconfig.build.json` verbatim; `ssg` identical; `ui` adds
`"include": ["src/**/*.ts"]` to escape its wider dev include; **`router:9` adds
one more exclusion — `"src/navigation-double.ts"`**, a test-double module that
must not reach `dist`). That router line is the precedent the new package needs:
the C11 test doubles (`test/fakes.ts`, 405 lines) must be excluded explicitly,
because the default exclude list only covers `*.test.ts` / `*.test-d.ts` and a
file called `fakes.ts` would otherwise be compiled, typed and published.

**`tsconfig.json` per package** extends the root and differs only in
`lib` / `types` / `include` / `exclude`:

| package | `lib` | `types` | `include` | `exclude` |
|---|---|---|---|---|
| core | `ES2022, ESNext.Disposable, DOM, DOM.Iterable` | `[]` | `src/**/*.ts` | `src/**/*.test.ts` |
| router | `ES2022, DOM, DOM.Iterable` | `["node"]` | `src/**/*.ts` | — |
| ssg | `ES2022, DOM, DOM.Iterable` | `["node"]` | `src/**/*.ts` | — |
| ui | `ES2022, DOM, DOM.Iterable` | `["node"]` | `src`, `registry`, `demo` | `[]` |

All four also set `declaration: false` and `sourceMap: false` here, which
`tsconfig.build.json` re-enables — so `tsc --noEmit` stays cheap and only the
build emits. The new package should take **core's row**: `"types": []` and tests
excluded from `tsc --noEmit`, because it is browser-only and imports no node
builtin. The consequence is real and should be a conscious choice: core's test
files are typechecked only by vitest at runtime, never by `pnpm typecheck`. `ui`
made the opposite call with `"exclude": []`.

**Root `tsconfig.json`** carries the whole strictness contract — `strict`,
`verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `noEmitOnError`,
`moduleResolution: "bundler"`, `target`/`module` `ES2022`, `lib`
`["ES2022", "ESNext.Disposable"]`. There are **no `paths` mappings and no project
references**, so a new package registers nothing anywhere: it is found through
the pnpm workspace symlink and its own `exports` map. This is also why
`experiments/c11-appearance/vite.config.mjs` needs no alias, and says so: "No
alias needed: `@nisli/core` is a workspace dependency and its development export
map points straight at TypeScript source."

One inherited constraint to plan around: `lib` is ES2022, and the C11 harness
already hit it — `src/app/main.ts` documents "`new Promise(requestAnimationFrame)`
rather than `Promise.withResolvers`: the repo compiles against lib ES2022, where
withResolvers does not exist."

**Scripts.** All four packages define exactly `build` / `test` / `typecheck` /
`clean` with identical bodies, except `router:44` which runs
`vitest run --typecheck` because it ships `*.test-d.ts` type tests. Root
`package.json:3-7` maps each root gate to `pnpm -r <name>`, and pnpm **skips
packages that do not define the script** — the mechanism `experiments/README.md`
relies on to keep prototypes out of the gates ("An experiment defines **only** a
`dev`-style script … so `pnpm build`, `pnpm test` and `pnpm typecheck` never see
this directory").

**`pnpm-workspace.yaml`** is two globs, `packages/*` and `experiments/*`. The
new directory matches the first with **no edit**. One measurable consequence:
`pnpm typecheck` currently reports "Scope: 6 of 7 workspace projects"
(`experiments/c11-appearance/README.md`, "Packaging") — the root plus five
`packages/*` members, skipping the one experiment. Adding the new package makes
that 7 of 8; deleting the experiment in the same change makes it 7 of 7.

### 3. The publishing matrix — exactly what must change

The workflow triggers on push to `main`, restricted to manifest changes
(`auto-tag.yml:3-8`):

```yaml
on:
  push:
    branches:
      - main
    paths:
      - 'packages/*/package.json'
```

So **a new package's manifest is itself the release trigger** — the exact hazard
`docs/adr/0030.2:333-336` warns about. `concurrency: group: publish,
cancel-in-progress: false` (`:10-12`) serialises runs and
`permissions: id-token: write` (`:16`) is already present for OIDC; neither
needs changing.

**The one edit: a fifth matrix entry.** `auto-tag.yml:24-40` lists four entries
of four lines each. Insert after `:40`:

```yaml
          - name: '@nisli/intent'
            dir: packages/intent
            tag-prefix: intent
            trusted-publisher: false
```

`fail-fast: false` (`:22-23`) keeps the five jobs independent. `tag-prefix`
produces the tag, built at `:52`:
`TAG="${{ matrix.package.tag-prefix }}-v$CURRENT_VERSION"`.

**Why `trusted-publisher: false` on the first landing.** The workflow already
models a package that exists in the repo but not yet on npm (`:55-60`):

```yaml
          if [ "${{ matrix.package.trusted-publisher }}" != "true" ]; then
            echo "changed=false" >> $GITHUB_OUTPUT
            echo "::notice title=$PACKAGE_NAME publish SKIPPED::npm Trusted Publisher not configured yet (ADR 0026, pending). Set trusted-publisher: true in auto-tag.yml once it exists. Version $CURRENT_VERSION remains unpublished by design."
```

That is the repo's own rule — "A known-blocked job must skip loudly with a
reason, never remain red as normal" (`AGENTS.md`, Worktree discipline) —
expressed in YAML. Flip it to `true` in a second commit once the npm Trusted
Publisher exists. It is also the mechanism that keeps the **name reversible**
while the decision is made (§8).

**The failure mode if that step is skipped** (`auto-tag.yml:64-69`):

```yaml
          elif git rev-parse "$TAG" >/dev/null 2>&1; then
            echo "Tag $TAG exists but $PACKAGE_NAME@$CURRENT_VERSION is not on npm"
            echo "Delete the failed release/tag before retrying this version:"
            echo "gh release delete $TAG --cleanup-tag --yes"
            exit 1
```

Because the tag and release are created at `:100-115` — *before* the publish step
at `:117-128` — a publish failure strands the tag and every retry of that
version hard-fails until it is deleted. `AGENTS.md:149-152` records the same in
prose with the remedy: `gh release delete <package>-vX.Y.Z --cleanup-tag --yes`.

**The misleading 404.** `AGENTS.md:144-148`: "npm may return a misleading
scoped-package `404 Not Found` on publish. This usually means a Trusted
Publisher identity mismatch rather than a missing package. Check the workflow
filename, package repository metadata, Node/npm versions, and that package's
Trusted Publisher settings." For a brand-new scoped package this is *especially*
dangerous, because 404 is also what a genuinely-unpublished name returns — so
the operator cannot distinguish "first publish, identity misconfigured" from
"first publish, working as intended" by the error alone. `AGENTS.md:133`: "npm
Trusted Publisher must name `auto-tag.yml` for every public package" — it is a
per-package setting on npmjs.com, not a repo setting, and it must name this
workflow file.

**Version pins, unchanged.** `actions/setup-node@v4` with `node-version: '24'`
(`:80`) plus `npm install -g npm@latest` (`:96-98`) — `AGENTS.md:134`: "Keep Node
`24` and `npm install -g npm@latest` for OIDC publishing." This is deliberately
a different Node than CI, which pins `22` (`ci.yml:25`, `:60`) and which
`mise.toml` mirrors as the floor (`node = "22"`, commented "node matches the
floor of the CI matrix (.github/workflows runs 22 and 24)").
`scripts/check-toolchain.mjs` reads every `node-version:` across
`.github/workflows/` and asserts `mise.toml`'s node equals the **minimum**. A
new matrix *entry* adds no `node-version:` line, so the toolchain check is
unaffected — but adding a Node version anywhere in a workflow would break it.

**The publish sequence** (`:117-128`), which must not be simplified:

```yaml
      - name: Publish package to npm
        if: steps.version.outputs.changed == 'true'
        run: |
          # pnpm pack honors publishConfig.exports (rewrites exports -> dist
          # form in the tarball); plain `npm publish` does NOT. ...
          cd "${{ matrix.package.dir }}"
          pnpm pack
          npm publish *.tgz --provenance --access public
```

`--access public` is required for a scoped package's first publish.
`AGENTS.md:135-138` restates both the rule and the reason.

**A coupling cost worth naming.** Every matrix job runs the *repository-wide*
gates before publishing: `pnpm install --frozen-lockfile` (`:84-86`),
`pnpm build` (`:88-90`), `pnpm test` (`:92-94`). Since `pnpm test` is
`pnpm -r test`, **a failing test in the new package blocks core's, router's,
ssg's and ui's releases**, and a slow suite slows all five. Adding a fifth
package is not free at release time even when nothing about it changed.

**Release checklist** (`AGENTS.md`, Release checklist): bump only the intended
`packages/<name>/package.json` and update its changelog; confirm the version is
free with `npm view @nisli/<name>@0.1.0 version` (`E404 No match found for
version` means available); run `pnpm build`, `pnpm test`, `pnpm typecheck`; push
and watch with `gh run list --workflow auto-tag.yml --limit 5` and
`gh run watch <run-id> --exit-status`; confirm with
`npm view @nisli/<name> version repository --json`.

### 4. Cross-package dependency rules

**May the new package depend on `@nisli/core`? Yes — as a peer.** Three-for-three
precedent: `router:13-19`, `ssg:22-27`, `ui:24-30` all pair `peerDependencies`
with `devDependencies: { "@nisli/core": "workspace:*" }`. The peer shape is not
cosmetic: core registers custom elements at module evaluation
(`component.ts:773-774`), so two resolved copies of core in one tree would mean
two definition registries for the same tag names. ADR 0030.2 records that this
is already a live hazard — "the copy-in model makes genuine duplicate registries
structural (this repo itself carries two)" (`:467-471`). A `dependencies` entry
on core would manufacture a third.

**Must core change for the C11 domain to land? No — for hosting.** Verified by
enumerating every core import across `experiments/c11-appearance/src/**`:
`children`, `component`, `ComponentAttrs`, `computed`, `createContext`, `each`,
`flush`, `html`, `onCleanup`, `onMount`, `ReadonlySignal`, `ref`, `signal`,
`TemplateResult`, `useHostEvent`, `when`. Every one is exported from
`packages/core/src/index.ts` (Reactivity; Subtree-scoped context; Component
model; Template engine at `:75`; Element refs; Lifecycle hooks; Content
projection at `:107`). A grep for `@nisli/core/` across the whole experiment
returns **no matches** — no deep imports into core internals. The prototype's
architecture note says this was deliberate: "if this graduates into @nisli/core,
the domain moves unchanged and only the adapters are reviewed for byte cost"
(`src/appearance/contracts.ts` module doc).

**Must core change for the package to be *good*? Yes — four seams.** §6, and it
is the bidirectional half.

**What core must never do.** `AGENTS.md:82-83`: "`@nisli/core` owns component
authoring and the browser runtime. It **must stay free of runtime dependencies
and static-build policy**." So the arrow only ever points peer → core;
`packages/core/package.json` must never gain a `dependencies` or
`peerDependencies` entry naming the new package. ADR 0017 (Accepted) fixed this
at extraction: "**Zero dependencies** — pure TypeScript, no npm packages" and
"**Single barrel export**". ADR 0022 restates the ethos for copied registry
source (`:246-249`).

**And what the code must never do.** `experiments/README.md`: "**No package
imports from here, ever.** Dependencies point one way: experiments may depend on
`packages/*`; `packages/*` must never reference `experiments/*`." The C11 code
must be **moved**, never referenced — no relative import into `experiments/`, no
tsconfig path alias to it.

**Two budgets the new package must respect indirectly.**
`docs/adr/0030.2:319-331`: "`src/index.ts` holds **12 export statements**
today … **Ceiling: the source barrel stays ≤ 15 export statements after all Tier
1+2 work**, checked in CI alongside the llms-core token budget." And `:286-289`:
"adopt a CI-enforced ceiling — `@nisli/core` stays under **10KB min+gzip**
(8.8KB today)". Both are *proposals* — that ADR is `Status: Proposed` (`:4`),
and `ci.yml` contains neither a size step nor an export-count step. But any §6
seam landing in core spends against both, so the asks below are deliberately
small and two of them cost zero statements on the `.` entry.

### 5. What the C11 experiment becomes — the destination map

Every path under `experiments/c11-appearance/`, with its destination and the
rule that decides it. "pkg" means `packages/<new-name>/`.

| source path | DESTINATION | rule that decides it |
|---|---|---|
| `src/appearance/contracts.ts` | **pkg** `src/contracts.ts` | Types + the closed vocabulary; its module doc: "NOTHING in this file imports anything." Zero-dependency, DOM-free — core-shaped in every respect and the natural first graduation candidate if that ever happens. |
| `src/appearance/index.ts` | **pkg** `src/index.ts` | `AGENTS.md`, Core framework work: "Keep `index.ts` files as barrel exports only." It already is one. |
| `src/appearance/fit/candidates.ts` | **pkg** `src/fit/candidates.ts` | Pure domain: orders candidates by `Priority`. No DOM, no core import. Core-shaped. |
| `src/appearance/fit/strategies.ts` | **pkg** `src/fit/strategies.ts` | Pure domain (`allowsShrink`, `needsAffordance`, `truncationDegenerate`). Core-shaped. |
| `src/appearance/fit/solver.ts` | **pkg** `src/fit/solver.ts` | Pure domain — `solveFit(container, candidates, metrics, mutator)` over the ports. The experiment measures `solve()` + `fit()` at "~35 lines including lifecycle" (README F2). Core-shaped. |
| `src/appearance/fit/dom.ts` | **pkg** `src/fit/dom.ts` | The only DOM reader/writer for fit (`clientWidth`/`scrollWidth`/`getComputedStyle`; the `data-truncate`/`data-hidden`/`data-collapsed` writes). Zero-dependency, so nominally core-shaped — but core contains **no** measurement API at all (§6), so this is precisely the code core has deliberately never had. Keep it here. |
| `src/appearance/fit/observe.ts` | **pkg** `src/fit/observe.ts` | Binds the solver to core lifecycle: `onMount`/`onCleanup` plus a hand-rolled `ResizeObserver`. Seam 1 in §6. |
| `src/appearance/diagnostics/codes.ts` | **pkg** `src/diagnostics/codes.ts`, behind `./devtools` — **renumbered** | Dev-only weight → the `ssg/client` / proposed `core/devtools` pattern (`docs/adr/0030.2:314-317`). Renumbering is **not optional**: §6 seam 3. |
| `src/appearance/diagnostics/runner.ts` | **pkg** `src/diagnostics/runner.ts`, behind `./devtools` | Dev-only weight. |
| `src/appearance/diagnostics/report.ts` | **pkg** `src/diagnostics/report.ts`, behind `./devtools` | Dev-only formatting (`formatFindings`, `summarize`). |
| `src/appearance/diagnostics/admitted.ts` | **pkg** `src/diagnostics/admitted.ts`, behind `./devtools` | Dev-only. |
| `src/appearance/diagnostics/dom.ts` | **pkg** `src/diagnostics/dom.ts`, behind `./devtools` | "the ONLY DOM reader in the diagnostics half" (module doc). Untestable under happy-dom (§7). |
| `src/appearance/diagnostics/rules/*.ts` — `contrast`, `crushed`, `escaped`, `fit-state`, `hit-target`, `overlap`, `shredded`, `truncation`, `viewport`, `vocabulary` (10) + `index.ts` | **pkg** `src/diagnostics/rules/*`, behind `./devtools` | Pure functions over the `Inspector` port; the module doc notes `grep 'document\.\|window\.\|getComputedStyle' rules/*.ts` returns nothing. Dev weight, but the cleanest code in the prototype. |
| `src/appearance/explain.ts` | **pkg** `src/devtools.ts` (or re-exported from it) | "provenance, dev-only in spirit" (`src/appearance/index.ts` module doc). ADR 0030.1 B6 already demoted introspection on evidence ("React/Vue devtools protocols saw ~zero agent uptake"), so it must not cost bytes in `.`. |
| `src/theme/index.css`, `tokens.css`, `structure.css`, `roles.css`, `states.css` | **pkg** `theme/*.css` — package **root**, not `src/` | `files` never includes `src`, and `tsc -p tsconfig.build.json` emits no CSS. Only shipping precedent: `packages/ui/package.json:43-49`. **Cannot ever go to core** (`packages/core/package.json:44-48`, `:50`, `:20-24`). The layering comment in `index.css` (tokens → structure → roles → states, "the order is the dependency direction") must survive intact — CSS source order is load-bearing here. |
| `src/ui/index.ts` + `primitives/{avatar,button,escaped,field,nav-item,region,surface,text}.ts` (8) + `patterns/{data-table,hero,message-row,overflow-menu,toolbar}.ts` (5) | **CONTESTED** — pkg, or the `@nisli/ui` registry | `AGENTS.md`, Package architecture: "`@nisli/ui` is a registry plus the `nisli-ui` CLI, **not an importable runtime component library**. Components ship as copyable source under `registry/`; only the CLI is compiled to `dist` (ADR 0022 and `packages/ui/NORTH-STAR.md`)." See the note below. |
| `src/app/main.ts` | **nowhere** (or a `packages/www` demo) | Harness entry. Carries `/// <reference types="vite/client" />` and installs `window.__c11`, which its own doc calls "a development affordance, **not a product API**". |
| `src/app/shell.ts`, `src/app/state.ts` | **nowhere** (or a `packages/www` demo) | The context harness: density/input/theme/width switchers and the simulated viewport. Demo chrome. |
| `src/app/pages/{inbox,settings,data,marketing}.ts` | **nowhere** (or a `packages/www` showcase) | Four demo pages. `AGENTS.md`: `packages/www` is "the private nisli.dev application … and end-to-end integration surface"; ADR 0024 is the showcase-site decision. |
| `src/appearance.ts` | **nowhere — dead code** | The v1 monolith. `index.html` loads `./src/app/main.ts`; the only importers of `./appearance.js` are `src/app.ts` (itself dead) and `src/components.ts`. |
| `src/components.ts` | **nowhere — dead code** | v1 monolith superseded by `src/ui/**`. Only `src/app.ts` imports it. |
| `src/app.ts` | **nowhere — dead code** | v1 harness superseded by `src/app/main.ts`. Nothing imports it. |
| `test/fakes.ts` | **pkg** `src/testing/fakes.ts` **plus an explicit `tsconfig.build.json` exclusion** | `AGENTS.md`, Core framework work: "Tests live beside source in `packages/core/src`." But the build excludes only `*.test.ts`/`*.test-d.ts`, so `fakes.ts` would be published — use the `packages/router/tsconfig.build.json:9` precedent. |
| `test/solver.test.ts`, `strategies.test.ts`, `candidates.test.ts`, `diagnostics.test.ts`, `overflow-menu.test.ts` | **pkg**, beside their sources under `src/**` | Same rule; `packages/ui` likewise puts registry tests beside copied source. 78 domain tests today. |
| `vitest.config.ts` | **pkg** `vitest.config.ts`, rewritten | Today it deliberately avoids the script name `test` to stay out of the gates; in a package it must be `test`, with `globals: true, environment: 'happy-dom'` matching `packages/core/vitest.config.ts`. |
| `proof/geometry-proof.mjs` | **pkg** `scripts/geometry-proof.mjs` | Precedent: `packages/ui/scripts/*.mjs`, `packages/www/scripts/*.mjs`. Needs Chromium, so it can never be part of `pnpm test` (§7). Keep `--self-test`. |
| `proof/no-values-guard.mjs` | **pkg** `scripts/no-values-guard.mjs`, **rewritten** | Its `SCANNED` roots are `['src/ui','src/app','src/appearance']` and `THEME` is `'src/theme'`; all four move. Its two-entry allowlist must be re-argued — `src/app/state.ts` disappears with the harness, and `src/ui/primitives/escaped.ts` only survives if `src/ui` does. Its own comment: "the moment this list grows a third the bet needs re-arguing, not a new entry." |
| `proof/*.webp` + `proof/inbox-320.png` (8 curated) | `docs/worklists/nextgen/` or `pkg/docs/` — **never in `files`** | They are evidence, not artefacts. |
| `proof/shots/*.png` (240 generated) | **nowhere**, and a `.gitignore` rule is required first | See the correction below. |
| `index.html` | **nowhere** | Its own inline comment: "HARNESS CHROME ONLY … nothing in this block may reach into it." |
| `vite.config.mjs` | **nowhere** | Dev-server config for the harness (port 5199). A `packages/www` demo brings its own. |
| `package.json` | **nowhere** — replaced by §1.2 | A private experiment manifest with `dev`/`verify`/`proof`/`lint:values` only. |
| `README.md` | **split**: usage → `pkg/README.md`; findings F1–F11 → the new ADR | `AGENTS.md`, Repository shape: "Package-specific usage belongs in each package README. Architecture decisions belong in `docs/adr`." |

**On `src/ui/` — the one placement I cannot decide from the repo alone.** The
rule that bites is `AGENTS.md`, Package architecture: `@nisli/ui` "is a registry
plus the `nisli-ui` CLI, **not an importable runtime component library**", citing
ADR 0022 (Accepted). A package that exports `Button`, `Field`, `Toolbar` and
`DataTable` as importable factories does precisely the thing this repo decided
not to do — so the repository would hold two contradictory answers to "how do
nisli components reach a consumer?", and the second one would have been reached
without the argument that produced the first. Two coherent resolutions, each
with a real cost: (a) ship the primitives as new `@nisli/ui` registry items —
obeys 0022, but then the exclusivity guard must run over
`packages/ui/registry/**`, and copy-in means a consumer can delete the
exclusivity on day one; (b) keep them in the new package as importable
proof-of-vocabulary components — keeps the guard meaningful, contradicts 0022.
Note the experiment's own weighting says the primitives are **not** the bet:
table ~40%, exclusivity ~25%, vocabulary ~20%, verification ~10%, measured fit
~5%. Raised as open question 2.

**Correction to the experiment's own README.** It states "`proof/shots/` is
gitignored: a run writes 240 screenshots that are stale immediately." That does
not hold in the tree as read. The root `.gitignore` has eight entries
(`node_modules/`, `dist/`, `*.tsbuildinfo`, `*.log`, `.DS_Store`, `.env`, a
comment, `.hmr-build-test-*/`), none of which match, and there is **no nested
`.gitignore` anywhere under `experiments/` or `packages/`** (glob with hidden
files included and gitignore disabled: no files found). A gitignore-respecting
glob lists all 240 PNGs. Add a real ignore rule **before** any of this moves
under `packages/`.

### 6. Extension seams — what core offers today vs what the C11 engine needed

The module layering is fixed by `docs/adr/0030.2` §7: "The dependency direction
is `signal.ts → template.ts → component.ts` (component imports signal, template,
context, lifecycle, ref)", with "a new leaf `diagnostics.ts` importable by every
layer without cycles" and `settle()` as "a top-layer leaf (`settle.ts`)". Every
proposal below respects that direction; none inverts an edge, and none makes
core import the peer.

**What core already offers, all of which C11 used:**

- `onMount(cb)` / `onCleanup(cb)` — `packages/core/src/lifecycle.ts`. Both throw
  if called outside synchronous setup (the `hasContext()` guard).
  `fit/observe.ts` uses both, and its comment records paying for the rule:
  "Registering `onCleanup` from inside the `onMount` callback throws N402 —
  nisli's own diagnostics caught exactly that while this experiment was being
  written (F6)."
- `useHostEvent(target, eventName, handler)` — `lifecycle.ts`. The only
  auto-disposed subscription primitive.
- `getCurrentComponent().addDisposer(fn)` — public via the barrel
  (`ComponentHost` is `{ addDisposer, element }`, `context.ts:19-24`;
  implementation `component.ts:258`), and `@nisli/router` already uses it
  (`application.ts:93`).
- `component(tag, setup, { attrs })` handing setup the raw `host: HTMLElement`
  (`component.ts:105-108`); `children()`, `ref`, `el`, `when`, `each`,
  `createContext`, `computed`, `signal`, `flush`.
- `setDevMode(on)` — `packages/core/src/index.ts:141`.

**Seam 1 (weakest ask) — a disposal shape that fits an observer.**
Core contains **no measurement API whatsoever**: a grep for
`ResizeObserver|IntersectionObserver|MutationObserver|requestAnimationFrame|getBoundingClientRect|getComputedStyle`
across `packages/core/src` returns **no matches**. Core is layout-blind by
construction. So `fit/observe.ts` hand-rolls `new ResizeObserver(...)`, observes
each `[data-fit]` container in `onMount` and disconnects in `onCleanup`.
`useHostEvent` cannot help — it is `EventTarget`-shaped and a `ResizeObserver` is
not an `EventTarget`. *What is missing* is a setup-scoped disposable
registration: `useDisposable(d)` accepting `{ disconnect(): void }` or a thunk.
It would land in `lifecycle.ts`, which already owns auto-disposal and imports
only `context.js`. **But be honest: this seam half-exists** —
`getCurrentComponent().addDisposer(() => o.disconnect())` already does the job
and is already public. The real ask is documentation, not API. Do **not** ask
core to contain `ResizeObserver` itself: that is layout policy, it spends bytes
against ~1.2KB of headroom, and it is exactly what `AGENTS.md:82-83` keeps out.

**Seam 2 (strongest ask) — post-layout quiescence.** Core exports `flush`,
`tick`, `flushEffects` and `settle()` — all *reactivity* quiescence. **Nothing
in core can say "layout is final."** C11 had to build it by hand in
`src/app/main.ts`: a documented three-step wait — one `requestAnimationFrame`
for nisli's flush; then `viewport.getAnimations()` + `Promise.allSettled` for an
in-flight width transition ("`allSettled` because a transition superseded by a
newer one rejects, and being superseded is not an error here"); then another
frame, an explicit `solveAll()`, and a final frame "so anything measured after
this call sees settled boxes." Every measured check, every browser proof and any
future SSG pre-solve needs this, and today **every proof script in the repo
re-invents it** — `packages/www` alone ships seven `proof:*` scripts. Where it
lands: a new top-layer leaf beside `settle.ts`, exactly where `docs/adr/0030.2`
§7 places `settle()`. It imports `signal.ts` only, so it inverts nothing, and it
costs one export statement against the ≤15 ceiling (`:329-331`), which sits at
12 today. This is the seam that most clearly repays a core change.

**Seam 3 (unavoidable) — the diagnostic code registry is closed, and the codes
already collide.** `packages/core/src/diagnostics.ts:41` declares
`export const codes: Record<string, string> = { … }` as a module-level literal
with **no registration function**, and neither `codes` nor `isDev()` (`:96`)
reaches the barrel — `index.ts:141` exports `setDevMode` and nothing else from
that module. Ranges are pre-allocated by owner module (`:42-48`): `N1xx`
template, `N2xx` define/props, `N3xx` reactivity, `N4xx` lifecycle, `N5xx` DI,
`N6xx` "async: query/resource/settle diagnostics (query.ts, resource.ts — async
wave)". C11's registry (`src/appearance/diagnostics/codes.ts`) assigns `N601,
N610, N620, N621, N630, N640, N650, N660, N670, N680, N690` — **every one inside
core's `N6xx` async range**. Worse, `N601` is a number core deliberately
retired: "N601 (mixed QueryClients) was retired before release: N501 makes that
state unrepresentable at its cause. **The number is not reused**" (`:68-69`),
while `N602` and `N603` are live (`:66-67`). Shipping as-is puts two meanings on
`N601` inside one framework — and the peer's own `codes.ts` opens by declaring
that exact sin non-negotiable ("APPEND-ONLY, FOREVER … NEVER REUSED … Recycling
a number would silently repoint every existing suppression at an unrelated
failure, which is worse than a gap"). Two small core edits fix it: (a) allocate
the peer a range in core's table (`N7xx`/`N8xx`) — one line, zero runtime bytes,
preserving the property that a code is greppable in one place; or (b) add
`registerCodes(prefix, table)` so a peer owns its range at runtime, exported
from a devtools entry so the `.` budget is untouched. Either way core changes
*for* the peer, which is the bidirectional relationship in its cleanest form.
Note the quality direction is not one-way: the peer's `codes.ts` enforces "every
code has a docs slug" by throwing at construction (`codeEntry()`), which is
stronger machinery than core's plain `Record<string, string>` and is itself a
graduation candidate.

> **Addendum (live, 2026-08-25): `N700` makes this urgent rather than
> theoretical.** A new rule `N700` (competing primary actions) is being added to
> the C11 registry right now. `N7xx` is **unallocated in core's table** —
> `packages/core/src/diagnostics.ts:42-48` reserves `N1xx` through `N6xx` only —
> so `N700` is claiming a range of core's namespace with no entry on core's
> side recording that it is taken. That is exactly the outcome the range table
> exists to prevent: its own comment says "`Nxxx` range keys document ownership
> so parallel waves allocate without collision" (`:37-38`). The recommendation
> is unchanged and now cheaper to act on: **formally allocate the peer `N7xx`
> (and reserve `N8xx`) in core's `codes` table, and renumber the existing
> `N601`–`N690` out of core's async range during the move** — before any of it
> is published and the codes become public identifiers. Doing it now costs one
> line in core and a mechanical renumber in a package nobody depends on yet.

**Seam 4 (cheap) — the failure DOM contract is documented, not exported.** Core
stamps `data-nisli-error` on a host when setup or mount throws (codes `N401`,
`N402`; see the `runMountCallbacks` doc in `packages/core/src/lifecycle.ts`:
"the partial scope … is disposed, the error fallback renders, and the host is
stamped `data-nisli-error`"). `docs/adr/0030.2:326-329` rules that
"`data-nisli-error`/`nisli-error` are DOM contract, documented not exported."
The peer's checks want to report through the same channel so that one selector
finds every framework-detected failure — otherwise a page has two unrelated
error surfaces and an agent must know both. The seam is either an exported
attribute-name constant plus a stamping helper on a devtools entry, or a
specification precise enough in the ADR that the peer can stamp it itself. Zero
bytes either way.

**Explicitly NOT a missing seam — the `[data-fit]` subtree walk.**
`fitContainers(host)` is `host.querySelectorAll('[data-fit]')`. Core hands setup
the raw `host: HTMLElement` (`component.ts:105-108`), so a subtree walk needs
nothing from core. Asking for a walker would add API for no capability.

**Precedent that this conversation has a home.** ADR 0025 is exactly this genre —
`Status: Open (tracker — items graduate to their own ADRs when accepted)`
(`:4`) — created because "Building 46 registry items … made `@nisli/ui` the most
demanding consumer `@nisli/core` has ever had". It worked: `children()` was item
1 and now sits in the barrel (`packages/core/src/index.ts:107` — "Content
projection (ADR 0025 item 1)"), with the design-gate correction recorded in
`packages/core/src/projection.ts:2`; item 3 became the `attrs` declaration
(`component.ts:138`, `:193`, `:200`, `:383`, `:482`); item 11 became `el()`
(`template.ts:1375`). The new package will be a *more* demanding consumer than
ui was, and the same tracker shape fits without inventing anything.

### 7. Test and gate integration

**How tests are located and run.** Each package owns a `vitest.config.ts`;
`core`, `router` and `ui` use `{ globals: true, environment: 'happy-dom' }`,
`ssg` uses `environment: 'node'`. Tests sit beside source (`AGENTS.md`, Core
framework work: "Tests live beside source in `packages/core/src` and run under
happy-dom. Prefer public APIs"; UI registry work: "Registry tests live beside
copied source under `packages/ui/registry`"). The new package takes core's
config verbatim. `router:44` additionally runs `vitest run --typecheck` because
it ships `*.test-d.ts`; adopt that only if type-level tests are written.

**The permanent limit, and it is the important one.** happy-dom has no layout.
The experiment's `test/fakes.ts` opens by saying so: "happy-dom has no layout:
asking it for `scrollWidth` returns 0, so a 'DOM' test of the solver would
assert nothing at all." So `src/fit/dom.ts` and `src/diagnostics/dom.ts` — the
two DOM adapters — are **unreachable by `pnpm test`, permanently**. This is not
new for this repo: `AGENTS.md:96-97` records the identical constraint for the
router ("happy-dom has no layout and no native fragment navigation, so the unit
suite cannot see focus, scroll, or fragment bugs") and answers it with a
real-browser proof invoked by name (`AGENTS.md:95-96`:
`pnpm --filter @nisli/www proof:router-navigation`).

**Therefore the browser proof must be a CI step, not a test.** `ci.yml` already
has the shape: after `pnpm build` it runs
`pnpm --filter @nisli/www exec playwright install --with-deps chromium`, then
`pnpm --filter @nisli/www test:previews` ("Browser-render every UI preview"),
then `pnpm --filter @nisli/ui e2e:pack` ("UI package-shape e2e"), then
`pnpm test`. Add one step in that block:

```yaml
      - name: Appearance geometry proof
        run: pnpm --filter @nisli/<name> proof:geometry
```

Caveat: the existing Chromium install lands in **www's** node_modules, so the
new package either reuses www's browser or needs its own install step.

**Keep the self-test.** Self-testing proofs are already convention:
`packages/ui` has `e2e:theme:cleanup`, `e2e:button-group:cleanup`,
`e2e:context-touch:cleanup` and four more (`ui:55-72`); `www` has
`proof:router-navigation:vacuity` and `proof:message-layout:cleanup`. C11 ships
`--self-test` and its README makes it a precondition of trust: "all seven paths
are verified capable of failing before the run is trusted." Given the
experiment's own headline — "**five of the defects found were in the oracle, not
the page**" — dropping the self-test would remove the only check on the checker.

**Documentation obligations, from `AGENTS.md`:**

- **Package README** — every package has one; it is the npm README. For core
  specifically, "Keep its user-facing framework and ecosystem guidance aligned
  with the root `README.md`" (Repository shape), which is why both ecosystem
  lists must gain a bullet.
- **CHANGELOG** — `packages/{core,router,ssg,ui}/CHANGELOG.md` all exist.
  `packages/router/CHANGELOG.md:1-5` gives the house format: "keep-a-changelog-lite
  — one section per version, human-readable highlights. Releases happen at
  checkpoints (ADR 0022); dates are release dates", with an `## Unreleased`
  section on top. `AGENTS.md`, Release checklist: "Bump only the intended
  `packages/<name>/package.json` and update its changelog."
- **ADR** — `AGENTS.md`, Repository shape: "Architecture decisions belong in
  `docs/adr`; temporary or evidentiary worklists belong under
  `docs/worklists/<area>`, never at the repository root or among package
  source." Next free number is **0032** (`docs/adr/0031-atomic-dom-moves.md` is
  the highest). Frontmatter shape from `0031:3-5`: `**Date**`, `**Status**`,
  `**Depends on**`. Statuses in live use across the index: Proposed, Accepted,
  Active, Open, Resolved, Superseded.
- **NORTH-STAR precedent** — `packages/ui/NORTH-STAR.md` is the only one, with
  the sections Vision / Tenets / Invariants / Design language, and `AGENTS.md`,
  UI registry work makes it load-bearing: "Keep durable architecture in ADRs and
  current product status in `packages/ui/NORTH-STAR.md` and
  `packages/ui/CHANGELOG.md`." A permanent peer whose charter is "everything
  that makes nisli the default" is exactly the case that format exists for — in
  particular its **Invariants** section is where an exclusivity rule ("no
  `className`, no `size` prop, no value outside `theme/`") becomes a reviewable
  contract rather than a script's opinion.
- **Worklist** — evidence like the C11 findings belongs in
  `docs/worklists/<area>/`, and the nextgen ledger
  (`docs/worklists/nextgen/README.md`) is described in `AGENTS.md` as "the first
  thing the next session reads — keep it true."

### 8. Naming — ranked shortlist with collision data

**A fact that removes one axis from the decision entirely.** npm-name
plausibility is **identical for every candidate**, because the scope is owned:
all four published packages are `@nisli/*` (`packages/*/package.json:2`), so
there is no registry race for any leaf name and no squatting risk to arbitrate.
The only differentiator between candidates is **human mindshare and in-repo
ambiguity**. That is what the searches below measure.

**Charter test applied to every candidate.** The charter is appearance +
attention + declared state space. A name that covers only appearance is wrong on
day one, because `data-priority` / `data-collapse` are attention declarations
and the enumerable `VOCABULARY` in `contracts.ts` is a declared state space —
neither of which is styling.

---

**#1 — `@nisli/intent`** — *recommended*

- **In-repo collisions:** one exported identifier contains the word as a
  *suffix* — `export type ViewTransitionIntent = boolean | { readonly types?:
  string[] };` (`packages/router/src/engine.ts:22`, re-exported on the router
  barrel at `packages/router/src/index.ts:28`). Prose usages: "Scroll intent
  carried through from `navigate()`, when the caller gave one"
  (`engine.ts:31`); "Opt-out intent recorded by the capture-phase click
  listener" (`navigation-engine.ts:175`); "Scroll intent and the view-transition
  override ride `info`" (`navigation-engine.ts:219`).
- **What is *not* there:** no exported identifier named bare `Intent`, no module
  named `intent`, no occurrence in `AGENTS.md`, and no occurrence at all in
  `packages/core/src`, `packages/ssg/src` or `packages/ui/src`.
- **Charter fit: total.** `data-appearance` / `data-role` / `data-text` declare
  what a thing *is*; `data-layout` / `data-grow` / `data-align` declare how it
  composes; `data-priority` / `data-collapse` declare what matters least. All
  three are declarations of intent — which is also the design sketch's own
  framing: "the guarantees only exist if the intent layer is the *only* channel"
  (`C11-EXCLUSIVITY-AND-DERIVATION.md`, opening claims).
- **Weaknesses, stated plainly:** "intent" is common in a11y/UX writing, so it
  is not distinctive; and it names the *input* only — it says nothing about
  derivation or checking, which are half the value.
- **Verdict: lightest collision footprint of any candidate, and the only one
  that covers the whole charter.** The evidence supports the lean.

**#2 — `@nisli/derive`**

- **In-repo collisions: core's own vocabulary, in the barrel.**
  `packages/core/src/index.ts:124` is the section header
  `// ── Local async derivations ─────`; `packages/core/src/resource.ts:2` —
  "Local async derivations with reactive source tracking";
  `packages/core/src/resource.test.ts:2` — "Local async derivation lifecycle";
  `AGENTS.md:65` — "`resource()` for local async derivations without query-cache
  policy"; ADR 0028 is titled "Local Async Derivations with `resource()`".
  Additionally `packages/core/src/signal.ts:236` —
  `// ── Computed (derived, lazy, cached) ──` — and `:612` — "Create a derived,
  lazy, cached computed signal". And `AGENTS.md:106` uses it for codegen:
  "`packages/www/src/nisli-ui` is derived by the real UI CLI."
- **Charter fit: partial.** It names the mechanism precisely — the design sketch
  §3.1/§3.2 is literally "What 'mapping' is" vs "What 'resolving' is" — but it
  excludes attention and checking.
- **Weakness:** it would be the **third** meaning of "derive" reachable from the
  same barrel (reactivity, codegen, appearance).

**#3 — `@nisli/next`**

- **In-repo collisions:** prose and local identifiers only, listed in full in the
  headline section. No exported concept, no npm dependency.
- **Charter fit: fails.** The staging/temporary framing was explicitly rejected;
  `next` denotes exactly that, and it self-expires — a package called "next" is
  a lie on its first birthday.
- **Weakness:** Next.js mindshare on top of the semantic problem.

**#4 — `@nisli/resolve`**

- **In-repo collisions: a public method plus a term of art.**
  `RedirectDefinition.resolve(context)` is declared on a public interface
  (`packages/router/src/route.ts:303`) and implemented at `:314`. "Auto-resolution"
  is ADR 0005's name for the template engine's attribute-binding behaviour
  (`docs/adr/0005-props-vs-attributes-auto-resolution.md:9, 37, 53, 105, 116,
  128, 142, 218, 223`), and the term is still live in core source
  (`packages/core/src/component.ts:684`, `:692`, `:721`). It is also the single
  most overloaded verb in JavaScript (`Promise.resolve`; the root
  `tsconfig.json` sets `moduleResolution`).
- **Charter fit: partial**, same as `derive` and narrower.
- **Weakness:** two live in-repo senses plus ecosystem-wide overload.

**#5 — `@nisli/system`**

- **In-repo collisions: `@nisli/ui` already claims it.**
  `packages/ui/package.json:16` lists `"design-system"` among its **npm
  keywords**, and `packages/ui/NORTH-STAR.md:3` opens: "A component library and
  design system for the Nisli web-component framework." Generic prose elsewhere:
  `packages/core/src/emitter.ts:83` ("Bridge an event into the signal system"),
  `packages/core/src/signal.ts:560` ("log but don't crash the system").
- **Charter fit: broad enough**, arguably the broadest.
- **Weakness:** two packages in one scope both positioned as "the design system"
  is a support burden and a direct positioning conflict with an Accepted ADR
  (0022). It also says nothing at all about the idea.

**#6 — `@nisli/engine`** — *rejected*; see the headline. Three live senses, one
of them public router API (`defineRouter(catalog, { engine })`,
`application.ts:44`), one of them inside a user-visible thrown error
(`template.ts:1029`).

---

### Is the name cheap or expensive to change later?

**The mechanical work is identical for every candidate.** Two things carry the
name through the release system, and neither is name-sensitive:

- **`tag-prefix` is a free-text matrix field.** It appears once per package
  (`auto-tag.yml:27`, `:31`, `:35`, `:39`) and is consumed in exactly one place —
  `:52`, `TAG="${{ matrix.package.tag-prefix }}-v$CURRENT_VERSION"`. No other
  file in the repository reads it. It is additionally *described* in prose at
  `AGENTS.md:131-132` ("tags `core-vX.Y.Z`, `router-vX.Y.Z`, `ssg-vX.Y.Z`, and
  `ui-vX.Y.Z`") and consumed by hand in the recovery command at `AGENTS.md:152`
  (`gh release delete <package>-vX.Y.Z --cleanup-tag --yes`). Any string works;
  `engine-vX.Y.Z`, `intent-vX.Y.Z` and `next-vX.Y.Z` cost exactly the same.
- **Trusted Publisher is one per-package setting on npmjs.com** that must name
  the workflow file `auto-tag.yml` (`AGENTS.md:133`). It is keyed to the package
  name and is created once, regardless of what that name is.

**Before the first publish, a rename costs:** `git mv` the directory; three
lines in the matrix (`name`, `dir`, `tag-prefix`); `name` and
`repository.directory` in the manifest; two README bullets; the ADR title.
Under an hour, no external state touched.

**After the first publish it is effectively permanent:** npm cannot rename a
package — the only path is publishing a second package and deprecating the
first; the `<prefix>-vX.Y.Z` git tags and GitHub releases become historical
record; and a Trusted Publisher must be created afresh for the new name while
the old package retains its own.

**Therefore this is a now-decision** — not because the plumbing is hard, but
because publishing makes it irreversible. And the repo already has the exact
instrument for buying the time to decide: land the package with
`trusted-publisher: false` (`auto-tag.yml:55-60`), or land it `private` like
`packages/www` (`packages/www/package.json:4`). Both let the code be real while
the name stays free.

---

## Complete edit list — every file outside the new package directory

**Public mode — six existing files, one new file, one regenerated:**

| # | path | edit | reason |
|---|---|---|---|
| 1 | `.github/workflows/auto-tag.yml` (insert after `:40`) | add the fifth matrix entry (`name`, `dir`, `tag-prefix`, `trusted-publisher: false`) | `:24-40` lists exactly four; without an entry the package is never tagged and never published |
| 2 | `AGENTS.md:5-9` | "four independently versioned public packages" → five, plus a list item | factually wrong the moment the package lands; this is the first thing every agent reads |
| 3 | `AGENTS.md:80-127` (Package architecture) | add an ownership bullet in the same register as core/router/ssg/ui | that section is where "who owns what" is adjudicated; an unlisted package has no stated boundary |
| 4 | `AGENTS.md:131-132` and `:140` | "The matrix publishes core, router, SSG, and UI … tags `core-vX.Y.Z` …" and "for all four public packages" | publishing invariants are enumerated by name; a fifth tag prefix must appear or the invariant is silently false |
| 5 | `README.md:200-209` | add an ecosystem bullet | the repository's own package list |
| 6 | `packages/core/README.md:253-264` | add the same bullet | this is the **npm-facing** README; `AGENTS.md`, Repository shape makes alignment with the root README an explicit obligation |
| 7 | **NEW** `docs/adr/0032-<slug>.md` | the decision record | `AGENTS.md`: "Architecture decisions belong in `docs/adr`". 0031 is the highest number; frontmatter per `0031:3-5` |
| 8 | `docs/adr/README.md` | add the index row | every ADR has one, formatted `[NNNN. Title](./file.md) - Status - Date` |
| 9 | `pnpm-lock.yaml` | regenerated by `pnpm install`, never hand-edited | `experiments/README.md` and `AGENTS.md`, Worktree discipline both record the trap: after rebasing past a change that adds a workspace package, `Cannot find module @nisli/…` is a stale install, not a bug |

**Conditional, each with its trigger:**

| # | path | edit | trigger |
|---|---|---|---|
| 10 | `.github/workflows/ci.yml` | add an "Appearance geometry proof" step in the browser block | only if the proof becomes a gate. Chromium is installed into **www's** node_modules today |
| 11 | `.gitignore` | ignore the generated proof screenshots | before the 240-image `proof/shots/` directory moves under `packages/`. Today no rule matches it anywhere — see the §5 correction |
| 12 | `experiments/README.md` (current-experiments table) **and delete `experiments/c11-appearance/`** | remove the c11 row | `experiments/README.md`: "**Findings graduate, code does not.** … The prototype itself stays disposable." Keeping both invites divergence |
| 13 | `docs/worklists/nextgen/README.md` (contents table) and `NEXTGEN-SCRATCHPAD.md` §8 iteration log | record the outcome | `AGENTS.md`: the ledger is "the first thing the next session reads — keep it true" |
| 14 | `.agents/skills/nisli-framework/AGENTS.md:7` | "**Package entry points**: `@nisli/core`, `@nisli/core/vite-hmr`" | only if the new package introduces authoring rules an agent must follow. **This file is already stale**: `:1202-1204` claims `setDevMode` "is NOT re-exported from the `@nisli/core` barrel today", but `packages/core/src/index.ts:141` exports it |
| 15 | `packages/core/src/diagnostics.ts` | allocate the peer `N7xx` (and reserve `N8xx`) in the `codes` table, or add `registerCodes()` | **not optional** — §6 seam 3 and its N700 addendum |

**Verified NO change needed, each with the reason it is inert:**

- `pnpm-workspace.yaml` — `packages/*` already matches the new directory.
- root `package.json` — `pnpm -r <script>` dispatches by script name; no package
  list exists anywhere in it.
- root `tsconfig.json` — no `paths`, no `references`; resolution is via the pnpm
  symlink plus the package's own `exports`.
- `mise.toml` and `scripts/check-toolchain.mjs` — the checker reconciles the
  pnpm pin between `package.json` and `mise.toml`, and asserts `mise.toml`'s
  node equals the **minimum** `node-version:` across `.github/workflows/`. A new
  matrix entry introduces no `node-version:` line, so the check is unaffected.
- `packages/{core,router,ssg,ui,www}/package.json` — no sibling needs to depend
  on the new package. (`packages/www` *may* later, if the demo pages land there;
  that is a `devDependencies: { "@nisli/<name>": "workspace:*" }` addition and
  nothing else.)

**Private mode:** only items **2** (AGENTS.md repository shape) and **9**
(lockfile) are mandatory. Everything else waits for the deliberate release
commit — which is also when the name must be final.

---

## Ideas worth stealing

1. **`trusted-publisher: false` as a general "land now, release later" switch**
   (`auto-tag.yml:55-60`). It turns "this cannot ship yet" from a red job into a
   `::notice` naming the missing prerequisite and the exact line to change.
   Applicable twice here: it is the safe first landing, and it is what keeps the
   name reversible while §8 is decided.
2. **`packages/router/tsconfig.build.json:9` — excluding a named test-double
   module from the build.** The whole test strategy depends on `fakes.ts`
   ("`Metrics`, `Mutator` and `Inspector` exist so that every appearance
   DECISION can be exercised without a layout engine"), and the default exclude
   list would happily publish it. One line, verified precedent.
3. **`ui`'s `files` negation (`"!registry/**/*.test.ts"`, `packages/ui/package.json:46`).**
   The mechanism that ships raw source without shipping its tests — directly
   reusable if any `theme/` file ever gains a fixture.
4. **Core's pre-allocated diagnostic *ranges* with owner modules named in the
   table** (`packages/core/src/diagnostics.ts:42-48`, whose own comment is
   "range keys document ownership so parallel waves allocate without
   collision"). This is how parallel worktrees allocate codes safely, and it is
   exactly what C11 needed and did not consult — twice, now including N700. For
   an agent-authored framework, a namespace with declared owners is worth more
   than one with declared meanings.
5. **Self-testing proofs as convention** — `--self-test`, `:cleanup` and
   `:vacuity` variants across `ui` (seven) and `www` (two). For a package whose
   central risk is oracle truthfulness ("five oracle bugs to four page bugs"),
   the convention exists and should be adopted wholesale, not reinvented.
6. **ADR 0025's "tracker" genre** (`Status: Open (tracker — items graduate to
   their own ADRs when accepted)`, `:4`) as the durable shape for the peer↔core
   seam conversation. It is the mechanism by which `children()`, `attrs{}` and
   `el()` reached core under `@nisli/ui` pressure, with the graduated items
   still cited in core source (`index.ts:107`, `component.ts:138`,
   `template.ts:1375`).
7. **`experiments/README.md`'s gate-neutrality trick** — a workspace member that
   defines only non-standard script names is invisible to `pnpm -r`. If the
   package wants a surface that is not yet gate-worthy, that is how to hold it
   without weakening a gate.

---

## Where the prior art says we are wrong

1. **The diagnostic codes are already wrong, today, in the artefact everyone is
   admiring — and the mistake is still being made.** C11 assigns `N601`–`N690`
   inside the `N6xx` range core reserves for async diagnostics
   (`diagnostics.ts:48`), `N601` is a number core retired with "The number is
   not reused" (`:68-69`) while `N602`/`N603` are live (`:66-67`), and the new
   `N700` claims an `N7xx` range that core's table does not record as taken. The
   prototype's own `codes.ts` calls recycling a number "worse than a gap". This
   is not a packaging detail: the checker's public identifiers — what the entire
   "the framework checks the UI" pitch rests on — are being allocated without
   reading the framework's own registry.
2. **The 10KB ceiling is unmeasured *and* unenforced, and both halves are bad
   news.** ADR 0030.2 says "**adopt** a CI-enforced ceiling" (`:287`, future
   tense) and that ADR is `Proposed` (`:4`); `ci.yml` has no size step.
   Meanwhile the measured baseline is 8.8KB min+gzip at `@nisli/core@0.54.1`
   (`docs/adr/0029:9-11`) — about 1.2KB of headroom — and the experiment states
   it never measured itself: "**No byte budget.** `solve()`/`fit()` were never
   measured min+gzip against the 10KB core ceiling." The project is
   simultaneously unable to enforce the budget and unable to say whether the new
   work fits it. Either fix is cheap; having neither is the worst state.
3. **Shipping importable components contradicts an Accepted ADR.**
   `AGENTS.md`, Package architecture: `@nisli/ui` "is a registry plus the
   `nisli-ui` CLI, **not an importable runtime component library**", citing
   ADR 0022 and `packages/ui/NORTH-STAR.md`. If the new package exports
   `Button`, `Field`, `Toolbar`, `DataTable`, the repository gives two opposite
   answers to the same question, and the second was reached without the argument
   that produced the first. This is the most likely source of a later, expensive
   reversal.
4. **A fifth package makes every release slower and more coupled.** Each matrix
   job runs repository-wide `pnpm build` (`auto-tag.yml:88-90`) and `pnpm test`
   (`:92-94`) before publishing, so a failing or slow suite in the new package
   blocks and delays core's, router's, ssg's and ui's releases. Nobody pays this
   until the first bad day.
5. **The name decision taken most recently is the wrong one, and my own fallback
   is only third-best.** `engine` collides with public router API; `next`
   collides with nothing but means the opposite of what was decided. Naming is
   the cheapest thing to fix before first publish and among the most expensive
   after it (§8).
6. **~40% of the bet can never be core-shaped, and that must be written down.**
   The resolution table is CSS; core has no CSS mechanism at any layer
   (`packages/core/package.json:44-48`, `:50`, `:20-24`). Under the
   permanent-peer framing this is fine — but it is exactly the fact that gets
   re-discovered in six months by someone asking "why isn't this in core?".
   Record it in the ADR as a decided constraint, not an accident.
7. **The repo's default gate structurally cannot see the new package's most
   defect-dense code.** happy-dom has no layout (`test/fakes.ts` module doc), so
   `fit/dom.ts` and `diagnostics/dom.ts` are permanently untestable under
   `pnpm test` — and those adapters are precisely where the experiment found its
   bugs ("five of the defects found were in the oracle, not the page"; N650
   measured the padding box and produced 710 wrong findings across the matrix;
   N690 repeated the same mistake in the rule written to prevent it). A package
   whose riskiest code is invisible to its own gate needs the browser proof to
   be a **required** CI step from day one, not an optional script.
8. **Minor, but it is a claim in a document people trust:** the C11 README says
   "`proof/shots/` is gitignored". No `.gitignore` rule anywhere in the
   repository matches it. If a small, checkable claim in that README is untrue,
   the larger unchecked claims deserve the same scepticism — which is, to be
   fair, exactly the discipline `no-values-guard.mjs` was written to enforce
   ("A README sentence saying so decays in a week. This does not.").

---

## Open questions for the maintainer

1. **The name.** *Tradeoff:* `@nisli/intent` has the lightest collision
   footprint and is the only candidate covering appearance + attention +
   declared state space, but it names the input and not the derivation;
   `@nisli/derive` names the mechanism but is core's own word for `resource()`
   and `computed()`; `@nisli/system` is broad but `@nisli/ui` already claims
   "design system" in its npm keywords. Deciding before the first publish costs
   under an hour; deciding after costs a deprecation and a second package (§8).
2. **Where do `src/ui`'s 8 primitives and 5 patterns live?** *Tradeoff:*
   shipping them as importable factories contradicts ADR 0022's "not an
   importable runtime component library"; moving them into the `@nisli/ui`
   registry obeys 0022 but puts them behind copy-in, where a consumer can delete
   the exclusivity on day one and the `no-values-guard` has no jurisdiction. The
   experiment's own weighting says the primitives are 0% of the bet and the
   vocabulary is 20%, which argues for the registry — but then the guard needs a
   new home too.
3. **Public on npm from day one, or private until the API settles?**
   *Tradeoff:* publishing early gets real consumers, but `docs/adr/0030.2:333-336`
   demands the first publish be "deliberate and sequenced with arch", every
   published export becomes a compatibility obligation, and publishing freezes
   both the name and every diagnostic code.
4. **Which of the four §6 seams does core take, and does `N7xx` get allocated
   now?** *Tradeoff:* each seam spends against the ≤15-statement barrel ceiling
   (`0030.2:329-331`; 12 today) and the 10KB budget, versus the peer permanently
   re-implementing platform glue that `@nisli/ssg` and the www proofs also need.
   My ranking: seam 3 (code range) is mandatory and now time-sensitive; seam 2
   (post-layout quiescence) has the best payoff-to-bytes ratio; seam 4 is nearly
   free; seam 1 is mostly documentation.
5. **Does the new package get a `NORTH-STAR.md`?** *Tradeoff:* one more document
   to keep true (and `AGENTS.md` makes keeping it true an obligation), versus
   being the only place a permanent peer's charter and its **Invariants** — "no
   `className`, no `size` prop, no value outside `theme/`" — can live as a
   reviewable contract rather than a script's opinion.
6. **Does `@nisli/ssg` pre-solve the static tier?** *Tradeoff:* the experiment
   lists "No SSG pre-solve" as untested and the design sketch claims it as an
   advantage ("Owns the build (`@nisli/ssg`) — the static tier of resolution can
   be pre-solved; no runtime cost"). If yes, `@nisli/ssg` gains a dependency on
   the new package and the dependency graph stops being a star centred on core —
   a real architectural change, not a feature.
7. **Does the C11 experiment get deleted when the package lands?** *Tradeoff:*
   `experiments/README.md` says "Findings graduate, code does not" and
   "Deletable wholesale", but the 240-cell proof and its committed visual record
   are the evidence base for the whole bet. Deleting the directory without first
   moving that evidence into `docs/worklists/nextgen/` loses the only thing that
   makes the claim checkable.

---

## Belongs to another slice

- **Subtree scoping (`obs.declared(selector)`) and the N700 rule itself** belong
  to the diagnostics/rules slice, not to packaging. Recorded here only where it
  touches my slice: the code-range allocation (§6 seam 3 addendum) and the
  `docs/adr` / core-table edit it implies (edit-list item 15).
- **Whether any existing rule should be rewritten to use subtree scoping** is a
  rules-slice decision. I own no rules and changed none.
- **The stale `setDevMode` claim in `.agents/skills/nisli-framework/AGENTS.md:1202-1204`**
  (it says `setDevMode` is not on the core barrel; `packages/core/src/index.ts:141`
  exports it) is a docs-accuracy fix outside my slice; noted in edit-list item 14.

---

## Sources

**Package manifests**
- `packages/core/package.json` — `:3`, `:5`, `:6`, `:7-11`, `:12-19`, `:20-24`,
  `:25-40`, `:28-29`, `:32-33`, `:36-37`, `:41-43`, `:44-48`, `:49-53`, `:50`
- `packages/router/package.json` — `:5-11`, `:12`, `:13-15`, `:16-19`, `:20-24`,
  `:25-40`, `:41`, `:42-46`, `:44`
- `packages/ssg/package.json` — `:3`, `:5-11`, `:12-18`, `:19-21`, `:22-24`,
  `:25-28`, `:29-32`, `:33-44`, `:45-49`, `:50-55`
- `packages/ui/package.json` — `:3`, `:5-11`, `:12-20`, `:16`, `:21-23`,
  `:24-26`, `:27-31`, `:32-34`, `:35-42`, `:43-49`, `:45`, `:46`, `:50-72`
- `packages/www/package.json` — `:4` (`"private": true`), scripts,
  devDependencies (`playwright` pinned `1.61.1`)
- `package.json` (root) — `:3-7`, `packageManager: pnpm@10.17.1`
- `experiments/c11-appearance/package.json`

**Build / workspace config**
- `tsconfig.json` (root)
- `packages/{core,router,ssg,ui}/tsconfig.json`; `packages/core/tsconfig.json:4`
- `packages/{core,router,ssg,ui}/tsconfig.build.json`;
  `packages/router/tsconfig.build.json:9`
- `packages/{core,router,ssg,ui}/vitest.config.ts`;
  `experiments/c11-appearance/vitest.config.ts`
- `pnpm-workspace.yaml`; `mise.toml`; `scripts/check-toolchain.mjs`; `.gitignore`

**CI / publishing**
- `.github/workflows/auto-tag.yml` — `:1`, `:3-8`, `:10-12`, `:16`, `:22-23`,
  `:24-40`, `:27`, `:31`, `:35`, `:39`, `:46-70`, `:52`, `:55-60`, `:64-69`,
  `:80`, `:84-86`, `:88-90`, `:92-94`, `:96-98`, `:100-107`, `:109-115`,
  `:117-128`, `:120-125`, `:126-128`
- `.github/workflows/ci.yml` — `:25`, `:60`, and the named steps (toolchain
  check, install, build, Chromium install, `test:previews`, `e2e:pack`,
  `pnpm test`, `published-ui-e2e`)

**Repository law**
- `AGENTS.md` — `:5-9` (repository shape), `:65`, `:80-81`, `:82-83`, `:84-97`
  (router bullet; the `NavigationEngine` seam at `:90-97`), `:105-107`
  (ssg/client), `:108-112` (ui registry charter), `:129-140` (publishing
  invariants: `:131-133`, `:134`, `:135-138`, `:139-140`), `:142-152` (failure
  pattern: `:144-148`, `:149-152`), Release checklist, Worktree discipline, Core
  framework work, UI registry work
- `experiments/README.md`
- `.agents/skills/nisli-framework/AGENTS.md` — `:7`, `:1202-1204` (stale claim
  about `setDevMode`)

**ADRs**
- `docs/adr/README.md` (index and status vocabulary)
- `docs/adr/0005-props-vs-attributes-auto-resolution.md` — `:9`, `:37`, `:53`,
  `:105`, `:116`, `:128`, `:142`, `:218`, `:223`
- `docs/adr/0017-framework-package-extraction.md` (Accepted — zero dependencies,
  single barrel export, `publishConfig` from the start)
- `docs/adr/0022-nisli-ui-component-library.md` — `:4` (Accepted), `:246-249`
- `docs/adr/0025-core-proposals-from-ui.md` — `:1-5` (Open tracker), item 1
  (`children()`) and its design-gate correction
- `docs/adr/0026-typed-application-router.md` — `:673`
- `docs/adr/0028-local-async-resource.md` (title: "Local Async Derivations with
  `resource()`")
- `docs/adr/0029-agent-native-ui-strategy.md` — `:9-11` (25.2KB min / 8.8KB
  min+gzip at `@nisli/core@0.54.1`)
- `docs/adr/0030-agent-native-authoring.md` — `:222-224` (CI-measured token
  budget)
- `docs/adr/0030.1-agent-native-gap-audit.md` — B3, B4, B6
- `docs/adr/0030.2-agent-native-core-ergonomics.md` — `:4` (Proposed),
  `:269-289` (§6 sequencing and budget; `:286-289` the 10KB ceiling), `:291-317`
  (§7 placement, module layering, dev-only weight; `:314-317` the proposed
  `@nisli/core/devtools`), `:319-331` (API-surface tally, ≤15 statements),
  `:326-329` (`data-nisli-error` documented not exported), `:333-336` (new
  packages rule), `:467-471` (duplicate registries)
- `docs/adr/0031-atomic-dom-moves.md` — `:3-5` (frontmatter shape), `:254`
- `docs/issues/README.md` (status table: open / resolved / wont-fix + priority)

**Core source**
- `packages/core/src/index.ts` — `:75`, `:107`, `:124`, `:141`
- `packages/core/src/diagnostics.ts` — `:37-38`, `:41`, `:42-48`, `:48`,
  `:66-67`, `:68-69`, `:96`, `:104`
- `packages/core/src/lifecycle.ts` (`onMount`, `onCleanup`, `useHostEvent`, and
  the `runMountCallbacks` doc naming `data-nisli-error`)
- `packages/core/src/component.ts` — `:22-28`, `:105-108`, `:138`, `:161-163`,
  `:193`, `:200`, `:258`, `:383`, `:460`, `:482`, `:487`, `:684`, `:692`,
  `:721`, `:773-774`, `:870`
- `packages/core/src/context.ts` — `:19-24`
- `packages/core/src/template.ts` — `:2`, `:1029`, `:1307-1314`, `:1375`
- `packages/core/src/view-transition.ts` — `:27`, `:68`, `:71`
- `packages/core/src/signal.ts` — `:236`, `:560`, `:612`
- `packages/core/src/resource.ts` — `:2`; `resource.test.ts:2`
- `packages/core/src/projection.ts` — `:2`
- `packages/core/src/emitter.ts` — `:83`
- `packages/ssg/src/client.ts` — `:29-30`

**Router source (the `engine` collision)**
- `packages/router/src/engine.ts` — `:7`, `:11-12`, `:16`, `:19-22`, `:24-25`,
  `:31`, `:43-44`, `:66-67`, `:86`, `:91`
- `packages/router/src/router.ts` — `:45`, `:61`, `:64-67`, `:74`, `:212`,
  `:228-231`, `:256-260`, `:275-301`
- `packages/router/src/application.ts` — `:44`, `:90`, `:93`
- `packages/router/src/index.ts` — `:28`
- `packages/router/src/history-engine.ts`, `navigation-engine.ts` (`:175`,
  `:219`), `navigation-double.ts`
- `packages/router/src/route.ts` — `:283`, `:295-303`, `:314`
- `packages/router/src/vite.ts` — `:24`, `:63`, `:69`, `:80`
- `packages/router/src/router.test.ts:291`;
  `packages/router/src/navigation-engine.test.ts:243`;
  `packages/router/src/matcher.test.ts:165, 178`
- `packages/router/CHANGELOG.md:1-5`

**UI (Next.js prose collision, CSS shipping, north-star precedent)**
- `packages/ui/registry/default/ui/combobox.ts:20`;
  `packages/ui/registry/default/ui/combobox.test.ts:30, 235, 240, 246, 253, 259,
  293, 347`
- `packages/ui/registry/default/styles/theme.css`;
  `packages/ui/src/registry-integrity.test.ts` (the CSS-import integrity checks)
- `packages/www/src/hydrate-examples/combobox.ts:9`;
  `packages/www/src/nisli-ui/ui/combobox.ts:20`
- `packages/ui/NORTH-STAR.md` — `:3`, and the Vision / Tenets / Invariants
  structure

**The C11 experiment**
- `experiments/c11-appearance/README.md` (weighting, F1–F11, measured results,
  "What this does NOT prove", "Packaging")
- `src/appearance/contracts.ts`; `src/appearance/index.ts`
- `src/appearance/fit/{candidates,strategies,solver,dom,observe}.ts`
- `src/appearance/diagnostics/{codes,runner,report,admitted,dom}.ts` and
  `rules/{contrast,crushed,escaped,fit-state,hit-target,index,overlap,shredded,truncation,viewport,vocabulary}.ts`
- `src/appearance/explain.ts`
- `src/theme/{index,tokens,structure,roles,states}.css`
- `src/ui/index.ts`, `src/ui/primitives/*` (8), `src/ui/patterns/*` (5)
- `src/app/{main,shell,state}.ts`, `src/app/pages/*` (4)
- `src/{appearance,components,app}.ts` (dead v1 monolith)
- `test/{fakes,solver,strategies,candidates,diagnostics,overflow-menu}.ts`
- `proof/{geometry-proof,no-values-guard}.mjs`, `proof/*.webp|png`,
  `proof/shots/` (240 files)
- `index.html`, `vite.config.mjs`, `vitest.config.ts`

**Parent worklist**
- `docs/worklists/nextgen/NEXTGEN-SCRATCHPAD.md` (§0.1, §4 C10/C11, §5, §5.1,
  §6, §7, §8)
- `docs/worklists/nextgen/C11-EXCLUSIVITY-AND-DERIVATION.md` (§1, §2, §2.2,
  §2.3, §3.1–§3.4)
- `docs/worklists/nextgen/README.md`

