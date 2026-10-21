# Issue #3 — engineering evidence

Status: **implemented and locally validated; core 0.57.0 release in progress**.
Source baseline: `4afde49c728a330e10ce887a38b8013d63b58498`, core 0.56.0.
Local date: 2026-10-20 (America/Los_Angeles).
Decision: [ADR 0048](../../adr/0048-production-diagnostic-artifacts.md).
Original reproduction: [research](../../research/2026-10-production-diagnostics/REPORT.md).

## Delivered

- Optional diagnostic callsites, payloads, stack capture, allocations, and
  bookkeeping have direct standard NODE_ENV guards. Production components no
  longer carry diagnostic-only setup/echo/read tracking properties.
- A publisher-owned build emits bundler ESM, native development ESM at the
  existing `dist/index.js` URL, native production ESM at
  `dist/index.production.js`, and declarations. No runtime dependency added.
- Published exports use one module tree for root and HMR. Native applications
  use a canonical root import map. Source workspace exports remain unchanged.
- README and changelog document the changed production override contract and
  native-browser migration. The release target is core 0.57.0, confirmed
  available on npm before release.
- A single private `src/env.d.ts` supplies the compiler-only process type. The
  packed consumer asserts that no process global leaks into browser declarations.
- Permanent packed-consumer proof added to CI, alongside all three browser
  installations and a root typecheck gate.

## Validation

| Command | Result |
| --- | --- |
| `pnpm install --offline` | Passed; exact esbuild 0.28.1 and Vite 7.3.6 dev dependencies recorded |
| `pnpm build` | Passed across workspace; site generated and hydration bundles built |
| `pnpm typecheck` | Passed across workspace |
| `pnpm test` | 165 files, 2,338 tests passed across seven packages |
| `pnpm --filter @nisli/core test:package` | Passed; packed consumer, declarations, SSG, and 60 browser scenarios |
| `git diff --check` | Passed |

Workspace tests: core 465, router 127, engine 320, SSG 57, Ledger 190, UI 1,126,
website 53. Full root outputs are in [issue-3-validation](issue-3-validation/).
No assertions were weakened and no failures were skipped. Expected diagnostics
from deliberate error fixtures appear in test output.

The package proof ran on Node 22.23.2, pnpm 10.17.1, Playwright 1.61.1:

| Browser | Version | Result |
| --- | --- | --- |
| Chromium | 149.0.7827.55 | 17 consumer/safety/HMR cases, 2 native identity cases, 1 live Vite HMR case passed |
| Firefox | 151.0 | Same 20 cases passed |
| WebKit | 26.5 | Same 20 cases passed |

The browsers ran with no `process` global. Native applications loaded unchanged
JavaScript using an import map, with no application compiler. Packed esbuild and
Vite production consumers needed no custom define or Nisli plugin. Vite HMR
used the real packed plugin and file watcher: the same custom element survived,
the old setup disposed once, and the replacement counter remained reactive.
Packed SSG passed in Node development and production, including shared DI,
reactive settling, and disposal. Public declarations compiled with `types: []`.

## Size and removal evidence

Final permanent fixture (`packages/core/scripts/fixtures/consumer.js`):

| Consumer configuration | Bytes | Gzip level 9 | Audit module bytes |
| --- | ---: | ---: | ---: |
| esbuild automatic production | 18,538 | 6,316 | 0 |
| esbuild explicit NODE_ENV production | 18,538 | 6,316 | 0 |
| esbuild nonminified development | 52,414 | 12,990 | 5,325 |
| esbuild minified explicit development | 23,360 | 8,253 | 2,810 |
| Vite production | 18,762 | 6,317 | Not attributed; removal sentinels pass |

The full native production artifact also passes removal assertions for all
optional diagnostic codes, audit helpers, attribution stacks, and diagnostic
object fields. Native production source maps do not embed original source.
Development retains diagnostic source maps and N102 behavior. Runtime suppression
silences development without shrinking the artifact; production overrides cannot
bring removed instrumentation back.

This fixture differs from the upstream issue's exact counter fixture. Do not
subtract these sizes from the original reproduction's sizes to claim savings.
The original research preserves its own exact-fixture comparison.

## Safety behavior proved in production

- N105 double mount, N106 unbranded markup, N107 unavailable sanitizer, N602
  invalid query key remain enforced.
- Setup/mount failures still report N401/N402, stamp the host, and emit bubbling
  `nisli-error` events.
- Self-writing effects stop and remain disposed; asynchronous effect rejections
  are caught and logged.
- A throwing event handler is caught/logged and another handler still works.
- Production retains the first duplicate component definition and permits late
  provider override; development retains N201/N501.
- Multiple modules importing the canonical root share function identity and DI.

## Scope and release status

Unrelated edits to framework tenets, AGENTS, existing ADR guidance, and other
research programs are preserved and excluded from the release commit. The user
authorized releasing core 0.57.0, committing only this work, pushing main,
watching CI/publishing, and verifying npm. Remote verification is in progress;
local success alone is not release completion.
