# Production diagnostics — issue #3

Status: **complete; core 0.57.0 released and verified on npm; release CI green**.
Local research date: 2026-10-20, America/Los_Angeles. Source commit:
`4afde49c728a330e10ce887a38b8013d63b58498`, core 0.56.0.

Start with [REPORT.md](REPORT.md). This program investigates
[issue #3](https://github.com/gkoreli/nisli/issues/3), including published-package
reproduction, real browser behavior, removal of development code, and packaging.
The experiments here preserve the original throwaway prototypes and results.
After the engineering go-ahead, the distribution contract was implemented in
package source, publication tooling, documentation, and CI. See
[ADR 0048](../../adr/0048-production-diagnostic-artifacts.md) and the
[engineering evidence](../../worklists/core/ISSUE-3-PRODUCTION-DIAGNOSTICS.md).
Core 0.57.0 is published as npm's latest version. Release commit `1d055ca` passed
remote CI and publishing; the downloaded npm tarball passed integrity, package
shape, byte identity, and production bundling checks. The engineering evidence
links the runs and records the npm results.

| Bet / deliverable | Status | Evidence / disposition |
| --- | --- | --- |
| Published 0.56.0 issue reproduction | Confirmed | Four bundles match upstream SHA-256, bytes, gzip, diagnostics; three browsers |
| Runtime-probe repair as complete solution | Rejected | Silence works; 2,806 audit bytes remain |
| Shared constant/function as sufficient removal boundary | Rejected for tested esbuild | `isDev() => false` retains full audit; imported constant microprobe retains sentinel |
| Consumer-defined Nisli build flag | Technically feasible, not recommended | Would move package responsibility into consumer configuration |
| Conditional exports alone | Rejected for automatic esbuild dev selection | No-minify and NODE_ENV development still select default export |
| Publisher-owned bundler/native profiles | Implemented, locally validated | Packed esbuild + Vite consumers; native ESM; production safeguards |
| Mixed full-runtime profile imports | Falsified as safe | DI override lost in all three browsers |
| One canonical import map across modules | Validated | Shared function identity and DI override in all three browsers |
| Existing core suite | Passed | 465 baseline; 465 native-dev prototype; 465 bundler-dev prototype |
| Adversarial review | Completed as self-review | [reviews/self-review.md](reviews/self-review.md); not an independent review |
| Production migration and declarations | Implemented, locally validated | README/changelog; packed declarations without Node ambient types |
| HMR/SSG integration | Passed | Packed SSG in Node dev/prod; actual Vite file-watch updates in three browsers |
| Workspace gates | Passed | Build, typecheck, 2,338 tests across seven packages |
| Remote CI / release | Passed | Core 0.57.0 published; [CI](https://github.com/gkoreli/nisli/actions/runs/39556217085) and [publishing](https://github.com/gkoreli/nisli/actions/runs/39556217066) green; npm tarball verified |

## Contents

- [Report and proposal](REPORT.md)
- [Runtime detection/removal brief](briefs/01-runtime-gating.md)
- [Conditional export brief](briefs/02-conditional-exports.md)
- [Publisher profiles brief](briefs/03-publisher-profiles.md)
- [Runtime identity and optional diagnostics brief](briefs/04-runtime-identity.md)
- [Commands, full outputs, verdicts](experiments/bundle-contract/RESULT.md)

Generated JavaScript, tarballs, installations, and browser fixtures are ignored
under `experiments/bundle-contract/generated/`. Scripts, results, and complete
command output are retained. Unrelated work in other research programs and
concurrent edits to repository guidance were left untouched.
