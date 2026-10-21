# Core frontier — October 2026

Evidence gathered 2026-10-20 (America/Los_Angeles), against
`4afde49c728a330e10ce887a38b8013d63b58498`, core `0.56.0`.

Research in response to making core more native, faster, more semantic and
ergonomic, and the framework more useful to coding and operating agents.
These are recommendations, not ratified ADRs or implemented features.

Start with [REPORT.md](./REPORT.md). [sources.json](./sources.json) records
the authoritative GitHub files fetched and their content blob IDs.

**Reassessment after maintainer feedback:** the original ranking confused
measurable implementation differences with sufficient reason to change the
architecture. No proposed runtime refactor has demonstrated application benefit
large enough to justify migration or capability risk. The wrapper-removal priority
is withdrawn. See [the reassessment](./reviews/risk-value-reassessment.md).

| Bet | Evidence / decision | Implementation status |
| --- | --- | --- |
| [01 Native rendering regions and keyed moves](./briefs/01-native-regions.md) | Wrapper-removal priority withdrawn; preserve measured findings as scoped compatibility evidence. Move optimization needs workload evidence | Deferred; no architectural change recommended |
| [02 Cached binding blueprints](./briefs/02-binding-blueprints.md) | Plausible mechanism; no application profile or measured speedup | Hold pending profiling |
| [03 Agent contract and repair loop](./briefs/03-agent-contract.md) | Separate additive authoring experiments from a broad schema/state migration; existing engine tools are the baseline | Research only; no migration recommended |
| [04 Native overlays](./briefs/04-native-overlays.md) | Capability/parity risk remains unpriced; platform availability alone does not justify replacement | Deferred pending concrete consumer benefit |
| [05 WebMCP adapter](./briefs/05-webmcp.md) | Optional extension candidate only when a concrete operator task needs it | Deferred; experimental upstream API |
| [06 Reactive graph optimization](./briefs/06-reactive-graph.md) | Profile first; reusable edges are a plausible candidate, not a demonstrated bottleneck | Hold |

## Experiments and validation

- [Native semantics and keyed move probe](./experiments/native-semantics/RESULT.md):
  **negative result**, 14/27 checks fail across Chromium 149, Firefox 151,
  WebKit 26.5. The checks remain strict and the command intentionally exits 1.
- Baseline `pnpm --filter @nisli/core test`: **465/465 tests pass** in 21 files.
- [Adversarial self-review](./reviews/self-review.md): limitations and rejection
  criteria; this is not an independent review.

Production source, dependencies, package versions and prior research ledgers were
not changed. No push, release, or CI claim is made.
